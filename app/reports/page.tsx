"use client"

import { useState, useRef } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { BarChart3, Download, Upload, Users, CalendarDays } from "lucide-react"
import { decryptObject } from "@/utils/decrypt"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(true)

  const [reportDataset, setReportDataset] = useState<"phase1"|"phase2"|"phase3"|"all">("phase1")
  const [selectedPhase, setSelectedPhase] = useState<string>("all")
  const [filterCity, setFilterCity] = useState("")
  const [filterGender, setFilterGender] = useState<"all"|"male"|"female">("all")
  const [filterStatus, setFilterStatus] = useState<"all"|"in progress"|"completed">("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [selectedFileType, setSelectedFileType] = useState<"csv"|"pdf">("csv")

  const [reportRows, setReportRows] = useState<any[]>([])
  const [summaryRows, setSummaryRows] = useState<any[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const normalizePhaseId = (phase: string) => {
    if (!phase || phase === "all") return "all"
    const n = Number(phase)
    if ([1, 2, 3].includes(n)) return n
    const map: Record<string, number> = { "Phase 1": 1, "Phase 2": 2, "Phase 3": 3 }
    return map[phase] ?? "all"
  }

  const safeDecryptResponse = (resData: any) => {
    if (resData?.encrypted_data) {
      const decrypted = decryptObject(resData.encrypted_data)
      if (Array.isArray(decrypted)) return decrypted
      if (decrypted?.data && Array.isArray(decrypted.data)) return decrypted.data
      return []
    }
    if (Array.isArray(resData?.data)) return resData.data
    return resData?.data ?? []
  }

  const toCSV = (rows: any[]) => {
    if (!rows || rows.length === 0) return "data:text/csv;charset=utf-8,"
    const headers = Object.keys(rows[0] ?? {})
    const esc = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [
      headers.map(esc).join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
    ]
    return "data:text/csv;charset=utf-8," + lines.join("\n")
  }

  const downloadCSV = (rows: any[], filename: string) => {
    const uri = toCSV(rows)
    const link = document.createElement("a")
    link.setAttribute("href", encodeURI(uri))
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const buildCommonParams = () => {
    const params: any = {}
    if (filterCity.trim()) params.city = filterCity.trim()
    if (filterGender !== "all") params.gender = filterGender
    if (filterStatus !== "all") params.status = filterStatus
    if (customStartDate) params.dateStart = customStartDate
    if (customEndDate) params.dateEnd = customEndDate
    const pid = normalizePhaseId(selectedPhase)
    if (reportDataset === "all" && pid !== "all") params.phaseId = pid
    return params
  }

  const fetchDatasetReport = async (format: "csv"|"pdf") => {
    setLoading(true)
    setError(null)
    setImportSuccess("")
    try {
      let endpoint = ""
      switch (reportDataset) {
        case "phase1": endpoint = "/api/reports/export/phase1"; break
        case "phase2": endpoint = "/api/reports/export/phase2"; break
        case "phase3": endpoint = "/api/reports/export/phase3"; break
        case "all": endpoint = "/api/reports/export/all"; break
      }
      const params = buildCommonParams()
      const res = await api.get(endpoint, { headers: getAuthHeaders(), params })
      const rows = safeDecryptResponse(res.data)
      setReportRows(rows)
      const filename = `${reportDataset}_report_${new Date().toISOString().slice(0,10)}`
      if (format === "csv") {
        downloadCSV(rows, filename)
      } else {
        const printable = window.open("", "_blank")
        if (printable) {
          printable.document.write("<html><head><title>Report</title></head><body>")
          printable.document.write(`<h2 style="font-family:system-ui;color:#0f172a">${reportDataset.toUpperCase()} Report</h2>`)
          printable.document.write("<table style='border-collapse:collapse;font-size:12px;color:#0f172a' border='1' cellspacing='0' cellpadding='6'>")
          if (rows.length) {
            const headers = Object.keys(rows[0])
            printable.document.write("<thead style='background:#f1f5f9'><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr></thead><tbody>")
            rows.forEach((r: any) => {
              printable.document.write("<tr>" + headers.map(h => `<td>${r[h] ?? ""}</td>`).join("") + "</tr>")
            })
            printable.document.write("</tbody>")
          } else {
            printable.document.write("<tbody><tr><td>No data</td></tr></tbody>")
          }
          printable.document.write("</table></body></html>")
          printable.document.close()
          printable.focus()
          printable.print()
        }
      }
    } catch (e:any) {
      setError(e?.response?.data?.message || "Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setError(null)
    setImportSuccess("")
    try {
      const fd = new FormData()
      fd.append("file", importFile)
      await api.post("/api/import", fd, { headers: { ...getAuthHeaders() } })
      setImportSuccess("Import successful.")
      setImportFile(null)
    } catch (e:any) {
      setError(e?.response?.data?.message || "Failed to import file")
    } finally {
      setImporting(false)
    }
  }

  const activeFilterSummary = [
    reportDataset !== "all" ? `Dataset:${reportDataset}` : "Dataset:All",
    reportDataset === "all" && selectedPhase !== "all" ? `Phase:${selectedPhase}` : null,
    filterCity ? `City:${filterCity}` : null,
    filterGender !== "all" ? `Gender:${filterGender}` : null,
    filterStatus !== "all" ? `Status:${filterStatus}` : null,
    customStartDate ? `From:${customStartDate}` : null,
    customEndDate ? `To:${customEndDate}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">Reports</h1>
          </div>
        </div>
        <div className="text-xs rounded-full px-3 py-1 bg-white shadow-sm border border-gray-200 text-slate-700">
          <BarChart3 className="inline h-3 w-3 mr-1 text-indigo-600" /> {reportRows.length} rows
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-2">
        <Card className="border border-gray-200 bg-white/95 shadow-md transition-all hover:shadow-lg">
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-slate-700">Dataset</Label>
                <Select value={reportDataset} onValueChange={(v:any)=>setReportDataset(v)}>
                  <SelectTrigger className="bg-white border-gray-300 focus:ring-indigo-400">
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="phase1">Phase 1 Full</SelectItem>
                    <SelectItem value="phase2">Phase 2 Full</SelectItem>
                    <SelectItem value="phase3">Phase 3 Full</SelectItem>
                    <SelectItem value="all">All Phases (Union)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">File Type</Label>
                <Select value={selectedFileType} onValueChange={(v:any)=>setSelectedFileType(v)}>
                  <SelectTrigger className="bg-white border-gray-300 focus:ring-indigo-400">
                    <SelectValue placeholder="Select file type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {reportDataset === "all" && (
                <div className="space-y-2">
                  <Label className="text-slate-700">Phase Filter</Label>
                  <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger className="bg-white border-gray-300 focus:ring-indigo-400">
                      <SelectValue placeholder="All phases" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">Phase 1</SelectItem>
                      <SelectItem value="2">Phase 2</SelectItem>
                      <SelectItem value="3">Phase 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="px-2 h-8 w-auto text-[12px] rounded-full bg-gray-50 border border-gray-100 hover:bg-gray-100 text-slate-700"
              onClick={() => setShowAdvanced(s => !s)}
            >
              {showAdvanced ? "Hide Advanced Filters" : "Show Advanced Filters"}
            </Button>

            {showAdvanced && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700">Registration City</Label>
                    <Input
                      className="bg-white border-gray-300 placeholder:text-gray-400 text-slate-800"
                      placeholder="e.g. Manila"
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Gender</Label>
                    <Select value={filterGender} onValueChange={(v:any)=>setFilterGender(v)}>
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Status</Label>
                    <Select value={filterStatus} onValueChange={(v:any)=>setFilterStatus(v)}>
                      <SelectTrigger className="bg-white border-gray-300">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="in progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-700">Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white border-gray-300 text-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white border-gray-300 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => fetchDatasetReport(selectedFileType)}
                disabled={loading}
                className="relative bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm border-0"
              >
                {loading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  </span>
                )}
                <Download className={`h-4 w-4 mr-2 ${loading ? "opacity-0" : "opacity-100"}`} />
                {loading ? "Generating..." : "Generate"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white/95 shadow-md transition-all hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Upload className="h-5 w-5 text-emerald-600" /> Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-slate-700">File</Label>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                const f = e.dataTransfer?.files?.[0]
                if (f) setImportFile(f)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-xl border-2 border-dashed p-8 bg-white flex flex-col items-center justify-center gap-4 transition-colors ${
                dragActive ? "border-emerald-300 bg-emerald-50" : "border-gray-200"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <Upload className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="text-lg font-medium text-slate-800">
                {importFile ? importFile.name : "Drag and drop files here"}
              </div>
              <div className="text-xs text-slate-500">or</div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                className="mt-2 inline-flex items-center px-5 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 focus:outline-none shadow-sm"
              >
                Browse files
              </button>
              <div className="text-xs text-slate-400 mt-2">Accepted: CSV, XLSX</div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleImport}
                disabled={!importFile || importing}
                className="bg-emerald-600 text-white hover:bg-emerald-500 border-0 shadow-sm"
              >
                {importing ? (
                  <span className="flex items-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white mr-2" />
                    Importing...
                  </span>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Import
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="fixed inset-0 pointer-events-none flex items-end justify-end p-6">
            <div className="rounded-lg bg-white px-4 py-2 text-xs text-slate-700 border border-gray-200 shadow">
              Generating report...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
