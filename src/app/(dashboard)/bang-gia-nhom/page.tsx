import { BangGiaNhomManager, type GiaNhomRow } from "@/components/khach-hang/bang-gia-nhom-manager";
import { getNhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";
import { createClient } from "@/lib/supabase/server";
import type { BienTheSanPham, SanPham } from "@/types/san-pham";

type Props = { searchParams: Promise<{ nhom?: string }> };

export default async function BangGiaNhomPage({ searchParams }: Props) {
  const [{ nhom: selectedGroupId = "" }, groups, supabase] = await Promise.all([searchParams, getNhomKhachHang(true), createClient()]);
  const [{ data: productData, error: productError }, { data: variantData, error: variantError }] = await Promise.all([
    supabase.from("san_pham").select("id, ma_san_pham, ten_san_pham, gia_ban, trang_thai").eq("trang_thai", true).order("ten_san_pham"),
    supabase.from("bien_the_san_pham").select("id, san_pham_id, ma_sku, thuoc_tinh, gia_ban, trang_thai").eq("trang_thai", true),
  ]);
  if (productError || variantError) throw new Error("Không thể tải danh sách sản phẩm để lập bảng giá nhóm.");
  const validGroupId = groups.some((group) => group.id === selectedGroupId) ? selectedGroupId : "";
  let prices: { bien_the_san_pham_id: string | null; san_pham_id: string | null; don_gia: number }[] = [];
  if (validGroupId) {
    const { data, error } = await supabase.from("gia_nhom_khach_hang").select("san_pham_id, bien_the_san_pham_id, don_gia").eq("nhom_khach_hang_id", validGroupId);
    if (error) throw new Error("Không thể tải giá nhóm.");
    prices = (data ?? []) as typeof prices;
  }

  const products = (productData ?? []) as Pick<SanPham, "id" | "ma_san_pham" | "ten_san_pham" | "gia_ban" | "trang_thai">[];
  const variants = (variantData ?? []) as Pick<BienTheSanPham, "id" | "san_pham_id" | "ma_sku" | "thuoc_tinh" | "gia_ban" | "trang_thai">[];
  const priceMap = new Map((prices ?? []).map((price) => [price.bien_the_san_pham_id ?? price.san_pham_id, Number(price.don_gia)] as const));
  const rows: GiaNhomRow[] = [];
  for (const product of products) {
    const productVariants = variants.filter((variant) => variant.san_pham_id === product.id);
    if (productVariants.length) {
      for (const variant of productVariants) {
        const attrs = Object.entries(variant.thuoc_tinh ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
        rows.push({ key: variant.id, sanPhamId: product.id, bienTheId: variant.id, tenSanPham: product.ten_san_pham, maSanPham: product.ma_san_pham, tenBienThe: attrs, maSku: variant.ma_sku, giaMacDinh: Number(variant.gia_ban), giaNhom: priceMap.get(variant.id) ?? null });
      }
    } else {
      rows.push({ key: product.id, sanPhamId: product.id, bienTheId: null, tenSanPham: product.ten_san_pham, maSanPham: product.ma_san_pham, tenBienThe: "", maSku: "", giaMacDinh: Number(product.gia_ban), giaNhom: priceMap.get(product.id) ?? null });
    }
  }
  return <BangGiaNhomManager key={validGroupId || "no-group"} groups={groups} rows={rows} selectedGroupId={validGroupId} />;
}

