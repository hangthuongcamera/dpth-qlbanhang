"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, FileDown, Pencil, Plus, Printer, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderNotificationToast, notifyOrder } from "@/components/don-hang/order-notification-toast";
import {
  capNhatPhieuThuNhap, huyPhieuThu, phanBoSoDuPhieuThu,
  taoPhieuThu, xacNhanPhieuThu, xoaPhieuThuNhap,
} from "@/lib/supabase/phieu-thu-actions";
import type { PhanBoPhieuThuInput, PhieuThuInput } from "@/lib/supabase/phieu-thu-actions";
import { formatCurrency, formatNumber, parseCurrencyInput } from "@/types/don-hang";
import { normalizeVietnameseSearch } from "@/lib/search/normalize-vietnamese";
import { goiYPhieuThu, type ReceiptSearchSuggestion } from "@/lib/supabase/search-suggestions";

export type ReceiptAllocation = {
  id?: string; phieu_thu_id: string; don_hang_id: string; so_tien: number; ghi_chu?: string | null;
  order?: { ma_don_hang: string; ngay_dat: string; tong_tien: number };
};
export type Receipt = {
  id: string; ma_phieu_thu: string; khach_hang_id: string; ngay_thu: string; tong_tien: number;
  phuong_thuc_thanh_toan: string; tai_khoan_nhan: string | null; ma_tham_chieu: string | null;
  nguoi_nop: string | null; ghi_chu: string | null; trang_thai: string;
  customer?: { ma_khach_hang: string; ten_khach_hang: string }; allocations: ReceiptAllocation[];
};
export type ReceiptCustomer = { id: string; ma_khach_hang: string; ten_khach_hang: string; so_dien_thoai: string | null };
export type ReceiptOrder = {
  id: string; ma_don_hang: string; khach_hang_id: string; ngay_dat: string; tong_tien: number;
  trang_thai: string; da_thu: number; con_no: number;
};

const paymentLabels: Record<string, string> = {
  tien_mat: "Tiền mặt", chuyen_khoan: "Chuyển khoản", the: "Thẻ", vi_dien_tu: "Ví điện tử", khac: "Khác",
};
const statusLabels: Record<string, string> = { nhap: "Nháp", da_xac_nhan: "Đã xác nhận", da_huy: "Đã hủy" };
const normalizeSearch = normalizeVietnameseSearch;
function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function dateOnly(value: string) { return value ? new Date(value).toLocaleDateString("vi-VN") : "—"; }
function statusClass(status: string) {
  return status === "da_xac_nhan" ? "bg-emerald-50 text-emerald-700" : status === "da_huy" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700";
}

