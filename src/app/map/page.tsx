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
  collapsed: "calc(100dvh - 100px)",
  half:      "50dvh",
  full:      "5dvh",
};

const SNAP_PX = (snap: SnapPoint): number => {
  const h = window.innerHeight;
  if (snap === "collapsed") return h - 100;
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
  const [snap,      setSnap]      = useState<SnapPoint>("half");
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

  const sheetRef   = useRef<HTMLDivElement>(null);
  const listRef    = useRef<HTMLDivElement>(null);
  const cardRefs   = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef    = useRef<{ startY: number; startTranslate: number } | null>(null);
  const isDragging = useRef(false);

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

  // ── Sheet position (imperative — never set via JSX style to avoid re-render conflicts) ──
  useLayoutEffect(() => {
    if (!sheetRef.current) return;
    sheetRef.current.style.transform  = `translateY(${SNAP_CSS["half"]})`;
    sheetRef.current.style.transition = "transform 0.38s cubic-bezier(0.32,0.72,0,1)";
  }, []);

  const animateTo = useCallback((point: SnapPoint) => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 0.38s cubic-bezier(0.32,0.72,0,1)";
      sheetRef.current.style.transform  = `translateY(${SNAP_CSS[point]})`;
    }
    setSnap(point);
  }, []);

  // ── Pin click → snap half + scroll to card ────────────────────────────────────
  const handlePinClick = useCallback((pin: FlyerPin) => {
    setSelectedId(pin.flyerId);
    animateTo("half");
    setTimeout(() => {
      cardRefs.current.get(pin.flyerId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 420);
  }, [animateTo]);

  // ── Drag ──────────────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const matrix = new DOMMatrix(getComputedStyle(sheet).transform);
    dragRef.current = { startY: e.touches[0].clientY, startTranslate: matrix.m42 };
    sheet.style.transition = "none";
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current || !sheetRef.current) return;
    const dy  = e.touches[0].clientY - dragRef.current.startY;
    const newY = Math.max(SNAP_PX("full"), Math.min(SNAP_PX("collapsed"), dragRef.current.startTranslate + dy));
    sheetRef.current.style.transform = `translateY(${newY}px)`;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragRef.current || !sheetRef.current) return;
    const dy      = e.changedTouches[0].clientY - dragRef.current.startY;
    const finalY  = dragRef.current.startTranslate + dy;
    const nearest = nearestSnap(finalY);
    isDragging.current = false;
    dragRef.current    = null;
    animateTo(nearest);
  };

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

      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          height: "100dvh",
          background: "var(--surface)",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
          zIndex: 20,
        }}
      >
        {/* Drag handle + header */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={() => animateTo(snap === "collapsed" ? "half" : snap === "half" ? "full" : "half")}
          style={{ flexShrink: 0, cursor: "pointer", userSelect: "none", padding: "10px 16px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, width: "100%" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}>
              {flyers.length === 0 ? "Loading…" : `${filtered.length} flyer${filtered.length !== 1 ? "s" : ""}`}
            </p>
            {search && filtered.length !== flyers.length && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>
                of {flyers.length}
              </p>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "4px 16px 10px", flexShrink: 0 }}>
          <div style={{ background: "var(--bg)", borderRadius: 12, border: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "var(--muted)" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => { if (snap === "collapsed") animateTo("half"); }}
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
