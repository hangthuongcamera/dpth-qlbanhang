"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { luuGiaNhomKhachHang, type NhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";

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

type RowStatus = "dirty" | "saving" | "saved" | "error";

export function BangGiaNhomManager({ groups, rows, selectedGroupId }: { groups: NhomKhachHang[]; rows: GiaNhomRow[]; selectedGroupId: string }) {
  const router = useRouter();
  const group = groups.find((item) => item.id === selectedGroupId);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [row.key, row.giaNhom === null ? "" : String(row.giaNhom)])));
  const [savedValues, setSavedValues] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [row.key, row.giaNhom === null ? "" : String(row.giaNhom)])));
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pendingSaves = useRef(new Map<string, Promise<boolean>>());
  const filteredRows = useMemo(() => {
    const query = search.toLocaleLowerCase("vi");
    if (!query) return rows;
    return rows.filter((row) => [row.maSanPham, row.maSku, row.tenSanPham, row.tenBienThe]
      .some((value) => value.toLocaleLowerCase("vi").includes(query)));
  }, [rows, search]);

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
    const price = raw === "" ? null : Number(raw);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setRowStatuses((current) => ({ ...current, [row.key]: "error" }));
      setRowErrors((current) => ({ ...current, [row.key]: "Giá nhóm phải là số không âm." }));
      return false;
    }

    const savedRaw = savedValues[row.key]?.trim() ?? "";
    const savedPrice = savedRaw === "" ? null : Number(savedRaw);
    if (price === savedPrice) {
      setRowStatuses((current) => ({ ...current, [row.key]: "saved" }));
      setRowErrors((current) => ({ ...current, [row.key]: "" }));
      return true;
    }

    setRowStatuses((current) => ({ ...current, [row.key]: "saving" }));
    setRowErrors((current) => ({ ...current, [row.key]: "" }));
    try {
      await luuGiaNhomKhachHang({ nhomId: selectedGroupId, sanPhamId: row.sanPhamId, bienTheId: row.bienTheId, donGia: price });
      const normalized = price === null ? "" : String(price);
      setSavedValues((current) => ({ ...current, [row.key]: normalized }));
      setRowStatuses((current) => ({ ...current, [row.key]: "saved" }));
      setRowErrors((current) => ({ ...current, [row.key]: "" }));
      router.refresh();
      return true;
    } catch (error) {
      setRowStatuses((current) => ({ ...current, [row.key]: "error" }));
      setRowErrors((current) => ({ ...current, [row.key]: error instanceof Error ? error.message : "Không thể lưu giá nhóm." }));
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
    const dirtyRows = rows.filter((row) => {
      const raw = values[row.key]?.trim() ?? "";
      const savedRaw = savedValues[row.key]?.trim() ?? "";
      const price = raw === "" ? null : Number(raw);
      const savedPrice = savedRaw === "" ? null : Number(savedRaw);
      return price === null ? savedPrice !== null : !Number.isFinite(price) || price !== savedPrice;
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstRow = filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(currentPage * pageSize, filteredRows.length);
  const pageNumbers = Array.from(new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);

  return <div className="min-w-0 space-y-4 p-4 md:p-6">
    <label className="grid max-w-lg gap-1.5 text-sm font-medium text-slate-700">Nhóm khách hàng
      <select value={selectedGroupId} onChange={(event) => router.push(event.target.value ? `/bang-gia-nhom?nhom=${event.target.value}` : "/bang-gia-nhom")} className="h-10 rounded-md border border-slate-200 bg-white px-3 font-normal">
        <option value="">Chọn nhóm khách hàng</option>
        {groups.map((item) => <option key={item.id} value={item.id}>{item.ten_nhom}{item.trang_thai ? "" : " (ngừng hoạt động)"}</option>)}
      </select>
    </label>
    {group && <>
      {!group.ap_dung_bang_gia && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Bảng giá nhóm đang tắt. Đơn hàng sẽ lấy giá mặc định; các giá đã khai báo vẫn được giữ để dùng lại khi bật bảng giá.</p>}
      <div className="relative max-w-lg">
        <Search aria-hidden="true" className="app-search-icon" />
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(event) => { setSearchInput(event.currentTarget.value); setIsComposing(false); }}
          placeholder="Tìm theo mã sản phẩm, SKU hoặc tên sản phẩm"
          aria-label="Tìm theo mã sản phẩm, SKU hoặc tên sản phẩm"
          className="app-search-input"
        />
      </div>
      <div className="app-data-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="app-data-table w-full min-w-[900px] table-fixed text-left text-sm">
          <colgroup><col className="w-[38%]" /><col className="w-[17%]" /><col className="w-[22%]" /><col className="w-[23%]" /></colgroup>
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Sản phẩm / biến thể</th><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Giá mặc định</th><th className="px-4 py-3">Giá nhóm</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => <tr key={row.key}>
              <td className="break-words px-4 py-3"><div className="font-medium text-slate-900">{row.tenSanPham}</div>{row.tenBienThe && <div className="text-xs text-slate-500">{row.tenBienThe}</div>}</td>
              <td className="break-all px-4 py-3 text-slate-500">{row.maSku || row.maSanPham}</td>
              <td className="whitespace-nowrap px-4 py-3">{new Intl.NumberFormat("vi-VN").format(row.giaMacDinh)}</td>
              <td className="px-4 py-3"><input type="number" min="0" step="0.01" value={values[row.key] ?? ""} disabled={rowStatuses[row.key] === "saving"} onChange={(event) => { setValues((current) => ({ ...current, [row.key]: event.target.value })); setRowStatuses((current) => ({ ...current, [row.key]: "dirty" })); setRowErrors((current) => ({ ...current, [row.key]: "" })); }} onBlur={() => void save(row)} placeholder="Dùng giá mặc định" className="h-9 w-full max-w-40 rounded-md border border-slate-200 px-3 disabled:bg-slate-100" aria-label={`Giá nhóm cho ${row.tenBienThe || row.tenSanPham}`} aria-describedby={`gia-nhom-status-${row.key}`} />
                {rowStatuses[row.key] && <p id={`gia-nhom-status-${row.key}`} role={rowStatuses[row.key] === "error" ? "alert" : "status"} className={`mt-1 text-xs ${rowStatuses[row.key] === "error" ? "text-red-600" : rowStatuses[row.key] === "dirty" ? "text-amber-700" : "text-slate-500"}`}>{rowStatuses[row.key] === "saving" ? "Đang lưu..." : rowStatuses[row.key] === "saved" ? "Đã lưu" : rowStatuses[row.key] === "dirty" ? "Chưa lưu" : rowErrors[row.key]}</p>}
              </td>
            </tr>)}
            {visibleRows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">{rows.length === 0 ? "Chưa có sản phẩm đang kinh doanh." : "Không tìm thấy sản phẩm phù hợp."}</td></tr>}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Hiển thị {firstRow}–{lastRow} trong {filteredRows.length} sản phẩm</span>
          <label className="flex items-center gap-2">Số dòng
            <span className="relative"><select value={pageSize} onChange={(event) => void changePageSize(Number(event.target.value))} className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm text-slate-700">{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => void goToPage(currentPage - 1)}>Trước</Button>
          {pageNumbers.map((page) => <Button key={page} type="button" size="sm" variant={page === currentPage ? "default" : "outline"} aria-current={page === currentPage ? "page" : undefined} onClick={() => void goToPage(page)}>{page}</Button>)}
          <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => void goToPage(currentPage + 1)}>Sau</Button>
        </div>
      </div>}
    </>}
  </div>;
}




