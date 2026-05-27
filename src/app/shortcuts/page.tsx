import Link from "next/link";

const shortcuts = [
  { keys: ["A–Z", "0–9"], description: "Start searching" },
  { keys: ["Esc"], description: "Clear search & close" },
];

export default function ShortcutsPage() {
  return (
    <main style={{
      minHeight: "100vh", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        <Link href="/" style={{
          display: "inline-block", marginBottom: 48,
          fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none",
          fontWeight: 500, padding: "8px 18px", borderRadius: 99,
          border: "1.5px solid rgba(255,255,255,0.15)",
          transition: "color 0.15s, border-color 0.15s",
        }}>← Back</Link>

        <p style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Keyboard Shortcuts
        </p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: "0 0 40px", lineHeight: 1.5 }}>
          Available on desktop.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {shortcuts.map(({ keys, description }, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "14px 0",
              borderBottom: i < shortcuts.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>
                {description}
              </span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {keys.map(k => (
                  <kbd key={k} style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "4px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    fontSize: 12, fontWeight: 600, color: "#fff",
                    fontFamily: "var(--font-sans)", letterSpacing: "0.02em",
                  }}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
