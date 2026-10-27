"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, ImagePlus, Save, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  khachHangSchema,
  soDienThoaiSchema,
  type KhachHangSchema,
} from "@/lib/validations/khach-hang";

import {
  createKhachHang,
  kiemTraSoDienThoai,
  updateKhachHang,
} from "@/lib/supabase/khach-hang-actions";

import type { KhachHang } from "@/types/khach-hang";
import type { NhomKhachHangOption } from "@/types/khach-hang";

interface CustomerFormProps {
  mode?: "create" | "edit";
  customer?: KhachHang;
  groups: NhomKhachHangOption[];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function CustomerForm({
  mode = "create",
  customer,
  groups,
}: CustomerFormProps) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<
    "idle" | "checking" | "available" | "duplicate" | "error"
  >("idle");
  const [isPhoneComposing, setIsPhoneComposing] = useState(false);
  const phoneCheckRequest = useRef(0);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!submitError) return;
    const timeoutId = setTimeout(() => setSubmitError(""), 4000);
    return () => clearTimeout(timeoutId);
  }, [submitError]);

  useEffect(() => {
    if (!submitSuccess) return;
    const timeoutId = setTimeout(() => setSubmitSuccess(""), 4000);
    return () => clearTimeout(timeoutId);
  }, [submitSuccess]);

  const form = useForm<KhachHangSchema>({
    resolver: zodResolver(khachHangSchema),
    defaultValues: {
      ten_khach_hang: customer?.ten_khach_hang ?? "",
      so_dien_thoai: customer?.so_dien_thoai ?? "",
      email: customer?.email ?? "",
      dia_chi: customer?.dia_chi ?? "",
      ma_so_thue: customer?.ma_so_thue ?? "",
      nguoi_lien_he: customer?.nguoi_lien_he ?? "",
      han_muc_cong_no: customer?.han_muc_cong_no ?? 0,
      ghi_chu: customer?.ghi_chu ?? "",
      trang_thai: customer?.trang_thai ?? true,
      nhom_khach_hang_id: customer?.nhom_khach_hang_id ?? "",
      anh_dai_dien_url: customer?.anh_dai_dien_url ?? "",
    },
  });

  const phoneRegistration = form.register("so_dien_thoai");
  const phoneValue = form.watch("so_dien_thoai") ?? "";

  useEffect(() => {
    const requestId = ++phoneCheckRequest.current;
    if (
      isPhoneComposing
      || !phoneValue.trim()
      || !soDienThoaiSchema.safeParse(phoneValue).success
    ) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setPhoneCheckStatus("checking");
      try {
        const isDuplicate = await kiemTraSoDienThoai(phoneValue, customer?.id);
        if (requestId === phoneCheckRequest.current) {
          setPhoneCheckStatus(isDuplicate ? "duplicate" : "available");
        }
      } catch (error) {
        console.error("kiemTraSoDienThoai:", error);
        if (requestId === phoneCheckRequest.current) {
          setPhoneCheckStatus("error");
        }
      }
    }, 650);

    return () => {
      clearTimeout(timeoutId);
      phoneCheckRequest.current += 1;
    };
  }, [phoneValue, isPhoneComposing, customer?.id]);

  const onSubmit = async (data: KhachHangSchema) => {
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const payload = {
        ten_khach_hang: data.ten_khach_hang,
        so_dien_thoai: data.so_dien_thoai,
        email: data.email,
        dia_chi: data.dia_chi,
        ma_so_thue: data.ma_so_thue,
        nguoi_lien_he: data.nguoi_lien_he,
        han_muc_cong_no: data.han_muc_cong_no,
        ghi_chu: data.ghi_chu,
        trang_thai: data.trang_thai,
        nhom_khach_hang_id: data.nhom_khach_hang_id || "",
        anh_dai_dien_url: data.anh_dai_dien_url,
      };

      const customerResult =
        mode === "edit" && customer
          ? await updateKhachHang(customer.id, payload)
          : await createKhachHang(payload);

      setSubmitSuccess(
        mode === "edit"
          ? `Đã cập nhật khách hàng ${customerResult.ma_khach_hang} thành công.`
          : `Đã thêm khách hàng ${customerResult.ma_khach_hang} thành công.`
      );

      setTimeout(() => {
        router.push("/danh-sach-khach-hang");
        router.refresh();
      }, 1800);
    } catch (error) {
      console.error(error);

      const errorMessage = error instanceof Error
        ? error.message
        : "Không thể lưu khách hàng. Vui lòng thử lại.";

      if (errorMessage === "Số điện thoại này đã được sử dụng cho một khách hàng khác.") {
        setPhoneCheckStatus("duplicate");
        setSubmitError("");
        phoneInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        phoneInputRef.current?.focus({ preventScroll: true });
      } else {
        setSubmitError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto w-full min-w-0 space-y-4 sm:space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-base font-semibold text-slate-900">
            {mode === "edit"
              ? "Chỉnh sửa thông tin khách hàng"
              : "Thông tin khách hàng"}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {mode === "edit"
              ? "Cập nhật thông tin khách hàng."
              : "Nhập thông tin cơ bản của khách hàng."}
          </p>
        </div>

        {/* Ảnh đại diện */}
        <div className="flex min-w-0 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {customer?.anh_dai_dien_url ? (
              <img
                src={customer.anh_dai_dien_url}
                alt={customer.ten_khach_hang}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImagePlus className="h-6 w-6 text-slate-400" />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">
              Ảnh đại diện
            </p>

            <p className="mt-1 text-xs text-slate-500">
              JPG, PNG hoặc WEBP
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={isSubmitting}
            >
              Chọn ảnh
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:gap-5 sm:p-5 md:grid-cols-2">
          {/* Mã khách hàng: chỉ hiển thị khi chỉnh sửa */}
          {mode === "edit" && customer && (
            <div className="space-y-2">
              <Label htmlFor="ma_khach_hang">Mã khách hàng</Label>
              <Input
                id="ma_khach_hang"
                value={customer.ma_khach_hang}
                readOnly
                className="bg-slate-50"
              />
            </div>
          )}

          {/* Tên khách hàng */}
          <div className="space-y-2">
            <Label htmlFor="ten_khach_hang">
              Tên khách hàng <span className="text-red-500">*</span>
            </Label>

            <Input
              id="ten_khach_hang"
              placeholder="Nhập tên khách hàng"
              {...form.register("ten_khach_hang")}
            />

            {form.formState.errors.ten_khach_hang && (
              <p className="text-xs text-red-500">
                {form.formState.errors.ten_khach_hang.message}
              </p>
            )}
          </div>

          {/* Số điện thoại */}
          <div className="space-y-2">
            <Label htmlFor="so_dien_thoai">Số điện thoại</Label>

            <Input
              id="so_dien_thoai"
              placeholder="Nhập số điện thoại"
              {...phoneRegistration}
              ref={(element) => {
                phoneRegistration.ref(element);
                phoneInputRef.current = element;
              }}
              onChange={(event) => {
                phoneRegistration.onChange(event);
                setPhoneCheckStatus("idle");
              }}
              onCompositionStart={() => {
                setIsPhoneComposing(true);
                setPhoneCheckStatus("idle");
              }}
              onCompositionEnd={(event) => {
                phoneRegistration.onChange(event);
                setIsPhoneComposing(false);
                setPhoneCheckStatus("idle");
              }}
            />

            {form.formState.errors.so_dien_thoai && (
              <p className="text-xs text-red-500">
                {form.formState.errors.so_dien_thoai.message}
              </p>
            )}
            {!form.formState.errors.so_dien_thoai && phoneCheckStatus === "checking" && (
              <p className="text-xs text-slate-500">Đang kiểm tra số điện thoại...</p>
            )}
            {!form.formState.errors.so_dien_thoai && phoneCheckStatus === "duplicate" && (
              <p className="text-xs text-red-600">
                Số điện thoại này đã được sử dụng cho một khách hàng khác.
              </p>
            )}
            {!form.formState.errors.so_dien_thoai && phoneCheckStatus === "available" && (
              <p className="text-xs text-emerald-600">Số điện thoại có thể sử dụng.</p>
            )}
            {!form.formState.errors.so_dien_thoai && phoneCheckStatus === "error" && (
              <p className="text-xs text-amber-600">
                Chưa kiểm tra được số điện thoại. Bạn vẫn có thể lưu; hệ thống sẽ kiểm tra lại.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nhom_khach_hang_id">Nhóm khách hàng</Label>
            <select
              id="nhom_khach_hang_id"
              {...form.register("nhom_khach_hang_id")}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Không thuộc nhóm (dùng giá mặc định)</option>
              {groups.filter((group) => group.trang_thai || group.id === customer?.nhom_khach_hang_id).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.ten_nhom}{group.trang_thai ? "" : " (ngừng hoạt động)"}
                </option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>

            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              {...form.register("email")}
            />

            {form.formState.errors.email && (
              <p className="text-xs text-red-500">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Người liên hệ */}
          <div className="space-y-2">
            <Label htmlFor="nguoi_lien_he">Người liên hệ</Label>

            <Input
              id="nguoi_lien_he"
              placeholder="Nhập tên người liên hệ"
              {...form.register("nguoi_lien_he")}
            />

            {form.formState.errors.nguoi_lien_he && (
              <p className="text-xs text-red-500">
                {form.formState.errors.nguoi_lien_he.message}
              </p>
            )}
          </div>

          {/* Mã số thuế */}
          <div className="space-y-2">
            <Label htmlFor="ma_so_thue">Mã số thuế</Label>

            <Input
              id="ma_so_thue"
              placeholder="Nhập mã số thuế"
              {...form.register("ma_so_thue")}
            />

            {form.formState.errors.ma_so_thue && (
              <p className="text-xs text-red-500">
                {form.formState.errors.ma_so_thue.message}
              </p>
            )}
          </div>

          {/* Hạn mức công nợ */}
          <div className="space-y-2">
            <Label htmlFor="han_muc_cong_no">
              Hạn mức công nợ
            </Label>

            <Input
              id="han_muc_cong_no"
              type="text"
              inputMode="numeric"
              value={formatNumber(
                form.watch("han_muc_cong_no") ?? 0
              )}
              onChange={(event) => {
                const rawValue = event.target.value.replace(/\D/g, "");
                const numberValue = rawValue === "" ? 0 : Number(rawValue);

                form.setValue("han_muc_cong_no", numberValue, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              placeholder="Ví dụ: 50.000.000"
            />

            {form.formState.errors.han_muc_cong_no && (
              <p className="text-xs text-red-500">
                {form.formState.errors.han_muc_cong_no.message}
              </p>
            )}
          </div>

          {/* Địa chỉ */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="dia_chi">Địa chỉ</Label>

            <Input
              id="dia_chi"
              placeholder="Nhập địa chỉ"
              {...form.register("dia_chi")}
            />

            {form.formState.errors.dia_chi && (
              <p className="text-xs text-red-500">
                {form.formState.errors.dia_chi.message}
              </p>
            )}
          </div>

          {/* Trạng thái */}
          <div className="space-y-2">
            <Label htmlFor="trang_thai">Trạng thái</Label>

            <select
              id="trang_thai"
              value={
                form.watch("trang_thai") ? "true" : "false"
              }
              onChange={(event) => {
                form.setValue(
                  "trang_thai",
                  event.target.value === "true",
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  }
                );
              }}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Ngừng hoạt động</option>
            </select>

            {form.formState.errors.trang_thai && (
              <p className="text-xs text-red-500">
                {form.formState.errors.trang_thai.message}
              </p>
            )}
          </div>

          {/* Ghi chú */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ghi_chu">Ghi chú</Label>

            <Textarea
              id="ghi_chu"
              placeholder="Nhập ghi chú..."
              rows={4}
              {...form.register("ghi_chu")}
            />

            {form.formState.errors.ghi_chu && (
              <p className="text-xs text-red-500">
                {form.formState.errors.ghi_chu.message}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Toast lỗi */}
      {submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border border-red-200 bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300"
        >
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="flex-1 text-sm text-red-700">{submitError}</p>
          <button
            type="button"
            onClick={() => setSubmitError("")}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Toast thành công */}
      {submitSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg animate-in fade-in-0 slide-in-from-top-3 duration-300"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="flex-1 text-sm text-emerald-800">{submitSuccess}</p>
          <button
            type="button"
            onClick={() => setSubmitSuccess("")}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 pb-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/danh-sach-khach-hang")}
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-full sm:w-auto" />
          Hủy
        </Button>

        <Button
          type="submit"
          disabled={isSubmitting}
        >
          <Save className="mr-2 h-4 w-full sm:w-auto" />
          {isSubmitting
            ? "Đang lưu..."
            : mode === "edit"
              ? "Lưu thay đổi"
              : "Lưu khách hàng"}
        </Button>
      </div>
    </form>
  );
}

