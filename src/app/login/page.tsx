"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push(searchParams.get("from") || "/upload");
    } else {
      setError("Incorrect passphrase.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", fontFamily: "var(--font-sans)",
    }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "0 24px" }}>
        <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 6, letterSpacing: "-0.02em" }}>
          Staff access
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 32, lineHeight: 1.5 }}>
          Enter the staff passphrase to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password"
            placeholder="Passphrase"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            autoFocus
            style={{
              padding: "14px 18px", borderRadius: 52,
              border: `2px solid ${error ? "#ef4444" : "var(--border)"}`,
              background: "var(--surface)",
              fontSize: 16, fontFamily: "var(--font-sans)", color: "var(--text)",
              outline: "none", width: "100%",
              transition: "border-color 0.15s",
            }}
          />

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", margin: "0 4px" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            style={{
              marginTop: 4, padding: "14px 0", borderRadius: 52,
              background: password && !loading ? "var(--text)" : "#d4d4d4",
              color: "#fff", border: "none",
              fontSize: 15, fontWeight: 600, fontFamily: "var(--font-sans)",
              cursor: password && !loading ? "pointer" : "default",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
