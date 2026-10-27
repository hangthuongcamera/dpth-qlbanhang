"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronUp, CheckCircle2, Search, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LoaiSanPham, SanPham } from "@/types/san-pham";

type ProductTableProps = {
  products: SanPham[];
  categories: LoaiSanPham[];
  search: string;
  status: "all" | "active" | "inactive";
  categoryId: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
};

type Notification = { type: "success" | "error"; message: string } | null;

export function ProductTable({
  products,
  categories,
  search,
  status,
  categoryId,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
}: ProductTableProps) {
  const router = useRouter();
  const [notification, setNotification] = useState<Notification>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedNotification = sessionStorage.getItem("san-pham-notification");
      if (!storedNotification) return;
      sessionStorage.removeItem("san-pham-notification");
      try {
        setNotification(JSON.parse(storedNotification) as Notification);
      } catch {
        setNotification(null);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeoutId = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [notification]);

  useEffect(() => {
    if (isComposing) return;
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (categoryId) params.set("category", categoryId);
      if (pageSize !== 10) params.set("pageSize", String(pageSize));
      if (nextSearch) params.set("search", nextSearch);
      const query = params.toString();
      router.replace(query ? `/danh-sach-san-pham?${query}` : "/danh-sach-san-pham", { scroll: false });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, search, status, categoryId, pageSize, isComposing, router]);

  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(() => new Set());

  const getHref = (overrides: Partial<{ page: number; search: string; status: string; category: string; pageSize: number }> = {}) => {
    const params = new URLSearchParams();
    const nextPage = overrides.page ?? currentPage;
    const nextSearch = overrides.search ?? search;
    const nextStatus = overrides.status ?? status;
    const nextCategory = overrides.category ?? categoryId;
    const nextPageSize = overrides.pageSize ?? pageSize;
    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextSearch) params.set("search", nextSearch);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextCategory) params.set("category", nextCategory);
    if (nextPageSize !== 10) params.set("pageSize", String(nextPageSize));
    const query = params.toString();
    return query ? `/danh-sach-san-pham?${query}` : "/danh-sach-san-pham";
  };

  const formatCurrency = (value: number) =>
    `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} ₫`;

  const activeCount = products.filter((product) => product.trang_thai).length;

  return (
    <>
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300 ${notification.type === "success" ? "border-emerald-200" : "border-red-200"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}
          <p className={`flex-1 text-sm ${notification.type === "success" ? "text-emerald-800" : "text-red-700"}`}>
            {notification.message}
          </p>
          <button type="button" onClick={() => setNotification(null)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng thông báo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    <div className="min-w-0 space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={() => router.push("/danh-sach-san-pham/them")} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_200px_190px] sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Tìm sản phẩm
          <span className="relative block">
            <Search aria-hidden="true" className="app-search-icon" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => {
              setSearchInput(event.currentTarget.value);
              setIsComposing(false);
            }}
            placeholder="Mã hoặc tên sản phẩm"
            className="app-search-input font-normal"
          />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Loại sản phẩm
          <select value={categoryId} onChange={(event) => router.push(getHref({ page: 1, category: event.target.value, search: searchInput.trim() }))} className="h-10 rounded-md border border-slate-200 bg-white px-3 font-normal">
            <option value="">Tất cả loại</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.ten_loai}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Trạng thái
          <select value={status} onChange={(event) => router.push(getHref({ page: 1, status: event.target.value, search: searchInput.trim() }))} className="h-10 rounded-md border border-slate-200 bg-white px-3 font-normal">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang kinh doanh</option>
            <option value="inactive">Ngừng kinh doanh</option>
          </select>
        </label>
      </div>

      <div className="app-data-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" aria-label="Mở hoặc thu gọn biến thể" />
              <TableHead>Mã sản phẩm</TableHead>
              <TableHead>Sản phẩm / thuộc tính</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-32 text-center text-sm text-slate-500">Không tìm thấy sản phẩm.</TableCell></TableRow>
            ) : products.map((product) => {
              const variants = product.bien_the_san_pham ?? [];
              const hasVariantAttributes = variants.some((variant) => variant.trang_thai && Object.keys(variant.thuoc_tinh ?? {}).length > 0);
              const isExpanded = expandedProducts.has(product.id);

              return (
                <Fragment key={product.id}>
                  <TableRow>
                    <TableCell className="w-10 px-1">
                      {hasVariantAttributes && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Thu gọn" : "Mở rộng"} biến thể ${product.ten_san_pham}`} onClick={() => setExpandedProducts((current) => { const next = new Set(current); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); return next; })}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{product.ma_san_pham}</TableCell>
                    <TableCell>
                      <Link href={`/danh-sach-san-pham/${product.id}`} className="font-medium text-slate-900 hover:text-primary hover:underline">{product.ten_san_pham}</Link>
                    </TableCell>
                    <TableCell>{product.loai_san_pham?.ten_loai ?? "—"}</TableCell>
                    <TableCell>{product.don_vi_tinh || "—"}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${product.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {product.trang_thai ? "Đang kinh doanh" : "Ngừng kinh doanh"}
                      </span>
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasVariantAttributes && <TableRow>
                    <TableCell colSpan={6} className="bg-slate-50 p-0">
                      <div className="overflow-x-auto px-4 py-3 sm:px-8">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead className="bg-slate-100 text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2.5">Tên biến thể / SKU</th><th className="px-3 py-2.5">Giá bán</th><th className="px-3 py-2.5">Trạng thái</th></tr></thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {variants.map((variant) => <tr key={variant.id} tabIndex={0} className="cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" onClick={() => router.push(`/danh-sach-san-pham/${product.id}/bien-the/${variant.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/danh-sach-san-pham/${product.id}/bien-the/${variant.id}`); } }}>
                              <td className="px-3 py-3"><div className="font-medium text-primary">{[product.ten_san_pham, ...Object.entries(variant.thuoc_tinh ?? {}).map(([name, value]) => `${name}: ${value}`)].join(" – ")}</div><div className="mt-0.5 text-xs text-slate-500">SKU: {variant.ma_sku || "—"}</div></td>
                              <td className="whitespace-nowrap px-3 py-3">{formatCurrency(Number(variant.gia_ban))}</td>
                              <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${variant.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{variant.trang_thai ? "Đang kinh doanh" : "Ngừng kinh doanh"}</span></td>
                            </tr>)}
                          </tbody>
                        </table>
                      </div>
                    </TableCell>
                  </TableRow>}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>{totalCount ? `Hiển thị ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalCount)} trong ${totalCount} sản phẩm` : "Chưa có dữ liệu"} · {activeCount} đang kinh doanh ở trang này</span>
          <label className="flex items-center gap-2">
            Số dòng
            <span className="relative">
              <select value={pageSize} onChange={(event) => router.push(getHref({ page: 1, pageSize: Number(event.target.value), search: searchInput.trim() }))} className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm">
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => router.push(getHref({ page: currentPage - 1 }))}>Trước</Button>
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
            .map((page) => <Button key={page} size="sm" variant={page === currentPage ? "default" : "outline"} aria-current={page === currentPage ? "page" : undefined} onClick={() => router.push(getHref({ page }))}>{page}</Button>)}
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => router.push(getHref({ page: currentPage + 1 }))}>Sau</Button>
        </div>
      </div>
    </div>
    </>
  );
}




