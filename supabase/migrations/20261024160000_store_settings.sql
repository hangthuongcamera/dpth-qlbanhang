-- Cấu hình cửa hàng hiển thị trên hóa đơn và tài khoản nhận tiền VietQR.
CREATE TABLE IF NOT EXISTS public.cai_dat_cua_hang (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  ten_cua_hang text NOT NULL CHECK (char_length(btrim(ten_cua_hang)) BETWEEN 1 AND 120),
  hotline text NOT NULL CHECK (char_length(btrim(hotline)) BETWEEN 1 AND 40),
  dia_chi text NOT NULL DEFAULT '' CHECK (char_length(dia_chi) <= 300),
  ten_ngan_hang text NOT NULL CHECK (char_length(btrim(ten_ngan_hang)) BETWEEN 1 AND 100),
  ma_ngan_hang text NOT NULL CHECK (ma_ngan_hang ~ '^[0-9]{6}$'),
  so_tai_khoan text NOT NULL CHECK (so_tai_khoan ~ '^[0-9]{6,20}$'),
  ten_chu_tai_khoan text NOT NULL CHECK (char_length(btrim(ten_chu_tai_khoan)) BETWEEN 1 AND 120),
  loi_nhan_chan_phieu text NOT NULL DEFAULT '' CHECK (char_length(loi_nhan_chan_phieu) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cai_dat_cua_hang ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_manage_cai_dat_cua_hang ON public.cai_dat_cua_hang;
CREATE POLICY authenticated_manage_cai_dat_cua_hang ON public.cai_dat_cua_hang
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.cai_dat_cua_hang TO authenticated;

INSERT INTO public.cai_dat_cua_hang (
  id, ten_cua_hang, hotline, dia_chi, ten_ngan_hang, ma_ngan_hang,
  so_tai_khoan, ten_chu_tai_khoan, loi_nhan_chan_phieu
) VALUES (
  true,
  'ĐỒNG PHỤC THANH HẰNG',
  '0933.657.622',
  '',
  'VietinBank',
  '970415',
  '0933657622',
  'DAO THI THANH HANG',
  'Quý khách vui lòng kiểm tra đủ số lượng và quy cách đồng phục trước khi nhận hàng.'
)
ON CONFLICT (id) DO NOTHING;
