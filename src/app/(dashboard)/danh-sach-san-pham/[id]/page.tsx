import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/san-pham/delete-product-button";
import { getSanPhamById } from "@/lib/supabase/san-pham-server";
import { getCurrentUserProfile } from "@/lib/supabase/user-profile";
import { formatCurrency } from "@/types/don-hang";

type PageProps = { params: Promise<{ id: string }> };

export default async function ChiTietSanPhamPage({ params }: PageProps) {
  const { id } = await params;
  const userProfile = await getCurrentUserProfile();
  const isStaff = userProfile?.vai_tro === "staff";
  let product;
  try {
    product = await getSanPhamById(id);
  } catch {
    notFound();
  }

  const variants = product.bien_the_san_pham ?? [];
  const hasActiveVariants = variants.some((variant) => variant.trang_thai && Object.keys(variant.thuoc_tinh ?? {}).length > 0);
  return <div className="app-page">
    <div className="mx-auto w-full max-w-5xl space-y-4 md:space-y-5">
      <header className="app-detail-header">
        <div><p className="text-sm text-slate-500">Chi tiết sản phẩm · {product.ma_san_pham}</p><h1 className="mt-1 text-xl font-semibold text-slate-900">{product.ten_san_pham}</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/danh-sach-san-pham" className={buttonVariants({ variant: "outline" })}>Quay lại</Link>
          {!isStaff && <DeleteProductButton productId={product.id} productName={product.ten_san_pham} productCode={product.ma_san_pham} variantCount={variants.length} />}
          <Link href={`/danh-sach-san-pham/${product.id}/chinh-sua`} className={buttonVariants()}>Sửa sản phẩm</Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Thông tin chung</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-sm text-slate-500">Mã sản phẩm</dt><dd className="mt-1 font-medium">{product.ma_san_pham}</dd></div>
          <div><dt className="text-sm text-slate-500">Tên sản phẩm</dt><dd className="mt-1 font-medium">{product.ten_san_pham}</dd></div>
          <div><dt className="text-sm text-slate-500">Loại sản phẩm</dt><dd className="mt-1">{product.loai_san_pham?.ten_loai ?? "—"}</dd></div>
          <div><dt className="text-sm text-slate-500">Đơn vị tính</dt><dd className="mt-1">{product.don_vi_tinh}</dd></div>
          <div><dt className="text-sm text-slate-500">Trạng thái</dt><dd className="mt-1">{product.trang_thai ? "Đang kinh doanh" : "Ngừng kinh doanh"}</dd></div>
          {!hasActiveVariants && <>
            {!isStaff && <div><dt className="text-sm text-slate-500">Giá nhập</dt><dd className="mt-1">{formatCurrency(Number(product.gia_nhap))}</dd></div>}
            <div><dt className="text-sm text-slate-500">Giá bán</dt><dd className="mt-1">{formatCurrency(Number(product.gia_ban))}</dd></div>
          </>}
          <div className="md:col-span-2 lg:col-span-3"><dt className="text-sm text-slate-500">Mô tả</dt><dd className="mt-1 whitespace-pre-wrap">{product.mo_ta || "—"}</dd></div>
        </dl>
      </section>

      {hasActiveVariants && <section className="app-data-table-shell overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4"><h2 className="font-semibold text-slate-900">Biến thể ({variants.length})</h2><p className="mt-1 text-sm text-slate-500">Chọn biến thể để xem thông tin chi tiết.</p></div>
        <div className="overflow-x-auto"><table className="app-data-table w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Thuộc tính</th>{!isStaff && <th className="px-4 py-3">Giá nhập</th>}<th className="px-4 py-3">Giá bán</th><th className="px-4 py-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{variants.map((variant) => <tr key={variant.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium"><Link className="text-primary hover:underline" href={`/danh-sach-san-pham/${product.id}/bien-the/${variant.id}`}>{variant.ma_sku}</Link></td><td className="px-4 py-3">{Object.entries(variant.thuoc_tinh ?? {}).map(([name, value]) => `${name}: ${value}`).join(" · ") || "—"}</td>{!isStaff && <td className="px-4 py-3">{formatCurrency(Number(variant.gia_nhap))}</td>}<td className="px-4 py-3">{formatCurrency(Number(variant.gia_ban))}</td><td className="px-4 py-3">{variant.trang_thai ? "Đang kinh doanh" : "Ngừng kinh doanh"}</td></tr>)}</tbody></table></div>
      </section>}
    </div>
  </div>;
}








