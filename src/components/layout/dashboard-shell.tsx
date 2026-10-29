"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { PageTransition } from "@/components/layout/page-transition";
import type { VaiTro } from "@/lib/supabase/user-profile";

interface DashboardShellProps {
  children: React.ReactNode;
  vaiTro?: VaiTro;
  hoTen?: string;
}

export function DashboardShell({ children, vaiTro = "staff", hoTen = "" }: DashboardShellProps) {
  const isFastSale = usePathname().startsWith("/ban-nhanh");

  return (
    <div className="min-h-dvh min-w-0 bg-slate-50">
      {!isFastSale && <Sidebar vaiTro={vaiTro} />}
      <div className={`min-w-0 ${isFastSale ? "" : "md:pl-64"}`}>
        <Header showMobileMenu={!isFastSale} vaiTro={vaiTro} hoTen={hoTen} />
        <main className="min-w-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
