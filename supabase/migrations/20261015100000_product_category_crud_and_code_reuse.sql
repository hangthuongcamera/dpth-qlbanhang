-- Category codes are previewed in the UI and allocated atomically when saved.
-- The lowest available numeric THDM code is reused after a category is deleted.

CREATE OR REPLACE FUNCTION public.ma_loai_san_pham_tiep_theo()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH used_codes AS (
    SELECT substring(category.ma_loai FROM '^THDM-([0-9]+)$')::bigint AS code_number
    FROM public.loai_san_pham AS category
    WHERE category.ma_loai ~ '^THDM-[0-9]+$'
  ),
  candidate AS (
    SELECT numbers.code_number
    FROM generate_series(
      1::bigint,
      (SELECT count(*) + 1 FROM used_codes)
    ) AS numbers(code_number)
    LEFT JOIN used_codes ON used_codes.code_number = numbers.code_number
    WHERE used_codes.code_number IS NULL
    ORDER BY numbers.code_number
    LIMIT 1
  )
  SELECT 'THDM-' || lpad(candidate.code_number::text, 4, '0')
  FROM candidate;
$function$;

CREATE OR REPLACE FUNCTION public.tao_loai_san_pham(
  p_ma_loai text,
  p_ten_loai text
)
RETURNS TABLE (
  id uuid,
  ma_loai text,
  ten_loai text,
  trang_thai boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_ma_loai text := nullif(btrim(p_ma_loai), '');
  v_ten_loai text := btrim(coalesce(p_ten_loai, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF v_ten_loai = '' OR length(v_ten_loai) > 255 THEN
    RAISE EXCEPTION 'Tên danh mục phải có từ 1 đến 255 ký tự.' USING ERRCODE = '22023';
  END IF;

  -- Serialize inserts so simultaneous auto-generated codes cannot collide.
  PERFORM pg_advisory_xact_lock(20261015, 13601);
  IF v_ma_loai IS NULL THEN
    v_ma_loai := public.ma_loai_san_pham_tiep_theo();
  ELSIF length(v_ma_loai) > 100 THEN
    RAISE EXCEPTION 'Mã danh mục không được vượt quá 100 ký tự.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.loai_san_pham (ma_loai, ten_loai, trang_thai)
  VALUES (v_ma_loai, v_ten_loai, true)
  RETURNING loai_san_pham.id INTO v_id;

  RETURN QUERY
  SELECT category.id, category.ma_loai, category.ten_loai, category.trang_thai
  FROM public.loai_san_pham AS category
  WHERE category.id = v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cap_nhat_loai_san_pham(
  p_id uuid,
  p_ma_loai text,
  p_ten_loai text,
  p_trang_thai boolean
)
RETURNS TABLE (
  id uuid,
  ma_loai text,
  ten_loai text,
  trang_thai boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_ma_loai text := btrim(coalesce(p_ma_loai, ''));
  v_ten_loai text := btrim(coalesce(p_ten_loai, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required.' USING ERRCODE = '22023';
  END IF;
  IF v_ma_loai = '' OR length(v_ma_loai) > 100 THEN
    RAISE EXCEPTION 'Mã danh mục phải có từ 1 đến 100 ký tự.' USING ERRCODE = '22023';
  END IF;
  IF v_ten_loai = '' OR length(v_ten_loai) > 255 THEN
    RAISE EXCEPTION 'Tên danh mục phải có từ 1 đến 255 ký tự.' USING ERRCODE = '22023';
  END IF;
  IF p_trang_thai IS NULL THEN
    RAISE EXCEPTION 'Trạng thái danh mục không hợp lệ.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.loai_san_pham AS category
  SET ma_loai = v_ma_loai,
      ten_loai = v_ten_loai,
      trang_thai = p_trang_thai,
      updated_at = now()
  WHERE category.id = p_id
  RETURNING category.id, category.ma_loai, category.ten_loai, category.trang_thai;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.xoa_loai_san_pham(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.loai_san_pham WHERE id = p_id) THEN
    RAISE EXCEPTION 'Category not found.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.san_pham WHERE loai_san_pham_id = p_id) THEN
    RAISE EXCEPTION 'CATEGORY_IN_USE' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.loai_san_pham WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.ma_loai_san_pham_tiep_theo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tao_loai_san_pham(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cap_nhat_loai_san_pham(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.xoa_loai_san_pham(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ma_loai_san_pham_tiep_theo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tao_loai_san_pham(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cap_nhat_loai_san_pham(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xoa_loai_san_pham(uuid) TO authenticated;
