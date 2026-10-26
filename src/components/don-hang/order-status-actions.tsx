"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { capNhatTrangThaiDonHang } from "@/lib/supabase/don-hang-actions";
import { notifyOrder } from "@/components/don-hang/order-notification-toast";
import type { TrangThaiDonHang } from "@/types/don-hang";

export function OrderStatusActions({
  orderId,
  currentStatus,
  orderType,
}: {
  orderId: string;
  currentStatus: string;
  orderType: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (currentStatus === "hoan_thanh" || currentStatus === "da_huy") {
    return null;
  }

  // Bán nhanh thường hoàn thành ngay tại quầy
  if (orderType === "ban_nhanh" && currentStatus !== "xac_nhan") {
    return null;
  }

  async function handleTransition(nextStatus: TrangThaiDonHang, reason?: string) {
    setBusy(true);
    try {
      await capNhatTrangThaiDonHang({
        don_hang_id: orderId,
        trang_thai_moi: nextStatus,
        ghi_chu: reason ? `Lý do hủy: ${reason}` : undefined,
      });

      const messageMap: Record<TrangThaiDonHang, string> = {
        xac_nhan: "Đơn hàng đã được xác nhận.",
        dang_thuc_hien: "Đã chuyển đơn hàng sang trạng thái Đang thực hiện.",
        hoan_thanh: "Đã hoàn thành đơn hàng.",
        da_huy: "Đã hủy đơn hàng.",
      };

      notifyOrder({
        type: nextStatus === "da_huy" ? "error" : "success",
        message: messageMap[nextStatus],
      });

      setCancelDialogOpen(false);
      setCancelReason("");
      router.refresh();
    } catch (cause) {
      notifyOrder({
        type: "error",
        message: cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái đơn hàng.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentStatus === "xac_nhan" && (
        <Button
          type="button"
          onClick={() => handleTransition("dang_thuc_hien")}
          disabled={busy}
          className="bg-amber-600 text-white hover:bg-amber-700"
        >
          <Play className="mr-2 h-4 w-4" />
          Bắt đầu thực hiện
        </Button>
      )}

      {currentStatus === "dang_thuc_hien" && (
        <Button
          type="button"
          onClick={() => handleTransition("hoan_thanh")}
          disabled={busy}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Hoàn thành đơn
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setCancelDialogOpen(true)}
        disabled={busy}
        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <XCircle className="mr-2 h-4 w-4" />
        Hủy đơn hàng
      </Button>

      <Dialog open={cancelDialogOpen} onOpenChange={(open) => !busy && setCancelDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </span>
              <div>
                <DialogTitle>Xác nhận hủy đơn hàng</DialogTitle>
                <DialogDescription>
                  Hành động này sẽ hủy đơn hàng và không thể hoàn tác tiến độ sản xuất.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label htmlFor="cancel-reason" className="text-sm font-medium text-slate-700">
              Lý do hủy (tùy chọn)
            </label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ví dụ: Khách đổi ý, sai thông số cắt may..."
              maxLength={255}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={busy}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleTransition("da_huy", cancelReason.trim())}
              disabled={busy}
            >
              {busy ? "Đang xử lý..." : "Xác nhận hủy đơn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
