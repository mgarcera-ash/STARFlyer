"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Shelter } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

// Chicago bounding box for scoped search results
const CHICAGO_VIEWBOX = "-87.94,41.64,-87.52,42.02";

type Suggestion = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
};

function formatSuggestion(displayName: string): { title: string; subtitle: string } {
  const parts = displayName.split(", ");
  const chicagoIdx = parts.indexOf("Chicago");
  if (chicagoIdx > 0) {
    return {
      title: parts.slice(0, chicagoIdx).join(", "),
      subtitle: "Chicago, IL",
    };
  }
  return { title: parts[0] || displayName, subtitle: parts.slice(1, 3).join(", ") };
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
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
  border: "1.5px solid rgba(0,0,0,0.10)",
  boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
};

export default function AroundPage() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Load all shelters on mount
  useEffect(() => {
    fetch("/api/shelters/all")
      .then(r => r.json())
      .then(d => setShelters(d.shelters ?? []))
      .catch(() => {});
  }, []);

  // Debounced autocomplete — scoped to Chicago bounding box
  useEffect(() => {
    const q = addressInput.trim();
    if (q.length < 3) { setSuggestions([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&viewbox=${CHICAGO_VIEWBOX}&bounded=1&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
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

  const selectSuggestion = (s: Suggestion) => {
    applyLocation(parseFloat(s.lat), parseFloat(s.lon));
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
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&viewbox=${CHICAGO_VIEWBOX}&bounded=1&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (!data.length) {
        setSearchError("Address not found in Chicago.");
        return;
      }
      applyLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
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
          shelters={shelters}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Floating top bar */}
      <div style={{
        position: "fixed", top: 20, left: 20, right: 20, zIndex: 10,
        display: "flex", alignItems: "center", gap: 10,
      }}>

        {/* Back */}
        <a
          href="/"
          style={{
            ...GLASS, flexShrink: 0, borderRadius: 99,
            height: 44, display: "flex", alignItems: "center",
            fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
            color: "#000", textDecoration: "none",
            padding: "0 16px", whiteSpace: "nowrap",
          }}
        >← Back</a>

        {/* Search pill */}
        <div style={{ ...GLASS, flex: 1, borderRadius: 99, height: 44, display: "flex", alignItems: "center", overflow: "hidden" }}>

          {/* Near me button */}
          <button
            onClick={useMyLocation}
            disabled={locating}
            aria-label="Use my location"
            style={{
              flexShrink: 0, padding: "0 14px", height: "100%",
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
              flex: 1, padding: "0 12px",
              border: "none", background: "transparent", outline: "none",
              fontSize: 14, fontFamily: "var(--font-sans)", color: "#000",
              height: "100%", minWidth: 0,
            }}
          />

          {addressInput && (
            <button
              onMouseDown={e => e.preventDefault()} // prevent input blur before clear fires
              onClick={() => { setAddressInput(""); setSuggestions([]); setShowSuggestions(false); setSearchError(""); }}
              style={{
                flexShrink: 0, padding: "0 14px", height: "100%",
                background: "transparent", border: "none",
                cursor: "pointer", color: "#737373", fontSize: 16, lineHeight: 1,
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
          position: "fixed", top: 76, left: 20, right: 20, zIndex: 9,
          ...GLASS, borderRadius: 16, overflow: "hidden",
        }}>
          {suggestions.map((s, i) => {
            const { title, subtitle } = formatSuggestion(s.display_name);
            return (
              <button
                key={s.place_id}
                onMouseDown={e => e.preventDefault()} // keep input focused so blur delay works
                onClick={() => selectSuggestion(s)}
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
