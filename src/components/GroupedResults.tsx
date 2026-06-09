"use client";
import { FaSafari, FaSms } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import type { Flyer, Hotspot } from "@/types/flyer";
import FlyerCard from "./FlyerCard";

export type FlyerGroup = {
  flyer: Flyer;
  hotspotsByType: Partial<Record<Hotspot["type"], Hotspot[]>>;
  isFallback: boolean;
};

export default function GroupedResults({ flyerGroups, search, activeEntities, onQuickLook, onPreview }: {
  flyerGroups: FlyerGroup[];
  search: string;
  activeEntities: string[];
  onQuickLook: (flyer: Flyer, initialSearch?: string) => void;
  onPreview: (flyer: Flyer, initialSearch?: string) => void;
}) {
  const hotspotMeta: Record<Hotspot["type"], { bg: string; label: string; icon: React.ReactNode }> = {
    phone:   { bg: "#22c55e", label: "Phones",    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg> },
    sms:     { bg: "#06b6d4", label: "SMS",       icon: <FaSms size={13} color="#fff" /> },
    email:   { bg: "#f97316", label: "Email",     icon: <MdEmail size={13} color="#fff" /> },
    address: { bg: "#ef4444", label: "Addresses", icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#fff"/></svg> },
    website: { bg: "#3b82f6", label: "Websites",  icon: <FaSafari size={13} color="#fff" /> },
  };
  const typeOrder: Hotspot["type"][] = ["phone", "sms", "email", "address", "website"];
  const fallbacks = flyerGroups.filter(g => g.isFallback);
  const matched   = flyerGroups.filter(g => !g.isFallback);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {flyerGroups.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 14, fontFamily: "var(--font-sans)", paddingTop: 24 }}>
          No flyers match your search.
        </p>
      )}

      {/* Fallback flyers — normal cards */}
      {fallbacks.length > 0 && (
        <div>
          <p style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>
            {fallbacks.length} {fallbacks.length === 1 ? "flyer" : "flyers"} found.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, alignItems: "start" }}>
            {fallbacks.map(({ flyer }, i) => (
              <FlyerCard
                key={flyer.id}
                flyer={flyer}
                search={search}
                showEntity={activeEntities.length > 0}
                onQuickLook={(s) => onQuickLook(flyer, s)}
                onPreview={(s) => onPreview(flyer, s)}
                animationDelay={i * 0.06}
              />
            ))}
          </div>
        </div>
      )}

      {/* Matched flyers — dark grouped contact cards */}
      {matched.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>
              These flyers have more inside.
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>
              Tap directly on information to view.
            </p>
          </div>
          {matched.map(({ flyer, hotspotsByType }, i) => (
            <div key={flyer.id} className="stagger-item" style={{ animationDelay: `${i * 0.06}s`, background: "#1c1c1e", borderRadius: 32, overflow: "hidden", border: "2px solid var(--card-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)" }}>
                  {flyer.image_url
                    ? <img src={flyer.image_url} alt={flyer.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{flyer.title.charAt(0)}</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {flyer.entity && <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>{flyer.entity}</p>}
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#fff", fontFamily: "var(--font-sans)", lineHeight: 1.4 }}>{flyer.title}</p>
                </div>
              </div>
              {typeOrder.filter(t => hotspotsByType[t]).map(type => (
                <div key={type}>
                  <div style={{ padding: "8px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: hotspotMeta[type].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {hotspotMeta[type].icon}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{hotspotMeta[type].label}</p>
                  </div>
                  {hotspotsByType[type]!.map((h, hi) => (
                    <button
                      key={hi}
                      onClick={() => onPreview(flyer, h.label || h.value)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "6px 16px 6px 40px", width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {h.label && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)" }}>{h.label}</p>}
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-sans)" }}>{h.value}</p>
                    </button>
                  ))}
                  <div style={{ height: 6 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
