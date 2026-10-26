
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerTable } from "@/components/khach-hang/customer-table";
import { normalizeVietnameseSearch } from "@/lib/search/normalize-vietnamese";

const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];

type PageProps = {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
  }>;
};

export default async function KhachHangPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  // Lấy số dòng mỗi trang từ URL.
  const parsedPageSize = Number(params.pageSize);
  const pageSize = ALLOWED_PAGE_SIZES.includes(parsedPageSize)
    ? parsedPageSize
    : DEFAULT_PAGE_SIZE;

  // Lấy trang hiện tại.
  const parsedPage = Number(params.page ?? "1");
  const currentPage =
    Number.isInteger(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  const search = params.search?.trim() ?? "";
  const status = params.status === "active" || params.status === "inactive"
    ? params.status
    : "all";

  const supabase = await createClient();

  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  // Lấy khách hàng theo phân trang.
  let customersQuery = supabase
    .from("v_khach_hang_tim_kiem")
    .select("*", { count: "exact" })
    .eq("la_khach_le", false);

  if (search) {
    const normalizedSearch = normalizeVietnameseSearch(search).replace(/[\\%_,]/g, "\\$&");
    customersQuery = customersQuery.ilike("tu_khoa_khong_dau", `%${normalizedSearch}%`);
  }

  if (status !== "all") {
    customersQuery = customersQuery.eq("trang_thai", status === "active");
  }

  const {
    data: customers,
    error,
    count,
  } = await customersQuery
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Lỗi lấy khách hàng:", error);
    throw new Error("Không thể tải danh sách khách hàng.");
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / pageSize),
  );

  // Nếu trang yêu cầu vượt quá số trang hiện có,
  // chuyển về trang cuối và giữ nguyên pageSize.
  if (currentPage > totalPages) {
    const redirectParams = new URLSearchParams();

    if (totalPages > 1) {
      redirectParams.set("page", String(totalPages));
    }

    if (pageSize !== DEFAULT_PAGE_SIZE) {
      redirectParams.set("pageSize", String(pageSize));
    }
    if (search) redirectParams.set("search", search);
    if (status !== "all") redirectParams.set("status", status);

    const query = redirectParams.toString();

    redirect(query ? `/danh-sach-khach-hang?${query}` : "/danh-sach-khach-hang");
  }

  // Chỉ lấy công nợ cho các khách hàng trên trang hiện tại.
  const currentCustomers = customers ?? [];
  const customerIds = currentCustomers.map(
    (customer) => customer.id,
  );

  let congNoRows: {
    khach_hang_id: string;
    cong_no_hien_tai: number | null;
  }[] = [];

  if (customerIds.length > 0) {
    const {
      data,
      error: debtError,
    } = await supabase
      .from("v_cong_no_khach_hang")
      .select("khach_hang_id, cong_no_hien_tai")
      .in("khach_hang_id", customerIds);

    if (debtError) {
      console.error("Lỗi lấy công nợ khách hàng:", debtError);
      throw new Error("Không thể tải dữ liệu công nợ khách hàng.");
    }

    congNoRows = data ?? [];
  }

  const congNoMap = new Map(
    congNoRows.map((row) => [
      row.khach_hang_id,
      Number(row.cong_no_hien_tai ?? 0),
    ]),
  );

  const customersWithDebt = currentCustomers.map((customer) => ({
    ...customer,
    cong_no_hien_tai: congNoMap.get(customer.id) ?? 0,
  }));

  return (
    <div className="p-4 md:p-3">
      <CustomerTable
        customers={customersWithDebt}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        search={search}
        status={status}
      />
    </div>
  );
}

