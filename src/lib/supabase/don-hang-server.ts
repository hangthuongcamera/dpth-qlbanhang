import { createClient } from "./server";
import { getNhomKhachHang } from "./nhom-khach-hang-actions";

export async function getDuLieuTaoDonHang() {
  const [supabase, groups] = await Promise.all([createClient(), getNhomKhachHang(true)]);
  const [{ data: customerRows, error: customerError }, { data: productRows, error: productError }, { data: variantRows, error: variantError }, { data: priceRows, error: priceError }] = await Promise.all([
    supabase.from("khach_hang").select("id, ma_khach_hang, ten_khach_hang, so_dien_thoai, dia_chi, nhom_khach_hang_id, la_khach_le").eq("trang_thai", true).order("ten_khach_hang"),
    supabase.from("san_pham").select("id, ma_san_pham, ten_san_pham, don_vi_tinh, gia_ban").eq("trang_thai", true).order("ten_san_pham"),
    supabase.from("bien_the_san_pham").select("id, san_pham_id, ma_sku, thuoc_tinh, gia_ban").eq("trang_thai", true),
    supabase.from("gia_nhom_khach_hang").select("nhom_khach_hang_id, san_pham_id, bien_the_san_pham_id, don_gia"),
  ]);
  if (customerError || productError || variantError || priceError) throw new Error("Không thể tải dữ liệu để tạo đơn hàng.");
  const variants = variantRows ?? [];
  const products = (productRows ?? []).map((product) => ({
    ...product,
    gia_ban: Number(product.gia_ban),
    variants: variants.filter((variant) => variant.san_pham_id === product.id).map((variant) => ({ ...variant, gia_ban: Number(variant.gia_ban) })),
  }));
  const prices = Object.fromEntries((priceRows ?? []).map((price) => [
    `${price.nhom_khach_hang_id}:${price.bien_the_san_pham_id ? `variant:${price.bien_the_san_pham_id}` : `product:${price.san_pham_id}`}`,
    Number(price.don_gia),
  ]));
  return { customers: customerRows ?? [], products, groups, prices };
}

