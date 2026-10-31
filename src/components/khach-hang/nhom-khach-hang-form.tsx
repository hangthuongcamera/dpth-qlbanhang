"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capNhatNhomKhachHang, capNhatThanhVienNhom, ganKhachHangVaoNhom, taoNhomKhachHang, type KhachHangTrongNhom, type NhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";
import { normalizeVietnameseSearch } from "@/lib/search/normalize-vietnamese";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const originalCustomerIds = useMemo(() => new Set(currentCustomers.map((customer) => customer.id)), [currentCustomers]);
  const customerOptions = useMemo(() => [...currentCustomers, ...availableCustomers], [currentCustomers, availableCustomers]);
  const selectedCustomers = useMemo(() => customerOptions.filter((customer) => selected.includes(customer.id)), [customerOptions, selected]);
  const filteredCustomers = useMemo(() => {
    const q = normalizeVietnameseSearch(search);
    return customerOptions.filter((customer) => {
      if (selected.includes(customer.id)) return false;
      const searchableText = normalizeVietnameseSearch(`${customer.ma_khach_hang} ${customer.ten_khach_hang} ${customer.so_dien_thoai ?? ""} ${customer.email ?? ""}`);
      return !q || searchableText.includes(q);
    }).slice(0, 8);
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
    <form onSubmit={submit} className="w-full min-w-0 space-y-4 md:space-y-6">
      <section className="space-y-4 rounded-xl border bg-white p-4">
        <div className="space-y-2"><Label htmlFor="ten-nhom">Tên nhóm khách hàng <span className="text-red-600">*</span></Label><Input id="ten-nhom" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Nhập tên nhóm" required /></div>
        <div className="space-y-4 border-t pt-4">
          <div><h3 className="font-medium text-slate-900">Khách hàng trong nhóm</h3><p className="mt-1 text-sm text-slate-500">{selectedCustomers.length} khách hàng</p></div>
          {group && !group.trang_thai && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nhóm đang ngừng hoạt động nên không thể thêm khách hàng mới. Bạn vẫn có thể bỏ khách hàng khỏi nhóm.</p>}
          <div className="relative">
            <Label htmlFor="group-customer-search" className="sr-only">Tìm khách hàng để thêm vào nhóm</Label>
            <Search aria-hidden="true" className="app-search-icon" />
            <Input
              id="group-customer-search"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              placeholder="Tìm mã, tên, số điện thoại hoặc email"
              className="app-search-input"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={searchOpen}
              aria-controls="group-customer-search-suggestions"
              autoComplete="off"
              disabled={Boolean(group && !group.trang_thai)}
            />
            {searchOpen && (
              <div id="group-customer-search-suggestions" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      toggleCustomer(customer.id);
                      setSearch("");
                      setSearchOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800">{customer.ten_khach_hang}</span>
                      <span className="block truncate text-xs text-slate-500">{customer.ma_khach_hang}{customer.so_dien_thoai ? ` · ${customer.so_dien_thoai}` : ""}{customer.email ? ` · ${customer.email}` : ""}</span>
                    </span>
                    <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="px-3 py-3 text-sm text-slate-500">
                    {customerOptions.length === 0 ? "Không còn khách hàng chưa thuộc nhóm." : "Không tìm thấy khách hàng phù hợp."}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3 md:hidden">
            {selectedCustomers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Chưa có khách hàng trong nhóm.</div>
            ) : selectedCustomers.map((customer) => <article key={customer.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900">{customer.ten_khach_hang}</p>
                  <p className="mt-1 text-sm text-slate-500">Mã KH: {customer.ma_khach_hang}</p>
                </div>
                <Button type="button" size="icon-sm" variant="outline" aria-label={`Bỏ khách hàng ${customer.ten_khach_hang} khỏi nhóm`} title="Bỏ khỏi nhóm" disabled={busy} className="shrink-0 border-red-200 text-red-700 hover:bg-red-50" onClick={() => toggleCustomer(customer.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 text-sm">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3"><span className="text-slate-500">Số điện thoại</span><span className="break-all text-right">{customer.so_dien_thoai || "—"}</span></div>
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3"><span className="text-slate-500">Email</span><span className="break-all text-right">{customer.email || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Trạng thái</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span></div>
              </div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="app-data-table w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Mã khách hàng</th><th className="px-4 py-3">Tên khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{selectedCustomers.map((customer) => <tr key={customer.id}><td className="px-4 py-3 font-medium text-slate-700">{customer.ma_khach_hang}</td><td className="px-4 py-3">{customer.ten_khach_hang}</td><td className="px-4 py-3">{customer.so_dien_thoai || "—"}</td><td className="px-4 py-3">{customer.email || "—"}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${customer.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td><td className="px-4 py-3 text-right"><Button type="button" size="icon-sm" variant="outline" aria-label={`Bỏ khách hàng ${customer.ten_khach_hang} khỏi nhóm`} title="Bỏ khỏi nhóm" disabled={busy} className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => toggleCustomer(customer.id)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}{selectedCustomers.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Chưa có khách hàng trong nhóm.</td></tr>}</tbody>
            </table>
          </div>
        </div>
      </section>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="app-form-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => router.push(returnHref)}>Hủy</Button><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Đang lưu..." : group ? "Lưu thay đổi" : "Tạo nhóm"}</Button></div>
    </form>
  );
}





