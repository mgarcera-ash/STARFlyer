"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Flyer, Hotspot } from "@/types/flyer";
import type { FlyerPin, PoliceStation, Shelter } from "@/app/around/MapView";
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

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
type ShelterHours = Partial<Record<DayKey, string>>;
const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS: Record<DayKey, string> = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };

function parseTime12(s: string): number {
  const m = s.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return -1;
  const h = parseInt(m[1]), min = parseInt(m[2]), pm = m[3].toUpperCase() === "PM";
  return (pm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h)) + min / 60;
}

function getOpenStatus(hours: ShelterHours): { open: boolean | null; todayHours: string | null } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date());
    const dayKey = (parts.find(p => p.type === "weekday")?.value ?? "").toLowerCase().slice(0, 3) as DayKey;
    const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0");
    const min = parseInt(parts.find(p => p.type === "minute")?.value ?? "0");
    const pm = (parts.find(p => p.type === "dayPeriod")?.value ?? "AM").toUpperCase() === "PM";
    const now = (pm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h)) + min / 60;
    const todayHours = hours[dayKey] ?? null;
    if (!todayHours || todayHours.toLowerCase() === "closed") return { open: false, todayHours: todayHours ?? "Closed" };
    const [a, b] = todayHours.split("–").map(s => s.trim());
    const openH = parseTime12(a), closeH = parseTime12(b);
    if (openH < 0 || closeH < 0) return { open: null, todayHours };
    return { open: now >= openH && now < closeH, todayHours };
  } catch { return { open: null, todayHours: null }; }
}

