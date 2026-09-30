import { desc, eq } from "drizzle-orm";
import { AdminNav, AdminStyles, Notice, StoreMissing, when } from "@/components/admin/dispatch/AdminChrome";
import { PLATFORMS, PLATFORM_LABELS, capFor, pinterestBoards } from "@/lib/dispatch/config";
import { canEncrypt } from "@/lib/dispatch/crypto";
import { getDb } from "@/lib/dispatch/db/client";
import { alerts, pinterestBoards as boardsTable } from "@/lib/dispatch/db/schema";
import { ADAPTERS } from "@/lib/dispatch/platforms";
import { recentEvents } from "@/lib/dispatch/runner";
import { envSettings, getSettings } from "@/lib/dispatch/store";
import { platformConfig } from "@/lib/dispatch/works";
import { checkConnection, disconnect, runNow, setDispatchSetting } from "../dispatch-actions";

export const dynamic = "force-dynamic";

function Toggle({ settingKey, label, value, fromEnv, envValue }: { settingKey: "enabled" | "dry_run"; label: string; value: boolean; fromEnv: boolean; envValue: boolean }) {
  return (
    <tr>
      <td>{label}</td>
      <td>
        <span className={`adm-chip adm-chip--${value ? "ok" : "disabled"}`}>{value ? "on" : "off"}</span>{" "}
        <span className="adm-muted adm-small">{fromEnv ? "(env default)" : `(set here; env says ${envValue ? "on" : "off"})`}</span>
      </td>
      <td>
        <div className="adm-actions">
          <form action={setDispatchSetting}>
            <input type="hidden" name="key" value={settingKey} />
            <input type="hidden" name="value" value={value ? "off" : "on"} />
            <button className="adm-btn adm-btn--small" type="submit">
              Turn {value ? "off" : "on"}
            </button>
          </form>
          {!fromEnv && (
            <form action={setDispatchSetting}>
              <input type="hidden" name="key" value={settingKey} />
              <input type="hidden" name="value" value="env" />
              <button className="adm-btn adm-btn--small adm-btn--quiet" type="submit">
                Use env default
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const db = await getDb();

  if (!db) {
    return (
      <div className="adm">
        <AdminStyles />
        <AdminNav current="/admin/connections" />
        <h1>Connections</h1>
        <StoreMissing />
      </div>
    );
  }

  const [settings, config, events, openAlerts, boards] = await Promise.all([
    getSettings(db),
    platformConfig(db),
    recentEvents({ db }, 40),
    db.select().from(alerts).where(eq(alerts.active, true)).orderBy(desc(alerts.firstAt)),
    db.select().from(boardsTable),
  ]);
  const envDefaults = envSettings();
  const boardsByUrl = new Map(boards.map((b) => [b.url, b]));

  return (
    <div className="adm">
      <AdminStyles />
      <AdminNav current="/admin/connections" />
      <h1>Connections</h1>
      <Notice searchParams={params} />

      <table className="adm-table">
        <tbody>
          <Toggle settingKey="enabled" label="Runner (kill switch)" value={settings.enabled} fromEnv={!settings.overridden.includes("enabled")} envValue={envDefaults.enabled} />
          <Toggle settingKey="dry_run" label="Dry run" value={settings.dryRun} fromEnv={!settings.overridden.includes("dry_run")} envValue={envDefaults.dryRun} />
        </tbody>
      </table>
      <form action={runNow} style={{ marginTop: "var(--space-4)" }}>
        <button className="adm-btn adm-btn--quiet adm-btn--small" type="submit">
          Run now
        </button>
      </form>

      {openAlerts.length > 0 && (
        <>
          <h2>Open alerts</h2>
          {openAlerts.map((a) => (
            <p key={a.key} className="adm-note adm-note--error">
              {a.message} <span className="adm-muted adm-small">since {when(a.firstAt)}</span>
            </p>
          ))}
        </>
      )}

      <h2>Platforms</h2>
      <div className="adm-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Status</th>
              <th>Account</th>
              <th>Token</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {PLATFORMS.map((platform) => {
              const adapter = ADAPTERS[platform];
              const state = config.states.get(platform);
              const configured = adapter.configured(state);
              const missing = adapter.missingEnv();
              const status = configured ? (state?.status === "disabled" ? "ok" : state?.status ?? "ok") : "disabled";
              return (
                <tr key={platform}>
                  <td>
                    {PLATFORM_LABELS[platform]}
                    <div className="adm-muted adm-small">cap {capFor(platform)}/day</div>
                  </td>
                  <td>
                    <span className={`adm-chip adm-chip--${status}`}>{status.replace("_", " ")}</span>
                    {state?.note && <div className="adm-small adm-muted">{state.note}</div>}
                    {!configured && missing.length > 0 && <div className="adm-small adm-muted">needs {missing.join(", ")}</div>}
                    {!configured && missing.length === 0 && adapter.oauth && <div className="adm-small adm-muted">not connected</div>}
                  </td>
                  <td className="adm-small">
                    {state?.account ?? "—"}
                    <div className="adm-muted">last ok {when(state?.lastOkAt)}</div>
                  </td>
                  <td className="adm-small">{state?.tokenExpiresAt ? `expires ${when(state.tokenExpiresAt)}` : "—"}</td>
                  <td>
                    <div className="adm-actions">
                      {configured && (
                        <form action={checkConnection}>
                          <input type="hidden" name="platform" value={platform} />
                          <button className="adm-btn adm-btn--small" type="submit">
                            Check
                          </button>
                        </form>
                      )}
                      {adapter.oauth && (
                        <a
                          className={`adm-btn adm-btn--small adm-btn--quiet`}
                          href={`/api/admin/dispatch/connect/${platform}`}
                          aria-disabled={!canEncrypt()}
                        >
                          {state?.credentials ? "Reconnect" : "Connect"}
                        </a>
                      )}
                      {adapter.oauth && state?.credentials && (
                        <form action={disconnect}>
                          <input type="hidden" name="platform" value={platform} />
                          <button className="adm-btn adm-btn--small adm-btn--quiet" type="submit">
                            Disconnect
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="adm-muted adm-small">
        Check makes one cheap authenticated call and never posts. Connect flows must be started from emillavinen.com, where
        the callbacks are registered.
      </p>

      <h2>Pinterest boards</h2>
      {pinterestBoards().length === 0 ? (
        <p className="adm-muted adm-small">PINTEREST_BOARDS is empty — the watcher is off.</p>
      ) : (
        <table className="adm-table">
          <tbody>
            {pinterestBoards().map((raw) => {
              const board = [...boardsByUrl.values()].find((b) => raw.replace(/\/+$/, "").endsWith(b.url.replace("https://www.pinterest.com", "")));
              return (
                <tr key={raw}>
                  <td className="adm-small">{raw}</td>
                  <td className="adm-small">
                    {board?.lastError ? <span className="adm-chip adm-chip--failed">{board.lastError}</span> : board?.lastOkAt ? `read ${when(board.lastOkAt)}` : "not read yet"}
                    {board?.baselinedAt && <div className="adm-muted">baseline {when(board.baselinedAt)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>Recent events</h2>
      <div className="adm-scroll">
        <table className="adm-table">
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="adm-small adm-muted" style={{ whiteSpace: "nowrap" }}>
                  {when(e.at)}
                </td>
                <td className="adm-small">{e.type}</td>
                <td className="adm-small">{e.platform ?? ""}</td>
                <td className="adm-small">
                  <span className="adm-pre">{e.message.slice(0, 400)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
