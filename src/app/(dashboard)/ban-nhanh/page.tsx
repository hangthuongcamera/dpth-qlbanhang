import { FastSalePos } from "@/components/don-hang/fast-sale-pos";
import { getDuLieuTaoDonHang } from "@/lib/supabase/don-hang-server";

export default async function BanNhanhPage() {
  const { customers, products, groups, prices } = await getDuLieuTaoDonHang();
  return (
    <div className="px-4 pt-4 md:px-6 md:pt-0 lg:px-0">
      <FastSalePos
        customers={customers}
        products={products}
        groups={groups}
        prices={prices}
      />
    </div>
  );
}
