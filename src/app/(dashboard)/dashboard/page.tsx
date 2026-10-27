import { ShoppingCart, CreditCard, Wallet, TrendingUp, Package } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Order = { id: string; ma_don_hang: string; khach_hang_id: string | null; ngay_dat: string; tong_tien: number | string };

function dateBangkok(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (key: string) => parts.find((item) => item.type === key)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
function shiftDate(day: string, amount: number) {
  const date = new Date(day + "T12:00:00+07:00");
  date.setDate(date.getDate() + amount);
  return dateBangkok(date);
}
function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
function shortDate(day: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit" }).format(new Date(day + "T12:00:00+07:00"));
}


export default async function DashboardPage() {
  const supabase = await createClient();
  const today = dateBangkok(new Date());
  const tomorrow = shiftDate(today, 1);
  const firstDay = shiftDate(today, -6);
  const [ordersResult, receiptsResult, debtResult, recentResult] = await Promise.all([
    supabase.from("don_hang").select("id, ma_don_hang, khach_hang_id, ngay_dat, tong_tien").gte("ngay_dat", firstDay).lt("ngay_dat", tomorrow).neq("trang_thai", "da_huy").order("ngay_dat").order("id"),
    supabase.from("phieu_thu").select("tong_tien").eq("trang_thai", "da_xac_nhan").gte("ngay_thu", today).lt("ngay_thu", tomorrow).order("id"),
    supabase.from("v_cong_no_khach_hang").select("khach_hang_id, cong_no_hien_tai").gt("cong_no_hien_tai", 0).order("khach_hang_id"),
    supabase.from("don_hang").select("id, ma_don_hang, khach_hang_id, ngay_dat, tong_tien").order("created_at", { ascending: false }).limit(10),
  ]);
  if (ordersResult.error || receiptsResult.error || debtResult.error || recentResult.error) {
    console.error("Lỗi tải Dashboard", ordersResult.error, receiptsResult.error, debtResult.error, recentResult.error);
    throw new Error("Không thể tải dữ liệu tổng quan.");
  }

  const orders = [...(ordersResult.data ?? [])] as Order[];
  for (let offset = 1000; (ordersResult.data?.length ?? 0) === 1000; offset += 1000) {
    const page = await supabase.from("don_hang").select("id, ma_don_hang, khach_hang_id, ngay_dat, tong_tien").gte("ngay_dat", firstDay).lt("ngay_dat", tomorrow).neq("trang_thai", "da_huy").order("ngay_dat").order("id").range(offset, offset + 999);
    if (page.error) throw new Error("Không thể tải đủ đơn hàng để tổng hợp Dashboard.");
    orders.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  const receiptRows = [...(receiptsResult.data ?? [])];
  for (let offset = 1000; (receiptsResult.data?.length ?? 0) === 1000; offset += 1000) {
    const page = await supabase.from("phieu_thu").select("tong_tien").eq("trang_thai", "da_xac_nhan").gte("ngay_thu", today).lt("ngay_thu", tomorrow).order("id").range(offset, offset + 999);
    if (page.error) throw new Error("Không thể tải đủ phiếu thu trong ngày.");
    receiptRows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  const debtRows = [...(debtResult.data ?? [])];
  for (let offset = 1000; (debtResult.data?.length ?? 0) === 1000; offset += 1000) {
    const page = await supabase.from("v_cong_no_khach_hang").select("khach_hang_id, cong_no_hien_tai").gt("cong_no_hien_tai", 0).order("khach_hang_id").range(offset, offset + 999);
    if (page.error) throw new Error("Không thể tải đủ số dư công nợ.");
    debtRows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  const recentOrders = (recentResult.data ?? []) as Order[];
  const todayOrders = orders.filter((order) => order.ngay_dat === today);
  const salesToday = todayOrders.reduce((sum, order) => sum + Number(order.tong_tien), 0);
  const collected = receiptRows.reduce((sum, receipt) => sum + Number(receipt.tong_tien), 0);
  const debt = debtRows.reduce((sum, row) => sum + Number(row.cong_no_hien_tai), 0);
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(firstDay, index));
  const byDay = new Map(days.map((day) => [day, 0]));
  for (const order of orders) byDay.set(order.ngay_dat, (byDay.get(order.ngay_dat) ?? 0) + Number(order.tong_tien));
  const max = Math.max(...byDay.values(), 1);
  const customerIds = [...new Set(recentOrders.flatMap((order) => order.khach_hang_id ? [order.khach_hang_id] : []))];
  const customers = new Map<string, string>();
  for (let offset = 0; offset < customerIds.length; offset += 500) {
    const result = await supabase.from("khach_hang").select("id, ten_khach_hang").in("id", customerIds.slice(offset, offset + 500));
    if (result.error) throw new Error("Không thể tải tên khách hàng của đơn mới nhất.");
    for (const row of result.data ?? []) customers.set(row.id, row.ten_khach_hang);
  }

  const cards = [
    { label: "Doanh số hôm nay", value: money(salesToday), Icon: TrendingUp, style: "bg-slate-100 text-slate-700" },
    { label: "Đơn hàng hôm nay", value: String(todayOrders.length), Icon: ShoppingCart, style: "bg-slate-100 text-slate-700" },
    { label: "Dư nợ toàn hệ thống", value: money(debt), Icon: CreditCard, style: "bg-slate-100 text-slate-700" },
    { label: "Thực thu trong ngày", value: money(collected), Icon: Wallet, style: "bg-slate-100 text-slate-700" },
  ];
  const width = 700, height = 220, bar = 48, gap = (width - days.length * bar) / (days.length + 1);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section aria-label="Chỉ số kinh doanh" className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, Icon, style }) => <article key={label} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div className="text-sm font-medium text-slate-500">{label}</div><span className={"rounded-lg p-2 " + style}><Icon aria-hidden="true" className="h-5 w-5" /></span></div><div className="mt-4 text-2xl font-semibold text-slate-900">{value}</div></article>)}
      </section>
      <section className="grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Doanh số 7 ngày</h2>
          <div className="mt-5 overflow-hidden"><svg role="img" aria-label="Biểu đồ doanh số 7 ngày" viewBox={"0 0 " + width + " " + height} className="dashboard-sales-chart h-56 w-full">
            <line x1="0" y1={height - 28} x2={width} y2={height - 28} stroke="#e2e8f0" />
            {days.map((day, index) => { const value = byDay.get(day) ?? 0; const barHeight = value ? Math.max(8, (height - 62) * value / max) : 3; const x = gap + index * (bar + gap); const y = height - 29 - barHeight; return <g key={day}><title>{shortDate(day) + ": " + money(value)}</title><rect x={x} y={y} width={bar} height={barHeight} rx="6" fill={day === today ? "var(--brand-orange)" : "#e2e8f0"} /><text x={x + bar / 2} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="12">{shortDate(day)}</text></g>; })}
          </svg></div>
        </article>
        <article className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Package aria-hidden="true" className="h-5 w-5 text-slate-500" /><h2 className="font-semibold text-slate-900">10 đơn hàng mới nhất</h2></div>
          {recentOrders.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Chưa có đơn hàng.</p> : <ul className="mt-4 divide-y divide-slate-100">{recentOrders.map((order) => <li key={order.id} className="flex min-w-0 items-center gap-1 py-3 text-xs"><Link title={order.ma_don_hang} href={"/danh-sach-don-hang/" + order.id} className="w-[8.5rem] shrink-0 truncate text-xs font-medium text-primary hover:underline">{order.ma_don_hang}</Link><span title={customers.get(order.khach_hang_id ?? "") ?? "Khách lẻ"} className="min-w-0 flex-1 truncate text-slate-700">{customers.get(order.khach_hang_id ?? "") ?? "Khách lẻ"}</span><span className="w-10 shrink-0 text-slate-500">{shortDate(order.ngay_dat)}</span><span className="w-[4.5rem] shrink-0 text-right font-semibold text-slate-900">{money(Number(order.tong_tien))}</span></li>)}</ul>}
        </article>
      </section>
    </main>
  );
}







