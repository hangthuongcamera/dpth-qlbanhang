"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { luuSanPham } from "@/lib/supabase/san-pham-actions";
import { taoLoaiSanPham } from "@/lib/supabase/loai-san-pham-actions";
import { sanPhamSchema, type SanPhamFormData } from "@/lib/validations/san-pham";
import type { LoaiSanPham, SanPham } from "@/types/san-pham";
import { formatNumber, parseCurrencyInput } from "@/types/don-hang";

type ProductFormProps = { categories: LoaiSanPham[]; product?: SanPham; initialProductCode?: string };
type AttributeDefinition = { key: string; name: string; values: string[]; draftValue: string };
type Variant = SanPhamFormData["bien_the"][number];

function normalizeAttributes(attributes: Record<string, string>) {
  return Object.fromEntries(Object.entries(attributes).map(([name, value]) => [name.trim(), value.trim()]));
}

function variantKey(attributes: Record<string, string>) {
  return JSON.stringify(Object.entries(attributes)
    .map(([name, value]) => [name.trim().toLocaleLowerCase("vi-VN"), value.trim().toLocaleLowerCase("vi-VN")] as const)
    .sort(([left], [right]) => left.localeCompare(right, "vi")));
}

function getInitialData(product?: SanPham, initialProductCode = ""): { values: SanPhamFormData; attributes: AttributeDefinition[] } {
  const variants: Variant[] = (product?.bien_the_san_pham ?? []).filter((variant) => variant.trang_thai).map((variant) => ({
    id: variant.id,
    ma_sku: variant.ma_sku,
    thuoc_tinh: variant.thuoc_tinh ?? {},
    gia_ban: Number(variant.gia_ban),
    gia_nhap: Number(variant.gia_nhap),
    trang_thai: variant.trang_thai,
  }));
  const attributeValues = new Map<string, { name: string; values: Set<string> }>();
  variants.forEach((variant) => Object.entries(variant.thuoc_tinh).forEach(([name, value]) => {
    const normalizedName = name.trim().toLocaleLowerCase("vi-VN");
    const entry = attributeValues.get(normalizedName) ?? { name, values: new Set<string>() };
    entry.values.add(value);
    attributeValues.set(normalizedName, entry);
  }));

  return {
    values: {
      ma_san_pham: product?.ma_san_pham ?? initialProductCode,
      ten_san_pham: product?.ten_san_pham ?? "",
      loai_san_pham_id: product?.loai_san_pham_id ?? "",
      don_vi_tinh: product?.don_vi_tinh ?? "cái",
      mo_ta: product?.mo_ta ?? "",
      trang_thai: product?.trang_thai ?? true,
      gia_ban: Number(product?.gia_ban ?? 0),
      gia_nhap: Number(product?.gia_nhap ?? 0),
      bien_the: attributeValues.size ? variants : [],
    },
    attributes: [...attributeValues.values()].map(({ name, values }) => ({ key: name, name, values: [...values], draftValue: "" })),
  };
}

function buildVariants(definitions: AttributeDefinition[], existingVariants: Variant[], giaBan: number, giaNhap: number): Variant[] | null {
  if (!definitions.length || definitions.some((attribute) => !attribute.name.trim() || attribute.values.length === 0 || attribute.draftValue.trim())) return null;
  const normalizedNames = definitions.map((attribute) => attribute.name.trim().toLocaleLowerCase("vi-VN"));
  if (new Set(normalizedNames).size !== normalizedNames.length) return null;
  if (definitions.reduce((count, attribute) => count * attribute.values.length, 1) > 500) return null;

  let combinations: Record<string, string>[] = [{}];
  for (const definition of definitions) {
    combinations = combinations.flatMap((combination) => definition.values.map((value) => ({ ...combination, [definition.name.trim()]: value })));
  }
  const existing = new Map(existingVariants.map((variant) => [variantKey(variant.thuoc_tinh), variant]));
  return combinations.map((attributesForVariant) => {
    const previous = existing.get(variantKey(attributesForVariant));
    return previous
      ? { ...previous, thuoc_tinh: normalizeAttributes(attributesForVariant) }
      : { ma_sku: "", thuoc_tinh: normalizeAttributes(attributesForVariant), gia_ban: giaBan, gia_nhap: giaNhap, trang_thai: true };
  });
}

