export type CuaHangSettings = {
  id: boolean;
  ten_cua_hang: string;
  hotline: string;
  dia_chi: string;
  ten_ngan_hang: string;
  ma_ngan_hang: string;
  so_tai_khoan: string;
  ten_chu_tai_khoan: string;
  loi_nhan_chan_phieu: string;
};

export const DEFAULT_CUA_HANG_SETTINGS: CuaHangSettings = {
  id: true,
  ten_cua_hang: "ĐỒNG PHỤC THANH HẰNG",
  hotline: "0933.657.622",
  dia_chi: "",
  ten_ngan_hang: "VietinBank",
  ma_ngan_hang: "970415",
  so_tai_khoan: "0933657622",
  ten_chu_tai_khoan: "DAO THI THANH HANG",
  loi_nhan_chan_phieu: "Quý khách vui lòng kiểm tra đủ số lượng và quy cách đồng phục trước khi nhận hàng.",
};
