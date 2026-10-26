-- Generate product codes in PostgreSQL so concurrent inserts cannot reuse a code.
CREATE SEQUENCE IF NOT EXISTS public.ma_san_pham_seq START WITH 1 INCREMENT BY 1;

DO $migration$
DECLARE
  next_code_number bigint;
BEGIN
  SELECT coalesce(max(substring(ma_san_pham FROM '^THSP-([0-9]+)$')::bigint), 0) + 1
    INTO next_code_number
    FROM public.san_pham;

  PERFORM setval('public.ma_san_pham_seq'::regclass, next_code_number, false);
END;
$migration$;

CREATE OR REPLACE FUNCTION public.tao_ma_san_pham_tu_dong()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND nullif(btrim(NEW.ma_san_pham), '') IS NULL THEN
    NEW.ma_san_pham := 'THSP-' || lpad(nextval('public.ma_san_pham_seq'::regclass)::text, 5, '0');
  ELSIF TG_OP = 'UPDATE' AND nullif(btrim(NEW.ma_san_pham), '') IS NULL THEN
    NEW.ma_san_pham := OLD.ma_san_pham;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS san_pham_tao_ma_tu_dong ON public.san_pham;
CREATE TRIGGER san_pham_tao_ma_tu_dong
  BEFORE INSERT OR UPDATE OF ma_san_pham ON public.san_pham
  FOR EACH ROW
  EXECUTE FUNCTION public.tao_ma_san_pham_tu_dong();

GRANT USAGE, SELECT ON SEQUENCE public.ma_san_pham_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.tao_ma_san_pham_tiep_theo()
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT 'THSP-' || lpad(nextval('public.ma_san_pham_seq'::regclass)::text, 5, '0');
$function$;

GRANT EXECUTE ON FUNCTION public.tao_ma_san_pham_tiep_theo() TO authenticated;
