"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function LoginSuccessToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem("login-success-notification") !== "1") return;
        window.sessionStorage.removeItem("login-success-notification");
        setVisible(true);
      } catch {
        setVisible(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="app-mobile-toast fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <p className="flex-1 text-sm text-emerald-800">Đăng nhập thành công.</p>
      <button type="button" onClick={() => setVisible(false)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng thông báo">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
