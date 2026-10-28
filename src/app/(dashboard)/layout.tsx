
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/user-profile";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  // Lấy profile vai trò (staff/owner) để truyền xuống layout
  const userProfile = await getCurrentUserProfile();
  const vaiTro = userProfile?.vai_tro ?? "staff";
  const hoTen = userProfile?.ho_ten ?? data.user.email ?? "";

  return (
    <DashboardShell vaiTro={vaiTro} hoTen={hoTen}>
      {children}
    </DashboardShell>
  );
}
