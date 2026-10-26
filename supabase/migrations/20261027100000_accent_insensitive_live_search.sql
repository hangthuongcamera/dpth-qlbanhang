-- Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không phân biệt dấu.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.bo_dau_tieng_viet(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_extension_schema text;
  v_result text;
BEGIN
  SELECT n.nspname INTO v_extension_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'unaccent';

  IF v_extension_schema IS NULL THEN
    RAISE EXCEPTION 'Extension unaccent chưa được cài đặt';
  END IF;

  EXECUTE format('SELECT lower(%I.unaccent($1))', v_extension_schema)
    INTO v_result USING coalesce(p_text, '');
  RETURN v_result;
END;
$$;

CREATE OR REPLACE VIEW public.v_khach_hang_tim_kiem
WITH (security_invoker = true)
AS
SELECT kh.*,
       public.bo_dau_tieng_viet(concat_ws(' ', kh.ma_khach_hang, kh.ten_khach_hang, kh.so_dien_thoai)) AS tu_khoa_khong_dau
FROM public.khach_hang kh;

CREATE OR REPLACE VIEW public.v_phieu_thu_tim_kiem
WITH (security_invoker = true)
AS
SELECT pt.*,
       kh.ma_khach_hang,
       kh.ten_khach_hang,
       public.bo_dau_tieng_viet(concat_ws(' ',
         pt.ma_phieu_thu,
         kh.ma_khach_hang,
         kh.ten_khach_hang,
         pt.ma_tham_chieu,
         pt.nguoi_nop,
         don.ma_don_hang
       )) AS tu_khoa_khong_dau
FROM public.phieu_thu pt
LEFT JOIN public.khach_hang kh ON kh.id = pt.khach_hang_id
LEFT JOIN LATERAL (
  SELECT string_agg(dh.ma_don_hang, ' ') AS ma_don_hang
  FROM public.phieu_thu_phan_bo pb
  JOIN public.don_hang dh ON dh.id = pb.don_hang_id
  WHERE pb.phieu_thu_id = pt.id
) don ON true;

GRANT SELECT ON public.v_khach_hang_tim_kiem TO authenticated;
GRANT SELECT ON public.v_phieu_thu_tim_kiem TO authenticated;
GRANT EXECUTE ON FUNCTION public.bo_dau_tieng_viet(text) TO authenticated;
