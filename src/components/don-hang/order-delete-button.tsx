"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { xoaDonHang } from "@/lib/supabase/don-hang-actions";
import { setPendingOrderNotification } from "@/components/don-hang/order-notification-toast";

export function OrderDeleteButton({
  orderId,
  orderCode,
  paidAmount,
}: {
  orderId: string;
  orderCode: string;
  paidAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (paidAmount > 0) {
    // Đơn đã phát sinh thu tiền thì không hiển thị nút xóa (chỉ áp dụng hủy đơn)
    return null;
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    try {
      await xoaDonHang(orderId);
      setPendingOrderNotification({
        type: "success",
        message: `Đã xóa đơn hàng ${orderCode} thành công.`,
      });
      router.push("/danh-sach-don-hang");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa đơn hàng.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={() => setOpen(true)}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        Xóa đơn
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl bg-white p-4 md:p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">
                  Xóa đơn hàng {orderCode}?
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa đơn hàng <strong className="text-slate-900">{orderCode}</strong> khỏi hệ thống? Thao tác này không thể hoàn tác.
                </p>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed">
                  <strong>Quy định kế toán:</strong> Chỉ cho phép xóa đơn hàng khi chưa phát sinh giao dịch thu tiền.
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="app-form-actions mt-4 md:mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xác nhận xóa
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


