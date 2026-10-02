"use client";

import { useState } from "react";
import type { Card, TapStatus } from "@/lib/igout/logic";

const label = {
  fontSize: "var(--text-xs)",
  color: "var(--color-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "var(--tracking-widest)",
};
const button = {
  minHeight: "44px",
  padding: "0 var(--space-4)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-sans)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-fg)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

type LastTap = { card: Card; id: number; status: TapStatus };

export default function UnfollowList({ cards, remaining }: { cards: Card[]; remaining: number }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [doneHere, setDoneHere] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastTap, setLastTap] = useState<LastTap | null>(null);

  const left = cards.filter((c) => !hidden.has(c.thread_id));
  const allowed = Math.max(0, remaining - doneHere);
  const visible = left.slice(0, allowed);

  async function send(method: "POST" | "DELETE", body: object) {
    const res = await fetch("/api/admin/igout", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error ?? (res.redirected ? "Signed out. Reload the page and sign in." : "Couldn't save. Try again."));
    }
    return data;
  }

  async function tap(card: Card, status: TapStatus) {
    setBusy(card.thread_id);
    setError("");
    try {
      const { id } = await send("POST", { thread_id: card.thread_id, status });
      setHidden((h) => new Set(h).add(card.thread_id));
      if (status === "done") setDoneHere((n) => n + 1);
      setLastTap({ card, id, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (!lastTap) return;
    setError("");
    try {
      await send("DELETE", { id: lastTap.id });
      setHidden((h) => {
        const next = new Set(h);
        next.delete(lastTap.card.thread_id);
        return next;
      });
      if (lastTap.status === "done") setDoneHere((n) => n - 1);
      setLastTap(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't undo.");
    }
  }

  return (
    <div>
      <p style={{ ...label, margin: "0 0 var(--space-4)" }}>
        {visible.length} to unfollow now
        {left.length > visible.length ? ` · ${left.length - visible.length} wait for the next days (daily limit)` : ""}
      </p>

      {lastTap && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-secondary)", margin: "0 0 var(--space-4)" }}>
          {lastTap.status === "done" ? "Unfollowed" : "Skipped"} {lastTap.card.username ? `@${lastTap.card.username}` : lastTap.card.title}.{" "}
          <button onClick={undo} style={{ background: "none", border: "none", padding: 0, font: "inherit", textDecoration: "underline", cursor: "pointer", color: "var(--color-fg)" }}>
            Undo
          </button>
        </p>
      )}

      {error && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-link)", margin: "0 0 var(--space-4)" }}>{error}</p>}

      {visible.length === 0 ? (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-secondary)" }}>
          {left.length > 0 ? "Today's limit is reached. The rest come back tomorrow." : "Nothing to unfollow today."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visible.map((card) => (
            <li key={card.thread_id} style={{ borderTop: "1px solid #e5e5e5", padding: "var(--space-4) 0" }}>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-fg)", wordBreak: "break-word" }}>
                {card.username ? `@${card.username}` : card.title}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-fg-secondary)", margin: "var(--space-1) 0 var(--space-3)" }}>
                {card.username && card.title && card.title !== card.username ? `${card.title} · ` : ""}
                {Math.floor(card.days_since_last_dm)} days since your DM
                {!card.username && " · not linked to an account: search for this name in Instagram"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {card.username && (
                  <a
                    href={`https://www.instagram.com/${encodeURIComponent(card.username)}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...button, background: "var(--color-bg)", color: "var(--color-fg)" }}
                  >
                    Open profile ↗
                  </a>
                )}
                <button
                  onClick={() => tap(card, "done")}
                  disabled={busy !== null}
                  style={{ ...button, background: "var(--color-fg)", color: "var(--color-bg)", opacity: busy === card.thread_id ? 0.5 : 1 }}
                >
                  Unfollowed
                </button>
                <button
                  onClick={() => tap(card, "skipped")}
                  disabled={busy !== null}
                  style={{ ...button, background: "var(--color-bg)", color: "var(--color-muted)", borderColor: "#d4d4d4" }}
                >
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
