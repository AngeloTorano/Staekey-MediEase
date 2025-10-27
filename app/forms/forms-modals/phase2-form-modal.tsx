"use client"

import axios from "axios"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Ear, Volume2, ClipboardCheck, CheckCircle2, AlertCircle, Battery } from "lucide-react"

interface Phase2FormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
  console.log(`[v0] [${timestamp}] [${section}] ${message}`, data || "")
}

export function Phase2FormModal({ open, onOpenChange }: Phase2FormModalProps) {
  const [formData, setFormData] = useState<FormData>({ ...initialFormState })
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null)
  const [patientFound, setPatientFound] = useState<boolean>(false)
  const initialRef = useRef<FormData>({ ...initialFormState })
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({})

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

      const response = await api.get<PatientSearchResponse>(
        `/api/patients/shf?shf=${encodeURIComponent(formData.shf_id.trim())}`,
        { headers },
      )

      if (response.data && typeof response.data.patient_id === "number") {
        setSearchedPatientId(response.data.patient_id)
        setFormData((prev) => ({ ...prev, patient_id: response.data.patient_id }))
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

  const submitRegistrationSection = async () => {
    const patientId = getPatientId()
    debugLog("REGISTRATION", "Starting registration submission", { patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        registration: "Patient ID required. Please search for the patient first.",
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

      debugLog("REGISTRATION", "Payload constructed", payload)

      await api.post("/api/phase2/registration", payload, { headers })

      setSectionSuccess((prev) => ({ ...prev, registration: true }))
      setSectionErrors((prev) => ({ ...prev, registration: "" }))
      debugLog("REGISTRATION", "Registration submitted successfully")
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
        earScreening: "Patient ID required. Please search for the patient first.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const medicationGiven = []
      if (formData.medication_antibiotic) medicationGiven.push("Antibiotic")
      if (formData.medication_analgesic) medicationGiven.push("Analgesic")
      if (formData.medication_antiseptic) medicationGiven.push("Antiseptic")
      if (formData.medication_antifungal) medicationGiven.push("Antifungal")

      const payload = {
        patient_id: patientId,
        ears_clear: formData.ears_clear_for_fitting === "Yes" ? "Yes" : "No",
        left_wax: Boolean(formData.left_wax),
        right_wax: Boolean(formData.right_wax),
        left_infection: Boolean(formData.left_infection),
        right_infection: Boolean(formData.right_infection),
        left_perforation: Boolean(formData.left_perforation),
        right_perforation: Boolean(formData.right_perforation),
        left_tinnitus: Boolean(formData.left_tinnitus),
        right_tinnitus: Boolean(formData.right_tinnitus),
        left_atresia: Boolean(formData.left_atresia),
        right_atresia: Boolean(formData.right_atresia),
        left_implant: Boolean(formData.left_implant),
        right_implant: Boolean(formData.right_implant),
        left_other: Boolean(formData.left_other),
        right_other: Boolean(formData.right_other),
        medical_recommendation: formData.medical_recommendation || null,
        medication_antibiotic: Boolean(formData.medication_antibiotic),
        medication_analgesic: Boolean(formData.medication_analgesic),
        medication_antiseptic: Boolean(formData.medication_antiseptic),
        medication_antifungal: Boolean(formData.medication_antifungal),
        comments: formData.comments || null,
      }

      debugLog("EAR_SCREENING", "Payload constructed", payload)

      await api.post("/api/phase2/ear-screening", payload, { headers })

      setSectionSuccess((prev) => ({ ...prev, earScreening: true }))
      setSectionErrors((prev) => ({ ...prev, earScreening: "" }))
      debugLog("EAR_SCREENING", "Ear screening submitted successfully")
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
        hearingScreening: "Patient ID required. Please search for the patient first.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        screening_method: formData.screening_method || null,
        left_ear_result: formData.left_ear_result || null,
        right_ear_result: formData.right_ear_result || null,
        hearing_satisfaction_18_plus_pass: formData.hearing_satisfaction_18_plus_pass || null,
      }

      debugLog("HEARING_SCREENING", "Payload constructed", payload)

      await api.post("/api/phase2/hearing-screening", payload, { headers })

      setSectionSuccess((prev) => ({ ...prev, hearingScreening: true }))
      setSectionErrors((prev) => ({ ...prev, hearingScreening: "" }))
      debugLog("HEARING_SCREENING", "Hearing screening submitted successfully")
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
        fitting: "Patient ID required. Please search for the patient first.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      // Submit fitting table (unchanged)
      const fittingTablePayload = {
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

      await api.post("/api/phase2/fitting-table", fittingTablePayload, { headers })

      // Build fitting payload including ear-reason left/right flags so backend can map to integers

      const fittingPayload = {
        patient_id: patientId,
        number_of_hearing_aid: formData.num_hearing_aids_fit || 0,
        special_device: formData.special_device || null,
        // send boolean flags expected by backend (createFitting maps these to integer codes)
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

      await api.post("/api/phase2/fitting", fittingPayload, { headers })

      setSectionSuccess((prev) => ({ ...prev, fitting: true }))
      setSectionErrors((prev) => ({ ...prev, fitting: "" }))
      debugLog("FITTING", "Fitting submitted successfully")
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
        counseling: "Patient ID required. Please search for the patient first.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        received_aftercare_information: formData.received_aftercare_info || false,
        trained_as_student_ambassador: formData.trained_as_student_ambassador || false,
      }

      debugLog("COUNSELING", "Payload constructed", payload)

      await api.post("/api/phase2/counseling", payload, { headers })

      setSectionSuccess((prev) => ({ ...prev, counseling: true }))
      setSectionErrors((prev) => ({ ...prev, counseling: "" }))
      debugLog("COUNSELING", "Counseling submitted successfully")
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
        finalQC: "Patient ID required. Please search for the patient first.",
      }))
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        batteries_provided_13: formData.batteries_13 || 0,
        batteries_provided_675: formData.batteries_675 || 0,
        hearing_aid_satisfaction_18_plus: formData.final_satisfaction || null,
        qc_comments: formData.final_comments || null,
      }

      debugLog("FINAL_QC", "Payload constructed", payload)

      await api.post("/api/phase2/final-qc", payload, { headers })

      setSectionSuccess((prev) => ({ ...prev, finalQC: true }))
      setSectionErrors((prev) => ({ ...prev, finalQC: "" }))
      debugLog("FINAL_QC", "Final QC submitted successfully")
    } catch (error: any) {
      const message = parseError(error)
      setSectionErrors((prev) => ({
        ...prev,
        finalQC: message || "Failed to submit final QC",
      }))
    }
  }

  const handleClose = () => {
    if (isFormDirty()) {
      setConfirmCloseOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  const confirmClose = () => {
    setConfirmCloseOpen(false)
    setFormData({ ...initialFormState })
    setSearchedPatientId(null)
    onOpenChange(false)
  }

  const completedSections = Object.values(sectionSuccess).filter(Boolean).length
  const totalSections = 6

  const showOtoscopy = formData.ears_clear_for_fitting !== "Yes"

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[60vw] sm:h-[94vh]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold text-blue-900">
              Phase 2 Hearing Aid Fitting & Assessment
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
                      <Label htmlFor="registration_date" className="font-medium">
                        Registration Date
                      </Label>
                      <Input
                        id="registration_date"
                        type="date"
                        value={formData.registration_date}
                        onChange={(e) => handleInputChange("registration_date", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="font-medium">
                        City
                      </Label>
                      <Input
                        id="city"
                        placeholder="City/Village"
                        value={formData.city}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="patient_type" className="font-medium">
                        Patient Type
                      </Label>
                      <select
                        id="patient_type"
                        value={formData.patient_type}
                        onChange={(e) => handleInputChange("patient_type", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value="">Select type</option>
                        <option value="Registered Phase 1">Registered Phase 1</option>
                        <option value="Walk-in No Earmolds">Walk-in No Earmolds</option>
                      </select>
                    </div>
                  </div>

                  {sectionErrors.registration && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.registration}</p>
                    </div>
                  )}
                  {sectionSuccess.registration && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Registration saved successfully!</p>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={submitRegistrationSection}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                      disabled={!patientFound && !formData.patient_id}
                    >
                      {!patientFound && !formData.patient_id ? "Search patient first" : "Save Registration"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              {/* Phase 2 Otoscopy */}
              <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
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
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    <Label className="font-medium block text-gray-700">
                      Ears Clear for Fitting
                    </Label>
                    <RadioGroup
                      className="flex space-x-8 pt-2"
                      value={formData.ears_clear_for_fitting}
                      onValueChange={(value) => handleInputChange("ears_clear_for_fitting", value)}
                    >
                      {["Yes", "No"].map((val) => (
                        <div
                          key={val}
                          className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200  transition-colors"
                        >
                          <RadioGroupItem value={val} id={`clear_fitting_${val.toLowerCase()}`} />
                          <Label
                            htmlFor={`clear_fitting_${val.toLowerCase()}`}
                            className="font-medium cursor-pointer text-gray-800"
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
                      <h3 className="text-base font-semibold text-emerald-700 flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                        2B. Otoscopy
                      </h3>

                      {/* Ear Findings Section */}
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
                                key={key}
                                className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
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
                                className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
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

                      {/* Medical Recommendation */}
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
                              key={side}
                              className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200  transition-colors"
                            >
                              <RadioGroupItem value={side} id={`med_${side.toLowerCase()}`} />
                              <Label
                                htmlFor={`med_${side.toLowerCase()}`}
                                className="cursor-pointer text-gray-800 font-medium"
                              >
                                {side}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      {/* Medication Given */}
                      <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                        <Label className="font-medium block text-gray-700 mb-2">
                          Medication Given
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {medications.map((med) => (
                            <div
                              key={med}
                              className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
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
                                className="text-sm cursor-pointer text-gray-800"
                              >
                                {med}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Comments */}
                      <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                        <Label htmlFor="comments" className="font-medium text-gray-700">
                          Comments
                        </Label>
                        <Textarea
                          id="comments"
                          value={formData.comments}
                          onChange={(e) => handleInputChange("comments", e.target.value)}
                          className="min-h-[100px] focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors rounded-lg"
                          placeholder="Enter additional notes here..."
                        />
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

                  {(sectionSuccess.earScreening || sectionSuccess.otoscopy) && (
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
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg shadow-md transition-colors"
                    >
                      Save Ear Screening & Otoscopy
                    </Button>
                  </div>
                </CardContent>
              </Card>





              {/* Section 3 - Hearing Screening */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-purple-600" />
                    3. Hearing Screening
                    {sectionSuccess.hearingScreening && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.hearingScreening && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="font-medium block">Screening Method</Label>
                    <RadioGroup
                      className="flex space-x-8 pt-2"
                      value={formData.screening_method}
                      onValueChange={(value) => handleInputChange("screening_method", value)}
                    >
                      <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="Audiogram" id="audiogram" />
                        <Label htmlFor="audiogram" className="font-medium cursor-pointer">
                          Audiogram
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                        <RadioGroupItem value="WFA® Voice Test" id="voice_test" />
                        <Label htmlFor="voice_test" className="font-medium cursor-pointer">
                          WFA® Voice Test
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium block">Left Ear Result</Label>
                      <RadioGroup
                        className="flex space-x-8 pt-2"
                        value={formData.left_ear_result}
                        onValueChange={(value) => handleInputChange("left_ear_result", value)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Pass" id="left-pass" />
                          <Label htmlFor="left-pass" className="cursor-pointer">
                            Pass
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Fail" id="left-fail" />
                          <Label htmlFor="left-fail" className="cursor-pointer">
                            Fail
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium block">Right Ear Result</Label>
                      <RadioGroup
                        className="flex space-x-8 pt-2"
                        value={formData.right_ear_result}
                        onValueChange={(value) => handleInputChange("right_ear_result", value)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Pass" id="right-pass" />
                          <Label htmlFor="right-pass" className="cursor-pointer">
                            Pass
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Fail" id="right-fail" />
                          <Label htmlFor="right-fail" className="cursor-pointer">
                            Fail
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="font-medium block">Satisfaction with Hearing (18+ if passes)</Label>
                    <RadioGroup
                      className="flex space-x-8 pt-2"
                      value={formData.hearing_satisfaction_18_plus_pass}
                      onValueChange={(value) => handleInputChange("hearing_satisfaction_18_plus_pass", value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Unsatisfied" id="unsat" />
                        <Label htmlFor="unsat" className="cursor-pointer">
                          Unsatisfied
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Undecided" id="undec" />
                        <Label htmlFor="undec" className="cursor-pointer">
                          Undecided
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Satisfied" id="sat" />
                        <Label htmlFor="sat" className="cursor-pointer">
                          Satisfied
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {sectionErrors.hearingScreening && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.hearingScreening}</p>
                    </div>
                  )}
                  {sectionSuccess.hearingScreening && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Hearing Screening saved successfully!</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitHearingScreeningSection}
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Save Hearing Screening
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              {/* Section 4 - Fitting */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-orange-600" />
                    4. Fitting & Counselling
                    {sectionSuccess.fitting && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.fitting && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
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
                          <Input
                            value={formData.left_earmold_type}
                            onChange={(e) => handleInputChange("left_earmold_type", e.target.value)}
                            className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                          />
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
                          <Input
                            value={formData.right_earmold_type}
                            onChange={(e) => handleInputChange("right_earmold_type", e.target.value)}
                            className="h-8 border-none focus-visible:ring-0 text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
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
                              <Label htmlFor={`num_aids_${val}`} className="cursor-pointer">
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
                          <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                            <RadioGroupItem value="Bone Conductor" id="special_bone" />
                            <Label htmlFor="special_bone" className="font-medium cursor-pointer">
                              Bone Conductor (675 battery)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                            <RadioGroupItem value="Body Aid" id="special_body" />
                            <Label htmlFor="special_body" className="font-medium cursor-pointer">
                              Body Aid (AA battery)
                            </Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <p className="mb-4 text-sm font-bold border-b pb-2">
                        If patient received 1 or 0 hearing aids, select option below:
                      </p>

                      {/* Define the array of reason options */}
                      {/* Note: This array is assumed to be defined outside of this block in your component scope. */}
                      {/* const reasonOptions = ["Normal Hearing", "Distortion", "Implant", "Recruitment", "No Response", "Other"]; */}


                      {/* Ear Findings Section - Displayed in a single flex column */}
                      <div className="flex flex-col gap-6 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">

                        {/* Left Ear Reasons Section */}
                        <div className="space-y-4 border-b pb-4 md:border-b-0 md:pb-0">
                          <h4 className="text-base font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                            <Ear className="h-4 w-4 text-emerald-600" /> Left Ear Reasons
                          </h4>

                          {/* Grid for Left Ear Checkboxes (2 columns wide) */}
                          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            {reasonOptions.map((reason) => {
                              // Convert "Normal Hearing" to "normal_hearing" for the base key
                              const reasonBaseKey = reason.toLowerCase().replace(/\s/g, "_");
                              const dataKey = `${reasonBaseKey}_left` as keyof FormData;

                              return (
                                <div
                                  key={reasonBaseKey}
                                  className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
                                >
                                  <Checkbox
                                    id={dataKey}
                                    // Bind to the flat boolean property on formData (e.g., formData.normal_hearing_left)
                                    checked={Boolean((formData as any)[dataKey])}
                                    onCheckedChange={(checked) =>
                                      handleInputChange(dataKey, checked)
                                    }
                                    className="focus:ring-orange-500 text-orange-600"
                                  />
                                  <Label
                                    htmlFor={dataKey}
                                    className="text-sm cursor-pointer text-gray-800"
                                  >
                                    {reason}
                                  </Label>
                                </div>
                              );
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
                              // Convert "Normal Hearing" to "normal_hearing" for the base key
                              const reasonBaseKey = reason.toLowerCase().replace(/\s/g, "_");
                              const dataKey = `${reasonBaseKey}_right` as keyof FormData;

                              return (
                                <div
                                  key={reasonBaseKey}
                                  className="flex items-center space-x-2 p-2 rounded-lg border border-gray-200  transition-colors"
                                >
                                  <Checkbox
                                    id={dataKey}
                                    // Bind to the flat boolean property on formData (e.g., formData.normal_hearing_right)
                                    checked={Boolean((formData as any)[dataKey])}
                                    onCheckedChange={(checked) =>
                                      handleInputChange(dataKey, checked)
                                    }
                                    className="focus:ring-orange-500 text-orange-600"
                                  />
                                  <Label
                                    htmlFor={dataKey}
                                    className="text-sm cursor-pointer text-gray-800"
                                  >
                                    {reason}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <Label htmlFor="fitting_comments" className="font-medium">
                      Comments:
                    </Label>
                    <Textarea
                      id="fitting_comments"
                      value={formData.fitting_comments}
                      onChange={(e) => handleInputChange("fitting_comments", e.target.value)}
                      className="min-h-[60px] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    />
                  </div>

                  <Separator className="w-full my-4" />

                  <div className="space-y-4">
                    <CardTitle className="text-lg text-gray-700">4B. Fitting Quality Control</CardTitle>
                    <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium block mb-2">Patient clear for counseling:</Label>
                      <RadioGroup
                        className="flex space-x-8 pt-2"
                        value={formData.patient_clear_for_counseling ? "Yes" : "No"}
                        onValueChange={(value) => handleInputChange("patient_clear_for_counseling", value === "Yes")}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Yes" id="clear_yes" />
                          <Label htmlFor="clear_yes" className="cursor-pointer">
                            Yes
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="No" id="clear_no" />
                          <Label htmlFor="clear_no" className="cursor-pointer">
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
                  {sectionSuccess.fitting && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Fitting saved successfully!</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitFittingSection}
                      className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Save Fitting & Counselling
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              {/* Section 5 - Counseling */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                    5. Counseling
                    {sectionSuccess.counseling && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.counseling && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id="aftercare_info"
                        checked={formData.received_aftercare_info}
                        onCheckedChange={(checked) => handleInputChange("received_aftercare_info", checked)}
                      />
                      <Label htmlFor="aftercare_info" className="font-medium cursor-pointer">
                        Received Aftercare Information
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id="student_ambassador"
                        checked={formData.trained_as_student_ambassador}
                        onCheckedChange={(checked) => handleInputChange("trained_as_student_ambassador", checked)}
                      />
                      <Label htmlFor="student_ambassador" className="font-medium cursor-pointer">
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
                  {sectionSuccess.counseling && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Counseling saved successfully!</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitCounselingSection}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Save Counseling
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Separator className="my-6" />

              {/* Section 6 - Final QC */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Battery className="h-5 w-5 text-gray-600" />
                    6. Final QC & Batteries
                    {sectionSuccess.finalQC && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.finalQC && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-gray-200 bg-gray-25">
                    <div className="space-y-2">
                      <Label htmlFor="batteries_13" className="font-medium">
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
/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batteries_675" className="font-medium">
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
/>
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <Label className="font-bold block text-sm border-b pb-2 mb-2">
                      Hearing Aid Satisfaction (For patients 18 & older)
                    </Label>
                    <RadioGroup
                      className="flex space-x-8 pt-2"
                      value={formData.final_satisfaction}
                      onValueChange={(value) => handleInputChange("final_satisfaction", value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Unsatisfied" id="final_unsat" />
                        <Label htmlFor="final_unsat" className="cursor-pointer">
                          Unsatisfied
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Undecided" id="final_undec" />
                        <Label htmlFor="final_undec" className="cursor-pointer">
                          Undecided
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Satisfied" id="final_sat" />
                        <Label htmlFor="final_sat" className="cursor-pointer">
                          Satisfied
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="final_comments" className="font-medium">
                      Comments
                    </Label>
                    <Textarea
                      id="final_comments"
                      value={formData.final_comments}
                      onChange={(e) => handleInputChange("final_comments", e.target.value)}
                      className="min-h-[100px] focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-colors"
                    />
                  </div>

                  {sectionErrors.finalQC && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.finalQC}</p>
                    </div>
                  )}
                  {sectionSuccess.finalQC && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Final QC saved successfully!</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitFinalQCSection}
                      className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      Save Final QC
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center pt-6 border-t px-6 pb-4">
            <div className="text-sm text-gray-600">
              {completedSections} of {totalSections} sections submitted
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-gray-300 hover:bg-gray-50 font-medium px-6 rounded-lg transition-colors bg-transparent"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Close Dialog */}
      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Unsaved Changes
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">You have unsaved changes. Are you sure you want to close?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmCloseOpen(false)}
              className="border-gray-300 hover:bg-gray-50"
            >
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={confirmClose} className="bg-red-600 hover:bg-red-700">
              Discard Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}