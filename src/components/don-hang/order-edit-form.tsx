"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { capNhatDonHang } from "@/lib/supabase/don-hang-actions";
import { notifyOrder, setPendingOrderNotification } from "@/components/don-hang/order-notification-toast";
import { formatCurrency, formatNumber, parseCurrencyInput } from "@/types/don-hang";

type Customer = { id: string; nhom_khach_hang_id: string | null };
type Variant = { id: string; ma_sku: string; thuoc_tinh: Record<string, string>; gia_ban: number };
type Product = { id: string; ma_san_pham: string; ten_san_pham: string; don_vi_tinh: string; gia_ban: number; variants: Variant[] };
type Group = { id: string; ap_dung_bang_gia: boolean };
type OrderType = "dat_hang" | "ban_nhanh";
type Line = { key: string; sanPhamId: string; variantId: string | null; label: string; unit: string; qty: number; defaultPrice: number; basePrice: number; price: number; manual: boolean };
type InitialLine = { id: string; san_pham_id: string; bien_the_san_pham_id: string | null; label: string; don_vi_tinh: string; so_luong: number; don_gia: number; gia_goc: number; gia_da_chinh_sua_thu_cong: boolean };
type Order = { id: string; ma_don_hang: string; khach_hang_id: string; customerLabel: string; customerAddress: string | null; loai_don_hang: OrderType; ngay_dat: string; han_giao: string | null; dia_chi_giao_hang: string | null; ghi_chu: string | null; giam_gia: number; phi_van_chuyen: number };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").trim();

