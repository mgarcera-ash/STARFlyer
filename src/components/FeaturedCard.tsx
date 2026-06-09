"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Flyer } from "@/types/flyer";

export default function FeaturedCard({ flyers, animationDelay = 0, onQuickLook }: { flyers: Flyer[]; animationDelay?: number; onQuickLook: (f: Flyer) => void }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (flyers.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx(i => (i + 1) % flyers.length); setFading(false); }, 300);
    }, 4500);
  }, [flyers.length]);

  useEffect(() => {
    startInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startInterval]);

  const navigate = useCallback((newIdx: number) => {
    setFading(true);
    setTimeout(() => { setIdx(newIdx); setFading(false); }, 300);
    startInterval();
  }, [startInterval]);

  const flyer = flyers[idx];
  if (!flyer) return null;

  const arrowStyle = (side: "left" | "right"): React.CSSProperties => ({
    position: "absolute", [side]: 12, top: "50%", transform: "translateY(-50%)",
    width: 36, height: 36, borderRadius: "50%", border: "none",
    background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: 22,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    opacity: hovered ? 1 : 0, transition: "opacity 0.2s ease",
    zIndex: 10, fontFamily: "var(--font-sans)", lineHeight: 1,
  });

  return (
    <div className="stagger-item" style={{ marginBottom: 40, animationDelay: `${animationDelay}s` }}>
      <div
        onClick={() => onQuickLook(flyer)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative", width: "100%", paddingBottom: "52%",
          borderRadius: 24, overflow: "hidden", cursor: "pointer",
          background: "#1c1c1e",
        }}
      >
        {flyer.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer.image_url} alt={flyer.title} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            opacity: fading ? 0 : 1, transition: "opacity 0.3s ease",
          }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", maskImage: "linear-gradient(to bottom, transparent 30%, black 60%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 30%, black 60%)" }} />
        <div style={{ position: "absolute", top: 14, left: 14, background: "#3b82f6", borderRadius: 99, padding: "4px 10px" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Featured</p>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px 20px", opacity: fading ? 0 : 1, transition: "opacity 0.3s ease" }}>
          {flyer.entity && <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "0.04em" }}>{flyer.entity}</p>}
          <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em", lineHeight: 1.3 }}>{flyer.title}</p>
        </div>
        {flyers.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); navigate((idx - 1 + flyers.length) % flyers.length); }}
              aria-label="Previous slide"
              style={arrowStyle("left")}
            >‹</button>
            <button
              onClick={e => { e.stopPropagation(); navigate((idx + 1) % flyers.length); }}
              aria-label="Next slide"
              style={arrowStyle("right")}
            >›</button>
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 5, alignItems: "center", zIndex: 10 }}>
              {flyers.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); navigate(i); }}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    height: 5, borderRadius: 99, border: "none", padding: 0, cursor: "pointer",
                    width: i === idx ? 16 : 5,
                    background: i === idx ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "width 0.3s ease",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
