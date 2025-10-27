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
import { Search, User, Ear, Volume2, ClipboardCheck, CheckCircle2, AlertCircle } from "lucide-react"

interface Phase1FormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PatientSearchResponse {
  patient_id: number
}

const initialFormState = {
  shf_id: "",
  patient_id: 0,

  // Phase 1 Registration Section
  registration_date: "",
  city: "",
  has_hearing_loss: "",
  uses_sign_language: "",
  uses_speech: "",
  hearing_loss_causes: [] as string[],
  ringing_sensation: "",
  ear_pain: "",
  hearing_satisfaction_18_plus: "",
  conversation_difficulty: "",

  // Ear Screening Section
  // default screening is "Impressions"
  screening_name: "Impressions",
  // 2A: single Yes/No value (Ears Clear for Impressions). If "Yes" skip 2B entirely.
  ears_clear_for_impressions: "",

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
  // New medication fields as booleans
  medication_antibiotic: false,
  medication_analgesic: false,
  medication_antiseptic: false,
  medication_antifungal: false,
  left_ear_clear_for_fitting: "",
  right_ear_clear_for_fitting: "",
  comments: "", // Renamed from otoscopy_comments

  // Hearing Screening Section
  screening_method: "",
  left_ear_result: "",
  right_ear_result: "",
  hearing_satisfaction_18_plus_pass: "",

  // Ear Impressions Section
  ear_impression: "",
  impression_comments: "",

  // Final QC Section
  ear_impressions_inspected_collected: false,
  shf_id_number_id_card_given: false,
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

export function Phase1FormModal({ open, onOpenChange }: Phase1FormModalProps) {
  const [formData, setFormData] = useState<FormData>({ ...initialFormState })
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null)
  const [patientFound, setPatientFound] = useState<boolean>(false)
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([])
  const initialRef = useRef<FormData>({ ...initialFormState })
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({})

  // derived state: both ears clear -> skip otoscopy (2B)
  const bothEarsClear = formData.ears_clear_for_impressions === "Yes"

  // when both ears clear, null/clear all fields that belong to section 2B
  useEffect(() => {
    if (!bothEarsClear) return

    debugLog("AUTO_CLEAR_2B", "Both ears are clear — clearing 2B fields")

    setFormData((prev) => ({
      ...prev,
      // otoscopy left/right checkboxes
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

      // medical recommendation, medications, comments
      medical_recommendation: "",
      medication_antibiotic: false,
      medication_analgesic: false,
      medication_antiseptic: false,
      medication_antifungal: false,
      comments: "",

      // final clearance defaults (plural keys)
      left_ears_clear_for_fitting: "",
      right_ears_clear_for_fitting: "",
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothEarsClear])

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

  const hearingLossCauses = [
    "Medication",
    "Ear Infection",
    "Meningitis",
    "Aging",
    "Malaria",
    "Birth Trauma",
    "Tuberculosis",
    "HIV",
    "Other",
    "Unknown",
  ]

  const medications = ["Antiseptic", "Analgesic", "Antifungal", "Antibiotic"]

  const searchPatient = async () => {
    debugLog("PATIENT_SEARCH", "Starting patient search", { shf_id: formData.shf_id })

    if (!formData.shf_id.trim()) {
      setSearchError("Please enter an SHF ID")
      debugLog("PATIENT_SEARCH", "Error: Empty SHF ID")
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    setSearchedPatientId(null)
    setPatientFound(false)

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      debugLog("PATIENT_SEARCH", "API call initiated", {
        url: `/api/patients/shf?shf=${formData.shf_id.trim()}`,
        hasToken: !!token,
      })

      const response = await api.get<PatientSearchResponse>(
        `/api/patients/shf?shf=${encodeURIComponent(formData.shf_id.trim())}`,
        { headers },
      )

      debugLog("PATIENT_SEARCH", "API response received", response.data)

      if (response.data && typeof response.data.patient_id === "number") {
        setSearchedPatientId(response.data.patient_id)
        setFormData((prev) => ({ ...prev, patient_id: response.data.patient_id }))
        setPatientFound(true)
        setSearchError(null)
        debugLog("PATIENT_SEARCH", "Patient found successfully", { patient_id: response.data.patient_id })
      } else {
        setSearchError("Patient not found with this SHF ID")
        debugLog("PATIENT_SEARCH", "Error: Invalid response format", response.data)
      }
    } catch (error: any) {
      const message = parseError(error)
      debugLog("PATIENT_SEARCH", "API error occurred", {
        status: error.response?.status,
        message,
        fullError: error,
      })

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

  const handleCheckboxChange = (field: keyof FormData, index: number, value: string) => {
    setFormData((prev) => {
      const array = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : []
      array[index] = value
      return { ...prev, [field]: array }
    })
  }

  const addArrayItem = (field: keyof FormData) => {
    setFormData((prev) => {
      const array = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : []
      array.push("")
      return { ...prev, [field]: array }
    })
  }

  const removeArrayItem = (field: keyof FormData, index: number) => {
    setFormData((prev) => {
      const array = Array.isArray(prev[field]) ? [...(prev[field] as string[])] : []
      array.splice(index, 1)
      return { ...prev, [field]: array }
    })
  }

  const getPatientId = () => {
    const fromForm = formData.patient_id
    const fromSearch = searchedPatientId

    debugLog("GET_PATIENT_ID", "Checking patient ID sources", {
      fromForm,
      fromSearch,
      formDataPatientId: formData.patient_id,
      searchedPatientId,
      patientFound,
    })

    // Prefer the searched patient ID, fallback to form data
    const patientId = fromSearch || fromForm

    debugLog("GET_PATIENT_ID", "Final patient ID selected", {
      patientId,
      type: typeof patientId,
      isValid: patientId && patientId > 0,
    })

    return patientId
  }

  const submitRegistrationSection = async () => {
    const patientId = getPatientId()
    debugLog("REGISTRATION", "Starting registration submission", { patientId, type: typeof patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        registration: "Patient ID required. Please search for the patient first.",
      }))
      debugLog("REGISTRATION", "Error: No valid patient ID", { patientId })
      return
    }

    try {
      setValidationErrors([])
      setSectionErrors((prev) => ({ ...prev, registration: "" }))

      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        registration_date: formData.registration_date,
        city: formData.city || null,
        has_hearing_loss: formData.has_hearing_loss || null,
        uses_sign_language: formData.uses_sign_language || null,
        uses_speech: formData.uses_speech || null,
        hearing_loss_causes: formData.hearing_loss_causes.filter(Boolean),
        ringing_sensation: formData.ringing_sensation || null,
        ear_pain: formData.ear_pain || null,

        ...(formData.hearing_satisfaction_18_plus && {
          hearing_satisfaction_18_plus: formData.hearing_satisfaction_18_plus
        }),
        ...(formData.conversation_difficulty && {
          conversation_difficulty: formData.conversation_difficulty
        })
      }

      debugLog("REGISTRATION", "Payload constructed", payload)

      const response = await api.post("/api/phase1/registration", payload, { headers })
      debugLog("REGISTRATION", "API response received", response.data)

      setValidationErrors([])
      setSectionSuccess((prev) => ({ ...prev, registration: true }))
      setSectionErrors((prev) => ({ ...prev, registration: "" }))
      debugLog("REGISTRATION", "Registration submitted successfully")
    } catch (error: any) {
      const message = parseError(error)
      debugLog("REGISTRATION", "Submission error", { message, error, status: error.response?.status })

      const respData = error?.response?.data
      if (Array.isArray(respData)) {
        const arr = respData.map((e: any) => ({
          field: e?.field || String(e?.path || ""),
          message: e?.message || e?.msg || JSON.stringify(e),
        }))
        setValidationErrors(arr)
        setSectionErrors((prev) => ({ ...prev, registration: "Validation failed. See field errors below." }))
      } else {
        setValidationErrors([])
        setSectionErrors((prev) => ({
          ...prev,
          registration: message || "Failed to submit registration",
        }))
      }
    }
  }

  const submitEarScreeningSection = async () => {
    const patientId = getPatientId()
    debugLog("EAR_SCREENING", "Starting ear screening submission", { patientId, type: typeof patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        earScreening: "Patient ID required. Please search for the patient first.",
      }))
      debugLog("EAR_SCREENING", "Error: No valid patient ID", { patientId })
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        screening_name: formData.screening_name || "Impressions",

        // 2A is single Yes/No for impressions — send to both DB columns as same value
        ears_clear: formData.ears_clear_for_impressions === "Yes" ? "Yes" : "No",

        // Send left/right booleans — validation schema expects these keys
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

        // Medication booleans match validation middleware
        medication_antibiotic: Boolean(formData.medication_antibiotic),
        medication_analgesic: Boolean(formData.medication_analgesic),
        medication_antiseptic: Boolean(formData.medication_antiseptic),
        medication_antifungal: Boolean(formData.medication_antifungal),

        // Final Ears Clear for Fitting (Matches DB columns)
        left_ear_clear_for_fitting: formData.left_ear_clear_for_fitting || null,
        right_ear_clear_for_fitting: formData.right_ear_clear_for_fitting || null,

        // Comments (Matches DB column: comments)
        comments: formData.comments || null,
      }

      debugLog("EAR_SCREENING", "Payload constructed", payload)

      const response = await api.post("/api/phase1/ear-screening", payload, { headers })
      debugLog("EAR_SCREENING", "API response received", response.data)

      setSectionSuccess((prev) => ({ ...prev, earScreening: true }))
      setSectionErrors((prev) => ({ ...prev, earScreening: "" }))
      debugLog("EAR_SCREENING", "Ear screening submitted successfully")
    } catch (error: any) {
      const message = parseError(error)
      debugLog("EAR_SCREENING", "Submission error", { message, error, status: error.response?.status })
      setSectionErrors((prev) => ({
        ...prev,
        earScreening: message || "Failed to submit ear screening",
      }))
    }
  }

  const submitHearingScreeningSection = async () => {
    const patientId = getPatientId()
    debugLog("HEARING_SCREENING", "Starting hearing screening submission", { patientId, type: typeof patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        hearingScreening: "Patient ID required. Please search for the patient first.",
      }))
      debugLog("HEARING_SCREENING", "Error: No valid patient ID", { patientId })
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
        hearing_satisfaction_18_plus_pass: formData.hearing_satisfaction_18_plus_pass,
      }

      debugLog("HEARING_SCREENING", "Payload constructed", payload)

      const response = await api.post("/api/phase1/hearing-screening", payload, { headers })
      debugLog("HEARING_SCREENING", "API response received", response.data)

      setSectionSuccess((prev) => ({ ...prev, hearingScreening: true }))
      setSectionErrors((prev) => ({ ...prev, hearingScreening: "" }))
      debugLog("HEARING_SCREENING", "Hearing screening submitted successfully")
    } catch (error: any) {
      const message = parseError(error)
      debugLog("HEARING_SCREENING", "Submission error", { message, error, status: error.response?.status })
      setSectionErrors((prev) => ({
        ...prev,
        hearingScreening: message || "Failed to submit hearing screening",
      }))
    }
  }

  const submitEarImpressionsSection = async () => {
    const patientId = getPatientId()
    debugLog("EAR_IMPRESSIONS", "Starting ear impressions submission", { patientId, type: typeof patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({
        ...prev,
        earImpressions: "Patient ID required. Please search for the patient first.",
      }))
      debugLog("EAR_IMPRESSIONS", "Error: No valid patient ID", { patientId })
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        ear_impression: formData.ear_impression || null,
        comment: formData.impression_comments || null,
      }

      debugLog("EAR_IMPRESSIONS", "Payload constructed", payload)

      const response = await api.post("/api/phase1/ear-impressions", payload, { headers })
      debugLog("EAR_IMPRESSIONS", "API response received", response.data)

      setSectionSuccess((prev) => ({ ...prev, earImpressions: true }))
      setSectionErrors((prev) => ({ ...prev, earImpressions: "" }))
      debugLog("EAR_IMPRESSIONS", "Ear impressions submitted successfully")
    } catch (error: any) {
      const message = parseError(error)
      debugLog("EAR_IMPRESSIONS", "Submission error", { message, error, status: error.response?.status })
      setSectionErrors((prev) => ({
        ...prev,
        earImpressions: message || "Failed to submit ear impressions",
      }))
    }
  }

  const submitFinalQCSection = async () => {
    const patientId = getPatientId()
    debugLog("FINAL_QC", "Starting final QC submission", { patientId, type: typeof patientId })

    if (!patientId || patientId === 0) {
      setSectionErrors((prev) => ({ ...prev, finalQC: "Patient ID required. Please search for the patient first." }))
      debugLog("FINAL_QC", "Error: No valid patient ID", { patientId })
      return
    }

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const payload = {
        patient_id: patientId,
        ear_impressions_inspected_collected: formData.ear_impressions_inspected_collected,
        shf_id_number_id_card_given: formData.shf_id_number_id_card_given,
      }

      debugLog("FINAL_QC", "Payload constructed", payload)

      const response = await api.post("/api/phase1/final-qc", payload, { headers })
      debugLog("FINAL_QC", "API response received", response.data)

      setSectionSuccess((prev) => ({ ...prev, finalQC: true }))
      setSectionErrors((prev) => ({ ...prev, finalQC: "" }))
      debugLog("FINAL_QC", "Final QC submitted successfully")
    } catch (error: any) {
      const message = parseError(error)
      debugLog("FINAL_QC", "Submission error", { message, error, status: error.response?.status })
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
  const totalSections = 5

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[60vw] sm:h-[94vh]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold text-blue-900">Phase 1 Patient Registration Form</DialogTitle>
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
                style={{
                  width: `${(completedSections / totalSections) * 100}%`,
                }}
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
                        <p className="text-green-600 text-sm">Use this numeric ID for submissions</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Registration Section */}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="reg-date" className="font-medium">
                        Registration Date
                      </Label>
                      <Input
                        id="reg-date"
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
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">General Questions</h4>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                        <Label className="font-medium"><strong>1. Do you have a hearing loss?</strong></Label>
                        <RadioGroup
                          value={formData.has_hearing_loss}
                          onValueChange={(value) => handleInputChange("has_hearing_loss", value)}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="Yes" id="hearing-loss-Yes" />
                            <Label htmlFor="hearing-loss-Yes" className="font-medium cursor-pointer">
                              Yes
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="undecided" id="hearing-loss-undecided" />
                            <Label htmlFor="hearing-loss-undecided" className="font-medium cursor-pointer">
                              Undecided
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="no" id="hearing-loss-no" />
                            <Label htmlFor="hearing-loss-no" className="font-medium cursor-pointer">
                              No
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                        <Label className="font-medium"><strong>2. Do you use sign language?</strong></Label>
                        <RadioGroup
                          value={formData.uses_sign_language}
                          onValueChange={(value) => handleInputChange("uses_sign_language", value)}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="Yes" id="sign-lang-Yes" />
                            <Label htmlFor="sign-lang-Yes" className="font-medium cursor-pointer">
                              Yes
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="A little" id="sign-lang-a-little" />
                            <Label htmlFor="sign-lang-a-little" className="font-medium cursor-pointer">
                              A Little
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="no" id="sign-lang-no" />
                            <Label htmlFor="sign-lang-no" className="font-medium cursor-pointer">
                              No
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                        <Label className="font-medium"><strong>3. Do you use speech?</strong></Label>
                        <RadioGroup
                          value={formData.uses_speech}
                          onValueChange={(value) => handleInputChange("uses_speech", value)}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="Yes" id="speech-Yes" />
                            <Label htmlFor="speech-Yes" className="font-medium cursor-pointer">
                              Yes
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="A little" id="speech-a-little" />
                            <Label htmlFor="speech-a-little" className="font-medium cursor-pointer">
                              A Little
                            </Label>
                          </div>
                          <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                            <RadioGroupItem value="no" id="speech-no" />
                            <Label htmlFor="speech-no" className="font-medium cursor-pointer">
                              No
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                    <Label className="font-semibold text-lg">4. Hearing Loss Cause:</Label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {hearingLossCauses.map((cause) => {
                        const id = `cause-${cause.toLowerCase().replace(/\s/g, '-')}`
                        const checked = formData.hearing_loss_causes.includes(cause)

                        return (
                          <div key={cause} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={id}
                              checked={checked}
                              onChange={(e) => {
                                const isChecked = e.target.checked
                                setFormData((prev) => {
                                  const list = Array.isArray(prev.hearing_loss_causes) ? [...prev.hearing_loss_causes] : []
                                  if (isChecked && !list.includes(cause)) list.push(cause)
                                  if (!isChecked) {
                                    const idx = list.indexOf(cause)
                                    if (idx > -1) list.splice(idx, 1)
                                  }
                                  return { ...prev, hearing_loss_causes: list }
                                })
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label htmlFor={id} className="text-sm font-medium leading-none cursor-pointer">
                              {cause}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Separator /><div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium"><strong>5. Do you experience a ringing
                        sensation in your ear?</strong></Label>
                      <RadioGroup
                        value={formData.ringing_sensation}
                        onValueChange={(value) => handleInputChange("ringing_sensation", value)}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Yes" id="ringing-Yes" />
                          <Label htmlFor="ringing-Yes" className="font-medium cursor-pointer">
                            Yes
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="undecided" id="ringing-undecided" />
                          <Label htmlFor="ringing-undecided" className="font-medium cursor-pointer">
                            Undecided
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="no" id="ringing-no" />
                          <Label htmlFor="ringing-no" className="font-medium cursor-pointer">
                            No
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium"><strong>6. Do you have pain in your ear?</strong></Label>
                      <RadioGroup
                        value={formData.ear_pain}
                        onValueChange={(value) => handleInputChange("ear_pain", value)}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="No" id="pain-no" />
                          <Label htmlFor="pain-no" className="font-medium cursor-pointer">
                            No
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="A little" id="pain-a-little" />
                          <Label htmlFor="pain-a-little" className="font-medium cursor-pointer">
                            A Little
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Yes" id="pain-Yes" />
                          <Label htmlFor="pain-Yes" className="font-medium cursor-pointer">
                            Yes
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <Separator />

                    <div className="text-lg">(FOR PATIENTS 18 & OLDER)</div>
                    <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium"><strong>7. How satisfied are you with your hearing?</strong></Label>
                      <RadioGroup
                        value={formData.hearing_satisfaction_18_plus}
                        onValueChange={(value) => handleInputChange("hearing_satisfaction_18_plus", value)}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Unsatisfied" id="satisfaction-unsatisfied" />
                          <Label htmlFor="satisfaction-unsatisfied" className="font-medium cursor-pointer">
                            Unsatisfied
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Undecided" id="satisfaction-undecided" />
                          <Label htmlFor="satisfaction-undecided" className="font-medium cursor-pointer">
                            Undecided
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Satisfied" id="satisfaction-satisfied" />
                          <Label htmlFor="satisfaction-satisfied" className="font-medium cursor-pointer">
                            Satisfied
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                      <Label className="font-medium"><strong>8. Do you ask people to repeat themselves or speak louder in conversation?</strong></Label>
                      <RadioGroup
                        value={formData.conversation_difficulty}
                        onValueChange={(value) => handleInputChange("conversation_difficulty", value)}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="No" id="repeat-no" />
                          <Label htmlFor="repeat-no" className="font-medium cursor-pointer">
                            No
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Sometimes" id="repeat-sometimes" />
                          <Label htmlFor="repeat-sometimes" className="font-medium cursor-pointer">
                            Sometimes
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <RadioGroupItem value="Yes" id="repeat-yes" />
                          <Label htmlFor="repeat-yes" className="font-medium cursor-pointer">
                            Yes
                          </Label>
                        </div>
                      </RadioGroup>
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

                  {validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                      <div className="font-medium text-sm text-red-700 mb-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Field validation errors
                      </div>
                      <div className="space-y-2 max-h-44 overflow-auto text-sm">
                        {Object.keys(initialFormState).map((key) => {
                          const val = (formData as any)[key]
                          const err = validationErrors.find((e) => e.field === key)
                          return (
                            <div key={key} className="flex items-start gap-4 p-2 bg-red-25 rounded">
                              <div className="w-36 font-mono text-xs text-red-700 font-medium">{key}</div>
                              <div className="flex-1 truncate text-xs text-red-600">
                                {val === "" ? "—" : String(val)}
                              </div>
                              <div className="w-48 text-xs text-red-700 font-medium">{err ? err.message : ""}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitRegistrationSection}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors"
                    >
                      Save Registration
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Ear Screening Section */}
              <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                    <Ear className="h-5 w-5 text-green-600" />
                    2. Ear Screening & Otoscopy
                    {sectionSuccess.earScreening && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.earScreening && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-6 space-y-8">
                  {/* --- Section 2A: Initial Ear Clearance for Impressions --- */}
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                    <Label className="font-medium block text-gray-700">
                      Ears Clear for Impressions? (IF YES, SKIP TO SECTION 3)
                    </Label>
                    <RadioGroup
                      className="flex space-x-8 pt-2"
                      value={formData.ears_clear_for_impressions || "No"}
                      onValueChange={(value) => handleInputChange("ears_clear_for_impressions", value)}
                    >
                      {["Yes", "No"].map((val) => (
                        <div
                          key={val}
                          className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200  transition-colors"
                        >
                          <RadioGroupItem value={val} id={`initial-clear-${val.toLowerCase()}`} />
                          <Label htmlFor={`initial-clear-${val.toLowerCase()}`} className="font-medium cursor-pointer text-gray-800">
                            {val}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* --- Section 2B: OTOSCOPY (hidden when bothEarsClear) --- */}
                  {!bothEarsClear && (
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
                  {sectionErrors.earScreening && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.earScreening}</p>
                    </div>
                  )}


                  {sectionSuccess.earScreening && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Ear Screening saved successfully!</p>
                    </div>
                  )}

                  {/* --- Save Button --- */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitEarScreeningSection}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors"
                    >
                      Save Ear Screening & Otoscopy
                    </Button>
                  </div>
                </CardContent>
              </Card>


              {/* Hearing Screening Section */}
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
                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
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

                  <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
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
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors"
                    >
                      Save Hearing Screening
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Ear Impressions Section */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-orange-600" />
                    4. Ear Impressions
                    {sectionSuccess.earImpressions && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.earImpressions && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Ear Impressions Side - Replaced Input with RadioGroup */}
                  <div className="space-y-3">
                    <Label className="font-medium">
                      Ear Impressions:
                    </Label>
                    <RadioGroup
                      value={formData.ear_impression}
                      onValueChange={(value) => handleInputChange("ear_impression", value)}
                      className="flex space-x-8"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Left" id="side-left" />
                        <Label htmlFor="side-left" className="cursor-pointer">Left</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Right" id="side-right" />
                        <Label htmlFor="side-right" className="cursor-pointer">Right</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Comments - Kept as Textarea */}
                  <div className="space-y-2">
                    <Label htmlFor="impression-comments" className="font-medium">
                      Comments:
                    </Label>
                    <Textarea
                      id="impression-comments"
                      placeholder="Additional comments"
                      value={formData.impression_comments}
                      onChange={(e) => handleInputChange("impression_comments", e.target.value)}
                      className="focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors min-h-[100px]"
                    />
                  </div>

                  {sectionErrors.earImpressions && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-red-700 text-sm">{sectionErrors.earImpressions}</p>
                    </div>
                  )}
                  {sectionSuccess.earImpressions && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-green-700 text-sm font-medium">✓ Ear impressions saved successfully!</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={submitEarImpressionsSection}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors"
                    >
                      Save Ear Impressions
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Final QC Section */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-gray-600" />
                    5. Final Quality Control
                    {sectionSuccess.finalQC && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                    {sectionErrors.finalQC && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id="impressions-inspected"
                        checked={formData.ear_impressions_inspected_collected}
                        onCheckedChange={(checked) => handleInputChange("ear_impressions_inspected_collected", checked)}
                      />
                      <Label htmlFor="impressions-inspected" className="font-medium cursor-pointer">
                        Ear Impressions Inspected & Collected
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id="shf-id-given"
                        checked={formData.shf_id_number_id_card_given}
                        onCheckedChange={(checked) => handleInputChange("shf_id_number_id_card_given", checked)}
                      />
                      <Label htmlFor="shf-id-given" className="font-medium cursor-pointer">
                        SHF ID Number & ID Card Given
                      </Label>
                    </div>
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
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors"
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
