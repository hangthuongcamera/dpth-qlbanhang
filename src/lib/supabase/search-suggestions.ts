"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeVietnameseSearch } from "@/lib/search/normalize-vietnamese";

export type CustomerSearchSuggestion = {
  id: string;
  ma_khach_hang: string;
  ten_khach_hang: string;
  so_dien_thoai: string | null;
};

export type ReceiptSearchSuggestion = {
  id: string;
  ma_phieu_thu: string;
  ngay_thu: string;
  tong_tien: number;
  trang_thai: string;
  ma_khach_hang: string | null;
  ten_khach_hang: string | null;
};

export async function goiYKhachHang(searchText: string) {
  const query = normalizeVietnameseSearch(searchText).slice(0, 100);
  const supabase = await createClient();
  let request = supabase
    .from("v_khach_hang_tim_kiem")
    .select("id, ma_khach_hang, ten_khach_hang, so_dien_thoai")
    .eq("la_khach_le", false);
  if (query) request = request.ilike("tu_khoa_khong_dau", `%${query.replace(/[\\%_,]/g, "\\$&")}%`);
  const { data, error } = await request
    .order("ten_khach_hang")
    .limit(8);

  if (error) {
    console.error("Lỗi tìm gợi ý khách hàng:", error);
    return [] as CustomerSearchSuggestion[];
  }
  return (data ?? []) as CustomerSearchSuggestion[];
}

export async function goiYPhieuThu(searchText: string) {
  const query = normalizeVietnameseSearch(searchText).slice(0, 100);
  const supabase = await createClient();
  let request = supabase
    .from("v_phieu_thu_tim_kiem")
    .select("id, ma_phieu_thu, ngay_thu, tong_tien, trang_thai, ma_khach_hang, ten_khach_hang");
  if (query) request = request.ilike("tu_khoa_khong_dau", `%${query.replace(/[\\%_,]/g, "\\$&")}%`);
  const { data, error } = await request.order("ngay_thu", { ascending: false }).limit(8);

  if (error) {
    console.error("Lỗi tìm gợi ý phiếu thu:", error);
    return [] as ReceiptSearchSuggestion[];
  }
  return (data ?? []).map((item) => ({ ...item, tong_tien: Number(item.tong_tien) })) as ReceiptSearchSuggestion[];
}
