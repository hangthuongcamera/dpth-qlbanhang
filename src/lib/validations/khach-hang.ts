import { z } from "zod";

export const soDienThoaiSchema = z
  .string()
  .trim()
  .max(20, "Số điện thoại không hợp lệ")
  .refine((value) => {
    if (!value) return true;
    const digitCount = value.replace(/\D/g, "").length;
    return /^\+?[0-9][0-9 ()-]*[0-9]$/.test(value)
      && digitCount >= 7
      && digitCount <= 15;
  }, "Số điện thoại cần có 7–15 chữ số; chỉ dùng số, dấu +, khoảng trắng, dấu gạch ngang hoặc ngoặc");

export const khachHangSchema = z.object({
  ten_khach_hang: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên khách hàng")
    .max(255, "Tên khách hàng quá dài"),

  so_dien_thoai: soDienThoaiSchema
    .optional()
    .or(z.literal("")),

  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("")),

  dia_chi: z
    .string()
    .trim()
    .max(500, "Địa chỉ quá dài")
    .optional()
    .or(z.literal("")),

  ma_so_thue: z
    .string()
    .trim()
    .max(50, "Mã số thuế quá dài")
    .optional()
    .or(z.literal("")),

  nguoi_lien_he: z
    .string()
    .trim()
    .max(255, "Tên người liên hệ quá dài")
    .optional()
    .or(z.literal("")),

  han_muc_cong_no: z
    .number()
    .int("Hạn mức công nợ phải là số nguyên VND")
    .min(0, "Hạn mức công nợ không được âm"),

  ghi_chu: z
    .string()
    .trim()
    .max(1000, "Ghi chú quá dài")
    .optional()
    .or(z.literal("")),

  trang_thai: z.boolean(),

  nhom_khach_hang_id: z.union([z.literal(""), z.string().uuid()]).optional(),

  anh_dai_dien_url: z.string().optional(),
});

export type KhachHangSchema = z.infer<typeof khachHangSchema>;

