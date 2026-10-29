-- Khóa tự sửa vai trò/trạng thái hồ sơ qua Supabase Data API.
-- Thay đổi hồ sơ đi qua SQL RPC có kiểm tra quyền; thao tác Auth Admin đi qua server với service role key.
DROP POLICY IF EXISTS "user_profiles_select_all_authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_insert_authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.fn_bao_ve_owner_cuoi_cung()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.vai_tro = 'owner' AND OLD.trang_thai = 'active' THEN
    IF TG_OP = 'DELETE' OR NEW.vai_tro IS DISTINCT FROM 'owner'
       OR NEW.trang_thai IS DISTINCT FROM 'active' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles p
        WHERE p.id <> OLD.id AND p.vai_tro = 'owner' AND p.trang_thai = 'active'
      ) THEN
        RAISE EXCEPTION 'Không thể xóa hoặc vô hiệu hóa quản trị viên cuối cùng.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bao_ve_owner_cuoi_cung ON public.user_profiles;
CREATE TRIGGER trg_bao_ve_owner_cuoi_cung
  BEFORE UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bao_ve_owner_cuoi_cung();

NOTIFY pgrst, 'reload schema';


