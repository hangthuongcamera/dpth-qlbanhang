import { OrderCreateForm } from "@/components/don-hang/order-create-form";
import { getDuLieuTaoDonHang } from "@/lib/supabase/don-hang-server";

export default async function DatHangPage() {
  const { customers, products, groups, prices } = await getDuLieuTaoDonHang();
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Tạo đơn đặt hàng</h1>
        <p className="text-sm text-slate-500">Đặt may, đặt số lượng lớn đồng phục theo yêu cầu</p>
      </div>
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
