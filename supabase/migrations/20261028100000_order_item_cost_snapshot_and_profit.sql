-- Migration: Snapshot giá vốn (gia_von) vào chi tiết đơn hàng phục vụ Báo cáo Lợi nhuận
-- Ngày: 28/10/2026
-- Mô tả:
-- 1. Bổ sung cột gia_von vào bảng don_hang_chi_tiet (mặc định 0).
-- 2. Trigger tự động lấy gia_nhap từ biến thể hoặc sản phẩm khi lưu dòng đơn hàng nếu chưa có giá vốn.
-- 3. Backfill tự động cập nhật gia_von cho toàn bộ đơn hàng trong quá khứ.

-- 1. Thêm cột gia_von
ALTER TABLE public.don_hang_chi_tiet
  ADD COLUMN IF NOT EXISTS gia_von numeric NOT NULL DEFAULT 0;

-- 2. Trigger tự động gán giá vốn snapshot từ gia_nhap hiện hành của sản phẩm/biến thể
CREATE OR REPLACE FUNCTION public.tu_dong_gan_gia_von_chi_tiet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.gia_von IS NULL OR NEW.gia_von = 0 THEN
    -- Ưu tiên lấy giá nhập từ biến thể sản phẩm nếu là dòng có biến thể
    IF NEW.bien_the_san_pham_id IS NOT NULL THEN
      SELECT coalesce(gia_nhap, 0) INTO NEW.gia_von
      FROM public.bien_the_san_pham
      WHERE id = NEW.bien_the_san_pham_id;
    END IF;

    -- Nếu không có biến thể hoặc biến thể chưa có giá nhập, lấy từ bảng sản phẩm gốc
    IF NEW.gia_von IS NULL OR NEW.gia_von = 0 THEN
      SELECT coalesce(gia_nhap, 0) INTO NEW.gia_von
      FROM public.san_pham
      WHERE id = NEW.san_pham_id;
    END IF;

    NEW.gia_von := coalesce(NEW.gia_von, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tu_dong_gan_gia_von_chi_tiet ON public.don_hang_chi_tiet;
CREATE TRIGGER trg_tu_dong_gan_gia_von_chi_tiet
  BEFORE INSERT OR UPDATE ON public.don_hang_chi_tiet
  FOR EACH ROW
  EXECUTE FUNCTION public.tu_dong_gan_gia_von_chi_tiet();

-- 3. Cập nhật bù (backfill) giá vốn cho các đơn hàng đã tạo trước đó
UPDATE public.don_hang_chi_tiet dhct
SET gia_von = coalesce(
  (SELECT gia_nhap FROM public.bien_the_san_pham bt WHERE bt.id = dhct.bien_the_san_pham_id),
  (SELECT gia_nhap FROM public.san_pham sp WHERE sp.id = dhct.san_pham_id),
  0
)
WHERE dhct.gia_von = 0 OR dhct.gia_von IS NULL;

-- 4. Thông báo nạp lại schema PostgREST
NOTIFY pgrst, 'reload schema';
