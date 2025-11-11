"use client"

import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { decryptObject } from "@/utils/decrypt"
import { ArchiveIcon, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ArchivalPage() {
  const [archivedList, setArchivedList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
    withCredentials: true,
  })

  const loadArchived = async () => {
    try {
      setLoading(true)
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.get("/api/archival", { headers })

      let rows: any[] = []
      if (res.data?.encrypted_data) {
        try {
          const decrypted = decryptObject(res.data.encrypted_data)
          if (Array.isArray(decrypted)) rows = decrypted
          else if (Array.isArray(decrypted.archives)) rows = decrypted.archives
          else if (Array.isArray(decrypted.data)) rows = decrypted.data
          else if (Array.isArray(decrypted.items)) rows = decrypted.items
          else rows = Array.isArray(decrypted?.rows) ? decrypted.rows : []
        } catch (e) {
          console.error("Failed to decrypt archival response", e)
          rows = []
        }
      } else if (res.data?.data) rows = res.data.data
      else if (Array.isArray(res.data)) rows = res.data
      else rows = []

      setArchivedList(rows)
    } catch (err) {
      console.error("loadArchived error", err)
      setArchivedList([])
    } finally {
      setLoading(false)
    }
  }

  const unarchivePatient = async (patientId: number) => {
    if (!confirm("Unarchive this patient? They will reappear in the active patients list.")) return
    setMsg(null)
    setLoading(true)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await api.post(`/api/archival/${patientId}/unarchive`, null, { headers })
      setMsg({ type: "success", text: "Patient unarchived" })
      await loadArchived()
    } catch (err: any) {
      setMsg({ type: "error", text: err?.response?.data?.error || err?.message || "Unarchive failed" })
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null
    const to = toDate ? new Date(toDate + "T23:59:59").getTime() : null
    return archivedList.filter((a) => {
      const pid = String(a.patient_id || "").toLowerCase()
      const shf = String(a.shf_id || a.summary?.shf_id || "").toLowerCase()
      const name = String(a.name || a.summary?.name || "").toLowerCase()
      const matchesQ = !q || pid.includes(q) || shf.includes(q) || name.includes(q)
      let matchesDate = true
      const ts = a.archived_at ? new Date(a.archived_at).getTime() : null
      if (ts && from !== null && ts < from) matchesDate = false
      if (ts && to !== null && ts > to) matchesDate = false
      return matchesQ && matchesDate
    })
  }, [archivedList, search, fromDate, toDate])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, fromDate, toDate])

  // Adjust current page if filtered size shrinks
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [filtered.length, page, pageSize])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const startItem = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, filtered.length)

  useEffect(() => {
    loadArchived()
    setMounted(true)
  }, [])

  const fmt = (v: any) => (v ? String(v) : "—")

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ArchiveIcon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Archival</h1>
          </div>
        </div>
        <div>
          <Button variant="secondary" className="inline-flex items-center gap-2" onClick={loadArchived} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 mb-4 rounded ${
            msg.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Archived Patients</CardTitle>
          <CardDescription>Find archived patients by SHF ID, name, or date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search by Patient ID, SHF, or Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-36"
                aria-label="From date"
              />
              <span className="text-sm text-muted-foreground">—</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-36"
                aria-label="To date"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setFromDate("")
                setToDate("")
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table with pagination controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <CardTitle>Archived Records ({filtered.length})</CardTitle>
              <CardDescription>Unarchive to restore to the active list</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {filtered.length === 0
                  ? "No results"
                  : `Showing ${startItem}–${endItem} of ${filtered.length}`}
              </div>
              <div className="flex items-center space-x-2">
                <label htmlFor="pageSize" className="text-sm text-muted-foreground">
                  Rows
                </label>
                <select
                  id="pageSize"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  {[10, 25, 50, 100].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="px-2 text-sm">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages || filtered.length === 0}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SHF ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Archived At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archivedList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-4 text-center text-sm text-muted-foreground">
                    {loading ? "Loading archived patients..." : "No archived patients found."}
                  </TableCell>
                </TableRow>
              )}
              {archivedList.length > 0 && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-4 text-center text-sm text-muted-foreground">
                    No results for current filters.
                  </TableCell>
                </TableRow>
              )}
              {paginated.map((a) => {
                const shf = a.shf_id || a.summary?.shf_id
                const name = a.name || a.summary?.name || "—"
                const archivedAt = mounted ? new Date(a.archived_at).toLocaleString() : a.archived_at

                return (
                  <TableRow key={`${a.patient_id}-${a.archive_id}`}>
                    <TableCell>
                      {shf ? <Badge variant="secondary">{shf}</Badge> : <Badge variant="outline">Pending</Badge>}
                    </TableCell>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>{archivedAt || "—"}</TableCell>
                    <TableCell>
                      <Button onClick={() => unarchivePatient(a.patient_id)} disabled={loading}>
                        Unarchive
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}