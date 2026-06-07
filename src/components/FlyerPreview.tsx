"use client";
import { useEffect, useRef, useState } from "react";
import { FaSafari, FaSms } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import type { Flyer, Hotspot } from "@/types/flyer";

export default function FlyerPreview({ flyer, initialSearch = "", onClose }: {
  flyer: Flyer;
  initialSearch?: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(!!initialSearch);
  const [contactSearch, setContactSearch] = useState(initialSearch);
  const [contactFilter, setContactFilter] = useState<"all" | "phone" | "sms" | "email" | "address" | "website">("all");
  const hasHotspots = (flyer.hotspots?.length ?? 0) > 0;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const clampPan = (x: number, y: number, z: number) => {
    const maxX = (window.innerWidth * (z - 1)) / 2;
    const maxY = (window.innerHeight * (z - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const startDrag = (clientX: number, clientY: number) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragRef.current = { startX: clientX, startY: clientY, panX: pan.x, panY: pan.y };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragRef.current) return;
    setPan(clampPan(
      dragRef.current.panX + (clientX - dragRef.current.startX),
      dragRef.current.panY + (clientY - dragRef.current.startY),
      zoom,
    ));
  };

  const endDrag = () => { setIsDragging(false); dragRef.current = null; };

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    const handleKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setSheetOpen(false);
    setContactSearch("");
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setOpen(false);
    setTimeout(onClose, 300);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!flyer.image_url) return;
    const res = await fetch(flyer.image_url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flyer.title}.${blob.type.split("/")[1] || "jpg"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "#0a0a0a",
      opacity: open ? 1 : 0,
      transition: "opacity 0.3s ease",
    }}>
      {/* Full-screen image */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          touchAction: zoom > 1 ? "none" : "auto",
          userSelect: "none",
        }}
        onMouseDown={e => startDrag(e.clientX, e.clientY)}
        onMouseMove={e => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={e => { if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={e => { if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={endDrag}
      >
        {flyer.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flyer.image_url} alt={flyer.title}
            draggable={false}
            style={{
              width: "100%", height: "100%", objectFit: "contain",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease",
              pointerEvents: "none",
            }}
          />
        ) : (
          <span style={{ fontSize: 120, fontWeight: 700, color: "var(--accent)", opacity: 0.2, fontFamily: "var(--font-sans)" }}>
            {flyer.title.charAt(0)}
          </span>
        )}
      </div>

      {/* Zoom slider */}
      <div style={{
        position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
        width: "calc(100% - 48px)", maxWidth: 380,
        background: "rgba(20,20,20,0.85)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderRadius: 52,
        border: "2px solid rgba(255,255,255,0.12)",
        padding: "14px 22px",
        display: "flex", alignItems: "center", gap: 14,
        opacity: open ? 1 : 0,
        transition: "opacity 0.35s ease 0.1s",
        zIndex: 10,
      }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
          <path d="M3 8h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="range" min={1} max={3} step={0.05}
          value={zoom}
          onChange={e => {
            const v = parseFloat(e.target.value);
            setZoom(v);
            if (v === 1) setPan({ x: 0, y: 0 });
          }}
          className="zoom-slider"
          style={{ flex: 1 }}
        />
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
          <path d="M8 3v10M3 8h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
          color: "#fff", minWidth: 34, textAlign: "right", flexShrink: 0,
        }}>{zoom.toFixed(1)}×</span>
      </div>

      {sheetOpen && (
        <div
          onClick={() => { setSheetOpen(false); setContactSearch(""); }}
          style={{ position: "absolute", inset: 0, zIndex: 9 }}
        />
      )}

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 20, left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 48px)", maxWidth: 440,
        display: "flex", alignItems: "center", gap: 8,
        opacity: open ? 1 : 0,
        transition: "opacity 0.35s ease 0.1s",
        zIndex: 10,
      }}>
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            flexShrink: 0, width: 44, height: 44, borderRadius: "50%",
            background: "#dc2626", border: "none",
            color: "#fff", fontSize: 22, lineHeight: 1,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s", fontFamily: "var(--font-sans)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#991b1b")}
          onMouseLeave={e => (e.currentTarget.style.background = "#dc2626")}
        >×</button>

        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {/* Contacts panel */}
          <div style={{
            position: "absolute", top: "calc(100% + 10px)", left: 0, right: 0,
            background: "rgba(20,20,20,0.85)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            borderRadius: 28,
            border: "2px solid rgba(255,255,255,0.12)",
            overflow: "hidden",
            height: 320,
            display: "flex", flexDirection: "column",
            opacity: sheetOpen ? 1 : 0,
            filter: sheetOpen ? "blur(0px)" : "blur(12px)",
            transform: sheetOpen ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
            pointerEvents: sheetOpen ? "auto" : "none",
            transition: "opacity 0.25s ease, filter 0.25s ease, transform 0.25s ease",
          }}>
            {hasHotspots && (() => {
              const allSegments = [
                { key: "all" as const, label: "All", activeBg: "rgba(255,255,255,0.2)", activeColor: "#fff" },
                { key: "phone" as const, label: "Phones", activeBg: "#22c55e", activeColor: "#fff" },
                { key: "sms" as const, label: "SMS", activeBg: "#06b6d4", activeColor: "#fff" },
                { key: "email" as const, label: "Email", activeBg: "#f97316", activeColor: "#fff" },
                { key: "address" as const, label: "Addresses", activeBg: "#ef4444", activeColor: "#fff" },
                { key: "website" as const, label: "Websites", activeBg: "#3b82f6", activeColor: "#fff" },
              ];
              const segments = allSegments.filter(s => s.key === "all" || flyer.hotspots?.some(h => h.type === s.key));
              return segments.length > 1 ? (
                <div style={{
                  padding: "10px 12px 8px",
                  display: "flex", gap: 6,
                  overflowX: "auto", flexShrink: 0,
                  scrollbarWidth: "none",
                } as React.CSSProperties}>
                  {segments.map(({ key, label, activeBg, activeColor }) => (
                    <button
                      key={key}
                      onClick={() => setContactFilter(key)}
                      style={{
                        flexShrink: 0, padding: "6px 14px", borderRadius: 99,
                        border: `2px solid ${contactFilter === key ? "transparent" : "rgba(255,255,255,0.15)"}`,
                        background: contactFilter === key ? activeBg : "transparent",
                        color: contactFilter === key ? activeColor : "rgba(255,255,255,0.45)",
                        fontSize: 12, fontWeight: 700, fontFamily: "var(--font-sans)",
                        cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >{label}</button>
                  ))}
                </div>
              ) : null;
            })()}

            <div style={{ flex: 1, overflowY: "auto" }}>
              {flyer.hotspots?.filter(spot => {
                const q = contactSearch.toLowerCase();
                const matchesSearch = !q || spot.label?.toLowerCase().includes(q) || spot.value.toLowerCase().includes(q);
                const matchesFilter = contactFilter === "all" || spot.type === contactFilter;
                return matchesSearch && matchesFilter;
              }).map((spot, i) => {
                const spotMeta: Record<Hotspot["type"], { bg: string; icon: React.ReactNode; href: string }> = {
                  phone: {
                    bg: "#22c55e",
                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg>,
                    href: `tel:${spot.value.replace(/\D/g, "")}`,
                  },
                  sms: {
                    bg: "#06b6d4",
                    icon: <FaSms size={16} color="#fff" />,
                    href: `sms:${spot.value.replace(/\D/g, "")}`,
                  },
                  email: {
                    bg: "#f97316",
                    icon: <MdEmail size={16} color="#fff" />,
                    href: `mailto:${spot.value}`,
                  },
                  address: {
                    bg: "rgba(59,130,246,0.12)",
                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#ef4444"/></svg>,
                    href: `https://maps.apple.com/?q=${encodeURIComponent(spot.value)}`,
                  },
                  website: {
                    bg: "#3b82f6",
                    icon: <FaSafari size={16} color="#fff" />,
                    href: spot.value.startsWith("http") ? spot.value : `https://${spot.value}`,
                  },
                };
                const meta = spotMeta[spot.type];
                return (
                  <a
                    key={i}
                    href={meta.href}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: meta.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {meta.icon}
                    </div>
                    <div>
                      {spot.label && (
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-sans)", fontWeight: 500, margin: 0, lineHeight: 1.3 }}>
                          {spot.label}
                        </p>
                      )}
                      <p style={{ fontSize: 15, color: "#fff", fontFamily: "var(--font-sans)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                        {spot.value}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "6px 0 0" }} />
          </div>

          {/* Search + download pill */}
          <div style={{
            background: "rgba(20,20,20,0.85)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            borderRadius: 52,
            border: "2px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center",
            overflow: "hidden",
          }}>
            <input
              type="text"
              placeholder="Search inside this flyer…"
              className="preview-search"
              value={contactSearch}
              onChange={e => {
                setContactSearch(e.target.value);
                if (e.target.value) setSheetOpen(true);
              }}
              onFocus={() => setSheetOpen(true)}
              style={{
                flex: 1, minWidth: 0,
                padding: "14px 20px",
                border: "none", background: "transparent",
                fontSize: 16, fontFamily: "var(--font-sans)", color: "#fff",
                outline: "none", cursor: "text",
              }}
            />
            <button
              onClick={handleDownload}
              style={{
                flexShrink: 0, padding: "14px 18px 14px 14px",
                background: "transparent", border: "none",
                borderLeft: "1px solid rgba(255,255,255,0.18)",
                cursor: "pointer", display: "flex", alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
