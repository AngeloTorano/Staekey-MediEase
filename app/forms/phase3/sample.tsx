"use client"

import type React from "react"
import axios from "axios"
import { useState, useRef, useEffect } from "react"
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

interface PatientSearchResponse {
  patient_id: number
}

export default function Phase3FormsPage() {
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
    // phone call attempt (only used when type_of_aftercare === "Phone")
    phone_call_attempt: "",
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
    left_ha_power_change_reason: "", // <-- added
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
    right_ha_power_change_reason: "", // <-- added
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
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({})
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [fittingTableId, setFittingTableId] = useState<number | null>(null)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [needPatientDialogOpen, setNeedPatientDialogOpen] = useState(false)
  const [phase3RegId, setPhase3RegId] = useState<number | null>(null)

  // NEW: Phase 2 gating states
  const [hasPhase2Record, setHasPhase2Record] = useState<boolean | null>(null)
  const [phase2CheckLoading, setPhase2CheckLoading] = useState(false)
  const [needPhase2DialogOpen, setNeedPhase2DialogOpen] = useState(false)

  // Battery availability state (show available counts under battery inputs)
  const [battery13Available, setBattery13Available] = useState<number | null>(null)
  const [battery675Available, setBattery675Available] = useState<number | null>(null)

  // Function to calculate age from date of birth
  const calculateAge = (dob: string): string => {
    if (!dob) return ""

    const birthDate = new Date(dob)
    const today = new Date()

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    // Adjust age if birthday hasn't occurred this year yet
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age.toString()
  }

  // Effect to automatically calculate age when date of birth changes
  useEffect(() => {
    if (formData.dob) {
      const calculatedAge = calculateAge(formData.dob)
      setFormData(prev => ({ ...prev, age: calculatedAge }))
    }
  }, [formData.dob])

  // Best-effort inventory lookup for battery items
  const fetchBatteryAvailability = async () => {
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.get("/api/supplies", { headers, params: { limit: 1000 } })

      let payload: any = null
      if (res.data?.encrypted_data) {
        try { payload = decryptObject(res.data.encrypted_data) } catch { payload = null }
      } else {
        payload = res.data?.data ?? res.data
      }

      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.supplies) ? payload.supplies : (Array.isArray(payload?.rows) ? payload.rows : [])

      const findByToken = (tokenStr: string) =>
        rows.find((r: any) =>
          (r.item_code && String(r.item_code).toLowerCase().includes(tokenStr)) ||
          (r.item_name && String(r.item_name).toLowerCase().includes(tokenStr))
        )

      const match13 = findByToken("13")
      const match675 = findByToken("675")

      const getStock = (r: any) => {
        if (!r) return null
        return Number(r.current_stock_level ?? r.current_stock ?? null) || 0
      }

      setBattery13Available(getStock(match13))
      setBattery675Available(getStock(match675))
    } catch (err) {
      console.warn("fetchBatteryAvailability failed", err)
    }
  }

  // Check if patient has Phase 2 registration record
  const checkPhase2Record = async (patientId: number) => {
    if (!patientId) {
      setHasPhase2Record(null)
      return
    }
    setPhase2CheckLoading(true)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.get(`/api/phases/combined/${patientId}`, { headers })
      const payload = res.data?.data || res.data
      const phase2Reg = payload?.phase2?.registration
      setHasPhase2Record(!!phase2Reg)
    } catch (e) {
      setHasPhase2Record(false)
    } finally {
      setPhase2CheckLoading(false)
    }
  }

  // Ensure patient & phase2 record before running an action
  const ensurePatientAndRun = async (action?: () => Promise<void> | void) => {
    const pid = getPatientId()
    if (!pid || pid === 0) {
      setNeedPatientDialogOpen(true)
      return
    }
    if (hasPhase2Record === false) {
      setNeedPhase2DialogOpen(true)
      return
    }
    if (hasPhase2Record === null) {
      // Not yet loaded; block action
      return
    }
    try {
      await action?.()
    } catch {}
  }

  useEffect(() => {
    initialRef.current = { ...formData }
  }, [])

  useEffect(() => {
    fetchBatteryAvailability()
  }, [])

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

  // Normalizers to match Select option values (made more permissive + fallback)
  const capitalizeWords = (str: string) =>
    str
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")

  const normalizeGender = (g: any) => {
    const s = String(g ?? "").trim().toLowerCase()
    if (!s) return ""
    if (["m", "male"].includes(s)) return "Male"
    if (["f", "female"].includes(s)) return "Female"
    // fallback: keep original capitalized form
    return capitalizeWords(String(g).trim())
  }

  const normalizeEmployment = (e: any) => {
    const raw = String(e ?? "").trim()
    const s = raw.toLowerCase()
    if (!s) return ""
    if (s.includes("self")) return "Self-Employed"
    if (s.includes("not")) return "Not Employed"
    if (s.includes("employ")) return "Employed"
    return capitalizeWords(raw)
  }

  const normalizeEducation = (ed: any) => {
    const raw = String(ed ?? "").trim()
    const s = raw.toLowerCase()
    if (!s) return ""
    if (s.includes("post") && s.includes("secondary")) return "Post Secondary"
    if (s === "post-secondary" || s === "post_secondary") return "Post Secondary"
    if (s.includes("secondary")) return "Secondary"
    if (s.includes("primary")) return "Primary"
    if (s === "none" || s === "n/a") return "None"
    return capitalizeWords(raw)
  }

  const searchPatient = async () => {
    debugLog("PATIENT_SEARCH", "Starting patient search", { shf_id: formData.shf_id })

    if (!formData.shf_id.trim()) {
      setSearchError("Please enter an SHF ID")
      return
    }
  const resetLoadedPatientFields = () => {
    setFormData(prev => ({
      ...prev,
      patient_id: 0,
      surname: "",
      first_name: "",
      dob: "",
      age: "",
      gender: "",
      mobile_phone_number: "",
      employment_status: "",
      highest_level_education: "",
      left_power_level: "",
      left_volume: "",
      left_model: "",
      left_battery_type: "",
      left_earmold_type: "",
      right_power_level: "",
      right_volume: "",
      right_model: "",
      right_battery_type: "",
      right_earmold_type: "",
    }))
    setFittingTableId(null)
  }
    // Clear previous patient + fitting data before new search
    resetLoadedPatientFields()

    setSearchLoading(true)
    setSearchError(null)
    setSearchedPatientId(null)
    setPatientFound(false)
    // Phase 2 gating reset for new search
    setHasPhase2Record(null)
    setPhase2CheckLoading(false)

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await api.get(
        `/api/patients/shf?shf=${encodeURIComponent(formData.shf_id.trim())}`,
        { headers },
      )

      console.log("[DEBUG] Raw /patients/shf response:", response.data)

      if (response.data && typeof response.data.patient_id === "number") {
        const pdata = response.data

        console.log("[DEBUG] Mapped fields before normalization:", {
          gender: pdata.gender,
          employment_status: pdata.employment_status,
          highest_education_level: pdata.highest_education_level,
        })

        setFormData((prev) => ({
          ...prev,
          patient_id: pdata.patient_id,
          surname: pdata.last_name ?? prev.surname,
          first_name: pdata.first_name ?? prev.first_name,
          dob: pdata.date_of_birth ? String(pdata.date_of_birth).split("T")[0] : prev.dob,
            // Ensure age stored as string for input
          age: pdata.age != null ? String(pdata.age) : prev.age,
          gender: normalizeGender(pdata.gender) || prev.gender,
          mobile_phone_number: pdata.mobile_number ?? prev.mobile_phone_number,
          employment_status: normalizeEmployment(pdata.employment_status) || prev.employment_status,
          highest_level_education: normalizeEducation(pdata.highest_education_level) || prev.highest_level_education,
        }))

        console.log("[DEBUG] FormData after patient load:", {
          gender: normalizeGender(pdata.gender),
          employment_status: normalizeEmployment(pdata.employment_status),
          highest_level_education: normalizeEducation(pdata.highest_education_level),
        })

        // Use fitting table presence to gate Phase 3
        setPhase2CheckLoading(true)
        fetchLatestFittingTable(pdata.patient_id)

        setSearchedPatientId(pdata.patient_id)
        setPatientFound(true)
        setSearchError(null)
      } else {
        setSearchError("Patient not found with this SHF ID")
      }
    } catch (error: any) {
      const message = parseError(error)
      // Ensure stale data not shown on error
      resetLoadedPatientFields()
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
    // Begin Phase 2 check based on fitting table content
    setPhase2CheckLoading(true)
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

      // Gate Phase 3 purely by fitting table presence
      if (!rows || rows.length === 0) {
        setHasPhase2Record(false)
        // Immediately prompt to complete Phase 2
        setNeedPhase2DialogOpen(true)
        setFittingLoading(false)
        setPhase2CheckLoading(false)
        return
      }

      setHasPhase2Record(true)

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
      // On error, be conservative and require Phase 2
      setHasPhase2Record(false)
    } finally {
      setFittingLoading(false)
      setPhase2CheckLoading(false)
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

      const res = await api.post("/api/phase3/registration", payload, { headers })
      if (res.data?.data?.phase3_reg_id) setPhase3RegId(res.data.data.phase3_reg_id)

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
    debugLog("EAR_SCREENING_P3", "Starting ear screening submission", { patientId })
    if (!patientId || patientId === 0) {
      setSectionErrors((p) => ({ ...p, earScreening: "Patient ID required. Please search for the patient first." }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const earsClearValue = formData.ears_clear_for_assessment === "Yes" ? "Yes" : "No"

      const payload = {
        patient_id: patientId,
        // include aliases to satisfy validation
        ears_clear_for_assessment: earsClearValue,
        ears_clear: earsClearValue,
        left_wax: !!formData.left_wax,
        right_wax: !!formData.right_wax,
        left_infection: !!formData.left_infection,
        right_infection: !!formData.right_infection,
        left_perforation: !!formData.left_perforation,
        right_perforation: !!formData.right_perforation,
        left_other: !!formData.left_other,
        right_other: !!formData.right_other,
        medical_recommendation: formData.medical_recommendation || null,
        medication_antibiotic: (formData.medication_given || []).includes("Antibiotic"),
        medication_analgesic: (formData.medication_given || []).includes("Analgesic"),
        medication_antiseptic: (formData.medication_given || []).includes("Antiseptic"),
        medication_antifungal: (formData.medication_given || []).includes("Antifungal"),
        left_ear_clear_for_assessment: formData.left_ear_clear_for_assessment || null,
        right_ear_clear_for_assessment: formData.right_ear_clear_for_assessment || null,
        comments: formData.otoscopy_comments || null,
      }

      debugLog("EAR_SCREENING_P3", "Payload constructed", payload)
      await api.post("/api/phase3/ear-screening", payload, { headers })

      setSectionSuccess((p) => ({ ...p, earScreening: true }))
      setSectionErrors((p) => ({ ...p, earScreening: "" }))
      debugLog("EAR_SCREENING_P3", "Ear screening submitted successfully")
    } catch (error: any) {
      const msg = parseError(error)
      setSectionErrors((p) => ({ ...p, earScreening: msg || "Failed to submit ear screening" }))
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
        left_ha_power_change_reason: formData.left_ha_power_change_reason,
        left_ha_lost_or_stolen: formData.left_ha_lost_or_stolen,
        left_ha_no_problem: formData.left_ha_no_problem,
        // 3B - HA services (LEFT)
        left_ha_tested_wfa_demo: formData.left_ha_tested_wfa_demo,
        left_ha_sent_for_repair_replacement: formData.left_ha_sent_for_repair_replacement,
        left_ha_refit_new: formData.left_ha_refit_new,
        left_ha_not_benefiting: formData.left_ha_not_benefiting,

        right_ha_dead_or_broken: formData.right_ha_dead_or_broken,
        right_ha_internal_feedback: formData.right_ha_internal_feedback,
        right_ha_power_change_needed: formData.right_ha_power_change_needed,
        right_ha_power_change_reason: formData.right_ha_power_change_reason,
        right_ha_lost_or_stolen: formData.right_ha_lost_or_stolen,
        right_ha_no_problem: formData.right_ha_no_problem,
        // 3B - HA services (RIGHT)
        right_ha_tested_wfa_demo: formData.right_ha_tested_wfa_demo,
        right_ha_sent_for_repair_replacement: formData.right_ha_sent_for_repair_replacement,
        right_ha_refit_new: formData.right_ha_refit_new,
        right_ha_not_benefiting: formData.right_ha_not_benefiting,

        left_em_discomfort_too_tight: formData.left_em_discomfort_too_tight,
        left_em_feedback_too_loose: formData.left_em_feedback_too_loose,
        left_em_damaged_or_tubing_cracked: formData.left_em_damaged_or_tubing_cracked,
        left_em_lost_or_stolen: formData.left_em_lost_or_stolen,
        left_em_no_problem: formData.left_em_no_problem,
        // 3B - Earmold services (LEFT)
        left_em_retubed_unplugged: formData.left_em_retubed_unplugged,
        left_em_modified: formData.left_em_modified,
        left_em_fit_stock: formData.left_em_fit_stock,
        left_em_took_new_impression: formData.left_em_took_new_impression,
        left_em_refit_custom: formData.left_em_refit_custom,

        right_em_discomfort_too_tight: formData.right_em_discomfort_too_tight,
        right_em_feedback_too_loose: formData.right_em_feedback_too_loose,
        right_em_damaged_or_tubing_cracked: formData.right_em_damaged_or_tubing_cracked,
        right_em_lost_or_stolen: formData.right_em_lost_or_stolen,
        right_em_no_problem: formData.right_em_no_problem,
        // 3B - Earmold services (RIGHT)
        right_em_retubed_unplugged: formData.right_em_retubed_unplugged,
        right_em_modified: formData.right_em_modified,
        right_em_fit_stock: formData.right_em_fit_stock,
        right_em_took_new_impression: formData.right_em_took_new_impression,
        right_em_refit_custom: formData.right_em_refit_custom,

        counseling_provided: formData.counseling_provided,
        batteries_provided_13: formData.batteries_provided_13,
        batteries_provided_675: formData.batteries_provided_675,
        comment: formData.aftercare_comments,
      }

      // Save aftercare assessment
      await api.post("/api/phase3/aftercare-assessment", payload, { headers })

      // Also create/update fitting_table using Phase2 controller if fitting info changed
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

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const aftercareTypes = ["Service Center", "School", "Phone"]
  const callAttemptOptions = ["1st Call", "2nd Call", "3rd Call", "Patient Unreachable"]
  const medications = ["Antiseptic", "Analgesic", "Antifungal", "Antibiotic"]

  const completedSections = Object.values(sectionSuccess).filter(Boolean).length
  const totalSections = 4

  // clear phone_call_attempt when not Phone
  useEffect(() => {
    if (formData.type_of_aftercare !== "Phone" && formData.phone_call_attempt) {
      handleInputChange("phone_call_attempt", "")
    }
  }, [formData.type_of_aftercare])

  // clear power change reason when the checkbox is unchecked
  useEffect(() => {
    if (!formData.left_ha_power_change_needed && formData.left_ha_power_change_reason) {
      handleInputChange("left_ha_power_change_reason", "")
    }
  }, [formData.left_ha_power_change_needed])

  useEffect(() => {
    if (!formData.right_ha_power_change_needed && formData.right_ha_power_change_reason) {
      handleInputChange("right_ha_power_change_reason", "")
    }
  }, [formData.right_ha_power_change_needed])

  const formatVal = (v: any) => {
    if (v === null || v === undefined) return "-"
    const s = String(v).trim()
    return s === "" ? "-" : s
  }

  return (
    <div className="p-6">
      {/* Phase 2 requirement dialog */}
      {needPhase2DialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-red-600">Phase 2 Required</h2>
            <p className="text-sm text-gray-700">
              This patient does not have a Phase 2 record yet. Complete Phase 2 forms before proceeding to Phase 3.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-gray-300"
                onClick={() => setNeedPhase2DialogOpen(false)}
              >
                Close
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setNeedPhase2DialogOpen(false)
                  const pid = getPatientId()
                  const shf = formData.shf_id
                  // Navigate to Phase 2 form (adjust path if different)
                  window.location.href = `/forms/phase2?patient_id=${pid}&shf_id=${encodeURIComponent(shf)}`
                }}
              >
                Go to Phase 2 Form
              </Button>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-2xl font-semibold mb-4">Phase 3 Forms</h1>

      {/* Progress Indicator */}
      <div className="px-6 py-3 bg-blue-25 border-b mb-6">
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

      <ScrollArea className="h-[calc(100vh-180px)] w-full pr-4">
        <div className="space-y-6">
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
                <div className="space-y-2">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-green-800 font-semibold">✓ Patient Found</p>
                  </div>
                  {phase2CheckLoading && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                      Checking Phase 2 record...
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 1. REGISTRATION */}
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
            <CardContent className="space-y-6 pt-6">
              {/* Basic Information - 3 columns */}
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange("country", e.target.value)}
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase3_aftercare_city" className="text-sm font-medium">Phase 3 AfterCare City</Label>
                  <Input
                    id="phase3_aftercare_city"
                    value={formData.phase3_aftercare_city}
                    onChange={(e) => handleInputChange("phase3_aftercare_city", e.target.value)}
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase3_date" className="text-sm font-medium">Date</Label>
                  <Input
                    id="phase3_date"
                    type="date"
                    value={formData.phase3_date}
                    onChange={(e) => handleInputChange("phase3_date", e.target.value)}
                    required
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
              </div>

              {/* Personal Details - 5 columns */}
              <div className="grid grid-cols-5 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="surname" className="text-sm font-medium">Last Name</Label>
                  <Input
                    id="surname"
                    value={formData.surname}
                    onChange={(e) => handleInputChange("surname", e.target.value)}
                    required
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm font-medium">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    required
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleInputChange("gender", value)}
                  >
                    <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-sm font-medium">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange("dob", e.target.value)}
                    required
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-sm font-medium">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    className="h-10 text-sm bg-white border-gray-300"
                    readOnly
                  />
                </div>
              </div>

              {/* Contact & AfterCare Information - 4 columns */}
              <div className="grid grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="mobile_phone_number" className="text-sm font-medium">Mobile Phone Number</Label>
                  <Input
                    id="mobile_phone_number"
                    value={formData.mobile_phone_number}
                    onChange={(e) => handleInputChange("mobile_phone_number", e.target.value)}
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>

                {/* Type of AfterCare + dynamic field side-by-side */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Type of AfterCare</Label>
                  <div className="grid grid-cols-2 gap-2 items-end">
                    {/* AfterCare Type select (left) */}
                    <Select
                      value={formData.type_of_aftercare}
                      onValueChange={(value) => handleInputChange("type_of_aftercare", value)}
                    >
                      <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {aftercareTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Dynamic field (right) shown beside the select */}
                    {formData.type_of_aftercare === "Service Center" && (
                      <Input
                        id="service_center_name"
                        placeholder="Service Center Name"
                        value={formData.service_center_or_school_name}
                        onChange={(e) => handleInputChange("service_center_or_school_name", e.target.value)}
                        className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                      />
                    )}
                    {formData.type_of_aftercare === "School" && (
                      <Input
                        id="school_name"
                        placeholder="School Name"
                        value={formData.service_center_or_school_name}
                        onChange={(e) => handleInputChange("service_center_or_school_name", e.target.value)}
                        className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                      />
                    )}
                    {formData.type_of_aftercare === "Phone" && (
                      <Select
                        value={formData.phone_call_attempt}
                        onValueChange={(value) => handleInputChange("phone_call_attempt", value)}
                      >
                        <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white">
                          <SelectValue placeholder="Call attempt" />
                        </SelectTrigger>
                        <SelectContent>
                          {callAttemptOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Highest Level of Education</Label>
                  <Select
                    value={formData.highest_level_education}
                    onValueChange={(value) => handleInputChange("highest_level_education", value)}
                  >
                    <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white">
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
                  <Label className="text-sm font-medium">Employment Status</Label>
                  <Select
                    value={formData.employment_status}
                    onValueChange={(value) => handleInputChange("employment_status", value)}
                  >
                    <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white">
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

              <Separator />

              {/* Additional Information - 2 columns */}
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 bg-white transition-colors">
                  <Checkbox
                    id="return_visit_custom_earmold_repair"
                    checked={formData.return_visit_custom_earmold_repair}
                    onCheckedChange={(checked) =>
                      handleInputChange("return_visit_custom_earmold_repair", checked)
                    }
                  />
                  <Label className="font-medium cursor-pointer text-sm" htmlFor="return_visit_custom_earmold_repair">
                    <strong>Return Visit</strong> (Patient is picking up custom earmold(s) and/or repaired hearing aid)
                  </Label>
                </div>

                <div className="space-y-3 p-4 rounded-lg border border-gray-200 ">
                  <Label className="font-medium block text-sm">
                    Are you having a problem with your hearing aid(s) and/or earmold(s)?
                  </Label>
                  <RadioGroup
                    className="flex space-x-4 pt-2"
                    value={formData.problem_with_hearing_aid_earmold}
                    onValueChange={(value) =>
                      handleInputChange("problem_with_hearing_aid_earmold", value)
                    }
                  >
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors">
                      <RadioGroupItem value="Yes" id="problem_yes" />
                      <Label htmlFor="problem_yes" className="cursor-pointer text-sm">Yes</Label>
                    </div>
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors">
                      <RadioGroupItem value="No" id="problem_no" />
                      <Label htmlFor="problem_no" className="cursor-pointer text-sm">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Current Fitting Information table */}
              <div className="space-y-4 pt-4">
                <Label className="font-semibold text-medium">Current Fitting Information:</Label>
                <table className="w-full border-collapse border border-gray-400 text-sm">
                  <thead className="bg-gray-100">
                    <tr className="border-b border-gray-400">
                      <th className="font-bold border-r border-gray-400 p-2 text-black h-auto text-left w-[10%]">RESULTS</th>
                      <th className="font-bold border-r border-gray-400 p-2 text-black w-[20%]">POWER LEVEL</th>
                      <th className="font-bold border-r border-gray-400 p-2 text-black w-[20%]">VOLUME</th>
                      <th className="font-bold border-r border-gray-400 p-2 text-black w-[20%]">MODEL</th>
                      <th className="font-bold border-r border-gray-400 p-2 text-black w-[10%]">BATTERY</th>
                      <th className="font-bold p-2 text-black w-[25%]">EARMOLD</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-400">
                      <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">LEFT EAR</td>
                      <td className="border-r border-gray-400 p-2 text-center">{formatVal(formData.left_power_level)}</td>
                      <td className="border-r border-gray-400 p-2 text-center">{formatVal(formData.left_volume)}</td>
                      <td className="border-r border-gray-400 p-2 text-center">{formatVal(formData.left_model)}</td>
                      <td className="border-r border-gray-400 p-2 text-center">
                        {formatVal(formData.left_battery_type)}
                        {formData.left_battery_type === "13" && battery13Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery13Available}</div>
                        )}
                        {formData.left_battery_type === "675" && battery675Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery675Available}</div>
                        )}
                      </td>
                      <td className="p-2 text-center">{formatVal(formData.left_earmold_type)}</td>
                    </tr>
                    <tr>
                      <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">RIGHT EAR</td>
                      <td className="border-r border-gray-400 p-2 text-center">{formatVal(formData.right_power_level)}</td>
                      <td className="border-r border-gray-400 p-2 text-center">{formatVal(formData.right_volume)}</td>
                      <td className="border-r border-gray-400 p-2 text-center">{formatVal(formData.right_model)}</td>
                      <td className="border-r border-gray-400 p-2 text-center">
                        {formatVal(formData.right_battery_type)}
                        {formData.right_battery_type === "13" && battery13Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery13Available}</div>
                        )}
                        {formData.right_battery_type === "675" && battery675Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery675Available}</div>
                        )}
                      </td>
                      <td className="p-2 text-center">{formatVal(formData.right_earmold_type)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Status Messages */}
              {sectionErrors.registration && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-red-700 text-sm">{sectionErrors.registration}</p>
                </div>
              )}

              {sectionSuccess.registration && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-green-700 text-sm font-medium">Registration saved successfully.</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => ensurePatientAndRun(submitRegistrationSection)}
                  disabled={
                    !getPatientId() ||
                    savingSection === "registration" ||
                    hasPhase2Record === false ||
                    hasPhase2Record === null
                  }
                  className="h-10 px-6 text-sm bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSection === "registration" ? "Saving..." : "Save Registration"}
                </Button>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray transition-colors shadow-sm">
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
                        className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
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
                        className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
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

              <div className="grid grid-cols-2 gap-4">
                {/* Column 1: Combined Medical Recommendation, Medication Given, and Ears Clear for Assessment */}
                <div className="space-y-4 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray transition-colors shadow-sm">
                  {/* Medical Recommendation */}
                  <div className="flex items-center space-x-7 border-b pb-2">
                    <Label className="text-sm font-semibold block text-gray-700">
                      Medical Recommendation
                    </Label>
                    <RadioGroup
                      className="flex space-x-4"
                      value={formData.medical_recommendation}
                      onValueChange={(value) => handleInputChange("medical_recommendation", value)}
                    >
                      {["Left", "Right"].map((side) => (
                        <div
                          key={`med_reco_${side.toLowerCase()}`}
                          className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                        >
                          <RadioGroupItem value={side} id={`med_reco_${side.toLowerCase()}`} />
                          <Label
                            htmlFor={`med_reco_${side.toLowerCase()}`}
                            className="text-sm cursor-pointer text-gray-800"
                          >
                            {side}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Combined Medication Given and Ears Clear for Assessment */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Medication Given */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold block text-gray-700">
                        Medication Given
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {medications.map((med) => (
                          <div
                            key={`med_${med}`}
                            className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors w-fit"
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
                            <Label
                              htmlFor={`med_${med}`}
                              className="text-sm cursor-pointer text-gray-800 whitespace-nowrap"
                            >
                              {med}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ears Clear for Assessment */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold block text-gray-700">
                        Ears Clear for Assessment?
                      </Label>
                      <div className="space-y-4">
                        {/* Right Ear - One Line */}
                        <div className="flex items-center justify-between">
                          <Label className="text-sm min-w-16">Right Ear</Label>
                          <RadioGroup
                            className="flex space-x-3"
                            value={formData.right_ear_clear_for_assessment}
                            onValueChange={(value) =>
                              handleInputChange("right_ear_clear_for_assessment", value)
                            }
                          >
                            {["Yes", "No"].map((val) => (
                              <div
                                key={`right_clear_${val.toLowerCase()}`}
                                className="bg-white flex items-center space-x-1 p-2 rounded-lg border border-gray-200 transition-colors"
                              >
                                <RadioGroupItem value={val} id={`right_ear_clear_${val.toLowerCase()}`} />
                                <Label htmlFor={`right_ear_clear_${val.toLowerCase()}`} className="text-sm cursor-pointer text-gray-800">{val}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>

                        {/* Left Ear - One Line */}
                        <div className="flex items-center justify-between">
                          <Label className="text-sm min-w-16">Left Ear</Label>
                          <RadioGroup
                            className="flex space-x-3"
                            value={formData.left_ear_clear_for_assessment}
                            onValueChange={(value) =>
                              handleInputChange("left_ear_clear_for_assessment", value)
                            }
                          >
                            {["Yes", "No"].map((val) => (
                              <div
                                key={`left_clear_${val.toLowerCase()}`}
                                className="bg-white flex items-center space-x-1 p-2 rounded-lg border border-gray-200 transition-colors"
                              >
                                <RadioGroupItem value={val} id={`left_ear_clear_${val.toLowerCase()}`} />
                                <Label htmlFor={`left_ear_clear_${val.toLowerCase()}`} className="text-sm cursor-pointer text-gray-800">{val}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Comments */}
                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray transition-colors shadow-sm">
                  <Label htmlFor="otoscopy_comments" className="text-sm font-medium text-gray-700">
                    Comments
                  </Label>
                  <Textarea
                    id="otoscopy_comments"
                    value={formData.otoscopy_comments}
                    onChange={(e) => handleInputChange("otoscopy_comments", e.target.value)}
                    className="bg-white h-40 w-full resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    placeholder="Enter additional notes here..."
                  />
                </div>
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
                    disabled={
                      !getPatientId() ||
                      savingSection === "earScreening" ||
                      hasPhase2Record === false ||
                      hasPhase2Record === null
                    }
                    onClick={() => ensurePatientAndRun(submitEarScreeningSection)}
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
                3. Aftercare Assessment
                {sectionSuccess.assessmentServices && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                {sectionErrors.assessmentServices && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* 3A label */}
              <div className="text-sm font-semibold text-gray-700">3A. AfterCare Assessment - Evaluation</div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                  <h4 className="font-semibold mb-3 border-b pb-2">Left Ear</h4>
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
                          <div key={key}>
                            <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-gray transition-colors">
                              <Checkbox
                                id={key}
                                checked={formData[key as keyof typeof formData] as boolean}
                                onCheckedChange={(checked) => handleInputChange(key, checked)}
                              />
                              <Label htmlFor={key} className="text-sm cursor-pointer">
                                {label}
                              </Label>
                            </div>

                            {key === "left_ha_power_change_needed" && formData.left_ha_power_change_needed && (
                              <div className="pl-6 pt-2">
                                <Label className="text-sm font-medium">If power change needed, reason</Label>
                                <RadioGroup
                                  className="flex space-x-3 mt-2"
                                  value={formData.left_ha_power_change_reason}
                                  onValueChange={(value) => handleInputChange("left_ha_power_change_reason", value)}
                                >
                                  <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                                    <RadioGroupItem value="Too Low" id="left_power_too_low" />
                                    <Label htmlFor="left_power_too_low" className="cursor-pointer text-sm">Too Low</Label>
                                  </div>
                                  <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                                    <RadioGroupItem value="Too Loud" id="left_power_too_loud" />
                                    <Label htmlFor="left_power_too_loud" className="cursor-pointer text-sm">Too Loud</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                            )}
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
                          { key: "left_em_damaged_or_tubing_cracked", label: "Earmold is Damaged or Tubing is Cracked" },
                          { key: "left_em_lost_or_stolen", label: "Earmold was Lost or Stolen" },
                          { key: "left_em_no_problem", label: "No Problem with Earmold" },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
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
                          <div key={key}>
                            <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                              <Checkbox
                                id={key}
                                checked={formData[key as keyof typeof formData] as boolean}
                                onCheckedChange={(checked) => handleInputChange(key, checked)}
                              />
                              <Label htmlFor={key} className="text-sm cursor-pointer">
                                {label}
                              </Label>
                            </div>

                            {key === "right_ha_power_change_needed" && formData.right_ha_power_change_needed && (
                              <div className="pl-6 pt-2">
                                <Label className="text-sm font-medium">If power change needed, reason</Label>
                                <RadioGroup
                                  className="flex space-x-3 mt-2"
                                  value={formData.right_ha_power_change_reason}
                                  onValueChange={(value) => handleInputChange("right_ha_power_change_reason", value)}
                                >
                                  <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                                    <RadioGroupItem value="Too Low" id="right_power_too_low" />
                                    <Label htmlFor="right_power_too_low" className="cursor-pointer text-sm">Too Low</Label>
                                  </div>
                                  <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                                    <RadioGroupItem value="Too Loud" id="right_power_too_loud" />
                                    <Label htmlFor="right_power_too_loud" className="cursor-pointer text-sm">Too Loud</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                            )}
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
                          { key: "right_em_damaged_or_tubing_cracked", label: "Earmold is Damaged or Tubing is Cracked" },
                          { key: "right_em_lost_or_stolen", label: "Earmold was Lost or Stolen" },
                          { key: "right_em_no_problem", label: "No Problem with Earmold" },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
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

              <Separator className="my-6" />

              {/* 3B label */}
              <div className="text-sm font-semibold text-gray-700">3B. AfterCare Assessment - Services Completed</div>

              {/* 3B content (merged, unwrapped) */}
              <div className="grid grid-cols-2 gap-6">
                {/* LEFT EAR SERVICES */}
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                  <h4 className="font-semibold mb-3 border-b pb-2">Left Ear</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Hearing Aid</h5>
                      <div className="space-y-2">
                        {[
                          { key: "left_ha_tested_wfa_demo", label: "Tested with WFA® Fitting Method using Demo Hearing Aids" },
                          { key: "left_ha_sent_for_repair_replacement", label: "Sent for Repair/Replacement" },
                          { key: "left_ha_refit_new", label: "Refit with New Hearing Aid" },
                          { key: "left_ha_not_benefiting", label: "Patient Not Benefiting from Hearing Aid" },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                            <Checkbox
                              id={key}
                              checked={formData[key as keyof typeof formData] as boolean}
                              onCheckedChange={(checked) => handleInputChange(key, checked)}
                            />
                            <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium mb-2">Earmold</h5>
                      <div className="space-y-2">
                        {[
                          { key: "left_em_retubed_unplugged", label: "Retubed/Unplugged" },
                          { key: "left_em_modified", label: "Modified" },
                          { key: "left_em_fit_stock", label: "Fit Stock Mold" },
                          { key: "left_em_took_new_impression", label: "Took New Ear Impression" },
                          { key: "left_em_refit_custom", label: "Refit Custom Mold" },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                            <Checkbox
                              id={key}
                              checked={formData[key as keyof typeof formData] as boolean}
                              onCheckedChange={(checked) => handleInputChange(key, checked)}
                            />
                            <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT EAR SERVICES */}
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-25">
                  <h4 className="font-semibold mb-3 border-b pb-2">Right Ear</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Hearing Aid</h5>
                      <div className="space-y-2">
                        {[
                          { key: "right_ha_tested_wfa_demo", label: "Tested with WFA® Fitting Method using Demo Hearing Aids" },
                          { key: "right_ha_sent_for_repair_replacement", label: "Sent for Repair/Replacement" },
                          { key: "right_ha_refit_new", label: "Refit with New Hearing Aid" },
                          { key: "right_ha_not_benefiting", label: "Patient Not Benefiting from Hearing Aid" },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                            <Checkbox
                              id={key}
                              checked={formData[key as keyof typeof formData] as boolean}
                              onCheckedChange={(checked) => handleInputChange(key, checked)}
                            />
                            <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium mb-2">Earmold</h5>
                      <div className="space-y-2">
                        {[
                          { key: "right_em_retubed_unplugged", label: "Retubed/Unplugged" },
                          { key: "right_em_modified", label: "Modified" },
                          { key: "right_em_fit_stock", label: "Fit Stock Mold" },
                          { key: "right_em_took_new_impression", label: "Took New Ear Impression" },
                          { key: "right_em_refit_custom", label: "Refit Custom Mold" },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200">
                            <Checkbox
                              id={key}
                              checked={formData[key as keyof typeof formData] as boolean}
                              onCheckedChange={(checked) => handleInputChange(key, checked)}
                            />
                            <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* General Services */}
              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">General Services</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className={`flex items-center space-x-3 p-4 rounded-lg border border-gray-200 transition-colors bg-white text-sm ${formData.show_batteries_provided ? 'col-span-1' : ''}`}>
                      <Checkbox
                        id="counseling_provided"
                        checked={formData.counseling_provided}
                        onCheckedChange={(checked) => handleInputChange("counseling_provided", checked)}
                      />
                      <Label htmlFor="counseling_provided" className="text-sm cursor-pointer">Counseling</Label>
                    </div>

                    <div className={`p-4 rounded-lg border border-gray-200 bg-white text-sm transition-all duration-200 ${formData.show_batteries_provided ? 'col-span-2' : 'col-span-1'}`}>
                      <div className="bg-white flex items-center space-x-2">
                        <Checkbox
                          id="toggle_batteries_provided"
                          checked={formData.show_batteries_provided}
                          onCheckedChange={(checked) => handleInputChange("show_batteries_provided", checked)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="toggle_batteries_provided" className="text-sm cursor-pointer">
                          Batteries Provided
                        </Label>
                      </div>

                      {formData.show_batteries_provided && (
                        <div className="grid grid-cols-2 gap-4 pl-6 pt-3">
                          <div className="space-y-2">
                            <Label htmlFor="batteries_provided_13" className="text-sm">Battery 13</Label>
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
                            {battery13Available !== null && (
                              <p className="text-xs text-muted-foreground mt-1">Available: {battery13Available}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="batteries_provided_675" className="text-sm">Battery 675</Label>
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
                            {battery675Available !== null && (
                              <p className="text-xs text-muted-foreground mt-1">Available: {battery675Available}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`bg-white flex items-center space-x-3 p-4 rounded-lg border border-gray-200 transition-colors text-sm ${formData.show_batteries_provided ? 'col-span-1' : ''}`}>
                      <Checkbox
                        id="refer_to_aftercare_center"
                        checked={formData.refer_to_aftercare_center}
                        onCheckedChange={(checked) => handleInputChange("refer_to_aftercare_center", checked)}
                      />
                      <Label htmlFor="refer_to_aftercare_center" className="text-sm cursor-pointer">Refer to AfterCare Service Center</Label>
                    </div>

                    <div className={`flex items-center space-x-3 p-4 rounded-lg border border-gray-200 transition-colors bg-white text-sm ${formData.show_batteries_provided ? 'col-span-1' : ''}`}>
                      <Checkbox
                        id="refer_to_next_phase2_mission"
                        checked={formData.refer_to_next_phase2_mission}
                        onCheckedChange={(checked) => handleInputChange("refer_to_next_phase2_mission", checked)}
                      />
                      <Label htmlFor="refer_to_next_phase2_mission" className="text-sm cursor-pointer">Refer to next Phase 2 Mission</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Updated Fitting Info */}
              <div className="space-y-4 pt-4">
                <Label className="font-medium text-lg">Updated Hearing Aid and/or Earmold Information:</Label>
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
                    <tr className="border-b border-gray-400">
                      <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">LEFT EAR</td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_left_power_level"
                          value={formData.left_power_level}
                          onChange={(e) => handleInputChange("left_power_level", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="e.g., P, MP"
                        />
                      </td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_left_volume"
                          value={formData.left_volume}
                          onChange={(e) => handleInputChange("left_volume", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="e.g., 2"
                        />
                      </td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_left_model"
                          value={formData.left_model}
                          onChange={(e) => handleInputChange("left_model", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="Model"
                        />
                      </td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_left_battery"
                          value={formData.left_battery_type}
                          onChange={(e) => handleInputChange("left_battery_type", e.target.value)}
                          className="h-9 text-sm text-center"
                          placeholder="13 / 675"
                        />
                        {formData.left_battery_type === "13" && battery13Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery13Available}</div>
                        )}
                        {formData.left_battery_type === "675" && battery675Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery675Available}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          id="updated_left_earmold"
                          value={formData.left_earmold_type}
                          onChange={(e) => handleInputChange("left_earmold_type", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="Earmold type"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">RIGHT EAR</td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_right_power_level"
                          value={formData.right_power_level}
                          onChange={(e) => handleInputChange("right_power_level", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="e.g., P, MP"
                        />
                      </td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_right_volume"
                          value={formData.right_volume}
                          onChange={(e) => handleInputChange("right_volume", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="e.g., 2"
                        />
                      </td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_right_model"
                          value={formData.right_model}
                          onChange={(e) => handleInputChange("right_model", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="Model"
                        />
                      </td>
                      <td className="border-r border-gray-400 p-2">
                        <Input
                          id="updated_right_battery"
                          value={formData.right_battery_type}
                          onChange={(e) => handleInputChange("right_battery_type", e.target.value)}
                          className="h-9 text-sm text-center"
                          placeholder="13 / 675"
                        />
                        {formData.right_battery_type === "13" && battery13Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery13Available}</div>
                        )}
                        {formData.right_battery_type === "675" && battery675Available !== null && (
                          <div className="text-[11px] text-gray-500 mt-1">Stock: {battery675Available}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          id="updated_right_earmold"
                          value={formData.right_earmold_type}
                          onChange={(e) => handleInputChange("right_earmold_type", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="Earmold type"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-500">
                  Tip: These updates will be saved to the fitting table when you click “Save Aftercare Assessment”.
                </p>
              </div>

              {/* Comments */}
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray transition-colors shadow-sm">
                <div className="space-y-3">
                  <p className="text-medium text-gray-700">
                    If you are sending in a hearing aid for repair or replacement ensure that you retest the patient using the WFA® Fitting Method with your demo kit. Add the new fitting information above.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="aftercare_comments" className="font-semibold text-gray-700">Comments</Label>
                    <Textarea
                      id="aftercare_comments"
                      value={formData.aftercare_comments}
                      onChange={(e) => handleInputChange("aftercare_comments", e.target.value)}
                      className="bg-white h-40 w-full resize-none overflow-y-auto focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="Enter additional notes here..."
                    />
                  </div>
                </div>
              </div>

              {/* Status + Save */}
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

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => ensurePatientAndRun(submitAftercareSection)}
                  disabled={
                    savingSection === "assessmentServices" ||
                    hasPhase2Record === false ||
                    hasPhase2Record === null
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="space-y-2 p-4 rounded-lg border border-gray-200">
                  <Label className="text-sm font-semibold block">When wearing your hearing aid(s) how satisfied are you with your hearing? (18+)</Label>
                  <RadioGroup
                    className="grid grid-cols-1 gap-3 mt-4"
                    value={formData.satisfaction_with_hearing}
                    onValueChange={(value) => handleInputChange("satisfaction_with_hearing", value)}
                  >
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 bg-white transition-colors">
                      <RadioGroupItem value="Unsatisfied" id="final_unsatisfied" />
                      <Label htmlFor="final_unsatisfied" className="text-sm cursor-pointer">Unsatisfied</Label>
                    </div>
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 bg-white transition-colors">
                      <RadioGroupItem value="Undecided" id="final_undecided" />
                      <Label htmlFor="final_undecided" className="text-sm cursor-pointer">Undecided</Label>
                    </div>
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 bg-white transition-colors">
                      <RadioGroupItem value="Satisfied" id="final_satisfied" />
                      <Label htmlFor="final_satisfied" className="text-sm cursor-pointer">Satisfied</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2 p-4 rounded-lg border border-gray-200">
                  <Label className="text-sm font-semibold block">
                    When wearing your hearing aid(s) do you ask people to repeat themselves or speak louder in
                    conversation? (18+)
                  </Label>
                  <RadioGroup
                    className="grid grid-cols-1 gap-3 mt-4"
                    value={formData.asks_to_repeat_or_speak_louder}
                    onValueChange={(value) => handleInputChange("asks_to_repeat_or_speak_louder", value)}
                  >
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 bg-white transition-colors">
                      <RadioGroupItem value="No" id="repeat_no" />
                      <Label htmlFor="repeat_no" className="text-sm cursor-pointer">No</Label>
                    </div>
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 bg-white transition-colors">
                      <RadioGroupItem value="Sometimes" id="repeat_sometimes" />
                      <Label htmlFor="repeat_sometimes" className="text-sm cursor-pointer">Sometimes</Label>
                    </div>
                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 bg-white transition-colors">
                      <RadioGroupItem value="Yes" id="repeat_yes" />
                      <Label htmlFor="repeat_yes" className="text-sm cursor-pointer">Yes</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2 p-4 rounded-lg border border-gray-200">
                  <Label htmlFor="shf_notes" className="text-sm font-semibold">Notes from SHF</Label>
                  <Textarea
                    id="shf_notes"
                    value={formData.shf_notes}
                    onChange={(e) => handleInputChange("shf_notes", e.target.value)}
                    className="bg-white h-40 w-full resize-none overflow-y-auto focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
                    placeholder="Enter notes from SHF here..."
                  />
                </div>
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
                  onClick={() => ensurePatientAndRun(submitFinalQCSection)}
                  disabled={
                    savingSection === "finalQC" ||
                    hasPhase2Record === false ||
                    hasPhase2Record === null
                  }
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSection === "finalQC" ? "Saving..." : "Save Final QC"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
