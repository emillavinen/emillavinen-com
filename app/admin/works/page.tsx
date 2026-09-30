import Link from "next/link";
import { AdminNav, AdminStyles, Notice, StoreMissing, when } from "@/components/admin/dispatch/AdminChrome";
import { PLATFORM_LABELS, isPlatform } from "@/lib/dispatch/config";
import { getDb } from "@/lib/dispatch/db/client";
import type { Delivery } from "@/lib/dispatch/db/schema";
import { deliveriesFor, listAllWorks } from "@/lib/dispatch/works";
import { setVisibility } from "../dispatch-actions";

export const dynamic = "force-dynamic";

export default async function WorksAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const db = await getDb();
  if (!db) {
    return (
      <div className="adm">
        <AdminStyles />
        <AdminNav current="/admin/works" />
        <h1>Works</h1>
        <StoreMissing />
      </div>
    );
  }
  const works = await listAllWorks(db, 300);
  const rows = await deliveriesFor(db, works.map((w) => w.id));
  const byWork = new Map<string, Delivery[]>();
  for (const d of rows) byWork.set(d.workId, [...(byWork.get(d.workId) ?? []), d]);

  return (
    <div className="adm">
      <AdminStyles />
      <AdminNav current="/admin/works" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Works</h1>
        <Link className="adm-btn" href="/admin/drop">
          Drop
        </Link>
      </div>
      <Notice searchParams={params} />
      {works.length === 0 ? (
        <p className="adm-muted">No works yet. Drop one, add Pinterest boards, or run the backlog import.</p>
      ) : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Work</th>
                <th>Platforms</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/admin/works/${w.id}`} style={{ color: "var(--color-fg)" }}>
                      {w.title}
                    </Link>
                    <div className="adm-muted adm-small">
                      {w.origin} · {when(w.createdAt)}
                    </div>
                  </td>
                  <td>
                    <div className="adm-chips">
                      {(byWork.get(w.id) ?? [])
                        .sort((a, b) => a.platform.localeCompare(b.platform))
                        .map((d) => {
                          const name = isPlatform(d.platform) ? PLATFORM_LABELS[d.platform] : d.platform;
                          const chip = (
                            <span className={`adm-chip adm-chip--${d.status}`} title={d.lastError ?? d.skipReason ?? ""}>
                              {name} {d.status === "skipped" && d.skipReason === "dry_run" ? "dry run" : d.status}
                            </span>
                          );
                          return d.remoteUrl ? (
                            <a key={d.id} href={d.remoteUrl} target="_blank" rel="noopener noreferrer">
                              {chip}
                            </a>
                          ) : (
                            <span key={d.id}>{chip}</span>
                          );
                        })}
                    </div>
                  </td>
                  <td>
                    <form action={setVisibility}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="visible" value={w.visibleOnSite ? "0" : "1"} />
                      <button className="adm-btn adm-btn--small adm-btn--quiet" type="submit">
                        {w.visibleOnSite ? "Hide" : "Show"}
                      </button>
                    </form>
                    {w.visibleOnSite && (
                      <a className="adm-small adm-muted" href={`/work/${w.slug}`} target="_blank" rel="noopener noreferrer">
                        view
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
