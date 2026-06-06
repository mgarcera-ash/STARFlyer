"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

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

export default function AroundPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  const handleMapSelect = (id: number) => {
    setSelectedId(id);
    const card = cardRefs.current.get(id);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleCardSelect = (id: number) => {
    setSelectedId(id);
  };

  const reset = () => {
    setPhase("idle");
    setShelters([]);
    setSelectedId(null);
    setAddressInput("");
    setErrorMsg("");
  };

  return (
    <main style={{ minHeight: "100vh", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: "48px 24px 0", maxWidth: 720, margin: "0 auto" }}>
        <div className="fade-up" style={{ animationDelay: "0.05s", display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <a
            href="/"
            style={{
              fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)",
              textDecoration: "none", fontWeight: 500, padding: "8px 18px",
              borderRadius: 99, border: "1.5px solid var(--card-border)",
              background: "var(--surface)", transition: "background 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
          >← Back</a>
          {phase === "located" && (
            <button
              onClick={reset}
              style={{
                fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)",
                fontWeight: 500, padding: "8px 18px", borderRadius: 99,
                border: "1.5px solid var(--card-border)", background: "var(--surface)",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
            >Change location</button>
          )}
        </div>

        <div className="fade-up" style={{ animationDelay: "0.08s", marginBottom: 28 }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
            Around You
          </p>
          {phase !== "located" && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>
              Find overnight shelters within 2 miles.
            </p>
          )}
          {phase === "located" && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>
              {shelters.length === 0
                ? "No shelters found within 2 miles."
                : `${shelters.length} shelter${shelters.length === 1 ? "" : "s"} within 2 miles`}
            </p>
          )}
        </div>
      </div>

      {/* Idle / error */}
      {(phase === "idle" || phase === "error") && (
        <div className="stagger-item" style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px" }}>
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
                whiteSpace: "nowrap",
                transition: "background 0.15s, opacity 0.15s",
              }}
              onMouseEnter={e => { if (!geocoding && addressInput.trim()) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)"; }}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
            >
              {geocoding ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
      )}

      {/* Locating */}
      {phase === "locating" && (
        <div className="fade-up" style={{ textAlign: "center", padding: "64px 24px" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)" }}>
            Finding shelters
            <span className="loading-dot">.</span>
            <span className="loading-dot">.</span>
            <span className="loading-dot">.</span>
          </p>
        </div>
      )}

      {/* Located */}
      {phase === "located" && (
        <div className="around-layout">

          {/* Map */}
          <div className="around-map">
            <div style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden", border: "1px solid var(--card-border)" }}>
              <MapView
                userLat={userLat}
                userLng={userLng}
                shelters={shelters}
                selectedId={selectedId}
                onSelect={handleMapSelect}
              />
            </div>
          </div>

          {/* Shelter list */}
          <div className="around-list">
            {shelters.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--muted)" }}>
                  No shelters found within 2 miles of this location.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {shelters.map(s => (
                  <div
                    key={s.site_id}
                    ref={el => { if (el) cardRefs.current.set(s.site_id, el); else cardRefs.current.delete(s.site_id); }}
                    onClick={() => handleCardSelect(s.site_id)}
                    style={{
                      background: "var(--surface)",
                      border: `1.5px solid ${selectedId === s.site_id ? "var(--text)" : "var(--card-border)"}`,
                      borderRadius: 18, padding: "14px 16px",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                          color: "var(--text)", margin: "0 0 2px", lineHeight: 1.35,
                        }}>
                          {s.site_name ?? "Unnamed Site"}
                        </p>
                        {s.agency && (
                          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
                            {s.agency}
                          </p>
                        )}
                        {s.population && (
                          <span style={{
                            display: "inline-block", fontSize: 11, fontWeight: 500,
                            padding: "2px 8px", borderRadius: 99,
                            background: "var(--card-border)", color: "var(--muted)",
                            fontFamily: "var(--font-sans)", marginBottom: 8,
                          }}>
                            {s.population}
                          </span>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                          {s.address && (
                            <a
                              href={`https://maps.apple.com/?q=${encodeURIComponent(s.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-sans)",
                                textDecoration: "none", lineHeight: 1.4,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                            >
                              {s.address}
                            </a>
                          )}
                          {s.phone && (
                            <a
                              href={`tel:${s.phone.replace(/\D/g, "")}`}
                              onClick={e => e.stopPropagation()}
                              style={{
                                fontSize: 12, color: "#3b82f6", fontFamily: "var(--font-sans)",
                                fontWeight: 500, textDecoration: "none",
                              }}
                            >
                              {s.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                          {s.distance < 0.1 ? "<0.1" : s.distance.toFixed(1)} mi
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
