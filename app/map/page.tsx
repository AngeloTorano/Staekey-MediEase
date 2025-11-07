"use client";
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Treemap,
} from "recharts";
import { Info, MapPin, Users, AlertCircle } from "lucide-react";

// --- New UI Imports from Map ---
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

// --- Color Palettes ---
const THEME_COLORS = {
  red: "#f95759",
  darkBlue: "#3a416f",
  grey: "#c9cbcb",
  areaFill: "#fde8e8",
};
const DONUT_COLORS = [THEME_COLORS.darkBlue, THEME_COLORS.red, THEME_COLORS.grey];
const OTHER_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A569BD", "#EB984E"];

// --- Map Constants ---
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

// --- Dashboard Data Interface ---
interface DashboardData {
  total_patients: number;
  new_patients_by_day: { date: string; count: number }[];
  demographics: {
    gender: { gender: string; count: number }[];
    age_distribution: { age_range: string; count: number }[];
    geographic_distribution: { region_district: string; count: number }[];
  };
  patient_funnel: { phase_id: number; patient_count: number }[];
  common_causes: { cause: string; count: number }[];
  common_issues: { issue_type: string; count: number }[];
  total_aids_fitted: number;
}

// --- Re-usable Card Components ---
const ChartCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
  noResponsiveWrapper?: boolean;
}> = ({
  title,
  children,
  className = "",
  noResponsiveWrapper = false,
}) => (
  <div className={`bg-white p-6 shadow-sm rounded-lg ${className}`}>
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-gray-600 font-semibold text-lg">{title}</h2>
      <Info size={16} className="text-gray-400 cursor-pointer" />
    </div>
    <div style={{ width: '100%', height: '300px' }}>
      {noResponsiveWrapper ? (
        children
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

const KpiCard: React.FC<{ title: string; value: string | number; color: string }> = ({
  title,
  value,
  color,
}) => (
  <div className="bg-white p-6 shadow-sm rounded-lg text-center">
    <p className="text-sm text-gray-500 uppercase">{title}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </div>
);

// --- Integrated Map Component ---
const GeographicMapChart: React.FC = () => {
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
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const resp = await axios.get(`${API_URL}/api/reports/patient-geographic`, {
          headers,
          withCredentials: false,
        });
        setPatientData(resp.data?.patient_distribution || []);
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
      if (document.querySelector('script[src*="tomtom.com"]')) {
        setIsScriptLoaded(true);
        return;
      }

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
    if (!isScriptLoaded || mapInstanceRef.current || !mapRef.current) return;

    const tt = (window as any).tt;
    if (!tt) return;

    const map = tt.map({
      key: TOMTOM_API_KEY,
      container: mapRef.current,
      center: [122.5, 12.0],
      zoom: 3,
      minZoom: 3,
      maxZoom: 5,
      dragpan: false,
      style:
        "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAVzVIak5Sa1psMEl5Y1VjUDu-_JasLpVOe7ObWhVQUtMj/drafts/0.json?key=" +
        TOMTOM_API_KEY,
    });
    mapInstanceRef.current = map;
    map.on("load", () => addMarkersToMap());
    map.on("zoomend", () => {
      const currentZoom = map.getZoom();
      if (currentZoom <= 3) {
        map.setCenter([122.5, 12.0]);
      }
    });
    if (map.dragPan) {
      map.dragPan.disable();
    }
    const bounds = new tt.LngLatBounds([115.0, 4.0], [130.0, 20.6]);
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
  }, [patientData, loading, isScriptLoaded]);

  // clear existing markers
  const clearMarkers = () => {
    markersRef.current.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    markersRef.current = [];
  };
  
  // add markers
  const addMarkersToMap = async () => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).tt) return;
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
  
  return (
    <>
      <div className="w-full h-full relative">
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
  
        <Card className="absolute bottom-2 left-2 shadow-lg w-36 z-10">
          <CardHeader className="p-2 pb-1">
            <CardTitle className="text-xs">Legend</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-black rounded-full border border-white"></div>
              <span>Has Patients</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white rounded-full border border-gray-400"></div>
              <span>No Patients</span>
            </div>
          </CardContent>
        </Card>
      </div>

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
    </>
  );
};

// --- Main Dashboard Page Component ---
const DashboardPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token =
          sessionStorage.getItem("token") || localStorage.getItem("token");
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await axios.get(`${baseUrl}/api/dash/dash`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDashboardData(response.data.data);
      } catch (error: any) {
        console.error("Dashboard fetch error:", error);
        setDashboardError(
          "Failed to load dashboard data. Please check your connection or token."
        );
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (dashboardLoading)
    return (
      <p className="text-center mt-10 text-gray-500">Loading dashboard...</p>
    );
  if (dashboardError)
    return <p className="text-center mt-10 text-red-500">{dashboardError}</p>;
  if (!dashboardData)
    return <p className="text-center mt-10 text-gray-500">No data available.</p>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-700">📊 Hearing Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <KpiCard
          title="Total Patients"
          value={dashboardData.total_patients}
          color="text-red-500"
        />
        <KpiCard
          title="Total Aids Fitted"
          value={dashboardData.total_aids_fitted}
          color="text-blue-900"
        />
        <KpiCard
          title="Phases Recorded"
          value={dashboardData.patient_funnel.length}
          color="text-gray-500"
        />
      </div>

      {/* --- 2 Charts Above --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 1. New Patients by Day (AreaChart) */}
        <ChartCard title="🧍 New Patients by Day">
          <AreaChart
            data={dashboardData.new_patients_by_day}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke={THEME_COLORS.red}
              fill={THEME_COLORS.areaFill}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartCard>

        {/* 2. Geographic Distribution (Integrated Map) */}
        <ChartCard title="🗺️ Geographic Distribution" noResponsiveWrapper={true}>
          <GeographicMapChart />
        </ChartCard>
      </div>

      {/* --- 4 Charts Below --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* 3. Gender Distribution (Donut Chart) */}
        <ChartCard title="👫 Gender Distribution">
          <PieChart>
            <Pie
              data={dashboardData.demographics.gender}
              dataKey="count"
              nameKey="gender"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              label
            >
              {dashboardData.demographics.gender.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        {/* 4. Age Distribution (Vertical BarChart) */}
        <ChartCard title="📅 Age Distribution">
          <BarChart data={dashboardData.demographics.age_distribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="age_range" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill={THEME_COLORS.darkBlue} />
          </BarChart>
        </ChartCard>

        {/* 5. Common Hearing Loss Causes (Horizontal BarChart) */}
        <ChartCard title="🦻 Common Causes">
          <BarChart
            data={dashboardData.common_causes}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis
              dataKey="cause"
              type="category"
              scale="band"
              tick={{ fontSize: 10 }}
              width={80}
            />
            <Tooltip />
            <Bar dataKey="count" fill={THEME_COLORS.grey} />
          </BarChart>
        </ChartCard> {/* <-- This is the corrected line */}

        {/* 6. Common Ear Issues (Treemap) */}
        <ChartCard title="👂 Common Issues">
          <Treemap
            data={dashboardData.common_issues}
            dataKey="count"
            nameKey="issue_type"
            ratio={4 / 3}
            stroke="#fff"
            fill="#8884d8"
          >
            {dashboardData.common_issues.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={OTHER_COLORS[index % OTHER_COLORS.length]} />
            ))}
            <Tooltip
              formatter={(value: number, name: string) => [`${value} cases`, name]}
            />
          </Treemap>
        </ChartCard>

      </div>
    </div>
  );
};

export default DashboardPage;