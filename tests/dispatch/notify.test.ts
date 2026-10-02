// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { defaultNotifier } from "@/lib/dispatch/notify";
import { cleanEnv, json, routeFetch } from "./helpers";

let restore: () => void = () => {};
afterEach(() => restore());

describe("notifications", () => {
  it("Telegram: plain text marked as DISPATCH, so a shared bot's chat stays readable", async () => {
    restore = cleanEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "42", RESEND_API_KEY: "re", NOTIFY_EMAIL: "e@x.test" });
    const f = routeFetch([["https://api.telegram.org/bot123:abc/sendMessage", () => json({ ok: true })]]);
    expect(await defaultNotifier(f).send("Poster\nX: https://x.com/1")).toBe(true);
    expect(f.calls).toHaveLength(1); // Telegram wins over email
    const body = JSON.parse(String(f.calls[0].init?.body));
    expect(body).toMatchObject({ chat_id: "42", text: "DISPATCH — Poster\nX: https://x.com/1", disable_web_page_preview: true });
    expect(body.parse_mode).toBeUndefined();
  });

  it("falls back to email through Resend, then to the log only", async () => {
    restore = cleanEnv({ RESEND_API_KEY: "re", NOTIFY_EMAIL: "e@x.test" });
    const f = routeFetch([["https://api.resend.com/emails", () => json({ id: "1" })]]);
    expect(await defaultNotifier(f).send("Poster\nline")).toBe(true);
    expect(JSON.parse(String(f.calls[0].init?.body))).toMatchObject({ to: ["e@x.test"], subject: "DISPATCH: Poster", text: "Poster\nline" });
    restore();
    restore = cleanEnv();
    const none = routeFetch([]);
    expect(await defaultNotifier(none).send("hello")).toBe(false);
    expect(none.calls).toHaveLength(0);
  });
});
