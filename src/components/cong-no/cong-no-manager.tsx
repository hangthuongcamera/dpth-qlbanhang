"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Users, Wallet } from "lucide-react";
import { CongNoLedger, type DebtLedgerCustomer, type DebtTransaction } from "@/components/cong-no/cong-no-ledger";

export type CongNoCustomer = {
  id: string; ma_khach_hang: string; ten_khach_hang: string; so_dien_thoai: string;
  cong_no_hien_tai: number; han_muc_cong_no: number; han_muc_cong_no_con_lai: number;
};

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const alertLevel = (customer: CongNoCustomer) => customer.han_muc_cong_no <= 0 ? "over" : customer.cong_no_hien_tai >= customer.han_muc_cong_no ? "over" : customer.cong_no_hien_tai / customer.han_muc_cong_no >= 0.9 ? "warning" : "normal";

export function CongNoManager({ customers, transactionsByCustomer }: { customers: CongNoCustomer[]; transactionsByCustomer: Record<string, DebtTransaction[]> }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<CongNoCustomer | null>(null);
  const filtered = useMemo(() => { const q = fold(search.trim()); return customers.filter((c) => !q || fold(`${c.ma_khach_hang} ${c.ten_khach_hang} ${c.so_dien_thoai}`).includes(q)); }, [customers, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalDebt = customers.reduce((sum, c) => sum + c.cong_no_hien_tai, 0);
  const attention = customers.filter((c) => alertLevel(c) !== "normal").length;
  if (selected) {
    const detailCustomer: DebtLedgerCustomer = { ma_khach_hang: selected.ma_khach_hang, ten_khach_hang: selected.ten_khach_hang, so_dien_thoai: selected.so_dien_thoai, han_muc_cong_no: selected.han_muc_cong_no, cong_no_hien_tai: selected.cong_no_hien_tai, han_muc_cong_no_con_lai: selected.han_muc_cong_no_con_lai };
    return <section className="space-y-5"><button onClick={() => setSelected(null)} className="text-sm text-slate-600 hover:text-primary">← Quay lại danh sách công nợ</button><header><p className="text-sm text-slate-500">{selected.ten_khach_hang} · {selected.ma_khach_hang}{selected.so_dien_thoai ? ` · ${selected.so_dien_thoai}` : ""}</p></header><CongNoLedger customer={detailCustomer} transactions={transactionsByCustomer[selected.id] ?? []}/></section>;
  }
  const badge = (customer: CongNoCustomer) => {
    const level = alertLevel(customer);
    return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${level === "over" ? "bg-red-50 text-red-700" : level === "warning" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{level !== "normal" && <AlertTriangle className="h-3.5 w-3.5" />}{level === "over" ? "Vượt hạn mức" : level === "warning" ? "Từ 90% hạn mức" : "Trong hạn mức"}</span>;
  };
  return <section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><Wallet className="h-4 w-4"/>Tổng dư nợ</div><p className="mt-2 text-xl font-semibold">{money(totalDebt)}</p></div>
      <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><Users className="h-4 w-4"/>Khách hàng đang nợ</div><p className="mt-2 text-xl font-semibold">{customers.length}</p></div>
      <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-sm text-slate-500"><AlertTriangle className="h-4 w-4"/>Chạm hoặc vượt ngưỡng cảnh báo</div><p className="mt-2 text-xl font-semibold">{attention}</p></div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full sm:max-w-md"><Search className="app-search-icon"/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo mã, tên hoặc số điện thoại" className="app-search-input"/></label>
      <p className="text-sm text-slate-500">{filtered.length} khách hàng đang nợ</p>
    </div>
    <div className="app-data-table-shell hidden overflow-hidden rounded-xl border bg-white md:block"><table className="app-data-table w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3 text-right">Dư nợ</th><th className="px-4 py-3 text-right">Hạn mức</th><th className="px-4 py-3 text-right">Còn lại</th><th className="px-4 py-3">Cảnh báo</th></tr></thead><tbody className="divide-y">{shown.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(c)}><td className="px-4 py-3"><button className="text-left font-medium text-slate-800 hover:text-primary">{c.ten_khach_hang}</button><div className="text-xs text-slate-500">{c.ma_khach_hang}</div></td><td className="px-4 py-3">{c.so_dien_thoai || "—"}</td><td className="px-4 py-3 text-right font-semibold">{money(c.cong_no_hien_tai)}</td><td className="px-4 py-3 text-right">{money(c.han_muc_cong_no)}</td><td className="px-4 py-3 text-right">{money(c.han_muc_cong_no_con_lai)}</td><td className="px-4 py-3">{badge(c)}</td></tr>)}{shown.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">{search ? "Không tìm thấy khách hàng phù hợp." : "Hiện không có khách hàng đang nợ."}</td></tr>}</tbody></table></div>
    <div className="space-y-3 md:hidden">{shown.map((c) => <button onClick={() => setSelected(c)} key={c.id} className="block w-full rounded-xl border bg-white p-4 text-left"><div className="flex justify-between gap-2"><div><p className="font-medium">{c.ten_khach_hang}</p><p className="text-xs text-slate-500">{c.ma_khach_hang} · {c.so_dien_thoai || "Chưa có SĐT"}</p></div>{badge(c)}</div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span className="text-slate-500">Dư nợ</span><b className="text-right">{money(c.cong_no_hien_tai)}</b><span className="text-slate-500">Hạn mức</span><span className="text-right">{money(c.han_muc_cong_no)}</span><span className="text-slate-500">Còn lại</span><span className="text-right">{money(c.han_muc_cong_no_con_lai)}</span></div></button>)}{shown.length === 0 && <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">{search ? "Không tìm thấy khách hàng phù hợp." : "Hiện không có khách hàng đang nợ."}</div>}</div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 text-sm text-slate-500">Số dòng<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-9 rounded-md border bg-white px-2 text-slate-700"><option>10</option><option>20</option><option>50</option><option>100</option></select></label><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Trang {page} / {pages}</span><div className="flex gap-1"><button aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/></button><button aria-label="Trang sau" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4"/></button></div></div></div>
  </section>;
}






