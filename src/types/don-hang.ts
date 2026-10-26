export type TrangThaiDonHang = "xac_nhan" | "dang_thuc_hien" | "hoan_thanh" | "da_huy";

export type LoaiDonHang = "ban_nhanh" | "dat_hang";

export const TRANG_THAI_DON_HANG_CONFIG: Record<
  TrangThaiDonHang,
  { label: string; badgeClass: string; description: string }
> = {
  xac_nhan: {
    label: "Đã xác nhận",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Đơn đặt hàng đã được xác nhận, chờ thực hiện",
  },
  dang_thuc_hien: {
    label: "Đang thực hiện",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Đang cắt may, in thêu hoặc đóng gói sản phẩm",
  },
  hoan_thanh: {
    label: "Hoàn thành",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Khách đã nhận đủ hàng, đơn hoàn tất",
  },
  da_huy: {
    label: "Đã hủy",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    description: "Đơn hàng đã bị hủy",
  },
};

export const LOAI_DON_HANG_CONFIG: Record<
  LoaiDonHang,
  { label: string; badgeClass: string }
> = {
  ban_nhanh: {
    label: "Bán nhanh",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
  dat_hang: {
    label: "Đặt hàng",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
};

export function getTrangThaiBadge(trangThai: string) {
  const config = TRANG_THAI_DON_HANG_CONFIG[trangThai as TrangThaiDonHang];
  if (config) return config;
  return {
    label: trangThai.replaceAll("_", " "),
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    description: "",
  };
}

export function getLoaiDonHangBadge(loai: string) {
  const config = LOAI_DON_HANG_CONFIG[loai as LoaiDonHang];
  if (config) return config;
  return {
    label: loai === "ban_nhanh" ? "Bán nhanh" : "Đặt hàng",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

/**
 * Định dạng số thành chuỗi hiển thị tiền tệ Việt Nam (phân cách hàng nghìn bằng dấu chấm, kèm ₫)
 * Ví dụ: 1500000 -> "1.500.000 ₫"
 */
export function formatCurrency(amount: number | null | undefined): string {
  const value = Math.round(Number(amount) || 0);
  return `${value.toLocaleString("vi-VN")} ₫`;
}

/**
 * Định dạng số nguyên với phân cách hàng nghìn bằng dấu chấm (dùng cho giá trị hiển thị trong input text)
 * Ví dụ: 1500000 -> "1.500.000"
 */
export function formatNumber(amount: number | null | undefined): string {
  const value = Math.round(Number(amount) || 0);
  return value.toLocaleString("vi-VN");
}

/**
 * Phân tích chuỗi nhập liệu (loại bỏ mọi ký tự không phải số) thành số nguyên
 * Ví dụ: "1.500.000" -> 1500000
 */
export function parseCurrencyInput(value: string): number {
  const clean = value.replace(/\D/g, "");
  return clean ? parseInt(clean, 10) : 0;
}

