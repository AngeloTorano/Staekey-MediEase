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
import { Search, Plus, Edit, Eye, User } from "lucide-react"
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

  const formatDate = (value: any) => {
    if (!value) return "—"
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()
  }

  // Fetch patients from backend
  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true)
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token")
        const res = await api.get("/api/patients", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        let patientsData = []
        if (res.data.encrypted_data) {
          try {
            const decrypted = decryptObject(res.data.encrypted_data)
            console.log("Decrypted patients:", decrypted)
            if (Array.isArray(decrypted)) {
              patientsData = decrypted
            } else if (decrypted && Array.isArray(decrypted.patients)) {
              patientsData = decrypted.patients
            } else if (decrypted && decrypted.data && Array.isArray(decrypted.data)) {
              patientsData = decrypted.data
            } else {
              patientsData = []
            }
          } catch (e) {
            setError("Failed to decrypt patient data")
            patientsData = []
          }
        } else if (res.data.data) {
          patientsData = res.data.data
        }
        setPatients(patientsData || [])
      } catch (err) {
        setError("Failed to load patients")
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [])

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

  // Filter patients (keep gender/search and add date range filter for Date Added)
  const filteredPatients = patients.filter((patient) => {
    if (!patient) return false

    const matchesSearch =
      (patient?.last_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (patient?.gender?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (patient?.first_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (patient?.shf_id?.toLowerCase() || "").includes(searchTerm.toLowerCase())

    const matchesGender = filterGender === "All Genders" || patient?.gender === filterGender

    // Date range filter on patient.date_added / created_at / createdAt
    const dateValue = patient?.date_added || patient?.created_at || patient?.createdAt || null
    let withinDateRange = true
    if (filterStartDate || filterEndDate) {
      const d = dateValue ? new Date(dateValue) : null
      if (!d || isNaN(d.getTime())) {
        withinDateRange = false
      } else {
        if (filterStartDate) {
          const start = new Date(filterStartDate)
          start.setHours(0, 0, 0, 0)
          if (d < start) withinDateRange = false
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate)
          end.setHours(23, 59, 59, 999)
          if (d > end) withinDateRange = false
        }
      }
    }

    return matchesSearch && matchesGender && withinDateRange
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
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>

            <CardTitle>Patient Records ({filteredPatients.length})</CardTitle>
            <CardDescription>Manage patient information and medical records</CardDescription>
          </div>
          <div>
            <Dialog open={showAddPatient} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Patient
                </Button>
              </DialogTrigger>
              <DialogContent size="3xl" className="max-h-[85vh] overflow-y-auto">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle className="text-2xl">Register New Patient</DialogTitle>
                  <DialogDescription className="text-sm">
                    Enter patient demographic information
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddPatient} className="space-y-4 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={newPatient.last_name}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, last_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={newPatient.first_name}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, first_name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select
                        value={newPatient.gender}
                        onValueChange={(value) => setNewPatient((prev) => ({ ...prev, gender: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth">Date of Birth *</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={newPatient.date_of_birth}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={newPatient.age}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, age: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobile_number">Mobile Number</Label>
                      <Input
                        id="mobile_number"
                        value={newPatient.mobile_number}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, mobile_number: e.target.value }))}
                        placeholder="+63912345678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="alternative_number">Alternative Number</Label>
                      <Input
                        id="alternative_number"
                        value={newPatient.alternative_number}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, alternative_number: e.target.value }))}
                        placeholder="+63923456789"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="region_district">Region/District</Label>
                      <select
                        id="region_district"
                        value={newPatient.region_district}
                        onChange={(e) =>
                          setNewPatient((prev) => ({ ...prev, region_district: e.target.value }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="">Select Region</option>
                        <option value="National Capital Region (NCR)">National Capital Region (NCR)</option>
                        <option value="Cordillera Administrative Region (CAR)">Cordillera Administrative Region (CAR)</option>
                        <option value="Ilocos Region (Region I)">Ilocos Region (Region I)</option>
                        <option value="Cagayan Valley (Region II)">Cagayan Valley (Region II)</option>
                        <option value="Central Luzon (Region III)">Central Luzon (Region III)</option>
                        <option value="CALABARZON (Region IV-A)">CALABARZON (Region IV-A)</option>
                        <option value="MIMAROPA (Region IV-B)">MIMAROPA (Region IV-B)</option>
                        <option value="Bicol Region (Region V)">Bicol Region (Region V)</option>
                        <option value="Western Visayas (Region VI)">Western Visayas (Region VI)</option>
                        <option value="Central Visayas (Region VII)">Central Visayas (Region VII)</option>
                        <option value="Eastern Visayas (Region VIII)">Eastern Visayas (Region VIII)</option>
                        <option value="Zamboanga Peninsula (Region IX)">Zamboanga Peninsula (Region IX)</option>
                        <option value="Northern Mindanao (Region X)">Northern Mindanao (Region X)</option>
                        <option value="Davao Region (Region XI)">Davao Region (Region XI)</option>
                        <option value="SOCCSKSARGEN (Region XII)">SOCCSKSARGEN (Region XII)</option>
                        <option value="Caraga (Region XIII)">Caraga (Region XIII)</option>
                        <option value="Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)">
                          Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city_village">City/Village</Label>
                      <Input
                        id="city_village"
                        value={newPatient.city_village}
                        onChange={(e) => setNewPatient((prev) => ({ ...prev, city_village: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Employment Status Section */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-lg font-medium">Employment & Education</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="employment_status">Employment Status</Label>
                        <Select
                          value={newPatient.employment_status}
                          onValueChange={(value) => setNewPatient((prev) => ({ ...prev, employment_status: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select employment status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Employed">Employed</SelectItem>
                            <SelectItem value="Self Employed">Self Employed</SelectItem>
                            <SelectItem value="Not Employed">Not Employed</SelectItem>
                            <SelectItem value="Student">Student</SelectItem>
                            <SelectItem value="Retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="highest_education_level">Highest Education Level</Label>
                        <Select
                          value={newPatient.highest_education_level}
                          onValueChange={(value) => setNewPatient((prev) => ({ ...prev, highest_education_level: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select education level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="Primary">Primary</SelectItem>
                            <SelectItem value="Secondary">Secondary</SelectItem>
                            <SelectItem value="Post Secondary">Post Secondary</SelectItem>
                            <SelectItem value="University">University</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Student Information Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_student"
                          checked={newPatient.is_student}
                          onCheckedChange={(checked) => setNewPatient((prev) => ({ ...prev, is_student: !!checked }))}
                        />
                        <Label htmlFor="is_student" className="text-base font-medium">Current Student</Label>
                      </div>

                      {newPatient.is_student && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="school_name">School Name *</Label>
                            <Input
                              id="school_name"
                              value={newPatient.school_name}
                              onChange={(e) => setNewPatient((prev) => ({ ...prev, school_name: e.target.value }))}
                              required={newPatient.is_student}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="school_phone_number">School Phone Number</Label>
                            <Input
                              id="school_phone_number"
                              value={newPatient.school_phone_number}
                              onChange={(e) => setNewPatient((prev) => ({ ...prev, school_phone_number: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <div className="text-red-500">{error}</div>}

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleAttemptClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Registering..." : "Register Patient"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

        </CardHeader>

        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SHF ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date Added</TableHead>
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
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
    </div>
  )
}