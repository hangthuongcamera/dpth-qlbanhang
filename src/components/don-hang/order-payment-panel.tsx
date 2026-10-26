"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { thuTienDonHang } from "@/lib/supabase/don-hang-actions";
import { notifyOrder } from "@/components/don-hang/order-notification-toast";
import { formatCurrency, formatNumber, parseCurrencyInput } from "@/types/don-hang";

export function OrderPaymentPanel({ orderId, orderCode, customerName, remaining, orderType }: { orderId: string; orderCode: string; customerName: string; remaining: number; orderType: "dat_hang" | "ban_nhanh" }) {
  const router = useRouter();
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState("tien_mat");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewOpen(true);
  }

  async function confirmPayment() {
    setSaving(true);
    try {
      const left = await thuTienDonHang({ don_hang_id: orderId, so_tien: amount, phuong_thuc_thanh_toan: method });
      const msg = left === 0 ? "Đã thu đủ tiền. Đơn hàng được chuyển sang Hoàn thành." : "Đã ghi nhận khoản thu. Còn nợ " + formatCurrency(left) + ".";
      notifyOrder({ type: "success", message: msg });
      setPreviewOpen(false);
      router.refresh();
    } catch (cause) {
      const err = cause instanceof Error ? cause.message : "Không thể ghi nhận khoản thu.";
      notifyOrder({ type: "error", message: err });
    } finally {
      setSaving(false);
    }
  }

  return <>
  <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
    <label className="grid gap-1.5 text-sm font-medium">
      {orderType === "dat_hang" ? "Thanh toán phần còn lại" : "Số tiền thu"}
      <Input
        type="text"
        inputMode="numeric"
        value={orderType === "dat_hang" ? formatCurrency(remaining) : formatNumber(amount)}
        onChange={(event) => {
          if (orderType === "dat_hang") return;
          setAmount(parseCurrencyInput(event.target.value));
        }}
        readOnly={orderType === "dat_hang"}
        className={orderType === "dat_hang" ? "bg-slate-50 font-medium" : ""}
        required
      />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">Phương thức thanh toán<select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 font-normal"><option value="tien_mat">Tiền mặt</option><option value="chuyen_khoan">Chuyển khoản</option><option value="the">Thẻ</option><option value="vi_dien_tu">Ví điện tử</option><option value="khac">Khác</option></select></label>
    <Button type="submit" disabled={saving || amount <= 0 || amount > remaining || (orderType === "dat_hang" && amount !== remaining)}>{saving ? "Đang lưu..." : orderType === "dat_hang" ? "Thanh toán phần còn lại" : "Ghi nhận thanh toán"}</Button>
  </form>
  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Xem trước phiếu thu</DialogTitle><DialogDescription>Kiểm tra khoản thu cho đơn hàng trước khi ghi nhận.</DialogDescription></DialogHeader>
      <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-3"><span>Mã đơn hàng</span><strong>{orderCode}</strong></div>
        <div className="flex justify-between gap-3"><span>Khách hàng</span><strong className="text-right">{customerName}</strong></div>
        <div className="flex justify-between"><span>Số tiền thu</span><strong>{formatCurrency(amount)}</strong></div>
        <div className="flex justify-between"><span>Phương thức</span><strong>{method === "tien_mat" ? "Tiền mặt" : method === "chuyen_khoan" ? "Chuyển khoản" : method === "the" ? "Thẻ" : method === "vi_dien_tu" ? "Ví điện tử" : "Khác"}</strong></div>
        <div className="flex justify-between border-t pt-2"><span>Còn lại sau khi thu</span><strong>{formatCurrency(Math.max(0, remaining - amount))}</strong></div>
        <p className="border-t pt-2 text-xs text-slate-500">Mã phiếu thu THPT sẽ được cấp tự động khi ghi nhận.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)} disabled={saving}>Quay lại</Button>
        <Button type="button" onClick={() => void confirmPayment()} disabled={saving || amount <= 0 || amount > remaining}>{saving ? "Đang ghi nhận..." : "Xác nhận thu tiền"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </>;
}

