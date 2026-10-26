-- The order RPC inserts orders directly with their final active status.
-- Record the original receivable on INSERT as well as legacy status changes.

CREATE OR REPLACE FUNCTION public.xu_ly_cong_no_don_hang()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.trang_thai IN ('xac_nhan', 'dang_thuc_hien', 'hoan_thanh')
       AND NEW.tong_tien > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.giao_dich_cong_no gd
          WHERE gd.don_hang_id = NEW.id
            AND gd.phieu_thu_id IS NULL
            AND gd.loai_giao_dich = 'ban_hang'
       ) THEN
      INSERT INTO public.giao_dich_cong_no (
        khach_hang_id, don_hang_id, loai_giao_dich, so_tien, ngay_giao_dich, ghi_chu
      ) VALUES (
        NEW.khach_hang_id, NEW.id, 'ban_hang', NEW.tong_tien, NEW.created_at,
        'Phát sinh công nợ khi tạo đơn hàng'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.trang_thai <> 'xac_nhan'
     AND NEW.trang_thai = 'xac_nhan'
     AND NEW.tong_tien > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.giao_dich_cong_no gd
        WHERE gd.don_hang_id = NEW.id
          AND gd.phieu_thu_id IS NULL
          AND gd.loai_giao_dich = 'ban_hang'
     ) THEN
    INSERT INTO public.giao_dich_cong_no (
      khach_hang_id, don_hang_id, loai_giao_dich, so_tien, ngay_giao_dich, ghi_chu
    ) VALUES (
      NEW.khach_hang_id, NEW.id, 'ban_hang', NEW.tong_tien, now(),
      'Phát sinh công nợ khi xác nhận đơn hàng'
    );
  END IF;

  IF OLD.trang_thai = 'xac_nhan'
     AND NEW.trang_thai = 'xac_nhan'
     AND OLD.tong_tien <> NEW.tong_tien THEN
    INSERT INTO public.giao_dich_cong_no (
      khach_hang_id, don_hang_id, loai_giao_dich, so_tien, ngay_giao_dich, ghi_chu
    ) VALUES (
      NEW.khach_hang_id,
      NEW.id,
      CASE WHEN NEW.tong_tien > OLD.tong_tien THEN 'dieu_chinh_tang' ELSE 'dieu_chinh_giam' END,
      NEW.tong_tien - OLD.tong_tien,
      now(),
      CASE WHEN NEW.tong_tien > OLD.tong_tien
        THEN 'Điều chỉnh tăng do sửa đơn hàng'
        ELSE 'Điều chỉnh giảm do sửa đơn hàng'
      END
    );
  END IF;

  IF OLD.trang_thai <> 'da_huy' AND NEW.trang_thai = 'da_huy' THEN
    INSERT INTO public.giao_dich_cong_no (
      khach_hang_id, don_hang_id, loai_giao_dich, so_tien, ngay_giao_dich, ghi_chu
    ) VALUES (
      NEW.khach_hang_id, NEW.id, 'huy_ban_hang', -OLD.tong_tien, now(), 'Hủy đơn hàng'
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_xu_ly_cong_no_don_hang ON public.don_hang;
CREATE TRIGGER trg_xu_ly_cong_no_don_hang
AFTER INSERT OR UPDATE ON public.don_hang
FOR EACH ROW EXECUTE FUNCTION public.xu_ly_cong_no_don_hang();

-- Add the missing base receivable once for every active order that has none.
INSERT INTO public.giao_dich_cong_no (
  khach_hang_id, don_hang_id, loai_giao_dich, so_tien, ngay_giao_dich, ghi_chu
)
SELECT
  d.khach_hang_id, d.id, 'ban_hang', d.tong_tien, d.created_at,
  'Bổ sung khoản phải thu thiếu khi đối chiếu sổ công nợ'
FROM public.don_hang d
WHERE d.trang_thai IN ('xac_nhan', 'dang_thuc_hien', 'hoan_thanh')
  AND d.tong_tien > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.giao_dich_cong_no gd
     WHERE gd.don_hang_id = d.id
       AND gd.phieu_thu_id IS NULL
       AND gd.loai_giao_dich = 'ban_hang'
  );

NOTIFY pgrst, 'reload schema';
