-- Preserve customer-linked business history when hard deletion is attempted.
CREATE OR REPLACE FUNCTION public.chan_xoa_khach_hang_co_lich_su()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.don_hang WHERE khach_hang_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.phieu_thu WHERE khach_hang_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.giao_dich_cong_no WHERE khach_hang_id = OLD.id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'KHACH_HANG_CO_LICH_SU';
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.chan_xoa_khach_hang_co_lich_su() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_chan_xoa_khach_hang_co_lich_su ON public.khach_hang;
CREATE TRIGGER trg_chan_xoa_khach_hang_co_lich_su
BEFORE DELETE ON public.khach_hang
FOR EACH ROW
EXECUTE FUNCTION public.chan_xoa_khach_hang_co_lich_su();
