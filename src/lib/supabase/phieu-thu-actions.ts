"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";

export type PhanBoPhieuThuInput = {
  don_hang_id: string;
  so_tien: number;
  ghi_chu?: string;
};

export type PhieuThuInput = {
  khach_hang_id: string;
  ngay_thu: string;
  tong_tien: number;
  phuong_thuc_thanh_toan: string;
  tai_khoan_nhan: string;
  ma_tham_chieu: string;
  nguoi_nop: string;
  ghi_chu: string;
  phan_bo: PhanBoPhieuThuInput[];
};

function validateInput(input: PhieuThuInput) {
  if (!input.khach_hang_id) throw new Error("Vui lòng chọn khách hàng.");
  if (!input.ngay_thu) throw new Error("Vui lòng chọn ngày thu.");
  if (!Number.isFinite(input.tong_tien) || input.tong_tien <= 0) throw new Error("Số tiền thu phải lớn hơn 0.");
  if (!["tien_mat", "chuyen_khoan", "the", "vi_dien_tu", "khac"].includes(input.phuong_thuc_thanh_toan)) {
    throw new Error("Phương thức thanh toán không hợp lệ.");
  }
  if (input.phan_bo.some((item) => !item.don_hang_id || !Number.isFinite(item.so_tien) || item.so_tien <= 0)) {
    throw new Error("Số tiền phân bổ phải lớn hơn 0.");
  }
  if (input.phan_bo.reduce((sum, item) => sum + item.so_tien, 0) > input.tong_tien) {
    throw new Error("Tổng phân bổ không được vượt số tiền phiếu thu.");
  }
}

function invalidateReceiptData() {
  revalidatePath("/phieu-thu");
  revalidatePath("/danh-sach-don-hang");
  revalidatePath("/cong-no");
}

function rpcInput(input: PhieuThuInput) {
  return {
    p_khach_hang_id: input.khach_hang_id,
    p_ngay_thu: input.ngay_thu,
    p_tong_tien: input.tong_tien,
    p_phuong_thuc_thanh_toan: input.phuong_thuc_thanh_toan,
    p_tai_khoan_nhan: input.tai_khoan_nhan,
    p_ma_tham_chieu: input.ma_tham_chieu,
    p_nguoi_nop: input.nguoi_nop,
    p_ghi_chu: input.ghi_chu,
    p_phan_bo: input.phan_bo,
  };
}

export async function taoPhieuThu(input: PhieuThuInput) {
  validateInput(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tao_phieu_thu_doc_lap", rpcInput(input));
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Không nhận được mã phiếu thu sau khi lưu.");
  invalidateReceiptData();
  return String(data);
}

export async function capNhatPhieuThuNhap(id: string, input: PhieuThuInput) {
  if (!id) throw new Error("Phiếu thu không hợp lệ.");
  validateInput(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cap_nhat_phieu_thu_nhap", {
    p_phieu_thu_id: id,
    ...rpcInput(input),
  });
  if (error) throw new Error(error.message);
  invalidateReceiptData();
}

export async function xacNhanPhieuThu(id: string) {
  if (!id) throw new Error("Phiếu thu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("xac_nhan_phieu_thu", { p_phieu_thu_id: id });
  if (error) throw new Error(error.message);
  invalidateReceiptData();
}

export async function huyPhieuThu(id: string, lyDo: string) {
  if (!id || !lyDo.trim()) throw new Error("Vui lòng nhập lý do hủy phiếu.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("huy_phieu_thu", {
    p_phieu_thu_id: id,
    p_ly_do: lyDo.trim(),
  });
  if (error) throw new Error(error.message);
  invalidateReceiptData();
}

export async function xoaPhieuThuNhap(id: string) {
  if (!id) throw new Error("Phiếu thu không hợp lệ.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("xoa_phieu_thu_nhap", { p_phieu_thu_id: id });
  if (error) throw new Error(error.message);
  invalidateReceiptData();
}

export async function phanBoSoDuPhieuThu(id: string, phanBo: PhanBoPhieuThuInput[]) {
  if (!id || phanBo.length === 0) throw new Error("Chưa có khoản phân bổ.");
  if (phanBo.some((item) => !item.don_hang_id || !Number.isFinite(item.so_tien) || item.so_tien <= 0)) {
    throw new Error("Số tiền phân bổ phải lớn hơn 0.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("phan_bo_so_du_phieu_thu", {
    p_phieu_thu_id: id,
    p_phan_bo: phanBo,
  });
  if (error) throw new Error(error.message);
  invalidateReceiptData();
}
