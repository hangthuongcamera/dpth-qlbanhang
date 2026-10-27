import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getKhachHangTrongNhom, getNhomKhachHangById } from "@/lib/supabase/nhom-khach-hang-actions";

export default async function ChiTietNhomKhachHangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let group;
  let customers;
  try {
    [group, customers] = await Promise.all([getNhomKhachHangById(id), getKhachHangTrongNhom(id)]);
  } catch {
    return <div className="p-6 text-sm text-slate-600">Không thể tải thông tin nhóm khách hàng.</div>;
  }
  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><Link href="/nhom-khach-hang" aria-label="Quay lại danh sách nhóm" className="mt-0.5 rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link><div><h2 className="text-xl font-semibold text-slate-900">{group.ten_nhom}</h2><p className="mt-1 text-sm text-slate-500">{customers.length} khách hàng thuộc nhóm này</p></div></div>
        <Link href={`/nhom-khach-hang/${group.id}/chinh-sua`} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4" />Sửa nhóm</Link>
      </div>
      <div className="app-data-table-shell overflow-x-auto rounded-xl border bg-white"><table className="app-data-table w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Mã khách hàng</th><th className="px-4 py-3">Tên khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{customers.map((customer) => <tr key={customer.id}><td className="px-4 py-3 font-medium text-slate-700">{customer.ma_khach_hang}</td><td className="px-4 py-3">{customer.ten_khach_hang}</td><td className="px-4 py-3">{customer.so_dien_thoai || "—"}</td><td className="px-4 py-3">{customer.email || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td></tr>)}{customers.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Nhóm này chưa có khách hàng.</td></tr>}</tbody></table></div>
    </div>
  );
}


