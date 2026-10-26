import { PhieuThuManager, type Receipt, type ReceiptAllocation, type ReceiptCustomer, type ReceiptOrder } from "@/components/phieu-thu/phieu-thu-manager";
import { createClient } from "@/lib/supabase/server";
import { normalizeVietnameseSearch } from "@/lib/search/normalize-vietnamese";
import { redirect } from "next/navigation";

const PAGE_SIZE = 10;

type PageProps = { searchParams: Promise<{ page?: string; search?: string; from?: string; to?: string; status?: string; method?: string }> };

export default async function PhieuThuPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsedPage = Number(params.page ?? "1");
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const search = params.search?.trim() ?? "";
  const fromDate = params.from ?? "";
  const toDate = params.to ?? "";
  const status = ["nhap", "da_xac_nhan", "da_huy"].includes(params.status ?? "") ? params.status! : "all";
  const method = ["tien_mat", "chuyen_khoan", "the", "vi_dien_tu", "khac"].includes(params.method ?? "") ? params.method! : "all";
  const supabase = await createClient();
  let receiptQuery = supabase.from("v_phieu_thu_tim_kiem").select("*", { count: "exact" });
  if (search) receiptQuery = receiptQuery.ilike("tu_khoa_khong_dau", `%${normalizeVietnameseSearch(search).replace(/[\\%_,]/g, "\\$&")}%`);
  if (fromDate) receiptQuery = receiptQuery.gte("ngay_thu", fromDate);
  if (toDate) receiptQuery = receiptQuery.lte("ngay_thu", toDate);
  if (status !== "all") receiptQuery = receiptQuery.eq("trang_thai", status);
  if (method !== "all") receiptQuery = receiptQuery.eq("phuong_thuc_thanh_toan", method);
  const [receiptResult, customerResult, orderResult, allocationResult, receiptStatusResult] = await Promise.all([
    receiptQuery.order("ngay_thu", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("khach_hang").select("id, ma_khach_hang, ten_khach_hang, so_dien_thoai").order("ten_khach_hang"),
    supabase.from("don_hang").select("id, ma_don_hang, khach_hang_id, ngay_dat, tong_tien, trang_thai").order("ngay_dat", { ascending: false }),
    supabase.from("phieu_thu_phan_bo").select("id, phieu_thu_id, don_hang_id, so_tien, ghi_chu"),
    supabase.from("phieu_thu").select("id, trang_thai"),
  ]);

  if (receiptResult.error || customerResult.error || orderResult.error || allocationResult.error || receiptStatusResult.error) {
    throw new Error("Không thể tải dữ liệu phiếu thu.");
  }

  const rawReceipts = receiptResult.data ?? [];
  const totalCount = receiptResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (page > pageCount) {
    const next = new URLSearchParams();
    if (pageCount > 1) next.set("page", String(pageCount));
    if (search) next.set("search", search);
    if (fromDate) next.set("from", fromDate);
    if (toDate) next.set("to", toDate);
    if (status !== "all") next.set("status", status);
    if (method !== "all") next.set("method", method);
    redirect(next.size ? `/phieu-thu?${next}` : "/phieu-thu");
  }
  const rawAllocations = allocationResult.data ?? [];
  const receiptStatus = new Map((receiptStatusResult.data ?? []).map((receipt) => [receipt.id, receipt.trang_thai]));
  const paidByOrder = new Map<string, number>();
  for (const row of rawAllocations) {
    if (receiptStatus.get(row.phieu_thu_id) === "da_xac_nhan") {
      paidByOrder.set(row.don_hang_id, (paidByOrder.get(row.don_hang_id) ?? 0) + Number(row.so_tien));
    }
  }

  const customers = (customerResult.data ?? []) as ReceiptCustomer[];
  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const orders: ReceiptOrder[] = (orderResult.data ?? []).map((order) => {
    const total = Number(order.tong_tien);
    const paid = paidByOrder.get(order.id) ?? 0;
    return { ...order, tong_tien: total, da_thu: paid, con_no: Math.max(0, total - paid) };
  });
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const allocationsByReceipt = new Map<string, ReceiptAllocation[]>();
  for (const row of rawAllocations) {
    const order = orderMap.get(row.don_hang_id);
    const item: ReceiptAllocation = {
      id: row.id,
      phieu_thu_id: row.phieu_thu_id,
      don_hang_id: row.don_hang_id,
      so_tien: Number(row.so_tien),
      ghi_chu: row.ghi_chu,
      order: order ? { ma_don_hang: order.ma_don_hang, ngay_dat: order.ngay_dat, tong_tien: order.tong_tien } : undefined,
    };
    allocationsByReceipt.set(row.phieu_thu_id, [...(allocationsByReceipt.get(row.phieu_thu_id) ?? []), item]);
  }
  const receipts: Receipt[] = rawReceipts.map((receipt) => ({
    ...receipt,
    tong_tien: Number(receipt.tong_tien),
    customer: customerMap.get(receipt.khach_hang_id) ?? (receipt.ma_khach_hang ? { ma_khach_hang: receipt.ma_khach_hang, ten_khach_hang: receipt.ten_khach_hang ?? "" } : undefined),
    allocations: allocationsByReceipt.get(receipt.id) ?? [],
  }));
  return <PhieuThuManager receipts={receipts} customers={customers} orders={orders} totalCount={totalCount} page={page} initialSearch={search} initialFromDate={fromDate} initialToDate={toDate} initialStatus={status} initialMethod={method} />;
}
