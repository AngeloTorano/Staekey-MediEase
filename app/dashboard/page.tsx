"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import {
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
} from "recharts";
import { Info, LayoutDashboard, Users, MapPin, Download, Loader2 } from "lucide-react";

// --- NEW: Import PDF library ---
import { useReactToPrint } from 'react-to-print';

import {
  Card,
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

// --- NEW: Import Select components ---
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Color Palettes ---
const THEME_COLORS = {
  red: "#f95759",
  darkBlue: "#3a416f",
  grey: "#c9cbcb",
  areaFill: "#fde8e8",
};
const DONUT_COLORS = [THEME_COLORS.darkBlue, THEME_COLORS.red, THEME_COLORS.grey];
const OTHER_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A569BD", "#EB984E"];
const REGION_COLORS = [
  "#3366CC", "#DC3912", "#FF9900", "#109618", "#990099", "#0099C6",
  "#DD4477", "#66AA00", "#B82E2E", "#316395", "#994499", "#22AA99",
  "#AAAA11", "#6633CC", "#E67300", "#8B0707", "#329262", "#5574A6",
];
// --- NEW: Colors for Pie Charts ---
const ISSUE_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A569BD", "#EB984E", "#F1948A", "#8E44AD", "#2ECC71"];
const CAUSE_COLORS = ["#3366CC", "#DC3912", "#FF9900", "#109618", "#990099", "#0099C6", "#DD4477", "#66AA00", "#B82E2E", "#316395", "#994499"];

// --- Map Constants ---
const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const REGIONS = [
  { id: "NCR", name: "National Capital Region (NCR)", lat: 14.5995, lng: 120.9842 },
  { id: "CAR", name: "Cordillera Administrative Region (CAR)", lat: 16.55, lng: 120.97 },
  { id: "Region I", name: "Ilocos Region (Region I)", lat: 16.05, lng: 120.55 },
  { id: "Region II", name: "Cagayan Valley (Region II)", lat: 16.9754, lng: 121.8107 },
  { id: "Region III", name: "Central Luzon (Region III)", lat: 15.4833, lng: 120.7167 },
  { id: "Region IV-A", name: "CALABARZON (Region IV-A)", lat: 13.75, lng: 121.05 },
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

// --- Data Interfaces ---
interface DashboardData {
  total_patients: number;
  new_patients_by_day: { date: string; count: number }[];
  demographics: {
    gender: { gender: string; count: number }[];
    age_distribution: { age_range: string; count: number }[];
    geographic_distribution: {
      region_district: string;
      count: number;
      cities: { city_village: string; city_count: number }[];
    }[];
  };
  patient_funnel: { phase_id: number; patient_count: number }[];
  common_causes: { cause: string; count: number }[];
  common_issues: { issue_type: string; count: number }[];
  total_aids_fitted: number;
  patient_satisfaction: {
    phase1: { rating: string; count: number }[];
    phase2: { rating: string; count: number }[];
    phase3: { rating: string; count: number }[];
  };
}

interface MergedGeoData {
  id: string;
  name: string;
  count: number;
  cities: { city_village: string; city_count: number }[];
  lat: number;
  lng: number;
  color: string;
}

// --- Re-usable Card Components ---
const ChartCard: React.FC<{
  title: string;
  children: React.ReactElement;
  className?: string;
  contentHeight?: string;
  noResponsiveWrapper?: boolean;
  actionButton?: React.ReactNode;
}> = ({
  title,
  children,
  className = "",
  contentHeight = "300px",
  noResponsiveWrapper = false,
  actionButton,
}) => (
  <div className={`bg-white p-6 shadow-sm rounded-lg ${className}`}>
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-gray-600 font-semibold text-lg">{title}</h2>
      <div className="flex items-center space-x-2">
        {actionButton}
        <Info size={16} className="text-gray-400 cursor-pointer print-hide" />
      </div>
    </div>
    <div style={{ width: '100%', height: contentHeight }}>
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

// --- GeographicMapChart Component ---
const GeographicMapChart: React.FC<{ geoData: MergedGeoData[] }> = ({ geoData }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<MergedGeoData | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

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
    const bounds = new (tt.LngLatBounds)([115.0, 4.0], [130.0, 20.6]);
    map.setMaxBounds(bounds);
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isScriptLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !isScriptLoaded) return;
    addMarkersToMap();
  }, [geoData, isScriptLoaded]);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    markersRef.current = [];
  };
  
  const addMarkersToMap = async () => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).tt || !geoData) return;
    clearMarkers();
    for (const region of geoData) {
      if (region.count > 0) {
        const el = makeMarkerElement(region.color);
        el.addEventListener("click", () => {
          setSelectedRegion(region);
        });
        const marker = new (window as any).tt.Marker({ element: el })
          .setLngLat([region.lng, region.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    }
  };
  
  const makeMarkerElement = (color: string) => {
    const el = document.createElement("div");
    el.className = "custom-marker";
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.15s;
    `;
    return el;
  };
  
  return (
    <>
      <div className="w-full h-full relative">
        <div ref={mapRef} className="w-full h-full" />
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
                  <div className="text-sm text-gray-700">Total Patient Count</div>
                  <div className="text-3xl font-bold text-red-600">
                    {selectedRegion?.count}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="text-gray-600 w-4 h-4" />
                  <h4 className="text-sm font-semibold text-gray-700">Patients by City / Village</h4>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {(selectedRegion?.cities && selectedRegion.cities.length > 0) ? (
                    selectedRegion.cities.map((city, index) => (
                      <div key={index} className="flex justify-between items-center text-sm pr-2">
                        <span className="text-gray-800">{city.city_village}</span>
                        <span className="font-bold text-blue-900">{city.city_count}</span>
                      </div>
                    ))
                  ): (
                    <span className="text-xs text-gray-500">No city data available.</span>
                  )}
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
  const [showCommonIssues, setShowCommonIssues] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>(""); // --- MODIFIED: Add gender state ---

  // Ref for the hidden print component
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Helper function to normalize region names
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
    const specialMatch = REGIONS.find((r) => s.includes(r.id));
    if (specialMatch) return specialMatch.id;
    console.warn("Could not normalize region:", raw);
    return raw;
  };

  // useEffect to fetch the list of regions for the filter
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const token =
          sessionStorage.getItem("token") || localStorage.getItem("token");
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;
        
        const response = await axios.get(`${baseUrl}/api/dash/regions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setRegions(response.data.data);
      } catch (error) {
        console.error("Failed to fetch regions:", error);
      }
    };
    fetchRegions();
  }, []); // Runs once on component mount

  // --- MODIFIED: useEffect to fetch dashboard data, depends on selectedRegion AND selectedGender ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setDashboardLoading(true);
      try {
        const token =
          sessionStorage.getItem("token") || localStorage.getItem("token");
        const baseUrl = process.env.NEXT_PUBLIC_API_URL;

        // --- MODIFIED: Use URLSearchParams to build query ---
        const params = new URLSearchParams();
        if (selectedRegion) {
          params.append('region', selectedRegion);
        }
        if (selectedGender) {
          params.append('gender', selectedGender);
        }
        
        const queryString = params.toString();
        let url = `${baseUrl}/api/dash/dash`;
        if (queryString) {
          url += `?${queryString}`;
        }
        // --- End Modified URL Building ---

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDashboardData(response.data.data);
        setDashboardError("");
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
  }, [selectedRegion, selectedGender]); // --- MODIFIED: Add selectedGender to dependency array ---


  // useMemo hook for satisfaction data
  const satisfactionData = useMemo(() => {
    if (!dashboardData?.patient_satisfaction) return [];
    const { phase1, phase2, phase3 } = dashboardData.patient_satisfaction;
    const allRatings = new Set([
      ...phase1.map(p => p.rating),
      ...phase2.map(p => p.rating),
      ...phase3.map(p => p.rating),
    ]);
    return Array.from(allRatings).map(rating => {
      return {
        rating: rating,
        "Phase 1": phase1.find(p => p.rating === rating)?.count || 0,
        "Phase 2": phase2.find(p => p.rating === rating)?.count || 0,
        "Phase 3": phase3.find(p => p.rating === rating)?.count || 0,
      };
    });
  }, [dashboardData?.patient_satisfaction]);

  // useMemo hook for geographic data
  const memoizedGeoData = useMemo((): MergedGeoData[] => {
    if (!dashboardData?.demographics.geographic_distribution) return [];

    return dashboardData.demographics.geographic_distribution.map((geo, index) => {
      const canonicalId = normalizeToCanonical(geo.region_district);
      const regionInfo = REGIONS.find(r => r.id === canonicalId);

      return {
        id: canonicalId,
        name: regionInfo?.name || geo.region_district,
        count: geo.count,
        cities: geo.cities || [],
        lat: regionInfo?.lat || 0,
        lng: regionInfo?.lng || 0,
        color: REGION_COLORS[index % REGION_COLORS.length],
      };
    }).filter(region => region.lat !== 0);
  }, [dashboardData?.demographics.geographic_distribution]);

  
  // PDF Export Function using react-to-print
  const handlePrint = useReactToPrint({
    contentRef: printRef, // Point to the new ref
    documentTitle: 'Starkey-Dashboard-Analytics',
    
    onAfterPrint: () => {
      setIsPrinting(false);
      console.log('Print job completed');
    },
  });


  // --- MODIFIED LOADING CHECK ---
  // Only show the full-page loader on the *initial* load
  if (dashboardLoading && !dashboardData)
    return (
      <p className="text-center mt-10 text-gray-500">Loading dashboard...</p>
    );

  if (dashboardError)
    return <p className="text-center mt-10 text-red-500">{dashboardError}</p>;
  
  if (!dashboardData)
    return <p className="text-center mt-10 text-gray-500">No data available.</p>;

