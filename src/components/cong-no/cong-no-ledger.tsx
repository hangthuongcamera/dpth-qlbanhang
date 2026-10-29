"use client";

import { formatCurrency } from "@/types/don-hang";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";

export type DebtTransaction = { id: string; ngay_giao_dich: string; created_at: string; ma_tham_chieu: string; loai_giao_dich: string; so_tien: number; ghi_chu: string };
export type DebtLedgerCustomer = { ma_khach_hang: string; ten_khach_hang: string; so_dien_thoai: string; han_muc_cong_no: number; cong_no_hien_tai: number; han_muc_cong_no_con_lai: number };

const dateInput = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dateLabel = (v: string) => v ? new Date(`${v.slice(0,10)}T00:00:00`).toLocaleDateString("vi-VN") : "—";
const transactionDay = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const transactionLabel = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const typeLabel = (value: string) => value === "huy_phieu_thu" ? "Đảo giao dịch khi hủy phiếu thu" : value;

export function CongNoLedger({ customer, transactions }: { customer: DebtLedgerCustomer; transactions: DebtTransaction[] }) {
  const today = new Date();
  const [from, setFrom] = useState(dateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateInput(today));
  const [page, setPage] = useState(1);
  const ordered = useMemo(() => [...transactions].sort((a,b) => a.ngay_giao_dich.localeCompare(b.ngay_giao_dich) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)), [transactions]);
  const period = ordered.filter((t) => transactionDay(t.ngay_giao_dich) >= from && transactionDay(t.ngay_giao_dich) <= to);
  const opening = ordered.filter((t) => transactionDay(t.ngay_giao_dich) < from).reduce((sum,t) => sum + t.so_tien, 0);
  const closing = opening + period.reduce((sum,t) => sum + t.so_tien, 0);
  const ledgerBalance = ordered.reduce((sum, t) => sum + t.so_tien, 0);
  const balanceMatches = Math.abs(ledgerBalance - customer.cong_no_hien_tai) < 0.01;
  const lines = period.reduce<(DebtTransaction & { balance: number })[]>((acc, t) => {
    const previousBalance = acc.length ? acc[acc.length - 1].balance : opening;
    acc.push({ ...t, balance: previousBalance + t.so_tien });
    return acc;
  }, []);
  const pageSize = 20;
  const visible = lines.slice((page-1)*pageSize, page*pageSize);
  const pages = Math.max(1, Math.ceil(lines.length/pageSize));
  const exportExcel = () => {
    const data = [["SỔ ĐỐI SOÁT CÔNG NỢ"],["Khách hàng",customer.ten_khach_hang,"Mã",customer.ma_khach_hang],["Kỳ đối soát",dateLabel(from),"đến",dateLabel(to)],["Dư đầu kỳ",opening],["Ngày giao dịch","Mã đơn/phiếu thu","Loại phát sinh","Tăng nợ","Giảm nợ","Dư nợ sau giao dịch","Ghi chú"],...lines.map(t=>[transactionLabel(t.ngay_giao_dich),t.ma_tham_chieu,typeLabel(t.loai_giao_dich),t.so_tien>0?t.so_tien:"",t.so_tien<0?Math.abs(t.so_tien):"",t.balance,t.ghi_chu]),["Dư cuối kỳ",closing]];
    const esc=(v: unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="So cong no"><Table>${data.map(row=>`<Row>${row.map(cell=>`<Cell><Data ss:Type="${typeof cell==="number"?"Number":"String"}">${esc(cell)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
    const url=URL.createObjectURL(new Blob(["\ufeff",xml],{type:"application/vnd.ms-excel;charset=utf-8"})); const a=document.createElement("a"); a.href=url; a.download=`so-cong-no-${customer.ma_khach_hang}-${from}-${to}.xls`; a.click(); URL.revokeObjectURL(url);
  };
  return <>
    <div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl border bg-white p-3"><p className="text-sm text-slate-500">Dư nợ hiện tại</p><p className="mt-2 text-xl font-semibold">{formatCurrency(customer.cong_no_hien_tai)}</p></div><div className="rounded-xl border bg-white p-3"><p className="text-sm text-slate-500">Hạn mức công nợ</p><p className="mt-2 text-xl font-semibold">{formatCurrency(customer.han_muc_cong_no)}</p></div><div className="rounded-xl border bg-white p-3"><p className="text-sm text-slate-500">Hạn mức còn lại</p><p className="mt-2 text-xl font-semibold">{formatCurrency(customer.han_muc_cong_no_con_lai)}</p></div></div>
    <div className={`rounded-lg border px-4 py-3 text-sm ${balanceMatches ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      {balanceMatches ? <>Đã đối chiếu: tổng phát sinh trong sổ ({formatCurrency(ledgerBalance)}) khớp dư nợ trên bảng tổng hợp.</> : <>Chưa khớp dữ liệu: tổng phát sinh trong sổ là {formatCurrency(ledgerBalance)}, còn dư nợ trên bảng tổng hợp là {formatCurrency(customer.cong_no_hien_tai)} (lệch {formatCurrency(ledgerBalance - customer.cong_no_hien_tai)}).</>}
    </div>
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row md:items-end md:justify-between"><div className="flex flex-wrap items-end gap-3"><label className="text-sm text-slate-600">Từ ngày<input type="date" value={from} max={to} onChange={e=>{setFrom(e.target.value);setPage(1)}} className="mt-1 block h-10 rounded-md border px-3"/></label><label className="text-sm text-slate-600">Đến ngày<input type="date" value={to} min={from} onChange={e=>{setTo(e.target.value);setPage(1)}} className="mt-1 block h-10 rounded-md border px-3"/></label><p className="text-sm">Dư đầu kỳ: <b>{formatCurrency(opening)}</b><br/>Dư cuối kỳ: <b>{formatCurrency(closing)}</b></p></div><div className="flex gap-2"><button onClick={exportExcel} className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><Download className="h-4 w-4"/>Xuất Excel</button><button onClick={()=>window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm text-white"><Printer className="h-4 w-4"/>In / PDF A4</button></div></div>
    <div className="app-data-table-shell overflow-x-auto rounded-xl border bg-white"><table className="app-data-table w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Mã đơn / phiếu thu</th><th className="px-4 py-3">Loại phát sinh</th><th className="px-4 py-3 text-right">Tăng nợ</th><th className="px-4 py-3 text-right">Giảm nợ</th><th className="px-4 py-3 text-right">Dư nợ sau giao dịch</th><th className="px-4 py-3">Ghi chú</th></tr></thead><tbody className="divide-y">{visible.map(t=><tr key={t.id}><td className="whitespace-nowrap px-4 py-3">{transactionLabel(t.ngay_giao_dich)}</td><td className="px-4 py-3 font-medium">{t.ma_tham_chieu}</td><td className="px-4 py-3">{typeLabel(t.loai_giao_dich)}</td><td className="px-4 py-3 text-right">{t.so_tien>0?formatCurrency(t.so_tien):"—"}</td><td className="px-4 py-3 text-right">{t.so_tien<0?formatCurrency(Math.abs(t.so_tien)):"—"}</td><td className="px-4 py-3 text-right font-medium">{formatCurrency(t.balance)}</td><td className="px-4 py-3">{t.ghi_chu||"—"}</td></tr>)}{!visible.length&&<tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Không có giao dịch trong kỳ đối soát.</td></tr>}</tbody></table></div>
    {lines.length>pageSize&&<div className="flex justify-end gap-3 text-sm"><button disabled={page<=1} onClick={()=>setPage(page-1)} className="rounded border px-3 py-2 disabled:opacity-40">Trước</button><span className="py-2">Trang {page}/{pages}</span><button disabled={page>=pages} onClick={()=>setPage(page+1)} className="rounded border px-3 py-2 disabled:opacity-40">Sau</button></div>}
    <article className="debt-statement-print-root" data-format="a4"><h1>SỔ ĐỐI SOÁT CÔNG NỢ</h1><p><b>Khách hàng:</b> {customer.ten_khach_hang} ({customer.ma_khach_hang})</p><p><b>Số điện thoại:</b> {customer.so_dien_thoai||"—"}</p><p><b>Kỳ đối soát:</b> {dateLabel(from)} – {dateLabel(to)}</p><p><b>Dư đầu kỳ:</b> {formatCurrency(opening)}</p><table className="app-data-table"><thead><tr><th>Ngày</th><th>Mã đơn/phiếu thu</th><th>Loại phát sinh</th><th>Tăng nợ</th><th>Giảm nợ</th><th>Dư nợ sau giao dịch</th></tr></thead><tbody>{lines.map(t=><tr key={t.id}><td>{transactionLabel(t.ngay_giao_dich)}</td><td>{t.ma_tham_chieu}</td><td>{typeLabel(t.loai_giao_dich)}</td><td>{t.so_tien>0?formatCurrency(t.so_tien):"—"}</td><td>{t.so_tien<0?formatCurrency(Math.abs(t.so_tien)):"—"}</td><td>{formatCurrency(t.balance)}</td></tr>)}</tbody></table><p className="debt-print-closing"><b>Dư cuối kỳ:</b> {formatCurrency(closing)}</p></article>
  </>;
}






