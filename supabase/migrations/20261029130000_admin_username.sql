-- Gán tên đăng nhập admin cho tài khoản chủ cửa hàng.
-- Chạy sau 20261029120000_employee_login_and_receipt_creator.sql.

DO $$
DECLARE
  v_admin_user_id uuid;
BEGIN
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE lower(email) = 'admin@dongphucthanhhang.com'
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản admin@dongphucthanhhang.com trong Supabase Auth.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_admin_user_id
  ) THEN
    RAISE EXCEPTION 'Chưa có hồ sơ nhân viên cho tài khoản admin. Hãy chạy migration nhân viên trước.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE lower(ten_dang_nhap) = 'admin' AND user_id <> v_admin_user_id
  ) THEN
    RAISE EXCEPTION 'Tên đăng nhập admin đang được tài khoản khác sử dụng; chưa thay đổi dữ liệu.';
  END IF;

  UPDATE public.user_profiles
  SET ten_dang_nhap = 'admin'
  WHERE user_id = v_admin_user_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
