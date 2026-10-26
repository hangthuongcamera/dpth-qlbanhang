-- Align the order-creation receipt RPC with the current receipt status constraint.
DO $migration$
DECLARE
  v_function regprocedure := to_regprocedure(
    'public.tao_don_hang_voi_chi_tiet_legacy_delivery(uuid,date,date,numeric,numeric,numeric,numeric,text,jsonb,text,numeric,text)'
  );
  v_definition text;
  v_old_status_clause constant text := 'p_phuong_thuc_thanh_toan, ''moi'',';
  v_new_status_clause constant text := 'p_phuong_thuc_thanh_toan, ''nhap'',';
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION
      'Không tìm thấy RPC tao_don_hang_voi_chi_tiet_legacy_delivery. Hãy xác nhận migration 20261019120000_fast_sale_delivery_contact.sql đã được áp dụng.';
  END IF;

  v_definition := pg_get_functiondef(v_function);

  IF position(v_old_status_clause IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_old_status_clause, v_new_status_clause);
    EXECUTE v_definition;
  ELSIF position(v_new_status_clause IN v_definition) > 0 THEN
    RAISE NOTICE 'RPC đã tạo phiếu ở trạng thái nháp; không cần thay đổi.';
  ELSE
    RAISE EXCEPTION
      'Không nhận diện được trạng thái khởi tạo phiếu thu trong RPC; dừng để tránh sửa nhầm hàm.';
  END IF;
END;
$migration$;
