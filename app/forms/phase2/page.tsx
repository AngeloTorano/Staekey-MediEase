"use client"

import axios from "axios"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

import { Search, Ear, Volume2, ClipboardCheck, CheckCircle2, AlertCircle, Battery, User } from "lucide-react"
import { decryptObject } from "@/utils/decrypt" // ADD (adjust path if no alias)
import { useSearchParams } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area" // ADD

interface PatientSearchResponse {
  patient_id: number
}

const initialFormState = {
  shf_id: "",
  patient_id: 0,

  // Phase 2 Registration
  registration_date: "",
  city: "",
  patient_type: "",

  // Ear Screening
  ears_clear_for_fitting: "",

  // Otoscopy - Left Ear
  left_wax: false,
  left_infection: false,
  left_perforation: false,
  left_tinnitus: false,
  left_atresia: false,
  left_implant: false,
  left_other: false,

  // Otoscopy - Right Ear
  right_wax: false,
  right_infection: false,
  right_perforation: false,
  right_tinnitus: false,
  right_atresia: false,
  right_implant: false,
  right_other: false,

  medical_recommendation: "",
  medication_antibiotic: false,
  medication_analgesic: false,
  medication_antiseptic: false,
  medication_antifungal: false,
  left_ear_clear_for_fitting: "",
  right_ear_clear_for_fitting: "",
  comments: "",

  // Hearing Screening
  screening_method: "",
  left_ear_result: "",
  right_ear_result: "",
  hearing_satisfaction_18_plus_pass: "",

  // Fitting Table
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

  // Fitting
  num_hearing_aids_fit: 0,
  special_device: "",
  normal_hearing_left: false,
  normal_hearing_right: false,
  distortion_left: false,
  distortion_right: false,
  implant_left: false,
  implant_right: false,
  recruitment_left: false,
  recruitment_right: false,
  no_response_left: false,
  no_response_right: false,
  other_left: false,
  other_right: false,
  fitting_comments: "",
  patient_clear_for_counseling: false,

  // Counseling
  received_aftercare_info: false,
  trained_as_student_ambassador: false,

  // Final QC
  batteries_13: null,
  batteries_675: null,
  final_satisfaction: "",
  final_comments: "",
}

type FormData = typeof initialFormState

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
  withCredentials: true,
})

const debugLog = (section: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString()
}

// ADD: normalize dates for <input type="date">
const safeDateString = (v: any): string => {
  if (!v) return ""
  if (typeof v === "string") {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
    if (v.includes("T")) return v.split("T")[0]
    return v.slice(0, 10)
  }
  try {
    const d = v instanceof Date ? v : new Date(Number(v))
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  } catch {
    return ""
  }
}

const safeNumberId = (v: any): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const normalizeBool = (v: any): boolean => {
  if (v === null || v === undefined) return false
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v === 1
  const s = String(v).toLowerCase().trim()
  return s === "1" || s === "true" || s === "yes" || s === "t"
}

// ADD: parse Postgres text[] (e.g. "{Antibiotic,Analgesic}")
const parsePgTextArray = (v: any): string[] => {
  if (!v) return []
  if (Array.isArray(v)) return v.filter(Boolean).map(String)
  if (typeof v === "string") {
    const s = v.trim()
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1)
      if (!inner) return []
      return inner.split(",").map(x => x.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean)
    }
    return s.split(",").map(x => x.trim()).filter(Boolean)
  }
  return []
}

const extractPhase2RegIdFromResponse = (res: any): number | null => {
  const candidates = [
    res?.data?.data?.phase2_reg_id,
    res?.data?.data?.phase2_reg_id ?? res?.data?.data?.phase2_reg_id, // duplicate safe
    res?.data?.phase2_reg_id,
    res?.phase2_reg_id,
    res?.data?.data?.registration?.phase2_reg_id,
    res?.headers?.["x-phase2-reg-id"],
  ]
  for (const c of candidates) {
    const n = safeNumberId(c)
    if (n) return n
  }
  return null
}

const fetchLatestPhase2RegId = async (patientId: number) => {
  if (!patientId) return null
  try {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token")
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    // FIX: use phases combined endpoint
    const res = await api.get(`/api/phases/combined/${patientId}`, { headers })
    const id = extractPhase2RegIdFromResponse(res)
    if (id) {
      rememberPhase2RegId(patientId, id)
      return id
    }
  } catch (e) {
    console.warn("fetchLatestPhase2RegId failed", e)
  }
  return null
}

const PHASE2_REG_KEY = (pid: number) => `phase2_reg_id:${pid}`
const rememberPhase2RegId = (pid: number, id: number) => {
  try {
    localStorage.setItem(PHASE2_REG_KEY(pid), String(id))
  } catch { }
}
const loadPhase2RegId = (pid: number): number | null => {
  try {
    return safeNumberId(localStorage.getItem(PHASE2_REG_KEY(pid)))
  } catch {
    return null
  }
}

