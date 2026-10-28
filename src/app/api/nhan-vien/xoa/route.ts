import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * POST /api/nhan-vien/xoa
 * Body: { user_id: string, profile_id: string }
 * Header: Authorization: Bearer <access_token>
 *
 * Vô hiệu hóa tài khoản nhân viên (ban user trong Supabase Auth + đánh inactive profile).
 * Chỉ owner mới gọi được, không thể xóa owner khác.
 */
export async function POST(req: NextRequest) {
  // 1. Xác thực caller là owner
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
    return NextResponse.json({ error: "Không có quyền thực hiện." }, { status: 403 });
  }

  // 2. Parse body
  const body = (await req.json()) as { user_id?: string; profile_id?: string };
  const { user_id, profile_id } = body;
  if (!user_id || !profile_id) {
    return NextResponse.json({ error: "Thiếu thông tin nhân viên." }, { status: 400 });
  }

  // 3. Không cho xóa chính mình
  if (user_id === authData.user.id) {
    return NextResponse.json({ error: "Không thể xóa tài khoản của chính mình." }, { status: 400 });
  }

  // 4. Kiểm tra target không phải owner
  const { data: targetProfile } = await supabase
    .from("user_profiles")
    .select("vai_tro")
    .eq("id", profile_id)
    .single();

  if (targetProfile?.vai_tro === "owner") {
    return NextResponse.json({ error: "Không thể xóa tài khoản chủ cửa hàng." }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Cấu hình server chưa đầy đủ." }, { status: 500 });
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 5. Cập nhật profile → inactive
  await adminClient.from("user_profiles").update({ trang_thai: "inactive" }).eq("id", profile_id);

  // 6. Ban user trong Supabase Auth (vô hiệu hóa đăng nhập)
  await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876600h" }); // ~100 năm

  return NextResponse.json({ success: true });
}
