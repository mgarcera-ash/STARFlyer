"use client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      style={{
        fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)",
        fontWeight: 500, padding: "8px 18px", borderRadius: 99,
        border: "1.5px solid var(--border)", background: "var(--surface)",
        cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.color = "var(--text)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--muted)"; }}
    >
      Sign out
    </button>
  );
}
