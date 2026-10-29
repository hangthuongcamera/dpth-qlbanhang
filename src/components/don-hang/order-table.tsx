"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  getLoaiDonHangBadge,
  getTrangThaiBadge,
} from "@/types/don-hang";
import { xoaDonHang } from "@/lib/supabase/don-hang-actions";
import {
  notifyOrder,
  OrderNotificationToast,
} from "@/components/don-hang/order-notification-toast";

export type OrderListItem = {
  id: string;
  ma_don_hang: string;
  loai_don_hang: "dat_hang" | "ban_nhanh";
  ngay_dat: string;
  han_giao?: string | null;
  trang_thai: string;
  tong_tien: number;
  da_thu: number;
  con_no: number;
  khach_hang?: {
    id: string;
    ma_khach_hang: string;
    ten_khach_hang: string;
    so_dien_thoai?: string | null;
  } | null;
};

interface OrderTableProps {
  orders: OrderListItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  search: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  fromDate: string;
  toDate: string;
}

export function OrderTable({
  orders,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  search,
  orderType,
  status,
  paymentStatus,
  fromDate,
  toDate,
}: OrderTableProps) {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);
  if (prevSearch !== search) {
    setPrevSearch(search);
    setSearchInput(search);
  }

  const [isComposing, setIsComposing] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderListItem | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Build query string helper
  const buildParams = useCallback((overrides: {
    page?: number;
    pageSize?: number;
    search?: string;
    orderType?: string;
    status?: string;
    paymentStatus?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) => {
    const params = new URLSearchParams();
    const nextPage = overrides.page ?? currentPage;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextSearch = overrides.search !== undefined ? overrides.search : search;
    const nextOrderType = overrides.orderType ?? orderType;
    const nextStatus = overrides.status ?? status;
    const nextPaymentStatus = overrides.paymentStatus ?? paymentStatus;
    const nextFromDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const nextToDate = overrides.toDate !== undefined ? overrides.toDate : toDate;

    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextPageSize !== 10) params.set("pageSize", String(nextPageSize));
    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextOrderType && nextOrderType !== "all") params.set("orderType", nextOrderType);
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextPaymentStatus && nextPaymentStatus !== "all") params.set("paymentStatus", nextPaymentStatus);
    if (nextFromDate) params.set("fromDate", nextFromDate);
    if (nextToDate) params.set("toDate", nextToDate);

    return params;
  }, [currentPage, pageSize, search, orderType, status, paymentStatus, fromDate, toDate]);

  const navigateWithParams = useCallback((params: URLSearchParams) => {
    const query = params.toString();
    router.push(query ? `/danh-sach-don-hang?${query}` : "/danh-sach-don-hang");
  }, [router]);

  // Debounced search
  useEffect(() => {
    if (isComposing) return;
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;

    const timer = setTimeout(() => {
      const params = buildParams({ page: 1, search: nextSearch });
      navigateWithParams(params);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, search, isComposing, buildParams, navigateWithParams]);

  const handleResetFilters = () => {
    setSearchInput("");
    router.push("/danh-sach-don-hang");
  };

  const hasActiveFilters = Boolean(
    search ||
    (orderType && orderType !== "all") ||
    (status && status !== "all") ||
    (paymentStatus && paymentStatus !== "all") ||
    fromDate ||
    toDate
  );

  const openDeleteModal = (order: OrderListItem) => {
    setDeleteError("");
    setOrderToDelete(order);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setOrderToDelete(null);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      const result = await xoaDonHang(orderToDelete.id);
      notifyOrder({ type: "success", message: result.message });
      setOrderToDelete(null);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể xóa đơn hàng.";
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-4">
      <OrderNotificationToast />

      {/* Top Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Link href="/don-dat-hang" className={buttonVariants({ variant: "outline" })}>
            + Đơn đặt hàng
          </Link>
          <Link href="/ban-nhanh" target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
            + Bán nhanh
          </Link>
        </div>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search box */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="app-search-icon" />
            <Input
              type="text"
              placeholder="Tìm theo mã đơn, tên khách, số điện thoại..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              className="app-search-input app-search-input--clearable"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  const params = buildParams({ page: 1, search: "" });
                  navigateWithParams(params);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Loại đơn */}
          <div>
            <select
              value={orderType}
              onChange={(e) => {
                const params = buildParams({ page: 1, orderType: e.target.value });
                navigateWithParams(params);
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="all">Tất cả loại đơn</option>
              <option value="dat_hang">Đơn đặt hàng</option>
              <option value="ban_nhanh">Bán nhanh</option>
            </select>
          </div>

          {/* Filter Trạng thái đơn */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                const params = buildParams({ page: 1, status: e.target.value });
                navigateWithParams(params);
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="xac_nhan">Đã xác nhận</option>
              <option value="dang_thuc_hien">Đang thực hiện</option>
              <option value="hoan_thanh">Hoàn thành</option>
              <option value="da_huy">Đã hủy</option>
            </select>
          </div>

          {/* Filter Thanh toán */}
          <div>
            <select
              value={paymentStatus}
              onChange={(e) => {
                const params = buildParams({ page: 1, paymentStatus: e.target.value });
                navigateWithParams(params);
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="all">Tất cả thanh toán</option>
              <option value="con_no">Còn nợ / Chưa thanh toán</option>
              <option value="da_thanh_toan">Đã thanh toán đủ</option>
            </select>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Ngày đặt:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Từ</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  const params = buildParams({ page: 1, fromDate: e.target.value });
                  navigateWithParams(params);
                }}
                className="h-9 w-36 px-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Đến</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  const params = buildParams({ page: 1, toDate: e.target.value });
                  navigateWithParams(params);
                }}
                className="h-9 w-36 px-2 text-xs"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="app-data-table-shell overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-36 font-semibold text-slate-700">Mã đơn hàng</TableHead>
                <TableHead className="w-28 font-semibold text-slate-700">Loại đơn</TableHead>
                <TableHead className="font-semibold text-slate-700">Khách hàng</TableHead>
                <TableHead className="w-28 font-semibold text-slate-700">Ngày đặt</TableHead>
                <TableHead className="w-28 font-semibold text-slate-700">Hạn giao</TableHead>
                <TableHead className="w-36 font-semibold text-slate-700">Trạng thái</TableHead>
                <TableHead className="w-32 text-right font-semibold text-slate-700">Tổng tiền</TableHead>
                <TableHead className="w-32 text-right font-semibold text-slate-700">Đã thu</TableHead>
                <TableHead className="w-32 text-right font-semibold text-slate-700">Còn nợ</TableHead>
                <TableHead className="w-28 text-center font-semibold text-slate-700">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusBadge = getTrangThaiBadge(order.trang_thai);
                const typeBadge = getLoaiDonHangBadge(order.loai_don_hang);
                const isDebt = order.con_no > 0;

                return (
                  <TableRow key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Mã đơn */}
                    <TableCell className="font-medium">
                      <Link
                        href={`/danh-sach-don-hang/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.ma_don_hang}
                      </Link>
                    </TableCell>

                    {/* Loại đơn */}
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeBadge.badgeClass}`}
                      >
                        {typeBadge.label}
                      </span>
                    </TableCell>

                    {/* Khách hàng */}
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {order.khach_hang?.ten_khach_hang ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.khach_hang?.ma_khach_hang}
                        {order.khach_hang?.so_dien_thoai ? ` · ${order.khach_hang.so_dien_thoai}` : ""}
                      </div>
                    </TableCell>

                    {/* Ngày đặt */}
                    <TableCell className="text-slate-600">{order.ngay_dat}</TableCell>

                    {/* Hạn giao */}
                    <TableCell className="text-slate-600">{order.han_giao ?? "—"}</TableCell>

                    {/* Trạng thái */}
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.badgeClass}`}
                      >
                        {statusBadge.label}
                      </span>
                    </TableCell>

                    {/* Tổng tiền */}
                    <TableCell className="text-right font-semibold text-slate-900">
                      {formatCurrency(order.tong_tien)}
                    </TableCell>

                    {/* Đã thu */}
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(order.da_thu)}
                    </TableCell>

                    {/* Còn nợ */}
                    <TableCell className="text-right">
                      {isDebt ? (
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(order.con_no)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-emerald-600">
                          Đủ (0 ₫)
                        </span>
                      )}
                    </TableCell>

                    {/* Thao tác */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/danh-sach-don-hang/${order.id}`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(order)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Xóa đơn hàng"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-slate-500">
                    Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {orders.map((order) => {
            const statusBadge = getTrangThaiBadge(order.trang_thai);
            const typeBadge = getLoaiDonHangBadge(order.loai_don_hang);
            const isDebt = order.con_no > 0;

            return (
              <div key={order.id} className="p-4 space-y-3">
                {/* Header: Mã đơn + Badges */}
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/danh-sach-don-hang/${order.id}`}
                    className="font-bold text-base text-primary hover:underline"
                  >
                    {order.ma_don_hang}
                  </Link>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeBadge.badgeClass}`}
                    >
                      {typeBadge.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge.badgeClass}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>
                </div>

                {/* Thông tin khách hàng & ngày */}
                <div className="text-sm">
                  <div className="font-medium text-slate-900">
                    {order.khach_hang?.ten_khach_hang ?? "—"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                    {order.khach_hang?.ma_khach_hang && <span>{order.khach_hang.ma_khach_hang}</span>}
                    {order.khach_hang?.so_dien_thoai && <span>SĐT: {order.khach_hang.so_dien_thoai}</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                    <span>Ngày đặt: {order.ngay_dat}</span>
                    {order.han_giao && <span>Hạn giao: {order.han_giao}</span>}
                  </div>
                </div>

                {/* Khối tài chính */}
                <div className="rounded-lg bg-slate-50 p-2.5 text-xs grid grid-cols-3 gap-2 text-center border border-slate-100">
                  <div>
                    <span className="text-slate-500 block">Tổng tiền</span>
                    <strong className="text-slate-900 block mt-0.5">{formatCurrency(order.tong_tien)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Đã thu</span>
                    <strong className="text-emerald-600 block mt-0.5">{formatCurrency(order.da_thu)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Còn nợ</span>
                    <strong className={`block mt-0.5 ${isDebt ? "text-amber-700 font-bold" : "text-emerald-600"}`}>
                      {isDebt ? formatCurrency(order.con_no) : "Đủ (0 ₫)"}
                    </strong>
                  </div>
                </div>

                {/* Nút hành động trên mobile */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Link
                    href={`/danh-sach-don-hang/${order.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                    Xem chi tiết
                  </Link>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteModal(order)}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 px-3"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Xóa
                  </Button>
                </div>
              </div>
            );
          })}

          {orders.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500">
              Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
            </div>
          )}
        </div>


        {/* Pagination Footer */}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>
              Hiển thị <strong>{startIndex}</strong> - <strong>{endIndex}</strong> trên{" "}
              <strong>{totalCount}</strong> đơn hàng
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Mỗi trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const nextPageSize = Number(e.target.value);
                  const params = buildParams({ page: 1, pageSize: nextPageSize });
                  navigateWithParams(params);
                }}
                className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-medium focus:border-primary focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1 self-center sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => {
                  const params = buildParams({ page: currentPage - 1 });
                  navigateWithParams(params);
                }}
                className="h-8 px-2 text-xs"
              >
                Trước
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<number[]>((acc, p) => {
                  if (acc.length && p - acc[acc.length - 1] > 1) {
                    acc.push(-1); // Ellipsis flag
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) => {
                  if (p === -1) {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                        ...
                      </span>
                    );
                  }
                  return (
                    <Button
                      key={p}
                      type="button"
                      variant={p === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const params = buildParams({ page: p });
                        navigateWithParams(params);
                      }}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {p}
                    </Button>
                  );
                })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  const params = buildParams({ page: currentPage + 1 });
                  navigateWithParams(params);
                }}
                className="h-8 px-2 text-xs"
              >
                Sau
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl bg-white p-4 md:p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">
                  Xóa đơn hàng {orderToDelete.ma_don_hang}?
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa đơn hàng{" "}
                  <strong className="text-slate-900">{orderToDelete.ma_don_hang}</strong> của khách hàng{" "}
                  <strong className="text-slate-900">{orderToDelete.khach_hang?.ten_khach_hang ?? "Khách"}</strong>?
                </p>
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed">
                  <strong>Quy định kế toán:</strong> Chỉ cho phép xóa đơn hàng khi chưa phát sinh giao dịch thu tiền. Nếu đơn đã có tiền thu, bạn cần chuyển trạng thái sang <strong>Đã hủy</strong>.
                </div>
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={isDeleting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xác nhận xóa
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






