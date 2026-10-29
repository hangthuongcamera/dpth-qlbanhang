"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type OrderNotification = {
  type: "success" | "error";
  message: string;
} | null;

export const ORDER_NOTIFICATION_EVENT = "order-notification";

export function notifyOrder(notification: { type: "success" | "error"; message: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ORDER_NOTIFICATION_EVENT, { detail: notification }));
}

export function setPendingOrderNotification(notification: { type: "success" | "error"; message: string }) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("don-hang-notification", JSON.stringify(notification));
  } catch (error) {
    console.error("Failed to store notification in sessionStorage:", error);
  }
}

export function OrderNotificationToast() {
  const [notification, setNotification] = useState<OrderNotification>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const stored = sessionStorage.getItem("don-hang-notification");
        if (stored) {
          sessionStorage.removeItem("don-hang-notification");
          setNotification(JSON.parse(stored) as OrderNotification);
        }
      } catch {
        setNotification(null);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    function handleNotification(event: Event) {
      const customEvent = event as CustomEvent<OrderNotification>;
      if (customEvent.detail) {
        setNotification(customEvent.detail);
      }
    }

    window.addEventListener(ORDER_NOTIFICATION_EVENT, handleNotification);
    return () => window.removeEventListener(ORDER_NOTIFICATION_EVENT, handleNotification);
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeoutId = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timeoutId);
  }, [notification]);

  if (!notification) return null;

  return (
    <div
      role={notification.type === "success" ? "status" : "alert"}
      aria-live={notification.type === "success" ? "polite" : "assertive"}
      className={`app-mobile-toast fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300 ${
        notification.type === "success" ? "border-emerald-200" : "border-red-200"
      }`}
    >
      {notification.type === "success" ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      )}
      <p className={`flex-1 text-sm ${notification.type === "success" ? "text-emerald-800" : "text-red-700"}`}>
        {notification.message}
      </p>
      <button
        type="button"
        onClick={() => setNotification(null)}
        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Đóng thông báo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
