import { CustomerForm } from "@/components/khach-hang/customer-form";
import { getNhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";

export default async function ThemKhachHangPage() {
  const groups = await getNhomKhachHang();
  return (
    <div className="app-page">
      <CustomerForm groups={groups} />
    </div>
  );
}