export default function Phase2FormsPage() {
  const [formData, setFormData] = useState<FormData>({ ...initialFormState })
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null)
  const [patientFound, setPatientFound] = useState<boolean>(false)
  const initialRef = useRef<FormData>({ ...initialFormState })
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({})
  const [phase2RegId, setPhase2RegId] = useState<number | null>(null)
  const [locks, setLocks] = useState<any>(null);

  // ADD: track fitting table id to avoid throwing stub
  const [fittingTableId, setFittingTableId] = useState<number | null>(null)

  // ADD: per-section IDs to enable updates
  const [ids, setIds] = useState<{
    earScreeningId: number | null
    hearingScreeningId: number | null
    fittingId: number | null
    counselingId: number | null
    finalQcId: number | null
  }>({ earScreeningId: null, hearingScreeningId: null, fittingId: null, counselingId: null, finalQcId: null })

  // Battery availability state
  const [battery13Available, setBattery13Available] = useState<number | null>(null)
  const [battery675Available, setBattery675Available] = useState<number | null>(null)

  const searchParams = useSearchParams()
  const autoShf = searchParams.get("shf")
  const [autoSearched, setAutoSearched] = useState(false)

  // Fetch battery availability from inventory (best-effort matching)
  const fetchBatteryAvailability = async () => {
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("token") || localStorage.getItem("token")
          : null
      const res = await api.get("/api/supplies", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: { limit: 1000 },
      })

      // Handle optional encryption (align with Phase 3 logic)
      let payload: any = null
      if (res.data?.encrypted_data) {
        try {
          payload = decryptObject(res.data.encrypted_data)
        } catch {
          payload = null
        }
      } else {
        payload = res.data?.data ?? res.data
      }

      const rows =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.supplies)
            ? payload.supplies
            : Array.isArray(payload?.rows)
              ? payload.rows
              : []

      const findByToken = (tok: string) =>
        rows.find(
          (r: any) =>
            (r.item_code && String(r.item_code).toLowerCase().includes(tok)) ||
            (r.item_name && String(r.item_name).toLowerCase().includes(tok))
        )

      const match13 = findByToken("13")
      const match675 = findByToken("675")

      const getStock = (r: any) =>
        !r
          ? null
          : Number(
            r.current_stock_level ??
            r.current_stock ??
            r.stock_level ??
            r.quantity ??
            null
          ) || 0

      setBattery13Available(getStock(match13))
      setBattery675Available(getStock(match675))
    } catch (err) {
      console.warn("fetchBatteryAvailability failed", err)
      setBattery13Available(null)
      setBattery675Available(null)
    }
  }

  useEffect(() => {
    fetchBatteryAvailability()
  }, [])

  const reasonOptions = ["Normal Hearing", "Distortion", "Implant", "Recruitment", "No Response", "Other"]
  const medications = ["Antibiotic", "Analgesic", "Antiseptic", "Antifungal"]

  // When ears_clear_for_fitting becomes "Yes", hide otoscopy section
  useEffect(() => {
    if (formData.ears_clear_for_fitting === "Yes") {
      debugLog("AUTO_CLEAR_OTOSCOPY", "Ears clear for fitting — clearing otoscopy fields")
      setFormData((prev) => ({
        ...prev,
        left_wax: false,
        right_wax: false,
        left_infection: false,
        right_infection: false,
        left_perforation: false,
        right_perforation: false,
        left_tinnitus: false,
        right_tinnitus: false,
        left_atresia: false,
        right_atresia: false,
        left_implant: false,
        right_implant: false,
        left_other: false,
        right_other: false,
        medical_recommendation: "",
        medication_antibiotic: false,
        medication_analgesic: false,
        medication_antiseptic: false,
        medication_antifungal: false,
        comments: "",
        // ALSO clear hearing screening fields so Section 3 state doesn't persist
        screening_method: "",
        left_ear_result: "",
        right_ear_result: "",
        hearing_satisfaction_18_plus_pass: "",
      }))
    }
  }, [formData.ears_clear_for_fitting])

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

  // ADDED: reset all UI state before hydrating a new patient's data
  const resetPhase2ForNewSearch = (shf: string) => {
    const cleared = { ...initialFormState, shf_id: shf }
    setFormData(cleared)
    initialRef.current = cleared
    setSectionErrors({})
    setSectionSuccess({})
    setPhase2RegId(null)
    setLocks(null)
    setSearchedPatientId(null)
    setPatientFound(false)
  }

  const searchPatient = async () => {
    debugLog("PATIENT_SEARCH", "Starting patient search", { shf_id: formData.shf_id })

    if (!formData.shf_id.trim()) {
      setSearchError("Please enter an SHF ID")
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    // NEW: clear current form state first
    const shf = formData.shf_id.trim()
    resetPhase2ForNewSearch(shf)

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await api.get<PatientSearchResponse>(
        `/api/patients/shf?shf=${encodeURIComponent(shf)}`,
        { headers },
      )

      if (response.data && typeof response.data.patient_id === "number") {
        const pid = response.data.patient_id
        setSearchedPatientId(pid)
        setFormData((prev) => ({ ...prev, patient_id: pid }))
        setPatientFound(true)
        setSearchError(null)
        debugLog("PATIENT_SEARCH", "Patient found successfully", { patient_id: pid })

        const restoredId = loadPhase2RegId(pid)
        let finalId = restoredId || await fetchLatestPhase2RegId(pid)

        if (finalId) {
          setPhase2RegId(finalId)
          debugLog("PATIENT_SEARCH", "Loaded phase2_reg_id", { phase2_reg_id: finalId })
          await loadPhase2Data(pid, finalId)
        } else {
          await loadPhase2Data(pid)
        }
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

  const isFormDirty = () => {
    return JSON.stringify(formData) !== JSON.stringify(initialRef.current)
  }

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

const getPatientId = () => {
    const patientId = searchedPatientId || formData.patient_id
    debugLog("GET_PATIENT_ID", "Final patient ID selected", { patientId, isValid: patientId && patientId > 0 })
    return patientId
}
const isLocked = (section: string): boolean => false

// Small helpers to mark sections as recently saved and show transient UI feedback
const savedTimestampsRef = useRef<Record<string, number>>({})
const markSaved = (section: string) => {
  try { savedTimestampsRef.current[section] = Date.now() } catch {}
  setSectionSuccess(prev => {
    const next = { ...prev, [section]: true }
    const sectionKeys = ["registration","earScreening","hearingScreening","fitting","counseling","finalQC"]
    if (sectionKeys.every(k => next[k])) setAllSectionsSavedAt(Date.now())
    return next
  })
}
const isRecentlySaved = (section: string) => {
  const t = savedTimestampsRef.current[section]
  return Boolean(t && Date.now() - t < 15000)
}

// ADD global completion timestamp
const [allSectionsSavedAt, setAllSectionsSavedAt] = useState<number | null>(null)
const isAllRecentlySaved = () =>
  allSectionsSavedAt !== null && Date.now() - allSectionsSavedAt < 15000

  const submitRegistrationSection = async () => {
    const patientId = getPatientId()
    debugLog("REGISTRATION", "Starting registration submission", { patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        registration: "Patient ID required.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        registration_date: formData.registration_date,
        city: formData.city || null,
        patient_type: formData.patient_type || null,
      }

      let res
      if (phase2RegId) {
        res = await api.put(`/api/phase2/registration/${phase2RegId}`, payload, { headers })
      } else {
        res = await api.post("/api/phase2/registration", payload, { headers })
        const newRegId = extractPhase2RegIdFromResponse(res)
        if (newRegId) {
          setPhase2RegId(newRegId)
          rememberPhase2RegId(patientId, newRegId)
        }
      }

      setSectionSuccess((prev) => ({ ...prev, registration: true }))
      setSectionErrors((prev) => ({ ...prev, registration: "" }))
      markSaved("registration") // ADD
    } catch (error: any) {
      const message = parseError(error)
      debugLog("REGISTRATION", "Submission error", { message })
      setSectionErrors((prev) => ({
        ...prev,
        registration: message || "Failed to submit registration",
      }))
    }
  }

  const submitEarScreeningSection = async () => {
    const patientId = getPatientId()
    debugLog("EAR_SCREENING", "Starting ear screening submission", { patientId })
    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        earScreening: "Patient ID required.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const earsClearValue = formData.ears_clear_for_fitting === "Yes" ? "Yes" : "No"

      // Base mapped payload (booleans -> will be transformed on backend)
      const basePayload = {
        patient_id: patientId,
        phase2_reg_id: await ensurePhase2RegId(patientId),
        ears_clear: earsClearValue,
        left_wax: !!formData.left_wax,
        right_wax: !!formData.right_wax,
        left_infection: !!formData.left_infection,
        right_infection: !!formData.right_infection,
        left_perforation: !!formData.left_perforation,
        right_perforation: !!formData.right_perforation,
        left_tinnitus: !!formData.left_tinnitus,
        right_tinnitus: !!formData.right_tinnitus,
        left_atresia: !!formData.left_atresia,
        right_atresia: !!formData.right_atresia,
        left_implant: !!formData.left_implant,
        right_implant: !!formData.right_implant,
        left_other: !!formData.left_other,
        right_other: !!formData.right_other,
        medical_recommendation: formData.medical_recommendation || null,
        medication_antibiotic: !!formData.medication_antibiotic,
        medication_analgesic: !!formData.medication_analgesic,
        medication_antiseptic: !!formData.medication_antiseptic,
        medication_antifungal: !!formData.medication_antifungal,
        left_ear_clear_for_fitting: formData.left_ear_clear_for_fitting || null,
        right_ear_clear_for_fitting: formData.right_ear_clear_for_fitting || null,
        comments: formData.comments || null,
      }

      // REMOVE alias fields for update/create (only ears_clear retained)
      let res
      if (ids.earScreeningId) {
        res = await api.put(`/api/phase2/ear-screening/${ids.earScreeningId}`, basePayload, { headers })
      } else {
        res = await api.post("/api/phase2/ear-screening", basePayload, { headers })
        const created = res?.data?.data ?? res?.data
        if (created?.ear_screening_id) {
          setIds(prev => ({ ...prev, earScreeningId: created.ear_screening_id }))
        }
      }

      setSectionErrors(p => ({ ...p, earScreening: "" }))
      markSaved("earScreening")
    } catch (error: any) {
      const message = parseError(error)
      setSectionErrors((prev) => ({
        ...prev,
        earScreening: message || "Failed to submit ear screening",
      }))
    }
  }

  const submitHearingScreeningSection = async () => {
    const patientId = getPatientId()
    debugLog("HEARING_SCREENING", "Starting hearing screening submission", { patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        hearingScreening: "Patient ID required.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        phase2_reg_id: await ensurePhase2RegId(patientId),
        screening_method: formData.screening_method || null,
        left_ear_result: formData.left_ear_result || null,
        right_ear_result: formData.right_ear_result || null,
        hearing_satisfaction_18_plus_pass: formData.hearing_satisfaction_18_plus_pass || null,
      }

      let res
      if (ids.hearingScreeningId) {
        res = await api.put(`/api/phase2/hearing-screening/${ids.hearingScreeningId}`, payload, { headers })
      } else {
        res = await api.post("/api/phase2/hearing-screening", payload, { headers })
        const created = res?.data?.data ?? res?.data
        if (created?.hearing_screen_id) {
          setIds(prev => ({ ...prev, hearingScreeningId: created.hearing_screen_id }))
        }
      }

      setSectionSuccess((prev) => ({ ...prev, hearingScreening: true }))
      setSectionErrors((prev) => ({ ...prev, hearingScreening: "" }))
      markSaved("hearingScreening") // ADD
    } catch (error: any) {
      const message = parseError(error)
      setSectionErrors((prev) => ({
        ...prev,
        hearingScreening: message || "Failed to submit hearing screening",
      }))
    }
  }

  const submitFittingSection = async () => {
    const patientId = getPatientId()
    debugLog("FITTING", "Starting fitting submission", { patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        fitting: "Patient ID required.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // Submit fitting table (update when id exists)
      const fittingTablePayload = {
        patient_id: patientId,
        phase2_reg_id: await ensurePhase2RegId(patientId),
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
        await api.put(`/api/phase2/fitting-table/${fittingTableId}`, fittingTablePayload, { headers })
      } else {
        const ftRes = await api.post("/api/phase2/fitting-table", fittingTablePayload, { headers })
        const created = ftRes?.data?.data ?? ftRes?.data
        if (created?.fitting_table_id) setFittingTableId(created.fitting_table_id)
      }

      // Build fitting payload including ear-reason left/right flags so backend can map to integers
      const fittingPayload = {
        phase2_reg_id: await ensurePhase2RegId(patientId),
        number_of_hearing_aid: formData.num_hearing_aids_fit || 0,
        special_device: formData.special_device || null,
        normal_hearing_left: Boolean(formData.normal_hearing_left),
        normal_hearing_right: Boolean(formData.normal_hearing_right),
        distortion_left: Boolean(formData.distortion_left),
        distortion_right: Boolean(formData.distortion_right),
        implant_left: Boolean(formData.implant_left),
        implant_right: Boolean(formData.implant_right),
        recruitment_left: Boolean(formData.recruitment_left),
        recruitment_right: Boolean(formData.recruitment_right),
        no_response_left: Boolean(formData.no_response_left),
        no_response_right: Boolean(formData.no_response_right),
        other_left: Boolean(formData.other_left),
        other_right: Boolean(formData.other_right),
        comment: formData.fitting_comments,
        clear_for_counseling: formData.patient_clear_for_counseling || false,
      }

      let res
      if (ids.fittingId) {
        res = await api.put(`/api/phase2/fitting/${ids.fittingId}`, { patient_id: patientId, ...fittingPayload }, { headers })
      } else {
        res = await api.post("/api/phase2/fitting", { patient_id: patientId, ...fittingPayload }, { headers })
        const created = res?.data?.data ?? res?.data
        if (created?.fitting_id) setIds(prev => ({ ...prev, fittingId: created.fitting_id }))
      }

      setSectionSuccess((prev) => ({ ...prev, fitting: true }))
      setSectionErrors((prev) => ({ ...prev, fitting: "" }))
      markSaved("fitting") // ADD
    } catch (error: any) {
      const message = parseError(error)
      setSectionErrors((prev) => ({
        ...prev,
        fitting: message || "Failed to submit fitting",
      }))
    }
  }

  const submitCounselingSection = async () => {
    const patientId = getPatientId()
    debugLog("COUNSELING", "Starting counseling submission", { patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        counseling: "Patient ID required.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        phase2_reg_id: await ensurePhase2RegId(patientId), // ADDED
        received_aftercare_information: formData.received_aftercare_info || false,
        trained_as_student_ambassador: formData.trained_as_student_ambassador || false,
      }

      let res
      if (ids.counselingId) {
        res = await api.put(`/api/phase2/counseling/${ids.counselingId}`, payload, { headers })
      } else {
        res = await api.post("/api/phase2/counseling", payload, { headers })
        const created = res?.data?.data ?? res?.data
        if (created?.counseling_id) setIds(prev => ({ ...prev, counselingId: created.counseling_id }))
      }

      setSectionSuccess((prev) => ({ ...prev, counseling: true }))
      setSectionErrors((prev) => ({ ...prev, counseling: "" }))
      markSaved("counseling") // ADD
    } catch (error: any) {
      const message = parseError(error)
      setSectionErrors((prev) => ({
        ...prev,
        counseling: message || "Failed to submit counseling",
      }))
    }
  }

  const submitFinalQCSection = async () => {
    const patientId = getPatientId()
    debugLog("FINAL_QC", "Starting final QC submission", { patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        finalQC: "Patient ID required.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        phase2_reg_id: await ensurePhase2RegId(patientId), // ADDED ensure linkage
        batteries_provided_13: formData.batteries_13 || 0,
        batteries_provided_675: formData.batteries_675 || 0,
        hearing_aid_satisfaction_18_plus: formData.final_satisfaction || null,
        qc_comments: formData.final_comments || null,
      }

      let res
      if (ids.finalQcId) {
        res = await api.put(`/api/phase2/final-qc/${ids.finalQcId}`, payload, { headers })
      } else {
        res = await api.post("/api/phase2/final-qc", payload, { headers })
        const created = res?.data?.data ?? res?.data
        if (created?.final_qc_id) setIds(prev => ({ ...prev, finalQcId: created.final_qc_id }))
      }

      setSectionSuccess((prev) => ({ ...prev, finalQC: true }))
      setSectionErrors((prev) => ({ ...prev, finalQC: "" }))
      markSaved("finalQC") // ADD
      try { await fetchBatteryAvailability() } catch {}
    } catch (error: any) {
      const message = parseError(error)
      setSectionErrors((prev) => ({
        ...prev,
        finalQC: message || "Failed to submit final QC",
      }))
    }
  }

  const completedSections = Object.values(sectionSuccess).filter(Boolean).length
  const totalSections = 6
  const showOtoscopy = formData.ears_clear_for_fitting !== "Yes"

  // REPLACE the mistaken usages of setPhase2RegId with a helper
  const ensurePhase2RegId = async (patientId: number): Promise<number | null> => {
    if (phase2RegId) return phase2RegId
    const latest = await fetchLatestPhase2RegId(patientId)
    if (latest) setPhase2RegId(latest)
    return latest || null
  }

  // ADD: load existing phase2 data (autofill)
  const loadPhase2Data = async (patientId: number, givenRegId?: number | null) => {
    if (!patientId) return
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const url =
        `/api/phases/combined/${patientId}` +
        (givenRegId ? `?phase2_reg_id=${givenRegId}` : "")
      const res = await api.get(url, { headers })
      const raw = res.data?.encrypted_data
        ? decryptObject(res.data.encrypted_data)
        : (res.data?.data ?? res.data)

      const p2 = raw?.phase2
      if (!p2) return

      // registration
      if (p2.registration) {
        const r = p2.registration
        setFormData(prev => ({
          ...prev,
          registration_date: safeDateString(r.registration_date || r.reg_date || r.date || r.created_at) || prev.registration_date,
          city: r.city || prev.city,
          patient_type: r.patient_type || prev.patient_type,
          patient_id: patientId
        }))
        setSectionSuccess(s => ({ ...s, registration: true }))
        setPhase2RegId(r.phase2_reg_id || givenRegId || phase2RegId)
      }

      if (Array.isArray(p2.earScreening) && p2.earScreening.length) {
        const es = p2.earScreening[0]
        const meds = parsePgTextArray(es.medication_given)
        setFormData(prev => ({
          ...prev,
          ears_clear_for_fitting: es.ears_clear_for_fitting || es.ears_clear || prev.ears_clear_for_fitting,
          left_wax: es.otc_wax === 1 || es.otc_wax === 3,
          right_wax: es.otc_wax === 2 || es.otc_wax === 3,
          left_infection: es.otc_infection === 1 || es.otc_infection === 3,
          right_infection: es.otc_infection === 2 || es.otc_infection === 3,
          left_perforation: es.otc_perforation === 1 || es.otc_perforation === 3,
          right_perforation: es.otc_perforation === 2 || es.otc_perforation === 3,
          left_tinnitus: es.otc_tinnitus === 1 || es.otc_tinnitus === 3,
          right_tinnitus: es.otc_tinnitus === 2 || es.otc_tinnitus === 3,
          left_atresia: es.otc_atresia === 1 || es.otc_atresia === 3,
          right_atresia: es.otc_atresia === 2 || es.otc_atresia === 3,
          left_implant: es.otc_implant === 1 || es.otc_implant === 3,
          right_implant: es.otc_implant === 2 || es.otc_implant === 3,
          left_other: es.otc_other === 1 || es.otc_other === 3,
          right_other: es.otc_other === 2 || es.otc_other === 3,
          medical_recommendation: es.medical_recommendation || prev.medical_recommendation,
          // Map medication_given[] -> checkbox flags (fallback to legacy boolean columns)
          medication_antibiotic: meds.includes("Antibiotic") || normalizeBool(es.medication_antibiotic),
          medication_analgesic: meds.includes("Analgesic") || normalizeBool(es.medication_analgesic),
          medication_antiseptic: meds.includes("Antiseptic") || normalizeBool(es.medication_antiseptic),
          medication_antifungal: meds.includes("Antifungal") || normalizeBool(es.medication_antifungal),
          left_ear_clear_for_fitting: es.left_ear_clear_for_fitting || prev.left_ear_clear_for_fitting,
          right_ear_clear_for_fitting: es.right_ear_clear_for_fitting || prev.right_ear_clear_for_fitting,
          comments: es.comments || prev.comments
        }))
        setSectionSuccess(s => ({ ...s, earScreening: true }))
        setIds(prev => ({ ...prev, earScreeningId: es.ear_screening_id ?? prev.earScreeningId }))
      }

      // hearing screening
      if (p2.hearingScreening) {
        const hs = p2.hearingScreening
        setFormData(prev => ({
          ...prev,
          screening_method: hs.screening_method || prev.screening_method,
          left_ear_result: hs.left_ear_result || prev.left_ear_result,
          right_ear_result: hs.right_ear_result || prev.right_ear_result,
          hearing_satisfaction_18_plus_pass: hs.hearing_satisfaction_18_plus_pass || prev.hearing_satisfaction_18_plus_pass
        }))
        setSectionSuccess(s => ({ ...s, hearingScreening: true }))
        setIds(prev => ({ ...prev, hearingScreeningId: hs.hearing_screen_id ?? prev.hearingScreeningId }))
      }

      // fitting table
      if (p2.fittingTable) {
        const ft = p2.fittingTable
        setFormData(prev => ({
          ...prev,
          left_power_level: ft.fitting_left_power_level || prev.left_power_level,
          left_volume: ft.fitting_left_volume || prev.left_volume,
          left_model: ft.fitting_left_model || prev.left_model,
          left_battery_type: ft.fitting_left_battery || prev.left_battery_type,
          left_earmold_type: ft.fitting_left_earmold || prev.left_earmold_type,
          right_power_level: ft.fitting_right_power_level || prev.right_power_level,
          right_volume: ft.fitting_right_volume || prev.right_volume,
          right_model: ft.fitting_right_model || prev.right_model,
          right_battery_type: ft.fitting_right_battery || prev.right_battery_type,
          right_earmold_type: ft.fitting_right_earmold || prev.right_earmold_type
        }))
        setSectionSuccess(s => ({ ...s, fitting: s.fitting || false }))
        setFittingTableId(ft.fitting_table_id ?? null) // <-- now safe
      }

      // fitting
      if (p2.fitting) {
        const f = p2.fitting
        const decode = (v: any) => {
          const n = Number(v)
          return {
            left: n === 1 || n === 3,
            right: n === 2 || n === 3,
          }
        }
        const normal = decode(f.normal_hearing)
        const distortion = decode(f.distortion)
        const implant = decode(f.implant)
        const recruitment = decode(f.recruitment)
        const noResp = decode(f.no_response)
        const other = decode(f.other)

        setFormData(prev => ({
          ...prev,
          num_hearing_aids_fit: f.number_of_hearing_aid ?? prev.num_hearing_aids_fit,
            special_device: f.special_device || prev.special_device,
            normal_hearing_left: normal.left,
            normal_hearing_right: normal.right,
            distortion_left: distortion.left,
            distortion_right: distortion.right,
            implant_left: implant.left,
            implant_right: implant.right,
            recruitment_left: recruitment.left,
            recruitment_right: recruitment.right,
            no_response_left: noResp.left,
            no_response_right: noResp.right,
            other_left: other.left,
            other_right: other.right,
            fitting_comments: f.comment || prev.fitting_comments,
            patient_clear_for_counseling: !!f.clear_for_counseling
        }))
        setSectionSuccess(s => ({ ...s, fitting: true }))
        setIds(prev => ({ ...prev, fittingId: f.fitting_id ?? prev.fittingId }))
      }

      // counseling
      if (p2.counseling) {
        const c = p2.counseling
        setFormData(prev => ({
          ...prev,
          received_aftercare_info: !!c.received_aftercare_information,
          trained_as_student_ambassador: !!c.trained_as_student_ambassador
        }))
        setSectionSuccess(s => ({ ...s, counseling: true }))
        setIds(prev => ({ ...prev, counselingId: c.counseling_id ?? prev.counselingId }))
      }

      // final QC
      if (p2.finalQC) {
        const qc = p2.finalQC
        setFormData(prev => ({
          ...prev,
          batteries_13: qc.batteries_provided_13 ?? prev.batteries_13,
          batteries_675: qc.batteries_provided_675 ?? prev.batteries_675,
          final_satisfaction: qc.hearing_aid_satisfaction_18_plus || prev.final_satisfaction,
          final_comments: qc.qc_comments || prev.final_comments
        }))
        setSectionSuccess(s => ({ ...s, finalQC: true }))
        setIds(prev => ({ ...prev, finalQcId: qc.final_qc_id ?? prev.finalQcId }))
      }

      // locks
      if (raw?.locks?.phase2) {
        setLocks(raw.locks.phase2)
      }
    } catch (e) {
      console.warn("loadPhase2Data failed", e)
    }
  }

  // ADD effect to refetch when reg id changes
  useEffect(() => {
    const pid = getPatientId()
    if (pid && phase2RegId) {
      loadPhase2Data(pid, phase2RegId)
    }
  }, [phase2RegId])

  useEffect(() => {
    if (autoShf && !autoSearched) {
      setFormData(prev => ({ ...prev, shf_id: autoShf }))
    }
  }, [autoShf, autoSearched])

  useEffect(() => {
    if (autoShf && formData.shf_id === autoShf && !autoSearched) {
      searchPatient()
      setAutoSearched(true)
    }
  }, [formData.shf_id, autoShf, autoSearched])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <User className="h-6 w-6 text-primary" />
          <div></div>
            <h1 className="text-3xl font-bold tracking-tight">Phase 2 Form</h1>
          </div>
        </div>

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

      {/* REPLACED scroll container with ScrollArea to match Phase 1 */}
      <ScrollArea className="h-[calc(100vh-200px)] w-full pr-4">
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
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 1 - Registration */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                1. Registration
                {sectionSuccess.registration && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                {sectionErrors.registration && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registration_date" className="text-sm font-medium">
                    Registration Date
                  </Label>
                  <div className="relative">
                    <Input
                      id="registration_date"
                      type="date"
                      value={formData.registration_date}
                      onChange={(e) => handleInputChange("registration_date", e.target.value)}
                      className="flex h-10 text-sm bg-white border-gray-300 focus:bg-white pl-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input
                    id="city"
                    placeholder="City/Village"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                  />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient_type" className="text-sm font-medium">
                      Patient Type
                    </Label>
                <Select
                  value={formData.patient_type}
                  onValueChange={(value) => handleInputChange("patient_type", value)}
                >
                  <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white data-[placeholder]:text-gray-500">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Registered Phase 1">Registered Phase 1</SelectItem>
                  </SelectContent>
                </Select>
  
                {isRecentlySaved("registration") && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-green-700 text-sm font-medium">✓ Registration saved successfully!</p>
                  </div>
                )}
  
                {sectionErrors.registration && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-red-700 text-sm">{sectionErrors.registration}</p>
                  </div>
                )}
  
                <div className="flex justify-end">
                  <Button
                    onClick={submitRegistrationSection}
                    className="bg-blue-600 hover:bg-blue-700 px-6"
                    disabled={!patientFound && !formData.patient_id}
                  >
                    {phase2RegId ? "Update Registration" : "Save Registration"}
                  </Button>
                </div>
              </div>
            </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Phase 2 Otoscopy */}
          <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                <Ear className="h-5 w-5 text-green-600" />
                2. Ear Screening & Otoscopy
                {(sectionSuccess.earScreening || sectionSuccess.otoscopy) && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />
                )}
                {(sectionErrors.earScreening || sectionErrors.otoscopy) && (
                  <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6 space-y-8">
              {/* --- Section 2A: Ear Screening --- */}
              <h3 className="text-base font-semibold flex items-center gap-2">
                2A. Ear Screening
              </h3>
              <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-50 transition-colors shadow-sm">

                <Label className="text-sm font-medium block text-gray-700">
                  Ears Clear for Fitting (If yes, skip to section 4A)
                </Label>
                <RadioGroup
                  className="flex space-x-8 pt-2"
                  value={formData.ears_clear_for_fitting}
                  onValueChange={(value) => handleInputChange("ears_clear_for_fitting", value)}
                >
                  {["Yes", "No"].map((val) => (
                    <div
                      key={val}
                      className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200  transition-colors"
                    >
                      <RadioGroupItem value={val} id={`clear_fitting_${val.toLowerCase()}`} />
                      <Label
                        htmlFor={`clear_fitting_${val.toLowerCase()}`}
                        className="text-sm font-medium cursor-pointer text-gray-800"
                      >
                        {val}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* --- Section 2B: Otoscopy --- */}
              {showOtoscopy && (
                <>
                  <Separator className="my-6" />
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    2B. Otoscopy
                  </h3>

                  {/* Ear Findings Section */}
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
                            key={key}
                            className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
                          >
                            <Checkbox
                              id={`left-${key}`}
                              checked={(formData as any)[`left_${key}`] || false}
                              onCheckedChange={(checked) =>
                                handleInputChange(`left_${key}` as keyof FormData, checked)
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
                            key={key}
                            className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
                          >
                            <Checkbox
                              id={`right-${key}`}
                              checked={(formData as any)[`right_${key}`] || false}
                              onCheckedChange={(checked) =>
                                handleInputChange(`right_${key}` as keyof FormData, checked)
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
                    {/* Column 1: Combined Medical Recommendation, Medication Given, and Ears Clear for Fitting */}
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
                              key={side}
                              className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                            >
                              <RadioGroupItem value={side} id={`med_${side.toLowerCase()}`} />
                              <Label
                                htmlFor={`med_${side.toLowerCase()}`}
                                className="text-sm cursor-pointer text-gray-800"
                              >
                                {side}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      {/* Combined Medication Given and Ears Clear for Fitting */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Medication Given */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold block text-gray-700">
                            Medication Given
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            {medications.map((med) => (
                              <div
                                key={med}
                                className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors w-fit"
                              >
                                <Checkbox
                                  id={`med-${med.toLowerCase()}`}
                                  checked={(formData as any)[`medication_${med.toLowerCase()}`] || false}
                                  onCheckedChange={(checked) =>
                                    handleInputChange(`medication_${med.toLowerCase()}` as keyof FormData, checked)
                                  }
                                />
                                <Label
                                  htmlFor={`med-${med.toLowerCase()}`}
                                  className="text-sm cursor-pointer text-gray-800 whitespace-nowrap"
                                >
                                  {med}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ears Clear for Fitting */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold block text-gray-700">
                            Ears Clear for Fitting?
                          </Label>
                          <div className="space-y-4">
                            {/* Right Ear - One Line */}
                            <div className="flex items-center justify-between">
                              <Label className="text-sm min-w-16">Right Ear</Label>
                              <RadioGroup
                                className="flex space-x-3"
                                value={formData.right_ear_clear_for_fitting}
                                onValueChange={(value) =>
                                  handleInputChange("right_ear_clear_for_fitting", value)
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
                                value={formData.left_ear_clear_for_fitting}
                                onValueChange={(value) =>
                                  handleInputChange("left_ear_clear_for_fitting", value)
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
                      <Label htmlFor="comments" className="text-sm font-medium text-gray-700">
                        Comments
                      </Label>
                      <Textarea
                        id="comments"
                        value={formData.comments}
                        onChange={(e) => handleInputChange("comments", e.target.value)}
                        className="bg-white h-40 w-full resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        placeholder="Enter additional notes here..."
                      />
                    </div>
                  </div>
                </>
              )}

              {/* --- Validation & Status Messages --- */}
              {(sectionErrors.earScreening || sectionErrors.otoscopy) && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-red-700 text-sm">
                    {sectionErrors.earScreening || sectionErrors.otoscopy}
                  </p>
                </div>
              )}
              {isRecentlySaved("earScreening") && (  /* CHANGED */
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-green-700 text-sm font-medium">
                    ✓ Ear Screening & Otoscopy saved successfully!
                  </p>
                </div>
              )}

              {/* --- Save Button --- */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={submitEarScreeningSection}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  {ids.earScreeningId ? "Update Ear Screening & Otoscopy" : "Save Ear Screening & Otoscopy"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 - Hearing Screening */}
          {showOtoscopy && (
            <Card>
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-purple-600" />
                  3. Hearing Screening
                  {sectionSuccess.hearingScreening && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                  {sectionErrors.hearingScreening && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-4 gap-6">
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="text-sm font-medium block">Screening Method (ONLY for Walk-in patients)</Label>
                    <RadioGroup
                      value={formData.screening_method}
                      onValueChange={(value) => handleInputChange("screening_method", value)}
                      className="space-y-3 pt-2"
                    >
                      <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Audiogram" id="audiogram" />
                        <Label htmlFor="audiogram" className="text-sm font-medium cursor-pointer">
                          Audiogram
                        </Label>
                      </div>
                      <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="WFA® Voice Test" id="voice_test" />
                        <Label htmlFor="voice_test" className="text-sm font-medium cursor-pointer">
                          WFA® Voice Test
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-25">
                    <Label className="text-sm font-medium block">Left Ear Result</Label>
                    <RadioGroup
                      value={formData.left_ear_result}
                      onValueChange={(value) => handleInputChange("left_ear_result", value)}
                      className="space-y-3 pt-2"
                    >
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Pass" id="left-pass" />
                        <Label htmlFor="left-pass" className="text-sm cursor-pointer">
                          Pass
                        </Label>
                      </div>
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Fail" id="left-fail" />
                        <Label htmlFor="left-fail" className="text-sm cursor-pointer">
                          Fail
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="text-sm font-medium block">Right Ear Result</Label>
                    <RadioGroup
                      value={formData.right_ear_result}
                      onValueChange={(value) => handleInputChange("right_ear_result", value)}
                      className="space-y-3 pt-2"
                    >
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Pass" id="right-pass" />
                        <Label htmlFor="right-pass" className="text-sm cursor-pointer">
                          Pass
                        </Label>
                      </div>
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Fail" id="right-fail" />
                        <Label htmlFor="right-fail" className="text-sm cursor-pointer">
                          Fail
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="text-sm font-medium block">Satisfaction with Hearing (18+ if passes)</Label>
                    <RadioGroup
                      value={formData.hearing_satisfaction_18_plus_pass}
                      onValueChange={(value) => handleInputChange("hearing_satisfaction_18_plus_pass", value)}
                      className="space-y-3 pt-2"
                    >
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Unsatisfied" id="unsat" />
                        <Label htmlFor="unsat" className="text-sm cursor-pointer">
                          Unsatisfied
                        </Label>
                      </div>
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Undecided" id="undec" />
                        <Label htmlFor="undec" className="text-sm cursor-pointer">
                          Undecided
                        </Label>
                      </div>
                      <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Satisfied" id="sat" />
                        <Label htmlFor="sat" className="text-sm cursor-pointer">
                          Satisfied
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                {sectionErrors.hearingScreening && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-red-700 text-sm">{sectionErrors.hearingScreening}</p>
                  </div>
                )}
                {isRecentlySaved("hearingScreening") && (  /* CHANGED */
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-green-700 text-sm font-medium">✓ Hearing Screening saved successfully!</p>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={submitHearingScreeningSection}
                    className="h-10 px-6 text-sm bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors"
                  >
                    {ids.hearingScreeningId ? "Update Hearing Screening" : "Save Hearing Screening"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 4 - Fitting (will appear immediately if "Yes" was selected) */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-orange-600" />
                4. Fitting
                {sectionSuccess.fitting && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                {sectionErrors.fitting && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <CardTitle className="text-md text-gray-700">4A. Hearing Aid Fitting</CardTitle>
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <thead className="bg-gray-100">
                  <tr className="border-b border-gray-400">
                    <th className="font-bold border-r border-gray-400 p-2 text-black h-auto text-left w-[10%]">
                      RESULTS
                    </th>
                    <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[20%]">
                      POWER LEVEL
                    </th>
                    <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[20%]">VOLUME</th>
                    <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[20%]">MODEL</th>
                    <th className="font-bold border-r border-gray-400 p-2 text-black h-auto w-[10%]">BATTERY</th>
                    <th className="font-bold p-2 text-black h-auto w-[25%]">EARMOLD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-400">
                    <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">LEFT EAR</td>
                    <td className="border-r border-gray-400 p-0">
                      <select
                        value={formData.left_power_level}
                        onChange={(e) => handleInputChange("left_power_level", e.target.value)}
                        className="h-8 w-full border-none text-center"
                      >
                        <option value="Low 1">Low 1</option>
                        <option value="Level 1">Level 1</option>
                        <option value="Level 2">Level 2</option>
                        <option value="Level 3">Level 3</option>
                        <option value="Level 4">Level 4</option>
                        <option value="Level 5">Level 5</option>
                        <option value="Level 6">Level 6</option>
                        <option value="Level 7">Level 7</option>
                        <option value="Level 8">Level 8</option>
                        <option value="Level 9">Level 9</option>
                        <option value="Level 10">Level 10</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="border-r border-gray-400 p-0">
                      <select
                        value={formData.left_volume}
                        onChange={(e) => handleInputChange("left_volume", e.target.value)}
                        className="h-8 w-full border-none text-center"
                      >
                        <option value="1">Volume 1</option>
                        <option value="1.5">Volume 1.5</option>
                        <option value="2">Volume 2</option>
                        <option value="2.5">Volume 2.5</option>
                        <option value="3">Volume 3</option>
                        <option value="3.5">Volume 3.5</option>
                        <option value="4">Volume 4</option>
                        <option value="other">Other</option>
                                           </select>

                    </td>
                    <td className="border-r border-gray-400 p-0">
                      <Input
                        value={formData.left_model}
                        onChange={(e) => handleInputChange("left_model", e.target.value)}
                        className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                          <Label htmlFor="left_batt_13" className="font-normal text-sm cursor-pointer">
                            13
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="675" id="left_batt_675" />
                          <Label htmlFor="left_batt_675" className="font-normal text-sm cursor-pointer">
                            675
                          </Label>
                        </div>
                      </RadioGroup>
                    </td>
                    <td className="p-0">
                      <select
                        value={formData.left_earmold_type}
                        onChange={(e) => handleInputChange("left_earmold_type", e.target.value)}
                        className="h-8 w-full border-none text-center focus-visible:ring-0 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                      >
                        <option value="">Select Mold Type</option>
                        <option value="Earmold 1">Earmold 1</option>
                        <option value="Earmold 2">Earmold 2</option>
                        <option value="Earmold 3">Earmold 3</option>
                        <option value="Earmold 4">Earmold 4</option>
                        <option value="Earmold 5">Earmold 5</option>
                        <option value="Earmold 6">Earmold 6</option>
                        <option value="Earmold 7">Earmold 7</option>
                        <option value="Earmold 8">Earmold 8</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold border-r border-gray-400 p-2 bg-gray-50">RIGHT EAR</td>
                    <td className="border-r border-gray-400 p-0">
                      <select
                        value={formData.right_power_level}
                        onChange={(e) => handleInputChange("right_power_level", e.target.value)}
                        className="h-8 w-full border-none text-center"
                      >
                        <option value="Low 1">Low 1</option>
                        <option value="Level 1">Level 1</option>
                        <option value="Level 2">Level 2</option>
                        <option value="Level 3">Level 3</option>
                        <option value="Level 4">Level 4</option>
                        <option value="Level 5">Level 5</option>
                        <option value="Level 6">Level 6</option>
                        <option value="Level 7">Level 7</option>
                        <option value="Level 8">Level 8</option>
                        <option value="Level 9">Level 9</option>
                        <option value="Level 10">Level 10</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="border-r border-gray-400 p-0">
                      <select
                        value={formData.right_volume}
                        onChange={(e) => handleInputChange("right_volume", e.target.value)}
                        className="h-8 w-full border-none text-center"
                      >
                        <option value="1">Volume 1</option>
                        <option value="1.5">Volume 1.5</option>
                        <option value="2">Volume 2</option>
                        <option value="2.5">Volume 2.5</option>
                        <option value="3">Volume 3</option>
                        <option value="3.5">Volume 3.5</option>
                        <option value="4">Volume 4</option>
                        <option value="other">Other</option>

                      </select>
                    </td>
                    <td className="border-r border-gray-400 p-0">
                      <Input
                        value={formData.right_model}
                        onChange={(e) => handleInputChange("right_model", e.target.value)}
                        className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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
                          <Label htmlFor="right_batt_13" className="font-normal text-sm cursor-pointer">
                            13
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <RadioGroupItem value="675" id="right_batt_675" />
                          <Label htmlFor="right_batt_675" className="font-normal text-sm cursor-pointer">
                            675
                          </Label>
                        </div>
                      </RadioGroup>
                    </td>
                    <td className="p-0">
                      <select
                        value={formData.right_earmold_type}
                        onChange={(e) => handleInputChange("right_earmold_type", e.target.value)}
                        className="h-8 w-full border-none text-center focus-visible:ring-0 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                      >
                        <option value="">Select Mold Type</option>
                        <option value="Earmold 1">Earmold 1</option>
                        <option value="Earmold 2">Earmold 2</option>
                        <option value="Earmold 3">Earmold 3</option>
                        <option value="Earmold 4">Earmold 4</option>
                        <option value="Earmold 5">Earmold 5</option>
                        <option value="Earmold 6">Earmold 6</option>
                        <option value="Earmold 7">Earmold 7</option>
                        <option value="Earmold 8">Earmold 8</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Top Section: Number of Hearing Aids + Special Devices */}
                  <div className="space-y-4 p-4 rounded-lg border border-gray-200 bg-gray-25">
                    <div className="flex items-center space-x-4 border-b pb-2">
                      <Label className="font-bold text-sm whitespace-nowrap">Number of Hearing Aids Fit:</Label>
                      <RadioGroup
                        value={formData.num_hearing_aids_fit.toString()}
                        onValueChange={(value) => handleInputChange("num_hearing_aids_fit", Number.parseInt(value))}
                        className="flex space-x-6"
                      >
                        {["0", "1", "2"].map((val) => (
                          <div className="flex items-center space-x-2" key={val}>
                            <RadioGroupItem value={val} id={`num_aids_${val}`} />
                            <Label htmlFor={`num_aids_${val}`} className="text-sm cursor-pointer">
                              {val}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <RadioGroup
                      value={formData.special_device}
                      onValueChange={(value) => handleInputChange("special_device", value)}
                      className="space-y-1 pt-2"
                    >
                      <Label className="font-bold block mb-1 text-sm">Special Device:</Label>
                      <div className="space-y-1 ml-4 pt-2">
                        <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                          <RadioGroupItem value="Bone Conductor" id="special_bone" />
                          <Label htmlFor="special_bone" className="text-sm font-medium cursor-pointer">
                            Bone Conductor (675 battery)
                          </Label>
                        </div>
                        <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                          <RadioGroupItem value="Body Aid" id="special_body" />
                          <Label htmlFor="special_body" className="text-sm font-medium cursor-pointer">
                            Body Aid (AA battery)
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-25">
                    <Label htmlFor="fitting_comments" className="text-sm font-medium">
                      Comments:
                    </Label>
                    <Textarea
                      id="fitting_comments"
                      value={formData.fitting_comments}
                      onChange={(e) => handleInputChange("fitting_comments", e.target.value)}
                      className="bg-white h-55 resize-none overflow-y-auto focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Right Column - Ear Reasons (only show when num_hearing_aids_fit !== 2) */}
                {formData.num_hearing_aids_fit !== 2 && (
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <p className="mb-4 text-sm font-bold border-b pb-2">
                      If patient received 1 or 0 hearing aids, select option below:
                    </p>

                    {/* Ear Findings Section - Displayed in a single flex column */}
                    <div className="flex flex-col gap-6 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray transition-colors shadow-sm">

                      {/* Left Ear Reasons Section */}
                      <div className="space-y-4 border-b pb-4 md:border-b-0 md:pb-0">
                        <h4 className="text-base font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                          <Ear className="h-4 w-4 text-emerald-600" /> Left Ear Reasons
                        </h4>

                        {/* Grid for Left Ear Checkboxes (2 columns wide) */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                          {reasonOptions.map((reason) => {
                            const reasonBaseKey = reason.toLowerCase().replace(/\s/g, "_")
                            const dataKey = (`${reasonBaseKey}_left`) as keyof FormData
                            return (
                              <div
                                key={reasonBaseKey}
                                className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                              >
                                <Checkbox
                                  id={String(dataKey)}
                                  checked={Boolean((formData as any)[dataKey])}
                                  onCheckedChange={(checked) => handleInputChange(dataKey, checked)}
                                  className="focus:ring-orange-500 text-orange-600"
                                />
                                <Label htmlFor={String(dataKey)} className="text-sm cursor-pointer text-gray-800">
                                  {reason}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Right Ear Reasons Section */}
                      <div className="space-y-4">
                        <h4 className="text-base font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                          <Ear className="h-4 w-4 text-emerald-600" /> Right Ear Reasons
                        </h4>

                        {/* Grid for Right Ear Checkboxes (2 columns wide) */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                          {reasonOptions.map((reason) => {
                            const reasonBaseKey = reason.toLowerCase().replace(/\s/g, "_")
                            const dataKey = (`${reasonBaseKey}_right`) as keyof FormData
                            return (
                              <div
                                key={reasonBaseKey}
                                className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                              >
                                <Checkbox
                                  id={String(dataKey)}
                                  checked={Boolean((formData as any)[dataKey])}
                                  onCheckedChange={(checked) => handleInputChange(dataKey, checked)}
                                  className="focus:ring-orange-500 text-orange-600"
                                />
                                <Label htmlFor={String(dataKey)} className="text-sm cursor-pointer text-gray-800">
                                  {reason}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator className="w-full my-4" />

              <div className="space-y-4">
                <CardTitle className="text-md text-gray-700">4B. Fitting Quality Control</CardTitle>
                <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-25">
                  <Label className="text-sm font-medium block mb-2">Patient clear for counseling:</Label>
                  <RadioGroup
                    className="flex space-x-8 pt-2"
                    value={formData.patient_clear_for_counseling ? "Yes" : "No"}
                    onValueChange={(value) => handleInputChange("patient_clear_for_counseling", value === "Yes")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="clear_yes" />
                      <Label htmlFor="clear_yes" className="text-sm cursor-pointer">
                        Yes
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="clear_no" />
                      <Label htmlFor="clear_no" className="text-sm cursor-pointer">
                        No
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {sectionErrors.fitting && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-red-700 text-sm">{sectionErrors.fitting}</p>
                </div>
              )}
              {isRecentlySaved("fitting") && (  /* CHANGED */
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-green-700 text-sm font-medium">✓ Fitting saved successfully!</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={submitFittingSection}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  {(ids.fittingId) ? "Update Fitting & Counselling" : "Save Fitting & Counselling"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Section 5 - Counseling */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                5. Counseling
                {sectionSuccess.counseling && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                {sectionErrors.counseling && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white flex items-center space-x-3 p-4 rounded-lg border border-gray-200 transition-colors">
                  <Checkbox
                    id="aftercare_info"
                    checked={formData.received_aftercare_info}
                    onCheckedChange={(checked) => handleInputChange("received_aftercare_info", checked)}
                  />

                  <Label htmlFor="aftercare_info" className="text-sm font-medium cursor-pointer">
                    Patient completed counseling and received AfterCare information
                  </Label>
                </div>

                <div className="bg-white flex items-center space-x-3 p-4 rounded-lg border border-gray-200 transition-colors">
                  <Checkbox
                    id="student_ambassador"
                    checked={formData.trained_as_student_ambassador}
                    onCheckedChange={(checked) => handleInputChange("trained_as_student_ambassador", checked)}
                  />
                  <Label htmlFor="student_ambassador" className="text-sm font-medium cursor-pointer">
                    Trained as Student Ambassador
                  </Label>
                </div>
              </div>

              {sectionErrors.counseling && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-red-700 text-sm">{sectionErrors.counseling}</p>
                </div>
              )}
              {isRecentlySaved("counseling") && (  /* CHANGED */
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-green-700 text-sm font-medium">✓ Counseling saved successfully!</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={submitCounselingSection}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  disabled={isLocked("counseling")}
                >
                  {ids.counselingId ? "Update Counseling" : "Save Counseling"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Section 6 - Final QC */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Battery className="h-5 w-5 text-gray-600" />
                6. Final Quality Control
                {sectionSuccess.finalQC && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                {sectionErrors.finalQC && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
              </CardTitle>
            </CardHeader>


            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Batteries Section */}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-gray-200 bg-gray-25">
                    <div className="space-y-2">
                      <Label htmlFor="batteries_13" className="text-sm font-medium">
                        Number of batteries provided (13)
                      </Label>
                      <Input
                        id="batteries_13"
                        type="number"
                        value={formData.batteries_13 ?? ""}
                        onChange={(e) =>
                          handleInputChange(
                            "batteries_13",
                            e.target.value === "" ? null : Number.parseInt(e.target.value)
                          )
                        }
                        className="bg-white"
                      />
                      {battery13Available !== null && (
                        <p className="text-xs text-muted-foreground mt-1">Available: {battery13Available}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batteries_675" className="text-sm font-medium">
                        Number of batteries provided (675)
                      </Label>
                      <Input
                        id="batteries_675"
                        type="number"
                        value={formData.batteries_675 ?? ""}
                        onChange={(e) =>
                          handleInputChange(
                            "batteries_675",
                            e.target.value === "" ? null : Number.parseInt(e.target.value)
                          )
                        }
                        className="bg-white"
                      />
                      {battery675Available !== null && (
                        <p className="text-xs text-muted-foreground mt-1">Available: {battery675Available}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="text-sm font-bold block text-sm border-b pb-2 mb-2">
                      (For patients 18 & older) When wearing your hearing aid(s) are you
                      satisfied with your hearing?
                    </Label>
                    <RadioGroup
                      className="flex space-x-8 pt-2"
                      value={formData.final_satisfaction}
                      onValueChange={(value) => handleInputChange("final_satisfaction", value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="final_unsat" />
                        <Label htmlFor="final_unsat" className="text-sm cursor-pointer">
                          No
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Undecided" id="final_undec" />
                        <Label htmlFor="final_undec" className="text-sm cursor-pointer">
                          Undecided
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="final_sat" />
                        <Label htmlFor="final_sat" className="text-sm cursor-pointer">
                          Yes
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-gray-200 bg-gray-25 h-full flex flex-col">
                  <div className="space-y-2 flex flex-col flex-1 min-h-0">
                    <Label htmlFor="final_comments" className="text-sm font-medium">
                      Comments
                    </Label>
                    <Textarea
                      id="final_comments"
                      value={formData.final_comments}
                      onChange={(e) => handleInputChange("final_comments", e.target.value)}
                      className="bg-white h-40 resize-none overflow-y-auto focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardContent className="space-y-6 pt-6">
              {sectionErrors.finalQC && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-red-700 text-sm">{sectionErrors.finalQC}</p>
                </div>
              )}
              {isRecentlySaved("finalQC") && (  /* CHANGED */
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-green-700 text-sm font-medium">✓ Final QC saved successfully!</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={submitFinalQCSection}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  disabled={isLocked("finalQC")}
                >
                  {ids.finalQcId ? "Update Final QC" : "Save Final QC"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
