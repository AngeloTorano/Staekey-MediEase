"use client"

import React, { useState, useRef, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { decryptObject } from "@/utils/decrypt"
import { Search, Plus, Edit, Eye, ArchiveIcon } from "lucide-react"
import { Users } from "lucide-react"
import { useRouter } from "next/navigation"

// API instance (adjust baseURL as needed)
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

const INITIAL_PATIENT_STATE = {
  last_name: "",
  first_name: "",
  gender: "",
  date_of_birth: "",
  age: "",
  mobile_number: "",
  mobile_sms: false,
  alternative_number: "",
  alternative_sms: false,
  region_district: "",
  city_village: "",
  employment_status: "",
  highest_education_level: "",
  school_name: "",
  school_phone_number: "",
  is_student: false,
}

// Pagination hook (mirrors admin)
function usePagination(defaultLimit = 25) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(defaultLimit)
  const [total, setTotal] = useState(0)
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / limit))

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, newPage)
    setPage(clamped)
    return clamped
  }
  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
    return { newLimit, newPage: 1 }
  }
  return { page, limit, total, totalPages, setTotal, handlePageChange, handleLimitChange }
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterGender, setFilterGender] = useState("All Genders")
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")
  // removed employment/student filters; replaced table columns with Date Added
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [newPatient, setNewPatient] = useState(INITIAL_PATIENT_STATE)
  const initialRef = useRef(INITIAL_PATIENT_STATE)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    page,
    limit,
    total,
    setTotal,
    handlePageChange,
    handleLimitChange
  } = usePagination(25)

  const formatDate = (value: any) => {
    if (!value) return "—"
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()
  }

  // Fetch patients from backend (now paginated + server search)
  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true)
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token")
        const params: any = { page, limit }
        if (searchTerm.trim()) params.search = searchTerm.trim()
        const res = await api.get("/api/patients", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          params
        })

        let patientsData: any[] = []
        if (res.data.encrypted_data) {
          try {
            const decrypted = decryptObject(res.data.encrypted_data)
            if (Array.isArray(decrypted)) patientsData = decrypted
            else if (Array.isArray(decrypted?.patients)) patientsData = decrypted.patients
            else if (Array.isArray(decrypted?.data)) patientsData = decrypted.data
          } catch {
            setError("Failed to decrypt patient data")
          }
        } else if (Array.isArray(res.data?.data)) {
          patientsData = res.data.data
        } else if (Array.isArray(res.data)) {
          patientsData = res.data
        }

        setPatients(patientsData || [])

        // Try to read total; fallback approximate (current loaded span)
        const rawTotal =
          res.data?.total ||
          res.data?.count ||
          res.data?.meta?.total ||
          res.data?.meta?.count

        if (typeof rawTotal === "number") {
          setTotal(rawTotal)
        } else {
          // Approximation (will grow as user pages). Replace with backend total later.
            setTotal((page - 1) * limit + patientsData.length)
        }
      } catch {
        setError("Failed to load patients")
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [page, limit, searchTerm])

  // Dirty form detection
  const isFormDirty = () => {
    const current = newPatient
    const initial = initialRef.current
    for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
      const a = (initial as any)[key]
      const b = (current as any)[key]
      if (typeof a === "string") {
        if ((a || "").trim() !== (b || "").trim()) return true
      } else if (typeof a === "boolean") {
        if (a !== b) return true
      } else {
        if (a !== b) return true
      }
    }
    return false
  }

  // Dialog open/close with dirty check
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (isFormDirty()) {
        setConfirmCloseOpen(true)
        return
      }
      setShowAddPatient(false)
      setNewPatient({ ...initialRef.current })
    } else {
      setShowAddPatient(true)
    }
  }

  const handleConfirmClose = () => {
    setConfirmCloseOpen(false)
    setShowAddPatient(false)
    setNewPatient({ ...initialRef.current })
  }

  const handleAttemptClose = () => {
    if (isFormDirty()) {
      setConfirmCloseOpen(true)
    } else {
      setShowAddPatient(false)
      setNewPatient({ ...initialRef.current })
    }
  }

  // Adjust client-side filters (gender/date only on current page)
  const filteredPatients = patients.filter((patient) => {
    if (!patient) return false
    const matchesGender = filterGender === "All Genders" || patient?.gender === filterGender
    const dateValue = patient?.date_added || patient?.created_at || patient?.createdAt || null
    let withinDateRange = true
    if (filterStartDate || filterEndDate) {
      const d = dateValue ? new Date(dateValue) : null
      if (!d || isNaN(d.getTime())) withinDateRange = false
      else {
        if (filterStartDate) {
          const start = new Date(filterStartDate); start.setHours(0,0,0,0)
          if (d < start) withinDateRange = false
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate); end.setHours(23,59,59,999)
          if (d > end) withinDateRange = false
        }
      }
    }
    return matchesGender && withinDateRange
  })

  // Add patient handler
  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitConfirmOpen(true)
  }

  // Submit to backend
  const handleConfirmSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      // Prepare payload according to backend/SQL
      const payload: any = {
        last_name: newPatient.last_name.trim(),
        first_name: newPatient.first_name.trim(),
        gender: newPatient.gender,
        date_of_birth: newPatient.date_of_birth,
        age: newPatient.age ? Number(newPatient.age) : null,
        mobile_number: newPatient.mobile_number,
        alternative_number: newPatient.alternative_number,
        region_district: newPatient.region_district,
        city_village: newPatient.city_village,
        employment_status: newPatient.employment_status,
        highest_education_level: newPatient.highest_education_level,
      }
      // Only send school fields if student
      if (newPatient.is_student) {
        payload.school_name = newPatient.school_name
        payload.school_phone_number = newPatient.school_phone_number
      }
      // Remove empty fields
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] === null) && delete payload[k])

      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.post("/api/patients", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      // Add new patient to list
      setPatients((prev) => [res.data.data, ...prev])
      setSubmitConfirmOpen(false)
      setShowAddPatient(false)
      setNewPatient({ ...initialRef.current })
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setError(
          err.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ")
        )
      } else if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError("Failed to add patient")
      }
    } finally {
      setLoading(false)
    }
  }

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<any | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const openEditDialog = (patient: any) => {
    setEditingPatient({
      patient_id: patient.patient_id,
      first_name: patient.first_name || "",
      last_name: patient.last_name || "",
      gender: patient.gender || "",
      date_of_birth: patient.date_of_birth ? String(patient.date_of_birth).split("T")[0] : "",
      age: patient.age || "",
      mobile_number: patient.mobile_number || "",
      region_district: patient.region_district || "",
      city_village: patient.city_village || "",
      status: patient.status || "",
      date_of_death: patient.date_of_death ? String(patient.date_of_death).split("T")[0] : "",
      last_active_date: patient.last_active_date ? String(patient.last_active_date).split("T")[0] : "",
    })
    setEditError(null)
    setEditDialogOpen(true)
  }

  const handleEditChange = (field: string, value: any) => {
    setEditingPatient((p: any) => ({ ...p, [field]: value }))
  }

  const submitPatientEdit = async () => {
    if (!editingPatient) return
    setEditLoading(true)
    setEditError(null)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const payload: any = {
        first_name: editingPatient.first_name,
        last_name: editingPatient.last_name,
        gender: editingPatient.gender,
        date_of_birth: editingPatient.date_of_birth || null,
        age: editingPatient.age ? Number(editingPatient.age) : null,
        mobile_number: editingPatient.mobile_number || null,
        region_district: editingPatient.region_district || null,
        city_village: editingPatient.city_village || null,
        status: editingPatient.status || null,
        date_of_death: editingPatient.date_of_death || null,
        last_active_date: editingPatient.last_active_date || null,
      }
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] === null) && delete payload[k])
      const res = await api.put(`/api/patients/${editingPatient.patient_id}`, payload, { headers })
      // update local list
      setPatients((prev) => prev.map((p) => (p.patient_id === editingPatient.patient_id ? res.data.data : p)))
      setEditDialogOpen(false)
    } catch (err: any) {
      setEditError(err?.response?.data?.error || err?.message || "Failed to update patient")
    } finally {
      setEditLoading(false)
    }
  }

  const [archivingId, setArchivingId] = useState<number | null>(null)

  // NEW: archive dialogs state
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null)
  const [archiveResultOpen, setArchiveResultOpen] = useState(false)
  const [archiveResultMsg, setArchiveResultMsg] = useState("")

  // REPLACED: no window.confirm/alert — use dialogs instead
  const archivePatient = async (patientId: number) => {
    setArchivingId(patientId)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.post(`/api/archival/${patientId}/archive`, null, { headers })
      setPatients((prev) => prev.filter((p) => p.patient_id !== patientId))
      const archiveId = res.data?.data?.archive_id || res.data?.archive_id || "OK"
      setArchiveResultMsg(`Patient archived successfully (archive_id=${archiveId}).`)
    } catch (err: any) {
      setArchiveResultMsg(err?.response?.data?.error || err?.message || "Archive failed")
    } finally {
      setArchivingId(null)
      setArchiveConfirmOpen(false)
      setArchiveTarget(null)
      setArchiveResultOpen(true)
    }
  }

  const pageStartItem = total === 0 ? 0 : (page - 1) * limit + 1
  const pageEndItem = Math.min((page - 1) * limit + filteredPatients.length, total)
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / limit))

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Patient Management</h1>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Patients</CardTitle>
          <CardDescription>Find patients by name, SHF ID, or other criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SHF ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex space-x-2 w-full md:w-auto">
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Genders">All Genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-36"
                  aria-label="Start date"
                />
                <span className="text-sm text-muted-foreground">—</span>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-36"
                  aria-label="End date"
                />
              </div>
            </div>
            {/* employment & student filters removed — using Date Added column in table instead */}
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <CardTitle>Patient Records ({total})</CardTitle>
              <CardDescription>Manage patient information and medical records</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {total === 0 ? "No results" : `Showing ${pageStartItem}–${pageEndItem} of ${total}`}
              </div>
              <div className="flex items-center space-x-2">
                <label htmlFor="patientsPageSize" className="text-sm text-muted-foreground">Rows</label>
                <select
                  id="patientsPageSize"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none"
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                >
                  {[10,25,50,100].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page === 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Prev
                </Button>
                <span className="px-2 text-sm">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page === totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
              <div>
                <Button onClick={() => router.push("/forms/phase1")}>
                  <Plus className="h-4 w-4 mr-2" /> Add New Patient
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? <div>Loading...</div> : (
            <>
              <Table>
                {/* ...existing code (table headers & rows) ... */}
                <TableHeader>
                  <TableRow>
                    <TableHead>SHF ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead>Archive</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => {
                    if (!patient) return null

                    const isStudent = !!patient.school_name
 
                    return (
                      <TableRow key={patient.patient_id}>
                        {/* SHF ID */}
                        <TableCell>
                          {patient.shf_id ? (
                            <Badge variant="secondary">{patient.shf_id}</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        {/* Name */}
                        <TableCell className="font-medium">
                          {patient.last_name}, {patient.first_name}
                        </TableCell>
                        {/* Gender */}
                        <TableCell>{patient.gender}</TableCell>
                        {/* Age */}
                        <TableCell>{patient.age}</TableCell>
                        {/* Location */}
                        <TableCell>
                          <div className="text-sm">
                            <div>{patient.city_village}</div>
                            <div className="text-muted-foreground">{patient.region_district}</div>
                          </div>
                        </TableCell>
                        {/* Contact */}
                        <TableCell>
                          <div>{patient.mobile_number}</div>
                          {patient.alternative_number && (
                            <div className="text-muted-foreground">{patient.alternative_number}</div>
                          )}
                        </TableCell>
                        {/* Date Added */}
                        <TableCell>{formatDate(patient.date_added || patient.created_at || patient.createdAt)}</TableCell>
                        {/* Archive */}
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Archive patient ${patient.patient_id}`}
                              onClick={() => { setArchiveTarget(patient); setArchiveConfirmOpen(true) }}
                              disabled={archivingId === patient.patient_id}
                            >
                              <ArchiveIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        {/* Actions */}
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/patients/${patient.patient_id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(patient)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Close Confirmation Dialog */}
      <Dialog open={confirmCloseOpen} onOpenChange={(v) => setConfirmCloseOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">You have unsaved changes. Are you sure you want to close and discard them?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmCloseOpen(false)}>Keep editing</Button>
              <Button onClick={handleConfirmClose}>Discard & Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Dialog */}
      <Dialog open={submitConfirmOpen} onOpenChange={(v) => setSubmitConfirmOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm patient registration</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-2">Please recheck patient data</h3>
            <p className="mb-4">Before submitting, please confirm you have reviewed all patient data. Proceed?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleConfirmSubmit} disabled={loading}>
                {loading ? "Registering..." : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editError && <div className="text-red-600">{editError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <Input value={editingPatient?.first_name || ""} onChange={(e) => handleEditChange("first_name", e.target.value)} />
              <Input value={editingPatient?.last_name || ""} onChange={(e) => handleEditChange("last_name", e.target.value)} />
              <Input value={editingPatient?.mobile_number || ""} onChange={(e) => handleEditChange("mobile_number", e.target.value)} />
              <Input type="date" value={editingPatient?.date_of_birth || ""} onChange={(e) => handleEditChange("date_of_birth", e.target.value)} />
              <Input value={editingPatient?.region_district || ""} onChange={(e) => handleEditChange("region_district", e.target.value)} />
              <Input value={editingPatient?.city_village || ""} onChange={(e) => handleEditChange("city_village", e.target.value)} />
              <Select value={editingPatient?.gender || ""} onValueChange={(v) => handleEditChange("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
              <Input type="date" value={editingPatient?.date_of_death || ""} onChange={(e) => handleEditChange("date_of_death", e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitPatientEdit} disabled={editLoading}>{editLoading ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveConfirmOpen} onOpenChange={(v) => { if (!archivingId) setArchiveConfirmOpen(v) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive this patient?</DialogTitle>
            <DialogDescription>This will move the patient to the archive. You can restore them later.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {archiveTarget && (
              <div className="mb-4 text-sm">
                <div><span className="font-medium">Name: </span>{archiveTarget.last_name}, {archiveTarget.first_name}</div>
                <div><span className="font-medium">SHF ID: </span>{archiveTarget.shf_id || "Pending"}</div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setArchiveConfirmOpen(false)} disabled={!!archivingId}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => archiveTarget && archivePatient(archiveTarget.patient_id)}
                disabled={!!archivingId || !archiveTarget}
              >
                {archivingId === archiveTarget?.patient_id ? "Archiving..." : "Archive"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Result Dialog */}
      <Dialog open={archiveResultOpen} onOpenChange={setArchiveResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive status</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="mb-4">{archiveResultMsg}</p>
            <div className="flex justify-end">
              <Button onClick={() => setArchiveResultOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}