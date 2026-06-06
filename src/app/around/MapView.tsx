"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CHICAGO: L.LatLngTuple = [41.8781, -87.6298];

export type Shelter = {
  site_id: number;
  site_name: string | null;
  agency: string | null;
  population: string | null;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  distance?: number;
};

type Props = {
  userLat: number | null;
  userLng: number | null;
  shelters: Shelter[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

const PHONE_CIRCLE = `<div style="width:18px;height:18px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg></div>`;
const PIN_CIRCLE  = `<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#fff"/></svg></div>`;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPopup(s: Shelter): string {
  let html = `<div style="font-family:system-ui,sans-serif;padding:2px 0;min-width:160px">`;
  if (s.agency)     html += `<p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#000;line-height:1.3">${esc(s.agency)}</p>`;
  if (s.site_name)  html += `<p style="margin:0 0 6px;font-size:12px;color:#000;line-height:1.3">${esc(s.site_name)}</p>`;
  if (s.population) html += `<span style="display:inline-block;font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px;background:#e5e7eb;color:#737373;margin-bottom:8px">${esc(s.population)}</span>`;
  if (s.phone)      html += `<div style="display:flex;align-items:center;gap:6px;margin-top:6px">${PHONE_CIRCLE}<a href="tel:${s.phone.replace(/\D/g, "")}" style="font-size:12px;color:#3b82f6;text-decoration:none;font-weight:500">${esc(s.phone)}</a></div>`;
  if (s.address)    html += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">${PIN_CIRCLE}<span style="font-size:11px;color:#737373">${esc(s.address)}</span></div>`;
  if (s.distance !== undefined) {
    const dist = s.distance < 0.1 ? "&lt;0.1" : s.distance.toFixed(1);
    html += `<p style="margin:8px 0 0;font-size:11px;color:#737373">${dist} mi away</p>`;
  }
  html += `</div>`;
  return html;
}

export default function MapView({ userLat, userLng, shelters, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Map<number, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  // Init map once — centered on Chicago
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: CHICAGO,
      zoom: 11,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Fly to user location and place/move user marker
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

  // Sync shelter markers — create new ones, update popup content on existing ones
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(shelters.map(s => s.site_id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    shelters.forEach(s => {
      const popup = buildPopup(s);
      const existing = markersRef.current.get(s.site_id);
      if (existing) {
        existing.setPopupContent(popup);
        return;
      }
      const marker = L.marker([s.lat, s.lng])
        .addTo(map)
        .bindPopup(popup, { maxWidth: 240, offset: [0, -4] })
        .on("click", () => onSelect(s.site_id));
      markersRef.current.set(s.site_id, marker);
    });
  }, [shelters, onSelect]);

  // Fly to selected marker and open its popup
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId === null) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) {
      map.flyTo(marker.getLatLng(), 15, { duration: 0.6 });
      setTimeout(() => marker.openPopup(), 650);
    }
  }, [selectedId]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
