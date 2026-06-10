"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Flyer, Hotspot } from "@/types/flyer";
import type { FlyerPin, Shelter } from "@/app/around/MapView";
import QuickLook from "@/components/QuickLook";
import FlyerPreview from "@/components/FlyerPreview";
import FeaturedCard from "@/components/FeaturedCard";
import SectionRow from "@/components/SectionRow";
import GroupedResults, { type FlyerGroup } from "@/components/GroupedResults";

const MapView = dynamic(() => import("@/app/around/MapView"), { ssr: false });

type SnapPoint = "collapsed" | "half" | "full";

const SNAP_CSS: Record<SnapPoint, string> = {
  collapsed: "100dvh",
  half:      "50dvh",
  full:      "5dvh",
};

const SNAP_PX = (snap: SnapPoint): number => {
  const h = window.innerHeight;
  if (snap === "collapsed") return h;
  if (snap === "half")      return h * 0.5;
  return h * 0.05;
};

const nearestSnap = (y: number): SnapPoint => {
  const points: SnapPoint[] = ["collapsed", "half", "full"];
  return points.reduce((best, p) =>
    Math.abs(y - SNAP_PX(p)) < Math.abs(y - SNAP_PX(best)) ? p : best
  );
};

type RawHotspot = { type: string; label?: string; value: string; lat?: number; lng?: number };

