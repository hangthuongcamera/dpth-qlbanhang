import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getSanPhamById } from "@/lib/supabase/san-pham-server";
import { getCurrentUserProfile } from "@/lib/supabase/user-profile";

type PageProps = { params: Promise<{ id: string; variantId: string }> };

const formatCurrency = (value: number) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} ₫`;

export default async function ChiTietBienThePage({ params }: PageProps) {
  const { id, variantId } = await params;
  const userProfile = await getCurrentUserProfile();
  const isStaff = userProfile?.vai_tro === "staff";
  let product;
  try {
    product = await getSanPhamById(id);
  } catch {
    notFound();
  }
  const variant = product.bien_the_san_pham?.find((item) => item.id === variantId);
  if (!variant) notFound();

  return <div className="p-4 md:p-6">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-slate-500"><Link href={`/danh-sach-san-pham/${product.id}`} className="hover:text-primary hover:underline">{product.ten_san_pham}</Link> · {product.ma_san_pham}</p><h1 className="mt-1 text-xl font-semibold text-slate-900">Chi tiết biến thể</h1></div>
        <div className="flex gap-2"><Link href={`/danh-sach-san-pham/${product.id}`} className={buttonVariants({ variant: "outline" })}>Quay lại</Link><Link href={`/danh-sach-san-pham/${product.id}/chinh-sua#bien-the-${variant.id}`} className={buttonVariants()}>Sửa biến thể</Link></div>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900">Thông tin biến thể</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-500">Mã SKU</dt><dd className="mt-1 font-medium">{variant.ma_sku || "—"}</dd></div>
          <div><dt className="text-sm text-slate-500">Sản phẩm cha</dt><dd className="mt-1"><Link href={`/danh-sach-san-pham/${product.id}`} className="text-primary hover:underline">{product.ten_san_pham} · {product.ma_san_pham}</Link></dd></div>
          {!isStaff && <div><dt className="text-sm text-slate-500">Giá nhập</dt><dd className="mt-1">{formatCurrency(Number(variant.gia_nhap))}</dd></div>}
          <div><dt className="text-sm text-slate-500">Giá bán</dt><dd className="mt-1">{formatCurrency(Number(variant.gia_ban))}</dd></div>
          <div><dt className="text-sm text-slate-500">Trạng thái biến thể</dt><dd className="mt-1">{variant.trang_thai ? "Đang kinh doanh" : "Ngừng kinh doanh"}</dd></div>
          <div><dt className="text-sm text-slate-500">Trạng thái sản phẩm</dt><dd className="mt-1">{product.trang_thai ? "Đang kinh doanh" : "Ngừng kinh doanh"}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-slate-900">Thuộc tính</h2><dl className="mt-3 grid gap-4 sm:grid-cols-2">{Object.entries(variant.thuoc_tinh ?? {}).map(([name, value]) => <div key={name}><dt className="text-sm text-slate-500">{name}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl></section>
    </div>
  </div>;
}
