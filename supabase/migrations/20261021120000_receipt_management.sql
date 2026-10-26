-- Receipt management: daily codes, allocation validation, and safe state transitions.
CREATE TABLE IF NOT EXISTS public.phieu_thu_ma_counter (
  ngay date PRIMARY KEY,
  so_cuoi integer NOT NULL CHECK (so_cuoi BETWEEN 1 AND 999)
);
REVOKE ALL ON TABLE public.phieu_thu_ma_counter FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS phieu_thu_ma_phieu_thu_key
  ON public.phieu_thu (ma_phieu_thu);

CREATE OR REPLACE FUNCTION public.tao_ma_phieu_thu(p_ngay date DEFAULT CURRENT_DATE)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_so integer;
BEGIN
  INSERT INTO public.phieu_thu_ma_counter (ngay, so_cuoi) VALUES (p_ngay, 1)
  ON CONFLICT (ngay) DO UPDATE SET so_cuoi = public.phieu_thu_ma_counter.so_cuoi + 1
  RETURNING so_cuoi INTO v_so;
  IF v_so > 999 THEN RAISE EXCEPTION 'Đã hết số phiếu thu trong ngày.' USING ERRCODE = '22023'; END IF;
  RETURN 'THPT-' || to_char(p_ngay, 'YYMMDD') || lpad(v_so::text, 3, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.phieu_thu_tu_dong_tao_ma()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_ngay date;
BEGIN
  v_ngay := (coalesce(NEW.ngay_thu, now()) AT TIME ZONE 'Asia/Bangkok')::date;
  NEW.ma_phieu_thu := public.tao_ma_phieu_thu(v_ngay);
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS phieu_thu_tu_dong_tao_ma_trg ON public.phieu_thu;
CREATE TRIGGER phieu_thu_tu_dong_tao_ma_trg BEFORE INSERT ON public.phieu_thu
FOR EACH ROW EXECUTE FUNCTION public.phieu_thu_tu_dong_tao_ma();

CREATE OR REPLACE FUNCTION public.luu_chi_tiet_phan_bo_phieu_thu(
  p_phieu_thu_id uuid, p_khach_hang_id uuid, p_tong_tien numeric, p_phan_bo jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_item jsonb; v_don_hang_id uuid; v_so_tien numeric(15,2);
  v_khach_hang_don uuid; v_trang_thai_don text; v_tong_phan_bo numeric(15,2) := 0;
BEGIN
  IF p_phan_bo IS NULL OR jsonb_typeof(p_phan_bo) <> 'array' THEN
    RAISE EXCEPTION 'Danh sách phân bổ không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_phan_bo)
  LOOP
    v_don_hang_id := nullif(v_item ->> 'don_hang_id', '')::uuid;
    v_so_tien := coalesce((v_item ->> 'so_tien')::numeric, 0);
    IF v_don_hang_id IS NULL OR v_so_tien <= 0 THEN
      RAISE EXCEPTION 'Mỗi khoản phân bổ cần có đơn hàng và số tiền lớn hơn 0.' USING ERRCODE = '22023';
    END IF;
    SELECT khach_hang_id, trang_thai INTO v_khach_hang_don, v_trang_thai_don
      FROM public.don_hang WHERE id = v_don_hang_id;
    IF NOT FOUND OR v_khach_hang_don <> p_khach_hang_id OR v_trang_thai_don = 'da_huy' THEN
      RAISE EXCEPTION 'Đơn được phân bổ không thuộc khách hàng hoặc đã bị hủy.' USING ERRCODE = '23514';
    END IF;
    v_tong_phan_bo := v_tong_phan_bo + v_so_tien;
    INSERT INTO public.phieu_thu_phan_bo (phieu_thu_id, don_hang_id, so_tien, ghi_chu)
    VALUES (p_phieu_thu_id, v_don_hang_id, v_so_tien, nullif(v_item ->> 'ghi_chu', ''));
  END LOOP;
  IF v_tong_phan_bo > p_tong_tien THEN
    RAISE EXCEPTION 'Tổng phân bổ không được vượt số tiền phiếu thu.' USING ERRCODE = '23514';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tao_phieu_thu_doc_lap(
  p_khach_hang_id uuid, p_ngay_thu date, p_tong_tien numeric,
  p_phuong_thuc_thanh_toan text, p_tai_khoan_nhan text, p_ma_tham_chieu text,
  p_nguoi_nop text, p_ghi_chu text, p_phan_bo jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_khach_hang_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.khach_hang WHERE id = p_khach_hang_id) THEN
    RAISE EXCEPTION 'Vui lòng chọn khách hàng hợp lệ.' USING ERRCODE = '23514';
  END IF;
  IF p_ngay_thu IS NULL OR p_tong_tien IS NULL OR p_tong_tien <= 0 THEN
    RAISE EXCEPTION 'Ngày thu và số tiền thu hợp lệ là bắt buộc.' USING ERRCODE = '22023';
  END IF;
  IF p_phuong_thuc_thanh_toan NOT IN ('tien_mat', 'chuyen_khoan', 'the', 'vi_dien_tu', 'khac') THEN
    RAISE EXCEPTION 'Phương thức thanh toán không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.phieu_thu (
    ma_phieu_thu, khach_hang_id, ngay_thu, tong_tien, phuong_thuc_thanh_toan,
    tai_khoan_nhan, ma_tham_chieu, nguoi_nop, ghi_chu, trang_thai
  ) VALUES (
    '', p_khach_hang_id, p_ngay_thu::timestamp AT TIME ZONE 'Asia/Bangkok',
    p_tong_tien, p_phuong_thuc_thanh_toan, nullif(btrim(p_tai_khoan_nhan), ''),
    nullif(btrim(p_ma_tham_chieu), ''), nullif(btrim(p_nguoi_nop), ''),
    nullif(btrim(p_ghi_chu), ''), 'nhap'
  ) RETURNING id INTO v_id;
  PERFORM public.luu_chi_tiet_phan_bo_phieu_thu(v_id, p_khach_hang_id, p_tong_tien, p_phan_bo);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cap_nhat_phieu_thu_nhap(
  p_phieu_thu_id uuid, p_khach_hang_id uuid, p_ngay_thu date, p_tong_tien numeric,
  p_phuong_thuc_thanh_toan text, p_tai_khoan_nhan text, p_ma_tham_chieu text,
  p_nguoi_nop text, p_ghi_chu text, p_phan_bo jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_status text;
BEGIN
  IF p_khach_hang_id IS NULL OR p_ngay_thu IS NULL OR p_tong_tien IS NULL OR p_tong_tien <= 0 THEN
    RAISE EXCEPTION 'Khách hàng, ngày thu và số tiền hợp lệ là bắt buộc.' USING ERRCODE = '22023';
  END IF;
  IF p_phuong_thuc_thanh_toan NOT IN ('tien_mat', 'chuyen_khoan', 'the', 'vi_dien_tu', 'khac') THEN
    RAISE EXCEPTION 'Phương thức thanh toán không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  SELECT trang_thai INTO v_status FROM public.phieu_thu WHERE id = p_phieu_thu_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'nhap' THEN
    RAISE EXCEPTION 'Chỉ có thể sửa phiếu thu nháp.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.phieu_thu SET
    khach_hang_id = p_khach_hang_id,
    ngay_thu = p_ngay_thu::timestamp AT TIME ZONE 'Asia/Bangkok',
    tong_tien = p_tong_tien,
    phuong_thuc_thanh_toan = p_phuong_thuc_thanh_toan,
    tai_khoan_nhan = nullif(btrim(p_tai_khoan_nhan), ''),
    ma_tham_chieu = nullif(btrim(p_ma_tham_chieu), ''),
    nguoi_nop = nullif(btrim(p_nguoi_nop), ''),
    ghi_chu = nullif(btrim(p_ghi_chu), ''),
    updated_at = now()
  WHERE id = p_phieu_thu_id;
  DELETE FROM public.phieu_thu_phan_bo WHERE phieu_thu_id = p_phieu_thu_id;
  PERFORM public.luu_chi_tiet_phan_bo_phieu_thu(p_phieu_thu_id, p_khach_hang_id, p_tong_tien, p_phan_bo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.xac_nhan_phieu_thu(p_phieu_thu_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_receipt public.phieu_thu%ROWTYPE; v_alloc record; v_paid numeric(15,2); v_remaining numeric(15,2);
BEGIN
  SELECT * INTO v_receipt FROM public.phieu_thu WHERE id = p_phieu_thu_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.trang_thai <> 'nhap' THEN
    RAISE EXCEPTION 'Chỉ có thể xác nhận phiếu thu nháp.' USING ERRCODE = '23514';
  END IF;
  FOR v_alloc IN
    SELECT d.id, d.khach_hang_id, d.trang_thai, d.tong_tien,
           sum(ptpb.so_tien)::numeric(15,2) AS phan_bo_hien_tai
      FROM public.phieu_thu_phan_bo ptpb
      JOIN public.don_hang d ON d.id = ptpb.don_hang_id
     WHERE ptpb.phieu_thu_id = p_phieu_thu_id
     GROUP BY d.id ORDER BY d.id
  LOOP
    PERFORM 1 FROM public.don_hang WHERE id = v_alloc.id FOR UPDATE;
    IF v_alloc.khach_hang_id <> v_receipt.khach_hang_id OR v_alloc.trang_thai = 'da_huy' THEN
      RAISE EXCEPTION 'Có khoản phân bổ không hợp lệ.' USING ERRCODE = '23514';
    END IF;
    SELECT coalesce(sum(ptpb.so_tien), 0)::numeric(15,2) INTO v_paid
      FROM public.phieu_thu_phan_bo ptpb
      JOIN public.phieu_thu pt ON pt.id = ptpb.phieu_thu_id
     WHERE ptpb.don_hang_id = v_alloc.id
       AND pt.trang_thai = 'da_xac_nhan' AND pt.id <> p_phieu_thu_id;
    v_remaining := greatest(v_alloc.tong_tien - v_paid, 0);
    IF v_alloc.phan_bo_hien_tai > v_remaining THEN
      RAISE EXCEPTION 'Khoản phân bổ vượt dư nợ còn lại của đơn %.', v_alloc.id USING ERRCODE = '23514';
    END IF;
  END LOOP;
  UPDATE public.phieu_thu SET trang_thai = 'da_xac_nhan', updated_at = now() WHERE id = p_phieu_thu_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.phan_bo_so_du_phieu_thu(p_phieu_thu_id uuid, p_phan_bo jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_receipt public.phieu_thu%ROWTYPE; v_item jsonb; v_order_id uuid;
  v_amount numeric(15,2); v_allocated numeric(15,2); v_paid numeric(15,2);
  v_order_total numeric(15,2); v_order_customer uuid; v_order_status text; v_requested numeric(15,2) := 0;
BEGIN
  SELECT * INTO v_receipt FROM public.phieu_thu WHERE id = p_phieu_thu_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.trang_thai <> 'da_xac_nhan' THEN
    RAISE EXCEPTION 'Chỉ có thể phân bổ số dư của phiếu đã xác nhận.' USING ERRCODE = '23514';
  END IF;
  SELECT coalesce(sum(so_tien), 0)::numeric(15,2) INTO v_allocated
    FROM public.phieu_thu_phan_bo WHERE phieu_thu_id = p_phieu_thu_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_phan_bo)
  LOOP
    v_order_id := nullif(v_item ->> 'don_hang_id', '')::uuid;
    v_amount := coalesce((v_item ->> 'so_tien')::numeric, 0);
    IF v_order_id IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Khoản phân bổ không hợp lệ.' USING ERRCODE = '22023'; END IF;
    SELECT khach_hang_id, trang_thai, tong_tien INTO v_order_customer, v_order_status, v_order_total
      FROM public.don_hang WHERE id = v_order_id FOR UPDATE;
    IF NOT FOUND OR v_order_customer <> v_receipt.khach_hang_id OR v_order_status = 'da_huy' THEN
      RAISE EXCEPTION 'Đơn hàng không hợp lệ cho phiếu thu này.' USING ERRCODE = '23514';
    END IF;
    SELECT coalesce(sum(ptpb.so_tien), 0)::numeric(15,2) INTO v_paid
      FROM public.phieu_thu_phan_bo ptpb JOIN public.phieu_thu pt ON pt.id = ptpb.phieu_thu_id
     WHERE ptpb.don_hang_id = v_order_id AND pt.trang_thai = 'da_xac_nhan';
    IF v_amount > greatest(v_order_total - v_paid, 0) THEN
      RAISE EXCEPTION 'Số phân bổ vượt dư nợ còn lại của đơn %.', v_order_id USING ERRCODE = '23514';
    END IF;
    v_requested := v_requested + v_amount;
  END LOOP;
  IF v_allocated + v_requested > v_receipt.tong_tien THEN
    RAISE EXCEPTION 'Tổng phân bổ vượt số tiền thu.' USING ERRCODE = '23514';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_phan_bo)
  LOOP
    INSERT INTO public.phieu_thu_phan_bo (phieu_thu_id, don_hang_id, so_tien, ghi_chu)
    VALUES (p_phieu_thu_id, (v_item ->> 'don_hang_id')::uuid, (v_item ->> 'so_tien')::numeric, nullif(v_item ->> 'ghi_chu', ''));
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.huy_phieu_thu(p_phieu_thu_id uuid, p_ly_do text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_receipt public.phieu_thu%ROWTYPE; v_net numeric(15,2);
BEGIN
  SELECT * INTO v_receipt FROM public.phieu_thu WHERE id = p_phieu_thu_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.trang_thai <> 'da_xac_nhan' THEN
    RAISE EXCEPTION 'Chỉ có thể hủy phiếu thu đã xác nhận.' USING ERRCODE = '23514';
  END IF;
  IF nullif(btrim(p_ly_do), '') IS NULL THEN RAISE EXCEPTION 'Vui lòng nhập lý do hủy phiếu.' USING ERRCODE = '22023'; END IF;
  UPDATE public.phieu_thu SET trang_thai = 'da_huy',
    ghi_chu = concat_ws(E'\n', ghi_chu, 'Lý do hủy: ' || btrim(p_ly_do)), updated_at = now()
   WHERE id = p_phieu_thu_id;
  SELECT coalesce(sum(so_tien), 0)::numeric(15,2) INTO v_net
    FROM public.giao_dich_cong_no WHERE phieu_thu_id = p_phieu_thu_id;
  IF v_net <> 0 THEN
    INSERT INTO public.giao_dich_cong_no (
      khach_hang_id, don_hang_id, phieu_thu_id, loai_giao_dich, so_tien, ngay_giao_dich, ghi_chu
    ) VALUES (v_receipt.khach_hang_id, NULL, p_phieu_thu_id, 'huy_phieu_thu', -v_net, now(),
      'Đảo giao dịch công nợ khi hủy phiếu ' || v_receipt.ma_phieu_thu);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.xoa_phieu_thu_nhap(p_phieu_thu_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_status text;
BEGIN
  SELECT trang_thai INTO v_status FROM public.phieu_thu WHERE id = p_phieu_thu_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'nhap' THEN RAISE EXCEPTION 'Chỉ có thể xóa phiếu thu nháp.' USING ERRCODE = '23514'; END IF;
  DELETE FROM public.phieu_thu_phan_bo WHERE phieu_thu_id = p_phieu_thu_id;
  DELETE FROM public.phieu_thu WHERE id = p_phieu_thu_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.tao_ma_phieu_thu(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.luu_chi_tiet_phan_bo_phieu_thu(uuid, uuid, numeric, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.luu_chi_tiet_phan_bo_phieu_thu(uuid, uuid, numeric, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.tao_phieu_thu_doc_lap(uuid, date, numeric, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tao_phieu_thu_doc_lap(uuid, date, numeric, text, text, text, text, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.cap_nhat_phieu_thu_nhap(uuid, uuid, date, numeric, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cap_nhat_phieu_thu_nhap(uuid, uuid, date, numeric, text, text, text, text, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.xac_nhan_phieu_thu(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xac_nhan_phieu_thu(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.phan_bo_so_du_phieu_thu(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phan_bo_so_du_phieu_thu(uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.huy_phieu_thu(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.huy_phieu_thu(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.xoa_phieu_thu_nhap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xoa_phieu_thu_nhap(uuid) TO authenticated;
