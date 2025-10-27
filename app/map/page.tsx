"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { MapPin, Users, AlertCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const REGIONS = [
  { id: "NCR", name: "National Capital Region (NCR)", lat: 14.5995, lng: 120.9842 },
  { id: "CAR", name: "Cordillera Administrative Region (CAR)", lat: 16.55, lng: 120.97 },
  { id: "Region I", name: "Ilocos Region (Region I)", lat: 16.05, lng: 120.55 },
  { id: "Region II", name: "Cagayan Valley (Region II)", lat: 16.9754, lng: 121.8107 },
  { id: "Region III", name: "Central Luzon (Region III)", lat: 15.4833, lng: 120.7167 },
  { id: "Region IV-A", name: "CALABARZON (Region IV-A)", lat: 14.100638753173586, lng: 121.18352983696533 }, 
  { id: "Region IV-B", name: "MIMAROPA (Region IV-B)", lat: 12.37, lng: 121.07 },
  { id: "Region V", name: "Bicol Region (Region V)", lat: 13.4209, lng: 123.4137 },
  { id: "Region VI", name: "Western Visayas (Region VI)", lat: 11.005, lng: 122.5371 },
  { id: "Region VII", name: "Central Visayas (Region VII)", lat: 10.3157, lng: 123.8854 },
  { id: "Region VIII", name: "Eastern Visayas (Region VIII)", lat: 11.25, lng: 124.9833 },
  { id: "Region IX", name: "Zamboanga Peninsula (Region IX)", lat: 8.25, lng: 123.2667 },
  { id: "Region X", name: "Northern Mindanao (Region X)", lat: 8.4833, lng: 124.65 },
  { id: "Region XI", name: "Davao Region (Region XI)", lat: 7.0667, lng: 125.6083 },
  { id: "Region XII", name: "SOCCSKSARGEN (Region XII)", lat: 6.5, lng: 124.8333 },
  { id: "Region XIII", name: "Caraga (Region XIII)", lat: 8.8, lng: 125.8 },
  { id: "BARMM", name: "BARMM", lat: 6.95, lng: 124.2167 },
];


