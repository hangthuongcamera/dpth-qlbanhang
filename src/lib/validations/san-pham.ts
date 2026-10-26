import { z } from "zod";

const variantSchema = z.object({
  id: z.string().uuid().optional(),
  ma_sku: z.string().trim().max(100, "Mã SKU quá dài").optional().or(z.literal("")),
  thuoc_tinh: z.record(z.string(), z.string()),
  gia_ban: z.coerce.number().finite("Giá bán không hợp lệ").min(0, "Giá bán không được âm"),
  gia_nhap: z.coerce.number().finite("Giá nhập không hợp lệ").min(0, "Giá nhập không được âm"),
  trang_thai: z.boolean(),
});

export const sanPhamSchema = z.object({
  ma_san_pham: z.string().trim().max(100),
  ten_san_pham: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm").max(255),
  loai_san_pham_id: z.string().uuid("Vui lòng chọn loại sản phẩm"),
  don_vi_tinh: z.string().trim().min(1, "Vui lòng nhập đơn vị tính").max(50),
  gia_ban: z.coerce.number().finite("Giá bán không hợp lệ").min(0, "Giá bán không được âm"),
  gia_nhap: z.coerce.number().finite("Giá nhập không hợp lệ").min(0, "Giá nhập không được âm"),
  mo_ta: z.string().trim().max(2000, "Mô tả quá dài").optional().or(z.literal("")),
  trang_thai: z.boolean(),
  bien_the: z.array(variantSchema),
}).superRefine((product, context) => {
  const skuIndexes = new Map<string, number>();
  const variantIndexes = new Map<string, number>();

  product.bien_the.forEach((variant, index) => {
    const sku = variant.ma_sku?.trim().toLocaleLowerCase("vi-VN");
    if (sku) {
      const firstIndex = skuIndexes.get(sku);
      if (firstIndex !== undefined) {
        context.addIssue({ code: "custom", path: ["bien_the", index, "ma_sku"], message: "Mã SKU bị trùng trong danh sách" });
      } else skuIndexes.set(sku, index);
    }

    const normalizedEntries = Object.entries(variant.thuoc_tinh)
      .map(([name, value]) => [name.trim().toLocaleLowerCase("vi-VN"), value.trim().toLocaleLowerCase("vi-VN")] as const)
      .filter(([name, value]) => name && value)
      .sort(([left], [right]) => left.localeCompare(right, "vi"));
    const key = JSON.stringify(normalizedEntries);
    const firstIndex = variantIndexes.get(key);
    if (firstIndex !== undefined) {
      context.addIssue({ code: "custom", path: ["bien_the", index, "thuoc_tinh"], message: "Tổ hợp thuộc tính này đã có trong sản phẩm" });
    } else variantIndexes.set(key, index);

    for (const [name, value] of Object.entries(variant.thuoc_tinh)) {
      if (!name.trim() || !value.trim()) {
        context.addIssue({ code: "custom", path: ["bien_the", index, "thuoc_tinh"], message: "Tên và giá trị thuộc tính không được để trống" });
        break;
      }
    }
  });
});

export type SanPhamFormData = z.infer<typeof sanPhamSchema>;
