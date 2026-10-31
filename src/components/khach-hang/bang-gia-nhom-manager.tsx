"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capNhatGiaBanMacDinh } from "@/lib/supabase/san-pham-actions";
import { luuGiaNhomKhachHang, type NhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";
import { normalizeVietnameseSearch } from "@/lib/search/normalize-vietnamese";
import { formatCurrency, formatNumber, parseCurrencyInput } from "@/types/don-hang";

export type GiaNhomRow = {
  key: string;
  sanPhamId: string;
  bienTheId: string | null;
  tenSanPham: string;
  maSanPham: string;
  tenBienThe: string;
  maSku: string;
  giaMacDinh: number;
  giaNhom: number | null;
};

export type GiaNhomProduct = {
  id: string;
  tenSanPham: string;
  maSanPham: string;
  rows: GiaNhomRow[];
  coBienThe: boolean;
};

type RowStatus = "dirty" | "saving" | "saved" | "error";

function PriceEditor({
  row,
  isDefaultMode,
  value,
  status,
  error,
  onChange,
  onBlur,
}: {
  row: GiaNhomRow;
  isDefaultMode: boolean;
  value: string;
  status?: RowStatus;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const targetName = row.tenBienThe || row.tenSanPham;
  const statusId = `gia-nhom-status-${row.key}`;
  return (
    <div className="min-w-0">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={status === "saving"}
        onChange={(event) => onChange(event.target.value === "" ? "" : formatNumber(parseCurrencyInput(event.target.value)))}
        onBlur={onBlur}
        placeholder={isDefaultMode ? "Nhập giá mặc định" : "Dùng giá mặc định"}
        className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 disabled:bg-slate-100 md:max-w-40"
        aria-label={`${isDefaultMode ? "Giá mặc định" : "Giá nhóm"} cho ${targetName}`}
        aria-describedby={status ? statusId : undefined}
      />
      {status && <p id={statusId} role={status === "error" ? "alert" : "status"} className={`mt-1 text-xs ${status === "error" ? "text-red-600" : status === "dirty" ? "text-amber-700" : "text-slate-500"}`}>
        {status === "saving" ? "Đang lưu..." : status === "saved" ? "Đã lưu" : status === "dirty" ? "Chưa lưu" : error}
      </p>}
    </div>
  );
}

export function BangGiaNhomManager({ products, groups, selectedGroupId }: { products: GiaNhomProduct[]; groups: NhomKhachHang[]; selectedGroupId: string }) {
  const router = useRouter();
  const group = groups.find((item) => item.id === selectedGroupId);
  const isDefaultMode = !selectedGroupId;
  const allRows = useMemo(() => products.flatMap((product) => product.rows), [products]);
  const initialValues = () => Object.fromEntries(allRows.map((row) => [row.key, isDefaultMode ? formatNumber(row.giaMacDinh) : row.giaNhom === null ? "" : formatNumber(row.giaNhom)]));
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [savedValues, setSavedValues] = useState<Record<string, string>>(initialValues);
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(() => new Set());
  const pendingSaves = useRef(new Map<string, Promise<boolean>>());

  const filteredProducts = useMemo(() => {
    const query = normalizeVietnameseSearch(search);
    if (!query) return products;
    return products.filter((product) => {
      const productText = normalizeVietnameseSearch(`${product.maSanPham} ${product.tenSanPham}`);
      return productText.includes(query) || product.rows.some((row) => normalizeVietnameseSearch(`${row.maSku} ${row.tenBienThe}`).includes(query));
    });
  }, [products, search]);

  useEffect(() => {
    if (isComposing) return;
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      setSearch(nextSearch);
      setCurrentPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isComposing, search, searchInput]);

  async function persistPrice(row: GiaNhomRow): Promise<boolean> {
    const raw = values[row.key]?.trim() ?? "";
    const price = raw === "" ? null : parseCurrencyInput(raw);
    if ((isDefaultMode && price === null) || (price !== null && (!Number.isSafeInteger(price) || price < 0))) {
      setRowStatuses((current) => ({ ...current, [row.key]: "error" }));
      setRowErrors((current) => ({ ...current, [row.key]: isDefaultMode && price === null ? "Giá mặc định không được để trống." : "Giá phải là số nguyên VND không âm." }));
      return false;
    }

    const savedRaw = savedValues[row.key]?.trim() ?? "";
    const savedPrice = savedRaw === "" ? null : parseCurrencyInput(savedRaw);
    if (price === savedPrice) {
      setRowStatuses((current) => ({ ...current, [row.key]: "saved" }));
      setRowErrors((current) => ({ ...current, [row.key]: "" }));
      return true;
    }

    setRowStatuses((current) => ({ ...current, [row.key]: "saving" }));
    setRowErrors((current) => ({ ...current, [row.key]: "" }));
    try {
      if (isDefaultMode) {
        await capNhatGiaBanMacDinh({ sanPhamId: row.sanPhamId, bienTheId: row.bienTheId, donGia: price as number });
      } else {
        await luuGiaNhomKhachHang({ nhomId: selectedGroupId, sanPhamId: row.sanPhamId, bienTheId: row.bienTheId, donGia: price });
      }
      const normalized = price === null ? "" : formatNumber(price);
      setSavedValues((current) => ({ ...current, [row.key]: normalized }));
      setRowStatuses((current) => ({ ...current, [row.key]: "saved" }));
      setRowErrors((current) => ({ ...current, [row.key]: "" }));
      router.refresh();
      return true;
    } catch (error) {
      setRowStatuses((current) => ({ ...current, [row.key]: "error" }));
      setRowErrors((current) => ({ ...current, [row.key]: error instanceof Error ? error.message : "Không thể lưu giá." }));
      return false;
    }
  }

  function save(row: GiaNhomRow): Promise<boolean> {
    const pending = pendingSaves.current.get(row.key);
    if (pending) return pending;
    const request = persistPrice(row);
    pendingSaves.current.set(row.key, request);
    void request.then(() => {
      if (pendingSaves.current.get(row.key) === request) pendingSaves.current.delete(row.key);
    });
    return request;
  }

  async function savePendingChanges() {
    const dirtyRows = allRows.filter((row) => {
      const raw = values[row.key]?.trim() ?? "";
      const savedRaw = savedValues[row.key]?.trim() ?? "";
      const price = raw === "" ? null : parseCurrencyInput(raw);
      const savedPrice = savedRaw === "" ? null : parseCurrencyInput(savedRaw);
      return price !== savedPrice;
    });
    const results = await Promise.all(dirtyRows.map((row) => save(row)));
    return results.every(Boolean);
  }

  async function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    if (await savePendingChanges()) setCurrentPage(page);
  }

  async function changePageSize(size: number) {
    if (await savePendingChanges()) {
      setPageSize(size);
      setCurrentPage(1);
    }
  }

  function setPrice(row: GiaNhomRow, value: string) {
    setValues((current) => ({ ...current, [row.key]: value === "" ? "" : formatNumber(parseCurrencyInput(value)) }));
    setRowStatuses((current) => ({ ...current, [row.key]: "dirty" }));
    setRowErrors((current) => ({ ...current, [row.key]: "" }));
  }

  function editPrice(row: GiaNhomRow) {
    return <PriceEditor
      row={row}
      isDefaultMode={isDefaultMode}
      value={values[row.key] ?? ""}
      status={rowStatuses[row.key]}
      error={rowErrors[row.key]}
      onChange={(value) => setPrice(row, value)}
      onBlur={() => void save(row)}
    />;
  }

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstProduct = filteredProducts.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastProduct = Math.min(currentPage * pageSize, filteredProducts.length);
  const pageNumbers = Array.from(new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);

  return <div className="min-w-0 space-y-4 app-page">
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:items-end">
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
        Tìm sản phẩm
        <span className="relative block">
          <Search aria-hidden="true" className="app-search-icon" />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => { setSearchInput(event.currentTarget.value); setIsComposing(false); }}
            placeholder="Tìm mã, SKU, tên hoặc thuộc tính"
            aria-label="Tìm sản phẩm theo mã, SKU, tên hoặc thuộc tính"
            className="app-search-input font-normal"
          />
        </span>
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
        Nhóm khách hàng
        <select value={selectedGroupId} onChange={(event) => router.push(event.target.value ? `/bang-gia-nhom?nhom=${event.target.value}` : "/bang-gia-nhom")} className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 font-normal">
          <option value="">Giá mặc định</option>
          {groups.map((item) => <option key={item.id} value={item.id}>{item.ten_nhom}{item.trang_thai ? "" : " (ngừng hoạt động)"}</option>)}
        </select>
      </label>
    </div>
    {group && !group.ap_dung_bang_gia && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Bảng giá nhóm đang tắt. Đơn hàng sẽ lấy giá mặc định; các giá đã khai báo vẫn được giữ để dùng lại khi bật bảng giá.</p>}

    <div className="space-y-3 md:hidden">
      {visibleProducts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">{products.length === 0 ? "Chưa có sản phẩm đang kinh doanh." : "Không tìm thấy sản phẩm phù hợp."}</div>
      ) : visibleProducts.map((product) => {
        const expanded = expandedProducts.has(product.id);
        const primaryRow = product.rows[0];
        return <article key={product.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex min-w-0 items-start gap-2">
            {product.coBienThe && <Button type="button" variant="ghost" size="icon-sm" className="mt-0.5 h-10 w-10 shrink-0" aria-expanded={expanded} aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} biến thể ${product.tenSanPham}`} onClick={() => setExpandedProducts((current) => { const next = new Set(current); if (expanded) next.delete(product.id); else next.add(product.id); return next; })}>{expanded ? <ChevronUp /> : <ChevronDown />}</Button>}
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-slate-900">{product.tenSanPham}</p>
              <p className="mt-1 text-sm text-slate-500">Mã sản phẩm: {product.maSanPham}{product.coBienThe ? ` · ${product.rows.length} biến thể` : ""}</p>
            </div>
          </div>
          {!product.coBienThe && <div className="mt-3 border-t border-slate-100 pt-3">
            {isDefaultMode ? <label className="grid gap-1.5 text-sm text-slate-600">Giá mặc định{editPrice(primaryRow)}</label> : <>
              <p className="text-sm text-slate-600">Giá mặc định: <span className="font-medium text-slate-900">{formatCurrency(primaryRow.giaMacDinh)}</span></p>
              <label className="mt-3 grid gap-1.5 text-sm text-slate-600">Giá nhóm{editPrice(primaryRow)}</label>
            </>}
          </div>}
          {product.coBienThe && expanded && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {product.rows.map((row) => <div key={row.key} className="min-w-0 rounded-lg bg-slate-50 p-3">
              <p className="break-words text-sm font-medium text-slate-900">{row.tenBienThe || "Biến thể"}</p>
              <p className="mt-1 break-all text-xs text-slate-500">SKU: {row.maSku || "—"}</p>
              {isDefaultMode ? <label className="mt-3 grid gap-1.5 text-sm text-slate-600">Giá mặc định{editPrice(row)}</label> : <>
                <p className="mt-3 text-sm text-slate-600">Giá mặc định: <span className="font-medium text-slate-900">{formatCurrency(row.giaMacDinh)}</span></p>
                <label className="mt-3 grid gap-1.5 text-sm text-slate-600">Giá nhóm{editPrice(row)}</label>
              </>}
            </div>)}
          </div>}
        </article>;
      })}
    </div>

    <div className="app-data-table-shell hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
      <table className="app-data-table w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Sản phẩm / biến thể</th><th className="px-4 py-3">Mã / SKU</th><th className="px-4 py-3">Giá mặc định</th>{!isDefaultMode && <th className="px-4 py-3">Giá nhóm</th>}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {visibleProducts.length === 0 ? <tr><td colSpan={isDefaultMode ? 3 : 4} className="px-4 py-10 text-center text-slate-500">{products.length === 0 ? "Chưa có sản phẩm đang kinh doanh." : "Không tìm thấy sản phẩm phù hợp."}</td></tr> : visibleProducts.map((product) => {
            const expanded = expandedProducts.has(product.id);
            const primaryRow = product.rows[0];
            return <Fragment key={product.id}>
              <tr>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {product.coBienThe && <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 shrink-0" aria-expanded={expanded} aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} biến thể ${product.tenSanPham}`} onClick={() => setExpandedProducts((current) => { const next = new Set(current); if (expanded) next.delete(product.id); else next.add(product.id); return next; })}>{expanded ? <ChevronUp /> : <ChevronDown />}</Button>}
                    <span className="font-medium text-slate-900">{product.tenSanPham}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{product.maSanPham}</td>
                <td className="px-4 py-3">{product.coBienThe ? <span className="text-sm text-slate-500">{product.rows.length} biến thể</span> : isDefaultMode ? editPrice(primaryRow) : formatCurrency(primaryRow.giaMacDinh)}</td>
                {!isDefaultMode && <td className="px-4 py-3">{product.coBienThe ? <span className="text-sm text-slate-500">Theo từng biến thể</span> : editPrice(primaryRow)}</td>}
              </tr>
              {product.coBienThe && expanded && product.rows.map((row) => <tr key={row.key} className="bg-slate-50/60">
                <td className="break-words px-4 py-3 pl-12"><div className="font-medium text-slate-800">{row.tenBienThe || "Biến thể"}</div></td>
                <td className="break-all px-4 py-3 text-slate-500">{row.maSku || "—"}</td>
                <td className="px-4 py-3">{isDefaultMode ? editPrice(row) : formatCurrency(row.giaMacDinh)}</td>
                {!isDefaultMode && <td className="px-4 py-3">{editPrice(row)}</td>}
              </tr>)}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>

    {filteredProducts.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <span>Hiển thị {firstProduct}–{lastProduct} trong {filteredProducts.length} sản phẩm</span>
        <label className="flex items-center gap-2">Số dòng
          <span className="relative"><select value={pageSize} onChange={(event) => void changePageSize(Number(event.target.value))} className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm text-slate-700">{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="md" disabled={currentPage <= 1} onClick={() => void goToPage(currentPage - 1)}>Trước</Button>
        {pageNumbers.map((page) => <Button key={page} type="button" size="md" variant={page === currentPage ? "default" : "outline"} aria-current={page === currentPage ? "page" : undefined} onClick={() => void goToPage(page)}>{page}</Button>)}
        <Button type="button" variant="outline" size="md" disabled={currentPage >= totalPages} onClick={() => void goToPage(currentPage + 1)}>Sau</Button>
      </div>
    </div>}
  </div>;
}
