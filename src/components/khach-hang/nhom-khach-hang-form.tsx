"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capNhatNhomKhachHang, capNhatThanhVienNhom, ganKhachHangVaoNhom, taoNhomKhachHang, type KhachHangTrongNhom, type NhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";

export function NhomKhachHangForm({
  group,
  availableCustomers = [],
  currentCustomers = [],
}: {
  group?: NhomKhachHang;
  availableCustomers?: KhachHangTrongNhom[];
  currentCustomers?: KhachHangTrongNhom[];
}) {
  const router = useRouter();
  const returnHref = group ? `/nhom-khach-hang/${group.id}` : "/nhom-khach-hang";
  const [name, setName] = useState(group?.ten_nhom ?? "");
  const [selected, setSelected] = useState<string[]>(currentCustomers.map((customer) => customer.id));
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const originalCustomerIds = useMemo(() => new Set(currentCustomers.map((customer) => customer.id)), [currentCustomers]);
  const customerOptions = useMemo(() => [...currentCustomers, ...availableCustomers], [currentCustomers, availableCustomers]);
  const selectedCustomers = useMemo(() => customerOptions.filter((customer) => selected.includes(customer.id)), [customerOptions, selected]);
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return customerOptions.filter((customer) => !selected.includes(customer.id) && (!q || `${customer.ma_khach_hang} ${customer.ten_khach_hang} ${customer.so_dien_thoai ?? ""} ${customer.email ?? ""}`.toLocaleLowerCase("vi").includes(q)));
  }, [customerOptions, search, selected]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (group) {
        await capNhatNhomKhachHang(group.id, { ten_nhom: name });
        await capNhatThanhVienNhom(group.id, selected);
        router.push(`/nhom-khach-hang/${group.id}`);
        router.refresh();
        return;
      }
      const created = await taoNhomKhachHang(name);
      try {
        await ganKhachHangVaoNhom(created.id, selected);
      } catch (assignError) {
        setError(`Nhóm “${created.ten_nhom}” đã được tạo, nhưng chưa thể thêm khách hàng: ${assignError instanceof Error ? assignError.message : "Vui lòng thử lại."}`);
        return;
      }
      router.push("/nhom-khach-hang?created=1");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể lưu nhóm khách hàng.");
    } finally {
      setBusy(false);
    }
  }

  function toggleCustomer(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3"><Link href={returnHref} aria-label={group ? "Quay lại chi tiết nhóm" : "Quay lại danh sách nhóm"} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></Link><div><h2 className="text-lg font-semibold">{group ? "Sửa nhóm khách hàng" : "Thêm nhóm khách hàng"}</h2><p className="mt-1 text-sm text-slate-500">{group ? "Cập nhật tên nhóm khách hàng." : "Đặt tên nhóm và chọn khách hàng muốn thêm vào nhóm."}</p></div></div>
      <section className="space-y-4 rounded-xl border bg-white p-4 md:p-6">
        <div className="space-y-2"><Label htmlFor="ten-nhom">Tên nhóm khách hàng <span className="text-red-600">*</span></Label><Input id="ten-nhom" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Nhập tên nhóm" required /></div>
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium text-slate-900">Khách hàng trong nhóm</h3><p className="mt-1 text-sm text-slate-500">{selectedCustomers.length} khách hàng</p></div><Button type="button" variant="outline" disabled={Boolean(group && !group.trang_thai)} onClick={() => setPickerOpen((open) => !open)}><UserPlus className="mr-2 h-4 w-4" />{pickerOpen ? "Đóng danh sách" : "Thêm khách hàng"}</Button></div>
          {group && !group.trang_thai && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nhóm đang ngừng hoạt động nên không thể thêm khách hàng mới. Bạn vẫn có thể bỏ khách hàng khỏi nhóm.</p>}
          <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Mã khách hàng</th><th className="px-4 py-3">Tên khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedCustomers.map((customer) => <tr key={customer.id}><td className="px-4 py-3 font-medium text-slate-700">{customer.ma_khach_hang}</td><td className="px-4 py-3">{customer.ten_khach_hang}</td><td className="px-4 py-3">{customer.so_dien_thoai || "—"}</td><td className="px-4 py-3">{customer.email || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td><td className="px-4 py-3 text-right"><Button type="button" size="icon-sm" variant="outline" aria-label={`Bỏ khách hàng ${customer.ten_khach_hang} khỏi nhóm`} title="Bỏ khỏi nhóm" disabled={busy} className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => toggleCustomer(customer.id)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}{selectedCustomers.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Chưa có khách hàng trong nhóm.</td></tr>}</tbody></table></div>
          {pickerOpen && <div className="space-y-3 rounded-lg border p-3"><div><h4 className="font-medium text-slate-800">Chọn khách hàng chưa thuộc nhóm</h4><p className="mt-1 text-xs text-slate-500">Khách hàng đã thuộc nhóm khác sẽ không xuất hiện trong danh sách.</p></div><div className="relative"><Search aria-hidden="true" className="app-search-icon" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, tên, số điện thoại hoặc email" className="app-search-input" /></div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Mã khách hàng</th><th className="px-4 py-3">Tên khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredCustomers.map((customer) => { const disabled = Boolean(group && !group.trang_thai && !originalCustomerIds.has(customer.id)); return <tr key={customer.id}><td className="px-4 py-3 font-medium text-slate-700">{customer.ma_khach_hang}</td><td className="px-4 py-3">{customer.ten_khach_hang}</td><td className="px-4 py-3">{customer.so_dien_thoai || "—"}</td><td className="px-4 py-3">{customer.email || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td><td className="px-4 py-3 text-right"><Button type="button" size="icon-sm" variant="outline" aria-label={`Thêm khách hàng ${customer.ten_khach_hang} vào nhóm`} title="Thêm vào nhóm" disabled={busy || disabled} onClick={() => toggleCustomer(customer.id)}><Plus className="h-4 w-4" /></Button></td></tr>; })}{filteredCustomers.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">{customerOptions.length ? "Không còn khách hàng phù hợp để thêm." : "Không còn khách hàng chưa thuộc nhóm nào."}</td></tr>}</tbody></table></div></div>}
        </div>
      </section>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => router.push(returnHref)}>Hủy</Button><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Đang lưu..." : group ? "Lưu thay đổi" : "Tạo nhóm"}</Button></div>
    </form>
  );
}


