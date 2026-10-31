"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { dangNhap } from "@/lib/supabase/dang-nhap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data?.user) window.location.replace("/dashboard");
    });
    return () => { active = false; };
  }, []);

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await dangNhap({ ten_dang_nhap: credential, mat_khau: password });
        if (result.error) { setError(result.error); return; }
        try {
          window.sessionStorage.setItem("login-success-notification", "1");
        } catch {
          // Điều hướng vẫn tiếp tục nếu trình duyệt không cho dùng sessionStorage.
        }
        window.location.href = "/dashboard";
      } catch {
        setError("Không thể đăng nhập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">Thanh Hằng</h1>
          <p className="mt-2 text-sm text-slate-500">Đăng nhập hệ thống quản lý bán hàng</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4 md:space-y-5">
          <div className="space-y-2">
            <Label htmlFor="login-name">Email hoặc tên đăng nhập</Label>
            <Input id="login-name" type="text" autoComplete="username" placeholder="Nhập email hoặc tên đăng nhập" value={credential} onChange={(e) => setCredential(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Đang đăng nhập..." : "Đăng nhập"}</Button>
        </form>
      </div>
    </main>
  );
}

