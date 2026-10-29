import { notFound } from "next/navigation";

import { getKhachHangById } from "@/lib/supabase/khach-hang-server";
import { CustomerForm } from "@/components/khach-hang/customer-form";
import { getNhomKhachHang } from "@/lib/supabase/nhom-khach-hang-actions";
import type { NhomKhachHangOption } from "@/types/khach-hang";

interface EditCustomerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params;

  let customer;
  let groups: NhomKhachHangOption[] = [];

  try {
    customer = await getKhachHangById(id);
    groups = await getNhomKhachHang(true);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Không tìm thấy khách hàng."
    ) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6 app-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Chỉnh sửa khách hàng
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Cập nhật thông tin khách hàng {customer.ma_khach_hang}.
        </p>
      </div>

      <CustomerForm
        mode="edit"
        customer={customer}
        groups={groups}
      />
    </div>
  );
}

