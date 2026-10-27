"use client";

/* eslint-disable @next/next/no-img-element -- External VietQR artwork must render at print size without Next image optimization. */

import { useState } from "react";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/types/don-hang";
import type { CuaHangSettings } from "@/lib/cua-hang-settings";

type PrintFormat = "k80" | "a4" | "a5";
type PrintOrder = { ma_don_hang: string; ngay_dat: string; han_giao: string | null; giao_hang: boolean; so_dien_thoai_giao_hang: string | null; dia_chi_giao_hang: string | null; tam_tinh: number; giam_gia: number; phi_van_chuyen: number; tong_tien: number; loai_don_hang: "dat_hang" | "ban_nhanh" };
type PrintCustomer = { ten_khach_hang: string; ma_khach_hang: string; so_dien_thoai: string | null; dia_chi: string | null };
type PrintLine = { ten_san_pham: string; ma_san_pham: string; thuoc_tinh: string; ma_sku: string | null; don_vi_tinh: string; so_luong: number; don_gia: number; thanh_tien: number };


export function OrderPrintDialog({ order, customer, lines, paidAmount, remainingAmount, settings }: {
  order: PrintOrder;
  customer: PrintCustomer;
  lines: PrintLine[];
  paidAmount: number;
  remainingAmount: number;
  settings: CuaHangSettings;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<PrintFormat>(order.loai_don_hang === "ban_nhanh" ? "k80" : "a4");
  const [printedAt, setPrintedAt] = useState("");
  const deliveryPhone = order.giao_hang ? order.so_dien_thoai_giao_hang : customer.so_dien_thoai;
  const deliveryAddress = order.giao_hang ? order.dia_chi_giao_hang : order.loai_don_hang === "ban_nhanh" ? null : order.dia_chi_giao_hang || customer.dia_chi;

  const qrUrl = "https://img.vietqr.io/image/" + settings.ma_ngan_hang + "-" + settings.so_tai_khoan + "-compact2.png?amount=" + Math.round(remainingAmount) + "&addInfo=" + encodeURIComponent(order.ma_don_hang) + "&accountName=" + encodeURIComponent(settings.ten_chu_tai_khoan);
  const pageFormat = format === "k80" ? "k80" : format;

  function printNow() {
    flushSync(() => setPrintedAt(new Date().toLocaleString("vi-VN")));
    window.print();
  }

  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}><Printer className="mr-2 h-4 w-4" />In hóa đơn</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>In đơn hàng {order.ma_don_hang}</DialogTitle>
          <DialogDescription>Chọn mẫu in phù hợp với thiết bị và giấy in.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Chọn mẫu in">
          {([ ["k80", "Bill K80"], ["a4", "Phiếu A4"], ["a5", "Phiếu A5"] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={format === value} onClick={() => setFormat(value)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${format === value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 hover:bg-slate-50"}`}>{label}</button>)}
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {format === "k80" ? "Bill nhiệt 80 mm, phù hợp bán nhanh tại quầy." : `Phiếu đặt hàng và giao nhận khổ ${format.toUpperCase()}, có quy cách hàng và khu vực ký nhận.`}
        </div>
        <div className="flex justify-end"><Button type="button" onClick={printNow}><Printer className="mr-2 h-4 w-4" />In ngay</Button></div>
      </DialogContent>
    </Dialog>

    <div className="order-print-root" data-format={pageFormat} aria-hidden="true">
      {format === "k80" ? <article className="print-paper print-k80">
        <header className="print-center"><h1>{settings.ten_cua_hang}</h1><p>Hotline / Zalo: {settings.hotline}</p>{settings.dia_chi && <p>{settings.dia_chi}</p>}<p>HÓA ĐƠN BÁN HÀNG</p></header>
        <div className="print-separator" />
        <p><strong>Mã đơn:</strong> {order.ma_don_hang}</p><p><strong>Ngày in:</strong> {printedAt || order.ngay_dat}</p><p><strong>Khách hàng:</strong> {customer.ten_khach_hang}</p><p><strong>SĐT:</strong> {deliveryPhone || "—"}</p>
        <div className="print-separator" />
        {lines.map((line, index) => <div key={`${line.ma_san_pham}-${line.ma_sku ?? index}`} className="print-receipt-line"><strong>{line.ten_san_pham}{line.thuoc_tinh ? ` · ${line.thuoc_tinh}` : ""}</strong><p>{line.so_luong} {line.don_vi_tinh} × {formatCurrency(line.don_gia)}</p><p className="print-right">{formatCurrency(line.thanh_tien)}</p></div>)}
        <div className="print-separator" />
        <p className="print-row"><span>Tạm tính</span><span>{formatCurrency(order.tam_tinh)}</span></p>
        <p className="print-row"><span>Giảm giá</span><span>−{formatCurrency(order.giam_gia)}</span></p>
        <p className="print-row"><span>Phí giao hàng</span><span>{formatCurrency(order.phi_van_chuyen)}</span></p>
        <p className="print-row print-total"><span>Tổng tiền</span><span>{formatCurrency(order.tong_tien)}</span></p>
        <p className="print-row"><span>Đã thanh toán</span><span>{formatCurrency(paidAmount)}</span></p>
        <p className="print-row"><span>Còn phải thu</span><span>{formatCurrency(remainingAmount)}</span></p>
        <div className="print-separator" />
        {remainingAmount > 0 ? <div className="print-center"><img className="print-qr" src={qrUrl} alt="Mã VietQR thanh toán số tiền còn nợ" /><p>Quét mã để thanh toán phần còn lại</p><p>{settings.ten_ngan_hang} · {settings.so_tai_khoan}</p><p>{settings.ten_chu_tai_khoan}</p></div> : <p className="print-center print-paid">ĐÃ THANH TOÁN ĐỦ</p>}
        <p className="print-center">Cảm ơn Quý khách và hẹn gặp lại!</p>
      </article> : <article className="print-paper print-invoice">
        <header className="print-center"><h1>PHIẾU ĐẶT HÀNG &amp; GIAO NHẬN ĐỒNG PHỤC</h1></header>
        <div className="print-columns">
          <section><h2>ĐƠN VỊ CUNG CẤP</h2><p><strong>{settings.ten_cua_hang}</strong></p><p>Hotline / Zalo: {settings.hotline}</p>{settings.dia_chi && <p>Địa chỉ: {settings.dia_chi}</p>}</section>
          <section><h2>THÔNG TIN KHÁCH HÀNG</h2><p><strong>{customer.ten_khach_hang}</strong> · {customer.ma_khach_hang}</p><p>SĐT: {deliveryPhone || "—"}</p><p>Địa chỉ nhận: {deliveryAddress || "—"}</p><p>Mã đơn: {order.ma_don_hang}</p><p>Ngày đặt: {order.ngay_dat}</p><p>Hạn giao: {order.han_giao || "—"}</p></section>
        </div>
        <table className="print-table"><thead><tr><th>STT</th><th>Sản phẩm &amp; quy cách</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.ma_san_pham}-${line.ma_sku ?? index}`}><td>{index + 1}</td><td><strong>{line.ten_san_pham}</strong><div>{line.ma_san_pham}{line.thuoc_tinh ? ` · ${line.thuoc_tinh}` : ""}{line.ma_sku ? ` · SKU ${line.ma_sku}` : ""}</div></td><td>{line.don_vi_tinh || "—"}</td><td>{line.so_luong}</td><td>{formatCurrency(line.don_gia)}</td><td>{formatCurrency(line.thanh_tien)}</td></tr>)}</tbody></table>
        <div className="print-payment-summary"><div>
          <p className="print-row"><span>Tổng tiền hàng</span><span>{formatCurrency(order.tam_tinh)}</span></p><p className="print-row"><span>Giảm giá</span><span>−{formatCurrency(order.giam_gia)}</span></p><p className="print-row"><span>Phí giao hàng</span><span>{formatCurrency(order.phi_van_chuyen)}</span></p><p className="print-row print-total"><span>Tổng tiền đơn hàng</span><span>{formatCurrency(order.tong_tien)}</span></p><p className="print-row"><span>Đã thanh toán / tiền cọc</span><span>{formatCurrency(paidAmount)}</span></p><p className="print-row print-total"><span>Cần thu khi giao hàng</span><span>{formatCurrency(remainingAmount)}</span></p>
        </div>{remainingAmount > 0 && <div className="print-center"><img className="print-qr" src={qrUrl} alt="Mã VietQR thanh toán số tiền còn nợ" /><p>{settings.ten_ngan_hang} · {settings.so_tai_khoan}</p><p>{settings.ten_chu_tai_khoan}</p></div>}</div>
        <p className="print-note">{settings.loi_nhan_chan_phieu}</p>
        <div className="print-signatures"><div>Người lập phiếu</div><div>Người giao hàng</div><div>Người nhận hàng</div></div>
        {remainingAmount === 0 && <p className="print-center print-paid">ĐÃ THANH TOÁN ĐỦ</p>}
      </article>}
    </div>
  </>;
}


