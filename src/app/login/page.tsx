"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "staff" | "admin";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "";
  const defaultRole: Role = from.startsWith("/admin") ? "admin" : "staff";

  const [role, setRole] = useState<Role>(defaultRole);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, role }),
    });

    if (res.ok) {
      router.push(from || (role === "admin" ? "/admin" : "/upload"));
    } else {
      setError("Incorrect passphrase.");
      setLoading(false);
    }
  };

  const tabs: { value: Role; label: string }[] = [
    { value: "staff", label: "Upload a Flyer" },
    { value: "admin", label: "Admin Review" },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", fontFamily: "var(--font-sans)",
    }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "0 24px" }}>

        {/* Back */}
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{
            display: "inline-block",
            fontSize: 13, color: "var(--text)", textDecoration: "none",
            fontFamily: "var(--font-sans)", fontWeight: 500,
            padding: "8px 18px", borderRadius: 99,
            border: "1.5px solid var(--border)", background: "var(--surface)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
          >← Back</a>
        </div>

        <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 6, letterSpacing: "-0.02em" }}>
          Staff access
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 28, lineHeight: 1.5 }}>
          Enter the passphrase for your access level.
        </p>

        {/* Segmented control */}
        <div style={{
          display: "flex", gap: 6, padding: 4,
          background: "var(--bg)", borderRadius: 99,
          border: "1.5px solid var(--border)",
          marginBottom: 20,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setRole(tab.value); setPassword(""); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 99,
                border: "none",
                background: role === tab.value ? "var(--text)" : "transparent",
                color: role === tab.value ? "#fff" : "var(--muted)",
                fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
                cursor: "pointer", transition: "background 0.15s, color 0.15s",
              }}
            >{tab.label}</button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            key={role}
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
