"use client";

import { useState } from "react";
import { UserRound, KeyRound, LogOut, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DoiMatKhauDialog } from "./doi-mat-khau-dialog";
import { createClient } from "@/lib/supabase/client";
import type { VaiTro } from "@/lib/supabase/user-profile";

interface UserProfileMenuProps {
  displayName: string;
  roleLabel: string;
  vaiTro: VaiTro;
  isFastSale?: boolean;
}

export function UserProfileMenu({
  displayName,
  roleLabel,
  vaiTro,
  isFastSale = false,
}: UserProfileMenuProps) {
  const [openDoiMatKhau, setOpenDoiMatKhau] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`flex items-center gap-2 rounded-lg p-1.5 transition outline-none ${
            isFastSale
              ? "hover:bg-white/10 text-white"
              : "hover:bg-slate-100 text-slate-700"
          }`}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className={isFastSale ? "text-white bg-white/20" : "text-slate-600 bg-slate-100"}>
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>

          <div className="hidden text-left md:block">
            <p className={`text-sm font-medium leading-none ${isFastSale ? "text-white" : "text-slate-900"}`}>
              {displayName}
            </p>
            <p className={`mt-1 text-xs leading-none ${isFastSale ? "text-white/80" : "text-slate-500"}`}>
              {roleLabel}
            </p>
          </div>

          <ChevronDown className={`h-4 w-4 opacity-70 ${isFastSale ? "text-white" : "text-slate-500"}`} />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-lg">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none text-slate-900">{displayName}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      vaiTro === "owner"
                        ? "bg-red-50 text-primary border border-red-200"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setOpenDoiMatKhau(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <KeyRound className="h-4 w-4 text-slate-500" />
              <span>Đổi mật khẩu</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              <span>{loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DoiMatKhauDialog
        open={openDoiMatKhau}
        onOpenChange={setOpenDoiMatKhau}
      />
    </>
  );
}
