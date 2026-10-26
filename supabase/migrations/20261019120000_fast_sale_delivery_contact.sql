ALTER TABLE public.don_hang
  ADD COLUMN IF NOT EXISTS giao_hang boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS so_dien_thoai_giao_hang text,
  ADD COLUMN IF NOT EXISTS dia_chi_giao_hang text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.don_hang'::regclass
       AND conname = 'don_hang_delivery_contact_check'
  ) THEN
    ALTER TABLE public.don_hang
      ADD CONSTRAINT don_hang_delivery_contact_check
      CHECK (
        NOT giao_hang
        OR (
          nullif(btrim(so_dien_thoai_giao_hang), '') IS NOT NULL
          AND nullif(btrim(dia_chi_giao_hang), '') IS NOT NULL
        )
      );
  END IF;

  IF to_regprocedure('public.tao_don_hang_voi_chi_tiet(uuid,date,date,numeric,numeric,numeric,numeric,text,jsonb,text,numeric,text)') IS NOT NULL
     AND to_regprocedure('public.tao_don_hang_voi_chi_tiet_legacy_delivery(uuid,date,date,numeric,numeric,numeric,numeric,text,jsonb,text,numeric,text)') IS NULL THEN
    ALTER FUNCTION public.tao_don_hang_voi_chi_tiet(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb, text, numeric, text)
      RENAME TO tao_don_hang_voi_chi_tiet_legacy_delivery;
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.tao_don_hang_voi_chi_tiet_legacy_delivery(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb, text, numeric, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tao_don_hang_voi_chi_tiet(
  p_khach_hang_id uuid,
  p_ngay_dat date,
  p_han_giao date,
  p_tam_tinh numeric,
  p_giam_gia numeric,
  p_phi_van_chuyen numeric,
  p_tong_tien numeric,
  p_ghi_chu text,
  p_chi_tiet jsonb,
  p_loai_don_hang text,
  p_so_tien_thanh_toan numeric,
  p_phuong_thuc_thanh_toan text,
  p_giao_hang boolean,
  p_so_dien_thoai_giao_hang text,
  p_dia_chi_giao_hang text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result jsonb;
  v_order_id uuid;
  v_delivery_enabled boolean := coalesce(p_giao_hang, false);
BEGIN
  IF v_delivery_enabled AND p_loai_don_hang <> 'ban_nhanh' THEN
    RAISE EXCEPTION 'Thông tin giao hàng riêng chỉ áp dụng cho đơn bán nhanh.' USING ERRCODE = '22023';
  END IF;
  IF v_delivery_enabled AND (
    nullif(btrim(p_so_dien_thoai_giao_hang), '') IS NULL
    OR nullif(btrim(p_dia_chi_giao_hang), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Vui lòng nhập đủ số điện thoại và địa chỉ giao hàng.' USING ERRCODE = '23514';
  END IF;

  v_result := public.tao_don_hang_voi_chi_tiet_legacy_delivery(
    p_khach_hang_id,
    p_ngay_dat,
    p_han_giao,
    p_tam_tinh,
    p_giam_gia,
    p_phi_van_chuyen,
    p_tong_tien,
    p_ghi_chu,
    p_chi_tiet,
    p_loai_don_hang,
    p_so_tien_thanh_toan,
    p_phuong_thuc_thanh_toan
  );

  v_order_id := nullif(v_result ->> 'id', '')::uuid;
  UPDATE public.don_hang
     SET giao_hang = v_delivery_enabled,
         so_dien_thoai_giao_hang = CASE WHEN v_delivery_enabled THEN nullif(btrim(p_so_dien_thoai_giao_hang), '') ELSE NULL END,
         dia_chi_giao_hang = CASE WHEN v_delivery_enabled THEN nullif(btrim(p_dia_chi_giao_hang), '') ELSE NULL END,
         updated_at = now()
   WHERE id = v_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không thể lưu thông tin giao hàng của đơn.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.tao_don_hang_voi_chi_tiet(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb, text, numeric, text, boolean, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tao_don_hang_voi_chi_tiet(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb, text, numeric, text, boolean, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
