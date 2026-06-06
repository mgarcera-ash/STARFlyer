"use client";
import dynamic from "next/dynamic";
import { useState } from "react";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

type Shelter = {
  site_id: number;
  site_name: string | null;
  agency: string | null;
  population: string | null;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  distance: number;
};

type Phase = "idle" | "locating" | "located" | "error";

const pillStyle: React.CSSProperties = {
  fontSize: 13, fontFamily: "var(--font-sans)", fontWeight: 500,
  padding: "8px 18px", borderRadius: 99,
  border: "1.5px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
  cursor: "pointer", textDecoration: "none", color: "#000",
  display: "inline-block", transition: "background 0.15s",
  whiteSpace: "nowrap" as const,
};

export default function AroundPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchShelters = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/shelters/nearby?lat=${lat}&lng=${lng}&radius=2`);
      const data = await res.json();
      setShelters(data.shelters ?? []);
      setPhase("located");
    } catch {
      setPhase("error");
      setErrorMsg("Failed to load nearby shelters. Please try again.");
    }
  };

  const useMyLocation = () => {
    setPhase("locating");
    setErrorMsg("");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        fetchShelters(lat, lng);
      },
      () => {
        setPhase("error");
        setErrorMsg("Couldn't access your location. Try entering an address instead.");
      }
    );
  };

  const geocodeAddress = async () => {
    const q = addressInput.trim();
    if (!q) return;
    setGeocoding(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (!data.length) {
        setErrorMsg("Address not found. Try a more specific address or intersection.");
        setGeocoding(false);
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setUserLat(lat);
      setUserLng(lng);
      setPhase("locating");
      await fetchShelters(lat, lng);
    } catch {
      setErrorMsg("Search failed. Please try again.");
      setGeocoding(false);
    }
  };

  const reset = () => {
    setPhase("idle");
    setShelters([]);
    setSelectedId(null);
    setAddressInput("");
    setErrorMsg("");
  };

  // ── Full-screen map ──────────────────────────────────────────────────────────
  if (phase === "located") {
    return (
      <>
        {/* Map fills the whole viewport */}
        <div style={{ position: "fixed", inset: 0 }}>
          <MapView
            userLat={userLat}
            userLng={userLng}
            shelters={shelters}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Floating controls */}
        <div style={{
          position: "fixed", top: 20, left: 20, right: 20, zIndex: 10,
          display: "flex", alignItems: "center", gap: 10,
          pointerEvents: "none",
        }}>
          <a href="/" style={{ ...pillStyle, pointerEvents: "auto" }}>← Back</a>
          <button
            onClick={reset}
            style={{ ...pillStyle, pointerEvents: "auto", border: "1.5px solid rgba(0,0,0,0.12)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.88)")}
          >
            Change location
          </button>
          {shelters.length > 0 && (
            <div style={{
              marginLeft: "auto", pointerEvents: "none",
              fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 500,
              padding: "8px 14px", borderRadius: 99,
              border: "1.5px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.88)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              color: "#000",
            }}>
              {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} nearby
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Idle / locating / error ──────────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "48px 24px 0", maxWidth: 480, margin: "0 auto" }}>

        <div className="fade-up" style={{ animationDelay: "0.05s", marginBottom: 28 }}>
          <a
            href="/"
            style={{
              fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
              textDecoration: "none", fontWeight: 500, padding: "8px 18px",
              borderRadius: 99, border: "1.5px solid var(--card-border)",
              background: "var(--surface)", transition: "background 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              display: "inline-block",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
          >← Back</a>
        </div>

        <div className="fade-up" style={{ animationDelay: "0.08s", marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            Around You
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)", margin: 0 }}>
            Find overnight shelters within 2 miles.
          </p>
        </div>

        {/* Locating */}
        {phase === "locating" && (
          <div className="fade-up" style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)" }}>
              Finding shelters
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
              <span className="loading-dot">.</span>
            </p>
          </div>
        )}

        {/* Idle / error */}
        {(phase === "idle" || phase === "error") && (
          <div className="stagger-item">
            {errorMsg && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--danger)", marginBottom: 16, lineHeight: 1.5 }}>
                {errorMsg}
              </p>
            )}

            <button
              onClick={useMyLocation}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 99,
                border: "none", background: "var(--text)", color: "var(--bg)",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                cursor: "pointer", transition: "opacity 0.15s", marginBottom: 16,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Use my location
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "var(--card-border)" }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--card-border)" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") geocodeAddress(); }}
                placeholder="Enter an address or intersection"
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 99,
                  border: "1.5px solid var(--card-border)", background: "var(--surface)",
                  fontSize: 14, fontFamily: "var(--font-sans)", color: "var(--text)",
                  outline: "none",
                }}
              />
              <button
                onClick={geocodeAddress}
                disabled={geocoding || !addressInput.trim()}
                style={{
                  padding: "12px 20px", borderRadius: 99,
                  border: "1.5px solid var(--card-border)", background: "var(--surface)",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                  color: "var(--text)", cursor: geocoding || !addressInput.trim() ? "not-allowed" : "pointer",
                  opacity: geocoding || !addressInput.trim() ? 0.5 : 1,
                  whiteSpace: "nowrap", transition: "background 0.15s, opacity 0.15s",
                }}
                onMouseEnter={e => { if (!geocoding && addressInput.trim()) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)"; }}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
              >
                {geocoding ? "Searching…" : "Search"}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
