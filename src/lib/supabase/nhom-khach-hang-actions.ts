"use server";

import { createClient } from "./server";

export type NhomKhachHang = {
  id: string;
  ten_nhom: string;
  trang_thai: boolean;
  ap_dung_bang_gia: boolean;
};

export async function getNhomKhachHang(includeInactive = false): Promise<NhomKhachHang[]> {
  const supabase = await createClient();
  let query = supabase.from("nhom_khach_hang").select("id, ten_nhom, trang_thai, ap_dung_bang_gia").order("ten_nhom");
  if (!includeInactive) query = query.eq("trang_thai", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as NhomKhachHang[];
}

export async function getNhomKhachHangById(id: string): Promise<NhomKhachHang> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nhom_khach_hang")
    .select("id, ten_nhom, trang_thai, ap_dung_bang_gia")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Không tìm thấy nhóm khách hàng.");
  return data as NhomKhachHang;
}

export type KhachHangTrongNhom = {
  id: string;
  ma_khach_hang: string;
  ten_khach_hang: string;
  so_dien_thoai: string | null;
  email: string | null;
  trang_thai: boolean;
};

export async function getKhachHangTrongNhom(nhomId: string): Promise<KhachHangTrongNhom[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khach_hang")
    .select("id, ma_khach_hang, ten_khach_hang, so_dien_thoai, email, trang_thai")
    .eq("nhom_khach_hang_id", nhomId)
    .order("ten_khach_hang");
  if (error) throw new Error(error.message);
  return (data ?? []) as KhachHangTrongNhom[];
}

export async function getKhachHangChuaCoNhom(): Promise<KhachHangTrongNhom[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("khach_hang")
    .select("id, ma_khach_hang, ten_khach_hang, so_dien_thoai, email, trang_thai")
    .is("nhom_khach_hang_id", null)
    .eq("la_khach_le", false)
    .order("ten_khach_hang");
  if (error) throw new Error(error.message);
  return (data ?? []) as KhachHangTrongNhom[];
}

export async function ganKhachHangVaoNhom(nhomId: string, khachHangIds: string[]) {
  const ids = [...new Set(khachHangIds)].filter(Boolean);
  if (!ids.length) return;
  const supabase = await createClient();
  const { data: group, error: groupError } = await supabase
    .from("nhom_khach_hang")
    .select("trang_thai")
    .eq("id", nhomId)
    .single();
  if (groupError) throw new Error(groupError.message);
  if (!group.trang_thai) throw new Error("Không thể thêm khách hàng mới vào nhóm đang ngừng hoạt động.");
  const { data, error } = await supabase
    .from("khach_hang")
    .update({ nhom_khach_hang_id: nhomId, updated_at: new Date().toISOString() })
    .in("id", ids)
    .is("nhom_khach_hang_id", null)
    .eq("la_khach_le", false)
    .select("id");
  if (error) throw new Error(error.message);
  if ((data ?? []).length !== ids.length) {
    throw new Error("Một số khách hàng đã thuộc nhóm khác hoặc không còn khả dụng. Vui lòng tải lại danh sách.");
  }
}

export async function capNhatThanhVienNhom(nhomId: string, khachHangIds: string[]) {
  const desiredIds = [...new Set(khachHangIds)].filter(Boolean);
  const supabase = await createClient();
  const { data: group, error: groupError } = await supabase
    .from("nhom_khach_hang")
    .select("trang_thai")
    .eq("id", nhomId)
    .single();
  if (groupError) throw new Error(groupError.message);

  const { data: currentRows, error: currentError } = await supabase
    .from("khach_hang")
    .select("id")
    .eq("nhom_khach_hang_id", nhomId);
  if (currentError) throw new Error(currentError.message);

  const currentIds = (currentRows ?? []).map((customer) => customer.id);
  const currentSet = new Set(currentIds);
  const desiredSet = new Set(desiredIds);
  const toAdd = desiredIds.filter((id) => !currentSet.has(id));
  const toRemove = currentIds.filter((id) => !desiredSet.has(id));

  if (!group.trang_thai && toAdd.length > 0) {
    throw new Error("Không thể thêm khách hàng mới vào nhóm đang ngừng hoạt động.");
  }

  if (toAdd.length > 0) {
    const { data, error } = await supabase
      .from("khach_hang")
      .update({ nhom_khach_hang_id: nhomId, updated_at: new Date().toISOString() })
      .in("id", toAdd)
      .is("nhom_khach_hang_id", null)
      .eq("la_khach_le", false)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== toAdd.length) {
      throw new Error("Một số khách hàng đã thuộc nhóm khác hoặc không còn khả dụng. Vui lòng tải lại danh sách.");
    }
  }

  if (toRemove.length > 0) {
    const { data, error } = await supabase
      .from("khach_hang")
      .update({ nhom_khach_hang_id: null, updated_at: new Date().toISOString() })
      .in("id", toRemove)
      .eq("nhom_khach_hang_id", nhomId)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== toRemove.length) {
      throw new Error("Danh sách khách hàng đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
  }
}

