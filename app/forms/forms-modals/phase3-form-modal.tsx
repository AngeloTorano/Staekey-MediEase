"use client"

import type React from "react"
import axios from "axios"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, AlertCircle, ClipboardCheck, Ear, Battery, User, Search } from "lucide-react"
import { decryptObject } from "@/utils/decrypt"

interface Phase3FormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PatientSearchResponse {
  patient_id: number
}

export function Phase3FormModal({ open, onOpenChange }: Phase3FormModalProps) {
  const [formData, setFormData] = useState({
    patient_id: 0,
    // Registration
    shf_id: "",
    country: "Philippines",
    phase3_aftercare_city: "",
    phase3_date: "",
    surname: "",
    first_name: "",
    gender: "",
    dob: "",
    age: "",
    mobile_phone_number: "",
    type_of_aftercare: "",
    service_center_or_school_name: "",
    highest_level_education: "",
    return_visit_custom_earmold_repair: false,
    employment_status: "",
    problem_with_hearing_aid_earmold: "",
    // Ear Screening/Otoscopy - Left Ear
    left_wax: false,
    left_infection: false,
    left_perforation: false,
    left_other: false,
    // Ear Screening/Otoscopy - Right Ear
    right_wax: false,
    right_infection: false,
    right_perforation: false,
    right_other: false,
    medical_recommendation: "",
    medication_given: [""],
    ears_clear_for_assessment: "",
    right_ear_clear_for_assessment: "",
    left_ear_clear_for_assessment: "",
    otoscopy_comments: "",
    // AfterCare Assessment - Evaluation - Left Ear
    left_ha_dead_or_broken: false,
    left_ha_internal_feedback: false,
    left_ha_power_change_needed: false,
    left_ha_lost_or_stolen: false,
    left_ha_no_problem: false,
    left_em_discomfort_too_tight: false,
    left_em_feedback_too_loose: false,
    left_em_damaged_or_tubing_cracked: false,
    left_em_lost_or_stolen: false,
    left_em_no_problem: false,
    // AfterCare Assessment - Evaluation - Right Ear
    right_ha_dead_or_broken: false,
    right_ha_internal_feedback: false,
    right_ha_power_change_needed: false,
    right_ha_lost_or_stolen: false,
    right_ha_no_problem: false,
    right_em_discomfort_too_tight: false,
    right_em_feedback_too_loose: false,
    right_em_damaged_or_tubing_cracked: false,
    right_em_lost_or_stolen: false,
    right_em_no_problem: false,
    // AfterCare Assessment - Services Completed - Left Ear
    left_ha_tested_wfa_demo: false,
    left_ha_sent_for_repair_replacement: false,
    left_ha_refit_new: false,
    left_ha_not_benefiting: false,
    left_em_retubed_unplugged: false,
    left_em_modified: false,
    left_em_fit_stock: false,
    left_em_took_new_impression: false,
    left_em_refit_custom: false,
    // AfterCare Assessment - Services Completed - Right Ear
    right_ha_tested_wfa_demo: false,
    right_ha_sent_for_repair_replacement: false,
    right_ha_refit_new: false,
    right_ha_not_benefiting: false,
    right_em_retubed_unplugged: false,
    right_em_modified: false,
    right_em_fit_stock: false,
    right_em_took_new_impression: false,
    right_em_refit_custom: false,
    // General Services
    counseling_provided: false,
    batteries_provided_13: null,
    batteries_provided_675: null,
    refer_to_aftercare_center: false,
    refer_to_next_phase2_mission: false,
    aftercare_comments: "",
    // Final Quality Control
    satisfaction_with_hearing: "",
    asks_to_repeat_or_speak_louder: "",
    shf_notes: "",
    // Current Fitting Info - Left Ear
    left_power_level: "",
    left_level: "",
    left_volume: "",
    left_model: "",
    left_battery_type: "",
    left_earmold_type: "",
    // Current Fitting Info - Right Ear
    right_power_level: "",
    right_level: "",
    right_volume: "",
    right_model: "",
    right_battery_type: "",
    right_earmold_type: "",

    show_batteries_provided: false,
  })
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
    withCredentials: true,
  })

  const debugLog = (section: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`[v0] [${timestamp}] [${section}] ${message}`, data || "")
  }

  // snapshot of initial values for dirty check
  const initialRef = useRef({ ...formData })
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null)
  const [patientFound, setPatientFound] = useState<boolean>(false)
  const [fittingLoading, setFittingLoading] = useState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({})
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [fittingTableId, setFittingTableId] = useState<number | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [needPatientDialogOpen, setNeedPatientDialogOpen] = useState(false)

  // Ensure a patient is selected before running an action; otherwise show dialog
  const ensurePatientAndRun = async (action?: () => Promise<void> | void) => {
    const pid = getPatientId()
    if (!pid || pid === 0) {
      setNeedPatientDialogOpen(true)
      return
    }
    try {
      await action?.()
    } catch (err) {
      // action handlers already surface errors, keep silent here
    }
  }

  useEffect(() => {
    if (open) {
      initialRef.current = { ...formData }
    }
  }, [open])

  const isFormDirty = () => {
    const current = formData
    const initial = initialRef.current

    for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
      const a = (initial as any)[key]
      const b = (current as any)[key]

      if (Array.isArray(a) && Array.isArray(b)) {
        const aFiltered = a.filter(Boolean)
        const bFiltered = b.filter(Boolean)
        if (aFiltered.length !== bFiltered.length) return true
        if (aFiltered.some((v, i) => v !== bFiltered[i])) return true
      } else if (typeof a === "string") {
        if ((a || "").trim() !== (b || "").trim()) return true
      } else if (typeof a === "boolean") {
        if (a !== b) return true
      } else if (typeof a === "number") {
        if (a !== b) return true
      } else {
        if (a !== b) return true
      }
    }
    return false
  }

  const parseError = (err: any) => {
    debugLog("ERROR_PARSER", "Parsing error", err)
    const remote = err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? err
    if (!remote && remote !== 0) return "An unknown error occurred"
    if (typeof remote === "string") return remote
    if (typeof remote === "object") {
      if ("message" in remote && typeof remote.message === "string") return remote.message
      try {
        return JSON.stringify(remote)
      } catch {
        return String(remote)
      }
    }
    return String(remote)
  }

  const searchPatient = async () => {
    debugLog("PATIENT_SEARCH", "Starting patient search", { shf_id: formData.shf_id })

    if (!formData.shf_id.trim()) {
      setSearchError("Please enter an SHF ID")
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    setSearchedPatientId(null)
    setPatientFound(false)

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await api.get(
        `/api/patients/shf?shf=${encodeURIComponent(formData.shf_id.trim())}`,
        { headers },
      )

      // response from backend includes patient_id and demographic fields (see PatientController)
      if (response.data && typeof response.data.patient_id === "number") {
        const pdata = response.data

        // populate form fields with returned patient data (best-effort)
        setFormData((prev) => ({
          ...prev,
          patient_id: pdata.patient_id,
          surname: pdata.last_name ?? prev.surname,
          first_name: pdata.first_name ?? prev.first_name,
          dob: pdata.date_of_birth ? String(pdata.date_of_birth).split("T")[0] : prev.dob,
          age: pdata.age ?? prev.age,
          gender: pdata.gender ?? prev.gender,
          mobile_phone_number: pdata.mobile_number ?? prev.mobile_phone_number,
          employment_status: pdata.employment_status ?? prev.employment_status,
          highest_level_education: pdata.highest_education_level ?? prev.highest_level_education,
        }))

        // fetch latest fitting table for this patient and populate Current Fitting Information
        fetchLatestFittingTable(pdata.patient_id)

        setSearchedPatientId(response.data.patient_id)
        setPatientFound(true)
        setSearchError(null)
        debugLog("PATIENT_SEARCH", "Patient found successfully", { patient_id: response.data.patient_id })
      } else {
        setSearchError("Patient not found with this SHF ID")
      }
    } catch (error: any) {
      const message = parseError(error)
      if (error.response?.status === 404) {
        setSearchError(`Patient not found: ${message}`)
      } else if (error.response?.status === 400) {
        setSearchError(`Invalid SHF ID: ${message}`)
      } else {
        setSearchError(message || "Failed to search for patient")
      }
    } finally {
      setSearchLoading(false)
    }
  }

  // fetch latest fitting table for a patient and populate the current fitting table fields
  const fetchLatestFittingTable = async (patientId: number) => {
    if (!patientId) return
    setFittingLoading(true)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await api.get(
        `/api/phase2/fitting-table?patient_id=${encodeURIComponent(String(patientId))}`,
        { headers },
      )

      // handle encrypted backend response similar to patients page
      let rows: any[] = []
      if (res.data) {
        if (res.data.encrypted_data) {
          try {
            const decrypted = decryptObject(res.data.encrypted_data)
            if (Array.isArray(decrypted)) rows = decrypted
            else if (Array.isArray(decrypted?.data)) rows = decrypted.data
            else if (Array.isArray(decrypted?.rows)) rows = decrypted.rows
            else if (decrypted) rows = Array.isArray(decrypted) ? decrypted : [decrypted]
          } catch (err) {
            console.error("Failed to decrypt fitting-table response", err)
            rows = []
          }
        } else if (Array.isArray(res.data)) {
          rows = res.data
        } else if (Array.isArray(res.data.data)) {
          rows = res.data.data
        } else if (Array.isArray(res.data.rows)) {
          rows = res.data.rows
        } else if (res.data.data) {
          rows = Array.isArray(res.data.data) ? res.data.data : [res.data.data]
        }
      }

      if (!rows || rows.length === 0) {
        setFittingLoading(false)
        return
      }

      const latest = rows[0]

      // store fittingTableId for future update operations
      if (latest.fitting_table_id) setFittingTableId(Number(latest.fitting_table_id))

      setFormData((prev) => ({
        ...prev,
        left_power_level: latest.fitting_left_power_level ?? prev.left_power_level,
        left_volume: latest.fitting_left_volume ?? prev.left_volume,
        left_model: latest.fitting_left_model ?? prev.left_model,
        left_battery_type: latest.fitting_left_battery ?? prev.left_battery_type,
        left_earmold_type: latest.fitting_left_earmold ?? prev.left_earmold_type,
        right_power_level: latest.fitting_right_power_level ?? prev.right_power_level,
        right_volume: latest.fitting_right_volume ?? prev.right_volume,
        right_model: latest.fitting_right_model ?? prev.right_model,
        right_battery_type: latest.fitting_right_battery ?? prev.right_battery_type,
        right_earmold_type: latest.fitting_right_earmold ?? prev.right_earmold_type,
      }))
      debugLog("FITTING_FETCH", "Latest fitting table loaded", latest)
    } catch (err: any) {
      debugLog("FITTING_FETCH_ERROR", "Failed to fetch fitting table", err)
    } finally {
      setFittingLoading(false)
    }
  }

  // helper to get patient id from formData
  const getPatientId = () => Number(formData.patient_id || formData.patient_id === 0 ? formData.patient_id : searchedPatientId)

  // ---------- Submits for backend (Registration -> Final QC) ----------
  const submitRegistrationSection = async () => {
    const patientId = getPatientId()
    if (!patientId) return setSectionErrors((s) => ({ ...s, registration: "Search patient first" }))

    setSavingSection("registration")
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        registration_date: formData.phase3_date || undefined,
        country: formData.country || undefined,
        city: formData.phase3_aftercare_city || undefined,
        type_of_aftercare: formData.type_of_aftercare || undefined,
        service_center_school_name: formData.service_center_or_school_name || undefined,
        return_visit_custom_earmold_repair: formData.return_visit_custom_earmold_repair || undefined,
        hearing_aid_problem_earmold: formData.problem_with_hearing_aid_earmold,
      }

      await api.post("/api/phase3/registration", payload, { headers })
      setSectionSuccess((s) => ({ ...s, registration: true }))
      setSectionErrors((s) => ({ ...s, registration: "" }))
    } catch (err: any) {
      setSectionErrors((s) => ({ ...s, registration: parseError(err) }))
    } finally {
      setSavingSection(null)
    }
  }

  const submitEarScreeningSection = async () => {
    const patientId = getPatientId()
    if (!patientId) return setSectionErrors((s) => ({ ...s, earScreening: "Search patient first" }))

    setSavingSection("earScreening")
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        screening_name: "Aftercare",
        left_wax: formData.left_wax || undefined,
        right_wax: formData.right_wax || undefined,
        left_infection: formData.left_infection || undefined,
        right_infection: formData.right_infection || undefined,
        left_perforation: formData.left_perforation || undefined,
        right_perforation: formData.right_perforation || undefined,
        left_other: formData.left_other || undefined,
        right_other: formData.right_other || undefined,
        medical_recommendation: formData.medical_recommendation || undefined,
        medication_antibiotic: (formData.medication_given || []).includes("Antibiotic"),
        medication_analgesic: (formData.medication_given || []).includes("Analgesic"),
        medication_antiseptic: (formData.medication_given || []).includes("Antiseptic"),
        medication_antifungal: (formData.medication_given || []).includes("Antifungal"),
        left_ear_clear_for_fitting: formData.left_ear_clear_for_assessment || undefined,
        right_ear_clear_for_fitting: formData.right_ear_clear_for_assessment || undefined,
        comments: formData.otoscopy_comments || undefined,
      }

      await api.post("/api/phase3/ear-screening", payload, { headers })
      setSectionSuccess((s) => ({ ...s, earScreening: true }))
      setSectionErrors((s) => ({ ...s, earScreening: "" }))
    } catch (err: any) {
      setSectionErrors((s) => ({ ...s, earScreening: parseError(err) }))
    } finally {
      setSavingSection(null)
    }
  }

  const submitAftercareSection = async () => {
    const patientId = getPatientId()
    if (!patientId) return setSectionErrors((s) => ({ ...s, assessmentServices: "Search patient first" }))

    setSavingSection("assessmentServices")
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload: any = {
        patient_id: patientId,
        // Map a subset of fields used in aftercare assessment; backend will ignore unknowns
        left_ha_dead_or_broken: formData.left_ha_dead_or_broken,
        left_ha_internal_feedback: formData.left_ha_internal_feedback,
        left_ha_power_change_needed: formData.left_ha_power_change_needed,
        left_ha_lost_or_stolen: formData.left_ha_lost_or_stolen,
        left_ha_no_problem: formData.left_ha_no_problem,
        right_ha_dead_or_broken: formData.right_ha_dead_or_broken,
        right_ha_internal_feedback: formData.right_ha_internal_feedback,
        right_ha_power_change_needed: formData.right_ha_power_change_needed,
        right_ha_lost_or_stolen: formData.right_ha_lost_or_stolen,
        right_ha_no_problem: formData.right_ha_no_problem,
        left_em_discomfort_too_tight: formData.left_em_discomfort_too_tight,
        left_em_feedback_too_loose: formData.left_em_feedback_too_loose,
        left_em_damaged_or_tubing_cracked: formData.left_em_damaged_or_tubing_cracked,
        left_em_lost_or_stolen: formData.left_em_lost_or_stolen,
        left_em_no_problem: formData.left_em_no_problem,
        right_em_discomfort_too_tight: formData.right_em_discomfort_too_tight,
        right_em_feedback_too_loose: formData.right_em_feedback_too_loose,
        right_em_damaged_or_tubing_cracked: formData.right_em_damaged_or_tubing_cracked,
        right_em_lost_or_stolen: formData.right_em_lost_or_stolen,
        right_em_no_problem: formData.right_em_no_problem,
        right_ha_tested_wfa_demo: formData.right_ha_tested_wfa_demo,
        right_ha_sent_for_repair_replacement: formData.right_ha_sent_for_repair_replacement,
        right_em_took_new_impression: formData.right_em_took_new_impression,
        left_ha_tested_wfa_demo: formData.left_ha_tested_wfa_demo,
        left_ha_sent_for_repair_replacement: formData.left_ha_sent_for_repair_replacement,
        left_em_took_new_impression: formData.left_em_took_new_impression,
        counseling_provided: formData.counseling_provided,
        batteries_provided_13: formData.batteries_provided_13,
        batteries_provided_675: formData.batteries_provided_675,
        comment: formData.aftercare_comments,
      }

      // Save aftercare assessment
      await api.post("/api/phase3/aftercare-assessment", payload, { headers })

      // Also create/update fitting_table using Phase2 controller if fitting info changed
      // We call the existing helper which will create or update depending on fittingTableId
      try {
        await submitUpdateFittingTable()
      } catch (fitErr: any) {
        // If fitting update fails, record error but keep aftercare as saved
        const fitMsg = parseError(fitErr)
        setSectionErrors((s) => ({ ...s, assessmentServices: `Aftercare saved, but fitting update failed: ${fitMsg}` }))
        setSectionSuccess((s) => ({ ...s, assessmentServices: true }))
        setSavingSection(null)
        return
      }

      setSectionSuccess((s) => ({ ...s, assessmentServices: true }))
      setSectionErrors((s) => ({ ...s, assessmentServices: "" }))
    } catch (err: any) {
      setSectionErrors((s) => ({ ...s, assessmentServices: parseError(err) }))
    } finally {
      setSavingSection(null)
    }
  }

  const submitFinalQCSection = async () => {
    const patientId = getPatientId()
    if (!patientId) return setSectionErrors((s) => ({ ...s, finalQC: "Search patient first" }))

    setSavingSection("finalQC")
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        satisfaction_with_hearing: formData.satisfaction_with_hearing || undefined,
        asks_to_repeat_or_speak_louder: formData.asks_to_repeat_or_speak_louder || undefined,
        shf_notes: formData.shf_notes || undefined,
      }

      await api.post("/api/phase3/final-qc", payload, { headers })
      setSectionSuccess((s) => ({ ...s, finalQC: true }))
      setSectionErrors((s) => ({ ...s, finalQC: "" }))
    } catch (err: any) {
      setSectionErrors((s) => ({ ...s, finalQC: parseError(err) }))
    } finally {
      setSavingSection(null)
    }
  }

  // ---------- Update (or create) fitting_table using Phase2 controller ----------
  const submitUpdateFittingTable = async () => {
    const patientId = getPatientId()
    if (!patientId) return setSectionErrors((s) => ({ ...s, assessmentServices: "Search patient first" }))

    setSavingSection("updateFitting")
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        fitting_left_power_level: formData.left_power_level || null,
        fitting_left_volume: formData.left_volume || null,
        fitting_left_model: formData.left_model || null,
        fitting_left_battery: formData.left_battery_type || null,
        fitting_left_earmold: formData.left_earmold_type || null,
        fitting_right_power_level: formData.right_power_level || null,
        fitting_right_volume: formData.right_volume || null,
        fitting_right_model: formData.right_model || null,
        fitting_right_battery: formData.right_battery_type || null,
        fitting_right_earmold: formData.right_earmold_type || null,
      }

      if (fittingTableId) {
        await api.put(`/api/phase2/fitting-table/${encodeURIComponent(String(fittingTableId))}`, payload, { headers })
      } else {
        const res = await api.post("/api/phase2/fitting-table", payload, { headers })
        // store new id if backend returns it
        if (res?.data?.fitting_table_id) setFittingTableId(Number(res.data.fitting_table_id))
      }

      // mark fitting info saved locally as part of aftercareServices success state
      setSectionSuccess((s) => ({ ...s, assessmentServices: true }))
      setSectionErrors((s) => ({ ...s, assessmentServices: "" }))
    } catch (err: any) {
      setSectionErrors((s) => ({ ...s, assessmentServices: parseError(err) }))
    } finally {
      setSavingSection(null)
    }
  }

  const requestClose = () => {
    if (isFormDirty()) {
      setConfirmCloseOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  const handleConfirmClose = () => {
    setConfirmCloseOpen(false)
    onOpenChange(false)
    // reset to initial snapshot
    setFormData({ ...initialRef.current })
  }

  const handleDialogOpenChange = (val: boolean) => {
    if (!val) {
      // attempt to close
      if (isFormDirty()) {
        setConfirmCloseOpen(true)
      } else {
        onOpenChange(false)
      }
    } else {
      // opening -> pass through
      onOpenChange(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitConfirmOpen(true)
  }

  const handleConfirmSubmit = () => {
    console.log("Phase 3 Form Data:", formData)
    // Handle form submission here
    onOpenChange(false)
    // optional reset to initial snapshot
    setFormData({ ...initialRef.current })
    setSubmitConfirmOpen(false)
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }




  const aftercareTypes = ["1st Call", "2nd Call", "3rd Call", "Patient Unreachable"]
  const medications = ["Antiseptic", "Analgesic", "Antifungal", "Antibiotic"]

  const completedSections = Object.values(sectionSuccess).filter(Boolean).length
  const totalSections = 5

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[60vw] sm:h-[94vh]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold text-blue-900">
              Phase 3 AfterCare Assessment
            </DialogTitle>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="px-6 py-3 bg-blue-25 border-b">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">Sections Completed</span>
              <span>
                {completedSections}/{totalSections}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedSections / totalSections) * 100}%` }}
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(90vh-180px)] w-full pr-4">
            <div className="space-y-6 p-6">
              {/* Patient Search Section */}
              <Card className="border-2 border-dashed border-blue-200 bg-blue-25">
                <CardHeader className="bg-blue-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-600" />
                    Patient Search
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="shf-id" className="font-semibold text-gray-700">
                      SHF ID
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="shf-id"
                        placeholder="Enter SHF ID (e.g., SHF123, PH-SHF456)"
                        value={formData.shf_id}
                        onChange={(e) => handleInputChange("shf_id", e.target.value)}
                        disabled={searchLoading}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <Button
                        onClick={searchPatient}
                        disabled={searchLoading}
                        className="bg-blue-600 hover:bg-blue-700 px-6"
                      >
                        {searchLoading ? "Searching..." : "Search"}
                      </Button>
                    </div>
                    {searchError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <p className="text-red-700 text-sm">{searchError}</p>
                      </div>
                    )}
                  </div>

                  {searchedPatientId && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-green-800 font-semibold">✓ Patient Found</p>
                        <p className="text-green-700">
                          <strong>Patient ID:</strong> {searchedPatientId}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 1. REGISTRATION */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    1. Registration
                    {sectionSuccess.registration && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.registration && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country" className="font-medium">Country</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => handleInputChange("country", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phase3_aftercare_city" className="font-medium">Phase 3 AfterCare City</Label>
                      <Input
                        id="phase3_aftercare_city"
                        value={formData.phase3_aftercare_city}
                        onChange={(e) => handleInputChange("phase3_aftercare_city", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phase3_date" className="font-medium">Date</Label>
                      <Input
                        id="phase3_date"
                        type="date"
                        value={formData.phase3_date}
                        onChange={(e) => handleInputChange("phase3_date", e.target.value)}
                        required
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium">Type of AfterCare</Label>
                      <Select
                        value={formData.type_of_aftercare}
                        onValueChange={(value) => handleInputChange("type_of_aftercare", value)}
                      >
                        <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {aftercareTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="surname" className="font-medium">Last Name</Label>
                      <Input
                        id="surname"
                        value={formData.surname}
                        onChange={(e) => handleInputChange("surname", e.target.value)}
                        required
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="first_name" className="font-medium">First Name</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => handleInputChange("first_name", e.target.value)}
                        required
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Gender</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => handleInputChange("gender", value)}
                      >
                        <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dob" className="font-medium">Date of Birth</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={formData.dob}
                        onChange={(e) => handleInputChange("dob", e.target.value)}
                        required
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age" className="font-medium">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={formData.age}
                        onChange={(e) => handleInputChange("age", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobile_phone_number" className="font-medium">Mobile Phone Number</Label>
                      <Input
                        id="mobile_phone_number"
                        value={formData.mobile_phone_number}
                        onChange={(e) => handleInputChange("mobile_phone_number", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="service_center_or_school_name" className="font-medium">Service Center or School Name</Label>
                      <Input
                        id="service_center_or_school_name"
                        value={formData.service_center_or_school_name}
                        onChange={(e) => handleInputChange("service_center_or_school_name", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Highest Level of Education Attained</Label>
                      <Select
                        value={formData.highest_level_education}
                        onValueChange={(value) => handleInputChange("highest_level_education", value)}
                      >
                        <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="Primary">Primary</SelectItem>
                          <SelectItem value="Secondary">Secondary</SelectItem>
                          <SelectItem value="Post Secondary">Post Secondary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium">Employment Status</Label>
                      <Select
                        value={formData.employment_status}
                        onValueChange={(value) => handleInputChange("employment_status", value)}
                      >
                        <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employed">Employed</SelectItem>
                          <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                          <SelectItem value="Not Employed">Not Employed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id="return_visit_custom_earmold_repair"
                        checked={formData.return_visit_custom_earmold_repair}
                        onCheckedChange={(checked) =>
                          handleInputChange("return_visit_custom_earmold_repair", checked)
                        }
                      />
                      <Label className="font-medium cursor-pointer" htmlFor="return_visit_custom_earmold_repair">
                        <strong>Return Visit</strong> (Patient is picking up custom earmold(s) and/or repaired hearing aid)
                      </Label>
                    </div>
                    <div className="space-y-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                      <Label className="font-medium block">
                        Are you having a problem with your hearing aid(s) and/or earmold(s)?
                      </Label>
                      <RadioGroup
                        className="grid grid-cols-2 gap-4 pt-2"
                        value={formData.problem_with_hearing_aid_earmold}
                        onValueChange={(value) =>
                          handleInputChange("problem_with_hearing_aid_earmold", value)
                        }
                      >
                        <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                          <RadioGroupItem value="Yes" id="problem_yes" />
                          <Label htmlFor="problem_yes" className="cursor-pointer">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                          <RadioGroupItem value="No" id="problem_no" />
                          <Label htmlFor="problem_no" className="cursor-pointer">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <Label className="font-medium text-lg">Current Fitting Information:</Label>
                    <table className="w-full border-collapse border border-gray-400 text-sm">
                      <thead className="bg-gray-100">
                        <tr className="border-b border-gray-400">
                          <th className="font-bold border-r border-gray-400 p-2 text-black text-left w-[10%]">RESULTS</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black w-[20%]">POWER LEVEL</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black w-[20%]">VOLUME</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black w-[20%]">MODEL</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black w-[10%]">BATTERY</th>
                          <th className="font-bold p-2 text-black w-[25%]">EARMOLD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* LEFT EAR ROW */}
                        <tr className="border-b border-gray-400">
                          <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">LEFT EAR</td>
                          <td className="border-r border-gray-400 p-2 text-center">{formData.left_power_level || "—"}</td>
                          <td className="border-r border-gray-400 p-2 text-center">{formData.left_volume || "—"}</td>
                          <td className="border-r border-gray-400 p-2 text-center">{formData.left_model || "—"}</td>
                          <td className="border-r border-gray-400 p-2 text-center bg-gray-50">{formData.left_battery_type || "—"}</td>
                          <td className="p-2 text-center">{formData.left_earmold_type || "—"}</td>
                        </tr>

                        {/* RIGHT EAR ROW */}
                        <tr>
                          <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">RIGHT EAR</td>
                          <td className="border-r border-gray-400 p-2 text-center">{formData.right_power_level || "—"}</td>
                          <td className="border-r border-gray-400 p-2 text-center">{formData.right_volume || "—"}</td>
                          <td className="border-r border-gray-400 p-2 text-center">{formData.right_model || "—"}</td>
                          <td className="border-r border-gray-400 p-2 text-center bg-gray-50">{formData.right_battery_type || "—"}</td>
                          <td className="p-2 text-center">{formData.right_earmold_type || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>


                  {sectionErrors.registration && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.registration}</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <div onClick={() => ensurePatientAndRun(submitRegistrationSection)} className="inline-block">
                      <Button
                        disabled={!getPatientId() || savingSection === "registration"}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingSection === "registration" ? "Saving..." : "Save Registration"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                    <Ear className="h-5 w-5 text-green-600" />
                    2. Ear Screening/Otoscopy
                    {sectionSuccess.earScreening && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.earScreening && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                  {/* --- Ear Findings Section (Structured like Phase 2 Otoscopy) --- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    {/* Left Ear Findings */}
                    <div className="space-y-4">
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <Ear className="h-4 w-4 text-emerald-600" /> Left Ear Findings
                      </h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        {[
                          "wax",
                          "infection",
                          "perforation",
                          "tinnitus",
                          "atresia",
                          "implant",
                          "other",
                        ].map((key) => (
                          <div
                            key={`left_${key}`}
                            className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                          >
                            <Checkbox
                              id={`left-${key}`}
                              // Assuming formData has keys like left_wax, left_infection, etc.
                              checked={(formData as any)[`left_${key}`] || false}
                              onCheckedChange={(checked) =>
                                handleInputChange(`left_${key}` as keyof typeof formData, checked)
                              }
                            />
                            <Label
                              htmlFor={`left-${key}`}
                              className="text-sm cursor-pointer text-gray-800"
                            >
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Ear Findings */}
                    <div className="space-y-4">
                      <h4 className="text-base font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                        <Ear className="h-4 w-4 text-emerald-600" /> Right Ear Findings
                      </h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        {[
                          "wax",
                          "infection",
                          "perforation",
                          "tinnitus",
                          "atresia",
                          "implant",
                          "other",
                        ].map((key) => (
                          <div
                            key={`right_${key}`}
                            className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                          >
                            <Checkbox
                              id={`right-${key}`}
                              // Assuming formData has keys like right_wax, right_infection, etc.
                              checked={(formData as any)[`right_${key}`] || false}
                              onCheckedChange={(checked) =>
                                handleInputChange(`right_${key}` as keyof typeof formData, checked)
                              }
                            />
                            <Label
                              htmlFor={`right-${key}`}
                              className="text-sm cursor-pointer text-gray-800"
                            >
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Medical Recommendation (Structured like Phase 2) */}
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    <Label className="font-medium block text-gray-700 mb-2">
                      Medical Recommendation
                    </Label>
                    <RadioGroup
                      className="flex space-x-8"
                      value={formData.medical_recommendation}
                      onValueChange={(value) => handleInputChange("medical_recommendation", value)}
                    >
                      {["Left", "Right"].map((side) => (
                        <div
                          key={`med_reco_${side.toLowerCase()}`}
                          className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 transition-colors"
                        >
                          <RadioGroupItem value={side} id={`med_reco_${side.toLowerCase()}`} />
                          <Label
                            htmlFor={`med_reco_${side.toLowerCase()}`}
                            className="cursor-pointer text-gray-800 font-medium"
                          >
                            {side}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Medication Given (Structured and improved for multiple selection) */}
                  {/* NOTE: Phase 3 used an array `medication_given`, Phase 2 used individual boolean keys (`medication_...`). I've kept the Phase 3 array logic but used Phase 2 styling. You may need to adapt your `formData` or `handleInputChange` for this if you prefer the Phase 2 field structure. */}
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    <Label className="font-medium block text-gray-700 mb-2">
                      Medication Given
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Assume 'medications' is an array of strings: ['Med 1', 'Med 2', ...] */}
                      {medications.map((med) => (
                        <div
                          key={`med_${med}`}
                          className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                        >
                          <Checkbox
                            id={`med_${med}`}
                            checked={formData.medication_given.includes(med)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleInputChange("medication_given", [...formData.medication_given, med])
                              } else {
                                handleInputChange("medication_given", formData.medication_given.filter((m) => m !== med))
                              }
                            }}
                          />
                          <Label htmlFor={`med_${med}`} className="text-sm cursor-pointer text-gray-800">
                            {med}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ears Clear for Assessment (Retaining Phase 3 structure and Phase 2 styling) */}
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    <Label className="font-medium block text-gray-700">
                      Ears Clear for Assessment?
                    </Label>
                    <div className="grid grid-cols-2 gap-6 pt-2">
                      {/* RIGHT EAR */}
                      <div>
                        <Label className="text-sm font-semibold">Right Ear</Label>
                        <RadioGroup
                          className="flex space-x-8 mt-2"
                          value={formData.right_ear_clear_for_assessment}
                          onValueChange={(value) =>
                            handleInputChange("right_ear_clear_for_assessment", value)
                          }
                        >
                          {["Yes", "No"].map((val) => (
                            <div
                              key={`right_clear_${val.toLowerCase()}`}
                              className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 transition-colors"
                            >
                              <RadioGroupItem value={val} id={`right_ear_clear_${val.toLowerCase()}`} />
                              <Label htmlFor={`right_ear_clear_${val.toLowerCase()}`} className="cursor-pointer text-gray-800 font-medium">{val}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      {/* LEFT EAR */}
                      <div>
                        <Label className="text-sm font-semibold">Left Ear</Label>
                        <RadioGroup
                          className="flex space-x-8 mt-2"
                          value={formData.left_ear_clear_for_assessment}
                          onValueChange={(value) =>
                            handleInputChange("left_ear_clear_for_assessment", value)
                          }
                        >
                          {["Yes", "No"].map((val) => (
                            <div
                              key={`left_clear_${val.toLowerCase()}`}
                              className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 transition-colors"
                            >
                              <RadioGroupItem value={val} id={`left_ear_clear_${val.toLowerCase()}`} />
                              <Label htmlFor={`left_ear_clear_${val.toLowerCase()}`} className="cursor-pointer text-gray-800 font-medium">{val}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  </div>

                  {/* Comments (Structured like Phase 2) */}
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    <Label htmlFor="otoscopy_comments" className="font-medium text-gray-700">
                      Comments
                    </Label>
                    <Textarea
                      id="otoscopy_comments"
                      value={formData.otoscopy_comments}
                      onChange={(e) => handleInputChange("otoscopy_comments", e.target.value)}
                      className="min-h-[100px] focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors rounded-lg"
                      placeholder="Enter additional notes here..."
                    />
                  </div>

                  {/* --- Validation & Status Messages (Structured like Phase 2) --- */}
                  {sectionErrors.earScreening && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">
                        {sectionErrors.earScreening}
                      </p>
                    </div>
                  )}

                  {sectionSuccess.earScreening && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">
                        ✓ Ear Screening & Otoscopy saved successfully!
                      </p>
                    </div>
                  )}


                  {/* --- Save Button (Structured like Phase 2) --- */}
                  <div className="flex justify-end pt-4">
                    <div onClick={() => ensurePatientAndRun(submitEarScreeningSection)} className="inline-block w-full sm:w-auto">
                      <Button
                        disabled={!getPatientId() || savingSection === "earScreening"}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingSection === "earScreening" ? "Saving..." : "Save Ear Screening & Otoscopy"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              {/* 3A. AFTERCARE ASSESSMENT - EVALUATION */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-orange-600" />
                    3A. AfterCare Assessment - Evaluation
                    {sectionSuccess.assessmentEvaluation && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.assessmentEvaluation && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <h4 className="font-medium mb-3 border-b pb-2">Left Ear</h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium mb-2">Hearing Aid</h5>
                          <div className="space-y-2">
                            {[
                              { key: "left_ha_dead_or_broken", label: "Hearing Aid is Dead or Broken" },
                              { key: "left_ha_internal_feedback", label: "Hearing Aid has Internal Feedback" },
                              { key: "left_ha_power_change_needed", label: "Hearing Aid Power Change Needed" },
                              { key: "left_ha_lost_or_stolen", label: "Hearing Aid was Lost or Stolen" },
                              { key: "left_ha_no_problem", label: "No Problem with Hearing Aid" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium mb-2">Earmold</h5>
                          <div className="space-y-2">
                            {[
                              { key: "left_em_discomfort_too_tight", label: "Discomfort/Earmold too Tight" },
                              { key: "left_em_feedback_too_loose", label: "Feedback/Earmold too Loose" },
                              {
                                key: "left_em_damaged_or_tubing_cracked",
                                label: "Earmold is Damaged or Tubing is Cracked",
                              },
                              { key: "left_em_lost_or_stolen", label: "Earmold was Lost or Stolen" },
                              { key: "left_em_no_problem", label: "No Problem with Earmold" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <h4 className="font-medium mb-3 border-b pb-2">Right Ear</h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium mb-2">Hearing Aid</h5>
                          <div className="space-y-2">
                            {[
                              { key: "right_ha_dead_or_broken", label: "Hearing Aid is Dead or Broken" },
                              { key: "right_ha_internal_feedback", label: "Hearing Aid has Internal Feedback" },
                              { key: "right_ha_power_change_needed", label: "Hearing Aid Power Change Needed" },
                              { key: "right_ha_lost_or_stolen", label: "Hearing Aid was Lost or Stolen" },
                              { key: "right_ha_no_problem", label: "No Problem with Hearing Aid" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium mb-2">Earmold</h5>
                          <div className="space-y-2">
                            {[
                              { key: "right_em_discomfort_too_tight", label: "Discomfort/Earmold too Tight" },
                              { key: "right_em_feedback_too_loose", label: "Feedback/Earmold too Loose" },
                              {
                                key: "right_em_damaged_or_tubing_cracked",
                                label: "Earmold is Damaged or Tubing is Cracked",
                              },
                              { key: "right_em_lost_or_stolen", label: "Earmold was Lost or Stolen" },
                              { key: "right_em_no_problem", label: "No Problem with Earmold" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-purple-600" />
                    3B. AfterCare Assessment - Services Completed
                    {sectionSuccess.assessmentServices && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.assessmentServices && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <h4 className="font-medium mb-3 border-b pb-2">Left Ear</h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium mb-2">Hearing Aid</h5>
                          <div className="space-y-2">
                            {[
                              {
                                key: "left_ha_tested_wfa_demo",
                                label: "Tested with WFA® Fitting Method using Demo Hearing Aids",
                              },
                              {
                                key: "left_ha_sent_for_repair_replacement",
                                label: "Hearing Aid Sent to SHF for Repair or Replacement",
                              },
                              { key: "left_ha_refit_new", label: "Refit new Hearing Aid" },
                              { key: "left_ha_not_benefiting", label: "Not Benefiting from Hearing Aid" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium mb-2">Earmold</h5>
                          <div className="space-y-2">
                            {[
                              { key: "left_em_retubed_unplugged", label: "Retubed or Unplugged Earmold" },
                              { key: "left_em_modified", label: "Modified Earmold" },
                              { key: "left_em_fit_stock", label: "Fit Stock Earmold" },
                              { key: "left_em_took_new_impression", label: "Took new Ear Impression" },
                              { key: "left_em_refit_custom", label: "Refit Custom Earmold" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <h4 className="font-medium mb-3 border-b pb-2">Right Ear</h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium mb-2">Hearing Aid</h5>
                          <div className="space-y-2">
                            {[
                              {
                                key: "right_ha_tested_wfa_demo",
                                label: "Tested with WFA® Fitting Method using Demo Hearing Aids",
                              },
                              {
                                key: "right_ha_sent_for_repair_replacement",
                                label: "Hearing Aid Sent to SHF for Repair or Replacement",
                              },
                              { key: "right_ha_refit_new", label: "Refit new Hearing Aid" },
                              { key: "right_ha_not_benefiting", label: "Not Benefiting from Hearing Aid" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium mb-2">Earmold</h5>
                          <div className="space-y-2">
                            {[
                              { key: "right_em_retubed_unplugged", label: "Retubed or Unplugged Earmold" },
                              { key: "right_em_modified", label: "Modified Earmold" },
                              { key: "right_em_fit_stock", label: "Fit Stock Earmold" },
                              { key: "right_em_took_new_impression", label: "Took new Ear Impression" },
                              { key: "right_em_refit_custom", label: "Refit Custom Earmold" },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                <Checkbox
                                  id={key}
                                  checked={formData[key as keyof typeof formData] as boolean}
                                  onCheckedChange={(checked) => handleInputChange(key, checked)}
                                />
                                <Label htmlFor={key} className="text-sm cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">General Services</h4>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <Checkbox
                          id="counseling_provided"
                          checked={formData.counseling_provided}
                          onCheckedChange={(checked) =>
                            handleInputChange("counseling_provided", checked)
                          }
                        />
                        <Label htmlFor="counseling_provided" className="font-medium cursor-pointer">Counseling</Label>
                      </div>

                      <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="toggle_batteries_provided"
                            checked={formData.show_batteries_provided}
                            onCheckedChange={(checked) =>
                              handleInputChange("show_batteries_provided", checked)
                            }
                            className="h-4 w-4"
                          />
                          <Label htmlFor="toggle_batteries_provided" className="font-medium cursor-pointer">
                            Batteries Provided:
                          </Label>
                        </div>

                        {formData.show_batteries_provided && (
                          <div className="grid grid-cols-2 gap-4 pl-6 pt-3">
                            <div className="space-y-2">
                              <Label htmlFor="batteries_provided_13" className="font-medium">Battery 13</Label>
                              <Input
                                id="batteries_provided_13"
                                type="number"
                                value={formData.batteries_provided_13 ?? ""}
                                onChange={(e) =>
                                  handleInputChange(
                                    "batteries_provided_13",
                                    e.target.value === "" ? null : Number.parseInt(e.target.value)
                                  )
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="batteries_provided_675" className="font-medium">Battery 675</Label>
                              <Input
                                id="batteries_provided_675"
                                type="number"
                                value={formData.batteries_provided_675 ?? ""}
                                onChange={(e) =>
                                  handleInputChange(
                                    "batteries_provided_675",
                                    e.target.value === "" ? null : Number.parseInt(e.target.value)
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <Checkbox
                            id="refer_to_aftercare_center"
                            checked={formData.refer_to_aftercare_center}
                            onCheckedChange={(checked) =>
                              handleInputChange("refer_to_aftercare_center", checked)
                            }
                          />
                          <Label htmlFor="refer_to_aftercare_center" className="font-medium cursor-pointer">Refer to AfterCare Service Center</Label>
                        </div>
                        <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <Checkbox
                            id="refer_to_next_phase2_mission"
                            checked={formData.refer_to_next_phase2_mission}
                            onCheckedChange={(checked) =>
                              handleInputChange("refer_to_next_phase2_mission", checked)
                            }
                          />
                          <Label htmlFor="refer_to_next_phase2_mission" className="font-medium cursor-pointer">Refer to next Phase 2 Mission</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4">
                    <Label className="font-medium text-lg">Update Fitting Information:</Label>
                    <table className="w-full border-collapse border border-gray-400 text-sm">
                      <thead className="bg-gray-100">
                        <tr className="border-b border-gray-400">
                          <th className="font-bold border-r border-gray-400 p-2 text-black h-auto text-left w-[10%]">RESULTS</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[20%]">POWER LEVEL</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[20%]">VOLUME</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[20%]">MODEL</th>
                          <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[10%]">BATTERY</th>
                          <th className="font-bold p-2 text-black h-auto w-[25%]">EARMOLD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* LEFT EAR ROW */}
                        <tr className="border-b border-gray-400">
                          <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">LEFT EAR</td>
                          <td className="border-r border-gray-400 p-0">
                            <select
                              value={formData.left_power_level}
                              onChange={(e) => handleInputChange("left_power_level", e.target.value)}
                              className="h-8 w-full border-none text-center"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="">None</option>
                            </select>
                          </td>
                          <td className="border-r border-gray-400 p-0">
                            <select
                              value={formData.left_volume}
                              onChange={(e) => handleInputChange("left_volume", e.target.value)}
                              className="h-8 w-full border-none text-center hover:bg-white"
                            >
                              <option value="None">0%</option>
                              <option value="10%">10%</option>
                              <option value="20%">20%</option>
                              <option value="30%">30%</option>
                              <option value="40%">40%</option>
                              <option value="50%">50%</option>
                              <option value="60%">60%</option>
                              <option value="70%">70%</option>
                              <option value="80%">80%</option>
                              <option value="90%">90%</option>
                              <option value="100%">100%</option>

                            </select>
                          </td>
                          <td className="border-r border-gray-400 p-0">
                            <Input
                              id="left_model"
                              value={formData.left_model}
                              onChange={(e) => handleInputChange("left_model", e.target.value)}
                              className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </td>
                          <td className="border-r border-gray-400 p-2 bg-gray-50">
                            <RadioGroup
                              value={formData.left_battery_type}
                              onValueChange={(value) => handleInputChange("left_battery_type", value)}
                              className="flex space-x-4 justify-center"
                            >
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="13" id="left_batt_13" />
                                <Label htmlFor="left_batt_13" className="font-normal text-sm cursor-pointer">13</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="675" id="left_batt_675" />
                                <Label htmlFor="left_batt_675" className="font-normal text-sm cursor-pointer">675</Label>
                              </div>
                            </RadioGroup>
                          </td>
                          <td className="p-0">
                            <Input
                              id="left_earmold_type"
                              value={formData.left_earmold_type}
                              onChange={(e) => handleInputChange("left_earmold_type", e.target.value)}
                              className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </td>
                        </tr>
                        {/* RIGHT EAR ROW */}
                        <tr>
                          <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">RIGHT EAR</td>
                          <td className="border-r border-gray-400 p-0">
                            <select
                              value={formData.right_power_level}
                              onChange={(e) => handleInputChange("right_power_level", e.target.value)}
                              className="h-8 w-full border-none text-center"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="">None</option>
                            </select>
                          </td>
                          <td className="border-r border-gray-400 p-0">
                            <select
                              value={formData.right_volume}
                              onChange={(e) => handleInputChange("right_volume", e.target.value)}
                              className="h-8 w-full border-none text-center"
                            >
                              <option value="None">0%</option>
                              <option value="10%">10%</option>
                              <option value="20%">20%</option>
                              <option value="30%">30%</option>
                              <option value="40%">40%</option>
                              <option value="50%">50%</option>
                              <option value="60%">60%</option>
                              <option value="70%">70%</option>
                              <option value="80%">80%</option>
                              <option value="90%">90%</option>
                              <option value="100%">100%</option>

                            </select>
                          </td>
                          <td className="border-r border-gray-400 p-0">
                            <Input
                              id="right_model"
                              value={formData.right_model}
                              onChange={(e) => handleInputChange("right_model", e.target.value)}
                              className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </td>
                          <td className="border-r border-gray-400 p-2 bg-gray-50">
                            <RadioGroup
                              value={formData.right_battery_type}
                              onValueChange={(value) => handleInputChange("right_battery_type", value)}
                              className="flex space-x-4 justify-center"
                            >
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="13" id="right_batt_13" />
                                <Label htmlFor="right_batt_13" className="font-normal text-sm cursor-pointer">13</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="675" id="right_batt_675" />
                                <Label htmlFor="right_batt_675" className="font-normal text-sm cursor-pointer">675</Label>
                              </div>
                            </RadioGroup>
                          </td>
                          <td className="p-0">
                            <Input
                              id="right_earmold_type"
                              value={formData.right_earmold_type}
                              onChange={(e) => handleInputChange("right_earmold_type", e.target.value)}
                              className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2">
                    <p>If you are sending in a hearing aid for repair or replacement ensure that you retest the patient
                      using the WFA® Fitting Method with your demo kit. Add the new fitting information above.</p>
                    <Label htmlFor="aftercare_comments" className="font-medium">Comments</Label>
                    <Textarea
                      id="aftercare_comments"
                      value={formData.aftercare_comments}
                      onChange={(e) => handleInputChange("aftercare_comments", e.target.value)}
                      className="min-h-[100px] focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    />
                  </div>

                  {sectionErrors.assessmentServices && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">Aftercare Assessment section failed to save</p>
                    </div>
                  )}

                  {sectionErrors.assessmentServices && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.assessmentServices}</p>
                    </div>
                  )}

                  {sectionSuccess.assessmentServices && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm">Aftercare Services section saved successfully</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitAftercareSection}
                      disabled={savingSection === "assessmentServices"}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      {savingSection === "assessmentServices" ? "Saving..." : "Save Aftercare Assessment"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              {/* 4. FINAL QUALITY CONTROL */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Battery className="h-5 w-5 text-gray-600" />
                    4. Final Quality Control
                    {sectionSuccess.finalQC && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.finalQC && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="font-medium block">When wearing your hearing aid(s) how satisfied are you with your hearing? (18+)</Label>
                    <RadioGroup
                      className="grid grid-cols-3 gap-3 mt-4"
                      value={formData.satisfaction_with_hearing}
                      onValueChange={(value) => handleInputChange("satisfaction_with_hearing", value)}
                    >
                      <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Unsatisfied" id="final_unsatisfied" />
                        <Label htmlFor="final_unsatisfied" className="cursor-pointer">Unsatisfied</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Undecided" id="final_undecided" />
                        <Label htmlFor="final_undecided" className="cursor-pointer">Undecided</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Satisfied" id="final_satisfied" />
                        <Label htmlFor="final_satisfied" className="cursor-pointer">Satisfied</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="font-medium block">
                      When wearing your hearing aid(s) do you ask people to repeat themselves or speak louder in
                      conversation? (18+)
                    </Label>
                    <RadioGroup
                      className="grid grid-cols-3 gap-3 mt-4"
                      value={formData.asks_to_repeat_or_speak_louder}
                      onValueChange={(value) => handleInputChange("asks_to_repeat_or_speak_louder", value)}
                    >
                      <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="No" id="repeat_no" />
                        <Label htmlFor="repeat_no" className="cursor-pointer">No</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Sometimes" id="repeat_sometimes" />
                        <Label htmlFor="repeat_sometimes" className="cursor-pointer">Sometimes</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Yes" id="repeat_yes" />
                        <Label htmlFor="repeat_yes" className="cursor-pointer">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shf_notes" className="font-medium">Notes from SHF</Label>
                    <Textarea
                      id="shf_notes"
                      value={formData.shf_notes}
                      onChange={(e) => handleInputChange("shf_notes", e.target.value)}
                      className="min-h-[100px] focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
                    />
                  </div>

                  {sectionErrors.finalQC && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">Final QC section failed to save</p>
                    </div>
                  )}
                  {sectionSuccess.finalQC && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm">Final QC section saved successfully.</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitFinalQCSection}
                      disabled={savingSection === "finalQC"}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      {savingSection === "finalQC" ? "Saving..." : "Save Final QC"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* confirmation to avoid accidental close when dirty */}
      <Dialog open={confirmCloseOpen} onOpenChange={(v) => setConfirmCloseOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Unsaved Changes
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">You have unsaved changes. Are you sure you want to close and discard them?</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmCloseOpen(false)}>Keep editing</Button>
            <Button onClick={handleConfirmClose} className="bg-red-600 hover:bg-red-700">Discard & Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit confirmation: recheck patient data before proceeding */}
      <Dialog open={submitConfirmOpen} onOpenChange={(v) => setSubmitConfirmOpen(v)}>
        <DialogContent className="max-w-md">
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-2">Please recheck patient data</h3>
            <p className="mb-4">Before submitting, please confirm you have reviewed all patient data. Proceed?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubmitConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleConfirmSubmit} className="bg-blue-600 hover:bg-blue-700">Confirm & Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Need patient dialog */}
      <Dialog open={needPatientDialogOpen} onOpenChange={(v) => setNeedPatientDialogOpen(v)}>
        <DialogContent className="max-w-md">
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-2">Patient Required</h3>
            <p className="mb-4">Please search and select a patient before performing this action.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setNeedPatientDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700">OK</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}