export function ProductForm({ categories, product, initialProductCode }: ProductFormProps) {
  const router = useRouter();
  const initial = useMemo(() => getInitialData(product, initialProductCode), [product, initialProductCode]);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [values, setValues] = useState<SanPhamFormData>(initial.values);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>(initial.attributes);
  const [hasAttributes, setHasAttributes] = useState(initial.attributes.length > 0);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const updateProduct = <K extends keyof Omit<SanPhamFormData, "bien_the">>(field: K, value: SanPhamFormData[K]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const updateVariant = <K extends keyof Variant>(index: number, field: K, value: Variant[K]) => {
    setValues((current) => ({ ...current, bien_the: current.bien_the.map((variant, i) => i === index ? { ...variant, [field]: value } : variant) }));
  };

  const setAttributeName = (index: number, name: string) => {
    const previousName = attributes[index]?.name;
    const nextAttributes = attributes.map((attribute, i) => i === index ? { ...attribute, name } : attribute);
    setAttributes(nextAttributes);
    if (previousName && previousName !== name) {
      setValues((current) => ({
        ...current,
        bien_the: current.bien_the.map((variant) => {
          const nextVariantAttributes = { ...variant.thuoc_tinh };
          const existingName = Object.keys(nextVariantAttributes).find((key) => key.toLocaleLowerCase("vi-VN") === previousName.trim().toLocaleLowerCase("vi-VN"));
          if (existingName) {
            const attributeValue = nextVariantAttributes[existingName];
            delete nextVariantAttributes[existingName];
            if (name.trim()) nextVariantAttributes[name.trim()] = attributeValue;
          }
          return { ...variant, thuoc_tinh: nextVariantAttributes };
        }),
      }));
    }
  };

  const addAttribute = () => {
    setAttributes((current) => [...current, { key: `${Date.now()}-${current.length}`, name: "", values: [], draftValue: "" }]);
  };

  const removeAttribute = (index: number) => {
    const nextAttributes = attributes.filter((_, i) => i !== index);
    setAttributes(nextAttributes);
    if (nextAttributes.length === 0) {
      setHasAttributes(false);
      setValues((current) => ({ ...current, bien_the: [] }));
    } else {
      const nextVariants = buildVariants(nextAttributes, values.bien_the, values.gia_ban, values.gia_nhap);
      if (nextVariants) setValues((current) => ({ ...current, bien_the: nextVariants }));
    }
  };

  const commitAttributeValue = (index: number) => {
    const attribute = attributes[index];
    const value = attribute?.draftValue.trim();
    if (!attribute || !value) return;
    if (attribute.values.some((existing) => existing.toLocaleLowerCase("vi-VN") === value.toLocaleLowerCase("vi-VN"))) {
      setError("Giá trị này đã có trong thuộc tính.");
      return;
    }
    const nextAttributes = attributes.map((item, i) => i === index ? { ...item, values: [...item.values, value], draftValue: "" } : item);
    setAttributes(nextAttributes);
    setError("");
    const nextVariants = buildVariants(nextAttributes, values.bien_the, values.gia_ban, values.gia_nhap);
    if (nextVariants) setValues((current) => ({ ...current, bien_the: nextVariants }));
    else if (nextAttributes.every((item) => item.name.trim() && item.values.length > 0 && !item.draftValue.trim())) {
      setError("Tổ hợp vượt quá 500 biến thể hoặc tên thuộc tính bị trùng.");
    }
  };

  const removeAttributeValue = (attributeIndex: number, valueIndex: number) => {
    const nextAttributes = attributes.map((attribute, i) => i === attributeIndex ? { ...attribute, values: attribute.values.filter((_, j) => j !== valueIndex) } : attribute);
    if (nextAttributes[attributeIndex]?.values.length === 0) {
      setHasAttributes(false);
      setAttributes([]);
      setValues((current) => ({ ...current, bien_the: [] }));
      return;
    }
    setAttributes(nextAttributes);
    const nextVariants = buildVariants(nextAttributes, values.bien_the, values.gia_ban, values.gia_nhap);
    if (nextVariants) setValues((current) => ({ ...current, bien_the: nextVariants }));
  };

  const handleCreateCategory = async () => {
    setCategoryError("");
    if (!categoryCode.trim() || !categoryName.trim()) {
      setCategoryError("Vui lòng nhập mã loại và tên loại.");
      return;
    }
    setIsCreatingCategory(true);
    try {
      const category = await taoLoaiSanPham(categoryCode, categoryName);
      setCategoryOptions((current) => [...current, category].sort((a, b) => a.ten_loai.localeCompare(b.ten_loai, "vi")));
      updateProduct("loai_san_pham_id", category.id);
      setCategoryCode("");
      setCategoryName("");
      setShowQuickCategory(false);
    } catch (createError) {
      setCategoryError(createError instanceof Error ? createError.message : "Không thể tạo loại sản phẩm.");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (hasAttributes) {
      if (attributes.some((attribute) => !attribute.name.trim() || attribute.values.length === 0 || attribute.draftValue.trim())) {
        setError("Mỗi thuộc tính cần có tên và ít nhất một giá trị. Nhấn Enter để xác nhận từng giá trị.");
        return;
      }
      const names = attributes.map((attribute) => attribute.name.trim().toLocaleLowerCase("vi-VN"));
      if (new Set(names).size !== names.length) {
        setError("Tên thuộc tính không được trùng nhau.");
        return;
      }
      if (attributes.reduce((count, attribute) => count * attribute.values.length, 1) > 500) {
        setError("Tổ hợp vượt quá 500 biến thể. Hãy giảm số thuộc tính hoặc giá trị.");
        return;
      }
    }
    const parsed = sanPhamSchema.safeParse({ ...values, bien_the: hasAttributes ? values.bien_the : [] });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Vui lòng kiểm tra lại thông tin sản phẩm.");
      return;
    }

    setIsSaving(true);
    try {
      await luuSanPham(product?.id ?? null, parsed.data);
      router.push("/danh-sach-san-pham");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu sản phẩm.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl space-y-5">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4"><h2 className="font-semibold text-slate-900">Thông tin sản phẩm</h2><p className="mt-1 text-sm text-slate-500">Thông tin chung và loại sản phẩm.</p></div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-4">
          <div className="space-y-2"><Label htmlFor="ma_san_pham">Mã sản phẩm</Label><Input id="ma_san_pham" value={values.ma_san_pham} readOnly maxLength={100} placeholder="Tự sinh khi lưu (THSP-00001)" className="bg-slate-50 text-slate-600" /><p className="text-xs text-slate-500">Mã được tạo tự động và giữ nguyên khi chỉnh sửa.</p></div>
          <div className="space-y-2"><Label htmlFor="ten_san_pham">Tên sản phẩm *</Label><Input id="ten_san_pham" value={values.ten_san_pham} onChange={(e) => updateProduct("ten_san_pham", e.target.value)} required maxLength={255} /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><Label htmlFor="loai_san_pham_id">Loại sản phẩm *</Label><button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80" onClick={() => { setShowQuickCategory((show) => !show); setCategoryError(""); }}><Plus className="h-3.5 w-3.5" />Tạo loại mới</button></div>
            <select id="loai_san_pham_id" value={values.loai_san_pham_id} onChange={(e) => updateProduct("loai_san_pham_id", e.target.value)} required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"><option value="">Chọn loại sản phẩm</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.ten_loai}</option>)}</select>
            {categoryOptions.length === 0 && <p className="text-xs text-amber-700">Chưa có loại sản phẩm. Tạo loại mới ngay tại đây để tiếp tục.</p>}
            {showQuickCategory && <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-slate-800">Tạo loại sản phẩm nhanh</p><button type="button" aria-label="Đóng" onClick={() => setShowQuickCategory(false)} className="rounded p-1 text-slate-500 hover:bg-white"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-3 sm:grid-cols-[minmax(100px,0.8fr)_minmax(160px,1.2fr)_auto] sm:items-end">
                <div className="space-y-1"><Label htmlFor="ma_loai_moi">Mã loại *</Label><Input id="ma_loai_moi" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreateCategory(); } }} placeholder="VD: AO_THUN" maxLength={100} required /></div>
                <div className="space-y-1"><Label htmlFor="ten_loai_moi">Tên loại *</Label><Input id="ten_loai_moi" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreateCategory(); } }} placeholder="VD: Áo thun" maxLength={255} required /></div>
                <Button type="button" onClick={handleCreateCategory} disabled={isCreatingCategory}>{isCreatingCategory ? "Đang tạo..." : "Tạo và chọn"}</Button>
              </div>
              {categoryError && <p role="alert" className="mt-2 text-sm text-red-700">{categoryError}</p>}
            </div>}
          </div>
          <div className="space-y-2"><Label htmlFor="don_vi_tinh">Đơn vị tính *</Label><Input id="don_vi_tinh" value={values.don_vi_tinh} onChange={(e) => updateProduct("don_vi_tinh", e.target.value)} required maxLength={50} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="mo_ta">Mô tả</Label><Textarea id="mo_ta" value={values.mo_ta ?? ""} onChange={(e) => updateProduct("mo_ta", e.target.value)} rows={3} maxLength={2000} /></div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={values.trang_thai} onChange={(e) => updateProduct("trang_thai", e.target.checked)} className="h-4 w-4 accent-primary" />Đang kinh doanh</label>

          <div className="space-y-4 sm:col-span-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
              <div><p className="text-sm font-medium text-slate-800">Sản phẩm có thuộc tính</p><p className="mt-0.5 text-xs text-slate-500">Bật nếu sản phẩm có nhiều biến thể như màu sắc hoặc kích cỡ.</p></div>
              <button type="button" role="switch" aria-checked={hasAttributes} aria-label="Sản phẩm có thuộc tính" onClick={() => { if (!hasAttributes && attributes.length === 0) setAttributes([{ key: `${Date.now()}-0`, name: "", values: [], draftValue: "" }]); setHasAttributes(!hasAttributes); }} className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${hasAttributes ? "bg-primary" : "bg-slate-300"}`}><span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${hasAttributes ? "translate-x-5" : "translate-x-0.5"}`} /></button>
            </div>
            {!hasAttributes && <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="text-sm font-semibold text-slate-800">Sản phẩm đơn</h3><p className="mt-1 text-xs text-slate-500">Không có thuộc tính; nhập giá trực tiếp cho sản phẩm.</p></div><div className="space-y-2"><Label htmlFor="gia_nhap_san_pham">Giá nhập *</Label><Input id="gia_nhap_san_pham" type="text" inputMode="numeric" value={formatNumber(values.gia_nhap)} onChange={(e) => updateProduct("gia_nhap", parseCurrencyInput(e.target.value))} required /></div><div className="space-y-2"><Label htmlFor="gia_ban_san_pham">Giá bán *</Label><Input id="gia_ban_san_pham" type="text" inputMode="numeric" value={formatNumber(values.gia_ban)} onChange={(e) => updateProduct("gia_ban", parseCurrencyInput(e.target.value))} required /></div></div>}

            {hasAttributes && <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              {attributes.map((attribute, index) => <div key={attribute.key} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(140px,0.8fr)_minmax(220px,1.5fr)_auto] sm:items-start">
                <div className="space-y-2"><Label htmlFor={`attribute-name-${index}`}>Tên thuộc tính</Label><Input id={`attribute-name-${index}`} value={attribute.name} onChange={(e) => setAttributeName(index, e.target.value)} placeholder="Ví dụ: Size, Chất liệu" maxLength={60} /></div>
                <div className="space-y-2"><Label htmlFor={`attribute-value-${index}`}>Giá trị (nhập từng giá trị, nhấn Enter)</Label><Input id={`attribute-value-${index}`} value={attribute.draftValue} onChange={(e) => setAttributes((current) => current.map((item, i) => i === index ? { ...item, draftValue: e.target.value } : item))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitAttributeValue(index); } }} placeholder="Nhập giá trị rồi nhấn Enter" maxLength={100} />
                  {attribute.values.length > 0 && <div className="flex flex-wrap gap-2">{attribute.values.map((value, valueIndex) => <span key={`${value}-${valueIndex}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{value}<button type="button" aria-label={`Xóa giá trị ${value}`} onClick={() => removeAttributeValue(index, valueIndex)} className="rounded-full p-0.5 hover:bg-slate-200"><X className="h-3 w-3" /></button></span>)}</div>}
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Xóa thuộc tính ${index + 1}`} onClick={() => removeAttribute(index)} disabled={isSaving}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>)}
              <Button type="button" variant="outline" onClick={addAttribute} disabled={isSaving}><Plus className="mr-2 h-4 w-4" />Thêm thuộc tính khác</Button>
            </div>}
          </div>
        </div>
      </section>

      {hasAttributes && <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4"><h2 className="font-semibold text-slate-900">Biến thể</h2><p className="mt-1 text-sm text-slate-500">Các tổ hợp được cập nhật ngay khi nhấn Enter cho từng giá trị. Mỗi biến thể có SKU và giá riêng.</p></div>
        <div className="space-y-4 p-4">
          {values.bien_the.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">Nhập tên thuộc tính và ít nhất một giá trị, sau đó nhấn Enter để tạo danh sách biến thể.</div>}
          {values.bien_the.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="app-data-table w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Thuộc tính</th><th className="px-3 py-3">Mã SKU</th><th className="px-3 py-3">Giá nhập</th><th className="px-3 py-3">Giá bán</th><th className="px-3 py-3">Trạng thái</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {values.bien_the.map((variant, index) => <tr id={variant.id ? `bien-the-${variant.id}` : undefined} key={variant.id ?? `new-${index}`}>
                  <td className="px-3 py-3 font-medium text-slate-700">{Object.entries(variant.thuoc_tinh).map(([name, value]) => `${name}: ${value}`).join(" · ") || "Mặc định"}</td>
                  <td className="px-3 py-3"><Input aria-label={`Mã SKU biến thể ${index + 1}`} value={variant.ma_sku ?? ""} onChange={(e) => updateVariant(index, "ma_sku", e.target.value)} placeholder="Tự sinh khi lưu" maxLength={100} /></td>
                  <td className="px-3 py-3"><Input aria-label={`Giá nhập biến thể ${index + 1}`} type="text" inputMode="numeric" value={formatNumber(variant.gia_nhap)} onChange={(e) => updateVariant(index, "gia_nhap", parseCurrencyInput(e.target.value))} required /></td>
                  <td className="px-3 py-3"><Input aria-label={`Giá bán biến thể ${index + 1}`} type="text" inputMode="numeric" value={formatNumber(variant.gia_ban)} onChange={(e) => updateVariant(index, "gia_ban", parseCurrencyInput(e.target.value))} required /></td>
                  <td className="px-3 py-3"><label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-600"><input type="checkbox" checked={variant.trang_thai} onChange={(e) => updateVariant(index, "trang_thai", e.target.checked)} className="h-4 w-4 accent-primary" />Kinh doanh</label></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {values.bien_the.length > 0 && <p className="text-xs text-slate-500">Hiện có {values.bien_the.length} biến thể. Chưa quản lý tồn kho ở bước này.</p>}
        </div>
      </section>}

      <div className="flex flex-col-reverse gap-3 pb-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/danh-sach-san-pham")} disabled={isSaving}>Hủy</Button>
        <Button type="submit" disabled={isSaving}><Save className="mr-2 h-4 w-4" />{isSaving ? "Đang lưu..." : product ? "Lưu thay đổi" : "Tạo sản phẩm"}</Button>
      </div>
    </form>
  );
}






