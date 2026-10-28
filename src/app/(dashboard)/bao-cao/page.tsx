import Link from "next/link";
import { DollarSign, Package, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/supabase/user-profile";
import { redirect } from "next/navigation";

type SearchParams = { fromDate?: string; toDate?: string; tab?: string };
type OrderRow = { id: string; ngay_dat: string; tam_tinh: number | string; giam_gia: number | string; phi_van_chuyen: number | string; tong_tien: number | string; trang_thai: string };
type DetailRow = { don_hang_id: string; san_pham_id: string; bien_the_san_pham_id: string | null; so_luong: number | string; don_gia: number | string; thanh_tien?: number | string; gia_von?: number | string };
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
  // Chỉ owner mới được xem báo cáo lợi nhuận
  if (!(await isOwner())) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const today = dateBangkok(new Date());
  const defaultFrom = today.slice(0, 8) + "01";
  let fromDate = validDate(params.fromDate) ? params.fromDate! : defaultFrom;
  let toDate = validDate(params.toDate) ? params.toDate! : today;
  if (fromDate > toDate) {
    fromDate = defaultFrom;
    toDate = today;
  }

  const currentTab = params.tab === "loi-nhuan" ? "loi-nhuan" : "doanh-thu";
  const span = Math.floor((Date.parse(toDate + "T12:00:00Z") - Date.parse(fromDate + "T12:00:00Z")) / 86400000) + 1;
  const grouping = span <= 31 ? "day" : span <= 180 ? "week" : "month";
  const supabase = await createClient();

  // 1. Tải danh sách đơn hàng trong khoảng thời gian lọc
  const orders: OrderRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from("don_hang")
      .select("id, ngay_dat, tam_tinh, giam_gia, phi_van_chuyen, tong_tien, trang_thai")
      .gte("ngay_dat", fromDate).lt("ngay_dat", shiftDate(toDate, 1)).neq("trang_thai", "da_huy")
      .order("ngay_dat").order("id").range(offset, offset + 999);
    if (result.error) throw new Error("Không thể tải dữ liệu báo cáo.");
    orders.push(...((result.data ?? []) as OrderRow[]));
    if ((result.data?.length ?? 0) < 1000) break;
  }

  // 2. Tải chi tiết các mặt hàng của đơn hàng
  const details: DetailRow[] = [];
  const orderIds = orders.map((order) => order.id);
  for (let i = 0; i < orderIds.length; i += 100) {
    for (let offset = 0; ; offset += 1000) {
      const result = await supabase.from("don_hang_chi_tiet")
        .select("don_hang_id, san_pham_id, bien_the_san_pham_id, so_luong, don_gia, thanh_tien, gia_von")
        .in("don_hang_id", orderIds.slice(i, i + 100)).range(offset, offset + 999);
      if (result.error) throw new Error("Không thể tải chi tiết mặt hàng.");
      details.push(...((result.data ?? []) as DetailRow[]));
      if ((result.data?.length ?? 0) < 1000) break;
    }
  }

  // 3. Tải thông tin tên sản phẩm & biến thể
  const productIds = [...new Set(details.map((row) => row.san_pham_id))];
  const variantIds = [...new Set(details.flatMap((row) => row.bien_the_san_pham_id ? [row.bien_the_san_pham_id] : []))];
  const [productsResult, variantsResult] = await Promise.all([
    productIds.length ? supabase.from("san_pham").select("id, ma_san_pham, ten_san_pham").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    variantIds.length ? supabase.from("bien_the_san_pham").select("id, ma_sku, thuoc_tinh").in("id", variantIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error || variantsResult.error) throw new Error("Không thể tải thông tin sản phẩm hoặc biến thể.");
  const products = new Map<string, ProductRow>((productsResult.data ?? []).map((row) => [row.id, row as ProductRow]));
  const variants = new Map<string, VariantRow>((variantsResult.data ?? []).map((row) => [row.id, row as VariantRow]));

  // 4. Tính toán số liệu theo đơn và dòng sản phẩm
  const orderCostMap = new Map<string, number>();
  for (const row of details) {
    const qty = Number(row.so_luong) || 0;
    const cost = Number(row.gia_von) || 0;
    orderCostMap.set(row.don_hang_id, (orderCostMap.get(row.don_hang_id) ?? 0) + (qty * cost));
  }

  // Tổng hợp theo chu kỳ thời gian (ngày / tuần / tháng)
  const periodRevenue = new Map<string, number>();
  const periodCost = new Map<string, number>();
  const periodProfit = new Map<string, number>();

  let totalRevenue = 0;
  let totalCost = 0;

  for (const order of orders) {
    const key = grouping === "day" ? order.ngay_dat.slice(0, 10) : grouping === "week" ? monday(order.ngay_dat.slice(0, 10)) : order.ngay_dat.slice(0, 7);
    // Doanh thu thuần = Tạm tính - Giảm giá (hoặc Tổng tiền - Phí vận chuyển)
    const netRevenue = Math.max(0, Number(order.tam_tinh || order.tong_tien) - Number(order.giam_gia || 0));
    const cost = orderCostMap.get(order.id) ?? 0;
    const profit = netRevenue - cost;

    totalRevenue += netRevenue;
    totalCost += cost;

    periodRevenue.set(key, (periodRevenue.get(key) ?? 0) + netRevenue);
    periodCost.set(key, (periodCost.get(key) ?? 0) + cost);
    periodProfit.set(key, (periodProfit.get(key) ?? 0) + profit);
  }

  const totalProfit = totalRevenue - totalCost;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Danh sách các mốc thời gian đã sắp xếp
  const periodKeys = [...new Set([...periodRevenue.keys(), ...periodCost.keys()])].sort();
  const maxRevenue = Math.max(...periodKeys.map((k) => periodRevenue.get(k) ?? 0), 1);

  // 5. Thống kê theo mặt hàng
  type ItemStat = {
    key: string;
    product?: ProductRow;
    variant?: VariantRow;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  };

  const itemStatsMap = new Map<string, ItemStat>();
  for (const row of details) {
    const key = row.bien_the_san_pham_id ?? row.san_pham_id;
    const qty = Number(row.so_luong) || 0;
    const price = Number(row.don_gia) || 0;
    const rev = Number(row.thanh_tien) || (qty * price);
    const costPerUnit = Number(row.gia_von) || 0;
    const lineCost = qty * costPerUnit;
    const lineProfit = rev - lineCost;

    const current = itemStatsMap.get(key) ?? {
      key,
      product: products.get(row.san_pham_id),
      variant: row.bien_the_san_pham_id ? variants.get(row.bien_the_san_pham_id) : undefined,
      quantity: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: 0,
    };

    current.quantity += qty;
    current.revenue += rev;
    current.cost += lineCost;
    current.profit += lineProfit;
    current.margin = current.revenue > 0 ? (current.profit / current.revenue) * 100 : 0;

    itemStatsMap.set(key, current);
  }

  const allItems = [...itemStatsMap.values()];

  // Top 10 bán chạy nhất (theo số lượng) cho Tab Doanh thu
  const bestSellers = [...allItems]
    .sort((a, b) => b.quantity - a.quantity || (a.product?.ten_san_pham ?? "").localeCompare(b.product?.ten_san_pham ?? "", "vi"))
    .slice(0, 10);

  // Top 10 sinh lời cao nhất (theo lợi nhuận gộp) cho Tab Lợi nhuận
  const mostProfitable = [...allItems]
    .sort((a, b) => b.profit - a.profit || (a.product?.ten_san_pham ?? "").localeCompare(b.product?.ten_san_pham ?? "", "vi"))
    .slice(0, 10);

  const periodLabel = (key: string) => grouping === "month" ? key.slice(5) + "/" + key.slice(0, 4) : displayDate(key);

  return (
    <main className="space-y-6 p-4 md:p-6">
      {/* Thanh chuyển đổi Tab Báo cáo */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Loại báo cáo">
        <Link
          href={`/bao-cao?fromDate=${fromDate}&toDate=${toDate}&tab=doanh-thu`}
          role="tab"
          aria-selected={currentTab === "doanh-thu"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            currentTab === "doanh-thu"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          Báo cáo doanh thu
        </Link>
        <Link
          href={`/bao-cao?fromDate=${fromDate}&toDate=${toDate}&tab=loi-nhuan`}
          role="tab"
          aria-selected={currentTab === "loi-nhuan"}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            currentTab === "loi-nhuan"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          Báo cáo lợi nhuận
        </Link>
      </div>

      {/* Form bộ lọc thời gian */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="tab" value={currentTab} />
        <label className="grid gap-1 text-sm text-slate-600 font-medium">
          Từ ngày
          <input type="date" name="fromDate" defaultValue={fromDate} max={toDate} className="h-10 rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
        </label>
        <label className="grid gap-1 text-sm text-slate-600 font-medium">
          Đến ngày
          <input type="date" name="toDate" defaultValue={toDate} min={fromDate} max={today} className="h-10 rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
        </label>
        <button type="submit" className="h-10 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90 transition">
          Xem báo cáo
        </button>
      </form>

      {/* TAB 1: BÁO CÁO DOANH THU */}
      {currentTab === "doanh-thu" && (
        <section className="grid gap-6 xl:grid-cols-2">
          {/* Doanh thu theo thời gian */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-900">Doanh thu theo thời gian</h2>
                <p className="mt-1 text-sm text-slate-500">{displayDate(fromDate)} – {displayDate(toDate)}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Tổng doanh thu thuần</div>
                <div className="text-lg font-semibold text-slate-900">{money(totalRevenue)}</div>
              </div>
            </div>

            {periodKeys.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Không có đơn hàng trong khoảng thời gian này.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {periodKeys.map((key) => {
                  const val = periodRevenue.get(key) ?? 0;
                  return (
                    <div key={key} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                      <span className="text-slate-500">{periodLabel(key)}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (val / maxRevenue) * 100)}%` }} />
                      </div>
                      <span className="min-w-24 text-right font-medium text-slate-800">{money(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 text-xs text-slate-400">Gộp theo {grouping === "day" ? "ngày" : grouping === "week" ? "tuần (từ thứ Hai)" : "tháng"} · {orders.length} đơn hợp lệ.</p>
          </article>

          {/* 10 mặt hàng bán chạy */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">10 mặt hàng bán chạy nhất</h2>
            <p className="mt-1 text-sm text-slate-500">Xếp hạng theo tổng số lượng bán trong kỳ.</p>
            {bestSellers.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Chưa có mặt hàng được bán trong khoảng thời gian này.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="app-data-table app-data-table--compact w-full min-w-[420px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500 font-semibold bg-slate-50">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Mặt hàng</th>
                      <th className="py-2.5 px-3 text-right">Đã bán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bestSellers.map((item, index) => (
                      <tr key={item.key} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-slate-400">{index + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800">{item.product?.ten_san_pham ?? "Sản phẩm đã xóa"}</div>
                          <div className="text-xs text-slate-500">
                            {item.variant ? [item.variant.ma_sku, attributes(item.variant.thuoc_tinh)].filter(Boolean).join(" · ") : item.product?.ma_san_pham}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-900">{item.quantity.toLocaleString("vi-VN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      )}

      {/* TAB 2: BÁO CÁO LỢI NHUẬN */}
      {currentTab === "loi-nhuan" && (
        <section className="space-y-6">
          {/* 3 Thẻ KPI Lợi Nhuận Tổng Quan */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Tổng doanh thu thuần
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{money(totalRevenue)}</p>
              <p className="mt-1 text-xs text-slate-400">Đã trừ giảm giá của {orders.length} đơn</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Package className="h-4 w-4 text-amber-600" />
                Tổng giá vốn (COGS)
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{money(totalCost)}</p>
              <p className="mt-1 text-xs text-slate-400">Snapshot theo giá vốn thời điểm bán</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Lợi nhuận gộp
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Biên LN: {totalMargin.toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{money(totalProfit)}</p>
              <p className="mt-1 text-xs text-slate-400">Doanh thu thuần trừ tổng giá vốn</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Lợi nhuận theo thời gian */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-900">Lợi nhuận theo thời gian</h2>
                  <p className="mt-1 text-sm text-slate-500">{displayDate(fromDate)} – {displayDate(toDate)}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Tổng lợi nhuận</div>
                  <div className="text-lg font-semibold text-emerald-600">{money(totalProfit)}</div>
                </div>
              </div>

              {periodKeys.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">Không có dữ liệu trong khoảng thời gian này.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {periodKeys.map((key) => {
                    const rev = periodRevenue.get(key) ?? 0;
                    const cost = periodCost.get(key) ?? 0;
                    const profit = periodProfit.get(key) ?? 0;
                    const margin = rev > 0 ? (profit / rev) * 100 : 0;
                    return (
                      <div key={key} className="space-y-1.5 rounded-lg border border-slate-100 p-3 hover:bg-slate-50/50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{periodLabel(key)}</span>
                          <span className="font-semibold text-emerald-600">
                            {money(profit)} <span className="text-xs font-normal text-slate-400">({margin.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 flex">
                          <div className="h-full bg-amber-400" title={`Giá vốn: ${money(cost)}`} style={{ width: `${Math.min(100, (cost / (rev || 1)) * 100)}%` }} />
                          <div className="h-full bg-emerald-500" title={`Lợi nhuận: ${money(profit)}`} style={{ width: `${Math.min(100, Math.max(0, (profit / (rev || 1)) * 100))}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Doanh thu: {money(rev)}</span>
                          <span>Vốn: {money(cost)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-4 text-xs text-slate-400">Thanh so sánh: Màu vàng = Giá vốn · Màu xanh = Lợi nhuận gộp.</p>
            </article>

            {/* Top 10 mặt hàng sinh lời cao nhất */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900">10 mặt hàng sinh lời cao nhất</h2>
              <p className="mt-1 text-sm text-slate-500">Xếp hạng theo tổng tiền lãi gộp thu về trong kỳ.</p>
              {mostProfitable.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">Chưa có sản phẩm trong khoảng thời gian này.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="app-data-table app-data-table--compact w-full min-w-[500px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs text-slate-500 font-semibold bg-slate-50">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Mặt hàng</th>
                        <th className="py-2.5 px-3 text-right">Số lượng</th>
                        <th className="py-2.5 px-3 text-right">Doanh thu</th>
                        <th className="py-2.5 px-3 text-right">Lợi nhuận</th>
                        <th className="py-2.5 px-3 text-right">Tỷ suất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mostProfitable.map((item, index) => (
                        <tr key={item.key} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-slate-400">{index + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">{item.product?.ten_san_pham ?? "Sản phẩm đã xóa"}</div>
                            <div className="text-xs text-slate-500">
                              {item.variant ? [item.variant.ma_sku, attributes(item.variant.thuoc_tinh)].filter(Boolean).join(" · ") : item.product?.ma_san_pham}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-700">{item.quantity.toLocaleString("vi-VN")}</td>
                          <td className="py-3 px-3 text-right text-slate-600">{money(item.revenue)}</td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-600">{money(item.profit)}</td>
                          <td className="py-3 px-3 text-right font-medium text-slate-800">{item.margin.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
