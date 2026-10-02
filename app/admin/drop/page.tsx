import { AdminNav, AdminStyles, StoreMissing } from "@/components/admin/dispatch/AdminChrome";
import DropForm from "@/components/admin/dispatch/DropForm";
import { PLATFORMS, PLATFORM_LABELS } from "@/lib/dispatch/config";
import { isBlobConfigured } from "@/lib/dispatch/blob";
import { getDb } from "@/lib/dispatch/db/client";
import { platformConfig } from "@/lib/dispatch/works";

export const dynamic = "force-dynamic";

export default async function DropPage() {
  const db = await getDb();
  const ready = db && isBlobConfigured();
  const enabled = db ? (await platformConfig(db)).enabled : [];

  return (
    <div className="adm">
      <AdminStyles />
      <AdminNav current="/admin/drop" />
      <h1>Drop</h1>
      {ready ? (
        <DropForm platforms={PLATFORMS.map((p) => ({ id: p, label: PLATFORM_LABELS[p], enabled: enabled.includes(p) }))} />
      ) : (
        <StoreMissing />
      )}
    </div>
  );
}
