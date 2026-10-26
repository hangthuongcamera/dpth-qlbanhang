import { OrderTable, OrderListItem } from "@/components/don-hang/order-table";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];

type PageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    orderType?: string;
    status?: string;
    paymentStatus?: string;
    fromDate?: string;
    toDate?: string;
  }>;
};

export default async function DanhSachDonHangPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const parsedPageSize = Number(params.pageSize);
  const pageSize = ALLOWED_PAGE_SIZES.includes(parsedPageSize) ? parsedPageSize : DEFAULT_PAGE_SIZE;

  const parsedPage = Number(params.page ?? "1");
  const currentPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const search = params.search?.trim() ?? "";
  const orderType = params.orderType ?? "all";
  const status = params.status ?? "all";
  const paymentStatus = params.paymentStatus ?? "all";
  const fromDate = params.fromDate?.trim() ?? "";
  const toDate = params.toDate?.trim() ?? "";

  const supabase = await createClient();

  // Tìm kiếm khách hàng theo từ khóa nếu có
  let matchingCustomerIds: string[] = [];
  if (search) {
    const escaped = search.replace(/[,%()]/g, "\\$&");
    const { data: matchedCustomers } = await supabase
      .from("khach_hang")
      .select("id")
      .or(`ma_khach_hang.ilike.%${escaped}%,ten_khach_hang.ilike.%${escaped}%,so_dien_thoai.ilike.%${escaped}%`)
      .limit(100);

    matchingCustomerIds = (matchedCustomers ?? []).map((c) => c.id);
  }

  // Khởi tạo truy vấn đơn hàng
  let query = supabase
    .from("don_hang")
    .select("id, ma_don_hang, khach_hang_id, ngay_dat, han_giao, trang_thai, tong_tien, loai_don_hang, created_at", { count: "exact" });

  if (search) {
    const escaped = search.replace(/[,%()]/g, "\\$&");
    if (matchingCustomerIds.length > 0) {
      query = query.or(
        `ma_don_hang.ilike.%${escaped}%,khach_hang_id.in.(${matchingCustomerIds.join(",")})`
      );
    } else {
      query = query.ilike("ma_don_hang", `%${escaped}%`);
    }
  }

  if (orderType !== "all") {
    query = query.eq("loai_don_hang", orderType);
  }

  if (status !== "all") {
    query = query.eq("trang_thai", status);
  }

  if (fromDate) {
    query = query.gte("ngay_dat", fromDate);
  }

  if (toDate) {
    query = query.lte("ngay_dat", toDate);
  }

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: orderRows, error: orderError, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (orderError) throw new Error("Không thể tải danh sách đơn hàng.");

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rawOrders = orderRows ?? [];

  // Lấy danh sách thông tin khách hàng tương ứng
  const customerIds = [...new Set(rawOrders.map((o) => o.khach_hang_id))];
  const { data: customers } = customerIds.length
    ? await supabase
        .from("khach_hang")
        .select("id, ma_khach_hang, ten_khach_hang, so_dien_thoai")
        .in("id", customerIds)
    : { data: [] };

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c] as const));

  // Lấy thông tin thanh toán đã phân bổ để tính đã thu và còn nợ
  const orderIds = rawOrders.map((o) => o.id);
  type AllocRow = {
    don_hang_id: string;
    so_tien: number;
    phieu_thu: { trang_thai: string };
  };
  let allocationRows: AllocRow[] = [];

  if (orderIds.length > 0) {
    const { data: allocData } = await supabase
      .from("phieu_thu_phan_bo")
      .select("don_hang_id, so_tien, phieu_thu!inner(trang_thai)")
      .in("don_hang_id", orderIds)
      .eq("phieu_thu.trang_thai", "da_xac_nhan");

    allocationRows = (allocData as unknown as AllocRow[]) ?? [];
  }

  const paidMap = new Map<string, number>();
  for (const row of allocationRows) {
    const prev = paidMap.get(row.don_hang_id) ?? 0;
    paidMap.set(row.don_hang_id, prev + Number(row.so_tien || 0));
  }

  let orders: OrderListItem[] = rawOrders.map((order) => {
    const da_thu = paidMap.get(order.id) ?? 0;
    const con_no = Math.max(0, Number(order.tong_tien) - da_thu);
    return {
      id: order.id,
      ma_don_hang: order.ma_don_hang,
      loai_don_hang: order.loai_don_hang as "dat_hang" | "ban_nhanh",
      ngay_dat: order.ngay_dat,
      han_giao: order.han_giao,
      trang_thai: order.trang_thai,
      tong_tien: Number(order.tong_tien),
      da_thu,
      con_no,
      khach_hang: customerMap.get(order.khach_hang_id) ?? null,
    };
  });

  if (paymentStatus === "da_thanh_toan") {
    orders = orders.filter((o) => o.con_no === 0);
  } else if (paymentStatus === "con_no") {
    orders = orders.filter((o) => o.con_no > 0);
  }

  return (
    <div className="p-4 md:p-6">
      <OrderTable
        orders={orders}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        search={search}
        orderType={orderType}
        status={status}
        paymentStatus={paymentStatus}
        fromDate={fromDate}
        toDate={toDate}
      />
    </div>
  );
}
