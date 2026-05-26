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
        fontSize: 13, color: "#ef4444", fontFamily: "var(--font-sans)",
        fontWeight: 600, padding: "8px 18px", borderRadius: 99,
        border: "1.5px solid #ef4444", background: "transparent",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
