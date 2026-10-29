-- SQL RPC cho nghiệp vụ hồ sơ nhân viên.
-- Các thao tác Supabase Auth (tạo user, đổi mật khẩu, khóa/mở, xóa)
-- vẫn phải được gọi từ Server Action bằng Auth Admin API phía máy chủ.

CREATE OR REPLACE FUNCTION public.nhan_vien_danh_sach()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  ho_ten text,
  vai_tro text,
  trang_thai text,
  created_at timestamptz,
  don_hang_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.vai_tro = 'owner' AND p.trang_thai = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'admin@dongphucthanhhang.com'
    )
  ) THEN
    RAISE EXCEPTION 'Không có quyền truy cập danh sách nhân viên.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.user_id, p.ho_ten, p.vai_tro, p.trang_thai, p.created_at,
         count(d.id)::bigint
  FROM public.user_profiles p
  LEFT JOIN public.don_hang d ON d.created_by = p.user_id
  GROUP BY p.id
  ORDER BY p.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.nhan_vien_tao_ho_so(
  p_user_id uuid,
  p_ho_ten text,
  p_vai_tro text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.vai_tro = 'owner' AND p.trang_thai = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'admin@dongphucthanhhang.com'
    )
  ) THEN
    RAISE EXCEPTION 'Không có quyền tạo hồ sơ nhân viên.';
  END IF;
  IF p_user_id IS NULL OR nullif(trim(p_ho_ten), '') IS NULL
     OR p_vai_tro NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Thông tin hồ sơ nhân viên không hợp lệ.';
  END IF;

  INSERT INTO public.user_profiles (user_id, ho_ten, vai_tro, trang_thai)
  VALUES (p_user_id, trim(p_ho_ten), p_vai_tro, 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET ho_ten = EXCLUDED.ho_ten,
      vai_tro = EXCLUDED.vai_tro,
      trang_thai = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.nhan_vien_cap_nhat_ho_so(
  p_profile_id uuid,
  p_ho_ten text DEFAULT NULL,
  p_vai_tro text DEFAULT NULL,
  p_trang_thai text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.vai_tro = 'owner' AND p.trang_thai = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'admin@dongphucthanhhang.com'
    )
  ) THEN
    RAISE EXCEPTION 'Không có quyền cập nhật hồ sơ nhân viên.';
  END IF;
  IF p_ho_ten IS NOT NULL AND nullif(trim(p_ho_ten), '') IS NULL THEN
    RAISE EXCEPTION 'Họ tên không được để trống.';
  END IF;
  IF p_vai_tro IS NOT NULL AND p_vai_tro NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Vai trò không hợp lệ.';
  END IF;
  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ.';
  END IF;

  SELECT p.user_id INTO v_target_user_id
  FROM public.user_profiles p WHERE p.id = p_profile_id;
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân viên.';
  END IF;
  IF v_target_user_id = auth.uid()
     AND (p_trang_thai = 'inactive' OR p_vai_tro = 'staff') THEN
    RAISE EXCEPTION 'Không thể tự vô hiệu hóa hoặc tự hạ quyền.';
  END IF;

  UPDATE public.user_profiles p
  SET ho_ten = coalesce(trim(p_ho_ten), p.ho_ten),
      vai_tro = coalesce(p_vai_tro, p.vai_tro),
      trang_thai = coalesce(p_trang_thai, p.trang_thai)
  WHERE p.id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.nhan_vien_lay_muc_tieu(p_profile_id uuid)
RETURNS TABLE (user_id uuid, trang_thai text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.vai_tro = 'owner' AND p.trang_thai = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'admin@dongphucthanhhang.com'
    )
  ) THEN
    RAISE EXCEPTION 'Không có quyền xem hồ sơ nhân viên.';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.trang_thai
  FROM public.user_profiles p
  WHERE p.id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân viên.';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.nhan_vien_kiem_tra_xoa(p_profile_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_target_user_id uuid;
  v_order_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.vai_tro = 'owner' AND p.trang_thai = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'admin@dongphucthanhhang.com'
    )
  ) THEN
    RAISE EXCEPTION 'Không có quyền kiểm tra hồ sơ nhân viên.';
  END IF;

  SELECT p.user_id INTO v_target_user_id
  FROM public.user_profiles p WHERE p.id = p_profile_id;
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân viên.';
  END IF;

  SELECT count(*)::bigint INTO v_order_count
  FROM public.don_hang d WHERE d.created_by = v_target_user_id;
  RETURN v_order_count;
END;
$$;

REVOKE ALL ON FUNCTION public.nhan_vien_danh_sach() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_tao_ho_so(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_cap_nhat_ho_so(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_kiem_tra_xoa(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nhan_vien_lay_muc_tieu(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_danh_sach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_tao_ho_so(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_cap_nhat_ho_so(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_kiem_tra_xoa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nhan_vien_lay_muc_tieu(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

