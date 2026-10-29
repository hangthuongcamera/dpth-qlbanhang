"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { taoDonHang } from "@/lib/supabase/don-hang-actions";
import { notifyOrder, OrderNotificationToast, setPendingOrderNotification } from "@/components/don-hang/order-notification-toast";
import { formatCurrency, formatNumber, parseCurrencyInput } from "@/types/don-hang";

type Customer = { id: string; ma_khach_hang: string; ten_khach_hang: string; so_dien_thoai?: string | null; dia_chi?: string | null; nhom_khach_hang_id: string | null; la_khach_le: boolean };
type Variant = { id: string; ma_sku: string; thuoc_tinh: Record<string, string>; gia_ban: number };
type Product = { id: string; ma_san_pham: string; ten_san_pham: string; don_vi_tinh: string; gia_ban: number; variants: Variant[] };
type Group = { id: string; ten_nhom: string; ap_dung_bang_gia: boolean };
type OrderType = "dat_hang" | "ban_nhanh";
type Line = { key: string; sanPhamId: string; variantId: string | null; label: string; productName: string; sku: string; detail: string; qty: number; defaultPrice: number; basePrice: number; price: number; manual: boolean };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").trim();


export function OrderCreateForm({ customers, products, groups, prices, orderType, posInstanceId, posTabsHeader, onPosCustomerChange, onPosDirtyChange, onPosComplete }: { customers: Customer[]; products: Product[]; groups: Group[]; prices: Record<string, number>; orderType: OrderType; posInstanceId?: number; posTabsHeader?: React.ReactNode; onPosCustomerChange?: (name: string) => void; onPosDirtyChange?: (dirty: boolean) => void; onPosComplete?: () => void }) {
  const router = useRouter();
  const walkInCustomer = customers.find((item) => item.la_khach_le);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const deliveryDateInputRef = useRef<HTMLInputElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const paymentAmountInputRef = useRef<HTMLInputElement>(null);
  const deliveryPhoneInputRef = useRef<HTMLInputElement>(null);
  const deliveryAddressInputRef = useRef<HTMLInputElement>(null);
  const lineCounterRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [customerId, setCustomerId] = useState(orderType === "ban_nhanh" ? walkInCustomer?.id ?? "" : "");
  const [customerSearch, setCustomerSearch] = useState(orderType === "ban_nhanh" && walkInCustomer ? "Khách lẻ" : "");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryPhone, setDeliveryPhone] = useState(walkInCustomer?.so_dien_thoai ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(walkInCustomer?.dia_chi ?? "");
  const [paymentAmountOverride, setPaymentAmountOverride] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("tien_mat");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [posHeaderTarget, setPosHeaderTarget] = useState<HTMLElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewAccepted, setReceiptPreviewAccepted] = useState(false);
  const customer = customers.find((item) => item.id === customerId);
  const customerMatches = useMemo(() => {
    const query = normalize(customerSearch);
    const availableCustomers = customers.filter((item) => orderType === "ban_nhanh" || !item.la_khach_le);
    const isCurrentCustomerSelected = Boolean(
      customer &&
      customerSearch === (customer.la_khach_le ? "Khách lẻ" : `${customer.ma_khach_hang} · ${customer.ten_khach_hang}`)
    );
    if (!query || isCurrentCustomerSelected) {
      return availableCustomers.slice(0, 50);
    }
    return availableCustomers.filter((item) => normalize(`${item.ma_khach_hang} ${item.ten_khach_hang} ${item.so_dien_thoai ?? ""}`).includes(query)).slice(0, 50);
  }, [customerSearch, customer, customers, orderType]);
  const productChoices = useMemo(() => products.reduce<{ product: Product; variant: Variant | null; label: string }[]>((choices, product) => {
    if (product.variants.length) {
      choices.push(...product.variants.map((variant) => ({ product, variant, label: `${product.ten_san_pham} · ${Object.entries(variant.thuoc_tinh).map(([key, value]) => `${key}: ${value}`).join(" · ")} · ${variant.ma_sku}` })));
    } else {
      choices.push({ product, variant: null, label: `${product.ten_san_pham} · ${product.ma_san_pham}` });
    }
    return choices;
  }, []), [products]);
  const productMatches = useMemo(() => {
    const query = normalize(productSearch);
    if (!query) {
      return productChoices.slice(0, 50);
    }
    return productChoices.filter(({ product, variant, label }) => normalize(`${product.ma_san_pham} ${product.ten_san_pham} ${variant?.ma_sku ?? ""} ${Object.values(variant?.thuoc_tinh ?? {}).join(" ")} ${label}`).includes(query)).slice(0, 50);
  }, [productSearch, productChoices]);
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.qty * line.price, 0), [lines]);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(shipping || 0));
  const paymentAmount = paymentAmountOverride ?? (orderType === "ban_nhanh" ? total : 0);
  const isWalkIn = Boolean(customer?.la_khach_le);
  const changeDue = orderType === "ban_nhanh" && paymentMethod === "tien_mat" ? Math.max(0, paymentAmount - total) : 0;
  const posDirty = lines.length > 0 || Number(discount) > 0 || Number(shipping) > 0 || note.length > 0 || paymentAmountOverride !== null || (orderType === "ban_nhanh" && (deliveryEnabled || (Boolean(customerId) && customerId !== walkInCustomer?.id)));
  useEffect(() => {
    if (orderType === "ban_nhanh") onPosDirtyChange?.(posDirty);
  }, [onPosDirtyChange, orderType, posDirty]);

  function getBasePrice(prodId: string, varId: string | null, fallback: number, customerRecord = customer) {
    const group = groups.find((item) => item.id === customerRecord?.nhom_khach_hang_id);
    if (!group?.ap_dung_bang_gia) return fallback;
    const key = `${group.id}:${varId ? `variant:${varId}` : `product:${prodId}`}`;
    return prices[key] ?? fallback;
  }

  function changeCustomer(nextId: string) {
    setCustomerId(nextId);
    setFieldErrors((current) => ({ ...current, customer: "" }));
    const nextCustomer = customers.find((item) => item.id === nextId);
    setCustomerSearch(nextCustomer ? (nextCustomer.la_khach_le ? "Khách lẻ" : `${nextCustomer.ma_khach_hang} · ${nextCustomer.ten_khach_hang}`) : "");
    setCustomerSearchOpen(false);
    if (orderType === "ban_nhanh") onPosCustomerChange?.(nextCustomer?.la_khach_le ? "Khách lẻ" : nextCustomer?.ten_khach_hang ?? "Khách lẻ");
    if (orderType === "ban_nhanh") {
      setDeliveryPhone(nextCustomer?.so_dien_thoai ?? "");
      setDeliveryAddress(nextCustomer?.dia_chi ?? "");
    }
    setLines((current) => current.map((line) => {
      const basePrice = getBasePrice(line.sanPhamId, line.variantId, line.defaultPrice, nextCustomer);
      return { ...line, basePrice, price: line.manual ? line.price : basePrice };
    }));
  }

  function addLine(product: Product, variant: Variant | null) {
    const variantId = variant?.id ?? null;
    const existingIndex = lines.findIndex(
      (line) => line.sanPhamId === product.id && line.variantId === variantId
    );

    if (existingIndex !== -1) {
      const existingLine = lines[existingIndex];
      setLines((current) =>
        current.map((line, index) =>
          index === existingIndex
            ? { ...line, qty: line.qty + 1 }
            : line
        )
      );
      setHighlightedKey(existingLine.key);
      window.setTimeout(() => setHighlightedKey(null), 1200);
    } else {
      const fallback = Number(variant?.gia_ban ?? product.gia_ban);
      const basePrice = getBasePrice(product.id, variantId, fallback);
      const label = variant
        ? `${product.ten_san_pham} – ${Object.entries(variant.thuoc_tinh).map(([key, value]) => `${key}: ${value}`).join(" · ")} (SKU: ${variant.ma_sku})`
        : product.ten_san_pham;
      const detail = variant
        ? Object.entries(variant.thuoc_tinh).map(([key, value]) => `${key}: ${value}`).join(" · ")
        : product.ma_san_pham;
      const newKey = `${posInstanceId ?? "order"}-${lineCounterRef.current++}`;
      setLines((current) => [
        ...current,
        {
          key: newKey,
          sanPhamId: product.id,
          variantId,
          label,
          productName: product.ten_san_pham,
          sku: variant?.ma_sku ?? "—",
          detail,
          qty: 1,
          defaultPrice: fallback,
          basePrice,
          price: basePrice,
          manual: false,
        },
      ]);
      setHighlightedKey(newKey);
      window.setTimeout(() => setHighlightedKey(null), 1200);
    }

    setProductSearch("");
    setProductSearchOpen(false);
    setFieldErrors((current) => ({ ...current, lines: "" }));
  }

  function updateLineQuantity(lineKey: string, value: string) {
    if (!/^\d+$/.test(value)) return;

    const qty = Number(value);
    if (!Number.isSafeInteger(qty) || qty < 1) return;

    setLines((current) =>
      current.map((line) => (line.key === lineKey ? { ...line, qty } : line))
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextFieldErrors: Record<string, string> = {};

    if (!customerId) {
      nextFieldErrors.customer = "Vui lòng chọn khách hàng.";
    } else if (orderType === "dat_hang" && isWalkIn) {
      nextFieldErrors.customer = "Đơn đặt hàng cần chọn hồ sơ khách hàng cụ thể (không áp dụng khách lẻ).";
    }

    if (orderType === "dat_hang") {
      if (!deliveryDate) {
        nextFieldErrors.deliveryDate = "Vui lòng chọn hạn giao hàng.";
      } else if (orderDate && deliveryDate < orderDate) {
        nextFieldErrors.deliveryDate = "Hạn giao hàng không được trước ngày đặt hàng.";
      }
    }

    if (!lines.length) {
      nextFieldErrors.lines = "Vui lòng thêm ít nhất một sản phẩm vào đơn hàng.";
    } else if (lines.some((line) => !Number.isSafeInteger(line.qty) || line.qty < 1)) {
      nextFieldErrors.lines = "Số lượng sản phẩm phải là số nguyên từ 1 trở lên.";
    }

    if (orderType === "ban_nhanh" && deliveryEnabled) {
      if (!deliveryPhone.trim()) nextFieldErrors.deliveryPhone = "Vui lòng nhập số điện thoại giao hàng.";
      if (!deliveryAddress.trim()) nextFieldErrors.deliveryAddress = "Vui lòng nhập địa chỉ giao hàng.";
    }

    if (orderType === "dat_hang") {
      if (paymentAmount < 0) {
        nextFieldErrors.paymentAmount = "Tiền cọc không được âm.";
      } else if (paymentAmount > total) {
        nextFieldErrors.paymentAmount = "Tiền cọc không được lớn hơn tổng tiền đơn hàng.";
      }
    } else if (orderType === "ban_nhanh") {
      if (isWalkIn && paymentAmount < total) {
        nextFieldErrors.paymentAmount = "Khách lẻ cần thanh toán đủ tổng đơn. Vui lòng chọn khách hàng nếu muốn ghi công nợ.";
      } else if (paymentMethod !== "tien_mat" && paymentAmount > total) {
        nextFieldErrors.paymentAmount = "Số tiền thanh toán không được lớn hơn tổng đơn khi không thanh toán tiền mặt.";
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      if (nextFieldErrors.customer) {
        customerInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        customerInputRef.current?.focus();
      } else if (nextFieldErrors.deliveryDate) {
        deliveryDateInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        deliveryDateInputRef.current?.focus();
      } else if (nextFieldErrors.lines) {
        productSearchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        productSearchInputRef.current?.focus();
      } else if (nextFieldErrors.deliveryPhone) {
        deliveryPhoneInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        deliveryPhoneInputRef.current?.focus();
      } else if (nextFieldErrors.deliveryAddress) {
        deliveryAddressInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        deliveryAddressInputRef.current?.focus();
      } else if (nextFieldErrors.paymentAmount) {
        paymentAmountInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        paymentAmountInputRef.current?.focus();
      }
      return;
    }

    if (paymentAmount > 0 && !receiptPreviewAccepted) {
      setReceiptPreviewOpen(true);
      return;
    }
    setReceiptPreviewAccepted(false);
    setSaving(true);
    try {
      const { id, ma_don_hang } = await taoDonHang({
        khach_hang_id: customerId,
        loai_don_hang: orderType,
        ngay_dat: orderType === "ban_nhanh" ? "" : orderDate,
        han_giao: orderType === "dat_hang" ? deliveryDate : "",
        giam_gia: Number(discount),
        phi_van_chuyen: Number(shipping),
        ghi_chu: note,
        so_tien_thanh_toan: Number(paymentAmount),
        phuong_thuc_thanh_toan: paymentMethod,
        giao_hang: orderType === "ban_nhanh" && deliveryEnabled,
        so_dien_thoai_giao_hang: deliveryEnabled ? deliveryPhone.trim() : "",
        dia_chi_giao_hang: deliveryEnabled ? deliveryAddress.trim() : "",
        chi_tiet: lines.map((line) => ({ san_pham_id: line.sanPhamId, bien_the_san_pham_id: line.variantId, so_luong: Number(line.qty), don_gia: Number(line.price), gia_goc: Number(line.basePrice), gia_da_chinh_sua_thu_cong: line.manual })),
      });
      const successMessage = ma_don_hang ? `Đã tạo đơn hàng ${ma_don_hang} thành công.` : "Đã tạo đơn hàng thành công.";
      if (orderType === "ban_nhanh" && onPosComplete) {
        notifyOrder({ type: "success", message: successMessage });
        onPosComplete();
      } else {
        setPendingOrderNotification({ type: "success", message: successMessage });
        router.push(`/danh-sach-don-hang/${id}`);
      }
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không thể tạo đơn hàng.";
      setError(message);
      notifyOrder({ type: "error", message });
    } finally { setSaving(false); setReceiptPreviewAccepted(false); }
  }

  const pos = orderType === "ban_nhanh";
  const inputId = (base: string) => pos && posInstanceId !== undefined ? `${base}-${posInstanceId}` : base;
  const lineInputClass = pos ? "h-10 w-full min-w-0 rounded-none border-0 border-b border-slate-300 bg-transparent px-1 text-sm shadow-none focus-visible:border-primary focus-visible:ring-0" : "";
  const posFieldRowClass = "md:col-span-2 grid grid-cols-[165px_minmax(0,1fr)] items-center gap-x-3 text-sm font-medium";
  const hasPosHeader = Boolean(posTabsHeader);

  useEffect(() => {
    if (!pos || !hasPosHeader) {
      const timer = setTimeout(() => setPosHeaderTarget(null), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setPosHeaderTarget(document.getElementById("fast-sale-header-slot"));
    }, 0);
    return () => clearTimeout(timer);
  }, [pos, hasPosHeader]);

  return <><form ref={formRef} onSubmit={submit} className="space-y-4">
    {!onPosComplete && <OrderNotificationToast />}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {pos && posHeaderTarget && hasPosHeader && createPortal(<div className="flex h-[54px] min-w-0 flex-1 items-center gap-3">
      <div className="relative w-[38%] min-w-32 shrink-0">
        <Search aria-hidden="true" className="app-search-icon" />
        <Input id={inputId("product-search-input")} ref={productSearchInputRef} value={productSearch} onFocus={() => setProductSearchOpen(true)} onClick={() => setProductSearchOpen(true)} onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 200)} onChange={(event) => { setProductSearch(event.target.value); setProductSearchOpen(true); if (fieldErrors.lines) setFieldErrors((current) => ({ ...current, lines: "" })); }} placeholder="Thêm sản phẩm (F3)" autoComplete="off" aria-label="Tìm mã, SKU hoặc tên sản phẩm" className="app-search-input text-sm placeholder:text-slate-400" />
        {fieldErrors.lines && <p className="absolute left-0 top-full z-40 mt-1 whitespace-nowrap rounded bg-white px-2 py-1 text-xs text-red-500 shadow">{fieldErrors.lines}</p>}
        {productSearchOpen && <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 min-w-64 overflow-y-auto rounded-lg border bg-white py-1 text-slate-900 shadow-lg">{productMatches.map(({ product, variant, label }) => <button type="button" key={variant?.id ?? product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addLine(product, variant)} className="block w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"><span className="block font-medium text-slate-900">{label}</span><span className="text-xs text-slate-500">{formatCurrency(Number(variant?.gia_ban ?? product.gia_ban))} · {product.don_vi_tinh}</span></button>)}{productMatches.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy sản phẩm phù hợp.</p>}</div>}
      </div>
      {posTabsHeader}
    </div>, posHeaderTarget)}
    <div className={pos ? "grid items-start gap-x-2 gap-y-0 lg:h-[calc(100vh-54px)] lg:min-h-[calc(100vh-54px)] lg:items-stretch lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.4fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)]" : "space-y-4"}>
    <section className={`grid ${pos ? "gap-1 p-3 pb-0 md:p-4 md:pb-0" : "gap-3 p-4"} border bg-white ${pos ? "grid-cols-1 order-3 rounded-none border-x border-t border-b-0 lg:col-start-2 lg:row-start-1" : "rounded-xl md:grid-cols-2"}`}>
      <div className={pos ? "relative min-w-0 md:col-span-2" : "relative grid gap-1.5 text-sm font-medium"}>
        {!pos && <label htmlFor={inputId("customer-input")} className="flex items-center gap-1 whitespace-nowrap">Khách hàng <span className="text-red-500">*</span></label>}
        <div className="relative min-w-0">
          <Search aria-hidden="true" className={pos ? "app-search-icon app-search-icon--toolbar" : "app-search-icon"} />
          <Input
            id={inputId("customer-input")}
            ref={customerInputRef}
            value={customerSearch}
            aria-label={pos ? "Khách hàng" : undefined}
            onFocus={() => setCustomerSearchOpen(true)}
            onClick={() => setCustomerSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setCustomerSearchOpen(false), 200)}
            onChange={(event) => {
              const value = event.target.value;
              changeCustomer("");
              setCustomerSearch(value);
              setCustomerSearchOpen(true);
              if (fieldErrors.customer) setFieldErrors((current) => ({ ...current, customer: "" }));
            }}
            placeholder="Chọn hoặc gõ tìm khách hàng..."
            autoComplete="off"
            className={`${pos ? "h-[15px] w-full min-w-0 rounded-none border-0 bg-transparent pl-5 pr-1 text-sm shadow-none focus-visible:ring-0" : "app-search-input"} ${fieldErrors.customer ? "app-search-input--error" : ""}`}
          />
          {fieldErrors.customer && <p className="text-xs text-red-500">{fieldErrors.customer}</p>}
          {customerSearchOpen && customerMatches.length > 0 && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">{customerMatches.map((item) => <button type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => changeCustomer(item.id)} className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${customerId === item.id ? "bg-primary/10 font-medium text-primary" : ""}`}><div className="flex items-center justify-between"><span className="font-medium">{item.ten_khach_hang}</span><span className="text-xs text-slate-500">{item.ma_khach_hang}</span></div>{item.so_dien_thoai && <div className="text-xs text-slate-400">SĐT: {item.so_dien_thoai}</div>}</button>)}</div>}
        </div>
      </div>
      {pos && <div aria-hidden="true" className="md:col-span-2 border-t border-slate-200" />}
      {orderType === "dat_hang" && <label className="grid gap-1.5 text-sm font-medium">
        <span className="flex items-center gap-1">Ngày đặt <span className="text-red-500">*</span></span>
        <Input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required />
      </label>}
      {orderType === "dat_hang" && (
        <div className="grid gap-1.5 text-sm font-medium">
          <label htmlFor={inputId("delivery-date-input")} className="flex items-center gap-1">Hạn giao <span className="text-red-500">*</span></label>
          <Input
            id={inputId("delivery-date-input")}
            ref={deliveryDateInputRef}
            type="date"
            value={deliveryDate}
            min={orderDate}
            onChange={(event) => {
              setDeliveryDate(event.target.value);
              if (fieldErrors.deliveryDate) setFieldErrors((current) => ({ ...current, deliveryDate: "" }));
            }}
            className={fieldErrors.deliveryDate ? "border-red-500 focus-visible:ring-red-200" : ""}
          />
          {fieldErrors.deliveryDate && <p className="text-xs text-red-500">{fieldErrors.deliveryDate}</p>}
        </div>
      )}
      {orderType === "dat_hang" && <label className="grid gap-1.5 text-sm font-medium">Ghi chú<Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} /></label>}
      {pos && <>
        <div className="md:col-span-2 grid grid-cols-[165px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm leading-5">
          <span className="whitespace-nowrap font-medium">Giao hàng</span>
          <button type="button" role="switch" aria-label="Giao hàng" aria-checked={deliveryEnabled} onClick={() => { if (deliveryEnabled) setShipping(0); setDeliveryEnabled((current) => !current); }} className="h-5 justify-self-start inline-flex items-center rounded-lg p-0 text-sm leading-5 font-medium text-slate-700 transition">
            <span className={`relative h-5 w-9 rounded-full transition-colors ${deliveryEnabled ? "bg-primary" : "bg-slate-300"}`}>
            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${deliveryEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </span>
          </button>
        </div>
        {deliveryEnabled && <div className={`md:col-span-2 grid ${pos ? "grid-cols-1 gap-2" : "gap-3 md:grid-cols-2"}`}>
          <p className={pos ? "text-xs font-semibold uppercase tracking-wide text-slate-500" : "md:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500"}>Thông tin giao hàng</p>
          <label className={pos ? posFieldRowClass : "grid gap-1.5 text-sm font-medium"}>
            <span className="whitespace-nowrap">Số điện thoại</span>
            <span><Input ref={deliveryPhoneInputRef} type="tel" inputMode="tel" autoComplete="tel" value={deliveryPhone} onChange={(event) => { setDeliveryPhone(event.target.value); if (fieldErrors.deliveryPhone) setFieldErrors((current) => ({ ...current, deliveryPhone: "" })); }} aria-invalid={Boolean(fieldErrors.deliveryPhone)} className={`${lineInputClass} ${fieldErrors.deliveryPhone ? "border-red-500" : ""}`} />
            {fieldErrors.deliveryPhone && <span className="text-xs font-normal text-red-600">{fieldErrors.deliveryPhone}</span>}</span>
          </label>
          <label className={pos ? posFieldRowClass : "grid gap-1.5 text-sm font-medium md:col-span-2"}>
            <span className="whitespace-nowrap">Địa chỉ giao hàng</span>
            <span><Input ref={deliveryAddressInputRef} autoComplete="street-address" value={deliveryAddress} onChange={(event) => { setDeliveryAddress(event.target.value); if (fieldErrors.deliveryAddress) setFieldErrors((current) => ({ ...current, deliveryAddress: "" })); }} aria-invalid={Boolean(fieldErrors.deliveryAddress)} className={`${lineInputClass} ${fieldErrors.deliveryAddress ? "border-red-500" : ""}`} />
            {fieldErrors.deliveryAddress && <span className="text-xs font-normal text-red-600">{fieldErrors.deliveryAddress}</span>}</span>
          </label>
        </div>}
        <div aria-hidden="true" className="md:col-span-2 border-t border-slate-200" />
      </>}
    </section>
    <section className={`${pos ? "rounded-none border bg-white order-2 lg:col-start-1 lg:row-start-1 lg:row-span-3 lg:flex lg:flex-col" : "rounded-xl border bg-white"}`}>
      {!pos && <div className="border-b p-4"><h2 className="font-semibold">Sản phẩm trong đơn</h2></div>}
      {!pos && <div className="p-4">
        <div className="relative grid gap-1.5 text-sm font-medium">
          <label htmlFor={inputId("product-search-input")} className="flex items-center gap-1">{pos ? "Tìm mã, SKU hoặc tên sản phẩm" : "Tìm sản phẩm"} <span className="text-red-500">*</span></label>
          <Search aria-hidden="true" className="app-search-icon" />
          <Input
            id={inputId("product-search-input")}
            ref={productSearchInputRef}
            value={productSearch}
            onFocus={() => setProductSearchOpen(true)}
            onClick={() => setProductSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 200)}
            onChange={(event) => {
              setProductSearch(event.target.value);
              setProductSearchOpen(true);
              if (fieldErrors.lines) setFieldErrors((current) => ({ ...current, lines: "" }));
            }}
            placeholder={pos ? "Nhập mã sản phẩm, SKU hoặc tên…" : "Chọn hoặc gõ mã, SKU, tên sản phẩm..."}
            autoComplete="off"
            className={fieldErrors.lines ? "app-search-input app-search-input--error" : "app-search-input"}
          />
          {fieldErrors.lines && <p className="text-xs text-red-500">{fieldErrors.lines}</p>}
          {productSearchOpen && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">{productMatches.map(({ product, variant, label }) => <button type="button" key={variant?.id ?? product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addLine(product, variant)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="block font-medium">{label}</span><span className="text-xs text-slate-500">{formatCurrency(Number(variant?.gia_ban ?? product.gia_ban))} · {product.don_vi_tinh}</span></button>)}{productMatches.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy sản phẩm phù hợp.</p>}</div>}
        </div>
      </div>}
      {/* Desktop Table View */}
      <div className={pos ? "hidden overflow-x-auto px-3 pb-3 lg:flex lg:flex-1 lg:flex-col" : "hidden overflow-x-auto px-4 pb-4 md:block"}>
        {(!pos || lines.length > 0) && <table className={pos ? "w-full min-w-[900px] table-fixed text-left text-sm" : "w-full min-w-[700px] text-left text-sm"}>
          <thead className={pos ? "bg-white text-xs text-black" : "bg-slate-50 text-xs text-slate-500"}>
            <tr>
              {pos && <th className="w-20 px-2 py-2 text-center">STT</th>}
              {pos && <th className="w-16 px-2 py-2">Ảnh SP</th>}
              {pos && <th className="w-24 px-2 py-2">Mã SKU</th>}
              <th className="px-3 py-2">Sản phẩm / biến thể</th>
              {pos && <th className="w-24 px-2 py-2">Đơn vị</th>}
              <th className={pos ? "w-24 px-2 py-2 text-center" : "px-3 py-2"}>Số lượng</th>
              <th className={pos ? "w-32 px-2 py-2 text-right" : "px-3 py-2 text-right"}>Đơn giá</th>
              <th className={pos ? "w-36 px-3 py-2 text-right" : "px-3 py-2 text-right"}>Thành tiền</th>
              {!pos && <th />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line) => (
              <tr
                key={line.key}
                className={highlightedKey === line.key ? "bg-amber-100/60 transition-colors duration-500" : "transition-colors duration-500"}
              >
                {pos && <td className="px-2 py-3 text-center"><div className="flex items-center justify-center gap-1"><span className="text-xs text-slate-500">{lines.indexOf(line) + 1}</span><Button type="button" size="icon" variant="ghost" aria-label={`Xóa ${line.label}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></div></td>}
                {pos && <td className="px-2 py-3"><div aria-label="Chưa có ảnh sản phẩm" className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-300"><ImageIcon className="h-5 w-5" /></div></td>}
                {pos && <td className="px-2 py-3 text-xs text-slate-600">{line.sku}</td>}
                <td className="max-w-md px-3 py-3 font-medium"><div className="truncate">{pos ? line.productName : line.label}</div>{pos && <div className="mt-0.5 truncate text-xs font-normal text-slate-500">{line.detail}</div>}</td>
                {pos && <td className="px-2 py-3 text-sm text-slate-600">{products.find((product) => product.id === line.sanPhamId)?.don_vi_tinh ?? "—"}</td>}
                <td className="pl-3 pr-1 py-3">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={line.qty}
                    onChange={(event) => updateLineQuantity(line.key, event.target.value)}
                    className={pos ? "h-9 w-16 rounded-none border-0 border-b border-slate-300 bg-transparent px-1 text-center shadow-none focus-visible:border-primary focus-visible:ring-0" : "w-28"}
                  />
                </td>
                <td className="pl-1 pr-3 py-3">
                  <div className={pos ? "flex min-w-20 items-center gap-2 rounded-none border-0 border-b border-slate-300 px-0 focus-within:border-primary focus-within:ring-0" : "flex min-w-44 items-center gap-2 rounded-lg border border-input px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"}>
                    {line.manual && <span className="shrink-0 text-xs text-slate-500 line-through">{formatCurrency(line.basePrice)}</span>}
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(line.price)}
                      aria-label={`Đơn giá ${line.label}`}
                      onChange={(event) => {
                        const price = parseCurrencyInput(event.target.value);
                        setLines((current) =>
                          current.map((item) => (item.key === line.key ? { ...item, price, manual: price !== item.basePrice } : item))
                        );
                      }}
                      className="h-9 border-0 px-0 text-right shadow-none focus-visible:ring-0"
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">{formatCurrency(line.qty * line.price)}</td>
                {!pos && <td className="px-3 py-3">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Xóa ${line.label}`}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </td>}
              </tr>
            ))}
            {!pos && !lines.length && (
              <tr>
                <td colSpan={pos ? 8 : 5} className="py-8 text-center text-slate-500">
                  Chưa có sản phẩm trong đơn.
                </td>
              </tr>
            )}
          </tbody>
        </table>}
        {pos && !lines.length && <div className="flex flex-1 items-center justify-center text-center text-slate-500">Chưa có sản phẩm trong đơn.</div>}
      </div>

      {/* Mobile Card View */}
      <div className={pos ? "divide-y divide-slate-100 px-4 pb-4 lg:hidden" : "md:hidden divide-y divide-slate-100 px-4 pb-4"}>
        {lines.map((line) => (
          <div
            key={line.key}
            className={`py-3 space-y-2 rounded-lg ${
              highlightedKey === line.key ? "bg-amber-100/60 p-2.5 transition-colors duration-500" : ""
            }`}
          >
            {/* Tên sản phẩm & nút xóa */}
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-sm text-slate-900 leading-snug">
                {line.label}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Xóa ${line.label}`}
                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Ô nhập số lượng & đơn giá */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Số lượng</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={line.qty}
                  onChange={(event) => updateLineQuantity(line.key, event.target.value)}
                  className={pos ? "h-9 w-full rounded-none border-0 border-b border-slate-300 bg-transparent px-1 shadow-none focus-visible:border-primary focus-visible:ring-0" : "h-9 w-full"}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Đơn giá</label>
                <div className={pos ? "flex h-9 items-center gap-2 rounded-none border-0 border-b border-slate-300 px-0 focus-within:border-primary focus-within:ring-0" : "flex h-9 items-center gap-2 rounded-md border border-input px-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"}>
                  {line.manual && <span className="shrink-0 text-xs text-slate-400 line-through">{formatCurrency(line.basePrice)}</span>}
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(line.price)}
                    aria-label={`Đơn giá ${line.label}`}
                    onChange={(event) => {
                      const price = parseCurrencyInput(event.target.value);
                      setLines((current) =>
                        current.map((item) => (item.key === line.key ? { ...item, price, manual: price !== item.basePrice } : item))
                      );
                    }}
                    className="h-8 min-w-0 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>

            {/* Thành tiền */}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span>Thành tiền:</span>
              <span className="font-semibold text-sm text-slate-900">
                {formatCurrency(line.qty * line.price)}
              </span>
            </div>
          </div>
        ))}

        {!lines.length && (
          <div className="py-8 text-center text-sm text-slate-500">
            Chưa có sản phẩm trong đơn.
          </div>
        )}
      </div>

    </section>
    <section className={`grid ${pos ? "gap-1 p-3 pt-1 pb-1 md:p-4 md:pt-1 md:pb-1" : "gap-4 p-4"} border bg-white md:grid-cols-2 ${pos ? "order-4 rounded-none border-x border-y-0 lg:col-start-2 lg:row-start-2" : "rounded-xl"}`}>
      <label className={pos ? `${posFieldRowClass} !text-sm !leading-5` : "grid gap-1.5 text-sm font-medium"}><span className={pos ? "whitespace-nowrap" : ""}>Giảm giá</span>{pos ? <span className="relative min-w-0"><Input type="text" inputMode="numeric" value={formatNumber(discount)} onChange={(event) => setDiscount(parseCurrencyInput(event.target.value))} className={`${lineInputClass} h-5 !text-sm !leading-5 pr-6 text-right`} /><span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500">₫</span></span> : <Input type="text" inputMode="numeric" value={formatNumber(discount)} onChange={(event) => setDiscount(parseCurrencyInput(event.target.value))} className={lineInputClass} />}</label>
      {(!pos || deliveryEnabled) && <label className={pos ? posFieldRowClass : "grid gap-1.5 text-sm font-medium"}><span className={pos ? "whitespace-nowrap" : ""}>Phí vận chuyển</span><Input type="text" inputMode="numeric" value={formatNumber(shipping)} onChange={(event) => setShipping(parseCurrencyInput(event.target.value))} className={lineInputClass} /></label>}
      <div className={`md:col-span-2 flex flex-col text-sm ${pos ? "gap-1" : "gap-2"}`}>{!pos && <><div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div><div className="flex justify-between"><span>Giảm giá</span><span>−{formatCurrency(Number(discount) || 0)}</span></div></>}{(!pos || deliveryEnabled) && <div className="flex justify-between"><span>Phí vận chuyển</span><span>{formatCurrency(Number(shipping) || 0)}</span></div>}<div className={`flex justify-between font-semibold ${pos ? "h-5 items-center text-sm leading-5" : ""}`}><span>Tổng tiền</span>{pos ? <span className="relative ml-auto block w-32 shrink-0 pr-6 text-right text-sm"><span>{formatNumber(total)}</span><span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500">₫</span></span> : <strong className="text-lg">{formatCurrency(total)}</strong>}</div></div>
    </section>
    <section className={`grid ${pos ? "gap-2 p-3 md:p-4 pt-1 lg:flex lg:flex-col" : "gap-4 p-4"} border bg-white md:grid-cols-2 ${pos ? "order-5 rounded-none border-x border-t-0 lg:col-start-2 lg:row-start-3" : "rounded-xl"}`}>
      <div className={pos ? "grid gap-2 md:grid-cols-2" : "contents"}>
      <div className={pos ? `${posFieldRowClass} !text-sm !leading-5` : "grid gap-1.5 text-sm font-medium"}>
        <label htmlFor={inputId("payment-amount-input")} className={pos ? "whitespace-nowrap" : ""}>{orderType === "dat_hang" ? "Tiền cọc" : "Khách đưa"}</label>
        <div className="min-w-0"><span className="relative block min-w-0"><Input
          id={inputId("payment-amount-input")}
          ref={paymentAmountInputRef}
          type="text"
          inputMode="numeric"
          value={formatNumber(paymentAmount)}
          onChange={(event) => {
            setPaymentAmountOverride(parseCurrencyInput(event.target.value));
            if (fieldErrors.paymentAmount) setFieldErrors((current) => ({ ...current, paymentAmount: "" }));
          }}
          className={`${lineInputClass} ${pos ? "h-5 !text-sm !leading-5 pr-6 text-right" : ""} ${fieldErrors.paymentAmount ? "border-red-500 focus-visible:ring-red-200" : ""}`}
        />{pos && <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500">₫</span>}</span>
        {fieldErrors.paymentAmount && <p className="text-xs text-red-500">{fieldErrors.paymentAmount}</p>}</div>
      </div>
      <label className={pos ? `${posFieldRowClass} !text-sm !leading-5` : "grid gap-1.5 text-sm font-medium"}><span className={pos ? "whitespace-nowrap" : ""}>Phương thức thanh toán</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={`${pos ? `${lineInputClass} h-5 cursor-pointer !text-sm !leading-5 font-normal outline-none` : "h-10 rounded-md border border-slate-200 bg-white px-3 font-normal"}`}><option value="tien_mat">Tiền mặt</option><option value="chuyen_khoan">Chuyển khoản</option><option value="the">Thẻ</option><option value="vi_dien_tu">Ví điện tử</option><option value="khac">Khác</option></select></label>
      {orderType === "ban_nhanh" && <div className={`md:col-span-2 flex justify-between ${pos ? "h-5 items-center text-sm leading-5" : "text-sm"}`}><span>{paymentAmount < total ? "Còn nợ" : "Tiền thừa trả khách"}</span>{pos ? <span className="relative ml-auto block w-32 shrink-0 pr-6 text-right"><span>{formatNumber(paymentAmount < total ? total - paymentAmount : changeDue)}</span><span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-500">₫</span></span> : <strong>{formatCurrency(paymentAmount < total ? total - paymentAmount : changeDue)}</strong>}</div>}
      {orderType === "dat_hang" && <p className="md:col-span-2 text-sm text-slate-500">Đơn đặt hàng có thể đặt cọc hoặc không cọc (0đ); phần còn lại sẽ thu khi giao hàng / hoàn tất đơn.</p>}
      </div>
      {pos && <div className="mt-auto flex flex-col gap-1">
        <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Nhập nội dung ghi chú" aria-label="Ghi chú đơn hàng" className={lineInputClass} />
        <Button type="submit" disabled={saving || lines.length === 0} className="h-11 w-full"><Save className="mr-2 h-4 w-4" />{saving ? "Đang lưu..." : "Hoàn tất thanh toán"}</Button>
      </div>}
    </section>
    {!pos && <div className="app-form-actions"><Button type="button" variant="outline" onClick={() => router.push("/danh-sach-don-hang")} disabled={saving}>Hủy</Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Đang lưu..." : "Tạo đơn hàng"}</Button></div>}
    </div>
  </form>
  <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
    <DialogContent className="md:max-w-md">
      <DialogHeader><DialogTitle>Xem trước phiếu thu</DialogTitle><DialogDescription>Kiểm tra khoản thu trước khi lưu đơn. Phiếu thu sẽ được tạo và phân bổ vào đơn này sau khi xác nhận.</DialogDescription></DialogHeader>
      <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-3"><span>Khách hàng</span><strong className="text-right">{customer?.ten_khach_hang ?? "—"}</strong></div>
        <div className="flex justify-between"><span>Loại đơn</span><strong>{orderType === "ban_nhanh" ? "Bán nhanh" : "Đơn đặt hàng"}</strong></div>
        <div className="flex justify-between"><span>Tổng tiền đơn</span><strong>{formatCurrency(total)}</strong></div>
        <div className="flex justify-between"><span>Tiền ghi nhận trên phiếu thu</span><strong>{formatCurrency(Math.min(paymentAmount, total))}</strong></div>
        <div className="flex justify-between"><span>Phương thức</span><strong>{paymentMethod === "tien_mat" ? "Tiền mặt" : paymentMethod === "chuyen_khoan" ? "Chuyển khoản" : paymentMethod === "the" ? "Thẻ" : paymentMethod === "vi_dien_tu" ? "Ví điện tử" : "Khác"}</strong></div>
        {orderType === "dat_hang" && <div className="flex justify-between"><span>Phần còn thu sau</span><strong>{formatCurrency(Math.max(0, total - paymentAmount))}</strong></div>}
        {orderType === "ban_nhanh" && paymentAmount > total && <div className="flex justify-between"><span>Tiền thừa trả khách</span><strong>{formatCurrency(paymentAmount - total)}</strong></div>}
        <p className="border-t pt-2 text-xs text-slate-500">Mã phiếu thu THPT sẽ được cấp tự động khi lưu.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setReceiptPreviewOpen(false)} disabled={saving}>Quay lại chỉnh sửa</Button>
        <Button type="button" disabled={saving} onClick={() => {
          setReceiptPreviewOpen(false);
          setReceiptPreviewAccepted(true);
          window.setTimeout(() => formRef.current?.requestSubmit(), 0);
        }}>{saving ? "Đang lưu..." : "Xác nhận và lưu đơn"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog></>;
}













