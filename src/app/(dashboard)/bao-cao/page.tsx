import { createClient } from "@/lib/supabase/server";

type SearchParams = { fromDate?: string; toDate?: string };
type OrderRow = { id: string; ngay_dat: string; tong_tien: number | string; trang_thai: string };
type DetailRow = { san_pham_id: string; bien_the_san_pham_id: string | null; so_luong: number | string };
type ProductRow = { id: string; ma_san_pham: string; ten_san_pham: string };
type VariantRow = { id: string; ma_sku: string | null; thuoc_tinh: Record<string, unknown> | null };

function dateBangkok(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (key: string) => parts.find((item) => item.type === key)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
function validDate(value?: string) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z"));
}
function shiftDate(day: string, amount: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
function displayDate(day: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(day + "T12:00:00Z"));
}
function monday(day: string) {
  const date = new Date(day + "T12:00:00Z");
  const weekday = date.getUTCDay();
  return shiftDate(day, -((weekday + 6) % 7));
}
function attributes(value: Record<string, unknown> | null) {
  return Object.entries(value ?? {}).map(([key, item]) => key + ": " + String(item)).join(" · ");
}

export default async function BaoCaoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = dateBangkok(new Date());
  const defaultFrom = today.slice(0, 8) + "01";
  let fromDate = validDate(params.fromDate) ? params.fromDate! : defaultFrom;
  let toDate = validDate(params.toDate) ? params.toDate! : today;
  if (fromDate > toDate) {
    fromDate = defaultFrom;
    toDate = today;
  }

  const span = Math.floor((Date.parse(toDate + "T12:00:00Z") - Date.parse(fromDate + "T12:00:00Z")) / 86400000) + 1;
  const grouping = span <= 31 ? "day" : span <= 180 ? "week" : "month";
  const supabase = await createClient();

  const orders: OrderRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from("don_hang").select("id, ngay_dat, tong_tien, trang_thai")
      .gte("ngay_dat", fromDate).lt("ngay_dat", shiftDate(toDate, 1)).neq("trang_thai", "da_huy")
      .order("ngay_dat").order("id").range(offset, offset + 999);
    if (result.error) throw new Error("Không thể tải dữ liệu doanh thu.");
    orders.push(...((result.data ?? []) as OrderRow[]));
    if ((result.data?.length ?? 0) < 1000) break;
  }

  const totals = new Map<string, number>();
  for (const order of orders) {
    const key = grouping === "day" ? order.ngay_dat.slice(0, 10) : grouping === "week" ? monday(order.ngay_dat.slice(0, 10)) : order.ngay_dat.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(order.tong_tien));
  }
  const periods = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.tong_tien), 0);

  const details: DetailRow[] = [];
  const orderIds = orders.map((order) => order.id);
  for (let i = 0; i < orderIds.length; i += 100) {
    for (let offset = 0; ; offset += 1000) {
      const result = await supabase.from("don_hang_chi_tiet").select("san_pham_id, bien_the_san_pham_id, so_luong")
        .in("don_hang_id", orderIds.slice(i, i + 100)).range(offset, offset + 999);
      if (result.error) throw new Error("Không thể tải chi tiết mặt hàng đã bán.");
      details.push(...((result.data ?? []) as DetailRow[]));
      if ((result.data?.length ?? 0) < 1000) break;
    }
  }

  const productIds = [...new Set(details.map((row) => row.san_pham_id))];
  const variantIds = [...new Set(details.flatMap((row) => row.bien_the_san_pham_id ? [row.bien_the_san_pham_id] : []))];
  const [productsResult, variantsResult] = await Promise.all([
    productIds.length ? supabase.from("san_pham").select("id, ma_san_pham, ten_san_pham").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    variantIds.length ? supabase.from("bien_the_san_pham").select("id, ma_sku, thuoc_tinh").in("id", variantIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error || variantsResult.error) throw new Error("Không thể tải tên sản phẩm hoặc biến thể.");
  const products = new Map<string, ProductRow>((productsResult.data ?? []).map((row) => [row.id, row as ProductRow]));
  const variants = new Map<string, VariantRow>((variantsResult.data ?? []).map((row) => [row.id, row as VariantRow]));

  const itemTotals = new Map<string, { product: ProductRow | undefined; variant: VariantRow | undefined; quantity: number }>();
  for (const row of details) {
    const key = row.bien_the_san_pham_id ?? row.san_pham_id;
    const current = itemTotals.get(key) ?? { product: products.get(row.san_pham_id), variant: row.bien_the_san_pham_id ? variants.get(row.bien_the_san_pham_id) : undefined, quantity: 0 };
    current.quantity += Number(row.so_luong);
    itemTotals.set(key, current);
  }
  const bestSellers = [...itemTotals.entries()].map(([key, item]) => ({ key, ...item }))
    .sort((a, b) => b.quantity - a.quantity || (a.product?.ten_san_pham ?? "").localeCompare(b.product?.ten_san_pham ?? "", "vi"))
    .slice(0, 10);
  const maxRevenue = Math.max(...periods.map(([, value]) => value), 1);
  const periodLabel = (key: string) => grouping === "month" ? key.slice(5) + "/" + key.slice(0, 4) : displayDate(key);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="grid gap-1 text-sm text-slate-600">Từ ngày<input type="date" name="fromDate" value={fromDate} max={toDate} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
        <label className="grid gap-1 text-sm text-slate-600">Đến ngày<input type="date" name="toDate" value={toDate} min={fromDate} max={today} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
        <button className="h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90">Xem báo cáo</button>
      </form>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Doanh thu theo thời gian</h2><p className="mt-1 text-sm text-slate-500">{displayDate(fromDate)} – {displayDate(toDate)}</p></div><div className="text-right"><div className="text-xs text-slate-500">Tổng doanh thu</div><div className="text-lg font-semibold text-slate-900">{money(totalRevenue)}</div></div></div>
          {periods.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Không có đơn hàng trong khoảng thời gian này.</p> : <div className="mt-5 space-y-3">{periods.map(([key, value]) => <div key={key} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm"><span className="text-slate-500">{periodLabel(key)}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: Math.max(2, value / maxRevenue * 100) + "%" }} /></div><span className="min-w-24 text-right font-medium text-slate-800">{money(value)}</span></div>)}</div>}
          <p className="mt-4 text-xs text-slate-400">Gộp theo {grouping === "day" ? "ngày" : grouping === "week" ? "tuần (bắt đầu từ thứ Hai)" : "tháng"} · {orders.length} đơn hợp lệ.</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">10 mặt hàng bán chạy</h2><p className="mt-1 text-sm text-slate-500">Xếp hạng theo tổng số lượng bán trong kỳ.</p>
          {bestSellers.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">Chưa có mặt hàng được bán trong khoảng thời gian này.</p> : <div className="mt-4 overflow-x-auto"><table className="app-data-table app-data-table--compact w-full min-w-[420px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Mặt hàng</th><th className="py-2 text-right">Đã bán</th></tr></thead><tbody className="divide-y divide-slate-100">{bestSellers.map((item, index) => <tr key={item.key}><td className="py-3 pr-3 text-slate-400">{index + 1}</td><td className="py-3 pr-3"><div className="font-medium text-slate-800">{item.product?.ten_san_pham ?? "Sản phẩm đã xóa"}</div><div className="text-xs text-slate-500">{item.variant ? [item.variant.ma_sku, attributes(item.variant.thuoc_tinh)].filter(Boolean).join(" · ") : item.product?.ma_san_pham}</div></td><td className="py-3 text-right font-semibold text-slate-900">{item.quantity.toLocaleString("vi-VN")}</td></tr>)}</tbody></table></div>}
        </article>
      </section>
    </main>
  );
}