export default function PatientDistributionMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [patientData, setPatientData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // normalize region names
  const normalizeToCanonical = (raw = "") => {
    const s = raw ? String(raw).toUpperCase().replace(/\s+/g, " ").trim() : "";
    if (!s) return "";
    const match = s.match(/REGION\s*(\d+|IV-A|IV-B|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII)/);
    if (match) {
      const key = "Region " + match[1];
      const found = REGIONS.find((r) => r.id.toUpperCase() === key.toUpperCase());
      if (found) return found.id;
    }
    const byId = REGIONS.find((r) => r.id.toUpperCase() === s);
    if (byId) return byId.id;
    const byName = REGIONS.find(
      (r) => r.name.toUpperCase().includes(s) || s.includes(r.name.toUpperCase())
    );
    if (byName) return byName.id;
    return "";
  };

  // fetch data
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Retrieve token from sessionStorage or localStorage
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");

        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const resp = await axios.get(`${API_URL}/api/reports/patient-geographic`, {
          headers,
          withCredentials: false, // change to true if your backend uses cookies
        });

        setPatientData(resp.data?.patient_distribution || []);
        console.log("Fetched patient data:", resp.data);
      } catch (err: any) {
        console.error("Error fetching patient data:", err);
        setError(err?.response?.data?.error || "Failed to fetch patient data");
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, []);



  // load TomTom SDK
  useEffect(() => {
    if (isScriptLoaded) return;
    const load = async () => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css";
      document.head.appendChild(css);

      const script = document.createElement("script");
      script.src = "https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js";
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      document.head.appendChild(script);
    };
    load();
  }, [isScriptLoaded]);

  // initialize map
  useEffect(() => {
    if (!isScriptLoaded || mapInstanceRef.current) return;

    const tt = (window as any).tt;
    const map = tt.map({
      key: TOMTOM_API_KEY,
      container: mapRef.current,
      center: [122.5, 12.0], // 🇵🇭 Philippines center
      zoom: 3,
      minZoom: 3,
      maxZoom: 5, // optional
      dragpan: false,
      style:
        "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAVzVIak5Sa1psMEl5Y1VjUDu-_JasLpVOe7ObWhVQUtMj/drafts/0.json?key=" +
        TOMTOM_API_KEY,
    });

    mapInstanceRef.current = map;

    // ✅ Add markers when map loads
    map.on("load", () => addMarkersToMap());

    // ✅ Recenter map when user zooms out too far
    map.on("zoomend", () => {
      const currentZoom = map.getZoom();
      if (currentZoom <= 3) {
        map.setCenter([122.5, 12.0]); // recenter to PH
      }
    });

if (map.dragPan) {
  map.dragPan.disable();
}


  const bounds = new tt.LngLatBounds(
  [115.0, 4.0],   // southwest corner (below Tawi-Tawi)
  [130.0, 20.6]   // northeast corner (beyond Batanes)
);
map.setMaxBounds(bounds);


    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isScriptLoaded]);


  // update markers when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || loading) return;
    addMarkersToMap();
  }, [patientData, loading]);

  // clear existing markers
  const clearMarkers = () => {
    markersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch (e) { }
    });
    markersRef.current = [];
  };
  
  // compute aggregated counts per canonical region id (robust to backend field name)
  const computeRegionCounts = () => {
    const counts: Record<string, number> = {};
    for (const row of patientData) {
      const raw = String(row.region || "").trim();
      const canonical = normalizeToCanonical(raw);
      const c = Number(row.patient_count ?? row.patientCount ?? 0) || 0;
      if (canonical && REGIONS.find((r) => r.id === canonical)) {
        counts[canonical] = (counts[canonical] || 0) + c;
      } else {
        // fallback: try to match by name if canonical not found
        const byName = REGIONS.find(
          (r) =>
            r.name.toUpperCase().includes(raw.toUpperCase()) ||
            raw.toUpperCase().includes(r.name.toUpperCase())
        );
        if (byName) counts[byName.id] = (counts[byName.id] || 0) + c;
      }
    }
    return counts;
  };
  
  // add markers
  const addMarkersToMap = async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    clearMarkers();
  
    const counts: Record<string, number> = {};
  
    for (const row of patientData) {
      const raw = String(row.region || "").trim();
      const canonical = normalizeToCanonical(raw);
      const c = Number(row.patient_count || 0) || 0;
      if (canonical && REGIONS.find((r) => r.id === canonical)) {
        counts[canonical] = (counts[canonical] || 0) + c;
      }
    }
  
    for (const r of REGIONS) {
      const count = counts[r.id] || 0;
      const el = makeMarkerElement(count);
      el.addEventListener("click", () => {
        setSelectedRegion({
          id: r.id,
          name: r.name,
          patientCount: count,
          backendRegion: r.id,
          lat: r.lat,
          lng: r.lng,
        });
      });
  
      const marker = new (window as any).tt.Marker({ element: el })
        .setLngLat([r.lng, r.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  };
  
  const makeMarkerElement = (count: number) => {
    const el = document.createElement("div");
    el.className = "custom-marker";
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background: ${count > 0 ? "#000000ff" : "#ffffffff"};
      border: 3px solid white;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.15s;
    `;
    return el;
  };

  // compute top region (id, name, count, lat, lng)
  const getTopRegion = () => {
    const counts: Record<string, number> = {};
    for (const row of patientData) {
      const raw = String(row.region || "").trim();
      const canonical = normalizeToCanonical(raw) || raw;
      const c = Number(row.patient_count || 0) || 0;
      counts[canonical] = (counts[canonical] || 0) + c;
    }
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const [key, count] = entries[0];
    const regionObj = REGIONS.find(
      (r) => r.id === key || r.name.toUpperCase().includes(String(key).toUpperCase())
    );
    return {
      id: regionObj?.id || key,
      name: regionObj?.name || key,
      count,
      lat: regionObj?.lat ?? null,
      lng: regionObj?.lng ?? null,
    };
  };
  
  const topRegion = getTopRegion();
  
  return (
    <div className="flex gap-4 h-[650px] bg-gray-50 p-4">
      {/* Left: Map Card (3/4 of the screen) */}
      <div className="flex-1 relative rounded-lg overflow-hidden shadow bg-white">
        {loading && (
          <Card className="absolute inset-0 m-auto w-fit p-6 flex flex-col items-center justify-center z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-gray-600">Loading map data...</p>
          </Card>
        )}
  
        {error && (
          <Card className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-300 z-10">
            <CardContent className="flex items-center gap-2 p-4">
              <AlertCircle className="text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}
  
        <div ref={mapRef} className="w-full h-full" />
  
        {/* Legend */}
        <Card className="absolute bottom-4 left-4 shadow-lg w-44">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-black rounded-full border-2 border-white"></div>
              <span>Has Patients</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-400 rounded-full border-2 border-white"></div>
              <span>No Patients</span>
            </div>
          </CardContent>
        </Card>
  
        {/* Selected Region Dialog */}
        <Dialog open={!!selectedRegion} onOpenChange={() => setSelectedRegion(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedRegion?.name}</DialogTitle>
              <DialogDescription>Region details and patient count</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Card className="bg-red-50">
                <CardContent className="p-4 flex items-center gap-3">
                  <Users className="text-red-600 w-5 h-5" />
                  <div>
                    <div className="text-sm text-gray-700">Patient Count</div>
                    <div className="text-3xl font-bold text-red-600">
                      {selectedRegion?.patientCount}
                    </div>
                  </div>
                </CardContent>
              </Card>
  
              <Card className="bg-gray-50 text-xs">
                <CardContent className="p-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Latitude:</span>
                    <span className="font-mono">
                      {(selectedRegion?.lat ?? 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Longitude:</span>
                    <span className="font-mono">
                      {(selectedRegion?.lng ?? 0).toFixed(4)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  
      {/* Right: Top Regions Card (1/4 of screen) */}
      <Card className="w-1/4 shadow bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-800">
            Region List
          </CardTitle>
          <CardDescription>Regions with most patients</CardDescription>
        </CardHeader>
        <CardContent className="p-4 max-h-[560px] overflow-y-auto">
          {(() => {
            const counts = computeRegionCounts();
            const regionsSorted = REGIONS
              .map((r) => ({ ...r, patientCount: counts[r.id] || 0 }))
              .sort((a, b) => b.patientCount - a.patientCount)
              .slice(0, 10);

            const max = Math.max(1, ...regionsSorted.map((r) => r.patientCount));

            return (
              <div className="space-y-3">
                {regionsSorted.map((region, idx) => {
                  const pct = Math.round((region.patientCount / max) * 100);
                  return (
                    <div key={region.id} className="flex items-center gap-3">
                      <div className="w-8 text-xs text-gray-600">{idx + 1}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-sm font-medium text-gray-700 truncate">
                            {region.name}
                          </div>
                          <div className="text-xs font-semibold text-blue-600 ml-2">
                            {region.patientCount}
                          </div>
                        </div>
                        <div className="h-3 bg-gray-100 rounded overflow-hidden">
                          <div
                            className={`h-full rounded ${region.patientCount > 0 ? "bg-black" : "bg-gray-300"}`}
                            style={{ width: `${pct}%`, transition: "width 300ms ease" }}
                            title={`${region.patientCount} patients (${pct}%)`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* x-axis scale labels */}
                <div className="mt-3 text-xs text-gray-500 flex justify-between">
                  <span>0</span>
                  <span>{max} (max)</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
  
}
