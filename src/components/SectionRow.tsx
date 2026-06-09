"use client";
import { useRef, useState } from "react";
import type { Flyer } from "@/types/flyer";
import PosterCard from "./PosterCard";

export default function SectionRow({ title, dot, flyers, onSeeAll, onQuickLook, animationDelay = 0 }: {
  title: string; dot?: string; flyers: Flyer[];
  onSeeAll?: () => void; onQuickLook: (f: Flyer) => void; animationDelay?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowHovered, setRowHovered] = useState(false);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const scrollArrowStyle = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute", [side]: 8, top: "50%", transform: "translateY(-50%)",
    width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--card-border)",
    background: "var(--surface)", color: "var(--text)", fontSize: 20,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    opacity: rowHovered ? 1 : 0, transition: "opacity 0.2s ease",
    zIndex: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.12)", lineHeight: 1,
  });

  return (
    <div className="stagger-item" style={{ marginBottom: 40, animationDelay: `${animationDelay}s` }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {dot && <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, marginBottom: 2 }} />}
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>{title}</p>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--accent)", fontFamily: "var(--font-sans)", padding: "0 0 3px", flexShrink: 0 }}>
            See All →
          </button>
        )}
      </div>
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
      >
        <button onClick={() => scroll(-1)} aria-label="Scroll left" style={scrollArrowStyle("left")}>‹</button>
        <div
          ref={scrollRef}
          style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        >
          {flyers.map((f, i) => <PosterCard key={f.id} flyer={f} onQuickLook={() => onQuickLook(f)} animationDelay={animationDelay + i * 0.04} />)}
        </div>
        <button onClick={() => scroll(1)} aria-label="Scroll right" style={scrollArrowStyle("right")}>›</button>
      </div>
    </div>
  );
}
