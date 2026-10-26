"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";
import type { CuaHangSettings } from "@/lib/cua-hang-settings";

export type CaiDatState = { ok: boolean; message: string };
const fail = (message: string): CaiDatState => ({ ok: false, message });

export async function luuCaiDatCuaHang(_previous: CaiDatState, formData: FormData): Promise<CaiDatState> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return fail("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

  const value = (key: keyof Omit<CuaHangSettings, "id">) => String(formData.get(key) ?? "").trim();
  const settings = {
    id: true,
    ten_cua_hang: value("ten_cua_hang"),
    hotline: value("hotline"),
    dia_chi: value("dia_chi"),
    ten_ngan_hang: value("ten_ngan_hang"),
    ma_ngan_hang: value("ma_ngan_hang"),
    so_tai_khoan: value("so_tai_khoan"),
    ten_chu_tai_khoan: value("ten_chu_tai_khoan"),
    loi_nhan_chan_phieu: value("loi_nhan_chan_phieu"),
  } satisfies CuaHangSettings;

  if (!settings.ten_cua_hang) return fail("Vui lòng nhập tên cửa hàng.");
  if (!settings.hotline) return fail("Vui lòng nhập số hotline.");
  if (!settings.ten_ngan_hang) return fail("Vui lòng nhập tên ngân hàng.");
  if (!/^\d{6}$/.test(settings.ma_ngan_hang)) return fail("Mã BIN ngân hàng phải gồm đúng 6 chữ số.");
  if (!/^\d{6,20}$/.test(settings.so_tai_khoan)) return fail("Số tài khoản chỉ gồm 6–20 chữ số.");
  if (!settings.ten_chu_tai_khoan) return fail("Vui lòng nhập tên chủ tài khoản.");
  if (settings.dia_chi.length > 300) return fail("Địa chỉ cửa hàng tối đa 300 ký tự.");
  if (settings.loi_nhan_chan_phieu.length > 500) return fail("Lời nhắn cuối hóa đơn tối đa 500 ký tự.");

  const { error } = await supabase.from("cai_dat_cua_hang").upsert({ ...settings, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    console.error("Lỗi lưu cấu hình cửa hàng", error);
    if (error.code === "42P01" || error.code === "PGRST205") {
      return fail("Chưa có bảng cấu hình trên Supabase. Hãy chạy migration 20261024160000_store_settings.sql rồi tải lại trang.");
    }
    return fail("Không thể lưu cấu hình. " + error.message);
  }

  revalidatePath("/cai-dat");
  revalidatePath("/danh-sach-don-hang/[id]", "page");
  return { ok: true, message: "Đã lưu thành công." };
}



