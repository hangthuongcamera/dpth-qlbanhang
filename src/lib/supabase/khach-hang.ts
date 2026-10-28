import { createClient } from "./client";

type CreateKhachHangData = {
  ten_khach_hang: string;
  so_dien_thoai?: string;
  email?: string;
  dia_chi?: string;
  ma_so_thue?: string;
  nguoi_lien_he?: string;
  han_muc_cong_no: number;
  ghi_chu?: string;
  trang_thai: boolean;
  anh_dai_dien_url?: string;
};

export async function createKhachHang(data: CreateKhachHangData) {
  const supabase = createClient();

  // Sinh mã khách hàng từ PostgreSQL
  const { data: maKhachHang, error: maError } = await supabase.rpc(
    "tao_ma_khach_hang"
  );

  if (maError) {
    throw new Error(maError.message);
  }

  const { data: customer, error } = await supabase
    .from("khach_hang")
    .insert({
      ma_khach_hang: maKhachHang,
      ten_khach_hang: data.ten_khach_hang,
      so_dien_thoai: data.so_dien_thoai || null,
      email: data.email || null,
      dia_chi: data.dia_chi || null,
      ma_so_thue: data.ma_so_thue || null,
      nguoi_lien_he: data.nguoi_lien_he || null,
      han_muc_cong_no: data.han_muc_cong_no,
      ghi_chu: data.ghi_chu || null,
      trang_thai: data.trang_thai,
      anh_dai_dien_url: data.anh_dai_dien_url || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return customer;
}
export async function updateKhachHang(
  id: string,
  data: CreateKhachHangData
) {
  const supabase = createClient();

  const { data: customer, error } = await supabase
    .from("khach_hang")
    .update({
      ten_khach_hang: data.ten_khach_hang,
      so_dien_thoai: data.so_dien_thoai || null,
      email: data.email || null,
      dia_chi: data.dia_chi || null,
      ma_so_thue: data.ma_so_thue || null,
      nguoi_lien_he: data.nguoi_lien_he || null,
      han_muc_cong_no: data.han_muc_cong_no,
      ghi_chu: data.ghi_chu || null,
      trang_thai: data.trang_thai,
      anh_dai_dien_url: data.anh_dai_dien_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return customer;
}
