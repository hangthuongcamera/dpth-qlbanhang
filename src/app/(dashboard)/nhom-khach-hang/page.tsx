import { NhomKhachHangManager } from "@/components/khach-hang/nhom-khach-hang-manager";
import { getNhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";

export default async function NhomKhachHangPage() {
  const groups = await getNhomKhachHang(true);
  return <NhomKhachHangManager groups={groups} />;
}

