"use server";

import { createClient } from "./server";
import { sanPhamSchema } from "@/lib/validations/san-pham";

export async function luuSanPham(id: string | null, data: unknown) {
  const parsed = sanPhamSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Thông tin sản phẩm không hợp lệ.");
  }

  const supabase = await createClient();
  const product = parsed.data;
  const representativeVariant = product.bien_the.find((variant) => variant.trang_thai) ?? product.bien_the[0];
  const { data: savedId, error } = await supabase.rpc("luu_san_pham", {
    p_san_pham_id: id,
    p_san_pham: {
      ma_san_pham: product.ma_san_pham,
      ten_san_pham: product.ten_san_pham,
      loai_san_pham_id: product.loai_san_pham_id,
      don_vi_tinh: product.don_vi_tinh,
      gia_ban: representativeVariant?.gia_ban ?? product.gia_ban,
      gia_nhap: representativeVariant?.gia_nhap ?? product.gia_nhap,
      mo_ta: product.mo_ta || null,
      trang_thai: product.trang_thai,
    },
    p_bien_the: product.bien_the,
  });

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("ma_san_pham")) {
        throw new Error("Mã sản phẩm đã tồn tại.");
      }
      if (error.message.includes("ma_sku")) {
        throw new Error("Mã SKU đã được sử dụng.");
      }
      if (error.message.includes("thuoc_tinh_uidx")) {
        throw new Error("Tổ hợp thuộc tính này đã có trong sản phẩm.");
      }
      throw new Error("Mã sản phẩm hoặc SKU đã tồn tại.");
    }
    if (error.code === "23514") {
      throw new Error("Giá nhập và giá bán phải từ 0 trở lên.");
    }
    throw new Error(error.message);
  }

  if (!savedId) throw new Error("Không nhận được mã sản phẩm sau khi lưu.");
  return savedId as string;
}

export async function xoaSanPham(id: string) {
  if (!id?.trim()) throw new Error("Mã sản phẩm không hợp lệ.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("xoa_san_pham", { p_san_pham_id: id });
  if (error) {
    if (error.code === "23503") {
      throw new Error("Không thể xóa sản phẩm vì sản phẩm hoặc biến thể đã được sử dụng trong đơn hàng. Bạn có thể ngừng kinh doanh sản phẩm thay vì xóa.");
    }
    if (error.code === "P0002") {
      throw new Error("Không tìm thấy sản phẩm hoặc bạn không có quyền xóa.");
    }
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("Chưa có hàm xóa sản phẩm trên Supabase. Hãy chạy migration 20261014160000_delete_product_safely.sql.");
    }
    throw new Error(error.message);
  }

  return { success: true };
}
