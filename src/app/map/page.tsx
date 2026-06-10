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
  half:      "30dvh",
  full:      "10dvh",
};

const SNAP_PX = (snap: SnapPoint): number => {
  const h = window.innerHeight;
  if (snap === "collapsed") return h;
  if (snap === "half")      return h * 0.3;
  return h * 0.1;
};

const nearestSnap = (y: number): SnapPoint => {
  const points: SnapPoint[] = ["collapsed", "half", "full"];
  return points.reduce((best, p) =>
    Math.abs(y - SNAP_PX(p)) < Math.abs(y - SNAP_PX(best)) ? p : best
  );
};

type RawHotspot = { type: string; label?: string; value: string; lat?: number; lng?: number };

const CHICAGO_BBOX = "-87.94,41.64,-87.52,42.02";

type PhotonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    osm_id: number; osm_type: string;
    name?: string; housenumber?: string; street?: string;
    district?: string; locality?: string; city?: string;
    state?: string; postcode?: string; country?: string;
  };
};

function formatSuggestion(f: PhotonFeature): { title: string; subtitle: string } {
  const p = f.properties;
  let title = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street ?? p.name ?? "Unknown location";
  const sub: string[] = [];
  if (p.district) sub.push(p.district);
  if (p.locality && p.locality !== p.district) sub.push(p.locality);
  return { title, subtitle: sub.length > 0 ? `${sub.join(", ")} · Chicago, IL` : "Chicago, IL" };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  const [mode,            setMode]            = useState<"flyers" | "shelters">("shelters");
  const [selectedShelterSiteId, setSelectedShelterSiteId] = useState<number | null>(null);
  const [addressInput,    setAddressInput]    = useState("");
  const [suggestions,     setSuggestions]     = useState<PhotonFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding,       setGeocoding]       = useState(false);
  const [addressError,    setAddressError]    = useState("");

  const sheetRef       = useRef<HTMLDivElement>(null);
  const listRef        = useRef<HTMLDivElement>(null);
  const dragRef        = useRef<{ startY: number; startTranslate: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modeRef        = useRef<"flyers" | "shelters">("flyers");
  useEffect(() => { modeRef.current = mode; }, [mode]);

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

  // ── Global key capture → focus search / Escape → collapse ────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        animateTo("collapsed");
        (e.target as HTMLElement)?.blur?.();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (modeRef.current !== "flyers") return;
      animateTo("full");
      searchInputRef.current?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [animateTo]);

  // ── Photon autocomplete for shelter location ──────────────────────────────────
  useEffect(() => {
    const q = addressInput.trim();
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&bbox=${CHICAGO_BBOX}&lang=en`
        );
        const data: { features: PhotonFeature[] } = await res.json();
        const seen = new Set<string>();
        const unique = (data.features ?? []).filter(f => {
          const key = `${f.properties.osm_type}${f.properties.osm_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSuggestions(unique);
        setShowSuggestions(unique.length > 0);
      } catch { /* silent */ }
    }, 350);
    return () => clearTimeout(timer);
  }, [addressInput]);

  const applyLocation = (lat: number, lng: number) => {
    setUserLat(lat);
    setUserLng(lng);
    setShelters(prev => prev.map(s => ({ ...s, distance: haversine(lat, lng, s.lat, s.lng) })));
  };

  const selectSuggestion = (f: PhotonFeature) => {
    const [lng, lat] = f.geometry.coordinates;
    applyLocation(lat, lng);
    setAddressInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setAddressError("");
  };

  const geocodeAddress = async () => {
    const q = addressInput.trim();
    if (!q) return;
    setGeocoding(true);
    setAddressError("");
    setShowSuggestions(false);
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&bbox=${CHICAGO_BBOX}&lang=en`
      );
      const data: { features: PhotonFeature[] } = await res.json();
      if (!data.features?.length) { setAddressError("Address not found in Chicago."); return; }
      const [lng, lat] = data.features[0].geometry.coordinates;
      applyLocation(lat, lng);
      setAddressInput("");
    } catch {
      setAddressError("Search failed. Please try again.");
    } finally {
      setGeocoding(false);
    }
  };

  // ── Debounced search → animated ellipsis ─────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    if (!search) { setDebouncedSearch(""); return; }
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const isSearchTyping = search !== "" && search !== debouncedSearch;

  // ── Pin click → open QuickLook ────────────────────────────────────────────────
  const handlePinClick = useCallback((pin: FlyerPin) => {
    const flyer = flyers.find(f => f.id === pin.flyerId);
    animateTo("full");
    if (flyer) { setPreviewInitialSearch(""); setQuickLook(flyer); }
  }, [animateTo, flyers]);

  // ── Filtered flyers ───────────────────────────────────────────────────────────
  const pinnedIds = useMemo(() => new Set(flyerPins.map(p => p.flyerId)), [flyerPins]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return flyers.filter(f => {
      const matchSearch = !q ||
        f.title.toLowerCase().includes(q) ||
        f.entity?.toLowerCase().includes(q) ||
        (f.hotspots ?? []).some(h => h.value.toLowerCase().includes(q) || h.label?.toLowerCase().includes(q));
      const matchTags = activeTags.length === 0 || activeTags.some(t => f.tags?.includes(t));
      const matchEntities = activeEntities.length === 0 || (f.entity != null && activeEntities.includes(f.entity));
      return matchSearch && matchTags && matchEntities;
    });
  }, [flyers, debouncedSearch, activeTags, activeEntities]);

  const showGrouped = debouncedSearch !== "" || activeTags.length > 0;

  const flyerGroups: FlyerGroup[] = useMemo(() => showGrouped ? filtered.map(f => {
    const q = debouncedSearch.toLowerCase();
    const matchingHotspots = debouncedSearch !== ""
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
  }) : [], [showGrouped, filtered, debouncedSearch, activeTags]);

  const sortedShelters = useMemo(() =>
    userLat !== null
      ? [...shelters].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      : [...shelters].sort((a, b) => (a.agency ?? "").localeCompare(b.agency ?? "")),
  [shelters, userLat]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Map */}
      <div style={{ position: "fixed", inset: 0 }}>
        <MapView
          userLat={userLat} userLng={userLng}
          shelters={shelters} flyerPins={flyerPins}
          onFlyerPinClick={handlePinClick}
          selectedShelterSiteId={selectedShelterSiteId}
          isDark={isDark}
        />
      </div>

      {/* Map overlay controls — top left */}
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 25, display: "flex", gap: 8 }}>
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
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
        {/* Mode toggles */}
        {([
          { m: "shelters" as const, color: "#3b82f6", icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 3L3 9h2v8h4v-5h2v5h4V9h2L10 3z" fill="currentColor"/></svg> },
          { m: "flyers"   as const, color: "#eab308", icon: <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="1.8" fill="currentColor"/><rect x="8.6" y="9.5" width="2.8" height="6.5" rx="1.2" fill="currentColor"/></svg> },
        ]).map(({ m, color, icon }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-label={m === "flyers" ? "Flyers mode" : "Shelters mode"}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: mode === m ? color : "var(--bar-bg)",
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              border: "1.5px solid var(--bar-border)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: mode === m ? "#fff" : "var(--muted)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {icon}
          </button>
        ))}
      </div>

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
          style={{ flexShrink: 0, padding: "10px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, touchAction: "none", cursor: "grab", userSelect: "none" }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--card-border)" }} />
          {snap !== "collapsed" && (
            <div style={{ width: "100%" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                Find the right resource.
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400, color: "var(--muted)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                {mode === "shelters"
                  ? shelters.length === 0 ? "Loading…" : userLat !== null ? `${shelters.length} shelters, sorted by distance.` : `${shelters.length} shelters in Chicago.`
                  : flyers.length === 0 ? "Loading…" : showGrouped ? `${flyerGroups.length} result${flyerGroups.length !== 1 ? "s" : ""} of ${flyers.length}` : `Browse ${flyers.length} flyer${flyers.length !== 1 ? "s" : ""} below.`}
              </p>
            </div>
          )}
        </div>

        {/* Search bar — contextual */}
        <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
          {mode === "flyers" ? (
            <div style={{ background: "var(--bg)", borderRadius: 99, border: "1.5px solid var(--card-border)", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "var(--muted)" }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => animateTo("full")}
                onKeyDown={e => { if (e.key === "Escape") { animateTo("collapsed"); e.currentTarget.blur(); } }}
                placeholder="Search flyers…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, fontFamily: "var(--font-sans)", color: "var(--text)" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: 0, lineHeight: 1, display: "flex" }}>×</button>
              )}
            </div>
          ) : (
            <div style={{ background: "var(--bg)", borderRadius: 99, border: "1.5px solid var(--card-border)", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "var(--muted)" }}>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                value={addressInput}
                onChange={e => { setAddressInput(e.target.value); setAddressError(""); }}
                onFocus={() => { animateTo("full"); if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={e => {
                  if (e.key === "Enter") geocodeAddress();
                  if (e.key === "Escape") { setShowSuggestions(false); setAddressInput(""); }
                }}
                placeholder="Enter an address in Chicago…"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, fontFamily: "var(--font-sans)", color: "var(--text)" }}
              />
              {geocoding && <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)", flexShrink: 0 }}>Searching…</span>}
              {addressInput && !geocoding && (
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setAddressInput(""); setSuggestions([]); setShowSuggestions(false); setAddressError(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: 0, lineHeight: 1, display: "flex" }}
                >×</button>
              )}
            </div>
          )}
        </div>

        {/* Card list — contextual */}
        <div ref={listRef} className="sheet-list" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px", overscrollBehavior: "contain", touchAction: "pan-y", maxHeight: snap === "half" ? "calc(70dvh - 150px)" : undefined } as React.CSSProperties}>
          {mode === "flyers" ? (
            isSearchTyping ? (
              <div style={{ display: "flex", justifyContent: "center", gap: 7, paddingTop: 32 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--muted)", animation: "searchDot 1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            ) : showGrouped ? (
              <GroupedResults
                flyerGroups={flyerGroups}
                search={debouncedSearch}
                activeEntities={activeEntities}
                onQuickLook={(flyer, initialSearch = "") => { setPreviewInitialSearch(initialSearch); setQuickLook(flyer); }}
                onPreview={(flyer, initialSearch = "") => { setPreviewInitialSearch(initialSearch); setPreview(flyer); }}
              />
            ) : snap === "half" ? (
              <SectionRow
                title="Our Top Picks"
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
                    flyers={topPickFlyers.length > 0 ? topPickFlyers : flyers.slice(0, 8)}
                    animationDelay={0.10}
                    onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
                  />
                )}
              </>
            )
          ) : (
            <>
              {/* Autocomplete suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden", border: "1.5px solid var(--card-border)" }}>
                  {suggestions.map((f, i) => {
                    const { title, subtitle } = formatSuggestion(f);
                    return (
                      <button
                        key={`${f.properties.osm_type}${f.properties.osm_id}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => selectSuggestion(f)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "flex-start",
                          width: "100%", padding: "10px 14px",
                          background: "var(--bg)", border: "none",
                          borderBottom: i < suggestions.length - 1 ? "1px solid var(--card-border)" : "none",
                          cursor: "pointer", textAlign: "left",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--card-bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "var(--bg)")}
                      >
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>{title}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)", marginTop: 2 }}>{subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Address error */}
              {addressError && (
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#ef4444", fontFamily: "var(--font-sans)" }}>{addressError}</p>
              )}
              {/* Shelter list */}
              {shelters.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 14, fontFamily: "var(--font-sans)" }}>Loading shelters…</p>
              ) : (
                <div>
                  {sortedShelters.map((s, i) => {
                    const initials = (s.agency ?? s.site_name ?? "?").charAt(0).toUpperCase();
                    return (
                    <div key={s.site_id} style={{ padding: "12px 0", borderBottom: i < sortedShelters.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Circular image */}
                        <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "var(--card-border)" }}>
                          {s.image_url
                            ? <img src={s.image_url} alt={s.agency ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "var(--muted)" }}>{initials}</div>
                          }
                        </div>
                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {s.agency && <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>{s.agency}</p>}
                          {s.site_name && s.site_name !== s.agency && <p style={{ margin: "3px 0 0", fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>{s.site_name}</p>}
                          {s.distance !== undefined && (
                            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>
                              {s.distance < 0.1 ? "<0.1" : s.distance.toFixed(1)} mi away
                            </p>
                          )}
                        </div>
                        {/* Route button */}
                        <button
                          onClick={() => { animateTo("half"); setSelectedShelterSiteId(s.site_id); }}
                          aria-label="Show on map"
                          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.51c0 .71.73 1.2 1.39.91z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
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
        .sheet-list { scrollbar-width: none; -ms-overflow-style: none; }
        .sheet-list::-webkit-scrollbar { display: none; }
        @keyframes searchDot {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
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
