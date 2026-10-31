import { NhomKhachHangForm } from "@/components/khach-hang/nhom-khach-hang-form";
import { getKhachHangChuaCoNhom } from "@/lib/supabase/nhom-khach-hang-actions";

export default async function ThemNhomKhachHangPage() {
  const customers = await getKhachHangChuaCoNhom();
  return (
    <div className="app-page">
      <NhomKhachHangForm availableCustomers={customers} />
    </div>
  );
}
