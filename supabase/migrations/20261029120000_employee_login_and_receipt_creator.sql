-- Employee username/email login; retain SQL-only database functions.
-- Legacy orders/receipts remain attributed to the shop owner.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ten_dang_nhap text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS auth_email text;

DO $migration$
DECLARE
  r record;
  v_base text;
  v_candidate text;
  v_suffix integer;
BEGIN
  FOR r IN SELECT p.id, u.email AS source_auth_email, u.raw_user_meta_data
           FROM public.user_profiles p JOIN auth.users u ON u.id = p.user_id
           WHERE p.ten_dang_nhap IS NULL ORDER BY p.created_at, p.id
  LOOP
    v_base := lower(regexp_replace(coalesce(nullif(r.raw_user_meta_data->>'ten_dang_nhap',''), split_part(r.source_auth_email, '@', 1), 'nhanvien'), '[^a-z0-9._-]', '', 'g'));
    v_base := left(v_base, 24);
    IF v_base !~ '^[a-z0-9]' THEN v_base := 'nv' || v_base; END IF;
    IF length(v_base) < 3 THEN v_base := 'nvx'; END IF;
    v_candidate := v_base;
    v_suffix := 1;
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE lower(ten_dang_nhap) = v_candidate AND id <> r.id) LOOP
      v_candidate := left(v_base, 27) || v_suffix::text;
      v_suffix := v_suffix + 1;
    END LOOP;
    UPDATE public.user_profiles SET ten_dang_nhap = v_candidate,
      email = CASE WHEN coalesce(r.raw_user_meta_data->>'email_lien_he','') = '' THEN r.source_auth_email ELSE r.raw_user_meta_data->>'email_lien_he' END,
auth_email = r.source_auth_email
      WHERE id = r.id;
  END LOOP;
END;
$migration$;

ALTER TABLE public.user_profiles ALTER COLUMN ten_dang_nhap SET NOT NULL;
UPDATE public.user_profiles p SET auth_email=u.email FROM auth.users u WHERE p.user_id=u.id AND p.auth_email IS NULL;
ALTER TABLE public.user_profiles ALTER COLUMN auth_email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_auth_email_lower_uq ON public.user_profiles (lower(auth_email));
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_ten_dang_nhap_lower_uq ON public.user_profiles (lower(ten_dang_nhap));
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_lower_uq ON public.user_profiles (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_ten_dang_nhap_format_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_ten_dang_nhap_format_check
  CHECK (ten_dang_nhap ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

CREATE OR REPLACE FUNCTION public.fn_tao_profile_khi_dang_ky()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_vai_tro text; v_ho_ten text; v_base text; v_username text; v_n integer := 1;
BEGIN
  IF lower(NEW.email) = 'admin@dongphucthanhhang.com' OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE vai_tro = 'owner') THEN v_vai_tro := 'owner'; ELSE v_vai_tro := 'staff'; END IF;
  v_ho_ten := coalesce(NEW.raw_user_meta_data->>'ho_ten', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Người dùng');
  v_base := left(lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'ten_dang_nhap', split_part(NEW.email, '@', 1), 'nhanvien'), '[^a-z0-9._-]', '', 'g')), 24);
  IF v_base !~ '^[a-z0-9]' THEN v_base := 'nv' || v_base; END IF;
    IF length(v_base) < 3 THEN v_base := 'nvx'; END IF;
  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE lower(ten_dang_nhap) = v_username) LOOP v_username := left(v_base, 27) || v_n::text; v_n := v_n + 1; END LOOP;
  INSERT INTO public.user_profiles(user_id, ho_ten, vai_tro, ten_dang_nhap, email, auth_email)
  VALUES (NEW.id, v_ho_ten, v_vai_tro, v_username, nullif(NEW.raw_user_meta_data->>'email_lien_he',''), NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET ho_ten=EXCLUDED.ho_ten, vai_tro=EXCLUDED.vai_tro, ten_dang_nhap=EXCLUDED.ten_dang_nhap, email=EXCLUDED.email, auth_email=EXCLUDED.auth_email;
  RETURN NEW;
END $$;

ALTER TABLE public.phieu_thu ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
DO $owner_backfill$
DECLARE v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'admin@dongphucthanhhang.com' LIMIT 1;
  IF v_owner IS NULL THEN SELECT user_id INTO v_owner FROM public.user_profiles WHERE vai_tro='owner' ORDER BY created_at LIMIT 1; END IF;
  IF v_owner IS NOT NULL THEN UPDATE public.phieu_thu SET created_by = v_owner WHERE created_by IS NULL; END IF;
END $owner_backfill$;
CREATE INDEX IF NOT EXISTS phieu_thu_created_by_idx ON public.phieu_thu(created_by);

CREATE OR REPLACE FUNCTION public.fn_gan_created_by_phieu_thu()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gan_created_by_phieu_thu ON public.phieu_thu;
CREATE TRIGGER trg_gan_created_by_phieu_thu BEFORE INSERT OR UPDATE ON public.phieu_thu
FOR EACH ROW EXECUTE FUNCTION public.fn_gan_created_by_phieu_thu();

DROP FUNCTION IF EXISTS public.nhan_vien_danh_sach();
CREATE FUNCTION public.nhan_vien_danh_sach()
RETURNS TABLE(id uuid, user_id uuid, ho_ten text, ten_dang_nhap text, email text, vai_tro text, trang_thai text, created_at timestamptz, don_hang_count bigint, phieu_thu_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id=auth.uid() AND p.vai_tro='owner' AND p.trang_thai='active') OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND lower(u.email)='admin@dongphucthanhhang.com')) THEN RAISE EXCEPTION 'Không có quyền truy cập danh sách nhân viên.'; END IF;
  RETURN QUERY SELECT p.id,p.user_id,p.ho_ten,p.ten_dang_nhap,p.email,p.vai_tro,p.trang_thai,p.created_at,
    (SELECT count(*)::bigint FROM public.don_hang d WHERE d.created_by=p.user_id),
    (SELECT count(*)::bigint FROM public.phieu_thu pt WHERE pt.created_by=p.user_id)
  FROM public.user_profiles p ORDER BY p.created_at;
