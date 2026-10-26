-- Cho phép đơn đặt hàng không cần đặt cọc (tiền cọc = 0)
-- Bổ sung ràng buộc hạn giao hàng cho đơn đặt hàng
-- Sửa lỗi phân quyền: SECURITY DEFINER và GRANT EXECUTE tinh_tong_don_hang

-- 1. Cấp quyền thực thi tất cả hàm public và hàm tính tổng đơn hàng cho role authenticated
DO $$
BEGIN
  EXECUTE (
    SELECT coalesce(string_agg(format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', oid::regprocedure), ' '), '')
    FROM pg_proc
    WHERE proname = 'tinh_tong_don_hang'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 2. Cập nhật hàm tạo đơn hàng: SECURITY DEFINER, cho phép cọc = 0, kiểm tra hạn giao
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
  p_phuong_thuc_thanh_toan text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_don_hang_id uuid;
  v_phieu_thu_id uuid;
  v_item jsonb;
  v_ma_don_hang text;
  v_ma_phieu_thu text;
  v_la_khach_le boolean;
  v_tien_thu numeric(15,2);
  v_ngay_dat date;
BEGIN
  IF p_khach_hang_id IS NULL OR p_chi_tiet IS NULL OR jsonb_typeof(p_chi_tiet) <> 'array'
     OR jsonb_array_length(p_chi_tiet) = 0 THEN
    RAISE EXCEPTION 'Customer and at least one order item are required.' USING ERRCODE = '22023';
  END IF;
  IF p_loai_don_hang NOT IN ('dat_hang', 'ban_nhanh') THEN
    RAISE EXCEPTION 'Order type is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_phuong_thuc_thanh_toan NOT IN ('tien_mat', 'chuyen_khoan', 'the', 'vi_dien_tu', 'khac') THEN
    RAISE EXCEPTION 'Payment method is invalid.' USING ERRCODE = '22023';
  END IF;
  IF p_tam_tinh < 0 OR p_giam_gia < 0 OR p_phi_van_chuyen < 0 OR p_tong_tien < 0
     OR p_giam_gia > p_tam_tinh
     OR p_tong_tien <> p_tam_tinh - p_giam_gia + p_phi_van_chuyen THEN
    RAISE EXCEPTION 'Order amounts must be non-negative.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_so_tien_thanh_toan, 0) < 0 THEN
    RAISE EXCEPTION 'Payment amount cannot be negative.' USING ERRCODE = '22023';
  END IF;

  v_ngay_dat := coalesce(p_ngay_dat, CURRENT_DATE);

  -- Ràng buộc đơn đặt hàng: bắt buộc chọn hạn giao và hạn giao không được trước ngày đặt
  IF p_loai_don_hang = 'dat_hang' THEN
    IF p_han_giao IS NULL THEN
      RAISE EXCEPTION 'Vui lòng chọn hạn giao hàng cho đơn đặt hàng.' USING ERRCODE = '22023';
    END IF;
    IF p_han_giao < v_ngay_dat THEN
      RAISE EXCEPTION 'Hạn giao hàng không được trước ngày đặt hàng.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT kh.la_khach_le INTO v_la_khach_le
    FROM public.khach_hang AS kh
   WHERE kh.id = p_khach_hang_id AND kh.trang_thai = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or inactive.' USING ERRCODE = 'P0002';
  END IF;

  IF p_loai_don_hang = 'ban_nhanh' AND v_la_khach_le AND coalesce(p_so_tien_thanh_toan, 0) < p_tong_tien THEN
    RAISE EXCEPTION 'Khách lẻ cần thanh toán đủ tổng đơn.' USING ERRCODE = '23514';
  END IF;
  IF p_loai_don_hang = 'dat_hang' AND v_la_khach_le THEN
    RAISE EXCEPTION 'Đơn đặt hàng cần chọn hồ sơ khách hàng.' USING ERRCODE = '23514';
  END IF;
  -- Cho phép khách không cọc (p_so_tien_thanh_toan = 0)
  IF p_loai_don_hang = 'dat_hang' AND p_so_tien_thanh_toan > p_tong_tien THEN
    RAISE EXCEPTION 'Tiền cọc không được lớn hơn tổng tiền đơn.' USING ERRCODE = '22023';
  END IF;
  IF p_loai_don_hang = 'ban_nhanh'
     AND p_phuong_thuc_thanh_toan <> 'tien_mat'
     AND p_so_tien_thanh_toan > p_tong_tien THEN
    RAISE EXCEPTION 'Số tiền thanh toán không được lớn hơn tổng đơn khi không thanh toán tiền mặt.' USING ERRCODE = '23514';
  END IF;

  v_ma_don_hang := 'DH-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.don_hang (
    ma_don_hang, khach_hang_id, ngay_dat, han_giao, trang_thai,
    tam_tinh, giam_gia, phi_van_chuyen, tong_tien, ghi_chu, loai_don_hang
  ) VALUES (
    v_ma_don_hang, p_khach_hang_id, v_ngay_dat, p_han_giao, 'moi',
    p_tam_tinh, p_giam_gia, p_phi_van_chuyen, p_tong_tien, nullif(p_ghi_chu, ''), p_loai_don_hang
  ) RETURNING id INTO v_don_hang_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_chi_tiet)
  LOOP
    IF coalesce((v_item ->> 'so_luong')::numeric, 0) <= 0
       OR coalesce((v_item ->> 'don_gia')::numeric, -1) < 0
       OR coalesce((v_item ->> 'gia_goc')::numeric, -1) < 0 THEN
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

  -- Kích hoạt trigger ghi nhận công nợ
  UPDATE public.don_hang SET trang_thai = 'xac_nhan', updated_at = now() WHERE id = v_don_hang_id;

  v_tien_thu := CASE
    WHEN p_loai_don_hang = 'ban_nhanh' THEN least(coalesce(p_so_tien_thanh_toan, 0), p_tong_tien)
    ELSE coalesce(p_so_tien_thanh_toan, 0)
  END;

  IF v_tien_thu > 0 THEN
    v_ma_phieu_thu := 'PT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    INSERT INTO public.phieu_thu (
      ma_phieu_thu, khach_hang_id, ngay_thu, tong_tien,
      phuong_thuc_thanh_toan, trang_thai, ghi_chu
    ) VALUES (
      v_ma_phieu_thu, p_khach_hang_id, now(), v_tien_thu,
      p_phuong_thuc_thanh_toan, 'nhap',
      CASE WHEN p_loai_don_hang = 'dat_hang' THEN 'Tiền cọc đơn hàng ' || v_ma_don_hang ELSE 'Thanh toán bán nhanh ' || v_ma_don_hang END
    ) RETURNING id INTO v_phieu_thu_id;

    INSERT INTO public.phieu_thu_phan_bo (phieu_thu_id, don_hang_id, so_tien, ghi_chu)
    VALUES (v_phieu_thu_id, v_don_hang_id, v_tien_thu, 'Thanh toán khi tạo đơn');

    -- Kích hoạt trigger giảm trừ công nợ
    UPDATE public.phieu_thu SET trang_thai = 'da_xac_nhan', updated_at = now() WHERE id = v_phieu_thu_id;
  END IF;

  IF p_loai_don_hang = 'ban_nhanh' OR v_tien_thu >= p_tong_tien THEN
    UPDATE public.don_hang SET trang_thai = 'hoan_thanh', updated_at = now() WHERE id = v_don_hang_id;
  END IF;

  RETURN v_don_hang_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.tao_don_hang_voi_chi_tiet(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb, text, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tao_don_hang_voi_chi_tiet(uuid, date, date, numeric, numeric, numeric, numeric, text, jsonb, text, numeric, text)
  TO authenticated;

-- 3. Cập nhật hàm thu tiền: SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.thu_tien_don_hang(
  p_don_hang_id uuid,
  p_so_tien numeric,
  p_phuong_thuc_thanh_toan text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_khach_hang_id uuid;
  v_tong_tien numeric(15,2);
  v_loai_don_hang text;
  v_da_thu numeric(15,2);
  v_con_lai numeric(15,2);
  v_tien_thu numeric(15,2);
  v_phieu_thu_id uuid;
  v_ma_phieu_thu text;
BEGIN
  IF p_so_tien IS NULL OR p_so_tien <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.' USING ERRCODE = '22023';
  END IF;
  IF p_phuong_thuc_thanh_toan NOT IN ('tien_mat', 'chuyen_khoan', 'the', 'vi_dien_tu', 'khac') THEN
    RAISE EXCEPTION 'Payment method is invalid.' USING ERRCODE = '22023';
  END IF;

  SELECT khach_hang_id, tong_tien, loai_don_hang INTO v_khach_hang_id, v_tong_tien, v_loai_don_hang
    FROM public.don_hang WHERE id = p_don_hang_id AND trang_thai <> 'da_huy' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or canceled.' USING ERRCODE = 'P0002';
  END IF;
  SELECT coalesce(sum(ptpb.so_tien), 0) INTO v_da_thu
    FROM public.phieu_thu_phan_bo AS ptpb
    JOIN public.phieu_thu AS pt ON pt.id = ptpb.phieu_thu_id
   WHERE ptpb.don_hang_id = p_don_hang_id AND pt.trang_thai = 'da_xac_nhan';
  v_con_lai := greatest(v_tong_tien - v_da_thu, 0);
  IF p_so_tien > v_con_lai THEN
    RAISE EXCEPTION 'Payment exceeds the remaining order balance.' USING ERRCODE = '22023';
  END IF;
  IF v_loai_don_hang = 'dat_hang' AND p_so_tien <> v_con_lai THEN
    RAISE EXCEPTION 'Đơn đặt hàng thu phần còn lại trong một lần.' USING ERRCODE = '23514';
  END IF;
  v_tien_thu := p_so_tien;

  v_ma_phieu_thu := 'PT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.phieu_thu (
    ma_phieu_thu, khach_hang_id, ngay_thu, tong_tien,
    phuong_thuc_thanh_toan, trang_thai, ghi_chu
  ) VALUES (
    v_ma_phieu_thu, v_khach_hang_id, now(), v_tien_thu,
    p_phuong_thuc_thanh_toan, 'nhap', 'Thu tiền đơn hàng'
  ) RETURNING id INTO v_phieu_thu_id;

  INSERT INTO public.phieu_thu_phan_bo (phieu_thu_id, don_hang_id, so_tien, ghi_chu)
  VALUES (v_phieu_thu_id, p_don_hang_id, v_tien_thu, 'Thu tiền còn lại của đơn hàng');
  UPDATE public.phieu_thu SET trang_thai = 'da_xac_nhan', updated_at = now() WHERE id = v_phieu_thu_id;

  IF v_tien_thu = v_con_lai THEN
    UPDATE public.don_hang SET trang_thai = 'hoan_thanh', updated_at = now() WHERE id = p_don_hang_id;
  END IF;
  RETURN v_con_lai - v_tien_thu;
END;
$function$;

REVOKE ALL ON FUNCTION public.thu_tien_don_hang(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.thu_tien_don_hang(uuid, numeric, text) TO authenticated;
