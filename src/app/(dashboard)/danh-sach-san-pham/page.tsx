import { redirect } from "next/navigation";

import { ProductTable } from "@/components/san-pham/product-table";
import { createClient } from "@/lib/supabase/server";
import { getLoaiSanPham } from "@/lib/supabase/san-pham-server";
import type { BienTheSanPham, LoaiSanPham, SanPham } from "@/types/san-pham";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [10, 20, 50, 100];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SanPhamPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const read = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const requestedSize = Number(read("pageSize"));
  const pageSize = PAGE_SIZES.includes(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE;
  const requestedPage = Number(read("page") ?? 1);
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = read("search")?.trim() ?? "";
  const statusValue = read("status");
  const status = statusValue === "active" || statusValue === "inactive" ? statusValue : "all";
  const categoryId = read("category") ?? "";
  const categories = await getLoaiSanPham(true);
  const supabase = await createClient();

  let query = supabase
    .from("san_pham")
    .select("*, loai_san_pham(ten_loai)", { count: "exact" });
  if (search) {
    const escaped = search.replace(/[,%()]/g, "\\$&");
    query = query.or(`ma_san_pham.ilike.%${escaped}%,ten_san_pham.ilike.%${escaped}%`);
  }
  if (status !== "all") query = query.eq("trang_thai", status === "active");
  if (categoryId) query = query.eq("loai_san_pham_id", categoryId);

  const from = (currentPage - 1) * pageSize;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw new Error("Không thể tải danh sách sản phẩm.");

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (currentPage > totalPages) {
    const next = new URLSearchParams();
    if (totalPages > 1) next.set("page", String(totalPages));
    if (pageSize !== DEFAULT_PAGE_SIZE) next.set("pageSize", String(pageSize));
    if (search) next.set("search", search);
    if (status !== "all") next.set("status", status);
    if (categoryId) next.set("category", categoryId);
    redirect(next.size ? `/danh-sach-san-pham?${next}` : "/danh-sach-san-pham");
  }

  const rows = (data ?? []) as unknown as SanPham[];
  const ids = rows.map((product) => product.id);
  let variants: BienTheSanPham[] = [];
  if (ids.length) {
    const { data: variantData, error: variantError } = await supabase
      .from("bien_the_san_pham")
      .select("id, san_pham_id, ma_sku, thuoc_tinh, gia_ban, gia_nhap, trang_thai")
      .in("san_pham_id", ids)
      .order("created_at", { ascending: true });
    if (variantError) throw new Error("Không thể tải biến thể sản phẩm.");
    variants = (variantData ?? []) as BienTheSanPham[];
  }
  const byProduct = new Map<string, BienTheSanPham[]>();
  variants.forEach((variant) => byProduct.set(variant.san_pham_id, [...(byProduct.get(variant.san_pham_id) ?? []), variant]));
  const products = rows.map((product) => ({ ...product, bien_the_san_pham: byProduct.get(product.id) ?? [] }));

  return <div className="app-page"><ProductTable products={products} categories={categories as LoaiSanPham[]} search={search} status={status} categoryId={categoryId} currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} /></div>;
}

