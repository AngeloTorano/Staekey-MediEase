"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { BarChart3, Users, Calendar } from "lucide-react"
import PatientMapPage from "@/app/map/page"

// Axios instance for API calls
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [summary, setSummary] = useState<any>(null)
  const [demographics, setDemographics] = useState<any>(null)
  const [medical, setMedical] = useState<any>(null)
  const [performance, setPerformance] = useState<any>(null)

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("token") || localStorage.getItem("token")
        : null
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    const fetchReports = async () => {
      try {
        setLoading(true)
        const [summaryRes, demoRes, medRes, perfRes] = await Promise.all([
          api.get("/api/reports/summary", { headers }),
          api.get("/api/reports/demographics", { headers }),
          api.get("/api/reports/medical", { headers }),
          api.get("/api/reports/performance", { headers }),
        ])

        setSummary(summaryRes.data)
        setDemographics(demoRes.data)
        setMedical(medRes.data)
        setPerformance(perfRes.data)
      } catch (err) {
        console.error("Error fetching reports:", err)
        setError("Failed to load reports.")
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  // Extract data safely
  const totalPatients = summary?.total_patients ?? 0
  const totalFittings = summary?.total_fittings ?? 0
  const totalMissions = summary?.total_missions ?? 0

  const patientDemographics =
    demographics?.age_groups?.map((r: any) => ({ ageGroup: r.age_group, count: Number(r.count) })) || []

  type GenderEntry = { name: string; value: number; color: string }

  const genderDistribution: GenderEntry[] =
    demographics?.genders?.map((g: any) => ({
      name: g.gender,
      value: Number(g.count),
      color: g.gender === "Male" ? "#8b5cf6" : "#ec4899",
    })) || []

  const hearingLossCauses =
    medical?.hearing_loss_causes?.map((r: any) => ({ cause: r.cause, count: Number(r.count) })) || []

  const treatmentOutcomes: { phase_name: string; completed: number }[] =
    medical?.treatment_outcomes?.map((r: any) => ({
      phase_name: r.phase_name,
      completed: Number(r.completed || 0),
    })) || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          </div>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Patients Served</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hearing Aids Fitted</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFittings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missions Completed</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMissions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Tabs */}
      <Tabs defaultValue="maps" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="maps">Patient Map</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="disease_frequency">Disease Frequency</TabsTrigger>
          <TabsTrigger value="satisfaction">Performance</TabsTrigger>
        </TabsList>


        <TabsContent value="maps">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Make map take up 2/3 of the width */}
            <div className="md:col-span-3">
              <PatientMapPage />
            </div>
          </div>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Age Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={patientDemographics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ageGroup" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gender Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={genderDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={150}
                      dataKey="value"
                      label
                    >
                      {genderDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Medical Tab */}
        <TabsContent value="disease_frequency">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Hearing Loss Causes</CardTitle>
              </CardHeader>
              <CardContent>
                {hearingLossCauses.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No hearing loss cause data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hearingLossCauses} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="cause" type="category" width={150} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Otoscopy Findings</CardTitle>
              </CardHeader>
              <CardContent>
                {treatmentOutcomes.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No treatment outcomes data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={treatmentOutcomes.map((r) => ({ name: r.phase_name, value: Number(r.completed || 0) }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        {treatmentOutcomes.map((_, index: number) => (
                          <Cell key={index} fill={["#4ade80", "#f59e0b", "#8b5cf6", "#6b7280"][index % 4]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="satisfaction">
          <Card>
            <CardHeader>
              <CardTitle>Mission Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {performance?.length ? (
                performance.map((row: any) => (
                  <div key={row.phase_name} className="flex justify-between items-center p-3 border rounded mb-2">
                    <div>
                      <div className="font-medium">{row.phase_name}</div>
                      <div className="text-sm text-muted-foreground">{row.patients_served} patients</div>
                    </div>
                    <Badge variant="secondary">{row.success_rate}% success</Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No performance data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
