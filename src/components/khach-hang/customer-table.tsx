
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  UserRound,
  Trash2,
  X,
  AlertTriangle,
  LoaderCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { ngungHoatDongKhachHang, xoaKhachHang } from "@/lib/supabase/khach-hang-actions";
import { goiYKhachHang, type CustomerSearchSuggestion } from "@/lib/supabase/search-suggestions";

import type { KhachHang } from "@/types/khach-hang";

type CustomerWithDebt = KhachHang & {
  cong_no_hien_tai: number;
};

interface CustomerTableProps {
  customers: CustomerWithDebt[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  search: string;
  status: "all" | "active" | "inactive";
}

type Notification = {
  type: "success" | "error";
  message: string;
} | null;

export function CustomerTable({
  customers,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  search,
  status,
}: CustomerTableProps) {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(search);
  const [isComposing, setIsComposing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<CustomerSearchSuggestion[]>([]);
  const [customerToDelete, setCustomerToDelete] =
    useState<KhachHang | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customerHasHistory, setCustomerHasHistory] = useState(false);
  const [notification, setNotification] =
    useState<Notification>(null);

  useEffect(() => {
    if (!notification) return;

    const timeoutId = setTimeout(() => {
      setNotification(null);
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [notification]);

  const formatCurrency = (value: number | null | undefined) => {
    return (
      new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 0,
      }).format(Number(value ?? 0)) + " ₫"
    );
  };

  const getInitial = (name: string) => {
    return name?.trim().charAt(0).toUpperCase() || "?";
  };

  const handleEdit = (id: string) => {
    router.push(`/danh-sach-khach-hang/${id}/chinh-sua`);
  };

  const buildParams = (overrides: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: "all" | "active" | "inactive";
  } = {}) => {
    const params = new URLSearchParams();
    const nextPage = overrides.page ?? currentPage;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextSearch = overrides.search ?? search;
    const nextStatus = overrides.status ?? status;

    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextPageSize !== 10) params.set("pageSize", String(nextPageSize));
    if (nextSearch) params.set("search", nextSearch);
    if (nextStatus !== "all") params.set("status", nextStatus);
    return params;
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    const params = buildParams({ page });

    const query = params.toString();

    router.push(query ? `/danh-sach-khach-hang?${query}` : "/danh-sach-khach-hang");
  };

  const handlePageSizeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextPageSize = Number(event.target.value);

    const params = buildParams({ page: 1, pageSize: nextPageSize });

    // Khi đổi số lượng, trở về trang đầu tiên.
    const query = params.toString();

