"use server";

import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Thiếu cấu hình máy chủ Supabase.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function dangNhap(input: { ten_dang_nhap: string; mat_khau: string }): Promise<{ error?: string }> {
  const credential = input.ten_dang_nhap.trim();
  if (!credential || !input.mat_khau) return { error: "Vui lòng nhập tên đăng nhập/email và mật khẩu." };
  let email = credential.toLowerCase();
  if (!email.includes("@")) {
    const admin = getAdminClient();
    const { data, error } = await admin.from("user_profiles").select("auth_email, trang_thai").eq("ten_dang_nhap", credential.toLowerCase()).maybeSingle();
    if (error || !data?.auth_email || data.trang_thai !== "active") return { error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
    email = data.auth_email;
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: input.mat_khau });
  if (error) return { error: "Tên đăng nhập/email hoặc mật khẩu không chính xác." };
  return {};
}

