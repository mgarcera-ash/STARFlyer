"use client";

export type Hotspot = { type: "phone" | "sms" | "email" | "address" | "website"; label: string; value: string; lat?: number; lng?: number };

const TYPE_ORDER: Hotspot["type"][] = ["phone", "sms", "email", "address", "website"];

const TYPE_META: Record<Hotspot["type"], { bg: string; icon: React.ReactNode; placeholder: string }> = {
  phone: {
    bg: "#22c55e",
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg>,
    placeholder: "Phone number",
  },
  sms: {
    bg: "#06b6d4",
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V3z" fill="#fff"/></svg>,
    placeholder: "Short code or SMS number",
  },
  email: {
    bg: "rgba(251,191,36,0.18)",
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" fill="#f97316"/><path d="M2 4l6 5 6-5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>,
    placeholder: "Email address",
  },
  address: {
    bg: "rgba(59,130,246,0.1)",
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#ef4444"/></svg>,
    placeholder: "Street address",
  },
  website: {
    bg: "rgba(99,102,241,0.1)",
    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="#6366f1" strokeWidth="1.2"/><path d="M8 2.5c-1.5 1.5-1.5 9.5 0 11M8 2.5c1.5 1.5 1.5 9.5 0 11" stroke="#6366f1" strokeWidth="1.2"/><path d="M2.5 8h11" stroke="#6366f1" strokeWidth="1.2"/></svg>,
    placeholder: "Website URL",
  },
};

export default function HotspotEditor({
  hotspots,
  onChange,
}: {
  hotspots: Hotspot[];
  onChange: (updated: Hotspot[]) => void;
}) {
  const update = (i: number, patch: Partial<Hotspot>) => {
    const next = hotspots.map((h, idx) => idx === i ? { ...h, ...patch } : h);
    onChange(next);
  };

  const cycleType = (i: number) => {
    const current = hotspots[i].type;
    const next = TYPE_ORDER[(TYPE_ORDER.indexOf(current) + 1) % TYPE_ORDER.length];
    update(i, { type: next });
  };

  const remove = (i: number) => onChange(hotspots.filter((_, idx) => idx !== i));

  const add = () => onChange([...hotspots, { type: "phone", label: "", value: "" }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {hotspots.map((spot, i) => {
        const meta = TYPE_META[spot.type];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>

            {/* Type cycle button */}
            <button
              type="button"
              onClick={() => cycleType(i)}
              title="Tap to change type"
              style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: "50%",
                border: "1px solid var(--border)",
                background: meta.bg,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              {meta.icon}
            </button>

            {/* Label */}
            <input
              type="text"
              placeholder="Label (e.g. Haymarket Center)"
              value={spot.label}
              onChange={e => update(i, { label: e.target.value })}
              style={fieldStyle}
            />

            {/* Value */}
            <input
              type="text"
              placeholder={meta.placeholder}
              value={spot.value}
              onChange={e => update(i, { value: e.target.value })}
              style={fieldStyle}
            />

            {/* Remove */}
            <button
              type="button"
              onClick={() => remove(i)}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--muted)", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >×</button>
          </div>
        );
      })}

      {/* Add row */}
      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: "flex-start",
          fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 500,
          color: "var(--accent)", background: "none", border: "none",
          cursor: "pointer", padding: "4px 0",
          opacity: 0.8, transition: "opacity 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
      >+ Add contact</button>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  flex: 1, minWidth: 0,
  padding: "7px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface)",
  fontSize: 12, fontFamily: "var(--font-sans)", color: "var(--text)",
  outline: "none",
};
