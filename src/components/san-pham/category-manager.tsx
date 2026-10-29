"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, LoaderCircle, Pencil, Plus, Search, Trash2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  capNhatLoaiSanPham,
  taoLoaiSanPham,
  xoaLoaiSanPham,
} from "@/lib/supabase/loai-san-pham-actions";
import type { LoaiSanPham } from "@/types/san-pham";

type CategoryManagerProps = {
  categories: LoaiSanPham[];
  initialNextCode: string;
  search: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
};

type Notification = { type: "success" | "error"; message: string } | null;

export function CategoryManager({
  categories,
  initialNextCode,
  search,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
}: CategoryManagerProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LoaiSanPham | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<LoaiSanPham | null>(null);
  const [code, setCode] = useState(initialNextCode);
  const [codeWasEdited, setCodeWasEdited] = useState(false);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<Notification>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [isComposing, setIsComposing] = useState(false);

  const buildHref = useCallback((overrides: { page?: number; pageSize?: number; search?: string } = {}) => {
    const params = new URLSearchParams();
    const nextPage = overrides.page ?? currentPage;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextSearch = overrides.search ?? search;
    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextPageSize !== 10) params.set("pageSize", String(nextPageSize));
    if (nextSearch) params.set("search", nextSearch);
    const query = params.toString();
    return query ? `/danh-muc-san-pham?${query}` : "/danh-muc-san-pham";
  }, [currentPage, pageSize, search]);

  useEffect(() => {
    if (!notification) return;
    const timeoutId = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  useEffect(() => {
    if (isComposing) return;
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timeoutId = window.setTimeout(() => {
      router.replace(buildHref({ page: 1, search: nextSearch }), { scroll: false });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, search, pageSize, isComposing, router, buildHref]);

  const changePageSize = (nextPageSize: number) => {
    router.push(buildHref({ page: 1, pageSize: nextPageSize }));
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    router.push(buildHref({ page }));
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    setCode(initialNextCode);
    setCodeWasEdited(false);
    setName("");
    setIsActive(true);
    setFormError("");
    setFormOpen(true);
  };

  const openEditDialog = (category: LoaiSanPham) => {
    setEditingCategory(category);
    setCode(category.ma_loai);
    setCodeWasEdited(true);
    setName(category.ten_loai);
    setIsActive(category.trang_thai);
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setFormOpen(false);
    setEditingCategory(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setFormError("");
    setIsSaving(true);

    try {
      if (editingCategory) {
        const updated = await capNhatLoaiSanPham({
          ...editingCategory,
          ma_loai: code,
          ten_loai: name,
          trang_thai: isActive,
        });
        setNotification({ type: "success", message: `Đã cập nhật danh mục "${updated.ten_loai}".` });
      } else {
        const created = await taoLoaiSanPham(codeWasEdited ? code : null, name);
        setNotification({ type: "success", message: `Đã thêm danh mục "${created.ten_loai}" (${created.ma_loai}).` });
      }

      setFormOpen(false);
      setEditingCategory(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể lưu danh mục. Vui lòng thử lại.";
      setFormError(message);
      setNotification({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await xoaLoaiSanPham(categoryToDelete.id);
      setNotification({ type: "success", message: `Đã xóa danh mục "${categoryToDelete.ten_loai}".` });
      setCategoryToDelete(null);
      router.refresh();
    } catch (error) {
      setNotification({ type: "error", message: error instanceof Error ? error.message : "Không thể xóa danh mục. Vui lòng thử lại." });
      setCategoryToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4 app-page">
      {notification && (
        <div
          role={notification.type === "success" ? "status" : "alert"}
          aria-live={notification.type === "success" ? "polite" : "assertive"}
          className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300 ${notification.type === "success" ? "border-emerald-200" : "border-red-200"}`}
        >
          {notification.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
          <p className={`flex-1 text-sm ${notification.type === "success" ? "text-emerald-800" : "text-red-700"}`}>{notification.message}</p>
          <button type="button" onClick={() => setNotification(null)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng thông báo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />Thêm danh mục
        </Button>
      </div>

      <div className="relative max-w-lg">
        <Search aria-hidden="true" className="app-search-icon" />
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(event) => {
            setSearchInput(event.currentTarget.value);
            setIsComposing(false);
          }}
          placeholder="Tìm theo mã hoặc tên danh mục"
          aria-label="Tìm theo mã hoặc tên danh mục"
          className="app-search-input"
        />
      </div>

      <div className="app-data-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="app-data-table w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Mã danh mục</th>
              <th className="px-4 py-3">Tên danh mục</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.length ? categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{category.ma_loai}</td>
                <td className="px-4 py-3 text-slate-700">{category.ten_loai}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${category.trang_thai ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {category.trang_thai ? "Đang hoạt động" : "Ngừng hoạt động"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(category)}>
                      <Pencil className="mr-1.5 h-4 w-4" />Sửa
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setCategoryToDelete(category)}>
                      <Trash2 className="mr-1.5 h-4 w-4" />Xóa
                    </Button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">{search ? "Không tìm thấy danh mục phù hợp." : "Chưa có danh mục sản phẩm."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>{totalCount ? `Hiển thị ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalCount)} trong ${totalCount} danh mục` : "Chưa có danh mục phù hợp"}</span>
          <label className="flex items-center gap-2">
            Số dòng
            <span className="relative">
              <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))} className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm">
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>Trước</Button>
          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
            .map((page) => <Button key={page} type="button" size="sm" variant={page === currentPage ? "default" : "outline"} aria-current={page === currentPage ? "page" : undefined} onClick={() => goToPage(page)}>{page}</Button>)}
          <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>Sau</Button>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Sửa danh mục" : "Thêm danh mục"}</DialogTitle>
              <DialogDescription>
                {editingCategory ? "Cập nhật mã, tên và trạng thái danh mục." : "Mã danh mục được tự sinh; bạn có thể thay bằng mã khác."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <div className="grid gap-2">
                <Label htmlFor="category-code">Mã danh mục</Label>
                <Input
                  id="category-code"
                  value={code}
                  onChange={(event) => { setCode(event.target.value); setCodeWasEdited(true); }}
                  maxLength={100}
                  required={Boolean(editingCategory)}
                  autoComplete="off"
                />
                {!editingCategory && <p className="text-xs text-slate-500">Nếu để trống, hệ thống sẽ cấp mã tự sinh nhỏ nhất còn trống.</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-name">Tên danh mục</Label>
                <Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required autoFocus />
              </div>
              {editingCategory && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Đang hoạt động
                </label>
              )}
              {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>Hủy</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : "Lưu danh mục"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(categoryToDelete)} onOpenChange={(open) => { if (!open && !isDeleting) setCategoryToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa danh mục?</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa danh mục <span className="font-semibold text-slate-900">{categoryToDelete?.ten_loai} ({categoryToDelete?.ma_loai})</span>? Danh mục đang được sản phẩm sử dụng sẽ không thể xóa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryToDelete(null)} disabled={isDeleting}>Hủy</Button>
            <Button type="button" onClick={handleDelete} disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Đang xóa...</> : <><Trash2 className="mr-2 h-4 w-4" />Xóa danh mục</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





