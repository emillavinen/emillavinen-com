"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [step, setStep] = useState<"password" | "totp">("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = step === "password" ? { password } : { password, totp };

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      if (data.step === "totp") {
        setStep("totp");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
      return;
    }

    setError(
      res.status === 500
        ? "Server error: ADMIN_PASSWORD is not configured."
        : data.error ?? "Something went wrong."
    );
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", fontFamily: "var(--font-sans)" }}>
      <div style={{ width: "100%", maxWidth: "360px", padding: "var(--space-12) var(--space-8)" }}>
        <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 400, letterSpacing: "var(--tracking-widest)", textTransform: "uppercase", color: "var(--color-fg)", margin: "0 0 var(--space-8)" }}>Admin</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {step === "password" ? (
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--color-fg-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)", marginBottom: "var(--space-2)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                style={{ width: "100%", border: "1px solid #d4d4d4", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--color-fg-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-widest)", marginBottom: "var(--space-2)" }}>
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
                placeholder="000000"
                style={{ width: "100%", border: "1px solid #d4d4d4", borderRadius: "var(--radius-md)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)", fontFamily: "var(--font-mono)", letterSpacing: "var(--tracking-widest)", textAlign: "center", outline: "none", boxSizing: "border-box" }}
              />
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-fg-muted)", marginTop: "var(--space-2)", textAlign: "center" }}>
                6-digit code from your authenticator app
              </p>
            </div>
          )}

          {error && <p style={{ fontSize: "var(--text-sm)", color: "#dc2626" }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "var(--space-2) 0", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-fg)", color: "var(--color-bg)", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer", opacity: loading ? 0.5 : 1 }}
          >
            {loading ? "Checking…" : step === "password" ? "Continue" : "Sign in"}
          </button>

          {step === "totp" && (
            <button
              type="button"
              onClick={() => { setStep("password"); setTotp(""); setError(""); }}
              style={{ width: "100%", padding: "var(--space-2) 0", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "none", border: "none", color: "var(--color-fg-muted)", cursor: "pointer" }}
            >
              ← Back
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
