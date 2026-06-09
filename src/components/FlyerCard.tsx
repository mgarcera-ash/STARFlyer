"use client";
import { useEffect, useRef, useState } from "react";
import type { Flyer, Hotspot } from "@/types/flyer";

// Tracks URLs that have already been loaded this session — survives remounts
const loadedImageUrls = new Set<string>();

export default function FlyerCard({ flyer, search, showEntity, onQuickLook, onPreview, animationDelay = 0 }: {
  flyer: Flyer;
  search: string;
  showEntity: boolean;
  onQuickLook: (initialSearch?: string) => void;
  onPreview: (initialSearch?: string) => void;
  animationDelay?: number;
}) {
  const [pressed, setPressed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(() =>
    flyer.image_url ? loadedImageUrls.has(flyer.image_url) : true
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // Catch cached images that won't fire onLoad
  useEffect(() => {
    if (imgRef.current?.complete && flyer.image_url) {
      loadedImageUrls.add(flyer.image_url);
      setImgLoaded(true);
    }
  }, [flyer.image_url]);

  return (
    <div
      className="stagger-item"
      onMouseLeave={() => setPressed(false)}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div
        onClick={() => {
          const q = search.toLowerCase();
          const hasMatch = q && flyer.hotspots?.some(s =>
            s.label?.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
          );
          if (hasMatch) {
            onPreview(search);
          } else {
            onQuickLook();
          }
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--card-bg)",
          borderRadius: 52,
          padding: "10px 20px 10px 10px",
          cursor: "pointer",
          transform: pressed ? "scale(0.98) translateZ(0)" : "scale(1) translateZ(0)",
          transition: "transform 0.15s ease-out",
        }}
      >
        {/* Circular image */}
        <div
          style={{ position: "relative", flexShrink: 0, width: 64, height: 64, borderRadius: "50%", overflow: "hidden" }}
        >
          {/* Skeleton */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "var(--border)",
            opacity: imgLoaded ? 0 : 1,
            transition: "opacity 0.4s ease",
          }} />
          {flyer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={flyer.image_url}
              alt={flyer.title}
              onLoad={() => { if (flyer.image_url) loadedImageUrls.add(flyer.image_url); setImgLoaded(true); }}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.4s ease" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
              <span style={{ fontSize: "2em", fontWeight: 700, color: "var(--accent)", opacity: 0.45, fontFamily: "var(--font-sans)" }}>
                {flyer.title.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Entity + Title + matched contact snippet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(() => {
            const q = search.toLowerCase();
            const match = q ? flyer.hotspots?.find(s =>
              s.label?.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
            ) : null;
            const matchCircle: Record<Hotspot["type"], { bg: string; icon: React.ReactNode }> = {
              phone: { bg: "#22c55e", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg> },
              sms: { bg: "#06b6d4", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V3z" fill="#fff"/></svg> },
              email: { bg: "rgba(251,191,36,0.18)", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" fill="#f97316"/><path d="M2 4l6 5 6-5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg> },
              address: { bg: "rgba(59,130,246,0.12)", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#ef4444"/></svg> },
              website: { bg: "rgba(99,102,241,0.1)", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="#6366f1" strokeWidth="1.2"/><path d="M8 2.5c-1.5 1.5-1.5 9.5 0 11M8 2.5c1.5 1.5 1.5 9.5 0 11" stroke="#6366f1" strokeWidth="1.2"/><path d="M2.5 8h11" stroke="#6366f1" strokeWidth="1.2"/></svg> },
            };
            return (
              <>
                {match ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, fontFamily: "var(--font-sans)", color: "var(--text)", lineHeight: 1.3, margin: 0 }}>
                      {flyer.title}
                    </p>
                    <div style={{
                      display: "flex", flexDirection: "column", gap: 1,
                      borderLeft: "2px solid rgba(0,0,0,0.15)",
                      paddingLeft: 8, marginLeft: 2,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                          background: matchCircle[match.type].bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {matchCircle[match.type].icon}
                        </div>
                        {match.label && (
                          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
                            {match.label}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", fontFamily: "var(--font-sans)", lineHeight: 1.4 }}>
                        {match.value}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {flyer.entity && (
                      <p style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-sans)", color: "var(--muted)", lineHeight: 1.3, margin: 0 }}>
                        {flyer.entity}
                      </p>
                    )}
                    <p style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font-sans)", color: "var(--text)", lineHeight: 1.4, margin: 0 }}>
                      {flyer.title}
                    </p>
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
