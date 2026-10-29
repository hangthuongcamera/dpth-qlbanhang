"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isOwner } from "@/lib/supabase/user-profile";
import { revalidatePath } from "next/cache";
import type { NhanVienRecord } from "@/lib/supabase/nhan-vien-types";

type VaiTroNhanVien = "owner" | "staff";
type TrangThaiNhanVien = "active" | "inactive";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY ở môi trường máy chủ.");
  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function internalLoginEmail() {
  return `login-${crypto.randomUUID()}@login.dongphucthanhhang.com`;
}

export async function layDanhSachNhanVien(): Promise<NhanVienRecord[]> {
  if (!(await isOwner())) throw new Error("Không có quyền truy cập.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nhan_vien_danh_sach");
  if (error) throw new Error("Không thể tải danh sách nhân viên từ Supabase.");
  return (data ?? []) as NhanVienRecord[];
}

export async function themNhanVien(input: {
  ten_dang_nhap: string;
  email?: string;
  ho_ten: string;
  mat_khau: string;
  vai_tro: VaiTroNhanVien;
}): Promise<{ error?: string }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };
  const tenDangNhap = normalizeUsername(input.ten_dang_nhap);
  const email = input.email?.trim().toLowerCase() || null;
  const hoTen = input.ho_ten.trim();
  if (!validUsername(tenDangNhap)) return { error: "Tên đăng nhập cần 3–32 ký tự, bắt đầu bằng chữ hoặc số; chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email không hợp lệ." };
  if (!hoTen || !input.mat_khau) return { error: "Vui lòng điền họ tên, tên đăng nhập và mật khẩu." };
  if (input.mat_khau.length < 6) return { error: "Mật khẩu phải có ít nhất 6 ký tự." };

  const admin = getAdminClient();
  const authEmail = email ?? internalLoginEmail();
  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password: input.mat_khau,
    email_confirm: true,
    user_metadata: { ho_ten: hoTen, ten_dang_nhap: tenDangNhap, email_lien_he: email },
  });
  if (error || !data.user) {
    const message = error?.message ?? "Không thể tạo tài khoản.";
    return { error: /already registered|already been registered/i.test(message)
      ? "Email này đã được sử dụng. Vui lòng chọn email khác." : message };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase.rpc("nhan_vien_tao_ho_so", {
    p_user_id: data.user.id,
    p_ho_ten: hoTen,
    p_vai_tro: input.vai_tro === "owner" ? "owner" : "staff",
    p_ten_dang_nhap: tenDangNhap,
    p_email: email,
    p_auth_email: authEmail,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: /ten_dang_nhap|duplicate key/i.test(profileError.message)
      ? "Tên đăng nhập hoặc email đã được sử dụng." : "Không thể tạo hồ sơ nhân viên trên Supabase." };
  }
  revalidatePath("/nhan-vien");
  return {};
}

