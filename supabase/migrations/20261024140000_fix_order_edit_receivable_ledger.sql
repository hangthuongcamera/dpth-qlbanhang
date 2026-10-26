-- Keep receivable ledger entries immutable when an order is edited.
-- The order trigger records exactly one signed delta for each total change.

DO $migration$
DECLARE
  v_edit_definition text;
  v_trigger_definition text;
  v_old_edit_block text := $old$
  UPDATE public.giao_dich_cong_no
     SET so_tien = v_total
   WHERE don_hang_id = p_don_hang_id
     AND phieu_thu_id IS NULL;
  GET DIAGNOSTICS v_updated_receivable = ROW_COUNT;
  IF v_total > 0 AND v_updated_receivable = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy khoản phải thu của đơn trong sổ công nợ; chưa lưu thay đổi.' USING ERRCODE = '23514';
  END IF;
$old$;
  v_new_edit_block text := $new$
  IF v_total > 0 AND NOT EXISTS (
    SELECT 1
      FROM public.giao_dich_cong_no
     WHERE don_hang_id = p_don_hang_id
       AND phieu_thu_id IS NULL
       AND loai_giao_dich = 'ban_hang'
  ) THEN
    RAISE EXCEPTION 'Không tìm thấy khoản bán hàng gốc của đơn trong sổ công nợ; chưa lưu thay đổi.' USING ERRCODE = '23514';
  END IF;
$new$;
  v_old_trigger_condition text := $old$  IF OLD.trang_thai = 'xac_nhan'
     AND NEW.trang_thai = 'xac_nhan'
     AND OLD.tong_tien <> NEW.tong_tien THEN$old$;
  v_new_trigger_condition text := $new$  IF OLD.trang_thai IN ('xac_nhan', 'dang_thuc_hien')
     AND NEW.trang_thai IN ('xac_nhan', 'dang_thuc_hien')
     AND OLD.tong_tien <> NEW.tong_tien THEN$new$;
BEGIN
  v_edit_definition := pg_get_functiondef(
    'public.cap_nhat_don_hang(uuid,date,text,text,numeric,numeric,jsonb)'::regprocedure
  );

  IF position(v_old_edit_block IN v_edit_definition) = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy đúng đoạn cập nhật sổ công nợ trong cap_nhat_don_hang; migration dừng để tránh sửa nhầm.';
  END IF;

  v_edit_definition := replace(v_edit_definition, v_old_edit_block, v_new_edit_block);
  v_edit_definition := replace(v_edit_definition, '  v_updated_receivable integer := 0;' || E'\n', '');
  EXECUTE v_edit_definition;

  v_trigger_definition := pg_get_functiondef(
    'public.xu_ly_cong_no_don_hang()'::regprocedure
  );

  IF position(v_old_trigger_condition IN v_trigger_definition) = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy đúng điều kiện tạo điều chỉnh trong xu_ly_cong_no_don_hang; migration dừng để tránh sửa nhầm.';
  END IF;

  v_trigger_definition := replace(v_trigger_definition, v_old_trigger_condition, v_new_trigger_condition);
  EXECUTE v_trigger_definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
