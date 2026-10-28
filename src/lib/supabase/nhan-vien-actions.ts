"use server";

import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/supabase/user-profile";
import { revalidatePath } from "next/cache";

export interface NhanVienRecord {
  id: string;
  user_id: string;
  ho_ten: string;
  vai_tro: "owner" | "staff";
  trang_thai: "active" | "inactive";
  created_at: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Danh sách nhân viên (owner only)
// ---------------------------------------------------------------------------
export async function layDanhSachNhanVien(): Promise<NhanVienRecord[]> {
  if (!(await isOwner())) throw new Error("Không có quyền truy cập.");

  const supabase = await createClient();

  // Lấy profiles
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, user_id, ho_ten, vai_tro, trang_thai, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Không thể tải danh sách nhân viên.");

  return (profiles ?? []) as NhanVienRecord[];
}

// ---------------------------------------------------------------------------
// Tạo nhân viên mới (owner only)
// Dùng Route Handler /api/nhan-vien/tao vì cần service role key
// ---------------------------------------------------------------------------
export async function themNhanVien(formData: FormData): Promise<{ error?: string }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const hoTen = (formData.get("ho_ten") as string | null)?.trim() ?? "";
  const matKhau = (formData.get("mat_khau") as string | null) ?? "";

  if (!email || !hoTen || !matKhau) {
    return { error: "Vui lòng điền đầy đủ email, họ tên và mật khẩu." };
  }
  if (matKhau.length < 6) {
    return { error: "Mật khẩu phải có ít nhất 6 ký tự." };
  }

  // Gọi Route Handler (chứa service role key ở server)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? "";

  const res = await fetch(`${baseUrl}/api/nhan-vien/tao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ email, ho_ten: hoTen, mat_khau: matKhau }),
  });

  const json = (await res.json()) as { error?: string };
  if (!res.ok || json.error) {
    return { error: json.error ?? "Không thể tạo tài khoản nhân viên." };
  }

  revalidatePath("/nhan-vien");
  return {};
}

// ---------------------------------------------------------------------------
// Cập nhật họ tên & trạng thái nhân viên (owner only)
// ---------------------------------------------------------------------------
export async function capNhatNhanVien(
  profileId: string,
  payload: { ho_ten?: string; trang_thai?: "active" | "inactive" }
): Promise<{ error?: string }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", profileId);

  if (error) return { error: "Không thể cập nhật thông tin nhân viên." };

  revalidatePath("/nhan-vien");
  return {};
}

// ---------------------------------------------------------------------------
// Xóa nhân viên (owner only, không xóa bản thân / owner khác)
// ---------------------------------------------------------------------------
export async function xoaNhanVien(profileId: string): Promise<{ error?: string }> {
  if (!(await isOwner())) return { error: "Không có quyền thực hiện." };

  const supabase = await createClient();

  // Lấy thông tin profile cần xóa
  const { data: target, error: fetchErr } = await supabase
    .from("user_profiles")
    .select("user_id, vai_tro")
    .eq("id", profileId)
    .single();

  if (fetchErr || !target) return { error: "Không tìm thấy nhân viên." };
  if (target.vai_tro === "owner") return { error: "Không thể xóa tài khoản chủ cửa hàng." };

  // Xóa profile (cascade xóa auth.users không tự động — chỉ xóa profile để ẩn khỏi danh sách)
  // Thay vào đó: đánh trang_thai = 'inactive' và thu hồi quyền đăng nhập qua service role
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? "";

  const res = await fetch(`${baseUrl}/api/nhan-vien/xoa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ user_id: target.user_id, profile_id: profileId }),
  });

  const json = (await res.json()) as { error?: string };
  if (!res.ok || json.error) {
    return { error: json.error ?? "Không thể xóa nhân viên." };
  }

  revalidatePath("/nhan-vien");
  return {};
}
