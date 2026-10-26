"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { xoaSanPham } from "@/lib/supabase/san-pham-actions";

type DeleteProductButtonProps = {
  productId: string;
  productName: string;
  productCode: string;
  variantCount: number;
};

export function DeleteProductButton({ productId, productName, productCode, variantCount }: DeleteProductButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    setIsDeleting(true);
    try {
      await xoaSanPham(productId);
      sessionStorage.setItem(
        "san-pham-notification",
        JSON.stringify({
          type: "success",
          message: `Đã xóa sản phẩm "${productName}".`,
        }),
      );
      router.replace("/danh-sach-san-pham");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa sản phẩm. Vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
    }
  };

  return <>
    <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => { setError(""); setOpen(true); }}>
      <Trash2 className="mr-2 h-4 w-4" />Xóa sản phẩm
    </Button>
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!isDeleting) setOpen(nextOpen); }}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><AlertTriangle className="h-5 w-5 text-red-600" /></span>
            <div className="space-y-2">
              <DialogTitle>Xóa sản phẩm?</DialogTitle>
              <DialogDescription>
                Bạn có chắc muốn xóa <span className="font-semibold text-slate-900">{productName} ({productCode})</span>{variantCount ? ` và ${variantCount} biến thể` : ""}? Thao tác không thể hoàn tác. Nếu sản phẩm hoặc biến thể đã được dùng trong đơn hàng, hệ thống sẽ từ chối xóa để giữ lịch sử.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isDeleting} onClick={() => setOpen(false)}>Hủy</Button>
          <Button type="button" disabled={isDeleting} onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
            {isDeleting ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Đang xóa...</> : <><Trash2 className="mr-2 h-4 w-4" />Xóa sản phẩm</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
