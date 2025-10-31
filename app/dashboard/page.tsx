"use client";

import React, { useEffect, useMemo, useState } from "react";

type KPI = {
  total_patients: number;
  total_fittings: number;
  active_patients: number;
  success_rate: number | string;
  average_age: number | null;
  completion_rate: number | string;
  gender_breakdown?: { gender: string; count: number }[];
};

type EnhancedSummaryResponse = {
  summary: KPI;
  trends: {
    monthly: any[]; // monthly metrics from controller
    growth_rate: number | string;
  };
  filters_applied?: Record<string, any>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

function formatNumber(n: number | string | null) {
  if (n === null || n === undefined) return "-";
  if (typeof n === "string") return n;
  if (Math.abs(n) >= 1000) return n.toLocaleString();
  return String(n);
}

function Sparkline({ values = [], width = 120, height = 28, stroke = "#fff" }: { values?: number[]; width?: number; height?: number; stroke?: string }) {
  const pts = useMemo(() => {
    if (!values || values.length === 0) return "";
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * width;
        const y = height - ((v - min) / span) * height;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values, width, height]);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniPie({ items = [], size = 80 }: { items?: { label?: string; value: number; color?: string }[]; size?: number }) {
  const total = (items || []).reduce((s, it) => s + (it.value || 0), 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  let angle = -Math.PI / 2;
  return (
    <svg width={size} height={size}>
      {items.map((it, i) => {
        const a = (it.value / total) * Math.PI * 2;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        angle += a;
        const x2 = cx + r * Math.cos(angle);
        const y2 = cy + r * Math.sin(angle);
        const large = a > Math.PI ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        return <path key={i} d={path} fill={it.color || ["#4d96ff", "#ff6b6b", "#ffd36b", "#8dff7a"][i % 4]} stroke="#fff" strokeWidth={0.5} />;
      })}
    </svg>
  );
}

export default function DashboardPage(): JSX.Element {
  const [data, setData] = useState<EnhancedSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`${API_BASE}/dashboard/enhanced-summary`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || res.statusText);
        }
        return res.json();
      })
      .then((json) => {
        if (!mounted) return;
        setData(json);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        if (mounted) setError(String(err.message || err));
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const monthlyNumbers = useMemo(() => {
    const arr = data?.trends?.monthly ?? [];
    // try to extract a numeric metric (new_patients, patient_count, or new_patients)
    return arr.map((m: any) => Number(m.patient_count ?? m.new_patients ?? m.total_patients ?? 0));
  }, [data]);

  const genderItems = useMemo(() => {
    const g = (data?.summary?.gender_breakdown || []).slice(0, 5);
    const palette = ["#4d96ff", "#ff6b6b", "#ffd36b", "#8dff7a", "#b06bff"];
    return g.map((it: any, i: number) => ({ label: it.gender, value: it.count, color: palette[i % palette.length] }));
  }, [data]);

  return (
    <div style={{ minHeight: "100vh", padding: 20, background: "#0f1724", color: "#e6eef8", fontFamily: "-apple-system,Segoe UI,Roboto,Helvetica,Arial" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "#fff" }}>Power-like Dashboard</h1>
            <div style={{ color: "#9fb0d6", fontSize: 12 }}>Comprehensive summary · {data ? "Live" : loading ? "Loading..." : "Offline"}</div>
          </div>
          <div style={{ fontSize: 12, color: "#9fb0d6" }}>{data?.filters_applied ? "Filters applied" : ""}</div>
        </header>

        {loading ? (
          <div style={{ padding: 40, background: "#081226", borderRadius: 8, textAlign: "center" }}>Loading dashboard…</div>
        ) : error ? (
          <div style={{ padding: 20, background: "#330000", borderRadius: 8, color: "#ffdede" }}>Error: {error}</div>
        ) : data ? (
          <>
            {/* KPI tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { id: "patients", label: "Total patients", value: data.summary.total_patients, color: "#1f77b4" },
                { id: "fittings", label: "Total fittings", value: data.summary.total_fittings, color: "#ff7f0e" },
                { id: "active", label: "Active patients", value: data.summary.active_patients, color: "#2ca02c" },
                { id: "success", label: "Success rate", value: `${formatNumber(data.summary.success_rate)}%`, color: "#9467bd" },
              ].map((tile) => (
                <div key={tile.id} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", padding: 14, borderRadius: 6, boxShadow: "0 6px 18px rgba(2,6,23,0.6)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#a9c2e6" }}>{tile.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 6 }}>{formatNumber(tile.value as any)}</div>
                    </div>
                    <div style={{ width: 72, height: 40, borderRadius: 6, background: tile.color }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Sparkline values={monthlyNumbers} width={180} height={28} stroke="#dbeafe" />
                  </div>
                </div>
              ))}
            </div>

            {/* Two-column details: chart + breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
              <div style={{ background: "#071023", padding: 14, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Monthly trends</div>
                  <div style={{ fontSize: 12, color: "#9fb0d6" }}>Growth {data.trends.growth_rate}%</div>
                </div>

                {/* big area chart (simple poly) */}
                <div style={{ height: 220 }}>
                  <svg viewBox={`0 0 600 220`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4d96ff" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#4d96ff" stopOpacity="0.08" />
                      </linearGradient>
                    </defs>
                    <rect x={0} y={0} width={600} height={220} fill="transparent" />
                    {(() => {
                      const vals = monthlyNumbers.length ? monthlyNumbers : [0, 0, 0];
                      const max = Math.max(...vals) || 1;
                      const min = Math.min(...vals);
                      const points = vals.map((v, i) => {
                        const x = (i / Math.max(vals.length - 1, 1)) * 600;
                        const y = 220 - ((v - min) / (max - min || 1)) * 200 - 10;
                        return `${x},${y}`;
                      });
                      const poly = `M0,220 L${points.join(" L ")} L600,220 Z`;
                      const line = points.join(" L ");
                      return (
                        <>
                          <path d={poly} fill="url(#areaGrad)" stroke="none" />
                          <path d={`M${line}`} fill="none" stroke="#cfe4ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              <div style={{ background: "#071023", padding: 14, borderRadius: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Gender breakdown</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <MiniPie items={genderItems} size={120} />
                  <div style={{ flex: 1 }}>
                    {(genderItems.length ? genderItems : [{ label: "Unknown", value: 1, color: "#6be3ff" }]).map((g, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ width: 12, height: 12, background: g.color, borderRadius: 3 }} />
                          <div style={{ fontSize: 13 }}>{g.label || "N/A"}</div>
                        </div>
                        <div style={{ fontSize: 13 }}>{g.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: "auto", fontSize: 12, color: "#9fb0d6" }}>Source: shf-backend dashboard/enhanced-summary</div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}