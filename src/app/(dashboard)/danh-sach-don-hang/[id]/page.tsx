import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { OrderPaymentPanel } from "@/components/don-hang/order-payment-panel";
import { OrderNotificationToast } from "@/components/don-hang/order-notification-toast";
import { OrderStatusActions } from "@/components/don-hang/order-status-actions";
import { OrderDeleteButton } from "@/components/don-hang/order-delete-button";
import { OrderPrintDialog } from "@/components/don-hang/order-print-dialog";
import { getTrangThaiBadge, getLoaiDonHangBadge, formatCurrency } from "@/types/don-hang";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/user-profile";
import { DEFAULT_CUA_HANG_SETTINGS, type CuaHangSettings } from "@/lib/cua-hang-settings";

type Props = {
  params: Promise<{ id: string }>;
};

const paymentMethodLabels: Record<string, string> = {
  tien_mat: "Tiền mặt",
  chuyen_khoan: "Chuyển khoản",
  the: "Thẻ",
  vi_dien_tu: "Ví điện tử",
  khac: "Khác",
};

export default async function DonHangChiTietPage({ params }: Props) {
  const { id } = await params;
  const userProfile = await getCurrentUserProfile();
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase.from("don_hang").select("*").eq("id", id).maybeSingle();
  if (orderError) throw new Error("Không thể tải đơn hàng.");
  if (!order) notFound();

  // Nhân viên (staff) chỉ được xem đơn hàng do chính mình tạo
  if (userProfile?.vai_tro === "staff" && order.created_by && order.created_by !== userProfile.user_id) {
    notFound();
  }

  const { data: detailRows, error: detailError } = await supabase.from("don_hang_chi_tiet").select("*").eq("don_hang_id", id).order("created_at");
  if (detailError) throw new Error("Không thể tải chi tiết đơn hàng.");
  const details = detailRows ?? [];
  const { data: settingsRow } = await supabase.from("cai_dat_cua_hang").select("*").eq("id", true).maybeSingle();
  const storeSettings = (settingsRow as CuaHangSettings | null) ?? DEFAULT_CUA_HANG_SETTINGS;
  const { data: allocationRows, error: paymentError } = await supabase.from("phieu_thu_phan_bo").select("phieu_thu_id, so_tien").eq("don_hang_id", id);
  if (paymentError) throw new Error("Không thể tải lịch sử thanh toán của đơn hàng.");
  const receiptIds = [...new Set((allocationRows ?? []).map((row) => row.phieu_thu_id))];
  const { data: receipts, error: receiptsError } = receiptIds.length
    ? await supabase.from("phieu_thu").select("id, trang_thai, phuong_thuc_thanh_toan, ngay_thu").in("id", receiptIds)
    : { data: [], error: null };
  if (receiptsError) throw new Error("Không thể tải phiếu thu của đơn hàng.");
  const confirmedReceiptIds = new Set((receipts ?? []).filter((receipt) => receipt.trang_thai === "da_xac_nhan").map((receipt) => receipt.id));
  const paidAmount = (allocationRows ?? []).reduce((sum, row) => confirmedReceiptIds.has(row.phieu_thu_id) ? sum + Number(row.so_tien) : sum, 0);
  const receiptMap = new Map((receipts ?? []).map((receipt) => [receipt.id, receipt] as const));
  const paymentHistory = (allocationRows ?? []).filter((row) => confirmedReceiptIds.has(row.phieu_thu_id));
  const remainingAmount = Math.max(0, Number(order.tong_tien) - paidAmount);
  const paymentStatus = remainingAmount === 0 ? "Đã thanh toán đủ" : paidAmount > 0 ? "Thanh toán một phần" : "Chưa thanh toán";
  const productIds = [...new Set(details.map((item) => item.san_pham_id))];
  const variantIds = [...new Set(details.map((item) => item.bien_the_san_pham_id).filter(Boolean))];
  const [{ data: products }, { data: variants }, { data: customer }] = await Promise.all([
    productIds.length ? supabase.from("san_pham").select("id, ma_san_pham, ten_san_pham, don_vi_tinh").in("id", productIds) : Promise.resolve({ data: [] }),
    variantIds.length ? supabase.from("bien_the_san_pham").select("id, ma_sku, thuoc_tinh").in("id", variantIds) : Promise.resolve({ data: [] }),
    supabase.from("khach_hang").select("ma_khach_hang, ten_khach_hang, so_dien_thoai, dia_chi").eq("id", order.khach_hang_id).maybeSingle(),
  ]);
  const productMap = new Map((products ?? []).map((item) => [item.id, item] as const));
  const variantMap = new Map((variants ?? []).map((item) => [item.id, item] as const));
  const statusBadge = getTrangThaiBadge(order.trang_thai);
  const typeBadge = getLoaiDonHangBadge(order.loai_don_hang);
  const isStaff = userProfile?.vai_tro === "staff";
  const isOwnerOfOrder = !order.created_by || order.created_by === userProfile?.user_id;
  const printLines = details.map((item) => {
    const product = productMap.get(item.san_pham_id);
    const variant = variantMap.get(item.bien_the_san_pham_id);
    return {
      ten_san_pham: product?.ten_san_pham ?? "Sản phẩm đã xóa",
      ma_san_pham: product?.ma_san_pham ?? "",
      thuoc_tinh: Object.entries(variant?.thuoc_tinh ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · "),
      ma_sku: variant?.ma_sku ?? null,
      don_vi_tinh: product?.don_vi_tinh ?? "",
      so_luong: Number(item.so_luong),
      don_gia: Number(item.don_gia),
      thanh_tien: Number(item.thanh_tien),
    };
  });

  return <div className="space-y-4 app-page">
    <OrderNotificationToast />
    <div className="app-detail-header">
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-semibold">Đơn hàng {order.ma_don_hang}</h2>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.badgeClass}`}>
            {statusBadge.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{customer?.ten_khach_hang ?? "Khách hàng"} · {customer?.ma_khach_hang ?? ""}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(order.trang_thai === "xac_nhan" || order.trang_thai === "dang_thuc_hien") && (!isStaff || isOwnerOfOrder) && (
          <Link href={`/danh-sach-don-hang/${id}/chinh-sua`} className={buttonVariants({ variant: "outline" })}>Chỉnh sửa</Link>
        )}
        <OrderPrintDialog
          settings={storeSettings}
          order={{ ma_don_hang: order.ma_don_hang, ngay_dat: order.ngay_dat, han_giao: order.han_giao, giao_hang: Boolean(order.giao_hang), so_dien_thoai_giao_hang: order.so_dien_thoai_giao_hang ?? null, dia_chi_giao_hang: order.dia_chi_giao_hang ?? null, tam_tinh: Number(order.tam_tinh), giam_gia: Number(order.giam_gia), phi_van_chuyen: Number(order.phi_van_chuyen), tong_tien: Number(order.tong_tien), loai_don_hang: order.loai_don_hang }}
          customer={{ ten_khach_hang: customer?.ten_khach_hang ?? "Khách hàng", ma_khach_hang: customer?.ma_khach_hang ?? "", so_dien_thoai: customer?.so_dien_thoai ?? null, dia_chi: customer?.dia_chi ?? null }}
          lines={printLines}
          paidAmount={paidAmount}
          remainingAmount={remainingAmount}
        />
        <OrderStatusActions orderId={id} currentStatus={order.trang_thai} orderType={order.loai_don_hang} />
        {!isStaff && <OrderDeleteButton orderId={id} orderCode={order.ma_don_hang} paidAmount={paidAmount} />}
        <Link href="/danh-sach-don-hang" className={buttonVariants({ variant: "outline" })}>Quay lại danh sách</Link>
      </div>
    </div>
    <section className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2 lg:grid-cols-6">
      <div>
        <p className="text-xs text-slate-500">Loại đơn</p>
        <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeBadge.badgeClass}`}>
          {typeBadge.label}
        </span>
      </div>
      <div><p className="text-xs text-slate-500">Ngày đặt</p><p className="mt-1 font-medium">{order.ngay_dat}</p></div>
      <div><p className="text-xs text-slate-500">Hạn giao</p><p className="mt-1 font-medium">{order.han_giao ?? "—"}</p></div>
      <div>
        <p className="text-xs text-slate-500">Trạng thái đơn</p>
        <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.badgeClass}`}>
          {statusBadge.label}
        </span>
      </div>
      <div><p className="text-xs text-slate-500">{order.loai_don_hang === "ban_nhanh" ? "Số điện thoại giao hàng" : "Số điện thoại"}</p><p className="mt-1 font-medium">{order.giao_hang ? order.so_dien_thoai_giao_hang || "—" : order.loai_don_hang === "ban_nhanh" ? "—" : customer?.so_dien_thoai ?? "—"}</p></div>
      <div className="md:col-span-2 lg:col-span-3"><p className="text-xs text-slate-500">Địa chỉ giao hàng</p><p className="mt-1 font-medium">{order.giao_hang ? order.dia_chi_giao_hang || "—" : order.loai_don_hang === "ban_nhanh" ? "Không giao hàng" : order.dia_chi_giao_hang || customer?.dia_chi || "—"}</p></div>
    </section>
    <section className="rounded-xl border bg-white overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="app-data-table w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Sản phẩm / biến thể</th>
              <th className="px-4 py-3">Số lượng</th>
              <th className="px-4 py-3">Đơn giá</th>
              <th className="px-4 py-3">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {details.map((item) => {
              const product = productMap.get(item.san_pham_id);
              const variant = variantMap.get(item.bien_the_san_pham_id);
              const attributes = Object.entries(variant?.thuoc_tinh ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{product?.ten_san_pham ?? "Sản phẩm đã xóa"}</div>
                    <div className="text-xs text-slate-500">{product?.ma_san_pham}{attributes ? ` · ${attributes}` : ""}{variant?.ma_sku ? ` · SKU ${variant.ma_sku}` : ""}</div>
                  </td>
                  <td className="px-4 py-3">{Number(item.so_luong)}</td>
                  <td className="px-4 py-3">
                    {item.gia_da_chinh_sua_thu_cong ? (
                      <>
                        <span className="mr-2 text-xs text-slate-500 line-through">{formatCurrency(Number(item.gia_goc))}</span>
                        <span className="font-medium">{formatCurrency(Number(item.don_gia))}</span>
                      </>
                    ) : (
                      formatCurrency(Number(item.don_gia))
                    )}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(Number(item.thanh_tien))}</td>
                </tr>
              );
            })}
            {details.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">Đơn hàng chưa có sản phẩm.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile List View */}
      <div className="md:hidden divide-y divide-slate-100 p-4">
        {details.map((item) => {
          const product = productMap.get(item.san_pham_id);
          const variant = variantMap.get(item.bien_the_san_pham_id);
          const attributes = Object.entries(variant?.thuoc_tinh ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
          return (
            <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
              <div className="font-medium text-sm text-slate-900">{product?.ten_san_pham ?? "Sản phẩm đã xóa"}</div>
              <div className="text-xs text-slate-500">
                {product?.ma_san_pham}{attributes ? ` · ${attributes}` : ""}{variant?.ma_sku ? ` · SKU ${variant.ma_sku}` : ""}
              </div>
              <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
                <span>
                  {Number(item.so_luong)} × {formatCurrency(Number(item.don_gia))}
                  {item.gia_da_chinh_sua_thu_cong && (
                    <span className="ml-1 text-xs text-slate-400 line-through">
                      ({formatCurrency(Number(item.gia_goc))})
                    </span>
                  )}
                </span>
                <span className="font-semibold text-sm text-slate-900">
                  {formatCurrency(Number(item.thanh_tien))}
                </span>
              </div>
            </div>
          );
        })}
        {details.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-500">
            Đơn hàng chưa có sản phẩm.
          </div>
        )}
      </div>
    </section>

    <section className="ml-auto grid max-w-sm gap-1 rounded-xl border bg-white p-4 text-right text-sm"><p>Tạm tính: {formatCurrency(Number(order.tam_tinh))}</p><p>Giảm giá: −{formatCurrency(Number(order.giam_gia))}</p><p>Phí vận chuyển: {formatCurrency(Number(order.phi_van_chuyen))}</p><p className="pt-2 text-lg font-semibold">Tổng tiền: {formatCurrency(Number(order.tong_tien))}</p></section>
    <section className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-3"><div><p className="text-xs text-slate-500">Đã thanh toán</p><p className="mt-1 font-medium">{formatCurrency(paidAmount)}</p></div><div><p className="text-xs text-slate-500">Còn phải thu</p><p className="mt-1 font-medium">{formatCurrency(remainingAmount)}</p></div><div><p className="text-xs text-slate-500">Trạng thái thanh toán</p><p className="mt-1 font-medium">{paymentStatus}</p></div></section>

    {paymentHistory.length > 0 && (
      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 font-semibold text-sm">Lịch sử thanh toán</div>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="app-data-table w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">Ngày thu</th>
                <th className="px-4 py-2">Phương thức</th>
                <th className="px-4 py-2 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paymentHistory.map((row) => {
                const receipt = receiptMap.get(row.phieu_thu_id);
                return (
                  <tr key={row.phieu_thu_id}>
                    <td className="px-4 py-3">{receipt?.ngay_thu ? new Date(receipt.ngay_thu).toLocaleString("vi-VN") : "—"}</td>
                    <td className="px-4 py-3">{paymentMethodLabels[receipt?.phuong_thuc_thanh_toan ?? ""] ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(Number(row.so_tien))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-slate-100 p-4">
          {paymentHistory.map((row) => {
            const receipt = receiptMap.get(row.phieu_thu_id);
            return (
              <div key={row.phieu_thu_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900">{paymentMethodLabels[receipt?.phuong_thuc_thanh_toan ?? ""] ?? "Thanh toán"}</div>
                  <div className="text-slate-500 mt-0.5">{receipt?.ngay_thu ? new Date(receipt.ngay_thu).toLocaleString("vi-VN") : "—"}</div>
                </div>
                <div className="text-right font-semibold text-emerald-600 text-sm">
                  +{formatCurrency(Number(row.so_tien))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    )}

    {remainingAmount > 0 && order.trang_thai !== "da_huy" && <OrderPaymentPanel key={`${id}-${remainingAmount}`} orderId={id} orderCode={order.ma_don_hang} customerName={customer?.ten_khach_hang ?? "Khách hàng"} remaining={remainingAmount} orderType={order.loai_don_hang} />}
    {order.ghi_chu && <section className="rounded-xl border bg-white p-4"><h3 className="text-sm font-semibold">Ghi chú</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{order.ghi_chu}</p></section>}
  </div>;
}




