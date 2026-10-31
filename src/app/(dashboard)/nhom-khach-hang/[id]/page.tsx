import Link from "next/link";
import { Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NhomKhachHangDeleteButton } from "@/components/khach-hang/nhom-khach-hang-delete-button";
import { getKhachHangTrongNhom, getNhomKhachHangById } from "@/lib/supabase/nhom-khach-hang-actions";

export default async function ChiTietNhomKhachHangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let group;
  let customers;
  try {
    [group, customers] = await Promise.all([getNhomKhachHangById(id), getKhachHangTrongNhom(id)]);
  } catch {
    return <div className="app-page text-sm text-slate-600">Không thể tải thông tin nhóm khách hàng.</div>;
  }
  return (
    <div className="space-y-4 md:space-y-5 app-page">
      <div className="app-list-actions">
        <Link href="/nhom-khach-hang" className={buttonVariants({ variant: "outline", size: "default" })}>Quay lại</Link>
        <Link href={`/nhom-khach-hang/${group.id}/chinh-sua`} className={buttonVariants({ variant: "outline", size: "default" })}><Pencil />Sửa nhóm</Link>
        <NhomKhachHangDeleteButton group={group} customerCount={customers.length} />
      </div>
      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 md:p-4">
        <div><dt className="text-sm text-slate-500">Tên nhóm</dt><dd className="mt-1 break-words font-medium text-slate-900">{group.ten_nhom}</dd></div>
        <div><dt className="text-sm text-slate-500">Số khách hàng</dt><dd className="mt-1 font-medium text-slate-900">{customers.length}</dd></div>
      </section>
      <div className="space-y-3 md:hidden">
        {customers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">Nhóm này chưa có khách hàng.</div>
        ) : customers.map((customer) => <article key={customer.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-semibold text-slate-900">{customer.ten_khach_hang}</p>
              <p className="mt-1 text-sm text-slate-500">Mã KH: {customer.ma_khach_hang}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span>
          </div>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 text-sm">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3"><span className="text-slate-500">Số điện thoại</span><span className="break-all text-right">{customer.so_dien_thoai || "—"}</span></div>
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3"><span className="text-slate-500">Email</span><span className="break-all text-right">{customer.email || "—"}</span></div>
          </div>
        </article>)}
      </div>
      <div className="app-data-table-shell hidden overflow-x-auto rounded-xl border bg-white md:block">
        <table className="app-data-table w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Mã khách hàng</th><th className="px-4 py-3">Tên khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{customers.map((customer) => <tr key={customer.id}><td className="px-4 py-3 font-medium text-slate-700">{customer.ma_khach_hang}</td><td className="px-4 py-3">{customer.ten_khach_hang}</td><td className="px-4 py-3">{customer.so_dien_thoai || "—"}</td><td className="px-4 py-3">{customer.email || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td></tr>)}{customers.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Nhóm này chưa có khách hàng.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}




