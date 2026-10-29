"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Pencil, Plus, Trash2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";
import { capNhatNhomKhachHang, xoaNhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";

type Notice = { type: "success" | "error"; message: string } | null;

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${checked ? "bg-primary" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function NhomKhachHangManager({ groups }: { groups: NhomKhachHang[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [groupToDelete, setGroupToDelete] = useState<NhomKhachHang | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("created") !== "1") return;
    const timer = window.setTimeout(() => {
      setNotice({ type: "success", message: "Đã thêm nhóm khách hàng thành công." });
      window.history.replaceState(null, "", "/nhom-khach-hang");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function toggle(group: NhomKhachHang, field: "trang_thai" | "ap_dung_bang_gia") {
    setBusyId(group.id);
    try {
      await capNhatNhomKhachHang(group.id, { [field]: !group[field] });
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Không thể cập nhật nhóm khách hàng." });
    } finally {
      setBusyId(null);
    }
  }

  async function deleteGroup() {
    if (!groupToDelete || busyId !== null) return;
    const group = groupToDelete;
    setBusyId(group.id);
    try {
      await xoaNhomKhachHang(group.id);
      setNotice({ type: "success", message: `Đã xóa nhóm “${group.ten_nhom}” và bảng giá riêng của nhóm.` });
      setGroupToDelete(null);
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Không thể xóa nhóm khách hàng." });
      setGroupToDelete(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-w-0 space-y-4 app-page">
      {notice && (
        <div
          role={notice.type === "success" ? "status" : "alert"}
          aria-live={notice.type === "success" ? "polite" : "assertive"}
          className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300 ${notice.type === "success" ? "border-emerald-200" : "border-red-200"}`}
        >
          {notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
          <p className={`flex-1 text-sm ${notice.type === "success" ? "text-emerald-800" : "text-red-700"}`}>{notice.message}</p>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="flex justify-end">
        <Link href="/nhom-khach-hang/them" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"><Plus className="mr-2 h-4 w-4" />Thêm nhóm</Link>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="app-data-table w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Tên nhóm</th><th className="px-4 py-3 text-center">Đang hoạt động</th><th className="px-4 py-3 text-center">Dùng giá nhóm</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => <tr key={group.id} className="hover:bg-slate-50/70">
              <td className="px-4 py-3"><Link href={`/nhom-khach-hang/${group.id}`} className="font-medium text-slate-900 hover:text-primary hover:underline">{group.ten_nhom}</Link></td>
              <td className="px-4 py-3"><div className="flex justify-center"><Switch label={`Đang hoạt động: ${group.ten_nhom}`} checked={group.trang_thai} disabled={busyId === group.id} onChange={() => void toggle(group, "trang_thai")} /></div></td>
              <td className="px-4 py-3"><div className="flex justify-center"><Switch label={`Dùng giá nhóm: ${group.ten_nhom}`} checked={group.ap_dung_bang_gia} disabled={busyId === group.id} onChange={() => void toggle(group, "ap_dung_bang_gia")} /></div></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2"><Link href={`/nhom-khach-hang/${group.id}/chinh-sua`} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition hover:bg-muted"><Pencil className="h-3.5 w-3.5" />Sửa</Link><Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={busyId === group.id} onClick={() => setGroupToDelete(group)}><Trash2 className="mr-1.5 h-4 w-4" />Xóa</Button></div></td>
            </tr>)}
            {groups.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">Chưa có nhóm khách hàng.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Tắt nhóm sẽ ngăn gán khách hàng mới; khách đã thuộc nhóm vẫn tiếp tục dùng giá nhóm nếu bảng giá được bật.</p>
      <Dialog open={Boolean(groupToDelete)} onOpenChange={(open) => { if (!open && busyId === null) setGroupToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa nhóm khách hàng?</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa nhóm <span className="font-semibold text-slate-900">{groupToDelete?.ten_nhom}</span>? Các giá riêng của nhóm sẽ bị xóa theo. Nhóm đang có khách hàng sẽ không thể xóa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGroupToDelete(null)} disabled={busyId !== null}>Hủy</Button>
            <Button type="button" onClick={() => void deleteGroup()} disabled={busyId !== null} className="bg-red-600 text-white hover:bg-red-700">
              {busyId !== null ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Đang xóa...</> : <><Trash2 className="mr-2 h-4 w-4" />Xóa nhóm</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



