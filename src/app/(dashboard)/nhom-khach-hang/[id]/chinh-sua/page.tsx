import { notFound } from "next/navigation";
import { NhomKhachHangForm } from "@/components/khach-hang/nhom-khach-hang-form";
import { getKhachHangChuaCoNhom, getKhachHangTrongNhom, getNhomKhachHangById } from "@/lib/supabase/nhom-khach-hang-actions";

export default async function ChinhSuaNhomKhachHangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let group;
  let customers;
  let availableCustomers;
  try {
    [group, customers, availableCustomers] = await Promise.all([
      getNhomKhachHangById(id),
      getKhachHangTrongNhom(id),
      getKhachHangChuaCoNhom(),
    ]);
  } catch {
    notFound();
  }
  return <NhomKhachHangForm group={group} currentCustomers={customers} availableCustomers={availableCustomers} />;
}
