-- Avoid logging transient order totals while cap_nhat_don_hang replaces line items.
-- The RPC already computes and writes the final order totals; the debt trigger
-- should therefore observe only that final total change.

DO $migration$
DECLARE
  v_rpc_definition text;
  v_totals_trigger_definition text;
  v_rpc_declaration_anchor text := $anchor$  v_line_count integer := 0;
$anchor$;
  v_rpc_begin_anchor text := $anchor$BEGIN
  IF p_don_hang_id IS NULL THEN$anchor$;
  v_rpc_return_anchor text := $anchor$  RETURN jsonb_build_object('id', p_don_hang_id, 'tam_tinh', v_subtotal, 'tong_tien', v_total, 'da_thu', v_paid);$anchor$;
  v_trigger_begin_anchor text := $anchor$AS $function$
begin

    if tg_op = 'DELETE' then$anchor$;
BEGIN
  v_rpc_definition := pg_get_functiondef(
    'public.cap_nhat_don_hang(uuid,date,text,text,numeric,numeric,jsonb)'::regprocedure
  );
  v_totals_trigger_definition := pg_get_functiondef(
    'public.cap_nhat_tong_don_hang()'::regprocedure
  );

  IF position('thanhhang.skip_order_detail_recalc' IN v_rpc_definition) > 0
     OR position('thanhhang.skip_order_detail_recalc' IN v_totals_trigger_definition) > 0 THEN
    RAISE EXCEPTION 'Cờ bỏ qua tính lại tổng đã có; migration dừng để tránh áp dụng hai lần.';
  END IF;

  IF position(v_rpc_declaration_anchor IN v_rpc_definition) = 0
     OR position(v_rpc_begin_anchor IN v_rpc_definition) = 0
     OR position(v_rpc_return_anchor IN v_rpc_definition) = 0 THEN
    RAISE EXCEPTION 'Định nghĩa cap_nhat_don_hang không khớp phiên bản dự kiến; migration dừng an toàn.';
  END IF;

  IF position('SET so_tien = v_total' IN v_rpc_definition) > 0
     OR position('loai_giao_dich = ''ban_hang''' IN v_rpc_definition) = 0 THEN
    RAISE EXCEPTION 'RPC chưa có bản sửa sổ công nợ nền tảng; migration dừng an toàn.';
  END IF;

  IF position(v_trigger_begin_anchor IN v_totals_trigger_definition) = 0 THEN
    RAISE EXCEPTION 'Định nghĩa cap_nhat_tong_don_hang không khớp nội dung đã đối chiếu; migration dừng an toàn.';
  END IF;

  v_rpc_definition := replace(
    v_rpc_definition,
    v_rpc_declaration_anchor,
    v_rpc_declaration_anchor || E'\n  v_previous_skip_order_detail_recalc text;'
  );
  v_rpc_definition := replace(
    v_rpc_definition,
    v_rpc_begin_anchor,
    $replacement$BEGIN
  v_previous_skip_order_detail_recalc := current_setting('thanhhang.skip_order_detail_recalc', true);
  PERFORM set_config('thanhhang.skip_order_detail_recalc', 'on', true);

  IF p_don_hang_id IS NULL THEN$replacement$
  );
  v_rpc_definition := replace(
    v_rpc_definition,
    v_rpc_return_anchor,
    $replacement$  PERFORM set_config(
    'thanhhang.skip_order_detail_recalc',
    coalesce(v_previous_skip_order_detail_recalc, ''),
    true
  );

  RETURN jsonb_build_object('id', p_don_hang_id, 'tam_tinh', v_subtotal, 'tong_tien', v_total, 'da_thu', v_paid);$replacement$
  );
  EXECUTE v_rpc_definition;

  v_totals_trigger_definition := replace(
    v_totals_trigger_definition,
    v_trigger_begin_anchor,
    $replacement$AS $function$
begin
    if current_setting('thanhhang.skip_order_detail_recalc', true) = 'on' then
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
    end if;

    if tg_op = 'DELETE' then$replacement$
  );
  EXECUTE v_totals_trigger_definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