END $$;

DROP FUNCTION IF EXISTS public.nhan_vien_tao_ho_so(uuid,text,text);
CREATE FUNCTION public.nhan_vien_tao_ho_so(p_user_id uuid,p_ho_ten text,p_vai_tro text,p_ten_dang_nhap text,p_email text,p_auth_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id=auth.uid() AND p.vai_tro='owner' AND p.trang_thai='active') OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND lower(u.email)='admin@dongphucthanhhang.com')) THEN RAISE EXCEPTION 'Không có quyền tạo hồ sơ nhân viên.'; END IF;
  IF p_user_id IS NULL OR nullif(trim(p_ho_ten),'') IS NULL OR p_vai_tro NOT IN ('owner','staff') OR p_ten_dang_nhap !~ '^[a-z0-9][a-z0-9._-]{2,31}$' THEN RAISE EXCEPTION 'Thông tin hồ sơ nhân viên không hợp lệ.'; END IF;
  INSERT INTO public.user_profiles(user_id,ho_ten,vai_tro,trang_thai,ten_dang_nhap,email,auth_email)
  VALUES(p_user_id,trim(p_ho_ten),p_vai_tro,'active',lower(p_ten_dang_nhap),nullif(lower(trim(p_email)),''),p_auth_email)
  ON CONFLICT(user_id) DO UPDATE SET ho_ten=EXCLUDED.ho_ten,vai_tro=EXCLUDED.vai_tro,trang_thai='active',ten_dang_nhap=EXCLUDED.ten_dang_nhap,email=EXCLUDED.email,auth_email=EXCLUDED.auth_email;
END $$;

