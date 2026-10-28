import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

export type VaiTro = "owner" | "staff";

export interface UserProfile {
  id: string;
  user_id: string;
  ho_ten: string;
  vai_tro: VaiTro;
  trang_thai: "active" | "inactive";
}

/**
 * Lấy profile của user hiện đang đăng nhập.
 * Được cache trong một React render tree (mỗi request một lần).
 * Trả về null nếu chưa đăng nhập hoặc chưa có profile.
 */
export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  // 1. Nếu là email admin chính, gán vai trò owner ngay lập tức
  const isPrimaryAdmin = authData.user.email?.toLowerCase() === "admin@dongphucthanhhang.com";

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, user_id, ho_ten, vai_tro, trang_thai")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error) {
    console.error("Lỗi khi đọc user_profiles:", error);
    // Nếu có lỗi bảng/RLS nhưng là admin thì vẫn cấp quyền owner
    if (isPrimaryAdmin) {
      return {
        id: authData.user.id,
        user_id: authData.user.id,
        ho_ten: "Chủ cửa hàng",
        vai_tro: "owner",
        trang_thai: "active",
      };
    }
    return null;
  }

  if (isPrimaryAdmin) {
    return {
      id: data?.id ?? authData.user.id,
      user_id: authData.user.id,
      ho_ten: data?.ho_ten || "Chủ cửa hàng",
      vai_tro: "owner",
      trang_thai: "active",
    };
  }

  if (!data) return null;

  return data as UserProfile;
});

/**
 * Lấy vai trò của user hiện tại. Mặc định 'staff' nếu không tìm thấy.
 */
export async function getCurrentVaiTro(): Promise<VaiTro> {
  const profile = await getCurrentUserProfile();
  return profile?.vai_tro ?? "staff";
}

/**
 * Kiểm tra user hiện tại có phải owner không.
 */
export async function isOwner(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.vai_tro === "owner" && profile?.trang_thai === "active";
}
