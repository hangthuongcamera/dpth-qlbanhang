import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/san-pham/product-form";
import { buttonVariants } from "@/components/ui/button";
import { getLoaiSanPham, getSanPhamById } from "@/lib/supabase/san-pham-server";

type PageProps = { params: Promise<{ id: string }> };

export default async function ChinhSuaSanPhamPage({ params }: PageProps) {
  const { id } = await params;
  let product;
  try {
    product = await getSanPhamById(id);
  } catch {
    notFound();
  }
  const categories = await getLoaiSanPham(true);
  return (
    <div className="app-page">
      <div className="mx-auto mb-5 flex w-full max-w-5xl items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-900">Chỉnh sửa sản phẩm</h1><p className="mt-1 text-sm text-slate-500">{product.ten_san_pham} · {product.ma_san_pham}</p></div>
        <Link className={buttonVariants({ variant: "outline" })} href="/danh-sach-san-pham">Quay lại</Link>
      </div>
      <ProductForm categories={categories} product={product} />
    </div>
  );
}

