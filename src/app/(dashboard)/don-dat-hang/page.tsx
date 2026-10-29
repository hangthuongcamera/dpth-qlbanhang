import { OrderCreateForm } from "@/components/don-hang/order-create-form";
import { getDuLieuTaoDonHang } from "@/lib/supabase/don-hang-server";

export default async function DatHangPage() {
  const { customers, products, groups, prices } = await getDuLieuTaoDonHang();
  return (
    <div className="app-page">
      <OrderCreateForm
        customers={customers}
        products={products}
        groups={groups}
        prices={prices}
        orderType="dat_hang"
      />
    </div>
  );
}


