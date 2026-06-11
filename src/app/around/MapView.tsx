"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";

const CHICAGO: L.LatLngTuple = [41.8781, -87.6298];

export type Shelter = {
  site_id: number;
  site_name: string | null;
  agency: string | null;
  population: string | null;
  address: string | null;
  phone: string | null;
  image_url: string | null;
  hours: Record<string, string> | null;
  notes: string | null;
  website: string | null;
  lat: number;
  lng: number;
  distance?: number;
};

export type PoliceStation = {
  district: string;
  district_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  lat: number;
  lng: number;
};

export type FlyerPin = {
  pinId: string;
  flyerId: string;
  lat: number;
  lng: number;
  title: string | null;
  entity: string | null;
  image_url: string | null;
  addressLabel: string | undefined;
  allHotspots: { type: string; label?: string; value: string; lat?: number; lng?: number }[];
};

type Props = {
  userLat: number | null;
  userLng: number | null;
  shelters: Shelter[];
  flyerPins: FlyerPin[];
  stationPins: PoliceStation[];
  onFlyerPinClick: (pin: FlyerPin) => void;
  selectedShelterSiteId?: number | null;
  isDark: boolean;
  mapStyle: string;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PHONE_CIRCLE = `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg></div>`;
const PIN_CIRCLE  = `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#fff"/></svg></div>`;

function makeShelterIcon(s: Shelter, isDark = false) {
  const name = s.agency;
  const initial = (s.agency ?? s.site_name ?? "?").charAt(0).toUpperCase();
  const inner = s.image_url
    ? `<img src="${esc(s.image_url)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:${isDark ? "#111" : "#fff"};background:${isDark ? "#fff" : "#111827"};border-radius:50%">${initial}</div>`;
  const label = name ? `<span class="shelter-label" style="font-family:var(--font-sans),sans-serif;font-size:10px;font-weight:600;color:${isDark ? "#fff" : "#111"};white-space:nowrap;text-shadow:${isDark ? "0 1px 3px rgba(0,0,0,0.8)" : "0 0 3px #fff,0 0 3px #fff,0 1px 4px rgba(0,0,0,0.25)"};pointer-events:none;margin-top:3px;display:block;text-align:center">${esc(name)}</span>` : "";
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.30);background:#e5e7eb">
        ${inner}
      </div>
      ${label}
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function makeFlyerIcon(f: FlyerPin) {
  const initial = (f.title ?? f.entity ?? "?").charAt(0).toUpperCase();
  const inner = f.image_url
    ? `<img src="${esc(f.image_url)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background:#f97316;border-radius:50%">${initial}</div>`;
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid #f97316;box-shadow:0 2px 8px rgba(0,0,0,0.30);background:#ffedd5">${inner}</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function buildShelterPopup(s: Shelter): string {
  const initials = (s.agency ?? s.site_name ?? "?").charAt(0).toUpperCase();
  const avatar = s.image_url
    ? `<img src="${esc(s.image_url)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1.5px solid #e5e7eb" />`
    : `<div style="width:44px;height:44px;border-radius:50%;background:#111827;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff">${initials}</div>`;

  let html = `<div style="font-family:system-ui,sans-serif;padding:10px 12px;min-width:200px">`;

  // Avatar on its own row
  html += `<div style="margin-bottom:8px">${avatar}</div>`;

  // Agency + population on separate lines, no truncation
  if (s.agency)     html += `<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#000;line-height:1.3">${esc(s.agency)}</p>`;
  if (s.population) html += `<span style="display:inline-block;font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:#e5e7eb;color:#737373;margin-bottom:6px">${esc(s.population)}</span>`;
  if (s.site_name && s.site_name !== s.agency) html += `<p style="margin:0 0 6px;font-size:12px;color:#737373;line-height:1.3">${esc(s.site_name)}</p>`;
  if (s.phone)   html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">${PHONE_CIRCLE}<a href="tel:${s.phone.replace(/\D/g, "")}" style="font-size:12px;color:#3b82f6;text-decoration:none;font-weight:500">${esc(s.phone)}</a></div>`;
  if (s.address) html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">${PIN_CIRCLE}<span style="font-size:11px;color:#737373">${esc(s.address)}</span></div>`;
  if (s.distance !== undefined) {
    const dist = s.distance < 0.1 ? "&lt;0.1" : s.distance.toFixed(1);
    html += `<p style="margin:8px 0 0;font-size:11px;color:#737373">${dist} mi away</p>`;
  }
  html += `</div>`;
  return html;
}

function buildFlyerPopup(f: FlyerPin): string {
  const related = f.addressLabel
    ? f.allHotspots.filter(h => h.type !== "address" && h.label === f.addressLabel)
    : f.allHotspots.filter(h => h.type !== "address");
  const phones = related.filter(h => h.type === "phone");
  const addressValue = f.allHotspots.find(h => h.type === "address" && h.label === f.addressLabel)?.value ?? "";

  let html = `<div style="font-family:system-ui,sans-serif;min-width:200px;max-width:240px;overflow:hidden;border-radius:12px">`;

  // Image with "Tap to expand" badge at top-right
  if (f.image_url) {
    html += `<div style="position:relative">
      <img data-flyer-pin-id="${esc(f.pinId)}" src="${esc(f.image_url)}"
           style="width:100%;height:100px;object-fit:cover;display:block;cursor:pointer" />
      <div style="position:absolute;top:7px;right:7px;background:rgba(0,0,0,0.6);border-radius:99px;padding:3px 8px;display:flex;align-items:center;gap:4px;pointer-events:none">
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M10 2h4v4M6 14H2v-4M14 2l-5.5 5.5M2 14l5.5-5.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span style="font-size:10px;font-weight:500;color:#fff;white-space:nowrap">Tap to expand</span>
      </div>
    </div>`;
  }

  // Header — address location name + title
  html += `<div style="padding:10px 12px 8px;border-bottom:1px solid rgba(255,255,255,0.08)">`;
  if (f.addressLabel) html += `<p style="margin:0 0 1px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.06em;line-height:1.3">${esc(f.addressLabel)}</p>`;
  if (f.title)        html += `<p style="margin:0;font-size:13px;font-weight:500;color:#fff;line-height:1.4">${esc(f.title)}</p>`;
  html += `</div>`;

  // Contacts
  html += `<div style="padding:6px 0 4px">`;
  if (phones[0]) {
    html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 12px">
      ${PHONE_CIRCLE}
      <a href="tel:${phones[0].value.replace(/\D/g, "")}" style="font-size:13px;color:#3b82f6;text-decoration:none;font-weight:500">${esc(phones[0].value)}</a>
    </div>`;
  }
  if (addressValue) {
    html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 12px">
      ${PIN_CIRCLE}
      <span style="font-size:11px;color:rgba(255,255,255,0.45);line-height:1.3">${esc(addressValue)}</span>
    </div>`;
  }
  html += `</div></div>`;
  return html;
}

function makeStationIcon(s: PoliceStation, isDark = false) {
  const name = s.district_name ?? `District ${s.district}`;
  const initial = name.charAt(0).toUpperCase();
  const inner = s.image_url
    ? `<img src="${esc(s.image_url)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background:#60a5fa;border-radius:50%">${initial}</div>`;
  const label = `<span class="shelter-label" style="font-family:var(--font-sans),sans-serif;font-size:10px;font-weight:600;color:${isDark ? "#fff" : "#111"};white-space:nowrap;text-shadow:${isDark ? "0 1px 3px rgba(0,0,0,0.8)" : "0 0 3px #fff,0 0 3px #fff,0 1px 4px rgba(0,0,0,0.25)"};pointer-events:none;margin-top:3px;display:block;text-align:center">${esc(name)}</span>`;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid #60a5fa;box-shadow:0 2px 8px rgba(0,0,0,0.30);background:#60a5fa">
        ${inner}
      </div>
      ${label}
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function buildStationPopup(s: PoliceStation): string {
  const name = s.district_name ? `${s.district_name} District` : `District ${s.district}`;
  const initial = name.charAt(0).toUpperCase();
  const avatar = s.image_url
    ? `<img src="${esc(s.image_url)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #60a5fa" />`
    : `<div style="width:44px;height:44px;border-radius:50%;background:#60a5fa;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff">${initial}</div>`;
  let html = `<div style="font-family:system-ui,sans-serif;padding:10px 12px;min-width:200px">`;
  html += `<div style="margin-bottom:8px">${avatar}</div>`;
  html += `<p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#000;line-height:1.3">${esc(name)}</p>`;
  if (s.phone)   html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">${PHONE_CIRCLE}<a href="tel:${s.phone.replace(/\D/g, "")}" style="font-size:12px;color:#3b82f6;text-decoration:none;font-weight:500">${esc(s.phone)}</a></div>`;
  if (s.address) html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">${PIN_CIRCLE}<span style="font-size:11px;color:#737373">${esc(s.address)}</span></div>`;
  if (s.website) html += `<div style="margin-top:6px"><a href="${esc(s.website)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#3b82f6;text-decoration:none">${esc(s.website.replace(/^https?:\/\//, ""))}</a></div>`;
  html += `</div>`;
  return html;
}

export default function MapView({ userLat, userLng, shelters, flyerPins, stationPins, onFlyerPinClick, selectedShelterSiteId, isDark, mapStyle }: Props) {
  const containerRef        = useRef<HTMLDivElement>(null);
  const mapRef              = useRef<L.Map | null>(null);
  const tileLayerRef        = useRef<L.Layer | null>(null);
  const shelterMarkers      = useRef<Map<number, L.Marker>>(new Map());
  const flyerMarkers        = useRef<Map<string, L.Marker>>(new Map());
  const stationMarkers      = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef       = useRef<L.CircleMarker | null>(null);
  const flyerPinsRef        = useRef<FlyerPin[]>(flyerPins);
  const onFlyerPinClickRef  = useRef(onFlyerPinClick);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => { flyerPinsRef.current = flyerPins; }, [flyerPins]);
  useEffect(() => { onFlyerPinClickRef.current = onFlyerPinClick; }, [onFlyerPinClick]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: CHICAGO, zoom: 11, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Show shelter labels only when zoomed in enough
    const updateLabels = () =>
      containerRef.current?.classList.toggle("labels-visible", map.getZoom() >= 12);
    map.on("zoomend", updateLabels);

    // Wire popup image → QuickLook
    map.on("popupopen", (e: L.PopupEvent) => {
      const img = e.popup.getElement()?.querySelector<HTMLElement>("[data-flyer-pin-id]");
      if (!img) return;
      const pinId = img.dataset.flyerPinId;
      img.onclick = () => {
        map.closePopup();
        const pin = flyerPinsRef.current.find(f => f.pinId === pinId);
        if (pin) onFlyerPinClickRef.current(pin);
      };
    });

    mapRef.current = map;
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; tileLayerRef.current = null; setMapReady(false); };
  }, []);

  // Swap vector tile style when theme changes
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current!;
    if (tileLayerRef.current) tileLayerRef.current.remove();
    tileLayerRef.current = L.maplibreGL({ style: mapStyle }).addTo(map);
  }, [mapReady, mapStyle]);

  // Fly to user location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || userLat === null || userLng === null) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLat, userLng]);
    } else {
      userMarkerRef.current = L.circleMarker([userLat, userLng], {
        radius: 8, fillColor: "#3b82f6", color: "#fff", weight: 2, fillOpacity: 1,
      }).addTo(map);
    }
    map.flyTo([userLat, userLng], 14, { duration: 0.8 });
  }, [userLat, userLng]);

  // Open shelter popup imperatively when selectedShelterSiteId changes
  useEffect(() => {
    if (selectedShelterSiteId == null || !mapRef.current) return;
    const marker = shelterMarkers.current.get(selectedShelterSiteId);
    if (!marker) return;
    mapRef.current.flyTo(marker.getLatLng(), 15, { duration: 0.6 });
    marker.openPopup();
  }, [selectedShelterSiteId]);

  // Sync shelter markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentIds = new Set(shelters.map(s => s.site_id));
    shelterMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); shelterMarkers.current.delete(id); }
    });
    shelters.forEach(s => {
      const popup = buildShelterPopup(s);
      const existing = shelterMarkers.current.get(s.site_id);
      if (existing) { existing.setPopupContent(popup); existing.setIcon(makeShelterIcon(s, isDark)); return; }
      const marker = L.marker([s.lat, s.lng], { icon: makeShelterIcon(s, isDark) })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 240, offset: [0, -4], closeButton: false });
      shelterMarkers.current.set(s.site_id, marker);
    });
  }, [shelters, isDark]);

  // Sync station markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentIds = new Set(stationPins.map(s => s.district));
    stationMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); stationMarkers.current.delete(id); }
    });
    stationPins.forEach(s => {
      const popup = buildStationPopup(s);
      const existing = stationMarkers.current.get(s.district);
      if (existing) { existing.setPopupContent(popup); existing.setIcon(makeStationIcon(s, isDark)); return; }
      const marker = L.marker([s.lat, s.lng], { icon: makeStationIcon(s, isDark) })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 260, offset: [0, -4], closeButton: false });
      stationMarkers.current.set(s.district, marker);
    });
  }, [stationPins, isDark]);

  // Sync flyer markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentIds = new Set(flyerPins.map(f => f.pinId));
    flyerMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); flyerMarkers.current.delete(id); }
    });
    flyerPins.forEach(f => {
      if (flyerMarkers.current.has(f.pinId)) return;
      const marker = L.marker([f.lat, f.lng], { icon: makeFlyerIcon(f) })
        .addTo(map)
        .bindPopup(buildFlyerPopup(f), { maxWidth: 256, offset: [0, -4], closeButton: false, className: "flyer-popup" });
      flyerMarkers.current.set(f.pinId, marker);
    });
  }, [flyerPins]);

  return (
    <>
      <style>{`
        .shelter-label { opacity: 0; transition: opacity 0.2s ease; }
        .labels-visible .shelter-label { opacity: 1; }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}
