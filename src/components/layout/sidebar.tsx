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
  UserCog,
} from "lucide-react";
import type { VaiTro } from "@/lib/supabase/user-profile";

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

// Menu chỉ dành cho owner
const ownerMenuItems = [
  {
    title: "Báo cáo",
    href: "/bao-cao",
    icon: BarChart3,
  },
  {
    title: "Nhân viên",
    href: "/nhan-vien",
    icon: UserCog,
  },
  {
    title: "Cài đặt",
    href: "/cai-dat",
    icon: Settings,
  },
];

// Menu cho tất cả (staff cũng thấy Cài đặt nhưng ẩn Báo cáo và Nhân viên)
const staffBottomItems = [
  {
    title: "Cài đặt",
    href: "/cai-dat",
    icon: Settings,
  },
];

interface SidebarProps {
  vaiTro?: VaiTro;
}

export function Sidebar({ vaiTro = "staff" }: SidebarProps) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(() =>
    pathname.startsWith("/danh-muc-san-pham") || pathname.startsWith("/danh-sach-san-pham")
      ? "Sản phẩm"
      : pathname.startsWith("/danh-sach-khach-hang") || pathname.startsWith("/nhom-khach-hang") || pathname.startsWith("/bang-gia-nhom")
        ? "Khách hàng"
        : pathname.startsWith("/danh-sach-don-hang") || pathname.startsWith("/don-dat-hang") || pathname.startsWith("/ban-nhanh") ? "Đơn hàng" : null,
  );

  const bottomItems = vaiTro === "owner" ? ownerMenuItems : staffBottomItems;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white text-slate-700 md:flex md:flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-200 bg-slate-50 px-6">
        <div>
          <div className="text-lg font-bold text-primary">
            Thanh Hằng
          </div>

          <div className="text-xs text-slate-500">
            Quản lý bán hàng
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
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
                        <Link key={child.href} href={child.href} target={child.href === "/ban-nhanh" ? "_blank" : undefined} rel={child.href === "/ban-nhanh" ? "noopener noreferrer" : undefined} className={`block rounded-md px-3 py-2 text-sm transition ${childActive ? "bg-primary/10 font-medium text-primary" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"}`}>
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
              href={item.href!}
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

      {/* Bottom menu — phân theo vai trò */}
      <div className="border-t border-slate-200 p-4">
        {bottomItems.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}