export async function taoNhomKhachHang(tenNhom: string) {
  const ten = tenNhom.trim();
  if (!ten) throw new Error("Vui lòng nhập tên nhóm khách hàng.");
  if (ten.length > 120) throw new Error("Tên nhóm không được vượt quá 120 ký tự.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("nhom_khach_hang").insert({ ten_nhom: ten }).select("id, ten_nhom, trang_thai, ap_dung_bang_gia").single();
  if (error?.code === "23505") throw new Error("Tên nhóm khách hàng đã tồn tại.");
  if (error) throw new Error(error.message);
  return data as NhomKhachHang;
}

export async function capNhatNhomKhachHang(id: string, values: Partial<Pick<NhomKhachHang, "ten_nhom" | "trang_thai" | "ap_dung_bang_gia">>) {
  const patch: typeof values = { ...values };
  if (patch.ten_nhom !== undefined) {
    patch.ten_nhom = patch.ten_nhom.trim();
    if (!patch.ten_nhom) throw new Error("Tên nhóm không được để trống.");
    if (patch.ten_nhom.length > 120) throw new Error("Tên nhóm không được vượt quá 120 ký tự.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("nhom_khach_hang").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("id, ten_nhom, trang_thai, ap_dung_bang_gia").single();
  if (error?.code === "23505") throw new Error("Tên nhóm khách hàng đã tồn tại.");
  if (error) throw new Error(error.message);
  return data as NhomKhachHang;
}

export async function xoaNhomKhachHang(id: string) {
  const supabase = await createClient();
  const { count, error: customerError } = await supabase.from("khach_hang").select("id", { count: "exact", head: true }).eq("nhom_khach_hang_id", id);
  if (customerError) throw new Error(customerError.message);
  if ((count ?? 0) > 0) throw new Error("Không thể xóa nhóm đang có khách hàng. Hãy chuyển khách hàng sang nhóm khác trước.");
  const { error } = await supabase.from("nhom_khach_hang").delete().eq("id", id);
  if (error?.code === "23503") throw new Error("Không thể xóa nhóm khách hàng đang được sử dụng.");
  if (error) throw new Error(error.message);
}

export async function luuGiaNhomKhachHang(input: {
  nhomId: string;
  sanPhamId: string;
  bienTheId: string | null;
  donGia: number | null;
}) {
  if (input.donGia !== null && (!Number.isSafeInteger(input.donGia) || input.donGia < 0)) {
    throw new Error("Giá nhóm phải là số không âm.");
  }
  const supabase = await createClient();
  let lookup = supabase.from("gia_nhom_khach_hang").select("id").eq("nhom_khach_hang_id", input.nhomId);
  lookup = input.bienTheId
    ? lookup.eq("bien_the_san_pham_id", input.bienTheId)
    : lookup.eq("san_pham_id", input.sanPhamId).is("bien_the_san_pham_id", null);
  const { data: current, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (input.donGia === null) {
    if (current) {
      const { error } = await supabase.from("gia_nhom_khach_hang").delete().eq("id", current.id);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const values = {
    nhom_khach_hang_id: input.nhomId,
    san_pham_id: input.bienTheId ? null : input.sanPhamId,
    bien_the_san_pham_id: input.bienTheId,
    don_gia: input.donGia,
    updated_at: new Date().toISOString(),
  };
  const { error } = current
    ? await supabase.from("gia_nhom_khach_hang").update(values).eq("id", current.id)
    : await supabase.from("gia_nhom_khach_hang").insert(values);
  if (error) throw new Error(error.message);
}