return (
    <>
      {/* --- MODIFIED DIV ---
          This div shows the visual dashboard.
          Added transition and opacity classes for smooth loading state.
      */}
      <div className={`p-6 bg-gray-50 min-h-screen transition-opacity duration-300 ${
        dashboardLoading ? "opacity-50" : "opacity-100"
      }`}>
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center space-x-3">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          </div>
        </div>
 
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
        </div>
 
        {/* --- MODIFIED: Filter Bar (filters left, export button right) --- */}
        <div className="mb-2 bg-transparent print-hide flex items-center justify-between">
          <div className="flex items-center space-x-6">
           {/* Region Filter */}
           <div>
             <label className="text-sm font-medium text-gray-700 mr-3">Filter by Region:</label>
             <Select 
               value={selectedRegion} 
               onValueChange={(value) => {
                 setSelectedRegion(value === "all" ? "" : value);
               }}
             >
               <SelectTrigger className="w-[300px]">
                 <SelectValue placeholder="All Regions" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Regions</SelectItem>
                 {regions.map(region => (
                   <SelectItem key={region} value={region}>
                     {region}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           
           {/* --- NEW: Gender Filter --- */}
           <div>
             <label className="text-sm font-medium text-gray-700 mr-3">Filter by Gender:</label>
             <Select 
               value={selectedGender} 
               onValueChange={(value) => {
                 setSelectedGender(value === "all" ? "" : value);
               }}
             >
               <SelectTrigger className="w-[180px]">
                 <SelectValue placeholder="All Genders" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Genders</SelectItem>
                 <SelectItem value="Male">Male</SelectItem>
                 <SelectItem value="Female">Female</SelectItem>
                 <SelectItem value="Other">Other</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>
         <div className="flex items-center">
            <Button
              id="export-pdf-button"
              className="print-hide"
              variant="secondary"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isPrinting ? "Preparing..." : "Export as PDF"}
            </Button>
          </div>
        </div>
 
        {/* Top Section (Map + Region List) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="lg:col-span-3">
            <ChartCard
              title="Geographic Distribution"
              noResponsiveWrapper={true}
              contentHeight="600px"
            >
              <GeographicMapChart geoData={memoizedGeoData} />
            </ChartCard>
          </div>
          <div className="lg:col-span-1">
            <ChartCard
              title={selectedRegion ? "Patient Distribution in City/Municipality" : "Patient Distribution in Rregions"}
              contentHeight="600px"
              noResponsiveWrapper={true}
            >
              <div className="overflow-y-auto h-full">
                {/* --- MODIFIED: Logic to handle region filter or no region filter --- */}
                {!selectedRegion && memoizedGeoData.length > 0 && (
                  memoizedGeoData.map((region, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-3 w-4/5">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: region.color }}
                        />
                        <span className="text-sm text-gray-700 truncate" title={region.name}>
                          {region.name}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-900">{region.count}</span>
                    </div>
                  ))
                )}
                {/* --- MODIFIED: Show city list *only if* a region is selected --- */}
                {selectedRegion && memoizedGeoData.length > 0 && (
                  memoizedGeoData[0].cities.map((city, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-3 w-4/5">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: memoizedGeoData[0].color }}
                        />
                        <span className="text-sm text-gray-700 truncate" title={city.city_village}>
                          {city.city_village}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-900">{city.city_count}</span>
                    </div>
                  ))
                )}
                {memoizedGeoData.length === 0 && (
                  <p className="text-sm text-gray-500 text-center pt-4">No data for this filter.</p>
                )}
              </div>
            </ChartCard>
          </div>
        </div>

        {/* Bottom Section (Charts) */}
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <ChartCard title="Patient Satisfaction">
              <BarChart
                data={satisfactionData}
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rating" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Phase 1" fill={THEME_COLORS.grey} />
                <Bar dataKey="Phase 2" fill={THEME_COLORS.darkBlue} />
                <Bar dataKey="Phase 3" fill={THEME_COLORS.red} />
              </BarChart>
            </ChartCard>
<ChartCard
              title={showCommonIssues ? "Otosocopy Findings" : "Hearing Loss Cause"}
              actionButton={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommonIssues(!showCommonIssues)}
                  className="text-xs print-hide"
                >
                  {showCommonIssues ? "Show Causes" : "Show Issues"}
                </Button>
              }
            >
              {showCommonIssues ? (
                // --- PieChart for Issues ---
                <PieChart>
                  <Pie
                    data={dashboardData.common_issues}
                    dataKey="count"
                    nameKey="issue_type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ percent = 0 }: { percent?: number }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dashboardData.common_issues.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ISSUE_COLORS[index % ISSUE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : (
                // --- PieChart for Causes ---
                <PieChart>
                  <Pie
                    data={dashboardData.common_causes}
                    dataKey="count"
                    nameKey="cause"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ percent = 0 }: { percent?: number }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dashboardData.common_causes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CAUSE_COLORS[index % CAUSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              )}
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Gender Distribution">
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
            <ChartCard title="Age Distribution">
              <BarChart data={dashboardData.demographics.age_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="age_range" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={THEME_COLORS.darkBlue} />
              </BarChart>
            </ChartCard>
          </div>
        </div>
      </div>

      {/* --- This div is hidden on screen and only used for printing --- */}
      <div style={{ display: "none" }}>
        {/* --- MODIFIED: Pass both filters to the print component --- */}
        {dashboardData && <DashboardPrintReport ref={printRef} data={dashboardData} filter={{ region: selectedRegion, gender: selectedGender }} />}
      </div>
    </>
  );
};


// --- Report Component for Text-Based PDF ---
// --- MODIFIED: Update props to accept filter object ---
interface ReportProps {
  data: DashboardData;
  filter: {
    region: string;
    gender: string;
  };
}

const DashboardPrintReport = React.forwardRef<HTMLDivElement, ReportProps>(({ data, filter }, ref) => {
  
  const filteredGeoData = data.demographics.geographic_distribution;

  return (
    // We use inline styles here because Tailwind classes won't be applied to this hidden component
    <div ref={ref} style={{ padding: '20mm', fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.4' }}>
      
      {/* This style block is critical for printing */}
      <style>{`
        .report-h1 {
          font-size: 24pt;
          color: #3a416f;
          border-bottom: 2px solid #3a416f;
          padding-bottom: 5px;
          margin-bottom: 20px;
        }
        .report-h2 {
          font-size: 16pt;
          color: #f95759;
          margin-top: 25px;
          margin-bottom: 10px;
          border-bottom: 1px solid #c9cbcb;
          /* Ensure headers don't split across pages */
          page-break-after: avoid;
        }
        .report-h3 {
          font-size: 13pt;
          font-weight: bold;
          color: #333;
          margin-top: 15px;
          page-break-after: avoid;
        }
        .report-p {
          margin-bottom: 10px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .kpi-item {
          padding: 15px;
          border: 1px solid #c9cbcb;
          border-radius: 5px;
          text-align: center;
        }
        .kpi-title {
          font-size: 10pt;
          text-transform: uppercase;
          color: #555;
        }
        .kpi-value {
          font-size: 24pt;
          font-weight: bold;
          color: #3a416f;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          /* Prevents tables from splitting across pages mid-row */
          page-break-inside: avoid;
        }
        .report-table th, .report-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .report-table th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        .report-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .report-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          page-break-inside: avoid;
        }
      `}</style>
      
      {/* --- Report Content --- */}
      <h1 className="report-h1">Dashboard Report</h1>
      {/* --- MODIFIED: Display both filters --- */}
      <p className="report-p">
        <strong>Report Generated:</strong> {new Date().toLocaleString()}
        <br />
        <strong>Region Filter:</strong> {filter.region || "All Regions"}
        <br />
        <strong>Gender Filter:</strong> {filter.gender || "All Genders"}
      </p>

      <h2 className="report-h2">Key Performance Indicators</h2>
      <div className="kpi-grid">
        <div className="kpi-item">
          <div className="kpi-title">Total Patients</div>
          <div className="kpi-value">{data.total_patients}</div>
        </div>
        <div className="kpi-item">
          <div className="kpi-title">Total Aids Fitted</div>
          <div className="kpi-value">{data.total_aids_fitted}</div>
        </div>
      </div>

      <h2 className="report-h2">Geographic Distribution</h2>
      {/* --- MODIFIED: Check for region filter specifically --- */}
      {!filter.region && (
        <>
          <h3 className="report-h3">Patient Distribution in Rregions</h3>
          <table className="report-table">
            <thead>
              <tr><th>Region</th><th>Patient Count</th></tr>
            </thead>
            <tbody>
              {filteredGeoData.map((geo, i) => (
                <tr key={i}>
                  <td>{geo.region_district}</td>
                  <td>{geo.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {filter.region && (
        <>
          <h3 className="report-h3">Patient Distribution in City/Municipality (Region: {filter.region})</h3>
          <table className="report-table">
            <thead>
              <tr><th>City / Village</th><th>Patient Count</th></tr>
            </thead>
            <tbody>
              {filteredGeoData.length > 0 ? (
                filteredGeoData[0].cities.map((city, i) => (
                  <tr key={i}>
                    <td>{city.city_village}</td>
                    <td>{city.city_count}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={2}>No city data for this region.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      <h2 className="report-h2">Demographics</h2>
      <div className="report-grid-2">
        <div>
          <h3 className="report-h3">Gender Distribution</h3>
          <table className="report-table">
            <thead>
              <tr><th>Gender</th><th>Count</th></tr>
            </thead>
            <tbody>
              {data.demographics.gender.map((g, i) => (
                <tr key={i}>
                  <td>{g.gender || "Unknown"}</td>
                  <td>{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="report-h3">Age Distribution</h3>
          <table className="report-table">
            <thead>
              <tr><th>Age Range</th><th>Count</th></tr>
            </thead>
            <tbody>
              {data.demographics.age_distribution.map((a, i) => (
                <tr key={i}>
                  <td>{a.age_range}</td>
                  <td>{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="report-h2">Clinical Data</h2>
      <div className="report-grid-2">
        <div>
          <h3 className="report-h3">Common Issues</h3>
          <table className="report-table">
            <thead>
              <tr><th>Issue</th><th>Cases</th></tr>
            </thead>
            <tbody>
              {data.common_issues.map((issue, i) => (
                <tr key={i}>
                  <td>{issue.issue_type}</td>
                  <td>{issue.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="report-h3">Common Causes of Hearing Loss</h3>
          <table className="report-table">
            <thead>
              <tr><th>Cause</th><th>Cases</th></tr>
            </thead>
            <tbody>
              {data.common_causes.map((cause, i) => (
                <tr key={i}>
                  <td>{cause.cause}</td>
                  <td>{cause.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="report-h2">Patient Satisfaction</h2>
      <h3 className="report-h3">By Phase</h3>
      <table className="report-table">
        <thead>
          <tr>
            <th>Rating</th>
            <th>Phase 1 (Hearing)</th>
            <th>Phase 2 (Hearing Aid)</th>
            <th>Phase 3 (Hearing Aid)</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(new Set([
            ...data.patient_satisfaction.phase1.map(p => p.rating),
            ...data.patient_satisfaction.phase2.map(p => p.rating),
            ...data.patient_satisfaction.phase3.map(p => p.rating),
          ])).sort().map(rating => (
            <tr key={rating}>
              <td>{rating}</td>
              <td>{data.patient_satisfaction.phase1.find(p => p.rating === rating)?.count || 0}</td>
              <td>{data.patient_satisfaction.phase2.find(p => p.rating === rating)?.count || 0}</td>
              <td>{data.patient_satisfaction.phase3.find(p => p.rating === rating)?.count || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
DashboardPrintReport.displayName = "DashboardPrintReport";


export default DashboardPage;