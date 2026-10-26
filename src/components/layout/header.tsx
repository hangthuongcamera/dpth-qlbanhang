"use client";

import { Menu, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MobileSidebar } from "./mobile-sidebar";
import { useState } from "react";
import { LogoutButton } from "./logout-button";

const pageConfig = {
  "/dashboard": {
    title: "Tổng quan",
    description: "Tổng quan hoạt động kinh doanh.",
  },
  "/danh-sach-khach-hang": {
    title: "Danh sách khách hàng",
    description: "Quản lý thông tin khách hàng.",
  },
  "/nhom-khach-hang": {
    title: "Nhóm khách hàng",
    description: "Quản lý nhóm và trạng thái áp dụng giá.",
  },
  "/bang-gia-nhom": {
    title: "Bảng giá nhóm",
    description: "Quản lý giá bán riêng theo nhóm khách hàng.",
  },
  "/danh-sach-san-pham": {
    title: "Danh sách sản phẩm",
    description: "Quản lý danh sách sản phẩm.",
  },
  "/danh-muc-san-pham": {
    title: "Danh mục sản phẩm",
    description: "Quản lý danh mục sản phẩm.",
  },
  "/danh-sach-don-hang": {
    title: "Danh sách đơn hàng",
    description: "Quản lý và theo dõi đơn hàng.",
  },
  "/ban-nhanh": {
    title: "Bán nhanh",
    description: "Tạo đơn bán hàng nhanh tại quầy.",
  },
  "/don-dat-hang": {
    title: "Đơn đặt hàng",
    description: "Tạo đơn đặt may / đặt hàng đồng phục.",
  },
  "/phieu-thu": {
    title: "Phiếu thu",
    description: "Quản lý các khoản tiền khách hàng thanh toán.",
  },
  "/cong-no": {
    title: "Công nợ",
    description: "Theo dõi khách hàng đang nợ và hạn mức công nợ.",
  },
  "/bao-cao": {
    title: "Báo cáo",
    description: "Theo dõi và phân tích tình hình kinh doanh.",
  },
  "/cai-dat": {
    title: "Cài đặt",
    description: "Cấu hình hệ thống.",
  },
} as const;

export function Header({ showMobileMenu = true }: { showMobileMenu?: boolean }) {
  const pathname = usePathname();
  const isFastSale = pathname.startsWith("/ban-nhanh");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const currentPage =
    Object.entries(pageConfig).find(([path]) => {
      if (path === "/dashboard") {
        return pathname === path;
      }

      return pathname === path || pathname.startsWith(`${path}/`);
    })?.[1] ?? pageConfig["/dashboard"];

  return (
    <header className={`sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 ${isFastSale ? "relative h-[54px] min-h-[54px] bg-primary text-primary-foreground" : "relative min-h-16 border-b border-slate-200 bg-white"}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showMobileMenu && <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <MobileSidebar
            open={mobileSidebarOpen}
            onOpenChange={setMobileSidebarOpen}
          />
        </div>}

        {isFastSale ? <div id="fast-sale-header-slot" className="flex min-w-0 flex-1 items-center" /> : <div className="min-w-0">
          <h1 className="absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[calc(100vw-8rem)] -translate-y-1/2 truncate text-center text-xl font-semibold uppercase text-slate-900 md:static md:top-auto md:mx-0 md:w-auto md:max-w-none md:translate-y-0 md:text-left md:normal-case">
            {currentPage.title}
          </h1>

          <p className="hidden truncate text-xs text-slate-500 sm:block">
            {currentPage.description}
          </p>
        </div>}
      </div>

      <div className={`${showMobileMenu ? "hidden md:flex" : "flex"} shrink-0 items-center gap-2`}>
        <Avatar className="h-8 w-8">
          <AvatarFallback className={isFastSale ? "text-white" : "text-slate-600"}>
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>

        <div className="hidden sm:block">
          <p className={`text-sm font-medium ${isFastSale ? "text-white" : "text-slate-900"}`}>Admin</p>
          <p className={`text-xs ${isFastSale ? "text-white/80" : "text-slate-500"}`}>Quản trị viên</p>
        </div>
        <LogoutButton light={isFastSale} />
      </div>
    </header>
  );
}


