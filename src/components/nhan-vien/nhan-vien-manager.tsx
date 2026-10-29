"use client";

import { useState, useTransition } from "react";
import { UserCog, Plus, Pencil, Trash2, CheckCircle, XCircle, UserRound, KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { themNhanVien, capNhatNhanVien, adminDoiMatKhauNhanVien, xoaNhanVien } from "@/lib/supabase/nhan-vien-actions";
import type { NhanVienRecord } from "@/lib/supabase/nhan-vien-types";

interface Props { danhSach: NhanVienRecord[]; currentUserId: string }
type DialogMode = "them" | "sua" | "doi-mat-khau" | null;

export function NhanVienManager({ danhSach: initialDanhSach, currentUserId }: Props) {
  const [danhSach, setDanhSach] = useState(initialDanhSach);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedNv, setSelectedNv] = useState<NhanVienRecord | null>(null);
  const [xoaTarget, setXoaTarget] = useState<NhanVienRecord | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formHoTen, setFormHoTen] = useState("");
  const [formMatKhau, setFormMatKhau] = useState("");
  const [formVaiTro, setFormVaiTro] = useState<"owner" | "staff">("staff");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function openThem() {
    setFormUsername(""); setFormEmail(""); setFormHoTen(""); setFormMatKhau(""); setFormVaiTro("staff"); setFormError(""); setFormSuccess(""); setDialogMode("them");
  }
  function handleThemSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFormError("");
    startTransition(async () => {
      const result = await themNhanVien({ ten_dang_nhap: formUsername, email: formEmail, ho_ten: formHoTen, mat_khau: formMatKhau, vai_tro: formVaiTro });
      if (result.error) { setFormError(result.error); return; }
      window.location.reload();
    });
  }
  function openSua(nv: NhanVienRecord) {
    setSelectedNv(nv); setFormUsername(nv.ten_dang_nhap); setFormEmail(nv.email ?? ""); setFormHoTen(nv.ho_ten); setFormVaiTro(nv.vai_tro); setFormError(""); setDialogMode("sua");
  }
  function handleSuaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedNv) return; setFormError("");
    startTransition(async () => {
      const result = await capNhatNhanVien(selectedNv.id, { ho_ten: formHoTen.trim(), vai_tro: formVaiTro, ten_dang_nhap: formUsername.trim(), email: formEmail.trim() || null });
      if (result.error) { setFormError(result.error); return; }
      setDanhSach((prev) => prev.map((nv) => nv.id === selectedNv.id ? { ...nv, ho_ten: formHoTen.trim(), vai_tro: formVaiTro, ten_dang_nhap: formUsername.trim().toLowerCase(), email: formEmail.trim() || null } : nv));
      setDialogMode(null);
    });
  }
  function openDoiMatKhau(nv: NhanVienRecord) { setSelectedNv(nv); setFormMatKhau(""); setFormError(""); setFormSuccess(""); setDialogMode("doi-mat-khau"); }
  function handleDoiMatKhauSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedNv) return; setFormError(""); setFormSuccess("");
    startTransition(async () => {
      const result = await adminDoiMatKhauNhanVien(selectedNv.user_id, formMatKhau);
      if (result.error) { setFormError(result.error); return; }
      setFormSuccess(`Đã cập nhật mật khẩu cho ${selectedNv.ho_ten} thành công!`);
      setTimeout(() => setDialogMode(null), 1200);
    });
  }
  function handleToggleTrangThai(nv: NhanVienRecord) {
    const trangThai = nv.trang_thai === "active" ? "inactive" : "active";
    startTransition(async () => {
      const result = await capNhatNhanVien(nv.id, { trang_thai: trangThai });
      if (!result.error) setDanhSach((prev) => prev.map((item) => item.id === nv.id ? { ...item, trang_thai: trangThai } : item));
    });
  }
  function confirmXoa() {
    if (!xoaTarget) return;
    const hasHistory = (xoaTarget.don_hang_count ?? 0) > 0 || (xoaTarget.phieu_thu_count ?? 0) > 0;
    startTransition(async () => {
      const result = await xoaNhanVien(xoaTarget.id, !hasHistory);
      if (result.error) { setFormError(result.error); return; }
      if (result.hard_deleted) setDanhSach((prev) => prev.filter((nv) => nv.id !== xoaTarget.id));
      else setDanhSach((prev) => prev.map((item) => item.id === xoaTarget.id ? { ...item, trang_thai: "inactive" } : item));
      setXoaTarget(null); setFormError("");
    });
  }
  const formatDate = (str: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(str));
  const hasHistory = (nv: NhanVienRecord | null) => (nv?.don_hang_count ?? 0) > 0 || (nv?.phieu_thu_count ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><UserCog className="h-6 w-6 text-primary" aria-hidden="true" /><div><h1 className="text-xl font-semibold text-slate-900">Quản lý nhân viên</h1><p className="text-sm text-slate-500">Phân quyền và quản lý tài khoản nhân viên / quản trị viên</p></div></div>
        <Button onClick={openThem} className="shrink-0 gap-2"><Plus className="h-4 w-4" />Thêm nhân viên</Button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {danhSach.length === 0 ? <div className="py-16 text-center text-sm text-slate-500">Chưa có nhân viên nào. Nhấn &quot;Thêm nhân viên&quot; để tạo tài khoản.</div> : <div className="divide-y divide-slate-100">{danhSach.map((nv) => {
          const isMe = nv.user_id === currentUserId; const isOwnerAccount = nv.vai_tro === "owner"; const orderCount = nv.don_hang_count ?? 0; const recordHasHistory = orderCount > 0 || (nv.phieu_thu_count ?? 0) > 0;
          return <div key={nv.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><UserRound className="h-5 w-5" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-900">{nv.ho_ten}</span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${isOwnerAccount ? "border-red-200 bg-red-50 text-primary" : "bg-slate-100 text-slate-700"}`}>{isOwnerAccount ? "Quản trị viên" : "Nhân viên"}</span>{isMe && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">(Bạn)</span>}<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${nv.trang_thai === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{nv.trang_thai === "active" ? "Đang hoạt động" : "Đã vô hiệu hóa"}</span></div><p className="mt-0.5 truncate text-xs text-slate-500">Tên đăng nhập: {nv.ten_dang_nhap} · {nv.email || "Không có email"} · Đơn: {orderCount}, phiếu thu: {nv.phieu_thu_count ?? 0} · Tạo ngày {formatDate(nv.created_at)}</p></div>
            {!isMe && <div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" title={nv.trang_thai === "active" ? "Vô hiệu hóa tài khoản" : "Kích hoạt lại tài khoản"} onClick={() => handleToggleTrangThai(nv)} disabled={isPending}>{nv.trang_thai === "active" ? <XCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle className="h-4 w-4 text-emerald-600" />}</Button><Button variant="ghost" size="icon" title="Đổi mật khẩu" onClick={() => openDoiMatKhau(nv)} disabled={isPending}><KeyRound className="h-4 w-4 text-blue-600" /></Button><Button variant="ghost" size="icon" title="Sửa thông tin & vai trò" onClick={() => openSua(nv)} disabled={isPending}><Pencil className="h-4 w-4 text-slate-500" /></Button><Button variant="ghost" size="icon" title={recordHasHistory ? "Vô hiệu hóa tài khoản (đã có giao dịch)" : "Xóa vĩnh viễn"} onClick={() => { setXoaTarget(nv); setFormError(""); }} disabled={isPending}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>}
          </div>;
        })}</div>}
      </div>

      <Dialog open={dialogMode === "them"} onOpenChange={(open: boolean) => !open && setDialogMode(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Thêm nhân viên mới</DialogTitle></DialogHeader><form onSubmit={handleThemSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5"><Label htmlFor="nv-username">Tên đăng nhập</Label><Input id="nv-username" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="vd: nguyenvana" required autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="nv-email">Email (không bắt buộc)</Label><Input id="nv-email" type="email" placeholder="nhanvien@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="nv-hoten">Họ và tên</Label><Input id="nv-hoten" placeholder="Nguyễn Văn A" value={formHoTen} onChange={(e) => setFormHoTen(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="nv-matkhau">Mật khẩu (ít nhất 6 ký tự)</Label><Input id="nv-matkhau" type="password" placeholder="••••••" value={formMatKhau} onChange={(e) => setFormMatKhau(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
        <div className="space-y-1.5"><Label htmlFor="nv-vaitro">Vai trò</Label><select id="nv-vaitro" value={formVaiTro} onChange={(e) => setFormVaiTro(e.target.value as "owner" | "staff")} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="staff">Nhân viên (Chỉ tạo đơn & thu tiền, ẩn giá vốn)</option><option value="owner">Quản trị viên (Toàn quyền hệ thống)</option></select></div>
        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}<DialogFooter className="gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>Hủy</Button><Button type="submit" disabled={isPending}>{isPending ? "Đang tạo..." : "Tạo tài khoản"}</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <Dialog open={dialogMode === "sua"} onOpenChange={(open: boolean) => !open && setDialogMode(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Sửa thông tin nhân viên</DialogTitle></DialogHeader><form onSubmit={handleSuaSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5"><Label htmlFor="sua-username">Tên đăng nhập</Label><Input id="sua-username" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} required autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="sua-email">Email (không bắt buộc; email đã có không thể xóa)</Label><Input id="sua-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="sua-hoten">Họ và tên</Label><Input id="sua-hoten" value={formHoTen} onChange={(e) => setFormHoTen(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="sua-vaitro">Vai trò</Label><select id="sua-vaitro" value={formVaiTro} onChange={(e) => setFormVaiTro(e.target.value as "owner" | "staff")} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="staff">Nhân viên (Chỉ tạo đơn & thu tiền, ẩn giá vốn)</option><option value="owner">Quản trị viên (Toàn quyền hệ thống)</option></select></div>
        {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}<DialogFooter className="gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>Hủy</Button><Button type="submit" disabled={isPending}>{isPending ? "Đang lưu..." : "Lưu thay đổi"}</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <Dialog open={dialogMode === "doi-mat-khau"} onOpenChange={(open: boolean) => !open && setDialogMode(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Đổi mật khẩu cho: {selectedNv?.ho_ten}</DialogTitle></DialogHeader><form onSubmit={handleDoiMatKhauSubmit} className="space-y-4 pt-2"><div className="space-y-1.5"><Label htmlFor="admin-reset-pw">Mật khẩu mới (ít nhất 6 ký tự)</Label><Input id="admin-reset-pw" type="password" placeholder="Nhập mật khẩu mới" value={formMatKhau} onChange={(e) => setFormMatKhau(e.target.value)} required minLength={6} autoComplete="new-password" /></div>{formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}{formSuccess && <p role="status" className="text-sm font-medium text-emerald-600">{formSuccess}</p>}<DialogFooter className="gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>Hủy</Button><Button type="submit" disabled={isPending}>{isPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!xoaTarget} onOpenChange={(open: boolean) => !open && setXoaTarget(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-900"><ShieldAlert className="h-5 w-5 text-amber-500" />{hasHistory(xoaTarget) ? "Vô hiệu hóa tài khoản nhân viên" : "Xác nhận xóa tài khoản"}</DialogTitle></DialogHeader><div className="space-y-2 text-sm text-slate-600">{hasHistory(xoaTarget) ? <p>Nhân viên <strong>{xoaTarget?.ho_ten}</strong> đã tạo <strong>{xoaTarget?.don_hang_count ?? 0}</strong> đơn hàng và <strong>{xoaTarget?.phieu_thu_count ?? 0}</strong> phiếu thu. Tài khoản sẽ được <strong>vô hiệu hóa</strong>, lịch sử vẫn được giữ nguyên.</p> : <p>Tài khoản <strong>{xoaTarget?.ho_ten}</strong> chưa phát sinh đơn hàng hoặc phiếu thu. Bạn có chắc muốn <strong>xóa vĩnh viễn</strong>?</p>}{formError && <p className="font-medium text-red-600">{formError}</p>}</div><DialogFooter className="gap-2 pt-2"><Button type="button" variant="outline" onClick={() => { setXoaTarget(null); setFormError(""); }} disabled={isPending}>Hủy</Button><Button type="button" onClick={confirmXoa} disabled={isPending} className={hasHistory(xoaTarget) ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}>{isPending ? "Đang xử lý..." : hasHistory(xoaTarget) ? "Vô hiệu hóa" : "Xóa vĩnh viễn"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
