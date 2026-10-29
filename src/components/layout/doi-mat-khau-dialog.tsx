"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";

interface DoiMatKhauDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DoiMatKhauDialog({ open, onOpenChange }: DoiMatKhauDialogProps) {
  const [matKhauMoi, setMatKhauMoi] = useState("");
  const [xacNhanMatKhau, setXacNhanMatKhau] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (matKhauMoi.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (matKhauMoi !== xacNhanMatKhau) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: matKhauMoi,
      });

      if (updateErr) {
        setError(updateErr.message || "Không thể đổi mật khẩu.");
        return;
      }

      setSuccess("Đổi mật khẩu thành công!");
      setMatKhauMoi("");
      setXacNhanMatKhau("");

      setTimeout(() => {
        onOpenChange(false);
        setSuccess("");
      }, 1500);
    } catch {
      setError("Đã xảy ra lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setMatKhauMoi("");
      setXacNhanMatKhau("");
      setError("");
      setSuccess("");
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Đổi mật khẩu tài khoản
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="user-new-pw">Mật khẩu mới</Label>
            <div className="relative">
              <Input
                id="user-new-pw"
                type={showPassword ? "text" : "password"}
                placeholder="Ít nhất 6 ký tự"
                value={matKhauMoi}
                onChange={(e) => setMatKhauMoi(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-confirm-pw">Xác nhận mật khẩu mới</Label>
            <Input
              id="user-confirm-pw"
              type={showPassword ? "text" : "password"}
              placeholder="Nhập lại mật khẩu mới"
              value={xacNhanMatKhau}
              onChange={(e) => setXacNhanMatKhau(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {success && <p role="status" className="text-sm font-medium text-emerald-600">{success}</p>}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Cập nhật mật khẩu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