export default function MapPage() {
  const [flyers,    setFlyers]    = useState<Flyer[]>([]);
  const [shelters,  setShelters]  = useState<Shelter[]>([]);
  const [flyerPins, setFlyerPins] = useState<FlyerPin[]>([]);
  const [userLat,   setUserLat]   = useState<number | null>(null);
  const [userLng,   setUserLng]   = useState<number | null>(null);
  const [isDark,    setIsDark]    = useState(false);
  const [snap,      setSnap]      = useState<SnapPoint>("full");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickLook, setQuickLook] = useState<Flyer | null>(null);
  const [preview,   setPreview]   = useState<Flyer | null>(null);
  const [search,    setSearch]    = useState("");

  const [featuredFlyers,  setFeaturedFlyers]  = useState<Flyer[]>([]);
  const [topPickFlyers,   setTopPickFlyers]   = useState<Flyer[]>([]);
  const [allTags,         setAllTags]         = useState<string[]>([]);
  const [allEntities,     setAllEntities]     = useState<string[]>([]);
  const [activeTags,      setActiveTags]      = useState<string[]>([]);
  const [activeEntities,  setActiveEntities]  = useState<string[]>([]);
  const [previewInitialSearch, setPreviewInitialSearch] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<{ startY: number; startTranslate: number } | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("flyers")
      .select("*")
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const list = data as Flyer[];
        setFlyers(list);
        const pins: FlyerPin[] = list.flatMap(f => {
          const hs = ((f.hotspots ?? []) as RawHotspot[]);
          return hs
            .filter(h => h.type === "address" && h.lat != null && h.lng != null)
            .map((h, i) => ({
              pinId: `${f.id}-${i}`,
              flyerId: f.id,
              lat: h.lat!,
              lng: h.lng!,
              title: f.title,
              entity: f.entity,
              image_url: f.image_url,
              addressLabel: h.label,
              allHotspots: hs,
            }));
        });
        setFlyerPins(pins);
        setFeaturedFlyers(list.filter(f => f.featured));
        setTopPickFlyers(list.filter(f => f.top_pick));
        const tags = [...new Set(list.flatMap(f => f.tags ?? []))].sort();
        setAllTags(tags);
        const entities = [...new Set(list.map(f => f.entity).filter(Boolean) as string[])].sort();
        setAllEntities(entities);
      });

    fetch("/api/shelters/all")
      .then(r => r.json())
      .then(d => setShelters(d.shelters ?? []))
      .catch(() => {});
  }, []);

  // ── Dark mode ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored) setIsDark(stored === "dark");
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setIsDark(true);
    const handle = (e: StorageEvent) => { if (e.key === "theme") setIsDark(e.newValue === "dark"); };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  };

  // ── Desktop detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Sheet position (imperative — never set via JSX style to avoid re-render conflicts) ──
  useLayoutEffect(() => {
    if (!sheetRef.current) return;
    sheetRef.current.style.transform  = `translateY(${SNAP_CSS["full"]})`;
    sheetRef.current.style.transition = "transform 0.38s cubic-bezier(0.32,0.72,0,1)";
  }, []);

  const animateTo = useCallback((point: SnapPoint) => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 0.38s cubic-bezier(0.32,0.72,0,1)";
      sheetRef.current.style.transform  = `translateY(${SNAP_CSS[point]})`;
    }
    setSnap(point);
  }, []);

  // ── Drag ──────────────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const matrix = new DOMMatrix(getComputedStyle(sheet).transform);
    dragRef.current = { startY: e.touches[0].clientY, startTranslate: matrix.m42 };
    sheet.style.transition = "none";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current || !sheetRef.current) return;
    const dy   = e.touches[0].clientY - dragRef.current.startY;
    const newY = Math.max(SNAP_PX("full"), Math.min(SNAP_PX("collapsed"), dragRef.current.startTranslate + dy));
    sheetRef.current.style.transform = `translateY(${newY}px)`;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragRef.current || !sheetRef.current) return;
    const finalY = dragRef.current.startTranslate + (e.changedTouches[0].clientY - dragRef.current.startY);
    dragRef.current = null;
    animateTo(nearestSnap(finalY));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    e.preventDefault();
    const matrix = new DOMMatrix(getComputedStyle(sheet).transform);
    dragRef.current = { startY: e.clientY, startTranslate: matrix.m42 };
    sheet.style.transition = "none";
    sheet.style.cursor = "grabbing";

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !sheetRef.current) return;
      const dy   = ev.clientY - dragRef.current.startY;
      const newY = Math.max(SNAP_PX("full"), Math.min(SNAP_PX("collapsed"), dragRef.current.startTranslate + dy));
      sheetRef.current.style.transform = `translateY(${newY}px)`;
    };
    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current || !sheetRef.current) return;
      const finalY = dragRef.current.startTranslate + (ev.clientY - dragRef.current.startY);
      dragRef.current = null;
      if (sheetRef.current) sheetRef.current.style.cursor = "";
      animateTo(nearestSnap(finalY));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Pin click → open QuickLook ────────────────────────────────────────────────
  const handlePinClick = useCallback((pin: FlyerPin) => {
    const flyer = flyers.find(f => f.id === pin.flyerId);
    animateTo("full");
    if (flyer) { setPreviewInitialSearch(""); setQuickLook(flyer); }
  }, [animateTo, flyers]);

  // ── Filtered flyers ───────────────────────────────────────────────────────────
  const pinnedIds = useMemo(() => new Set(flyerPins.map(p => p.flyerId)), [flyerPins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flyers.filter(f => {
      const matchSearch = !q ||
        f.title.toLowerCase().includes(q) ||
        f.entity?.toLowerCase().includes(q) ||
        (f.hotspots ?? []).some(h => h.value.toLowerCase().includes(q) || h.label?.toLowerCase().includes(q));
      const matchTags = activeTags.length === 0 || activeTags.some(t => f.tags?.includes(t));
      const matchEntities = activeEntities.length === 0 || (f.entity != null && activeEntities.includes(f.entity));
      return matchSearch && matchTags && matchEntities;
    });
  }, [flyers, search, activeTags, activeEntities]);

  const showGrouped = search !== "" || activeTags.length > 0;

  const flyerGroups: FlyerGroup[] = useMemo(() => showGrouped ? filtered.map(f => {
    const q = search.toLowerCase();
    const matchingHotspots = search !== ""
      ? (f.hotspots?.filter(h => h.label?.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)) ?? [])
      : (f.hotspots?.filter(h => activeTags.some(tag =>
          h.label?.toLowerCase().includes(tag.toLowerCase()) || h.value.toLowerCase().includes(tag.toLowerCase())
        )) ?? []);
    const hotspotsByType: Partial<Record<Hotspot["type"], Hotspot[]>> = {};
    for (const h of matchingHotspots) {
      if (!hotspotsByType[h.type]) hotspotsByType[h.type] = [];
      hotspotsByType[h.type]!.push(h);
    }
    return { flyer: f, hotspotsByType, isFallback: matchingHotspots.length === 0 };
  }) : [], [showGrouped, filtered, search, activeTags]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Map */}
      <div style={{ position: "fixed", inset: 0 }}>
        <MapView
          userLat={userLat} userLng={userLng}
          shelters={shelters} flyerPins={flyerPins}
          onFlyerPinClick={handlePinClick}
          isDark={isDark}
        />
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 25,
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--bar-bg)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1.5px solid var(--bar-border)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text)",
        }}
      >
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed", left: isDesktop ? "25%" : 0, right: isDesktop ? "25%" : 0, bottom: 0,
          height: "100dvh",
          background: "var(--bar-bg)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderRadius: "32px 32px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
          zIndex: 20,
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          style={{ flexShrink: 0, padding: snap === "half" ? "10px 16px 16px" : "10px 16px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, touchAction: "none", cursor: "grab", userSelect: "none" }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)" }} />
          {snap === "half" && (
            <div style={{ width: "100%" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                Find the right resource.
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400, color: "var(--muted)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                {flyers.length === 0 ? "Loading…" : `Browse ${flyers.length} flyer${flyers.length !== 1 ? "s" : ""} below.`}
              </p>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
          <div style={{ background: "var(--bg)", borderRadius: 99, border: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "var(--muted)" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); animateTo("full"); }}
              onFocus={() => animateTo("full")}
              placeholder="Search flyers…"
              style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, fontFamily: "var(--font-sans)", color: "var(--text)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: 0, lineHeight: 1, display: "flex" }}>×</button>
            )}
          </div>
        </div>

        {/* Card list */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
          {showGrouped ? (
            <GroupedResults
              flyerGroups={flyerGroups}
              search={search}
              activeEntities={activeEntities}
              onQuickLook={(flyer, initialSearch = "") => { setPreviewInitialSearch(initialSearch); setQuickLook(flyer); }}
              onPreview={(flyer, initialSearch = "") => { setPreviewInitialSearch(initialSearch); setPreview(flyer); }}
            />
          ) : snap === "half" ? (
            <SectionRow
              title="Our Top Picks"
              dot="#eab308"
              flyers={topPickFlyers.length > 0 ? topPickFlyers : flyers.slice(0, 8)}
              animationDelay={0}
              onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
            />
          ) : (
            <>
              <FeaturedCard
                flyers={featuredFlyers.length > 0 ? featuredFlyers : flyers.slice(0, 5)}
                animationDelay={0}
                onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
              />
              <SectionRow
                title="Recently Added"
                dot="#3b82f6"
                flyers={flyers.slice(0, 8)}
                animationDelay={0.05}
                onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
              />
              {(topPickFlyers.length > 0 || flyers.length > 0) && (
                <SectionRow
                  title="Our Top Picks"
                  dot="#eab308"
                  flyers={topPickFlyers.length > 0 ? topPickFlyers : flyers.slice(0, 8)}
                  animationDelay={0.10}
                  onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {snap === "collapsed" && (
        <button
          onClick={() => animateTo("full")}
          style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
            zIndex: 30, borderRadius: 99, padding: "10px 20px",
            background: "var(--bar-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid var(--bar-border)",
            color: "var(--text)", fontSize: 14, fontWeight: 600,
            fontFamily: "var(--font-sans)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 3L2 11h12L8 3z" fill="currentColor"/></svg>
          Flyers
        </button>
      )}

      {quickLook && (
        <QuickLook
          flyer={quickLook}
          onClose={() => setQuickLook(null)}
          onExpand={() => { setPreview(quickLook); setQuickLook(null); }}
        />
      )}
      {preview && (
        <FlyerPreview flyer={preview} initialSearch={previewInitialSearch} onClose={() => setPreview(null)} />
      )}

      <style>{`
        html { overscroll-behavior: none; }
        .flyer-popup .leaflet-popup-content-wrapper {
          background: #1c1c1e;
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 0;
          box-shadow: 0 8px 32px rgba(0,0,0,0.45);
          overflow: hidden;
        }
        .flyer-popup .leaflet-popup-content { margin: 0; }
        .flyer-popup .leaflet-popup-tip { background: #1c1c1e; }
      `}</style>
    </>
  );
}