function groupHours(hours: ShelterHours): { label: string; value: string }[] {
  const short: Record<DayKey, string> = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
  const result: { label: string; value: string }[] = [];
  let i = 0;
  while (i < DAY_KEYS.length) {
    const day = DAY_KEYS[i]; const val = hours[day];
    if (!val) { i++; continue; }
    let j = i + 1;
    while (j < DAY_KEYS.length && hours[DAY_KEYS[j]] === val) j++;
    result.push({ label: j - i > 1 ? `${short[day]} – ${short[DAY_KEYS[j-1]]}` : DAY_LABELS[day], value: val });
    i = j;
  }
  return result;
}

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
  const [isDesktop, setIsDesktop] = useState(false);
  const [mode,            setMode]            = useState<"flyers" | "shelters">("shelters");
  const [showShelters,    setShowShelters]    = useState(true);
  const [showFlyers,      setShowFlyers]      = useState(true);
  const [showStations,    setShowStations]    = useState(true);
  const [stations,        setStations]        = useState<PoliceStation[]>([]);
  const [layersOpen,      setLayersOpen]      = useState(false);
  const [layersClosing,   setLayersClosing]   = useState(false);
  const [settingsOpen,    setSettingsOpen]    = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [selectedShelterSiteId, setSelectedShelterSiteId] = useState<number | null>(null);
  const [detailShelter,   setDetailShelter]   = useState<Shelter | null>(null);
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

    fetch("/api/stations/all")
      .then(r => r.json())
      .then(d => setStations(Array.isArray(d) ? d : []))
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
    if (flyer) { setPreviewInitialSearch(""); setQuickLook(flyer); }
  }, [flyers]);

  // ── Filtered flyers ───────────────────────────────────────────────────────────
  const pinnedIds = useMemo(() => new Set(flyerPins.map(p => p.flyerId)), [flyerPins]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return flyers.filter(f => {
      const matchSearch = !q ||
        f.title.toLowerCase().includes(q) ||
        f.entity?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        f.tags?.some(t => t.toLowerCase().includes(q)) ||
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
          shelters={showShelters ? shelters : []} flyerPins={showFlyers ? flyerPins : []} stationPins={showStations ? stations : []}
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
        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </button>
        {/* Layers toggle button */}
        <button
          onClick={() => setLayersOpen(true)}
          aria-label="Map layers"
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
        {/* Drag handle — pill only */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          style={{ flexShrink: 0, padding: "10px 0 8px", display: "flex", justifyContent: "center", touchAction: "none", cursor: "grab", userSelect: "none" }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--card-border)" }} />
        </div>

        {/* Sliding panels */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{
            display: "flex", height: "100%", width: "200%",
            transform: detailShelter ? "translateX(-50%)" : "translateX(0)",
            transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          }}>

            {/* ── Panel 1: list ── */}
            <div style={{ width: "50%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Header + mode toggle */}
              {snap !== "collapsed" && (
                <div style={{ padding: "4px 16px 12px", flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>Find the right resource.</p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400, color: "var(--muted)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                      {mode === "shelters"
                        ? shelters.length === 0 ? "Loading…" : userLat !== null ? `${shelters.length} shelters, sorted by distance.` : `${shelters.length} shelters in Chicago.`
                        : flyers.length === 0 ? "Loading…" : showGrouped ? `${flyerGroups.length} result${flyerGroups.length !== 1 ? "s" : ""} of ${flyers.length}` : `Browse ${flyers.length} flyer${flyers.length !== 1 ? "s" : ""} below.`}
                    </p>
                  </div>
                  {/* Mode toggle pill */}
                  <div style={{ display: "flex", background: "var(--card-border)", borderRadius: 99, padding: 3, gap: 2, flexShrink: 0, marginTop: 4 }}>
                    {(["shelters", "flyers"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        aria-label={m === "flyers" ? "Flyers mode" : "Shelters mode"}
                        style={{
                          width: 32, height: 32, borderRadius: "50%", border: "none",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: mode === m ? (m === "flyers" ? "#eab308" : "#3b82f6") : "transparent",
                          color: mode === m ? "#fff" : "var(--muted)",
                          cursor: "pointer", transition: "all 0.15s",
                          boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
                        }}
                      >
                        {m === "shelters"
                          ? <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 3L3 9h2v8h4v-5h2v5h4V9h2L10 3z" fill="currentColor"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="1.8" fill="currentColor"/><rect x="8.6" y="9.5" width="2.8" height="6.5" rx="1.2" fill="currentColor"/></svg>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search bar */}
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
                      style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 16, fontFamily: "var(--font-sans)", color: "var(--text)" }}
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
                      style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 16, fontFamily: "var(--font-sans)", color: "var(--text)" }}
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

              {/* Card list */}
              <div ref={listRef} className="sheet-list" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px", overscrollBehavior: "contain", touchAction: "pan-y" } as React.CSSProperties}>
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
                            <div
                              key={s.site_id}
                              onClick={() => { setDetailShelter(s); animateTo("full"); }}
                              style={{ padding: "12px 0", borderBottom: i < sortedShelters.length - 1 ? "1px solid var(--card-border)" : "none", cursor: "pointer" }}
                            >
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
                                {/* Arrow button — opens detail */}
                                <button
                                  onClick={e => { e.stopPropagation(); setDetailShelter(s); animateTo("full"); }}
                                  aria-label="View details"
                                  style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--card-border)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

            {/* ── Panel 2: detail ── */}
            <div style={{ width: "50%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Back button row */}
              <div style={{ padding: "4px 16px 8px", flexShrink: 0 }}>
                <button
                  onClick={() => setDetailShelter(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#3b82f6", cursor: "pointer", padding: "4px 0", fontSize: 15, fontFamily: "var(--font-sans)", fontWeight: 500 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Shelters
                </button>
              </div>

              {/* Detail scroll area */}
              <div className="sheet-list" style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
                {detailShelter && (() => {
                  const hours = detailShelter.hours as ShelterHours | null;
                  const { open, todayHours } = hours ? getOpenStatus(hours) : { open: null, todayHours: null };
                  const grouped = hours ? groupHours(hours) : [];
                  const initials = (detailShelter.agency ?? detailShelter.site_name ?? "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                  return (
                    <>
                      {/* ── Hero header ── */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 20, borderBottom: "1px solid var(--card-border)", marginBottom: 16 }}>
                        {/* Avatar */}
                        <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: "var(--card-border)", marginBottom: 12, flexShrink: 0 }}>
                          {detailShelter.image_url
                            ? <img src={detailShelter.image_url} alt={detailShelter.agency ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "var(--muted)" }}>{initials}</div>
                          }
                        </div>
                        {/* Agency name */}
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.25, textAlign: "center" }}>
                          {detailShelter.agency ?? detailShelter.site_name}
                        </p>
                        {/* Site name subtitle */}
                        {detailShelter.site_name && detailShelter.site_name !== detailShelter.agency && (
                          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-sans)", textAlign: "center" }}>
                            {detailShelter.site_name}
                          </p>
                        )}
                        {/* Population tag */}
                        {detailShelter.population && (
                          <span style={{ marginTop: 8, display: "inline-block", padding: "3px 10px", borderRadius: 99, background: "var(--card-border)", fontSize: 12, fontWeight: 600, color: "var(--muted)", fontFamily: "var(--font-sans)", letterSpacing: "0.02em" }}>
                            {detailShelter.population}
                          </span>
                        )}
                      </div>

                      {/* ── Action buttons ── */}
                      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                        {/* Location */}
                        <button
                          onClick={() => { animateTo("collapsed"); setSelectedShelterSiteId(detailShelter.site_id); }}
                          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 8px", borderRadius: 14, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontFamily: "var(--font-sans)" }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                          </svg>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Location</span>
                        </button>
                        {/* Website — only if available */}
                        {detailShelter.website && (
                          <a
                            href={detailShelter.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 8px", borderRadius: 14, border: "none", background: "var(--card-border)", color: "var(--text)", cursor: "pointer", fontFamily: "var(--font-sans)", textDecoration: "none" }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                              <path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Website</span>
                          </a>
                        )}
                      </div>

                      {/* ── Quick info strip ── */}
                      {(open !== null || detailShelter.distance !== undefined) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                          {open !== null && (
                            <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 13, fontWeight: 700, fontFamily: "var(--font-sans)", background: open ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: open ? "#16a34a" : "#dc2626" }}>
                              {open ? "Open" : "Closed"}
                            </span>
                          )}
                          {todayHours && todayHours.toLowerCase() !== "closed" && (
                            <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>{todayHours}</span>
                          )}
                          {detailShelter.distance !== undefined && (
                            <span style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 99, fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)", background: "var(--card-border)", color: "var(--muted)" }}>
                              {detailShelter.distance < 0.1 ? "<0.1" : detailShelter.distance.toFixed(1)} mi
                            </span>
                          )}
                        </div>
                      )}

                      {/* ── Hours table ── */}
                      {grouped.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--muted)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Hours</p>
                          {grouped.map(({ label, value }, idx) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: idx < grouped.length - 1 ? "1px solid var(--card-border)" : "none" }}>
                              <span style={{ fontSize: 14, color: "var(--text)", fontFamily: "var(--font-sans)" }}>{label}</span>
                              <span style={{ fontSize: 14, color: value.toLowerCase() === "closed" ? "#ef4444" : "var(--text)", fontFamily: "var(--font-sans)", fontWeight: value.toLowerCase() === "closed" ? 500 : 400 }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── Details section ── */}
                      {(detailShelter.phone || detailShelter.address || detailShelter.notes) && (
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--muted)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Details</p>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            {detailShelter.phone && (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: (detailShelter.address || detailShelter.notes) ? "1px solid var(--card-border)" : "none" }}>
                                <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Phone</span>
                                <a href={`tel:${detailShelter.phone.replace(/\D/g, "")}`} style={{ fontSize: 14, color: "#3b82f6", fontFamily: "var(--font-sans)", textDecoration: "none", fontWeight: 500 }}>{detailShelter.phone}</a>
                              </div>
                            )}
                            {detailShelter.address && (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 0", borderBottom: detailShelter.notes ? "1px solid var(--card-border)" : "none" }}>
                                <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)", flexShrink: 0, marginRight: 12 }}>Address</span>
                                <span style={{ fontSize: 14, color: "var(--text)", fontFamily: "var(--font-sans)", textAlign: "right", lineHeight: 1.4 }}>{detailShelter.address}</span>
                              </div>
                            )}
                            {detailShelter.notes && (
                              <div style={{ padding: "9px 0" }}>
                                <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Notes</p>
                                <p style={{ margin: 0, fontSize: 14, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>{detailShelter.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

          </div>
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

      {/* Settings modal */}
      {settingsOpen && (
        <div
          role="presentation"
          onClick={() => { setSettingsClosing(true); setTimeout(() => { setSettingsOpen(false); setSettingsClosing(false); }, 180); }}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: settingsClosing ? "fadeOut 0.18s ease forwards" : "fadeIn 0.2s ease forwards",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bar-bg)",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              borderRadius: 28,
              border: "1.5px solid var(--bar-border)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
              width: "100%", maxWidth: 320,
              padding: "24px 24px 20px",
              animation: settingsClosing ? "fadeScaleOut 0.18s ease forwards" : "fadeScale 0.22s cubic-bezier(0.34,1.4,0.64,1) forwards",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}>
                Settings
              </p>
              <button
                onClick={() => { setSettingsClosing(true); setTimeout(() => { setSettingsOpen(false); setSettingsClosing(false); }, 180); }}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--card-border)", border: "none", color: "var(--muted)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}
              >✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {([
                { label: "Upload a Flyer", href: "/upload",  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { label: "Admin",          href: "/admin",   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75"/></svg> },
              ]).map(({ label, href, icon }, i, arr) => (
                <a
                  key={href}
                  href={href}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--card-border)" : "none",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  <span style={{ color: "var(--muted)", display: "flex" }}>{icon}</span>
                  <span style={{ flex: 1, fontSize: 15, fontFamily: "var(--font-sans)", fontWeight: 400 }}>{label}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Layers modal */}
      {layersOpen && (
        <div
          role="presentation"
          onClick={() => { setLayersClosing(true); setTimeout(() => { setLayersOpen(false); setLayersClosing(false); }, 180); }}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: layersClosing ? "fadeOut 0.18s ease forwards" : "fadeIn 0.2s ease forwards",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Map layers"
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bar-bg)",
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              borderRadius: 28,
              border: "1.5px solid var(--bar-border)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
              width: "100%", maxWidth: 320,
              padding: "24px 24px 20px",
              animation: layersClosing ? "fadeScaleOut 0.18s ease forwards" : "fadeScale 0.22s cubic-bezier(0.34,1.4,0.64,1) forwards",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}>
                Map Layers
              </p>
              <button
                onClick={() => { setLayersClosing(true); setTimeout(() => { setLayersOpen(false); setLayersClosing(false); }, 180); }}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--card-border)", border: "none", color: "var(--muted)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}
              >✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {([
                { key: "shelters",  label: "Shelters",         dot: "#3b82f6", active: showShelters,  toggle: () => setShowShelters(v => !v)  },
                { key: "flyers",    label: "Flyers",           dot: "#eab308", active: showFlyers,    toggle: () => setShowFlyers(v => !v)    },
                { key: "stations",  label: "Police Stations",  dot: "#dc2626", active: showStations,  toggle: () => setShowStations(v => !v)  },
              ] as const).map(({ key, label, dot, active, toggle }, i, arr) => (
                <div
                  key={key}
                  onClick={toggle}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--card-border)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: dot, flexShrink: 0, opacity: active ? 1 : 0.3 }} />
                  <span style={{ flex: 1, fontSize: 15, color: "var(--text)", fontFamily: "var(--font-sans)", fontWeight: 400, opacity: active ? 1 : 0.45 }}>{label}</span>
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
        @keyframes fadeScaleOut { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.92) } }
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
