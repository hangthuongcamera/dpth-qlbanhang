-- Customer groups and their optional price overrides.
CREATE TABLE IF NOT EXISTS public.nhom_khach_hang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ten_nhom text NOT NULL,
  trang_thai boolean NOT NULL DEFAULT true,
  ap_dung_bang_gia boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nhom_khach_hang_ten_nhom_key UNIQUE (ten_nhom)
);

ALTER TABLE public.khach_hang
  ADD COLUMN IF NOT EXISTS nhom_khach_hang_id uuid
  REFERENCES public.nhom_khach_hang(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.kiem_tra_nhom_khach_hang_dang_hoat_dong()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.nhom_khach_hang_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.nhom_khach_hang_id IS DISTINCT FROM OLD.nhom_khach_hang_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.nhom_khach_hang AS n
        WHERE n.id = NEW.nhom_khach_hang_id AND n.trang_thai = true
     ) THEN
    RAISE EXCEPTION 'Không thể gán khách hàng vào nhóm đã ngừng hoạt động.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS khach_hang_nhom_dang_hoat_dong_trg ON public.khach_hang;
CREATE TRIGGER khach_hang_nhom_dang_hoat_dong_trg
BEFORE INSERT OR UPDATE OF nhom_khach_hang_id ON public.khach_hang
FOR EACH ROW EXECUTE FUNCTION public.kiem_tra_nhom_khach_hang_dang_hoat_dong();

CREATE TABLE IF NOT EXISTS public.gia_nhom_khach_hang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nhom_khach_hang_id uuid NOT NULL
    REFERENCES public.nhom_khach_hang(id) ON DELETE CASCADE,
  san_pham_id uuid REFERENCES public.san_pham(id) ON DELETE CASCADE,
  bien_the_san_pham_id uuid REFERENCES public.bien_the_san_pham(id) ON DELETE CASCADE,
  don_gia numeric NOT NULL CHECK (don_gia >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gia_nhom_khach_hang_mot_doi_tuong_check
    CHECK ((san_pham_id IS NOT NULL) <> (bien_the_san_pham_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS gia_nhom_khach_hang_san_pham_uidx
  ON public.gia_nhom_khach_hang (nhom_khach_hang_id, san_pham_id)
  WHERE san_pham_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gia_nhom_khach_hang_bien_the_uidx
  ON public.gia_nhom_khach_hang (nhom_khach_hang_id, bien_the_san_pham_id)
  WHERE bien_the_san_pham_id IS NOT NULL;

ALTER TABLE public.don_hang_chi_tiet
  ADD COLUMN IF NOT EXISTS bien_the_san_pham_id uuid
    REFERENCES public.bien_the_san_pham(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS gia_goc numeric,
  ADD COLUMN IF NOT EXISTS gia_da_chinh_sua_thu_cong boolean NOT NULL DEFAULT false;

UPDATE public.don_hang_chi_tiet
   SET gia_goc = don_gia
 WHERE gia_goc IS NULL;

ALTER TABLE public.don_hang_chi_tiet
  ALTER COLUMN gia_goc SET DEFAULT 0,
  ALTER COLUMN gia_goc SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'don_hang_chi_tiet_gia_goc_check'
       AND conrelid = 'public.don_hang_chi_tiet'::regclass
  ) THEN
    ALTER TABLE public.don_hang_chi_tiet
      ADD CONSTRAINT don_hang_chi_tiet_gia_goc_check CHECK (gia_goc >= 0);
  END IF;
END
$$;

ALTER TABLE public.nhom_khach_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gia_nhom_khach_hang ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_manage_nhom_khach_hang
  ON public.nhom_khach_hang;
CREATE POLICY authenticated_manage_nhom_khach_hang
  ON public.nhom_khach_hang
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_manage_gia_nhom_khach_hang
  ON public.gia_nhom_khach_hang;
CREATE POLICY authenticated_manage_gia_nhom_khach_hang
  ON public.gia_nhom_khach_hang
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.nhom_khach_hang, public.gia_nhom_khach_hang
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.don_hang_chi_tiet
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tao_don_hang_voi_chi_tiet(
  p_khach_hang_id uuid,
  p_ngay_dat date,
  p_han_giao date,
  p_tam_tinh numeric,
  p_giam_gia numeric,
  p_phi_van_chuyen numeric,
  p_tong_tien numeric,
  p_ghi_chu text,
  p_chi_tiet jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_don_hang_id uuid;
  v_item jsonb;
  v_ma_don_hang text;
BEGIN
  IF p_khach_hang_id IS NULL OR p_chi_tiet IS NULL OR jsonb_typeof(p_chi_tiet) <> 'array' THEN
    RAISE EXCEPTION 'Customer and at least one order item are required.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_chi_tiet) = 0 THEN
    RAISE EXCEPTION 'Customer and at least one order item are required.' USING ERRCODE = '22023';
  END IF;
  IF p_tam_tinh < 0 OR p_giam_gia < 0 OR p_phi_van_chuyen < 0 OR p_tong_tien < 0 OR p_giam_gia > p_tam_tinh OR p_tong_tien <> p_tam_tinh - p_giam_gia + p_phi_van_chuyen THEN
    RAISE EXCEPTION 'Order amounts must be non-negative.' USING ERRCODE = '22023';
  END IF;

  v_ma_don_hang := 'DH-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.don_hang (ma_don_hang, khach_hang_id, ngay_dat, han_giao, tam_tinh, giam_gia, phi_van_chuyen, tong_tien, ghi_chu)
  VALUES (v_ma_don_hang, p_khach_hang_id, coalesce(p_ngay_dat, CURRENT_DATE), p_han_giao, p_tam_tinh, p_giam_gia, p_phi_van_chuyen, p_tong_tien, nullif(p_ghi_chu, ''))
  RETURNING id INTO v_don_hang_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_chi_tiet)
  LOOP
    IF coalesce((v_item ->> 'so_luong')::numeric, 0) <= 0 OR coalesce((v_item ->> 'don_gia')::numeric, -1) < 0 OR coalesce((v_item ->> 'gia_goc')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Order item quantity and prices are invalid.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.don_hang_chi_tiet (
      don_hang_id, san_pham_id, bien_the_san_pham_id, so_luong, don_gia, gia_goc,
      gia_da_chinh_sua_thu_cong, giam_gia, thanh_tien, ghi_chu
    ) VALUES (
      v_don_hang_id,
      (v_item ->> 'san_pham_id')::uuid,
      nullif(v_item ->> 'bien_the_san_pham_id', '')::uuid,
      (v_item ->> 'so_luong')::numeric,
      (v_item ->> 'don_gia')::numeric,
      (v_item ->> 'gia_goc')::numeric,
      coalesce((v_item ->> 'gia_da_chinh_sua_thu_cong')::boolean, false),
      0,
      (v_item ->> 'so_luong')::numeric * (v_item ->> 'don_gia')::numeric,
      nullif(v_item ->> 'ghi_chu', '')
    );
  END LOOP;
  RETURN v_don_hang_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tao_don_hang_voi_chi_tiet(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb) TO authenticated;
