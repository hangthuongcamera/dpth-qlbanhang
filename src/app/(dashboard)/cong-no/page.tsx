import { createClient } from "@/lib/supabase/server";
import { CongNoManager, type CongNoCustomer } from "@/components/cong-no/cong-no-manager";
import type { DebtTransaction } from "@/components/cong-no/cong-no-ledger";

export default async function CongNoPage() {
  const supabase = await createClient();
  const balances: { khach_hang_id: string; ma_khach_hang: string; ten_khach_hang: string; cong_no_hien_tai: number | null; han_muc_cong_no: number | null; han_muc_cong_no_con_lai: number | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("v_cong_no_khach_hang")
      .select("khach_hang_id, ma_khach_hang, ten_khach_hang, cong_no_hien_tai, han_muc_cong_no, han_muc_cong_no_con_lai")
      .gt("cong_no_hien_tai", 0)
      .order("cong_no_hien_tai", { ascending: false })
      .range(offset, offset + 999);
    if (error) {
      console.error("Lỗi tải bảng tổng hợp công nợ:", error);
      throw new Error("Không thể tải bảng tổng hợp công nợ.");
    }
    balances.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }

  const ids = balances.map((row) => row.khach_hang_id);
  const phoneById = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data: contacts, error: contactError } = await supabase.from("khach_hang").select("id, so_dien_thoai").in("id", ids.slice(offset, offset + 500));
    if (contactError) throw new Error("Không thể tải số điện thoại khách hàng.");
    for (const row of contacts ?? []) phoneById.set(row.id, row.so_dien_thoai ?? "");
  }

  const customers: CongNoCustomer[] = balances.map((row) => ({
    id: row.khach_hang_id,
    ma_khach_hang: row.ma_khach_hang,
    ten_khach_hang: row.ten_khach_hang,
    so_dien_thoai: phoneById.get(row.khach_hang_id) ?? "",
    cong_no_hien_tai: Number(row.cong_no_hien_tai ?? 0),
    han_muc_cong_no: Number(row.han_muc_cong_no ?? 0),
    han_muc_cong_no_con_lai: Number(row.han_muc_cong_no_con_lai ?? 0),
  }));

  const ledgerRows: { id: string; khach_hang_id: string; don_hang_id: string | null; phieu_thu_id: string | null; loai_giao_dich: string; so_tien: number; ngay_giao_dich: string; created_at: string; ghi_chu: string | null }[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    for (let pageOffset = 0; ; pageOffset += 1000) {
      const { data, error } = await supabase.from("giao_dich_cong_no").select("id, khach_hang_id, don_hang_id, phieu_thu_id, loai_giao_dich, so_tien, ngay_giao_dich, created_at, ghi_chu").in("khach_hang_id", ids.slice(offset, offset + 500)).order("ngay_giao_dich", { ascending: true }).order("created_at", { ascending: true }).range(pageOffset, pageOffset + 999);
      if (error) throw new Error("Không thể tải sổ giao dịch công nợ.");
      ledgerRows.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  const orderIds = [...new Set(ledgerRows.flatMap((r) => r.don_hang_id ? [r.don_hang_id] : []))];
  const receiptIds = [...new Set(ledgerRows.flatMap((r) => r.phieu_thu_id ? [r.phieu_thu_id] : []))];
  const orders: { id: string; ma_don_hang: string }[] = [];
  const receipts: { id: string; ma_phieu_thu: string }[] = [];
  for (let offset = 0; offset < orderIds.length; offset += 500) {
    const { data, error } = await supabase.from("don_hang").select("id, ma_don_hang").in("id", orderIds.slice(offset, offset + 500));
    if (error) throw new Error("Không thể tải mã đơn hàng trong sổ công nợ.");
    orders.push(...(data ?? []));
  }
  for (let offset = 0; offset < receiptIds.length; offset += 500) {
    const { data, error } = await supabase.from("phieu_thu").select("id, ma_phieu_thu").in("id", receiptIds.slice(offset, offset + 500));
    if (error) throw new Error("Không thể tải mã phiếu thu trong sổ công nợ.");
    receipts.push(...(data ?? []));
  }
  const orderMap = new Map(orders.map((r) => [r.id, r.ma_don_hang]));
  const receiptMap = new Map(receipts.map((r) => [r.id, r.ma_phieu_thu]));
  const transactionsByCustomer: Record<string, DebtTransaction[]> = {};
  for (const row of ledgerRows) {
    const item: DebtTransaction = { id: row.id, ngay_giao_dich: row.ngay_giao_dich, created_at: row.created_at, ma_tham_chieu: row.don_hang_id ? orderMap.get(row.don_hang_id) ?? "Đơn hàng" : row.phieu_thu_id ? receiptMap.get(row.phieu_thu_id) ?? "Phiếu thu" : "Điều chỉnh công nợ", loai_giao_dich: row.loai_giao_dich, so_tien: Number(row.so_tien), ghi_chu: row.ghi_chu ?? "" };
    (transactionsByCustomer[row.khach_hang_id] ??= []).push(item);
  }

  return <div className="app-page"><CongNoManager customers={customers} transactionsByCustomer={transactionsByCustomer} /></div>;
}

