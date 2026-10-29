import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderEditForm } from "@/components/don-hang/order-edit-form";
import { buttonVariants } from "@/components/ui/button";
import { getDuLieuTaoDonHang } from "@/lib/supabase/don-hang-server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/user-profile";

export default async function ChinhSuaDonHangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userProfile = await getCurrentUserProfile();
  const supabase = await createClient();
  const [{ data: order, error: orderError }, { data: details, error: detailsError }, productData] = await Promise.all([
    supabase.from("don_hang").select("id, ma_don_hang, khach_hang_id, loai_don_hang, trang_thai, ngay_dat, han_giao, dia_chi_giao_hang, ghi_chu, giam_gia, phi_van_chuyen, created_by").eq("id", id).maybeSingle(),
    supabase.from("don_hang_chi_tiet").select("id, san_pham_id, bien_the_san_pham_id, so_luong, don_gia, gia_goc, gia_da_chinh_sua_thu_cong").eq("don_hang_id", id).order("created_at"),
    getDuLieuTaoDonHang(),
  ]);
  if (orderError) throw new Error("Không thể tải đơn hàng. Hãy chạy migration 20261017150000_order_edit_and_shipping_address.sql trong Supabase trước.");
  if (!order) notFound();
  if (detailsError) throw new Error("Không thể tải chi tiết đơn hàng.");

  // Nhân viên chỉ được sửa đơn hàng do chính mình tạo
  if (userProfile?.vai_tro === "staff" && order.created_by && order.created_by !== userProfile.user_id) {
    redirect(`/danh-sach-don-hang/${id}`);
  }

  if (order.trang_thai !== "xac_nhan" && order.trang_thai !== "dang_thuc_hien") redirect(`/danh-sach-don-hang/${id}`);

  const rows = details ?? [];
  const productIds = [...new Set(rows.map((line) => line.san_pham_id))];
  const variantIds = [...new Set(rows.map((line) => line.bien_the_san_pham_id).filter((variantId): variantId is string => Boolean(variantId)))];
  const [{ data: productRows, error: productError }, { data: variantRows, error: variantError }, { data: customer, error: customerError }] = await Promise.all([
    productIds.length ? supabase.from("san_pham").select("id, ma_san_pham, ten_san_pham, don_vi_tinh").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    variantIds.length ? supabase.from("bien_the_san_pham").select("id, ma_sku, thuoc_tinh").in("id", variantIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("khach_hang").select("ma_khach_hang, ten_khach_hang, dia_chi").eq("id", order.khach_hang_id).maybeSingle(),
  ]);
  if (productError || variantError || customerError) throw new Error("Không thể tải thông tin sản phẩm hoặc khách hàng của đơn.");
  const productMap = new Map((productRows ?? []).map((product) => [product.id, product] as const));
  const variantMap = new Map((variantRows ?? []).map((variant) => [variant.id, variant] as const));
  const initialLines = rows.map((line) => {
    const product = productMap.get(line.san_pham_id);
    const variant = line.bien_the_san_pham_id ? variantMap.get(line.bien_the_san_pham_id) : null;
    const attributes = Object.entries(variant?.thuoc_tinh ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
    const label = [product?.ten_san_pham ?? "Sản phẩm đã xóa", product?.ma_san_pham, attributes, variant?.ma_sku ? `SKU ${variant.ma_sku}` : ""].filter(Boolean).join(" · ");
    return {
      id: line.id,
      san_pham_id: line.san_pham_id,
      bien_the_san_pham_id: line.bien_the_san_pham_id,
      label,
      don_vi_tinh: product?.don_vi_tinh ?? "",
      so_luong: Number(line.so_luong),
      don_gia: Number(line.don_gia),
      gia_goc: Number(line.gia_goc),
      gia_da_chinh_sua_thu_cong: Boolean(line.gia_da_chinh_sua_thu_cong),
    };
  });
  const pageOrder = {
    ...order,
    customerLabel: customer ? `${customer.ma_khach_hang} · ${customer.ten_khach_hang}` : "Khách hàng",
    customerAddress: customer?.dia_chi ?? null,
    giam_gia: Number(order.giam_gia),
    phi_van_chuyen: Number(order.phi_van_chuyen),
  };

  return <div className="app-page">
    <div className="mx-auto mb-5 flex w-full max-w-6xl items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-slate-900">Chỉnh sửa đơn {order.ma_don_hang}</h1><p className="mt-1 text-sm text-slate-500">Khách hàng và loại đơn được giữ nguyên.</p></div>
      <Link href={`/danh-sach-don-hang/${id}`} className={buttonVariants({ variant: "outline" })}>Quay lại</Link>
    </div>
    <div className="mx-auto w-full max-w-6xl"><OrderEditForm order={pageOrder} initialLines={initialLines} {...productData} /></div>
  </div>;
}

