
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton({ light = false }: { light?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError("Đăng xuất không thành công. Vui lòng thử lại.");
      setLoading(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        onClick={handleLogout}
        disabled={loading}
        className={light ? "text-white hover:bg-white/15 hover:text-white" : "text-slate-600 hover:text-red-600"}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {loading ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
