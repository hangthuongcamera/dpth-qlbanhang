"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { PageTransition } from "@/components/layout/page-transition";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const isFastSale = usePathname().startsWith("/ban-nhanh");

  return (
    <div className="min-h-screen bg-slate-50">
      {!isFastSale && <Sidebar />}
      <div className={isFastSale ? "" : "md:pl-64"}>
        <Header showMobileMenu={!isFastSale} />
        <main>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
