"use server";

import { createClient } from "./server";

export type ChiTietDonHangInput = {
  san_pham_id: string;
  bien_the_san_pham_id: string | null;
  so_luong: number;
  don_gia: number;
  gia_goc: number;
  gia_da_chinh_sua_thu_cong: boolean;
};

export async function taoDonHang(input: {
  khach_hang_id: string;
  loai_don_hang: "dat_hang" | "ban_nhanh";
  ngay_dat: string;
  han_giao: string;
  giam_gia: number;
  phi_van_chuyen: number;
  ghi_chu: string;
  so_tien_thanh_toan: number;
  phuong_thuc_thanh_toan: string;
  giao_hang?: boolean;
  so_dien_thoai_giao_hang?: string;
  dia_chi_giao_hang?: string;
  chi_tiet: ChiTietDonHangInput[];
}) {
  if (!input.khach_hang_id) throw new Error("Vui lòng chọn khách hàng.");
  if (!input.chi_tiet.length) throw new Error("Vui lòng thêm ít nhất một sản phẩm vào đơn.");
  if (input.chi_tiet.some((item) => !Number.isSafeInteger(item.so_luong) || item.so_luong < 1 || !Number.isFinite(item.don_gia) || item.don_gia < 0 || !Number.isFinite(item.gia_goc) || item.gia_goc < 0)) {
    throw new Error("Số lượng phải là số nguyên từ 1 trở lên và đơn giá không được âm.");
  }
  const supabase = await createClient();
  const { data: customer, error: customerError } = await supabase.from("khach_hang").select("nhom_khach_hang_id, la_khach_le").eq("id", input.khach_hang_id).maybeSingle();
  if (customerError || !customer) throw new Error("Không tìm thấy khách hàng để tạo đơn.");
  const productIds = [...new Set(input.chi_tiet.map((item) => item.san_pham_id))];
  const [{ data: productRows, error: productError }, { data: variantRows, error: variantError }] = await Promise.all([
    supabase.from("san_pham").select("id, gia_ban").in("id", productIds).eq("trang_thai", true),
    supabase.from("bien_the_san_pham").select("id, san_pham_id, gia_ban").in("san_pham_id", productIds).eq("trang_thai", true),
  ]);
  if (productError || variantError) throw new Error("Không thể kiểm tra giá mặc định của sản phẩm.");
  const productMap = new Map((productRows ?? []).map((item) => [item.id, Number(item.gia_ban)] as const));
  const variantMap = new Map((variantRows ?? []).map((item) => [item.id, { sanPhamId: item.san_pham_id, gia: Number(item.gia_ban) }] as const));
  const activeVariantCounts = new Map<string, number>();
  for (const variant of variantRows ?? []) activeVariantCounts.set(variant.san_pham_id, (activeVariantCounts.get(variant.san_pham_id) ?? 0) + 1);

  let groupPricingEnabled = false;
  const groupPrices = new Map<string, number>();
  if (customer.nhom_khach_hang_id) {
    const { data: group, error: groupError } = await supabase.from("nhom_khach_hang").select("ap_dung_bang_gia").eq("id", customer.nhom_khach_hang_id).maybeSingle();
    if (groupError) throw new Error("Không thể kiểm tra nhóm khách hàng.");
    groupPricingEnabled = Boolean(group?.ap_dung_bang_gia);
    if (groupPricingEnabled) {
      const { data: rows, error: pricesError } = await supabase.from("gia_nhom_khach_hang").select("san_pham_id, bien_the_san_pham_id, don_gia").eq("nhom_khach_hang_id", customer.nhom_khach_hang_id);
      if (pricesError) throw new Error("Không thể tải bảng giá nhóm.");
      for (const row of rows ?? []) {
        const key = row.bien_the_san_pham_id ?? row.san_pham_id;
        if (key) groupPrices.set(key, Number(row.don_gia));
      }
    }
  }

  const details = input.chi_tiet.map((item) => {
    const defaultPrice = productMap.get(item.san_pham_id);
    if (defaultPrice === undefined) throw new Error("Một sản phẩm trong đơn không tồn tại hoặc đã ngừng kinh doanh.");
    let fallbackPrice = defaultPrice;
    if (item.bien_the_san_pham_id) {
      const variant = variantMap.get(item.bien_the_san_pham_id);
      if (!variant || variant.sanPhamId !== item.san_pham_id) throw new Error("Biến thể không thuộc sản phẩm đã chọn hoặc đã ngừng kinh doanh.");
      fallbackPrice = variant.gia;
    } else if ((activeVariantCounts.get(item.san_pham_id) ?? 0) > 0) {
      throw new Error("Vui lòng chọn biến thể của sản phẩm này.");
    }
    const groupPriceKey = item.bien_the_san_pham_id ?? item.san_pham_id;
    const basePrice = groupPricingEnabled ? groupPrices.get(groupPriceKey) ?? fallbackPrice : fallbackPrice;
    return { ...item, gia_goc: basePrice, don_gia: item.gia_da_chinh_sua_thu_cong ? item.don_gia : basePrice };
  });
  const subtotal = details.reduce((sum, item) => sum + item.so_luong * item.don_gia, 0);
  if (!Number.isFinite(input.giam_gia) || input.giam_gia < 0 || input.giam_gia > subtotal) throw new Error("Giảm giá phải nằm trong khoảng từ 0 đến tạm tính.");
  if (!Number.isFinite(input.phi_van_chuyen) || input.phi_van_chuyen < 0) throw new Error("Phí vận chuyển không được âm.");
  const total = subtotal - input.giam_gia + input.phi_van_chuyen;
  if (!Number.isFinite(input.so_tien_thanh_toan) || input.so_tien_thanh_toan < 0) throw new Error("Số tiền thanh toán không hợp lệ.");
  if (input.loai_don_hang === "ban_nhanh" && input.giao_hang && (!input.so_dien_thoai_giao_hang?.trim() || !input.dia_chi_giao_hang?.trim())) {
    throw new Error("Vui lòng nhập đủ số điện thoại và địa chỉ giao hàng.");
  }
  if (input.loai_don_hang === "ban_nhanh" && customer.la_khach_le && input.so_tien_thanh_toan < total) {
    throw new Error("Khách lẻ cần thanh toán đủ tổng đơn. Vui lòng chọn khách hàng để ghi công nợ.");
  }
  if (input.loai_don_hang === "dat_hang") {
    if (customer.la_khach_le) throw new Error("Đơn đặt hàng cần chọn hồ sơ khách hàng.");
    if (!input.han_giao) throw new Error("Vui lòng chọn hạn giao hàng cho đơn đặt hàng.");
    if (input.ngay_dat && input.han_giao < input.ngay_dat) throw new Error("Hạn giao hàng không được trước ngày đặt hàng.");
    if (input.so_tien_thanh_toan > total) throw new Error("Tiền cọc không được lớn hơn tổng tiền đơn.");
  }
  const { data, error } = await supabase.rpc("tao_don_hang_voi_chi_tiet", {
    p_khach_hang_id: input.khach_hang_id,
    p_ngay_dat: input.ngay_dat || null,
    p_han_giao: input.han_giao || null,
    p_tam_tinh: subtotal,
    p_giam_gia: input.giam_gia,
    p_phi_van_chuyen: input.phi_van_chuyen,
    p_tong_tien: total,
    p_ghi_chu: input.ghi_chu,
    p_chi_tiet: details,
    p_loai_don_hang: input.loai_don_hang,
    p_so_tien_thanh_toan: input.so_tien_thanh_toan,
    p_phuong_thuc_thanh_toan: input.phuong_thuc_thanh_toan,
    p_giao_hang: input.loai_don_hang === "ban_nhanh" && Boolean(input.giao_hang),
    p_so_dien_thoai_giao_hang: input.giao_hang ? input.so_dien_thoai_giao_hang?.trim() || null : null,
    p_dia_chi_giao_hang: input.giao_hang ? input.dia_chi_giao_hang?.trim() || null : null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Không nhận được phản hồi sau khi lưu.");
  if (typeof data === "string") {
    return { id: data, ma_don_hang: "" };
  }
  const result = data as { id?: string; ma_don_hang?: string };
  return {
    id: String(result.id ?? ""),
    ma_don_hang: String(result.ma_don_hang ?? ""),
  };
}

export async function capNhatDonHang(input: {
  don_hang_id: string;
  han_giao: string;
  dia_chi_giao_hang: string;
  ghi_chu: string;
  giam_gia: number;
  phi_van_chuyen: number;
  chi_tiet: ChiTietDonHangInput[];
}) {
  if (!input.don_hang_id) throw new Error("Đơn hàng không hợp lệ.");
  if (!input.chi_tiet.length) throw new Error("Đơn hàng cần có ít nhất một sản phẩm.");
  if (input.chi_tiet.some((item) =>
    !Number.isFinite(item.so_luong) || item.so_luong <= 0 ||
    !Number.isFinite(item.don_gia) || item.don_gia < 0 ||
    !Number.isFinite(item.gia_goc) || item.gia_goc < 0
  )) {
    throw new Error("Số lượng phải lớn hơn 0 và đơn giá không được âm.");
  }
  if (!Number.isFinite(input.giam_gia) || input.giam_gia < 0 || !Number.isFinite(input.phi_van_chuyen) || input.phi_van_chuyen < 0) {
    throw new Error("Giảm giá và phí vận chuyển không được âm.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cap_nhat_don_hang", {
    p_don_hang_id: input.don_hang_id,
    p_han_giao: input.han_giao || null,
    p_dia_chi_giao_hang: input.dia_chi_giao_hang || null,
    p_ghi_chu: input.ghi_chu || null,
    p_giam_gia: input.giam_gia,
    p_phi_van_chuyen: input.phi_van_chuyen,
    p_chi_tiet: input.chi_tiet,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; tam_tinh: number; tong_tien: number; da_thu: number };
}

export async function thuTienDonHang(input: { don_hang_id: string; so_tien: number; phuong_thuc_thanh_toan: string }) {
  if (!input.don_hang_id) throw new Error("Đơn hàng không hợp lệ.");
  if (!Number.isFinite(input.so_tien) || input.so_tien <= 0) throw new Error("Số tiền thu phải lớn hơn 0.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("thu_tien_don_hang", {
    p_don_hang_id: input.don_hang_id,
    p_so_tien: input.so_tien,
    p_phuong_thuc_thanh_toan: input.phuong_thuc_thanh_toan,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function capNhatTrangThaiDonHang(input: {
  don_hang_id: string;
  trang_thai_moi: "xac_nhan" | "dang_thuc_hien" | "hoan_thanh" | "da_huy";
  ghi_chu?: string;
}) {
  if (!input.don_hang_id) throw new Error("Đơn hàng không hợp lệ.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cap_nhat_trang_thai_don_hang", {
    p_don_hang_id: input.don_hang_id,
    p_trang_thai_moi: input.trang_thai_moi,
    p_ghi_chu: input.ghi_chu || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function xoaDonHang(id: string) {
  if (!id?.trim()) throw new Error("Mã đơn hàng không hợp lệ.");
  const supabase = await createClient();

  // Thử gọi hàm RPC PostgreSQL đã tối ưu hóa
  const { data, error } = await supabase.rpc("xoa_don_hang", { p_don_hang_id: id });
  if (!error) {
    return { success: true, message: `Đã xóa đơn hàng ${data ?? ""} thành công.` };
  }

  // Nếu vi phạm ràng buộc kế toán (đã phát sinh thu tiền)
  if (error.code === "23514") {
    throw new Error(error.message);
  }

  // Fallback an toàn nếu RPC chưa được chạy trên môi trường remote
  if (error.code === "PGRST202" || error.code === "42883") {
    const { data: order, error: orderErr } = await supabase
      .from("don_hang")
      .select("id, ma_don_hang")
      .eq("id", id)
      .maybeSingle();
    if (orderErr || !order) throw new Error("Không tìm thấy đơn hàng cần xóa.");

    const { data: allocations, error: allocErr } = await supabase
      .from("phieu_thu_phan_bo")
      .select("so_tien, phieu_thu!inner(trang_thai)")
      .eq("don_hang_id", id)
      .eq("phieu_thu.trang_thai", "da_xac_nhan");

    if (allocErr) throw new Error("Không thể kiểm tra lịch sử thanh toán của đơn hàng.");

    const totalPaid = (allocations ?? []).reduce((sum, item) => sum + Number(item.so_tien || 0), 0);
    if (totalPaid > 0) {
      throw new Error(
        `Đơn hàng ${order.ma_don_hang} đã phát sinh thu tiền (${totalPaid.toLocaleString("vi-VN")} ₫). Để bảo toàn sổ quỹ kế toán, vui lòng chuyển trạng thái đơn sang "Đã hủy" thay vì xóa.`
      );
    }

    await supabase.from("phieu_thu_phan_bo").delete().eq("don_hang_id", id);
    await supabase.from("giao_dich_cong_no").delete().eq("don_hang_id", id);
    const { error: itemsErr } = await supabase.from("don_hang_chi_tiet").delete().eq("don_hang_id", id);
    if (itemsErr) throw new Error(`Không thể xóa chi tiết đơn hàng: ${itemsErr.message}`);

    const { error: delErr } = await supabase.from("don_hang").delete().eq("id", id);

    if (delErr) throw new Error(`Không thể xóa đơn hàng: ${delErr.message}`);

    return { success: true, message: `Đã xóa đơn hàng ${order.ma_don_hang} thành công.` };
  }

  throw new Error(error.message || "Không thể xóa đơn hàng.");
}


