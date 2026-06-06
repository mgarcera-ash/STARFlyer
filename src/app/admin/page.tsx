"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SignOutButton from "@/components/SignOutButton";

export default function AdminPage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("flyers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, []);

  const countLabel = pendingCount === null ? "" : ` (${pendingCount})`;

  return (
    <main style={{ minHeight: "100vh", padding: "48px 0 80px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>

        {/* Header */}
        <div className="fade-up" style={{ animationDelay: "0.05s", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <a href="/" style={{
              fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
              textDecoration: "none", fontWeight: 500, padding: "8px 18px",
              borderRadius: 99, border: "1.5px solid var(--border)",
              background: "var(--surface)", transition: "background 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
            >← Library</a>
            <SignOutButton />
          </div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", textAlign: "center" }}>
            Admin
          </h1>
        </div>

        {/* Hub cards */}
        <div className="fade-up" style={{ animationDelay: "0.08s", display: "flex", flexDirection: "column", gap: 16 }}>
          <HubCard
            href="/admin/flyers"
            title={`Review Flyer Submissions${countLabel}`}
            description="Approve or reject community-uploaded flyers"
          />
          <HubCard
            href="/admin/shelters"
            title="Upload Shelter Data"
            description="Load a DFSS Shelter Bed Availability CSV"
          />
        </div>
      </div>
    </main>
  );
}

function HubCard({ href, title, description }: { href: string; title: string; description: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", borderRadius: 20,
        border: "1px solid var(--border)",
        background: hovered ? "var(--hover-bg)" : "var(--surface)",
        textDecoration: "none",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        transition: "background 0.15s",
      }}
    >
      <div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--muted)" }}>
          {description}
        </p>
      </div>
      <span style={{ fontSize: 18, color: "var(--muted)", marginLeft: 16 }}>→</span>
    </a>
  );
}
