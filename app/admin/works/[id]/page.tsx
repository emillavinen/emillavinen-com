import { notFound } from "next/navigation";
import { AdminNav, AdminStyles, Notice, StoreMissing, when } from "@/components/admin/dispatch/AdminChrome";
import { PLATFORM_LABELS, PLATFORMS, isPlatform } from "@/lib/dispatch/config";
import { getDb } from "@/lib/dispatch/db/client";
import { deliveriesFor, getWorkById } from "@/lib/dispatch/works";
import { deliveryAction, updateWork } from "../../dispatch-actions";

export const dynamic = "force-dynamic";

const ACTIONS: Record<string, { action: string; label: string }[]> = {
  held: [
    { action: "queue", label: "Queue" },
    { action: "skip", label: "Skip" },
  ],
  pending: [{ action: "skip", label: "Skip" }],
  failed: [
    { action: "retry", label: "Retry" },
    { action: "skip", label: "Skip" },
  ],
  unknown: [
    { action: "retry", label: "Retry" },
    { action: "skip", label: "Skip" },
  ],
  skipped: [{ action: "retry", label: "Queue again" }],
};

export default async function WorkAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const db = await getDb();
  if (!db) {
    return (
      <div className="adm">
        <AdminStyles />
        <AdminNav current="/admin/works" />
        <StoreMissing />
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const work = await getWorkById(db, id);
  if (!work) notFound();
  const rows = (await deliveriesFor(db, [id])).sort((a, b) => PLATFORMS.indexOf(a.platform as never) - PLATFORMS.indexOf(b.platform as never));

  return (
    <div className="adm">
      <AdminStyles />
      <AdminNav current="/admin/works" />
      <h1>{work.title}</h1>
      <Notice searchParams={query} />

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-8)", flexWrap: "wrap" }}>
        {work.assets.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.id} src={a.thumbUrl} alt={a.alt} width={a.width} height={a.height} style={{ width: 120, height: "auto", display: "block" }} />
        ))}
      </div>

      <form action={updateWork}>
        <input type="hidden" name="id" value={work.id} />
        <div className="adm-field">
          <label className="adm-label" htmlFor="title">Title</label>
          <input className="adm-input" id="title" name="title" defaultValue={work.title} required />
        </div>
        <div className="adm-field">
          <label className="adm-label" htmlFor="caption">Caption</label>
          <textarea className="adm-textarea" id="caption" name="caption" defaultValue={work.caption} />
        </div>
        <div className="adm-row">
          <div className="adm-field">
            <label className="adm-label" htmlFor="client">Client</label>
            <input className="adm-input" id="client" name="client" defaultValue={work.client ?? ""} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="year">Year</label>
            <input className="adm-input" id="year" name="year" inputMode="numeric" defaultValue={work.year ?? ""} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="tools">Tools (comma separated)</label>
            <input className="adm-input" id="tools" name="tools" defaultValue={work.tools.join(", ")} />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="tags">Tags (comma separated)</label>
            <input className="adm-input" id="tags" name="tags" defaultValue={work.tags.join(", ")} />
          </div>
        </div>
        <div className="adm-field">
          <label className="adm-small">
            <input type="checkbox" name="visible" defaultChecked={work.visibleOnSite} /> Show on the site
          </label>
        </div>
        <button className="adm-btn" type="submit">
          Save
        </button>
        {work.visibleOnSite && (
          <a className="adm-small adm-muted" style={{ marginLeft: "var(--space-4)" }} href={`/work/${work.slug}`} target="_blank" rel="noopener noreferrer">
            /work/{work.slug}
          </a>
        )}
      </form>

      <h2>Platforms</h2>
      <p className="adm-muted adm-small">
        {work.origin}
        {work.sourceUrl ? (
          <>
            {" "}
            · <a href={work.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>
          </>
        ) : null}{" "}
        · added {when(work.createdAt)}
        {work.queuedAt ? ` · queued ${when(work.queuedAt)}` : ""}
      </p>
      <div className="adm-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Status</th>
              <th>Detail</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{isPlatform(d.platform) ? PLATFORM_LABELS[d.platform] : d.platform}</td>
                <td>
                  <span className={`adm-chip adm-chip--${d.status}`}>{d.status}</span>
                  {d.skipReason && <div className="adm-muted adm-small">{d.skipReason.replace("_", " ")}</div>}
                </td>
                <td className="adm-small">
                  {d.status === "pending" && <div>not before {when(d.notBefore)}</div>}
                  {d.status === "posted" && <div>{when(d.postedAt)}</div>}
                  {d.remoteUrl && (
                    <a href={d.remoteUrl} target="_blank" rel="noopener noreferrer">
                      {d.remoteUrl}
                    </a>
                  )}
                  {d.lastError && <div className="adm-muted">{d.lastError}</div>}
                  {d.attempts > 0 && <div className="adm-muted">attempts {d.attempts}</div>}
                  {d.text && <p className="adm-pre">{d.text}</p>}
                </td>
                <td>
                  <div className="adm-actions">
                    {(ACTIONS[d.status] ?? []).map((a) => (
                      <form key={a.action} action={deliveryAction}>
                        <input type="hidden" name="delivery" value={d.id} />
                        <input type="hidden" name="action" value={a.action} />
                        <button className="adm-btn adm-btn--small adm-btn--quiet" type="submit">
                          {a.label}
                        </button>
                      </form>
                    ))}
                    {d.status === "unknown" && (
                      <form action={deliveryAction} style={{ display: "flex", gap: "var(--space-1)" }}>
                        <input type="hidden" name="delivery" value={d.id} />
                        <input type="hidden" name="action" value="posted" />
                        <input className="adm-input" name="url" placeholder="post URL (optional)" style={{ fontSize: "var(--text-xs)", width: "10rem" }} />
                        <button className="adm-btn adm-btn--small" type="submit">
                          It posted
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
