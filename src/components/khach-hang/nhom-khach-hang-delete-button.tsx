"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";
import { xoaNhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";

export function NhomKhachHangDeleteButton({ group, customerCount }: { group: NhomKhachHang; customerCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteGroup() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await xoaNhomKhachHang(group.id);
      setOpen(false);
      router.push("/nhom-khach-hang");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa nhóm khách hàng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="default"
        className="h-10 min-h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        disabled={customerCount > 0}
        onClick={() => { setError(null); setOpen(true); }}
      >
        <Trash2 className="h-4 w-4" />Xóa nhóm
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) setOpen(nextOpen); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa nhóm khách hàng?</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa nhóm <span className="font-semibold text-slate-900">{group.ten_nhom}</span>? Các giá riêng của nhóm sẽ bị xóa theo. Khách hàng không bị xóa.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Hủy</Button>
            <Button type="button" onClick={() => void deleteGroup()} disabled={busy} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Đang xóa...</> : <><Trash2 className="mr-2 h-4 w-4" />Xóa nhóm</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