export function PhieuThuManager({ receipts, customers, orders, totalCount, page: initialPage, initialSearch, initialFromDate, initialToDate, initialStatus, initialMethod }: {
  receipts: Receipt[]; customers: ReceiptCustomer[]; orders: ReceiptOrder[]; totalCount: number; page: number;
  initialSearch: string; initialFromDate: string; initialToDate: string; initialStatus: string; initialMethod: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ReceiptSearchSuggestion[]>([]);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [methodFilter, setMethodFilter] = useState(initialMethod);
  const [page, setPage] = useState(initialPage);
  const [isComposingSearch, setIsComposingSearch] = useState(false);
  const [formReceipt, setFormReceipt] = useState<Receipt | null | undefined>(undefined);
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [cancelReceipt, setCancelReceipt] = useState<Receipt | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [working, setWorking] = useState(false);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  const [prevProps, setPrevProps] = useState({
    search: initialSearch,
    fromDate: initialFromDate,
    toDate: initialToDate,
    status: initialStatus,
    method: initialMethod,
    page: initialPage,
  });

  if (
    prevProps.search !== initialSearch ||
    prevProps.fromDate !== initialFromDate ||
    prevProps.toDate !== initialToDate ||
    prevProps.status !== initialStatus ||
    prevProps.method !== initialMethod ||
    prevProps.page !== initialPage
  ) {
    setPrevProps({
      search: initialSearch,
      fromDate: initialFromDate,
      toDate: initialToDate,
      status: initialStatus,
      method: initialMethod,
      page: initialPage,
    });
    setSearch(initialSearch);
    setFromDate(initialFromDate);
    setToDate(initialToDate);
    setStatusFilter(initialStatus);
    setMethodFilter(initialMethod);
    setPage(initialPage);
  }

  useEffect(() => {
    let active = true;
    const query = search.trim();
    const timeoutId = setTimeout(() => {
      if (!searchOpen) {
        if (active) setSuggestions([]);
        return;
      }
      void goiYPhieuThu(query).then((items) => { if (active) setSuggestions(items); });
    }, searchOpen && query.length > 0 ? 250 : 0);
    return () => { active = false; clearTimeout(timeoutId); };
  }, [search, searchOpen]);

  const navigateList = useCallback((nextPage: number, next: { search?: string; from?: string; to?: string; status?: string; method?: string } = {}, replace = false) => {
    const params = new URLSearchParams();
    const nextSearch = next.search ?? search;
    const nextFrom = next.from ?? fromDate;
    const nextTo = next.to ?? toDate;
    const nextStatus = next.status ?? statusFilter;
    const nextMethod = next.method ?? methodFilter;
    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextSearch) params.set("search", nextSearch);
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextMethod !== "all") params.set("method", nextMethod);
    const url = params.size ? `/phieu-thu?${params}` : "/phieu-thu";
    if (replace) router.replace(url); else router.push(url);
  }, [router, search, fromDate, toDate, statusFilter, methodFilter]);

  useEffect(() => {
    if (isComposingSearch || search === initialSearch) return;
    const timeoutId = setTimeout(() => navigateList(1, { search }, true), 400);
    return () => clearTimeout(timeoutId);
  }, [search, initialSearch, isComposingSearch, navigateList]);

  async function handleCancel() {
    if (!cancelReceipt) return;
    setWorking(true);
    try {
      await huyPhieuThu(cancelReceipt.id, cancelReason);
      notifyOrder({ type: "success", message: "Đã hủy phiếu thu " + cancelReceipt.ma_phieu_thu + "." });
      setCancelReceipt(null); setCancelReason(""); router.refresh();
    } catch (cause) {
      notifyOrder({ type: "error", message: cause instanceof Error ? cause.message : "Không thể hủy phiếu thu." });
    } finally { setWorking(false); }
  }
  async function handleDelete(receipt: Receipt) {
    if (!window.confirm("Xóa phiếu thu nháp " + receipt.ma_phieu_thu + "?")) return;
    setWorking(true);
    try {
      await xoaPhieuThuNhap(receipt.id);
      notifyOrder({ type: "success", message: "Đã xóa phiếu thu " + receipt.ma_phieu_thu + "." }); router.refresh();
    } catch (cause) {
      notifyOrder({ type: "error", message: cause instanceof Error ? cause.message : "Không thể xóa phiếu thu." });
    } finally { setWorking(false); }
  }

  return <div className="space-y-4 app-page">
    <OrderNotificationToast />
    <div className="app-list-actions">
      <Button onClick={() => setFormReceipt(null)}><Plus className="mr-2 h-4 w-4" />Lập phiếu thu</Button>
    </div>
    {formReceipt !== undefined && <ReceiptForm initial={formReceipt} customers={customers} orders={orders} onClose={() => setFormReceipt(undefined)} onSaved={() => { setFormReceipt(undefined); router.refresh(); }} />}

    <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[5fr_3.75fr_3.75fr_3.75fr_3.75fr] md:items-end">
        <div className="relative grid gap-1.5 text-sm font-medium text-slate-700">
        <label htmlFor="receipt-search">Tìm phiếu thu</label>
        <div className="relative">
          <Search className="app-search-icon" />
          <Input
            id="receipt-search"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}
            onCompositionStart={() => setIsComposingSearch(true)}
            onCompositionEnd={(event) => { setIsComposingSearch(false); setSearch(event.currentTarget.value); }}
            onChange={(event) => { setSearch(event.target.value); setPage(1); setSearchOpen(true); }}
            placeholder="Mã phiếu, khách hàng, mã tham chiếu"
            className="app-search-input app-search-input--clearable"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            aria-controls="receipt-search-suggestions"
            autoComplete="off"
          />
          {search && <button
            type="button"
            aria-label="Xóa tìm kiếm phiếu thu"
            title="Xóa tìm kiếm"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { setSearch(""); setPage(1); setSearchOpen(true); document.getElementById("receipt-search")?.focus(); }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          ><X className="h-4 w-4" /></button>}
          {searchOpen && <div id="receipt-search-suggestions" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {suggestions.map((receipt) => <button
              key={receipt.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { setSearch(receipt.ma_phieu_thu); setPage(1); setSearchOpen(false); navigateList(1, { search: receipt.ma_phieu_thu }, true); }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-normal hover:bg-slate-50"
            >
              <span className="min-w-0"><span className="block truncate font-medium text-slate-800">{receipt.ma_phieu_thu}</span><span className="block truncate text-xs text-slate-500">{receipt.ten_khach_hang ?? "—"} · {dateOnly(receipt.ngay_thu)}</span></span>
              <span className="shrink-0 text-right"><span className="block font-medium text-slate-700">{formatCurrency(Number(receipt.tong_tien))}</span><span className="text-xs text-slate-500">{statusLabels[receipt.trang_thai] ?? receipt.trang_thai}</span></span>
            </button>)}
            {suggestions.length === 0 && <p className="px-3 py-3 text-sm font-normal text-slate-500">Không tìm thấy phiếu thu phù hợp.</p>}
          </div>}
        </div>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Từ ngày<Input className="h-10" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); navigateList(1, { from: event.target.value }, true); }} /></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Đến ngày<Input className="h-10" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); navigateList(1, { to: event.target.value }, true); }} /></label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Trạng thái<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); navigateList(1, { status: event.target.value }, true); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal"><option value="all">Tất cả</option><option value="nhap">Nháp</option><option value="da_xac_nhan">Đã xác nhận</option><option value="da_huy">Đã hủy</option></select></label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Phương thức<select value={methodFilter} onChange={(event) => { setMethodFilter(event.target.value); setPage(1); navigateList(1, { method: event.target.value }, true); }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-normal"><option value="all">Tất cả</option>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </section>

    <section className="app-data-table-shell overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="app-data-table w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Mã phiếu thu</th><th className="px-4 py-3">Ngày thu</th><th className="px-4 py-3">Khách hàng</th><th className="px-4 py-3">Phương thức</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3 text-right">Chưa phân bổ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{receipts.map((receipt) => {
          const allocated = receipt.allocations.reduce((sum, item) => sum + Number(item.so_tien), 0);
          return <tr key={receipt.id}>
            <td className="px-4 py-3 font-medium text-slate-800">{receipt.ma_phieu_thu}</td><td className="px-4 py-3">{dateOnly(receipt.ngay_thu)}</td>
            <td className="px-4 py-3"><div className="font-medium">{receipt.customer?.ten_khach_hang ?? "—"}</div><div className="text-xs text-slate-500">{receipt.customer?.ma_khach_hang}</div></td>
            <td className="px-4 py-3">{paymentLabels[receipt.phuong_thuc_thanh_toan] ?? receipt.phuong_thuc_thanh_toan}</td>
            <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(receipt.tong_tien))}</td><td className="px-4 py-3 text-right">{formatCurrency(Math.max(0, Number(receipt.tong_tien) - allocated))}</td>
            <td className="px-4 py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-medium " + statusClass(receipt.trang_thai)}>{statusLabels[receipt.trang_thai] ?? receipt.trang_thai}</span></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1">
              <Button type="button" size="icon-sm" variant="outline" aria-label="Xem phiếu thu" title="Xem phiếu thu" onClick={() => setViewReceipt(receipt)}><Eye className="h-4 w-4" /></Button>
              {receipt.trang_thai === "nhap" && <Button type="button" size="icon-sm" variant="outline" aria-label="Sửa phiếu nháp" title="Sửa phiếu nháp" onClick={() => setFormReceipt(receipt)}><Pencil className="h-4 w-4" /></Button>}
              {receipt.trang_thai === "nhap" && <Button type="button" size="icon-sm" variant="outline" aria-label="Xóa phiếu nháp" title="Xóa phiếu nháp" disabled={working} onClick={() => void handleDelete(receipt)}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
              {receipt.trang_thai === "da_xac_nhan" && <Button type="button" size="icon-sm" variant="outline" aria-label="Hủy phiếu thu" title="Hủy phiếu thu" onClick={() => setCancelReceipt(receipt)}><RotateCcw className="h-4 w-4 text-red-600" /></Button>}
            </div></td>
          </tr>;
        })}{receipts.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Không có phiếu thu phù hợp.</td></tr>}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-slate-600"><span>{totalCount} phiếu thu · Trang {page} / {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="md" disabled={page <= 1} onClick={() => { const nextPage = page - 1; setPage(nextPage); navigateList(nextPage); }}>Trước</Button><Button variant="outline" size="md" disabled={page >= pageCount} onClick={() => { const nextPage = page + 1; setPage(nextPage); navigateList(nextPage); }}>Sau</Button></div></div>
    </section>

    <ReceiptDetailDialog receipt={viewReceipt} orders={orders} onClose={() => setViewReceipt(null)} />
    <Dialog open={Boolean(cancelReceipt)} onOpenChange={(open) => { if (!open && !working) { setCancelReceipt(null); setCancelReason(""); } }}>
      <DialogContent><DialogHeader><DialogTitle>Hủy phiếu thu</DialogTitle><DialogDescription>Phiếu đã xác nhận sẽ được đảo phân bổ và cập nhật công nợ. Vui lòng ghi lý do hủy.</DialogDescription></DialogHeader>
        <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Lý do hủy phiếu" />
        <DialogFooter><Button variant="outline" onClick={() => setCancelReceipt(null)} disabled={working}>Đóng</Button><Button variant="destructive" onClick={() => void handleCancel()} disabled={working || !cancelReason.trim()}>{working ? "Đang hủy..." : "Xác nhận hủy"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function ReceiptForm({ initial, customers, orders, onClose, onSaved }: {
  initial: Receipt | null; customers: ReceiptCustomer[]; orders: ReceiptOrder[]; onClose: () => void; onSaved: () => void;
}) {
  const [receiptId, setReceiptId] = useState(initial?.id ?? "");
  const [customerId, setCustomerId] = useState(initial?.khach_hang_id ?? "");
  const [customerSearch, setCustomerSearch] = useState(() => {
    const selected = customers.find((item) => item.id === initial?.khach_hang_id);
    return selected ? `${selected.ma_khach_hang} · ${selected.ten_khach_hang}` : "";
  });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [date, setDate] = useState(initial?.ngay_thu.slice(0, 10) ?? today());
  const [amount, setAmount] = useState(initial ? formatNumber(Number(initial.tong_tien)) : "");
  const [method, setMethod] = useState(initial?.phuong_thuc_thanh_toan ?? "tien_mat");
  const [account] = useState(initial?.tai_khoan_nhan ?? "");
  const [reference] = useState(initial?.ma_tham_chieu ?? "");
  const [payer] = useState(initial?.nguoi_nop ?? "");
  const [note, setNote] = useState(initial?.ghi_chu ?? "");
  const [allocations, setAllocations] = useState<Record<string, string>>(Object.fromEntries((initial?.allocations ?? []).map((item) => [item.don_hang_id, formatNumber(Number(item.so_tien))])));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const numericAmount = parseCurrencyInput(amount);
  const customer = customers.find((item) => item.id === customerId);
  const customerSuggestions = customers.filter((item) => {
    const query = normalizeSearch(customerSearch).replace(/[·,]/g, " ").replace(/\s+/g, " ").trim();
    return !query || normalizeSearch(`${item.ma_khach_hang} ${item.ten_khach_hang} ${item.so_dien_thoai ?? ""}`).includes(query);
  }).slice(0, 8);
  const customerOrders = orders.filter((order) => order.khach_hang_id === customerId && order.trang_thai !== "da_huy" && order.con_no > 0);
  const allocationItems: PhanBoPhieuThuInput[] = Object.entries(allocations).map(([don_hang_id, value]) => ({ don_hang_id, so_tien: parseCurrencyInput(value) })).filter((item) => item.so_tien > 0);
  const allocated = allocationItems.reduce((sum, item) => sum + item.so_tien, 0);
  const unallocated = Math.max(0, numericAmount - allocated);
  function inputData(): PhieuThuInput {
    return { khach_hang_id: customerId, ngay_thu: date, tong_tien: numericAmount, phuong_thuc_thanh_toan: method, tai_khoan_nhan: account, ma_tham_chieu: reference, nguoi_nop: payer, ghi_chu: note, phan_bo: allocationItems };
  }
  function autoAllocateFifo() {
    let left = numericAmount;
    const next: Record<string, string> = {};
    const fifo = [...customerOrders].sort((a, b) => a.ngay_dat.localeCompare(b.ngay_dat) || a.ma_don_hang.localeCompare(b.ma_don_hang));
    for (const order of fifo) {
      const part = Math.min(left, order.con_no);
      if (part > 0) next[order.id] = formatNumber(part);
      left -= part;
      if (left <= 0) break;
    }
    setAllocations(next);
  }
  async function saveDraft() {
    setError(""); setSaving(true);
    try {
      const data = inputData();
      if (initial && receiptId) await capNhatPhieuThuNhap(receiptId, data);
      else setReceiptId(await taoPhieuThu(data));
      notifyOrder({ type: "success", message: initial ? "Đã cập nhật phiếu thu nháp." : "Đã lưu phiếu thu nháp." });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu phiếu thu."); }
    finally { setSaving(false); }
  }
  async function confirmAndSave() {
    setError(""); setSaving(true);
    try {
      const data = inputData();
      let id = receiptId;
      if (id) await capNhatPhieuThuNhap(id, data);
      else { id = await taoPhieuThu(data); setReceiptId(id); }
      await xacNhanPhieuThu(id);
      notifyOrder({ type: "success", message: "Đã xác nhận phiếu thu và cập nhật công nợ." });
      setPreviewOpen(false); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xác nhận phiếu thu."); }
    finally { setSaving(false); }
  }

  return <>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{initial ? "Sửa phiếu nháp " + initial.ma_phieu_thu : "Lập phiếu thu"}</h2><p className="text-sm text-slate-500">Phiếu nháp chưa ảnh hưởng công nợ.</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng form"><X className="h-4 w-4" /></Button></div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
          <label htmlFor="receipt-customer-search">Khách hàng <span className="text-red-600">*</span></label>
          <div className="relative">
            <Search className="app-search-icon" />
            <Input
              id="receipt-customer-search"
              value={customerSearch}
              onFocus={() => setCustomerSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setCustomerSearchOpen(false), 150)}
              onKeyDown={(event) => { if (event.key === "Escape") setCustomerSearchOpen(false); }}
              onChange={(event) => { setCustomerSearch(event.target.value); setCustomerId(""); setAllocations({}); setCustomerSearchOpen(true); }}
              placeholder="Mã, tên hoặc số điện thoại"
              className="app-search-input app-search-input--clearable"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={customerSearchOpen}
              aria-controls="receipt-customer-suggestions"
              autoComplete="off"
            />
            {customerSearch && <button
              type="button"
              aria-label="Xóa tìm kiếm khách hàng"
              title="Xóa tìm kiếm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { setCustomerSearch(""); setCustomerId(""); setAllocations({}); setCustomerSearchOpen(true); document.getElementById("receipt-customer-search")?.focus(); }}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            ><X className="h-4 w-4" /></button>}
            {customerSearchOpen && <div id="receipt-customer-suggestions" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {customerSuggestions.map((item) => <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === customerId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { setCustomerId(item.id); setCustomerSearch(`${item.ma_khach_hang} · ${item.ten_khach_hang}`); setAllocations({}); setCustomerSearchOpen(false); }}
                className="flex w-full items-center px-3 py-2 text-left text-sm font-normal hover:bg-slate-50"
              ><span><span className="block font-medium text-slate-800">{item.ten_khach_hang}</span><span className="block text-xs text-slate-500">{item.ma_khach_hang}{item.so_dien_thoai ? ` · ${item.so_dien_thoai}` : ""}</span></span></button>)}
              {customerSuggestions.length === 0 && <p className="px-3 py-3 text-sm font-normal text-slate-500">Không tìm thấy khách hàng phù hợp.</p>}
            </div>}
          </div>
        </div>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700"><span>Ngày thu</span><Input className="h-10 w-full" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700"><span>Số tiền thu</span><Input className="h-10 w-full" inputMode="numeric" value={amount} onChange={(event) => setAmount(formatNumber(parseCurrencyInput(event.target.value)))} placeholder="Nhập số tiền" required /></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700"><span>Phương thức thanh toán</span><select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 md:col-span-2"><span>Ghi chú</span><Input className="h-10 w-full" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nội dung thu tiền" /></label>
      </div>
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium text-slate-900">Phân bổ vào đơn hàng</h3><p className="text-xs text-slate-500">Gợi ý phân bổ theo đơn cũ trước (FIFO). Tiền chưa phân bổ có thể dùng sau.</p></div><Button type="button" variant="outline" size="md" onClick={autoAllocateFifo} disabled={!customerId || numericAmount <= 0 || customerOrders.length === 0}>Phân bổ FIFO</Button></div>
        <div className="overflow-x-auto rounded-lg border"><table className="app-data-table w-full min-w-[620px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2">Đơn hàng</th><th className="px-3 py-2">Ngày đặt</th><th className="px-3 py-2 text-right">Còn nợ</th><th className="px-3 py-2 text-right">Phân bổ</th></tr></thead><tbody className="divide-y">
          {customerOrders.map((order) => <tr key={order.id}><td className="px-3 py-2 font-medium">{order.ma_don_hang}</td><td className="px-3 py-2">{dateOnly(order.ngay_dat)}</td><td className="px-3 py-2 text-right">{formatCurrency(order.con_no)}</td><td className="px-3 py-2"><Input inputMode="numeric" value={allocations[order.id] ?? ""} onChange={(event) => setAllocations((current) => ({ ...current, [order.id]: formatNumber(parseCurrencyInput(event.target.value)) }))} placeholder="0" className="ml-auto h-9 max-w-36 text-right" /></td></tr>)}
          {!customerId && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Chọn khách hàng để xem các đơn còn nợ.</td></tr>}
          {customerId && customerOrders.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Khách hàng không có đơn còn nợ.</td></tr>}
        </tbody></table></div>
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm"><span>Đã phân bổ: <strong>{formatCurrency(allocated)}</strong></span><span>Chưa phân bổ: <strong>{formatCurrency(unallocated)}</strong></span></div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={onClose}>Đóng</Button><Button type="button" variant="outline" disabled={saving || !customerId || numericAmount <= 0} onClick={() => void saveDraft()}>{saving ? "Đang lưu..." : "Lưu nháp"}</Button><Button type="button" disabled={saving || !customerId || numericAmount <= 0 || allocated > numericAmount} onClick={() => setPreviewOpen(true)}><Check className="mr-2 h-4 w-4" />Xem trước xác nhận</Button></div>
      </div>
    </section>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="md:max-w-lg">
      <DialogHeader><DialogTitle>Xem trước phiếu thu</DialogTitle><DialogDescription>Kiểm tra thông tin và phân bổ trước khi xác nhận lưu. Mã phiếu được cấp tự động khi lưu.</DialogDescription></DialogHeader>
      <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-3"><span>Khách hàng</span><strong className="text-right">{customer?.ma_khach_hang} · {customer?.ten_khach_hang}</strong></div><div className="flex justify-between"><span>Ngày thu</span><strong>{dateOnly(date)}</strong></div><div className="flex justify-between"><span>Phương thức</span><strong>{paymentLabels[method]}</strong></div><div className="flex justify-between"><span>Số tiền thu</span><strong>{formatCurrency(numericAmount)}</strong></div><div className="flex justify-between"><span>Đã phân bổ</span><strong>{formatCurrency(allocated)}</strong></div><div className="flex justify-between border-t pt-2"><span>Chưa phân bổ</span><strong>{formatCurrency(unallocated)}</strong></div>{allocationItems.map((item) => <div key={item.don_hang_id} className="flex justify-between text-xs text-slate-600"><span>{orders.find((order) => order.id === item.don_hang_id)?.ma_don_hang}</span><span>{formatCurrency(item.so_tien)}</span></div>)}</div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={saving}>Quay lại sửa</Button><Button onClick={() => void confirmAndSave()} disabled={saving}>{saving ? "Đang xác nhận..." : "Xác nhận và lưu phiếu"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

function ReceiptDetailDialog({ receipt, orders, onClose }: { receipt: Receipt | null; orders: ReceiptOrder[]; onClose: () => void }) {
  const [newAllocations, setNewAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  if (!receipt) return null;
  const allocated = receipt.allocations.reduce((sum, item) => sum + Number(item.so_tien), 0);
  const remaining = Math.max(0, Number(receipt.tong_tien) - allocated);
  const receiptId = receipt.id;
  const receiptCode = receipt.ma_phieu_thu;
  const eligibleOrders = orders.filter((order) => order.khach_hang_id === receipt.khach_hang_id && order.trang_thai !== "da_huy" && order.con_no > 0);
  const newItems = Object.entries(newAllocations).map(([don_hang_id, value]) => ({ don_hang_id, so_tien: parseCurrencyInput(value) })).filter((item) => item.so_tien > 0);
  async function assignRemaining() {
    setSaving(true);
    try { await phanBoSoDuPhieuThu(receiptId, newItems); notifyOrder({ type: "success", message: "Đã phân bổ thêm tiền từ phiếu " + receiptCode + "." }); setNewAllocations({}); onClose(); }
    catch (cause) { notifyOrder({ type: "error", message: cause instanceof Error ? cause.message : "Không thể phân bổ số dư." }); }
    finally { setSaving(false); }
  }
  return <Dialog open={Boolean(receipt)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-3xl">
    <DialogHeader><DialogTitle>Phiếu thu {receipt.ma_phieu_thu}</DialogTitle><DialogDescription>Chi tiết khoản thu, trạng thái và các đơn hàng được phân bổ.</DialogDescription></DialogHeader>
    <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
      <p><span className="text-slate-500">Khách hàng:</span> <strong>{receipt.customer?.ma_khach_hang} · {receipt.customer?.ten_khach_hang}</strong></p><p><span className="text-slate-500">Ngày thu:</span> <strong>{dateOnly(receipt.ngay_thu)}</strong></p>
      <p><span className="text-slate-500">Số tiền:</span> <strong>{formatCurrency(Number(receipt.tong_tien))}</strong></p><p><span className="text-slate-500">Phương thức:</span> <strong>{paymentLabels[receipt.phuong_thuc_thanh_toan] ?? receipt.phuong_thuc_thanh_toan}</strong></p>
      <p><span className="text-slate-500">Tài khoản nhận:</span> {receipt.tai_khoan_nhan || "—"}</p><p><span className="text-slate-500">Mã tham chiếu:</span> {receipt.ma_tham_chieu || "—"}</p>
      <p><span className="text-slate-500">Người nộp:</span> {receipt.nguoi_nop || "—"}</p><p><span className="text-slate-500">Trạng thái:</span> <strong>{statusLabels[receipt.trang_thai] ?? receipt.trang_thai}</strong></p>
      {receipt.ghi_chu && <p className="md:col-span-2"><span className="text-slate-500">Ghi chú:</span> {receipt.ghi_chu}</p>}
    </div>
    <div className="overflow-x-auto rounded-lg border"><table className="app-data-table w-full min-w-[520px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2">Đơn hàng</th><th className="px-3 py-2">Ngày đặt</th><th className="px-3 py-2 text-right">Số tiền phân bổ</th></tr></thead><tbody className="divide-y">
      {receipt.allocations.map((item, index) => <tr key={item.id ?? item.don_hang_id + "-" + index}><td className="px-3 py-2 font-medium">{item.order?.ma_don_hang ?? item.don_hang_id}</td><td className="px-3 py-2">{dateOnly(item.order?.ngay_dat ?? "")}</td><td className="px-3 py-2 text-right">{formatCurrency(Number(item.so_tien))}</td></tr>)}
      {receipt.allocations.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">Phiếu thu chưa phân bổ vào đơn hàng.</td></tr>}
    </tbody></table></div>
    <div className="flex justify-end gap-4 text-sm md:gap-6"><span>Đã phân bổ: <strong>{formatCurrency(allocated)}</strong></span><span>Chưa phân bổ: <strong>{formatCurrency(remaining)}</strong></span></div>
    {receipt.trang_thai === "da_xac_nhan" && remaining > 0 && eligibleOrders.length > 0 && <section className="space-y-2 rounded-lg border p-3"><h3 className="font-medium">Phân bổ số dư vào đơn</h3>
      {eligibleOrders.map((order) => <label key={order.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm"><span>{order.ma_don_hang}<small className="ml-2 text-slate-500">Còn {formatCurrency(order.con_no)}</small></span><Input inputMode="numeric" value={newAllocations[order.id] ?? ""} onChange={(event) => setNewAllocations((current) => ({ ...current, [order.id]: formatNumber(parseCurrencyInput(event.target.value)) }))} placeholder="0" className="h-9 w-32 text-right" /><span className="text-xs text-slate-500">₫</span></label>)}
      <div className="flex justify-end"><Button size="md" disabled={saving || newItems.length === 0 || newItems.reduce((sum, item) => sum + item.so_tien, 0) > remaining} onClick={() => void assignRemaining()}>{saving ? "Đang lưu..." : "Lưu phân bổ"}</Button></div>
    </section>}
    <div className="flex justify-end gap-2"><ReceiptPrintButton receipt={receipt} /><Button variant="outline" onClick={onClose}>Đóng</Button></div>
  </DialogContent></Dialog>;
}

function ReceiptPrintButton({ receipt }: { receipt: Receipt }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"a4" | "k80">("a4");
  function print(nextFormat: "a4" | "k80") {
    setFormat(nextFormat);
    window.setTimeout(() => window.print(), 100);
  }
  const allocated = receipt.allocations.reduce((sum, item) => sum + Number(item.so_tien), 0);
  const unallocated = Math.max(0, Number(receipt.tong_tien) - allocated);
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}><Printer className="mr-2 h-4 w-4" />In phiếu</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="md:max-w-md"><DialogHeader><DialogTitle>In phiếu thu</DialogTitle><DialogDescription>Chọn khổ in. Với mẫu A4, có thể lưu thành PDF trong hộp thoại in.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => print("a4")}><FileDown className="mr-2 h-4 w-4" />PDF · A4</Button><Button variant="outline" onClick={() => print("k80")}><Printer className="mr-2 h-4 w-4" />Máy in K80</Button></div><Button variant="ghost" onClick={() => setOpen(false)}>Đóng</Button></DialogContent></Dialog>
    <article className="receipt-print-root" data-format={format}><div className={"print-paper " + (format === "k80" ? "print-k80" : "print-invoice")}>
      <div className="print-center"><h1>ĐỒNG PHỤC THANH HẰNG</h1><p>Hotline / Zalo: 0933.657.622</p><h2>PHIẾU THU</h2></div><div className="print-separator" />
      <p><strong>Mã phiếu:</strong> {receipt.ma_phieu_thu}</p><p><strong>Ngày thu:</strong> {dateOnly(receipt.ngay_thu)}</p>
      <p><strong>Khách hàng:</strong> {receipt.customer?.ten_khach_hang ?? "—"} ({receipt.customer?.ma_khach_hang ?? "—"})</p><p><strong>Người nộp:</strong> {receipt.nguoi_nop || "—"}</p>
      <p><strong>Phương thức:</strong> {paymentLabels[receipt.phuong_thuc_thanh_toan] ?? receipt.phuong_thuc_thanh_toan}</p>
      {receipt.tai_khoan_nhan && <p><strong>Tài khoản nhận:</strong> {receipt.tai_khoan_nhan}</p>}{receipt.ma_tham_chieu && <p><strong>Mã tham chiếu:</strong> {receipt.ma_tham_chieu}</p>}
      <div className="print-separator" /><p className="print-row print-total"><span>Số tiền đã thu</span><span>{formatCurrency(Number(receipt.tong_tien))}</span></p>
      <p className="print-row"><span>Đã phân bổ</span><span>{formatCurrency(allocated)}</span></p><p className="print-row"><span>Chưa phân bổ</span><span>{formatCurrency(unallocated)}</span></p>
      {receipt.allocations.map((item, index) => <p className="print-row" key={item.id ?? index}><span>{item.order?.ma_don_hang ?? item.don_hang_id}</span><span>{formatCurrency(Number(item.so_tien))}</span></p>)}
      {receipt.ghi_chu && <p className="print-note">Ghi chú: {receipt.ghi_chu}</p>}<div className="print-signatures"><div>Người lập phiếu</div><div>Người nộp tiền</div></div><p className="print-center">Xin cảm ơn quý khách!</p>
    </div></article>
  </>;
}








