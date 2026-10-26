
"use server";

import { createClient } from "./server";
import {
  khachHangSchema,
  soDienThoaiSchema,
  type KhachHangSchema,
} from "@/lib/validations/khach-hang";

function validateKhachHang(data: unknown) {
  const result = khachHangSchema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Thông tin khách hàng không hợp lệ.");
  }
  return result.data;
}

function getSaveErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    if (error.message.includes("khach_hang_so_dien_thoai_normalized_uidx")) {
      return "Số điện thoại này đã được sử dụng cho một khách hàng khác.";
    }
    return "Mã khách hàng đã tồn tại. Vui lòng thử lại.";
  }
  if (error.code === "23514") {
    if (error.message.includes("nhóm đã ngừng hoạt động")) return error.message;
    if (error.message.includes("so_dien_thoai")) return "Số điện thoại không đúng định dạng.";
    if (error.message.includes("email")) return "Email không đúng định dạng.";
    if (error.message.includes("han_muc_cong_no")) return "Hạn mức công nợ không được âm.";
    return "Dữ liệu khách hàng không đáp ứng ràng buộc của cơ sở dữ liệu.";
  }
  return error.message;
}

export async function kiemTraSoDienThoai(
  soDienThoai: string,
  khachHangId?: string,
) {
  const parsedPhone = soDienThoaiSchema.safeParse(soDienThoai);
  if (!parsedPhone.success || !parsedPhone.data) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kiem_tra_so_dien_thoai", {
    p_so_dien_thoai: parsedPhone.data,
    p_khach_hang_id: khachHangId ?? null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function createKhachHang(data: KhachHangSchema) {
  const validData = validateKhachHang(data);
  const supabase = await createClient();

  const { data: maKhachHang, error: maError } = await supabase.rpc("tao_ma_khach_hang");
  if (maError) throw new Error(maError.message);

  const { data: customer, error } = await supabase
    .from("khach_hang")
    .insert({
      ma_khach_hang: maKhachHang,
      ten_khach_hang: validData.ten_khach_hang,
      so_dien_thoai: validData.so_dien_thoai || null,
      email: validData.email || null,
      dia_chi: validData.dia_chi || null,
      ma_so_thue: validData.ma_so_thue || null,
      nguoi_lien_he: validData.nguoi_lien_he || null,
      han_muc_cong_no: validData.han_muc_cong_no,
      ghi_chu: validData.ghi_chu || null,
      trang_thai: validData.trang_thai,
      nhom_khach_hang_id: validData.nhom_khach_hang_id || null,
      anh_dai_dien_url: validData.anh_dai_dien_url || null,
    })
    .select()
    .single();

  if (error) throw new Error(getSaveErrorMessage(error));
  return customer;
}

export async function updateKhachHang(id: string, data: KhachHangSchema) {
  if (!id?.trim()) throw new Error("Mã khách hàng không hợp lệ.");
  const validData = validateKhachHang(data);
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from("khach_hang")
    .update({
      ten_khach_hang: validData.ten_khach_hang,
      so_dien_thoai: validData.so_dien_thoai || null,
      email: validData.email || null,
      dia_chi: validData.dia_chi || null,
      ma_so_thue: validData.ma_so_thue || null,
      nguoi_lien_he: validData.nguoi_lien_he || null,
      han_muc_cong_no: validData.han_muc_cong_no,
      ghi_chu: validData.ghi_chu || null,
      trang_thai: validData.trang_thai,
      nhom_khach_hang_id: validData.nhom_khach_hang_id || null,
      anh_dai_dien_url: validData.anh_dai_dien_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(getSaveErrorMessage(error));
  return customer;
}

export async function xoaKhachHang(id: string) {
  if (!id || !id.trim()) {
    return {
      success: false,
      requiresDeactivation: false,
      message: "Mã khách hàng không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khach_hang")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("xoaKhachHang:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    const constraintDetails = [error.message, error.details, error.hint].filter(Boolean).join(" ");
    const blockedByHistoryGuard = error.code === "23514" && error.message.includes("KHACH_HANG_CO_LICH_SU");
    const blockedByHistoryForeignKey = error.code === "23503" && /don_hang|phieu_thu|giao_dich_cong_no|phieu_thu_phan_bo/i.test(constraintDetails);
    if (blockedByHistoryGuard || blockedByHistoryForeignKey) {
      return {
        success: false,
        requiresDeactivation: true,
        message: "Khách hàng đã có lịch sử nghiệp vụ.",
      };
    }

    return {
      success: false,
      requiresDeactivation: false,
      message: "Lỗi " + (error.code || "") + ": " + error.message,
    };
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      requiresDeactivation: false,
      message: "Không tìm thấy khách hàng hoặc bạn không có quyền xóa.",
    };
  }

  return {
    success: true,
    requiresDeactivation: false,
    message: "Đã xóa khách hàng thành công.",
  };
}

export async function ngungHoatDongKhachHang(id: string) {
  if (!id || !id.trim()) {
    return { success: false, message: "Mã khách hàng không hợp lệ." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khach_hang")
    .update({ trang_thai: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("ngungHoatDongKhachHang:", error);
    return { success: false, message: "Không thể chuyển khách hàng sang Ngừng hoạt động: " + error.message };
  }

  if (!data) {
    return { success: false, message: "Không tìm thấy khách hàng hoặc bạn không có quyền cập nhật." };
  }

  return { success: true, message: "Đã chuyển khách hàng sang Ngừng hoạt động. Lịch sử được giữ nguyên." };
}


