"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Receipt,
  CreditCard,
  BarChart3,
  Settings,
  ChevronDown,
  UserRound,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LogoutButton } from "./logout-button";

const menuItems = [
  {
    title: "Tổng quan",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Khách hàng",
    href: "#",
    icon: Users,
    children: [
      { title: "Danh sách khách hàng", href: "/danh-sach-khach-hang" },
      { title: "Nhóm khách hàng", href: "/nhom-khach-hang" },
      { title: "Bảng giá nhóm", href: "/bang-gia-nhom" },
    ],
  },
  {
    title: "Sản phẩm",
    href: "#",
    icon: Package,
    children: [
      { title: "Danh mục sản phẩm", href: "/danh-muc-san-pham" },
      { title: "Danh sách sản phẩm", href: "/danh-sach-san-pham" },
    ],
  },
  {
    title: "Đơn hàng",
    icon: ShoppingCart,
    children: [
      { title: "Danh sách đơn hàng", href: "/danh-sach-don-hang" },
      { title: "Đơn đặt hàng", href: "/don-dat-hang" },
      { title: "Bán nhanh", href: "/ban-nhanh" },
    ],
  },
  {
    title: "Phiếu thu",
    href: "/phieu-thu",
    icon: Receipt,
  },
  {
    title: "Công nợ",
    href: "/cong-no",
    icon: CreditCard,
  },
];

const bottomMenuItems = [
  {
    title: "Báo cáo",
    href: "/bao-cao",
    icon: BarChart3,
  },
  {
    title: "Cài đặt",
    href: "/cai-dat",
    icon: Settings,
  },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({
  open,
  onOpenChange,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(() =>
    pathname.startsWith("/danh-muc-san-pham") || pathname.startsWith("/danh-sach-san-pham")
      ? "Sản phẩm"
      : pathname.startsWith("/danh-sach-khach-hang") || pathname.startsWith("/nhom-khach-hang") || pathname.startsWith("/bang-gia-nhom")
        ? "Khách hàng"
        : pathname.startsWith("/danh-sach-don-hang") || pathname.startsWith("/don-dat-hang") || pathname.startsWith("/ban-nhanh") ? "Đơn hàng" : null,
  );

  const handleNavigate = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 bg-white p-0 text-slate-700 [&_[data-slot=sheet-close]]:text-slate-500 [&_[data-slot=sheet-close]]:hover:bg-slate-100">
        <SheetHeader className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-left text-slate-900">
          <SheetTitle className="text-left text-slate-900">
            <div className="text-lg font-bold text-primary">
              Thanh Hằng
            </div>

            <div className="text-xs font-normal text-slate-500">
              Quản lý bán hàng
            </div>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-1 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;

            if (item.children) {
              const isActive = item.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));

              return (
                <div key={item.title}>
                  <button
                    type="button"
                    aria-expanded={openMenu === item.title}
                    onClick={() => setOpenMenu((open) => open === item.title ? null : item.title)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${isActive ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{item.title}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openMenu === item.title ? "rotate-180" : ""}`} />
                  </button>
                  {openMenu === item.title && (
                    <div className="ml-8 mt-1 space-y-1 border-l border-slate-200 pl-3">
                      {item.children.map((child) => {
                        const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                        <Link key={child.href} href={child.href} target={child.href === "/ban-nhanh" ? "_blank" : undefined} rel={child.href === "/ban-nhanh" ? "noopener noreferrer" : undefined} onClick={handleNavigate} className={`block rounded-md px-3 py-2 text-sm transition ${childActive ? "bg-primary/10 font-medium text-primary" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}>
                            {child.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5" />

                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          {bottomMenuItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5" />

                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3 px-3 pb-3 text-slate-700">
            <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Admin</p>
              <p className="text-xs text-slate-500">Quản trị viên</p>
            </div>
          </div>
          <div className="[&>button]:w-full [&>button]:justify-start">
            <LogoutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}





