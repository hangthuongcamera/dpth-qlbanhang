import { redirect } from "next/navigation";

import { CategoryManager } from "@/components/san-pham/category-manager";
import { getMaLoaiSanPhamTiepTheo } from "@/lib/supabase/loai-san-pham-actions";
import { createClient } from "@/lib/supabase/server";
import type { LoaiSanPham } from "@/types/san-pham";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [10, 20, 50, 100];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DanhMucSanPhamPage({ searchParams }: PageProps) {
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
  const supabase = await createClient();
  let query = supabase
    .from("loai_san_pham")
    .select("id, ma_loai, ten_loai, trang_thai", { count: "exact" });

  if (search) {
    const escapedSearch = search.replace(/[,%()]/g, "\\$&");
    query = query.or(`ma_loai.ilike.%${escapedSearch}%,ten_loai.ilike.%${escapedSearch}%`);
  }

  const from = (currentPage - 1) * pageSize;
  const { data, error, count } = await query
    .order("ten_loai", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw new Error("Không thể tải danh mục sản phẩm.");

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (currentPage > totalPages) {
    const next = new URLSearchParams();
    if (totalPages > 1) next.set("page", String(totalPages));
    if (pageSize !== DEFAULT_PAGE_SIZE) next.set("pageSize", String(pageSize));
    if (search) next.set("search", search);
    const queryString = next.toString();
    redirect(queryString ? `/danh-muc-san-pham?${queryString}` : "/danh-muc-san-pham");
  }

  const initialNextCode = await getMaLoaiSanPhamTiepTheo();

  return (
    <CategoryManager
      categories={(data ?? []) as LoaiSanPham[]}
      initialNextCode={initialNextCode}
      search={search}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={pageSize}
    />
  );
}