DROP FUNCTION IF EXISTS public.nhan_vien_cap_nhat_ho_so(uuid,text,text,text);
CREATE FUNCTION public.nhan_vien_cap_nhat_ho_so(p_profile_id uuid,p_ho_ten text DEFAULT NULL,p_vai_tro text DEFAULT NULL,p_trang_thai text DEFAULT NULL,p_ten_dang_nhap text DEFAULT NULL,p_email text DEFAULT NULL,p_auth_email text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_target uuid; v_old_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id=auth.uid() AND p.vai_tro='owner' AND p.trang_thai='active') OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND lower(u.email)='admin@dongphucthanhhang.com')) THEN RAISE EXCEPTION 'Không có quyền cập nhật hồ sơ nhân viên.'; END IF;
  SELECT user_id,email INTO v_target,v_old_email FROM public.user_profiles WHERE id=p_profile_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân viên.'; END IF;
  IF p_ho_ten IS NOT NULL AND nullif(trim(p_ho_ten),'') IS NULL THEN RAISE EXCEPTION 'Họ tên không được để trống.'; END IF;
  IF p_vai_tro IS NOT NULL AND p_vai_tro NOT IN ('owner','staff') THEN RAISE EXCEPTION 'Vai trò không hợp lệ.'; END IF;
  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Trạng thái không hợp lệ.'; END IF;
  IF p_ten_dang_nhap IS NOT NULL AND p_ten_dang_nhap !~ '^[a-z0-9][a-z0-9._-]{2,31}$' THEN RAISE EXCEPTION 'Tên đăng nhập không hợp lệ.'; END IF;
  IF v_old_email IS NOT NULL AND p_email IS NOT NULL AND nullif(trim(p_email),'') IS NULL THEN RAISE EXCEPTION 'Không thể xóa email đã có.'; END IF;
  IF v_target=auth.uid() AND (p_trang_thai='inactive' OR p_vai_tro='staff') THEN RAISE EXCEPTION 'Không thể tự vô hiệu hóa hoặc tự hạ quyền.'; END IF;
  UPDATE public.user_profiles SET ho_ten=coalesce(nullif(trim(p_ho_ten),''),ho_ten), vai_tro=coalesce(p_vai_tro,vai_tro), trang_thai=coalesce(p_trang_thai,trang_thai), ten_dang_nhap=coalesce(lower(p_ten_dang_nhap),ten_dang_nhap), email=CASE WHEN p_email IS NULL THEN email ELSE nullif(lower(trim(p_email)),'') END, auth_email=coalesce(p_auth_email,auth_email) WHERE id=p_profile_id;
END $$;

DROP FUNCTION IF EXISTS public.nhan_vien_lay_muc_tieu(uuid);
CREATE FUNCTION public.nhan_vien_lay_muc_tieu(p_profile_id uuid)
RETURNS TABLE(user_id uuid,trang_thai text,email text,auth_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id=auth.uid() AND p.vai_tro='owner' AND p.trang_thai='active') OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND lower(u.email)='admin@dongphucthanhhang.com')) THEN RAISE EXCEPTION 'Không có quyền xem hồ sơ nhân viên.'; END IF;
  RETURN QUERY SELECT p.user_id,p.trang_thai,p.email,p.auth_email FROM public.user_profiles p WHERE p.id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân viên.'; END IF;
END $$;

DROP FUNCTION IF EXISTS public.nhan_vien_kiem_tra_xoa(uuid);
CREATE FUNCTION public.nhan_vien_kiem_tra_xoa(p_profile_id uuid)
RETURNS TABLE(don_hang_count bigint,phieu_thu_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_user uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id=auth.uid() AND p.vai_tro='owner' AND p.trang_thai='active') OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND lower(u.email)='admin@dongphucthanhhang.com')) THEN RAISE EXCEPTION 'Không có quyền kiểm tra hồ sơ nhân viên.'; END IF;
  SELECT user_id INTO v_user FROM public.user_profiles WHERE id=p_profile_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân viên.'; END IF;
  RETURN QUERY SELECT (SELECT count(*)::bigint FROM public.don_hang d WHERE d.created_by=v_user),(SELECT count(*)::bigint FROM public.phieu_thu pt WHERE pt.created_by=v_user);
END $$;

REVOKE ALL ON FUNCTION public.nhan_vien_danh_sach() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_tao_ho_so(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_cap_nhat_ho_so(uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_lay_muc_tieu(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_kiem_tra_xoa(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_danh_sach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_tao_ho_so(uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_cap_nhat_ho_so(uuid,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_lay_muc_tieu(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_kiem_tra_xoa(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';




