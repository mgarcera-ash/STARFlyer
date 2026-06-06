"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Shelter, FlyerPin } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

// Chicago bounding box — Photon format: west,south,east,north
const CHICAGO_BBOX = "-87.94,41.64,-87.52,42.02";

type PhotonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
  properties: {
    osm_id: number;
    osm_type: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

function formatSuggestion(f: PhotonFeature): { title: string; subtitle: string } {
  const p = f.properties;
  let title = "";
  if (p.housenumber && p.street) title = `${p.housenumber} ${p.street}`;
  else if (p.street) title = p.street;
  else if (p.name) title = p.name;
  else title = "Unknown location";

  const sub: string[] = [];
  if (p.district) sub.push(p.district);
  if (p.locality && p.locality !== p.district) sub.push(p.locality);
  const subtitle = sub.length > 0 ? `${sub.join(", ")} · Chicago, IL` : "Chicago, IL";
  return { title, subtitle };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GLASS: React.CSSProperties = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
  border: "2px solid #fff",
  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
};

export default function AroundPage() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [flyerPins, setFlyerPins] = useState<FlyerPin[]>([]);
  const [showShelters, setShowShelters] = useState(true);
  const [showFlyers, setShowFlyers] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Load shelters and flyers on mount
  useEffect(() => {
    fetch("/api/shelters/all")
      .then(r => r.json())
      .then(d => setShelters(d.shelters ?? []))
      .catch(() => {});

    fetch("/api/flyers/mapped")
      .then(r => r.json())
      .then(d => {
        type RawHotspot = { type: string; label?: string; value: string; lat?: number; lng?: number };
        type RawFlyer = { id: string; title: string | null; entity: string | null; image_url: string | null; hotspots: RawHotspot[] };
        const pins: FlyerPin[] = (d.flyers ?? []).flatMap((f: RawFlyer) =>
          f.hotspots
            .filter((h: RawHotspot) => h.type === "address" && h.lat !== undefined && h.lng !== undefined)
            .map((h: RawHotspot, i: number) => ({
              pinId: `${f.id}-${i}`,
              flyerId: f.id,
              lat: h.lat!,
              lng: h.lng!,
              title: f.title,
              entity: f.entity,
              image_url: f.image_url,
              allHotspots: f.hotspots,
            }))
        );
        setFlyerPins(pins);
      })
      .catch(() => {});
  }, []);

  // Debounced autocomplete via Photon — scoped to Chicago bounding box
  useEffect(() => {
    const q = addressInput.trim();
    if (q.length < 3) { setSuggestions([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&bbox=${CHICAGO_BBOX}&lang=en`
        );
        const data: { features: PhotonFeature[] } = await res.json();
        const features = data.features ?? [];
        // Deduplicate by osm_id+osm_type
        const seen = new Set<string>();
        const unique = features.filter(f => {
          const key = `${f.properties.osm_type}${f.properties.osm_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSuggestions(unique);
        setShowSuggestions(unique.length > 0);
      } catch {
        // silent — user can still submit manually
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [addressInput]);

  const applyLocation = (lat: number, lng: number) => {
    setUserLat(lat);
    setUserLng(lng);
    setShelters(prev =>
      prev.map(s => ({ ...s, distance: haversine(lat, lng, s.lat, s.lng) }))
    );
  };

  const selectSuggestion = (f: PhotonFeature) => {
    const [lng, lat] = f.geometry.coordinates;
    applyLocation(lat, lng);
    setAddressInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchError("");
  };

  const useMyLocation = () => {
    if (locating) return;
    setLocating(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        applyLocation(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setSearchError("Couldn't access your location.");
        setLocating(false);
      }
    );
  };

  const geocodeAddress = async () => {
    const q = addressInput.trim();
    if (!q) return;
    setGeocoding(true);
    setSearchError("");
    setShowSuggestions(false);
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&bbox=${CHICAGO_BBOX}&lang=en`
      );
      const data: { features: PhotonFeature[] } = await res.json();
      if (!data.features?.length) {
        setSearchError("Address not found in Chicago.");
        return;
      }
      const [lng, lat] = data.features[0].geometry.coordinates;
      applyLocation(lat, lng);
      setAddressInput("");
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <>
      {/* Full-screen map */}
      <div style={{ position: "fixed", inset: 0 }}>
        <MapView
          userLat={userLat}
          userLng={userLng}
          shelters={showShelters ? shelters : []}
          flyerPins={showFlyers ? flyerPins : []}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Floating top bar */}
      <div style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        width: "calc(100% - 48px)", maxWidth: 480,
        zIndex: 10, display: "flex", alignItems: "center", gap: 10,
      }}>

        {/* Back */}
        <a
          href="/"
          style={{
            ...GLASS, flexShrink: 0, borderRadius: 99,
            fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
            color: "#000", textDecoration: "none",
            padding: "14px 18px", whiteSpace: "nowrap",
          }}
        >← Back</a>

        {/* Search pill */}
        <div style={{ ...GLASS, flex: 1, borderRadius: 52, display: "flex", alignItems: "center", overflow: "hidden" }}>

          {/* Near me button */}
          <button
            onClick={useMyLocation}
            disabled={locating}
            aria-label="Use my location"
            style={{
              flexShrink: 0, padding: "0 16px", alignSelf: "stretch",
              background: "transparent", border: "none",
              cursor: locating ? "default" : "pointer",
              display: "flex", alignItems: "center",
              color: locating ? "#737373" : "#3b82f6",
              transition: "color 0.15s",
            }}
          >
            {locating ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="22 22" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <div style={{ width: 1, height: 18, background: "rgba(0,0,0,0.1)", flexShrink: 0 }} />

          {/* Address input */}
          <input
            type="text"
            value={addressInput}
            onChange={e => { setAddressInput(e.target.value); setSearchError(""); }}
            onKeyDown={e => {
              if (e.key === "Enter") geocodeAddress();
              if (e.key === "Escape") { setShowSuggestions(false); setAddressInput(""); }
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search in Chicago…"
            style={{
              flex: 1, padding: "14px 20px",
              border: "none", background: "transparent", outline: "none",
              fontSize: 16, fontFamily: "var(--font-sans)", color: "#000",
              minWidth: 0,
            }}
          />

          {addressInput && (
            <button
              onMouseDown={e => e.preventDefault()} // prevent input blur before clear fires
              onClick={() => { setAddressInput(""); setSuggestions([]); setShowSuggestions(false); setSearchError(""); }}
              style={{
                flexShrink: 0, padding: "0 16px", alignSelf: "stretch",
                background: "transparent", border: "none",
                cursor: "pointer", color: "#737373", fontSize: 18, lineHeight: 1,
                display: "flex", alignItems: "center",
              }}
            >×</button>
          )}

          {geocoding && (
            <span style={{ flexShrink: 0, padding: "0 14px 0 0", fontSize: 12, color: "#737373", fontFamily: "var(--font-sans)" }}>
              Searching…
            </span>
          )}
        </div>
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: "fixed", top: 88, left: "50%", transform: "translateX(-50%)",
          width: "calc(100% - 48px)", maxWidth: 480, zIndex: 9,
          ...GLASS, borderRadius: 16, overflow: "hidden",
        }}>
          {suggestions.map((f, i) => {
            const { title, subtitle } = formatSuggestion(f);
            return (
              <button
                key={`${f.properties.osm_type}${f.properties.osm_id}`}
                onMouseDown={e => e.preventDefault()} // keep input focused so blur delay works
                onClick={() => selectSuggestion(f)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  width: "100%", padding: "11px 16px",
                  background: "transparent", border: "none",
                  borderBottom: i < suggestions.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  cursor: "pointer", textAlign: "left",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: "#000", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
                  {title}
                </span>
                {subtitle && (
                  <span style={{ fontSize: 12, color: "#737373", fontFamily: "var(--font-sans)", marginTop: 2 }}>
                    {subtitle}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Error toast */}
      {searchError && (
        <div style={{
          position: "fixed",
          top: showSuggestions && suggestions.length > 0 ? `${76 + suggestions.length * 49}px` : "76px",
          left: 20, right: 20, zIndex: 10,
          display: "flex", justifyContent: "center",
        }}>
          <div style={{
            ...GLASS, borderRadius: 99,
            padding: "8px 16px",
            fontSize: 13, fontFamily: "var(--font-sans)", color: "#b91c1c",
          }}>
            {searchError}
          </div>
        </div>
      )}

      {/* Layer toggles — below search pill */}
      <div style={{
        position: "fixed", top: 96, left: "50%", transform: "translateX(-50%)",
        zIndex: 8, display: "flex", flexDirection: "row", gap: 8,
      }}>
        {[
          {
            key: "shelters", label: "Shelters", active: showShelters,
            toggle: () => setShowShelters(v => !v),
            color: "#ef4444",
            icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 3L3 9h2v8h4v-5h2v5h4V9h2L10 3z" fill="currentColor"/></svg>,
          },
          {
            key: "flyers", label: "Info from Flyers", active: showFlyers,
            toggle: () => setShowFlyers(v => !v),
            color: "#3b82f6",
            icon: <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="1.8" fill="currentColor"/><rect x="8.6" y="9.5" width="2.8" height="6.5" rx="1.2" fill="currentColor"/></svg>,
          },
        ].map(({ key, label, active, toggle, color, icon }) => (
          <button
            key={key}
            onClick={toggle}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 99, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
              border: "2px solid #fff",
              background: active ? color : "rgba(255,255,255,0.45)",
              color: active ? "#fff" : "rgba(0,0,0,0.35)",
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "flex", opacity: active ? 1 : 0.5 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Bottom hint badge */}
      <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}>
        <div style={{
          ...GLASS, borderRadius: 99, padding: "8px 16px",
          fontSize: 12, fontFamily: "var(--font-sans)", color: "#000", whiteSpace: "nowrap",
        }}>
          {shelters.length > 0
            ? userLat !== null
              ? `${shelters.length} shelters · tap a pin for details`
              : `${shelters.length} shelters in Chicago · tap ⊕ or search to find what's near you`
            : "Loading shelters…"}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
