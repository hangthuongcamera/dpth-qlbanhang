"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { OrderCreateForm } from "@/components/don-hang/order-create-form";
import { OrderNotificationToast } from "@/components/don-hang/order-notification-toast";

type Customer = { id: string; ma_khach_hang: string; ten_khach_hang: string; so_dien_thoai?: string | null; dia_chi?: string | null; nhom_khach_hang_id: string | null; la_khach_le: boolean };
type Variant = { id: string; ma_sku: string; thuoc_tinh: Record<string, string>; gia_ban: number };
type Product = { id: string; ma_san_pham: string; ten_san_pham: string; don_vi_tinh: string; gia_ban: number; variants: Variant[] };
type Group = { id: string; ten_nhom: string; ap_dung_bang_gia: boolean };
type SaleTab = { id: number; title: string; dirty: boolean };

function newTab(id: number): SaleTab {
  return { id, title: `Khách lẻ ${id}`, dirty: false };
}

function FastSaleTabPanel({ tab, activeId, customers, products, groups, prices, tabsHeader, onCustomerChange, onDirtyChange, onComplete }: {
  tab: SaleTab;
  activeId: number;
  customers: Customer[];
  products: Product[];
  groups: Group[];
  prices: Record<string, number>;
  tabsHeader: ReactNode;
  onCustomerChange: (id: number, name: string) => void;
  onDirtyChange: (id: number, dirty: boolean) => void;
  onComplete: (id: number) => void;
}) {
  const reportDirty = useCallback((dirty: boolean) => onDirtyChange(tab.id, dirty), [onDirtyChange, tab.id]);
  const reportCustomer = useCallback((name: string) => onCustomerChange(tab.id, name), [onCustomerChange, tab.id]);
  const complete = useCallback(() => onComplete(tab.id), [onComplete, tab.id]);

  return (
    <div id={`pos-panel-${tab.id}`} role="tabpanel" aria-labelledby={`pos-tab-${tab.id}`} hidden={activeId !== tab.id}>
      <OrderCreateForm
        customers={customers}
        products={products}
        groups={groups}
        prices={prices}
        posTabsHeader={tabsHeader}
        orderType="ban_nhanh"
        posInstanceId={tab.id}
        onPosCustomerChange={reportCustomer}
        onPosDirtyChange={reportDirty}
        onPosComplete={complete}
      />
    </div>
  );
}

export function FastSalePos({ customers, products, groups, prices }: { customers: Customer[]; products: Product[]; groups: Group[]; prices: Record<string, number> }) {
  const [tabs, setTabs] = useState<SaleTab[]>(() => [newTab(1)]);
  const [activeId, setActiveId] = useState(1);
  const nextId = useRef(2);

  const updateDirty = useCallback((id: number, dirty: boolean) => {
    setTabs((current) => current.map((item) => item.id === id ? { ...item, dirty } : item));
  }, []);

  const updateCustomerTitle = useCallback((id: number, customerName: string) => {
    setTabs((current) => current.map((tab) => tab.id === id
      ? { ...tab, title: customerName === "Khách lẻ" ? `Khách lẻ ${id}` : customerName }
      : tab));
  }, []);


  useEffect(() => {
    const hasUnsavedTabs = tabs.some((tab) => tab.dirty);
    if (!hasUnsavedTabs) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [tabs]);

  function addTab() {
    const id = nextId.current++;
    setTabs((current) => [...current, newTab(id)]);
    setActiveId(id);
  }

  function closeTab(id: number, force = false) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;
    if (!force && tab.dirty && !window.confirm(`Đơn ${tab.title} đang có thông tin chưa thanh toán. Bạn có muốn đóng và bỏ đơn này không?`)) return;

    if (tabs.length === 1) {
      const fresh = newTab(nextId.current++);
      setTabs([fresh]);
      setActiveId(fresh.id);
      return;
    }

    const remaining = tabs.filter((item) => item.id !== id);
    setTabs(remaining);
    if (activeId === id) {
      const oldIndex = tabs.findIndex((item) => item.id === id);
      setActiveId(remaining[Math.max(0, oldIndex - 1)]?.id ?? remaining[0].id);
    }
  }

  function completeTab(id: number) {
    closeTab(id, true);
  }

  const tabsHeader = <div role="tablist" aria-label="Các đơn bán nhanh" className="flex h-full min-w-0 flex-1 items-stretch gap-2 overflow-x-auto">
    {tabs.map((tab) => (
      <div key={tab.id} role="presentation" className={`flex shrink-0 items-center border ${activeId === tab.id ? "h-full overflow-hidden rounded-none border-white bg-white text-slate-800" : "self-center rounded-lg border-white/30 bg-white/10 text-primary-foreground"}`}>
        <button type="button" id={`pos-tab-${tab.id}`} role="tab" aria-selected={activeId === tab.id} aria-controls={`pos-panel-${tab.id}`} onClick={() => setActiveId(tab.id)} className="max-w-52 truncate px-3 py-2 text-sm font-medium">
          {tab.title}
        </button>
        <button type="button" onClick={() => closeTab(tab.id)} aria-label={`Đóng đơn ${tab.title}`} className={`mr-1 rounded-md p-1.5 transition ${activeId === tab.id ? "text-slate-400 hover:bg-slate-100 hover:text-slate-700" : "text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"}`}>
          <X className="h-4 w-4" />
        </button>
      </div>
    ))}
    <button type="button" onClick={addTab} aria-label="Tạo đơn mới" title="Tạo đơn mới" className="inline-flex h-9 w-9 shrink-0 self-center items-center justify-center rounded-lg text-primary-foreground transition hover:bg-white/15">
      <Plus className="h-5 w-5" />
    </button>
  </div>;

  return (
    <div className="space-y-4">
      <OrderNotificationToast />
      {tabs.map((tab) => (
        <FastSaleTabPanel key={tab.id} tab={tab} activeId={activeId} customers={customers} products={products} groups={groups} prices={prices} tabsHeader={activeId === tab.id ? tabsHeader : null} onCustomerChange={updateCustomerTitle} onDirtyChange={updateDirty} onComplete={completeTab} />
      ))}
    </div>
  );
}
