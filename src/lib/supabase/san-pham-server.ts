import { createClient } from "./server";
import type { LoaiSanPham, SanPham } from "@/types/san-pham";

export async function getLoaiSanPham(includeInactive = false): Promise<LoaiSanPham[]> {
  const supabase = await createClient();
  let query = supabase
    .from("loai_san_pham")
    .select("id, ma_loai, ten_loai, trang_thai")
    .order("ten_loai", { ascending: true });

  if (!includeInactive) query = query.eq("trang_thai", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LoaiSanPham[];
}

export async function getSanPhamById(id: string): Promise<SanPham> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("san_pham")
    .select("*, loai_san_pham(ten_loai)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!product) throw new Error("Không tìm thấy sản phẩm.");

  const { data: variants, error: variantError } = await supabase
    .from("bien_the_san_pham")
    .select("*")
    .eq("san_pham_id", id)
    .order("created_at", { ascending: true });

  if (variantError) throw new Error(variantError.message);
  return { ...product, bien_the_san_pham: variants ?? [] } as SanPham;
}

export async function getMaSanPhamTiepTheo(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tao_ma_san_pham_tiep_theo");
  if (error || typeof data !== "string") {
    throw new Error("Không thể lấy mã sản phẩm tự động. Hãy chạy migration sinh mã sản phẩm trên Supabase.");
  }
  return data;
}
