export interface NhanVienRecord {
  id: string;
  user_id: string;
  ho_ten: string;
  ten_dang_nhap: string;
  email: string | null;
  vai_tro: "owner" | "staff";
  trang_thai: "active" | "inactive";
  created_at: string;
  don_hang_count: number;
  phieu_thu_count: number;
}