    router.push(query ? `/danh-sach-khach-hang?${query}` : "/danh-sach-khach-hang");
  };

  const handleStatusChange = (nextStatus: "all" | "active" | "inactive") => {
    const params = buildParams({ page: 1, status: nextStatus });
    const query = params.toString();
    router.push(query ? `/danh-sach-khach-hang?${query}` : "/danh-sach-khach-hang");
  };

  useEffect(() => {
    if (isComposing) return;

    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();
      if (pageSize !== 10) params.set("pageSize", String(pageSize));
      if (nextSearch) params.set("search", nextSearch);
      if (status !== "all") params.set("status", status);
      const query = params.toString();
      router.replace(query ? `/danh-sach-khach-hang?${query}` : "/danh-sach-khach-hang");
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [searchInput, search, pageSize, status, router, isComposing]);

  useEffect(() => {
    const query = searchInput.trim();
    if (!searchOpen || query.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    let active = true;
    const timeoutId = setTimeout(() => {
      void goiYKhachHang(query).then((items) => {
        if (active) setSearchSuggestions(items);
      });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [searchInput, searchOpen]);

  const openDeleteDialog = (customer: KhachHang) => {
    setNotification(null);
    setCustomerHasHistory(false);
    setCustomerToDelete(customer);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) return;
    setCustomerToDelete(null);
    setCustomerHasHistory(false);
  };

  const handleDelete = async () => {
    if (!customerToDelete || isDeleting) return;

    setIsDeleting(true);
    setNotification(null);

    try {
      const result = await xoaKhachHang(customerToDelete.id);

      if (result.requiresDeactivation) {
        setCustomerHasHistory(true);
        return;
      }

      if (!result.success) {
        setCustomerToDelete(null);
        setNotification({
          type: "error",
          message: result.message,
        });
        return;
      }

      setCustomerToDelete(null);
      setNotification({
        type: "success",
        message: `Đã xóa khách hàng "${customerToDelete.ten_khach_hang}".`,
      });

      // Nếu xóa khách hàng cuối cùng của trang, quay về trang trước.
      if (customers.length === 1 && currentPage > 1) {
        const previousPage = currentPage - 1;
        const params = buildParams({ page: previousPage });

        const query = params.toString();

        router.push(
          query ? `/danh-sach-khach-hang?${query}` : "/danh-sach-khach-hang",
        );
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("handleDelete:", error);

      setNotification({
        type: "error",
        message: "Có lỗi xảy ra khi xóa khách hàng. Vui lòng thử lại.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!customerToDelete || isDeleting) return;

    setIsDeleting(true);
    setNotification(null);

    try {
      const result = await ngungHoatDongKhachHang(customerToDelete.id);
      if (!result.success) {
        setNotification({ type: "error", message: result.message });
        return;
      }

      setCustomerToDelete(null);
      setCustomerHasHistory(false);
      setNotification({ type: "success", message: result.message });
      router.refresh();
    } catch (error) {
      console.error("handleDeactivate:", error);
      setNotification({
        type: "error",
        message: "Có lỗi xảy ra khi chuyển khách hàng sang Ngừng hoạt động.",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  const renderDebt = (amount: number) => (
    <span
      className={`font-semibold ${
        amount > 0
          ? "text-red-600"
          : amount < 0
            ? "text-emerald-600"
            : "text-slate-700"
      }`}
    >
      {formatCurrency(amount)}
    </span>
  );

  const visiblePages = Array.from(
    new Set(
      [
        1,
        totalPages,
        currentPage - 1,
        currentPage,
        currentPage + 1,
      ].filter((page) => page >= 1 && page <= totalPages),
    ),
  ).sort((a, b) => a - b);

  return (
    <div className="min-w-0 space-y-4">
      {/* Thông báo */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300 ${
            notification.type === "success"
              ? "border-emerald-200"
              : "border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}

          <p
            className={`flex-1 text-sm ${
              notification.type === "success"
                ? "text-emerald-800"
                : "text-red-700"
            }`}
          >
            {notification.message}
          </p>

          <button
            type="button"
            onClick={() => setNotification(null)}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        key={`customer-search-${search}`}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"
      >
        <label className="relative block">
          <span className="sr-only">Tìm khách hàng</span>
          <Search aria-hidden="true" className="app-search-icon" />
          <input
            type="search"
            value={searchInput}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            onChange={(event) => setSearchInput(event.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => {
              setIsComposing(false);
              setSearchInput(event.currentTarget.value);
            }}
            placeholder="Mã, tên hoặc số điện thoại"
            className="app-search-input font-normal"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen && searchInput.trim().length >= 2}
            aria-controls="customer-search-suggestions"
            autoComplete="off"
          />
          {searchOpen && searchInput.trim().length >= 2 && <div id="customer-search-suggestions" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {searchSuggestions.map((item) => <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSearchInput(item.ma_khach_hang);
                setSearchOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-normal hover:bg-slate-50"
            >
              <span className="min-w-0"><span className="block truncate font-medium text-slate-800">{item.ten_khach_hang}</span><span className="block truncate text-xs text-slate-500">{item.ma_khach_hang}{item.so_dien_thoai ? ` · ${item.so_dien_thoai}` : ""}</span></span>
            </button>)}
            {searchSuggestions.length === 0 && <p className="px-3 py-3 text-sm font-normal text-slate-500">Không tìm thấy khách hàng phù hợp.</p>}
          </div>}
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:contents">
          <Button onClick={() => router.push("/danh-sach-khach-hang/them")} className="order-2 h-10 shrink-0 px-3 sm:px-4"><Plus className="mr-1.5 h-4 w-4" /><span className="text-sm">Thêm khách hàng</span></Button>
          <label className="order-1 grid">
          <span className="sr-only">Trạng thái</span>
          <select
            value={status}
            onChange={(event) =>
              handleStatusChange(event.target.value as "all" | "active" | "inactive")
            }
            className="h-10 rounded-md border border-slate-200 bg-white px-3 font-normal outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
          </label>
        </div>
      </div>
      {/* Thẻ khách hàng trên điện thoại */}
      <div className="!mt-3 space-y-[6px] md:hidden">
        {customers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <UserRound className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Chưa có khách hàng
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Thêm khách hàng để bắt đầu quản lý.
            </p>
          </div>
        ) : (
          customers.map((customer) => (
            <div
              key={customer.id}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-[10px] py-[5px] shadow-sm"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {customer.anh_dai_dien_url && (
                    <AvatarImage
                      src={customer.anh_dai_dien_url}
                      alt={customer.ten_khach_hang}
                    />
                  )}
                  <AvatarFallback>
                    {getInitial(customer.ten_khach_hang)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {customer.ten_khach_hang}{customer.so_dien_thoai ? ` - ${customer.so_dien_thoai}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Mã KH: {customer.ma_khach_hang}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-[30px] w-[30px]"
                    onClick={() => handleEdit(customer.id)}
                    title="Chỉnh sửa khách hàng"
                    aria-label={`Chỉnh sửa ${customer.ten_khach_hang}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-[30px] w-[30px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => openDeleteDialog(customer)}
                    title="Xóa khách hàng"
                    aria-label={`Xóa ${customer.ten_khach_hang}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Thông tin liên hệ */}
              {/* Công nợ và hạn mức */}
              <div className="mt-3 ml-12 pr-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-slate-500">Công nợ hiện tại</span>
                  <span className="text-right text-sm">{renderDebt(customer.cong_no_hien_tai)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bảng khách hàng trên máy tính */}
      <div className="app-data-table-shell !mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã KH</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Người liên hệ</TableHead>
              <TableHead>Công nợ hiện tại</TableHead>
              <TableHead>Hạn mức công nợ</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-slate-500"
                >
                  Chưa có khách hàng.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="py-1 font-medium">
                    {customer.ma_khach_hang}
                  </TableCell>

                  <TableCell className="py-1">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-[34px] w-[34px]">
                        {customer.anh_dai_dien_url && (
                          <AvatarImage
                            src={customer.anh_dai_dien_url}
                            alt={customer.ten_khach_hang}
                          />
                        )}
                        <AvatarFallback>
                          {getInitial(customer.ten_khach_hang)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {customer.ten_khach_hang}
                        </p>
                        {customer.email && (
                          <p className="truncate text-xs text-slate-500">
                            {customer.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-1">
                    {customer.so_dien_thoai || "-"}
                  </TableCell>

                  <TableCell className="py-1">
                    {customer.nguoi_lien_he || "-"}
                  </TableCell>

                  <TableCell className="py-1">
                    {renderDebt(customer.cong_no_hien_tai)}
                  </TableCell>

                  <TableCell className="py-1">
                    {formatCurrency(customer.han_muc_cong_no)}
                  </TableCell>

                  <TableCell className="py-1 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(customer.id)}
                        title="Chỉnh sửa khách hàng"
                        aria-label={`Chỉnh sửa ${customer.ten_khach_hang}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => openDeleteDialog(customer)}
                        title="Xóa khách hàng"
                        aria-label={`Xóa ${customer.ten_khach_hang}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Thanh phân trang và chọn số dòng */}
      <div className="!mt-3 border-t border-slate-200 pt-3 sm:pt-4">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:hidden">
          <p className="min-w-0 whitespace-nowrap text-xs text-slate-500">
            {totalCount === 0
              ? "0 khách"
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalCount)} / ${totalCount}`}
          </p>
          <select
            aria-label="Số khách hàng mỗi trang"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="h-8 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
            <option value={100}>100 / trang</option>
          </select>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" size="icon-sm" aria-label="Trang trước" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="whitespace-nowrap text-xs text-slate-600">{currentPage}/{totalPages}</span>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Trang sau" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden sm:flex sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-sm text-slate-500">
            {totalCount === 0
              ? "Chưa có dữ liệu"
              : `Hiển thị ${(currentPage - 1) * pageSize + 1}–${Math.min(
                  currentPage * pageSize,
                  totalCount,
                )} trong ${totalCount} khách hàng`}
          </p>

          <div className="flex items-center gap-2">
            <label
              htmlFor="customer-page-size"
              className="whitespace-nowrap text-sm text-slate-500"
            >
              Hiển thị
            </label>

            <div className="relative">
              <select
                id="customer-page-size"
                value={pageSize}
                onChange={handlePageSizeChange}
                className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <span className="whitespace-nowrap text-sm text-slate-500">
              / trang
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Trước
          </Button>

          {visiblePages.map((page, index) => {
            const previousPage = visiblePages[index - 1];

            return (
              <span key={page} className="contents">
                {previousPage !== undefined &&
                  page - previousPage > 1 && (
                    <span className="px-1 text-sm text-slate-400">
                      …
                    </span>
                  )}

                <Button
                  type="button"
                  size="sm"
                  variant={page === currentPage ? "default" : "outline"}
                  aria-current={page === currentPage ? "page" : undefined}
                  aria-label={`Trang ${page}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              </span>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Sau
          </Button>
        </div>
        </div>
      </div>

      {/* Hộp thoại xác nhận xóa */}
      {customerToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog();
            }
          }}
        >
          <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200" />

          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 zoom-in-95 duration-300 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  id="delete-dialog-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  {customerHasHistory ? "Không thể xóa khách hàng" : "Xóa khách hàng?"}
                </h3>
                <p
                  id="delete-dialog-description"
                  className="mt-2 text-sm leading-6 text-slate-600"
                >
                  {customerHasHistory ? (
                    <>
                      Khách hàng{" "}
                      <span className="font-semibold text-slate-900">{customerToDelete.ten_khach_hang}</span>
                      {" "}đã có đơn hàng, phiếu thu hoặc giao dịch công nợ nên không thể xóa cứng. Chuyển sang Ngừng hoạt động sẽ giữ nguyên lịch sử và ngăn tạo đơn mới.
                      {customerToDelete.trang_thai ? "" : " Khách hàng hiện đã Ngừng hoạt động."}
                    </>
                  ) : (
                    <>
                      Bạn có chắc chắn muốn xóa khách hàng{" "}
                      <span className="font-semibold text-slate-900">
                        {customerToDelete.ten_khach_hang}
                      </span>
                      ? Chỉ khách chưa phát sinh đơn hàng, phiếu thu hoặc công nợ mới được xóa.
                    </>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Đóng hộp thoại"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={closeDeleteDialog}
                className="w-full sm:w-auto"
              >
                {customerHasHistory && !customerToDelete.trang_thai ? "Đóng" : "Hủy"}
              </Button>

              {customerHasHistory ? (
                customerToDelete.trang_thai ? (
                  <Button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeactivate}
                    className="w-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
                  >
                    {isDeleting ? "Đang cập nhật..." : "Chuyển sang Ngừng hoạt động"}
                  </Button>
                ) : null
              ) : (
                <Button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
                >
                  {isDeleting ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa khách hàng
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





