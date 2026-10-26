ALTER TABLE public.don_hang
  ADD COLUMN IF NOT EXISTS dia_chi_giao_hang text;

CREATE OR REPLACE FUNCTION public.cap_nhat_don_hang(
  p_don_hang_id uuid,
  p_han_giao date,
  p_dia_chi_giao_hang text,
  p_ghi_chu text,
  p_giam_gia numeric,
  p_phi_van_chuyen numeric,
  p_chi_tiet jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_order public.don_hang%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity numeric;
  v_price numeric;
  v_base_price numeric;
  v_manual boolean;
  v_subtotal numeric(15,2) := 0;
  v_total numeric(15,2);
  v_paid numeric(15,2) := 0;
  v_line_count integer := 0;
  v_updated_receivable integer := 0;
BEGIN
  IF p_don_hang_id IS NULL THEN
    RAISE EXCEPTION 'Đơn hàng không hợp lệ.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
    FROM public.don_hang
   WHERE id = p_don_hang_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng.' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.trang_thai NOT IN ('xac_nhan', 'dang_thuc_hien') THEN
    RAISE EXCEPTION 'Chỉ được chỉnh sửa đơn đang ở trạng thái Đã xác nhận hoặc Đang thực hiện.' USING ERRCODE = '23514';
  END IF;
  IF v_order.loai_don_hang = 'dat_hang' AND (p_han_giao IS NULL OR p_han_giao < v_order.ngay_dat) THEN
    RAISE EXCEPTION 'Hạn giao hàng không được trước ngày đặt hàng.' USING ERRCODE = '23514';
  END IF;
  IF p_chi_tiet IS NULL OR jsonb_typeof(p_chi_tiet) <> 'array' OR jsonb_array_length(p_chi_tiet) = 0 THEN
    RAISE EXCEPTION 'Đơn hàng cần có ít nhất một sản phẩm.' USING ERRCODE = '22023';
  END IF;
  IF p_giam_gia IS NULL OR p_phi_van_chuyen IS NULL OR p_giam_gia < 0 OR p_phi_van_chuyen < 0 THEN
    RAISE EXCEPTION 'Giảm giá và phí vận chuyển không được âm.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_chi_tiet) AS item(value)
  LOOP
    v_line_count := v_line_count + 1;
    v_product_id := nullif(v_item ->> 'san_pham_id', '')::uuid;
    v_variant_id := nullif(v_item ->> 'bien_the_san_pham_id', '')::uuid;
    v_quantity := nullif(v_item ->> 'so_luong', '')::numeric;
    v_price := nullif(v_item ->> 'don_gia', '')::numeric;
    v_base_price := nullif(v_item ->> 'gia_goc', '')::numeric;
    v_manual := coalesce((v_item ->> 'gia_da_chinh_sua_thu_cong')::boolean, false);

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0
       OR v_price IS NULL OR v_price < 0 OR v_base_price IS NULL OR v_base_price < 0 THEN
      RAISE EXCEPTION 'Sản phẩm, số lượng hoặc đơn giá không hợp lệ.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.san_pham WHERE id = v_product_id) THEN
      RAISE EXCEPTION 'Một sản phẩm trong đơn không còn tồn tại.' USING ERRCODE = '23503';
    END IF;
    IF v_variant_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.bien_the_san_pham WHERE id = v_variant_id AND san_pham_id = v_product_id) THEN
        RAISE EXCEPTION 'Biến thể không thuộc sản phẩm đã chọn.' USING ERRCODE = '23503';
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.bien_the_san_pham WHERE san_pham_id = v_product_id AND trang_thai = true) THEN
      RAISE EXCEPTION 'Vui lòng chọn biến thể của sản phẩm.' USING ERRCODE = '23514';
    END IF;

    v_subtotal := v_subtotal + v_quantity * v_price;
  END LOOP;

  IF p_giam_gia > v_subtotal THEN
    RAISE EXCEPTION 'Giảm giá không được lớn hơn tạm tính.' USING ERRCODE = '22023';
  END IF;

  v_total := greatest(0, v_subtotal - p_giam_gia + p_phi_van_chuyen);

  SELECT coalesce(sum(ptpb.so_tien), 0)::numeric(15,2) INTO v_paid
    FROM public.phieu_thu_phan_bo AS ptpb
    JOIN public.phieu_thu AS pt ON pt.id = ptpb.phieu_thu_id
   WHERE ptpb.don_hang_id = p_don_hang_id
     AND pt.trang_thai = 'da_xac_nhan';

  IF v_total < v_paid THEN
    RAISE EXCEPTION 'Tổng tiền mới (% ₫) không được nhỏ hơn số tiền khách đã thanh toán (% ₫).',
      replace(to_char(v_total, 'FM999,999,999,999,990'), ',', '.'),
      replace(to_char(v_paid, 'FM999,999,999,999,990'), ',', '.')
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.don_hang
     SET han_giao = CASE WHEN loai_don_hang = 'dat_hang' THEN p_han_giao ELSE han_giao END,
         dia_chi_giao_hang = nullif(btrim(p_dia_chi_giao_hang), ''),
         ghi_chu = nullif(btrim(p_ghi_chu), ''),
         tam_tinh = v_subtotal,
         giam_gia = p_giam_gia,
         phi_van_chuyen = p_phi_van_chuyen,
         tong_tien = v_total,
         updated_at = now()
   WHERE id = p_don_hang_id;

  DELETE FROM public.don_hang_chi_tiet WHERE don_hang_id = p_don_hang_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_chi_tiet) AS item(value)
  LOOP
    INSERT INTO public.don_hang_chi_tiet (
      don_hang_id, san_pham_id, bien_the_san_pham_id, so_luong, don_gia, gia_goc,
      gia_da_chinh_sua_thu_cong, giam_gia, thanh_tien, ghi_chu
    ) VALUES (
      p_don_hang_id,
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

  UPDATE public.giao_dich_cong_no
     SET so_tien = v_total
   WHERE don_hang_id = p_don_hang_id
     AND phieu_thu_id IS NULL;
  GET DIAGNOSTICS v_updated_receivable = ROW_COUNT;
  IF v_total > 0 AND v_updated_receivable = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy khoản phải thu của đơn trong sổ công nợ; chưa lưu thay đổi.' USING ERRCODE = '23514';
  END IF;

  RETURN jsonb_build_object('id', p_don_hang_id, 'tam_tinh', v_subtotal, 'tong_tien', v_total, 'da_thu', v_paid);
END;
$function$;

REVOKE ALL ON FUNCTION public.cap_nhat_don_hang(uuid, date, text, text, numeric, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cap_nhat_don_hang(uuid, date, text, text, numeric, numeric, jsonb) TO authenticated;
