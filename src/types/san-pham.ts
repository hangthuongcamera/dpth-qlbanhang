export type LoaiSanPham = {
  id: string;
  ma_loai: string;
  ten_loai: string;
  trang_thai: boolean;
};

export type BienTheSanPham = {
  id: string;
  san_pham_id: string;
  ma_sku: string;
  thuoc_tinh: Record<string, string>;
  gia_ban: number;
  gia_nhap: number;
  trang_thai: boolean;
};

export type SanPham = {
  id: string;
  ma_san_pham: string;
  ten_san_pham: string;
  loai_san_pham_id: string;
  don_vi_tinh: string;
  gia_ban: number;
  gia_nhap: number;
  mo_ta: string | null;
  trang_thai: boolean;
  loai_san_pham?: Pick<LoaiSanPham, "ten_loai"> | null;
  bien_the_san_pham?: BienTheSanPham[];
};
