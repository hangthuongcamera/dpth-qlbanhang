import { redirect } from "next/navigation";
import { isOwner, getCurrentUserProfile } from "@/lib/supabase/user-profile";
import { layDanhSachNhanVien } from "@/lib/supabase/nhan-vien-actions";
import { NhanVienManager } from "@/components/nhan-vien/nhan-vien-manager";

export default async function NhanVienPage() {
  // Chỉ owner mới được vào trang này
  if (!(await isOwner())) {
    redirect("/dashboard");
  }

  const currentProfile = await getCurrentUserProfile();
  const danhSach = await layDanhSachNhanVien();

  return (
    <main className="space-y-6 p-4 md:p-6">
      <NhanVienManager
        danhSach={danhSach}
        currentUserId={currentProfile?.user_id ?? ""}
      />
    </main>
  );
}
