import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * POST /api/nhan-vien/tao
 * Body: { email: string, ho_ten: string, mat_khau: string }
 * Header: Authorization: Bearer <access_token>
 *
 * Chỉ chủ shop (owner) mới gọi được endpoint này.
 * Dùng service role key để tạo user mà không cần xác nhận email.
 */
export async function POST(req: NextRequest) {
  // 1. Xác thực caller là owner (dùng user token)
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const { data: callerProfile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("vai_tro, trang_thai")
    .eq("user_id", authData.user.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.vai_tro !== "owner" || callerProfile.trang_thai !== "active") {
    return NextResponse.json({ error: "Không có quyền tạo nhân viên." }, { status: 403 });
  }

  // 2. Parse body
  const body = (await req.json()) as { email?: string; ho_ten?: string; mat_khau?: string };
  const { email, ho_ten, mat_khau } = body;

  if (!email || !ho_ten || !mat_khau) {
    return NextResponse.json({ error: "Thiếu email, họ tên hoặc mật khẩu." }, { status: 400 });
  }
  if (mat_khau.length < 6) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
  }

  // 3. Tạo user bằng service role (không cần xác nhận email)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Cấu hình server chưa đầy đủ (thiếu SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password: mat_khau,
    email_confirm: true, // Bỏ qua bước xác nhận email
    user_metadata: { ho_ten },
  });

  if (createErr) {
    // Trả thông báo lỗi thân thiện hơn
    if (createErr.message.includes("already registered") || createErr.message.includes("already been registered")) {
      return NextResponse.json({ error: "Email này đã được sử dụng. Vui lòng dùng email khác." }, { status: 409 });
    }
    return NextResponse.json({ error: createErr.message }, { status: 400 });
  }

  // 4. Đảm bảo profile được tạo với vai_tro = 'staff' (trigger sẽ làm, nhưng upsert để chắc)
  if (newUser.user) {
    await adminClient.from("user_profiles").upsert(
      { user_id: newUser.user.id, ho_ten, vai_tro: "staff", trang_thai: "active" },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.json({ success: true, user_id: newUser.user?.id });
}
