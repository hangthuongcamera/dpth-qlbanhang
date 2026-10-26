export type KhachHang = {
  id: string;
  ma_khach_hang: string;
  ten_khach_hang: string;
  so_dien_thoai: string | null;
  email: string | null;
  dia_chi: string | null;
  ma_so_thue: string | null;
  nguoi_lien_he: string | null;
  han_muc_cong_no: number;
  ghi_chu: string | null;
  trang_thai: boolean;
  anh_dai_dien_url: string | null;
  nhom_khach_hang_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NhomKhachHangOption = {
  id: string;
  ten_nhom: string;
  trang_thai: boolean;
  ap_dung_bang_gia: boolean;
};
export type KhachHangFormData = {
  ten_khach_hang: string;
  so_dien_thoai: string;
  email: string;
  dia_chi: string;
  ma_so_thue: string;
  nguoi_lien_he: string;
  han_muc_cong_no: number;
  ghi_chu: string;
  trang_thai: boolean;
  anh_dai_dien_url?: string;
};
