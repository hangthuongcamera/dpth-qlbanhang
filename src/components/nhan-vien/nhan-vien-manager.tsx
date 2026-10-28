"use client";

import { useState, useTransition } from "react";
import { UserCog, Plus, Pencil, Trash2, CheckCircle, XCircle, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { themNhanVien, capNhatNhanVien, xoaNhanVien } from "@/lib/supabase/nhan-vien-actions";
import type { NhanVienRecord } from "@/lib/supabase/nhan-vien-actions";

interface Props {
  danhSach: NhanVienRecord[];
  currentUserId: string;
}

type DialogMode = "them" | "sua" | null;

export function NhanVienManager({ danhSach: initialDanhSach, currentUserId }: Props) {
  const [danhSach, setDanhSach] = useState(initialDanhSach);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editTarget, setEditTarget] = useState<NhanVienRecord | null>(null);
  const [xoaTarget, setXoaTarget] = useState<NhanVienRecord | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formHoTen, setFormHoTen] = useState("");
  const [formMatKhau, setFormMatKhau] = useState("");
  const [formError, setFormError] = useState("");

  const [isPending, startTransition] = useTransition();

  // -----------------------------------------------------------------------
  // Thêm nhân viên
  // -----------------------------------------------------------------------
  function openThem() {
    setFormEmail("");
    setFormHoTen("");
    setFormMatKhau("");
    setFormError("");
    setDialogMode("them");
  }

  function handleThemSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const fd = new FormData();
    fd.set("email", formEmail.trim());
    fd.set("ho_ten", formHoTen.trim());
    fd.set("mat_khau", formMatKhau);

    startTransition(async () => {
      const result = await themNhanVien(fd);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      // Refresh danh sách bằng cách reload (Server Action đã revalidatePath)
      window.location.reload();
    });
  }

  // -----------------------------------------------------------------------
  // Sửa họ tên nhân viên
  // -----------------------------------------------------------------------
  function openSua(nv: NhanVienRecord) {
    setEditTarget(nv);
    setFormHoTen(nv.ho_ten);
    setFormError("");
    setDialogMode("sua");
  }

  function handleSuaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setFormError("");

    startTransition(async () => {
      const result = await capNhatNhanVien(editTarget.id, { ho_ten: formHoTen.trim() });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setDanhSach((prev) =>
        prev.map((nv) => nv.id === editTarget.id ? { ...nv, ho_ten: formHoTen.trim() } : nv)
      );
      setDialogMode(null);
    });
  }

  // -----------------------------------------------------------------------
  // Bật/Tắt tài khoản
  // -----------------------------------------------------------------------
  function handleToggleTrangThai(nv: NhanVienRecord) {
    const newTrangThai = nv.trang_thai === "active" ? "inactive" : "active";
    startTransition(async () => {
      const result = await capNhatNhanVien(nv.id, { trang_thai: newTrangThai });
      if (!result.error) {
        setDanhSach((prev) =>
          prev.map((item) => item.id === nv.id ? { ...item, trang_thai: newTrangThai } : item)
        );
      }
    });
  }

  // -----------------------------------------------------------------------
  // Xóa nhân viên
  // -----------------------------------------------------------------------
  function handleXoa(nv: NhanVienRecord) {
    setXoaTarget(nv);
  }

  function confirmXoa() {
    if (!xoaTarget) return;
    startTransition(async () => {
      const result = await xoaNhanVien(xoaTarget.id);
      if (!result.error) {
        setDanhSach((prev) => prev.filter((nv) => nv.id !== xoaTarget.id));
      }
      setXoaTarget(null);
    });
  }

  const formatDate = (str: string) =>
    new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(str));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserCog className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Quản lý nhân viên</h1>
            <p className="text-sm text-slate-500">Thêm và quản lý tài khoản nhân viên bán hàng</p>
          </div>
        </div>
        <Button onClick={openThem} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Thêm nhân viên
        </Button>
      </div>

      {/* Danh sách */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {danhSach.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Chưa có nhân viên nào. Nhấn &quot;Thêm nhân viên&quot; để tạo tài khoản.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {danhSach.map((nv) => {
              const isMe = nv.user_id === currentUserId;
              const isOwnerAccount = nv.vai_tro === "owner";
              return (
                <div key={nv.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <UserRound className="h-5 w-5" aria-hidden="true" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{nv.ho_ten}</span>
                      {isOwnerAccount && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Chủ cửa hàng
                        </span>
                      )}
                      {isMe && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          (Bạn)
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${nv.trang_thai === "active" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {nv.trang_thai === "active" ? "Đang hoạt động" : "Đã tắt"}
                      </span>
                    </div>
                    <p className="truncate text-sm text-slate-500">
                      Ngày tạo: {formatDate(nv.created_at)}
                    </p>
                  </div>

                  {/* Actions — không cho thao tác với chính mình hoặc owner */}
                  {!isMe && !isOwnerAccount && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={nv.trang_thai === "active" ? "Tắt tài khoản" : "Bật tài khoản"}
                        onClick={() => handleToggleTrangThai(nv)}
                        disabled={isPending}
                      >
                        {nv.trang_thai === "active" ? (
                          <XCircle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Sửa họ tên"
                        onClick={() => openSua(nv)}
                        disabled={isPending}
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Xóa nhân viên"
                        onClick={() => handleXoa(nv)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Thêm nhân viên */}
      <Dialog open={dialogMode === "them"} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm nhân viên mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleThemSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="nv-email">Email</Label>
              <Input
                id="nv-email"
                type="email"
                placeholder="nhanvien@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-hoten">Họ tên</Label>
              <Input
                id="nv-hoten"
                placeholder="Nguyễn Văn A"
                value={formHoTen}
                onChange={(e) => setFormHoTen(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-matkhau">Mật khẩu (ít nhất 6 ký tự)</Label>
              <Input
                id="nv-matkhau"
                type="password"
                placeholder="••••••"
                value={formMatKhau}
                onChange={(e) => setFormMatKhau(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Sửa họ tên */}
      <Dialog open={dialogMode === "sua"} onOpenChange={(open: boolean) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sửa họ tên nhân viên</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSuaSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="sua-hoten">Họ tên</Label>
              <Input
                id="sua-hoten"
                value={formHoTen}
                onChange={(e) => setFormHoTen(e.target.value)}
                required
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)} disabled={isPending}>
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert xác nhận xóa — dùng Dialog thường */}
      <Dialog open={!!xoaTarget} onOpenChange={(open: boolean) => !open && setXoaTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận vô hiệu hóa tài khoản</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Tài khoản của <strong>{xoaTarget?.ho_ten}</strong> sẽ bị vô hiệu hóa và không thể đăng nhập nữa.
            Dữ liệu đơn hàng liên quan vẫn được giữ nguyên.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setXoaTarget(null)} disabled={isPending}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={confirmXoa}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? "Đang xử lý..." : "Vô hiệu hóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
