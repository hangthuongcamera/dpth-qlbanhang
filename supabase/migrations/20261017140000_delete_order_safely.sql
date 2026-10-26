-- Migration to safely delete an order and grant required table permissions
-- Business rule (Scenario A):
-- An order can only be hard-deleted if it has NOT collected any payments (da_thu = 0).
-- If payments exist, deletion is blocked and user is prompted to cancel the order instead.

-- 1. Grant table-level permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.don_hang TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.don_hang_chi_tiet TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phieu_thu_phan_bo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.giao_dich_cong_no TO authenticated;

-- 2. Configure RLS policies for orders, order lines, and debt ledger
ALTER TABLE public.don_hang ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_manage_don_hang ON public.don_hang;
CREATE POLICY authenticated_manage_don_hang ON public.don_hang
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.don_hang_chi_tiet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_manage_don_hang_chi_tiet ON public.don_hang_chi_tiet;
CREATE POLICY authenticated_manage_don_hang_chi_tiet ON public.don_hang_chi_tiet
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.phieu_thu_phan_bo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_manage_phieu_thu_phan_bo ON public.phieu_thu_phan_bo;
CREATE POLICY authenticated_manage_phieu_thu_phan_bo ON public.phieu_thu_phan_bo
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.giao_dich_cong_no ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_manage_giao_dich_cong_no ON public.giao_dich_cong_no;
CREATE POLICY authenticated_manage_giao_dich_cong_no ON public.giao_dich_cong_no
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Stored Procedure with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.xoa_don_hang(p_don_hang_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ma_don_hang text;
  v_da_thu numeric(15,2) := 0;
  v_receipt_ids uuid[];
BEGIN
  -- 1. Check if order exists
  SELECT ma_don_hang INTO v_ma_don_hang
    FROM public.don_hang
   WHERE id = p_don_hang_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng cần xóa.' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Calculate confirmed payments allocated to this order
  SELECT coalesce(sum(ptpb.so_tien), 0) INTO v_da_thu
    FROM public.phieu_thu_phan_bo ptpb
    JOIN public.phieu_thu pt ON pt.id = ptpb.phieu_thu_id
   WHERE ptpb.don_hang_id = p_don_hang_id
     AND pt.trang_thai = 'da_xac_nhan';

  -- 3. If payments have been collected, block deletion
  IF v_da_thu > 0 THEN
    RAISE EXCEPTION 'Đơn hàng % đã phát sinh thu tiền (% ₫). Để bảo toàn sổ quỹ kế toán, vui lòng chuyển trạng thái đơn sang "Đã hủy" thay vì xóa.',
      v_ma_don_hang,
      to_char(v_da_thu, 'FM999,999,999,999')
      USING ERRCODE = '23514';
  END IF;

  -- 4. Clean up draft / zero-amount receipt allocations if any
  SELECT coalesce(array_agg(phieu_thu_id), ARRAY[]::uuid[]) INTO v_receipt_ids
    FROM public.phieu_thu_phan_bo
   WHERE don_hang_id = p_don_hang_id;

  DELETE FROM public.phieu_thu_phan_bo WHERE don_hang_id = p_don_hang_id;

  -- Remove empty draft receipts that only had allocations to this order
  IF array_length(v_receipt_ids, 1) > 0 THEN
    DELETE FROM public.phieu_thu pt
     WHERE pt.id = ANY(v_receipt_ids)
       AND pt.trang_thai = 'nhap'
       AND NOT EXISTS (
         SELECT 1 FROM public.phieu_thu_phan_bo ptpb WHERE ptpb.phieu_thu_id = pt.id
       );
  END IF;

  -- 5. Delete debt transactions in giao_dich_cong_no associated with this order
  DELETE FROM public.giao_dich_cong_no WHERE don_hang_id = p_don_hang_id;

  -- 6. Delete order line items
  DELETE FROM public.don_hang_chi_tiet WHERE don_hang_id = p_don_hang_id;

  -- 7. Delete order
  DELETE FROM public.don_hang WHERE id = p_don_hang_id;

  RETURN v_ma_don_hang;
END;
$function$;

REVOKE ALL ON FUNCTION public.xoa_don_hang(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xoa_don_hang(uuid) TO authenticated;
