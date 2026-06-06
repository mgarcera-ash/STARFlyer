"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

type Props = {
  userLat: number;
  userLng: number;
  shelters: Shelter[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export default function MapView({ userLat, userLng, shelters, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [userLat, userLng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    userMarkerRef.current = L.circleMarker([userLat, userLng], {
      radius: 8,
      fillColor: "#3b82f6",
      color: "#fff",
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [userLat, userLng]);

  // Sync shelter markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers not in current shelters
    const currentIds = new Set(shelters.map((s) => s.site_id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    shelters.forEach((s) => {
      if (markersRef.current.has(s.site_id)) return;
      const marker = L.marker([s.lat, s.lng])
        .addTo(map)
        .on("click", () => onSelect(s.site_id));
      markersRef.current.set(s.site_id, marker);
    });
  }, [shelters, onSelect]);

  // Fly to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId === null) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) map.flyTo(marker.getLatLng(), 15, { duration: 0.6 });
  }, [selectedId]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
