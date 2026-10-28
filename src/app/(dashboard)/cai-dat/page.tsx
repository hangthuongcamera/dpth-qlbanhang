import { CuaHangSettingsForm } from "@/components/cai-dat/cua-hang-settings-form";
import { DEFAULT_CUA_HANG_SETTINGS } from "@/lib/cua-hang-settings";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/supabase/user-profile";
import { redirect } from "next/navigation";

export default async function CaiDatPage() {
  if (!(await isOwner())) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("cai_dat_cua_hang").select("*").eq("id", true).maybeSingle();

  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw new Error("Không thể tải cấu hình cửa hàng.");
  }

  return <main className="space-y-6 p-4 md:p-6">
    {(error?.code === "42P01" || error?.code === "PGRST205") && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Cần chạy migration <code>20261024160000_store_settings.sql</code> trên Supabase để lưu cấu hình.</div>}
    <CuaHangSettingsForm settings={(data as typeof DEFAULT_CUA_HANG_SETTINGS | null) ?? DEFAULT_CUA_HANG_SETTINGS} />
  </main>;
}