export function OrderEditForm({ order, initialLines, customers, products, groups, prices }: {
  order: Order;
  initialLines: InitialLine[];
  customers: Customer[];
  products: Product[];
  groups: Group[];
  prices: Record<string, number>;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(() => initialLines.map((line) => ({
    key: line.id,
    sanPhamId: line.san_pham_id,
    variantId: line.bien_the_san_pham_id,
    label: line.label,
    unit: line.don_vi_tinh || "",
    qty: Number(line.so_luong),
    defaultPrice: Number(line.gia_goc),
    basePrice: Number(line.gia_goc),
    price: Number(line.don_gia),
    manual: Boolean(line.gia_da_chinh_sua_thu_cong),
  })));
  const [deliveryDate, setDeliveryDate] = useState(order.han_giao ?? "");
  const [shippingAddress, setShippingAddress] = useState(order.dia_chi_giao_hang ?? order.customerAddress ?? "");
  const [note, setNote] = useState(order.ghi_chu ?? "");
  const [discount, setDiscount] = useState(Number(order.giam_gia));
  const [shipping, setShipping] = useState(Number(order.phi_van_chuyen));
  const [productSearch, setProductSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choices = useMemo(() => products.reduce<{ product: Product; variant: Variant | null; label: string }[]>((items, product) => {
    if (product.variants.length) {
      items.push(...product.variants.map((variant) => ({ product, variant, label: `${product.ten_san_pham} · ${Object.entries(variant.thuoc_tinh).map(([key, value]) => `${key}: ${value}`).join(" · ")} · ${variant.ma_sku}` })));
    } else {
      items.push({ product, variant: null, label: `${product.ten_san_pham} · ${product.ma_san_pham}` });
    }
    return items;
  }, []), [products]);
  const results = useMemo(() => {
    const query = normalize(productSearch);
    const matches = choices.filter(({ product, variant, label }) => !query || normalize(`${product.ma_san_pham} ${product.ten_san_pham} ${variant?.ma_sku ?? ""} ${Object.values(variant?.thuoc_tinh ?? {}).join(" ")} ${label}`).includes(query));
    return matches.slice(0, 40);
  }, [choices, productSearch]);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0), [lines]);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(shipping || 0));
  const customer = customers.find((item) => item.id === order.khach_hang_id);
  const group = groups.find((item) => item.id === customer?.nhom_khach_hang_id);

  function getBasePrice(productId: string, variantId: string | null, fallback: number) {
    if (!group?.ap_dung_bang_gia || !customer?.nhom_khach_hang_id) return fallback;
    const key = `${customer.nhom_khach_hang_id}:${variantId ? `variant:${variantId}` : `product:${productId}`}`;
    return prices[key] ?? fallback;
  }

  function addProduct(product: Product, variant: Variant | null) {
    const variantId = variant?.id ?? null;
    const found = lines.find((line) => line.sanPhamId === product.id && line.variantId === variantId);
    if (found) {
      setLines((current) => current.map((line) => line.key === found.key ? { ...line, qty: Number((line.qty + 1).toFixed(2)) } : line));
    } else {
      const fallback = Number(variant?.gia_ban ?? product.gia_ban);
      const basePrice = getBasePrice(product.id, variantId, fallback);
      const attributes = variant ? Object.entries(variant.thuoc_tinh).map(([key, value]) => `${key}: ${value}`).join(" · ") : "";
      setLines((current) => [...current, {
        key: `${Date.now()}-${Math.random()}`,
        sanPhamId: product.id,
        variantId,
        label: variant ? `${product.ten_san_pham} · ${attributes} · SKU ${variant.ma_sku}` : product.ten_san_pham,
        unit: product.don_vi_tinh,
        qty: 1,
        defaultPrice: fallback,
        basePrice,
        price: basePrice,
        manual: false,
      }]);
    }
    setProductSearch("");
    setSearchOpen(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!lines.length) { setError("Đơn hàng cần có ít nhất một sản phẩm."); return; }
    if (order.loai_don_hang === "dat_hang" && (!deliveryDate || deliveryDate < order.ngay_dat)) {
      setError("Hạn giao hàng không được trước ngày đặt hàng.");
      return;
    }
    if (discount < 0 || discount > subtotal || shipping < 0 || lines.some((line) => line.qty <= 0 || line.price < 0)) {
      setError("Vui lòng kiểm tra số lượng, đơn giá, giảm giá và phí vận chuyển.");
      return;
    }

    setSaving(true);
    try {
      await capNhatDonHang({
        don_hang_id: order.id,
        han_giao: deliveryDate,
        dia_chi_giao_hang: shippingAddress,
        ghi_chu: note,
        giam_gia: Number(discount),
        phi_van_chuyen: Number(shipping),
        chi_tiet: lines.map((line) => ({
          san_pham_id: line.sanPhamId,
          bien_the_san_pham_id: line.variantId,
          so_luong: Number(line.qty),
          don_gia: Number(line.price),
          gia_goc: Number(line.basePrice),
          gia_da_chinh_sua_thu_cong: line.manual || line.price !== line.basePrice,
        })),
      });
      setPendingOrderNotification({ type: "success", message: `Đã cập nhật đơn hàng ${order.ma_don_hang}.` });
      router.push(`/danh-sach-don-hang/${order.id}`);
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không thể cập nhật đơn hàng.";
      setError(message);
      notifyOrder({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }

  const priceInput = (line: Line) => (
    <div className="flex min-w-40 items-center gap-2 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {line.manual && <span className="shrink-0 text-xs text-slate-500 line-through">{formatNumber(line.basePrice)}</span>}
      <Input type="text" inputMode="numeric" value={formatNumber(line.price)} aria-label={`Đơn giá ${line.label}`} onChange={(event) => {
        const price = parseCurrencyInput(event.target.value);
        setLines((current) => current.map((item) => item.key === line.key ? { ...item, price, manual: price !== item.basePrice } : item));
      }} className="h-9 border-0 px-0 shadow-none focus-visible:ring-0" />
    </div>
  );

  return <form onSubmit={submit} className="space-y-4">
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <section className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2 sm:p-5">
      <label className="grid gap-1.5 text-sm font-medium">Mã đơn hàng<Input value={order.ma_don_hang} readOnly className="bg-slate-50" /></label>
      <label className="grid gap-1.5 text-sm font-medium">Khách hàng<Input value={order.customerLabel} readOnly className="bg-slate-50" aria-label="Khách hàng không thể thay đổi" /></label>
      {order.loai_don_hang === "dat_hang" && <label className="grid gap-1.5 text-sm font-medium">Hạn giao hàng<Input type="date" min={order.ngay_dat} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} required /></label>}
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Địa chỉ giao hàng<Textarea value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} maxLength={500} rows={2} /></label>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Ghi chú<Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} /></label>
    </section>

    <section className="overflow-visible rounded-xl border bg-white">
      <div className="border-b p-4"><h2 className="font-semibold">Sản phẩm trong đơn</h2></div>
      <div className="p-4"><div className="relative grid gap-1.5 text-sm font-medium">
        <label htmlFor="edit-product-search">Thêm sản phẩm hoặc biến thể</label>
        <Input id="edit-product-search" value={productSearch} onFocus={() => setSearchOpen(true)} onClick={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 180)} onChange={(event) => { setProductSearch(event.target.value); setSearchOpen(true); }} placeholder="Tìm theo mã, SKU hoặc tên sản phẩm" autoComplete="off" />
        {searchOpen && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">{results.map(({ product, variant, label }) => <button type="button" key={variant?.id ?? product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addProduct(product, variant)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="block font-medium">{label}</span><span className="text-xs text-slate-500">{formatCurrency(Number(variant?.gia_ban ?? product.gia_ban))} · {product.don_vi_tinh}</span></button>)}{results.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy sản phẩm phù hợp.</p>}</div>}
      </div></div>

      <div className="hidden overflow-x-auto px-4 pb-4 md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">Sản phẩm / biến thể</th><th className="px-3 py-2">ĐVT</th><th className="px-3 py-2">Số lượng</th><th className="px-3 py-2">Đơn giá</th><th className="px-3 py-2">Thành tiền</th><th /></tr></thead><tbody className="divide-y">{lines.map((line) => <tr key={line.key}><td className="max-w-sm px-3 py-3 font-medium">{line.label}</td><td className="px-3 py-3">{line.unit || "—"}</td><td className="px-3 py-3"><Input type="number" min="0.01" step="0.01" value={line.qty} onChange={(event) => { const qty = Number(event.target.value); setLines((current) => current.map((item) => item.key === line.key ? { ...item, qty } : item)); }} className="w-24" /></td><td className="px-3 py-3">{priceInput(line)}</td><td className="whitespace-nowrap px-3 py-3">{formatCurrency(line.qty * line.price)}</td><td className="px-3 py-3"><Button type="button" size="icon" variant="ghost" aria-label={`Xóa ${line.label}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 className="h-4 w-4 text-red-600" /></Button></td></tr>)}</tbody></table></div>
      <div className="divide-y divide-slate-100 px-4 pb-4 md:hidden">{lines.map((line) => <div key={line.key} className="space-y-3 py-4 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{line.label}</p><p className="mt-1 text-xs text-slate-500">ĐVT: {line.unit || "—"}</p></div><Button type="button" size="icon" variant="ghost" aria-label={`Xóa ${line.label}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 className="h-4 w-4 text-red-600" /></Button></div><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs font-medium text-slate-600">Số lượng<Input type="number" min="0.01" step="0.01" value={line.qty} onChange={(event) => { const qty = Number(event.target.value); setLines((current) => current.map((item) => item.key === line.key ? { ...item, qty } : item)); }} /></label><label className="grid gap-1 text-xs font-medium text-slate-600">Đơn giá{priceInput(line)}</label></div><div className="text-right text-sm font-semibold">Thành tiền: {formatCurrency(line.qty * line.price)}</div></div>)}</div>
      {lines.length === 0 && <p className="px-4 pb-6 text-center text-sm text-slate-500">Đơn hàng cần có ít nhất một sản phẩm.</p>}
    </section>

    <section className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2 sm:p-5">
      <label className="grid gap-1.5 text-sm font-medium">Giảm giá<Input type="text" inputMode="numeric" value={formatNumber(discount)} onChange={(event) => setDiscount(parseCurrencyInput(event.target.value))} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Phí vận chuyển<Input type="text" inputMode="numeric" value={formatNumber(shipping)} onChange={(event) => setShipping(parseCurrencyInput(event.target.value))} /></label>
      <div className="sm:col-span-2 flex flex-col gap-1 text-right text-sm"><span>Tạm tính: {formatCurrency(subtotal)}</span><span>Giảm giá: −{formatCurrency(discount)}</span><span>Phí vận chuyển: {formatCurrency(shipping)}</span><strong className="text-lg">Tổng tiền mới: {formatCurrency(total)}</strong></div>
    </section>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href={`/danh-sach-don-hang/${order.id}`} className={buttonVariants({ variant: "outline" })}>Hủy</Link><Button type="submit" disabled={saving || !lines.length}><Save className="mr-2 h-4 w-4" />{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button></div>
  </form>;
}
