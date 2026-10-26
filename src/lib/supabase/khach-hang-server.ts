import { createClient } from "./server";
import type { KhachHang } from "@/types/khach-hang";

export async function getKhachHang(): Promise<KhachHang[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("khach_hang")
    .select("*")
    .eq("la_khach_le", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getKhachHang:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getKhachHangById(
  id: string
): Promise<KhachHang> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("khach_hang")
    .select("*")
    .eq("la_khach_le", false)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getKhachHangById:", error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Không tìm thấy khách hàng.");
  }

  return data;
}
