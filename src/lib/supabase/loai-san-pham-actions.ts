"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "./server";

export type LoaiSanPhamMoi = {
  id: string;
  ma_loai: string;
  ten_loai: string;
  trang_thai: boolean;
};

function getRpcRow(data: unknown): LoaiSanPhamMoi | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? row as LoaiSanPhamMoi : null;
}

function mapCategoryError(error: { code?: string; message?: string }, fallback: string): Error {
  if (error.code === "23505") return new Error("Mã danh mục sản phẩm đã tồn tại.");
  if (error.message?.includes("CATEGORY_IN_USE") || error.code === "23503") {
    return new Error("Không thể xóa danh mục vì đang có sản phẩm thuộc danh mục này.");
  }
  if (error.code === "P0002") return new Error("Không tìm thấy danh mục sản phẩm.");
  if (error.code === "PGRST202" || error.code === "42883") {
    return new Error("Chưa có các hàm quản lý danh mục trên Supabase. Hãy chạy migration 20261015100000_product_category_crud_and_code_reuse.sql.");
  }
  return new Error(error.message || fallback);
}

export async function getMaLoaiSanPhamTiepTheo(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ma_loai_san_pham_tiep_theo");
  if (error || typeof data !== "string") {
    throw mapCategoryError(error ?? {}, "Không thể tạo mã danh mục tự động.");
  }
  return data;
}

export async function taoLoaiSanPham(maLoai: string | null, tenLoai: string): Promise<LoaiSanPhamMoi> {
  const ma = maLoai?.trim() || null;
  const ten = tenLoai.trim();
  if (ma && ma.length > 100) throw new Error("Mã danh mục không được vượt quá 100 ký tự.");
  if (!ten || ten.length > 255) throw new Error("Tên danh mục phải có từ 1 đến 255 ký tự.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tao_loai_san_pham", {
    p_ma_loai: ma,
    p_ten_loai: ten,
  });
  if (error) throw mapCategoryError(error, "Không thể tạo danh mục sản phẩm.");
  const category = getRpcRow(data);
  if (!category) throw new Error("Không nhận được thông tin danh mục vừa tạo.");

  revalidatePath("/danh-muc-san-pham");
  revalidatePath("/danh-sach-san-pham");
  return category;
}

export async function capNhatLoaiSanPham(category: LoaiSanPhamMoi): Promise<LoaiSanPhamMoi> {
  const ma = category.ma_loai.trim();
  const ten = category.ten_loai.trim();
  if (!ma || ma.length > 100) throw new Error("Mã danh mục phải có từ 1 đến 100 ký tự.");
  if (!ten || ten.length > 255) throw new Error("Tên danh mục phải có từ 1 đến 255 ký tự.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cap_nhat_loai_san_pham", {
    p_id: category.id,
    p_ma_loai: ma,
    p_ten_loai: ten,
    p_trang_thai: category.trang_thai,
  });
  if (error) throw mapCategoryError(error, "Không thể cập nhật danh mục sản phẩm.");
  const updatedCategory = getRpcRow(data);
  if (!updatedCategory) throw new Error("Không nhận được thông tin danh mục vừa cập nhật.");

  revalidatePath("/danh-muc-san-pham");
  revalidatePath("/danh-sach-san-pham");
  return updatedCategory;
}

export async function xoaLoaiSanPham(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("xoa_loai_san_pham", { p_id: id });
  if (error) throw mapCategoryError(error, "Không thể xóa danh mục sản phẩm.");
  revalidatePath("/danh-muc-san-pham");
  revalidatePath("/danh-sach-san-pham");
}
