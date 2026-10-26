-- Allow each product to define its own variant attribute names and values.
ALTER TABLE public.bien_the_san_pham
  ADD COLUMN thuoc_tinh jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.bien_the_san_pham
SET thuoc_tinh = jsonb_strip_nulls(
  jsonb_build_object(
    'Size', nullif(btrim(kich_co), ''),
    'Màu sắc', nullif(btrim(mau_sac), '')
  )
);

DROP INDEX IF EXISTS public.bien_the_san_pham_thuoc_tinh_uidx;
CREATE UNIQUE INDEX bien_the_san_pham_thuoc_tinh_uidx
  ON public.bien_the_san_pham (san_pham_id, thuoc_tinh);

CREATE OR REPLACE FUNCTION public.luu_san_pham(
  p_san_pham_id uuid,
  p_san_pham jsonb,
  p_bien_the jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  product_id uuid;
  variant jsonb;
  variant_id uuid;
  variant_attributes jsonb;
  sku text;
BEGIN
  IF coalesce(jsonb_typeof(p_bien_the), '') <> 'array'
     OR coalesce(jsonb_array_length(p_bien_the), 0) = 0 THEN
    RAISE EXCEPTION 'A product must have at least one variant.';
  END IF;

  IF p_san_pham_id IS NULL THEN
    INSERT INTO public.san_pham (
      ma_san_pham, ten_san_pham, loai_san_pham_id, don_vi_tinh, mo_ta, trang_thai
    ) VALUES (
      btrim(p_san_pham ->> 'ma_san_pham'),
      btrim(p_san_pham ->> 'ten_san_pham'),
      (p_san_pham ->> 'loai_san_pham_id')::uuid,
      coalesce(nullif(btrim(p_san_pham ->> 'don_vi_tinh'), ''), 'cai'),
      nullif(btrim(p_san_pham ->> 'mo_ta'), ''),
      coalesce((p_san_pham ->> 'trang_thai')::boolean, true)
    ) RETURNING id INTO product_id;
  ELSE
    UPDATE public.san_pham
       SET ma_san_pham = btrim(p_san_pham ->> 'ma_san_pham'),
           ten_san_pham = btrim(p_san_pham ->> 'ten_san_pham'),
           loai_san_pham_id = (p_san_pham ->> 'loai_san_pham_id')::uuid,
           don_vi_tinh = coalesce(nullif(btrim(p_san_pham ->> 'don_vi_tinh'), ''), 'cai'),
           mo_ta = nullif(btrim(p_san_pham ->> 'mo_ta'), ''),
           trang_thai = coalesce((p_san_pham ->> 'trang_thai')::boolean, true),
           updated_at = now()
     WHERE id = p_san_pham_id
     RETURNING id INTO product_id;

    IF product_id IS NULL THEN
      RAISE EXCEPTION 'Product not found.';
    END IF;

    -- Variants omitted by the submitted form stay in history but are deactivated.
    UPDATE public.bien_the_san_pham
       SET trang_thai = false, updated_at = now()
     WHERE san_pham_id = product_id;
  END IF;

  FOR variant IN SELECT value FROM jsonb_array_elements(p_bien_the)
  LOOP
    variant_id := nullif(variant ->> 'id', '')::uuid;
    sku := nullif(btrim(variant ->> 'ma_sku'), '');
    variant_attributes := coalesce(variant -> 'thuoc_tinh', '{}'::jsonb);

    IF jsonb_typeof(variant_attributes) <> 'object' THEN
      RAISE EXCEPTION 'Variant attributes must be a JSON object.';
    END IF;

    IF variant_id IS NOT NULL THEN
      UPDATE public.bien_the_san_pham
         SET ma_sku = coalesce(sku, ma_sku),
             thuoc_tinh = variant_attributes,
             kich_co = nullif(variant_attributes ->> 'Size', ''),
             mau_sac = nullif(variant_attributes ->> 'Màu sắc', ''),
             gia_ban = (variant ->> 'gia_ban')::numeric,
             gia_nhap = (variant ->> 'gia_nhap')::numeric,
             trang_thai = coalesce((variant ->> 'trang_thai')::boolean, true),
             updated_at = now()
       WHERE id = variant_id AND san_pham_id = product_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product variant not found.';
      END IF;
    ELSE
      INSERT INTO public.bien_the_san_pham (
        san_pham_id, ma_sku, thuoc_tinh, kich_co, mau_sac,
        gia_ban, gia_nhap, trang_thai
      ) VALUES (
        product_id,
        coalesce(sku, 'SKU-' || lpad(nextval('public.ma_sku_bien_the_seq'::regclass)::text, 6, '0')),
        variant_attributes,
        nullif(variant_attributes ->> 'Size', ''),
        nullif(variant_attributes ->> 'Màu sắc', ''),
        (variant ->> 'gia_ban')::numeric,
        (variant ->> 'gia_nhap')::numeric,
        coalesce((variant ->> 'trang_thai')::boolean, true)
      );
    END IF;
  END LOOP;

  RETURN product_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.luu_san_pham(uuid, jsonb, jsonb) TO authenticated;
