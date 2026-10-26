import Link from "next/link";

import { ProductForm } from "@/components/san-pham/product-form";
import { buttonVariants } from "@/components/ui/button";
import { getLoaiSanPham, getMaSanPhamTiepTheo } from "@/lib/supabase/san-pham-server";

export default async function ThemSanPhamPage() {
  const [categories, productCode] = await Promise.all([getLoaiSanPham(), getMaSanPhamTiepTheo()]);
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto mb-5 flex w-full max-w-5xl items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-900">Thêm sản phẩm</h1><p className="mt-1 text-sm text-slate-500">Nhập thông tin sản phẩm và các biến thể.</p></div>
        <Link className={buttonVariants({ variant: "outline" })} href="/danh-sach-san-pham">Quay lại</Link>
      </div>
      <ProductForm categories={categories} initialProductCode={productCode} />
    </div>
  );
}
