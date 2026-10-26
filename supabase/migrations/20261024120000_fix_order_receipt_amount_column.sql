-- Fix order creation receipts to write to the current phieu_thu.tong_tien column.
-- The original function was renamed by 20261019120000_fast_sale_delivery_contact.sql;
-- the fast-sale wrapper calls this legacy function.
DO $migration$
DECLARE
  v_function regprocedure := to_regprocedure(
    'public.tao_don_hang_voi_chi_tiet_legacy_delivery(uuid,date,date,numeric,numeric,numeric,numeric,text,jsonb,text,numeric,text)'
  );
  v_definition text;
  v_old_column_list constant text := 'ma_phieu_thu, khach_hang_id, ngay_thu, so_tien,';
  v_new_column_list constant text := 'ma_phieu_thu, khach_hang_id, ngay_thu, tong_tien,';
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION
      'Không tìm thấy RPC tao_don_hang_voi_chi_tiet_legacy_delivery. Hãy xác nhận migration 20261019120000_fast_sale_delivery_contact.sql đã được áp dụng.';
  END IF;

  v_definition := pg_get_functiondef(v_function);

  IF position(v_old_column_list IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_old_column_list, v_new_column_list);
    EXECUTE v_definition;
  ELSIF position(v_new_column_list IN v_definition) > 0 THEN
    RAISE NOTICE 'RPC đã dùng cột tong_tien; không cần thay đổi.';
  ELSE
    RAISE EXCEPTION
      'Không nhận diện được câu lệnh INSERT phiếu thu trong RPC; dừng để tránh sửa nhầm hàm.';
  END IF;
END;
$migration$;
