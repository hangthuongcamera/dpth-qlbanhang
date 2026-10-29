-- Migration: Phân quyền người dùng (user_profiles)
-- Ngày: 29/10/2026
-- Mô tả:
--   1. Tạo bảng user_profiles để lưu hồ sơ và vai trò người dùng
--   2. Tự tạo/backfill profile khi có tài khoản Auth
--   3. Gán người tạo cho đơn hàng để theo dõi nhân viên lập đơn
--   Bảo vệ owner cuối cùng được bổ sung ở migration hardening kế tiếp.

-- ===========================================================================
-- 1. Bảng user_profiles
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ho_ten        text NOT NULL DEFAULT '',
  vai_tro       text NOT NULL DEFAULT 'staff' CHECK (vai_tro IN ('owner', 'staff')),
  trang_thai    text NOT NULL DEFAULT 'active' CHECK (trang_thai IN ('active', 'inactive')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Policies:
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_owner" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_owner" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_service" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_all_authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

-- Mọi user đã đăng nhập đều có thể đọc bảng profile (để biết họ tên/vai trò hiển thị)
CREATE POLICY "user_profiles_select_all_authenticated"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- User tự cập nhật thông tin của mình
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy cho phép insert khi tạo nhân viên
CREATE POLICY "user_profiles_insert_authenticated"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===========================================================================
-- 2. Trigger: tự tạo profile khi user mới được tạo trong auth.users
--    - User đầu tiên trong hệ thống → vai_tro = 'owner'
--    - Các user sau → vai_tro = 'staff' (chủ shop tạo nhân viên)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.fn_tao_profile_khi_dang_ky()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vai_tro text;
  v_ho_ten  text;
BEGIN
  -- Nếu email là admin@dongphucthanhhang.com hoặc hệ thống chưa có owner thì cấp vai_tro = 'owner'
  IF lower(NEW.email) = 'admin@dongphucthanhhang.com' OR NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE vai_tro = 'owner' LIMIT 1) THEN
    v_vai_tro := 'owner';
  ELSE
    v_vai_tro := 'staff';
  END IF;

  -- Lấy ho_ten từ raw_user_meta_data nếu có
  v_ho_ten := COALESCE(
    NEW.raw_user_meta_data->>'ho_ten',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Người dùng'
  );

  INSERT INTO public.user_profiles(user_id, ho_ten, vai_tro)
  VALUES (NEW.id, v_ho_ten, v_vai_tro)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tao_profile_khi_dang_ky ON auth.users;
CREATE TRIGGER trg_tao_profile_khi_dang_ky
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_tao_profile_khi_dang_ky();

-- ===========================================================================
-- 3. Backfill: tạo profile cho các user hiện có chưa có profile
--    - Tài khoản admin@dongphucthanhhang.com hoặc user đầu tiên luôn là owner
--    - Các user khác mặc định là staff
-- ===========================================================================
DO $$
DECLARE
  v_admin_user_id uuid;
BEGIN
  -- Ưu tiên tìm tài khoản admin chính thức theo email
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE lower(email) = 'admin@dongphucthanhhang.com'
  LIMIT 1;

  -- Nếu không có admin@dongphucthanhhang.com thì lấy user đầu tiên được tạo
  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Gán hoặc cập nhật vai trò owner cho admin chính thức
  IF v_admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_profiles(user_id, ho_ten, vai_tro)
    SELECT
      u.id,
      COALESCE(u.raw_user_meta_data->>'ho_ten', split_part(u.email, '@', 1), 'Chủ cửa hàng'),
      'owner'
    FROM auth.users u
    WHERE u.id = v_admin_user_id
    ON CONFLICT (user_id) DO UPDATE SET vai_tro = 'owner', trang_thai = 'active';
  END IF;

  -- Tạo profile staff cho các user còn lại nếu chưa có
  INSERT INTO public.user_profiles(user_id, ho_ten, vai_tro)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'ho_ten', split_part(u.email, '@', 1), 'Nhân viên'),
    'staff'
  FROM auth.users u
  WHERE u.id != v_admin_user_id
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- ===========================================================================
-- 4. Thêm cột created_by vào don_hang để theo dõi nhân viên tạo đơn
--    Cập nhật trigger gán created_by = auth.uid() nếu rỗng
-- ===========================================================================
ALTER TABLE public.don_hang
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.fn_gan_created_by_don_hang()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gan_created_by_don_hang ON public.don_hang;
CREATE TRIGGER trg_gan_created_by_don_hang
  BEFORE INSERT ON public.don_hang
  FOR EACH ROW EXECUTE FUNCTION public.fn_gan_created_by_don_hang();

-- Backfill: gán created_by cho đơn hiện có (gán cho owner đầu tiên)
DO $$
DECLARE
  v_owner_user_id uuid;
BEGIN
  SELECT user_id INTO v_owner_user_id
  FROM public.user_profiles
  WHERE vai_tro = 'owner'
  LIMIT 1;

  IF v_owner_user_id IS NOT NULL THEN
    UPDATE public.don_hang
    SET created_by = v_owner_user_id
    WHERE created_by IS NULL;
  END IF;
END;
$$;

-- ===========================================================================
-- 5. Notify PostgREST reload schema
-- ===========================================================================
NOTIFY pgrst, 'reload schema';