export async function capNhatNhanVien(
  profileId: string,
  payload: { ho_ten?: string; vai_tro?: VaiTroNhanVien; trang_thai?: TrangThaiNhanVien; ten_dang_nhap?: string; email?: string | null }
): Promise<{ error?: string }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const admin = getAdminClient();
  const { data: targetRows, error: targetError } = await supabase.rpc("nhan_vien_lay_muc_tieu", { p_profile_id: profileId });
  const target = (targetRows as { user_id: string; trang_thai: TrangThaiNhanVien; email: string | null; auth_email: string }[] | null)?.[0];
  if (targetError || !target) return { error: targetError?.message || "Không tìm thấy nhân viên." };
  if (target.user_id === authData.user?.id && (payload.trang_thai === "inactive" || payload.vai_tro === "staff")) return { error: "Không thể tự vô hiệu hóa hoặc tự hạ cấp tài khoản của chính mình." };

  const hasEmailChange = Object.prototype.hasOwnProperty.call(payload, "email");
  const nextEmail = hasEmailChange ? (payload.email?.trim().toLowerCase() || null) : target.email;
  if (hasEmailChange && target.email && !nextEmail) return { error: "Không thể xóa email đã có trong hồ sơ nhân viên." };
  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return { error: "Email không hợp lệ." };
  const nextUsername = payload.ten_dang_nhap === undefined ? undefined : normalizeUsername(payload.ten_dang_nhap);
  if (nextUsername !== undefined && !validUsername(nextUsername)) return { error: "Tên đăng nhập cần 3–32 ký tự, bắt đầu bằng chữ hoặc số; chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang." };

  const changingStatus = payload.trang_thai && payload.trang_thai !== target.trang_thai;
  const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(target.user_id);
  if (authUserError || !authUserResult.user) return { error: "Không tìm thấy tài khoản đăng nhập nhân viên." };
  const previousAuthEmail = authUserResult.user.email;
  const previousMetadata = authUserResult.user.user_metadata ?? {};
  const nextAuthEmail = nextEmail ?? (previousMetadata.email_lien_he ? internalLoginEmail() : previousAuthEmail);
  const changesAuth = Boolean(changingStatus || (hasEmailChange && nextAuthEmail !== previousAuthEmail));
  if (changesAuth) {
    const { error } = await admin.auth.admin.updateUserById(target.user_id, {
      ...(changingStatus ? { ban_duration: payload.trang_thai === "inactive" ? "876600h" : "none" } : {}),
      ...(hasEmailChange ? { email: nextAuthEmail, email_confirm: true } : {}),
      user_metadata: { ...previousMetadata, ...(nextEmail ? { email_lien_he: nextEmail } : { email_lien_he: null }), ...(nextUsername ? { ten_dang_nhap: nextUsername } : {}) },
    });
    if (error) return { error: /already registered|already been registered/i.test(error.message) ? "Email này đã được sử dụng." : error.message || "Không thể cập nhật tài khoản đăng nhập." };
  }

  const { error } = await supabase.rpc("nhan_vien_cap_nhat_ho_so", {
    p_profile_id: profileId,
    p_ho_ten: payload.ho_ten ?? null,
    p_vai_tro: payload.vai_tro ?? null,
    p_trang_thai: payload.trang_thai ?? null,
    p_ten_dang_nhap: nextUsername ?? null,
    p_email: hasEmailChange ? nextEmail : null,
    p_auth_email: hasEmailChange ? nextAuthEmail : null,
  });
  if (error) {
    if (changesAuth) await admin.auth.admin.updateUserById(target.user_id, {
      ...(changingStatus ? { ban_duration: target.trang_thai === "inactive" ? "876600h" : "none" } : {}),
      ...(hasEmailChange && previousAuthEmail ? { email: previousAuthEmail, email_confirm: true } : {}),
      user_metadata: previousMetadata,
    });
    return { error: /duplicate key|ten_dang_nhap/i.test(error.message) ? "Tên đăng nhập hoặc email đã được sử dụng." : error.message || "Không thể cập nhật hồ sơ nhân viên." };
  }
  revalidatePath("/nhan-vien");
  return {};
}

export async function adminDoiMatKhauNhanVien(userId: string, matKhauMoi: string): Promise<{ error?: string }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };
  if (!matKhauMoi || matKhauMoi.length < 6) return { error: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  const { error } = await getAdminClient().auth.admin.updateUserById(userId, { password: matKhauMoi });
  if (error) return { error: error.message || "Không thể đổi mật khẩu nhân viên." };
  return {};
}

export async function xoaNhanVien(profileId: string, hardDelete = false): Promise<{ error?: string; hard_deleted?: boolean }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const admin = getAdminClient();
  const { data: targetRows, error: targetError } = await supabase.rpc("nhan_vien_lay_muc_tieu", { p_profile_id: profileId });
  const target = (targetRows as { user_id: string; trang_thai: TrangThaiNhanVien }[] | null)?.[0];
  if (targetError || !target) return { error: targetError?.message || "Không tìm thấy nhân viên." };
  if (target.user_id === authData.user?.id) return { error: "Không thể thao tác trên chính tài khoản của bạn." };
  if (hardDelete) {
    const { data: counts, error } = await supabase.rpc("nhan_vien_kiem_tra_xoa", { p_profile_id: profileId });
    if (error) return { error: error.message || "Không thể kiểm tra lịch sử nghiệp vụ." };
    const result = (Array.isArray(counts) ? counts[0] : counts) as { don_hang_count: number; phieu_thu_count: number } | null;
    if ((result?.don_hang_count ?? 0) > 0 || (result?.phieu_thu_count ?? 0) > 0) return { error: "Nhân viên đã phát sinh đơn hàng hoặc phiếu thu. Hãy vô hiệu hóa tài khoản thay vì xóa." };
    const { error: deleteError } = await admin.auth.admin.deleteUser(target.user_id);
    if (deleteError) return { error: deleteError.message };
    revalidatePath("/nhan-vien");
    return { hard_deleted: true };
  }
  const { error: banError } = await admin.auth.admin.updateUserById(target.user_id, { ban_duration: "876600h" });
  if (banError) return { error: banError.message || "Không thể vô hiệu hóa tài khoản." };
  const { error } = await supabase.rpc("nhan_vien_cap_nhat_ho_so", { p_profile_id: profileId, p_ho_ten: null, p_vai_tro: null, p_trang_thai: "inactive", p_ten_dang_nhap: null, p_email: null });
  if (error) {
    if (target.trang_thai === "active") await admin.auth.admin.updateUserById(target.user_id, { ban_duration: "none" });
    return { error: error.message || "Không thể cập nhật trạng thái hồ sơ." };
  }
  revalidatePath("/nhan-vien");
  return { hard_deleted: false };
}


