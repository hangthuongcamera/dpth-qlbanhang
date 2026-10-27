"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { notifyOrder, OrderNotificationToast } from "@/components/don-hang/order-notification-toast";
import { luuCaiDatCuaHang, type CaiDatState } from "@/lib/supabase/cua-hang-settings-actions";
import type { CuaHangSettings } from "@/lib/cua-hang-settings";

const initialState: CaiDatState = { ok: false, message: "" };

function Field({ label, name, value, required = false, hint, maxLength }: {
  label: string;
  name: keyof Omit<CuaHangSettings, "id">;
  value: string;
  required?: boolean;
  hint?: string;
  maxLength?: number;
}) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">
    <span>{label}{required && <span className="text-red-600"> *</span>}</span>
    <input name={name} defaultValue={value} required={required} maxLength={maxLength} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
  </label>;
}

export function CuaHangSettingsForm({ settings }: { settings: CuaHangSettings }) {
  const [state, formAction, pending] = useActionState(luuCaiDatCuaHang, initialState);

  useEffect(() => {
    if (!state.message) return;
    notifyOrder({ type: state.ok ? "success" : "error", message: state.message });
  }, [state]);

  return <form action={formAction} className="space-y-6">
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Thông tin cửa hàng trên hóa đơn</h2>
      <p className="mt-1 text-sm text-slate-500">Thông tin này được đưa vào bill K80 và phiếu giao hàng A4/A5.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Tên cửa hàng" name="ten_cua_hang" value={settings.ten_cua_hang} required maxLength={120} />
        <Field label="Hotline / Zalo" name="hotline" value={settings.hotline} required maxLength={40} />
        <Field label="Địa chỉ cửa hàng" name="dia_chi" value={settings.dia_chi} maxLength={300} />
        <Field label="Lời nhắn cuối hóa đơn" name="loi_nhan_chan_phieu" value={settings.loi_nhan_chan_phieu} maxLength={500} />
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Tài khoản nhận tiền VietQR</h2>
      <p className="mt-1 text-sm text-slate-500">Mã QR trên hóa đơn sẽ dùng tài khoản này và tự điền số tiền còn phải thu cùng mã đơn hàng.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Field label="Tên chủ tài khoản" name="ten_chu_tai_khoan" value={settings.ten_chu_tai_khoan} required maxLength={120} />
        <Field label="Số tài khoản" name="so_tai_khoan" value={settings.so_tai_khoan} required maxLength={20} />
        <Field label="Tên ngân hàng" name="ten_ngan_hang" value={settings.ten_ngan_hang} required maxLength={100} />
        <Field label="Mã BIN NAPAS" name="ma_ngan_hang" value={settings.ma_ngan_hang} required maxLength={6} />
      </div>
    </section>

    <OrderNotificationToast />
    <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Đang lưu..." : "Lưu cấu hình"}</Button></div>
  </form>;
}



