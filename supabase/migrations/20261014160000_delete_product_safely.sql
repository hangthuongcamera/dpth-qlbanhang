CREATE OR REPLACE FUNCTION public.xoa_san_pham(p_san_pham_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF p_san_pham_id IS NULL THEN
    RAISE EXCEPTION 'Product ID is required.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.bien_the_san_pham
   WHERE san_pham_id = p_san_pham_id;

  DELETE FROM public.san_pham
   WHERE id = p_san_pham_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or access denied.' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.xoa_san_pham(uuid) TO authenticated;
