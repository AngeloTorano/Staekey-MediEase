"use client"

import axios from "axios"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    FileText,
    Users,
    Plus,
    CheckCircle2,
    AlertCircle,
    Search,
    User,
    Ear,
    Volume2,
    ClipboardCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { decryptObject } from "@/utils/decrypt"; // ADD
// ADD: Dialog UI
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

// Add this interface for patient info
interface PatientInfo {
    patient_id: number
    first_name: string
    last_name: string
    gender: string
    date_of_birth: string
    age: number
    mobile_number: string
    region_district: string
    city_village: string
    employment_status: string
    highest_education_level: string
    school_name: string
    school_phone_number: string
    is_student: boolean
    shf_id?: string // <-- added (optional)
}

interface PatientData {
    last_name: string
    first_name: string
    gender: string
    date_of_birth: string
    age: string
    mobile_number: string
    mobile_sms: boolean
    alternative_number: string
    alternative_sms: boolean
    region_district: string
    city_village: string
    employment_status: string
    highest_education_level: string
    school_name: string
    school_phone_number: string
    is_student: boolean
}

interface PatientSearchResponse {
    patient_id: number
}

interface PatientRegistrationResponse {
    patient_id: number
    // Add other fields that might be returned from patient registration
}

const INITIAL_PATIENT_STATE: PatientData = {

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

const initialPhase1FormState = {
    shf_id: "",
    patient_id: 0,
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
    screening_name: "Impressions",
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
    medication_antibiotic: false,
    medication_analgesic: false,
    medication_antiseptic: false,
    medication_antifungal: false,
    left_ear_clear_for_fitting: "",
    right_ear_clear_for_fitting: "",
    comments: "",
    screening_method: "",
    left_ear_result: "",
    right_ear_result: "",
    hearing_satisfaction_18_plus_pass: "",
    ear_impression: "",
    impression_comments: "",
    ear_impressions_inspected_collected: false,
    shf_id_number_id_card_given: false,
}

type Phase1FormData = typeof initialPhase1FormState

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
    withCredentials: true
})

const debugLog = (section: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
}

export default function PatientRegistrationPage() {
    const [patientData, setPatientData] = useState<PatientData>({ ...INITIAL_PATIENT_STATE })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showPhase1Form, setShowPhase1Form] = useState(false)
    const [phase1FormData, setPhase1FormData] = useState<Phase1FormData>({ ...initialPhase1FormState })
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [searchedPatientId, setSearchedPatientId] = useState<number | null>(null)
    const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
    const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({})
    const [registeredPatientId, setRegisteredPatientId] = useState<number | null>(null)
    const [phase1RegId, setPhase1RegId] = useState<number | null>(null)
    // ADD
    const [p1Ids, setP1Ids] = useState<{
      earScreeningId: number | null
      hearingScreeningId: number | null
      earImpressionId: number | null
      finalQcId: number | null
    }>({ earScreeningId: null, hearingScreeningId: null, earImpressionId: null, finalQcId: null })

    // Add this state for patient info
    const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
    const [locks,setLocks] = useState<any>(null);
    const router = useRouter()
    // ADD: dialog visibility
    const [showPhase1Complete, setShowPhase1Complete] = useState(false)

    // NEW: track if Phase 1 was opened via the link + whether a patient was found
    const [arrivedFromLink, setArrivedFromLink] = useState(false)
    const [patientFound, setPatientFound] = useState(false)

    const hearingLossCauses = [
        "Medication",
        "Ear Infection",
        "Meningitis",
        "Aging",
        "Malaria",
        "Birth",
        "Trauma",
        "Tuberculosis",
        "HIV",
        "Other",
        "Unknown",
    ]

    const medications = ["Antiseptic", "Analgesic", "Antifungal", "Antibiotic"]

    // Add this function to fetch patient info
    const fetchPatientInfo = async (patientId: number) => {
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token")
            const headers = token ? { Authorization: `Bearer ${token}` } : {}

            const response = await api.get(`/api/patients/${patientId}`, { headers })
            const raw = response.data?.encrypted_data
              ? decryptObject(response.data.encrypted_data)
              : (response.data?.data ?? response.data)

            // Expect first_name/last_name fields; fallback to sensible defaults
            setPatientInfo({
              patient_id: Number(raw.patient_id ?? patientId),
              first_name: raw.first_name ?? "",
              last_name: raw.last_name ?? "",
              gender: raw.gender ?? "",
              date_of_birth: raw.date_of_birth ?? "",
              age: Number(raw.age ?? 0),
              mobile_number: raw.mobile_number ?? "",
              region_district: raw.region_district ?? "",
              city_village: raw.city_village ?? "",
              employment_status: raw.employment_status ?? "",
              highest_education_level: raw.highest_education_level ?? "",
              school_name: raw.school_name ?? "",
              school_phone_number: raw.school_phone_number ?? "",
              is_student: !!raw.is_student,
              shf_id: raw.shf_id ?? undefined,
            })
        } catch (error) {
            console.error("Failed to fetch patient info:", error)
            // If API call fails, we'll use the data from registration
        }
    }

    // Calculate age automatically when date of birth changes
    useEffect(() => {
        if (patientData.date_of_birth) {
            const birthDate = new Date(patientData.date_of_birth)
            const today = new Date()
            let calculatedAge = today.getFullYear() - birthDate.getFullYear()
            const monthDiff = today.getMonth() - birthDate.getMonth()

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                calculatedAge--
            }

            setPatientData(prev => ({
                ...prev,
                age: calculatedAge > 0 ? calculatedAge.toString() : ""
            }))
        }
    }, [patientData.date_of_birth])

    // Phase 1 form logic
    const bothEarsClear = phase1FormData.ears_clear_for_impressions === "Yes"

    useEffect(() => {
        if (!bothEarsClear) return
        setPhase1FormData((prev) => ({
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
            left_ear_clear_for_fitting: "",
            right_ear_clear_for_fitting: ""
        }))
    }, [bothEarsClear])

    const parseError = (err: any) => {
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

    const getPatientId = () => {
        // Priority: registered patient ID > searched patient ID > form patient ID
        if (registeredPatientId) return registeredPatientId;
        if (searchedPatientId) return searchedPatientId;
        return phase1FormData.patient_id;
    }

    const handlePhase1InputChange = (field: keyof Phase1FormData, value: any) => {
        setPhase1FormData((prev) => ({ ...prev, [field]: value }))
    }

    const submitRegistrationSection = async () => {
        const patientId = getPatientId();
        if (!patientId || patientId === 0) {
            setSectionErrors(prev => ({ ...prev, registration: "Patient ID required." }));
            return;
        }
        try {
            setSectionErrors(prev => ({ ...prev, registration: "" }));
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = {
                patient_id: patientId,
                registration_date: phase1FormData.registration_date,
                city: phase1FormData.city || null,
                has_hearing_loss: phase1FormData.has_hearing_loss || null,
                uses_sign_language: phase1FormData.uses_sign_language || null,
                uses_speech: phase1FormData.uses_speech || null,
                hearing_loss_causes: phase1FormData.hearing_loss_causes.filter(Boolean),
                ringing_sensation: phase1FormData.ringing_sensation || null,
                ear_pain: phase1FormData.ear_pain || null,
                hearing_satisfaction_18_plus: phase1FormData.hearing_satisfaction_18_plus || null,
                conversation_difficulty: phase1FormData.conversation_difficulty || null
            };
            let res
            if (phase1RegId) {
              res = await api.put(`/api/phase1/registration/${phase1RegId}`, payload, { headers })
            } else {
              res = await api.post("/api/phase1/registration", payload, { headers })
              if (res.data?.data?.phase1_reg_id) setPhase1RegId(res.data.data.phase1_reg_id)
            }
            setSectionSuccess(prev => ({ ...prev, registration: true }));
        } catch (e: any) {
            console.error("submitRegistrationSection error:", e);
            setSectionErrors(prev => ({ ...prev, registration: "Failed to Save this Section" }));
        }
    }

    const submitEarScreeningSection = async () => {
        const patientId = getPatientId();
        if (!patientId) {
            setSectionErrors(prev => ({ ...prev, earScreening: "Patient ID required." }));
            return;
        }
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = {
                patient_id: patientId,
                phase1_reg_id: phase1RegId, // NEW
                screening_name: phase1FormData.screening_name || "Impressions",
                ears_clear_for_impressions: phase1FormData.ears_clear_for_impressions === "Yes" ? "Yes" : "No",
                left_wax: phase1FormData.left_wax,
                right_wax: phase1FormData.right_wax,
                left_infection: phase1FormData.left_infection,
                right_infection: phase1FormData.right_infection,
                left_perforation: phase1FormData.left_perforation,
                right_perforation: phase1FormData.right_perforation,
                left_tinnitus: phase1FormData.left_tinnitus,
                right_tinnitus: phase1FormData.right_tinnitus,
                left_atresia: phase1FormData.left_atresia,
                right_atresia: phase1FormData.right_atresia,
                left_implant: phase1FormData.left_implant,
                right_implant: phase1FormData.right_implant,
                left_other: phase1FormData.left_other,
                right_other: phase1FormData.right_other,
                medical_recommendation: phase1FormData.medical_recommendation || null,
                medication_antibiotic: phase1FormData.medication_antibiotic,
                medication_analgesic: phase1FormData.medication_analgesic,
                medication_antiseptic: phase1FormData.medication_antiseptic,
                medication_antifungal: phase1FormData.medication_antifungal,
                left_ear_clear_for_fitting: phase1FormData.left_ear_clear_for_fitting || null,
                right_ear_clear_for_fitting: phase1FormData.right_ear_clear_for_fitting || null,
                comments: phase1FormData.comments || null
            };
            if (p1Ids.earScreeningId) {
              await api.put(`/api/phase1/ear-screening/${p1Ids.earScreeningId}`, payload, { headers })
            } else {
              const res = await api.post("/api/phase1/ear-screening", payload, { headers })
              const created = res?.data?.data ?? res?.data
              if (created?.ear_screening_id) setP1Ids(prev => ({ ...prev, earScreeningId: created.ear_screening_id }))
            }
            setSectionSuccess(prev => ({ ...prev, earScreening: true }));
        } catch (e: any) {
            console.error("submitEarScreeningSection error:", e);
            setSectionErrors(prev => ({ ...prev, earScreening: "Failed to Save this Section" }));
        }
    }

    const submitHearingScreeningSection = async () => {
        const patientId = getPatientId();
        if (!patientId) {
            setSectionErrors(prev => ({ ...prev, hearingScreening: "Patient ID required." }));
            return;
        }
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = {
                patient_id: patientId,
                phase1_reg_id: phase1RegId, // NEW
                screening_method: phase1FormData.screening_method || null,
                left_ear_result: phase1FormData.left_ear_result || null,
                right_ear_result: phase1FormData.right_ear_result || null,
                hearing_satisfaction_18_plus_pass: phase1FormData.hearing_satisfaction_18_plus_pass || null
            };
            if (p1Ids.hearingScreeningId) {
              await api.put(`/api/phase1/hearing-screening/${p1Ids.hearingScreeningId}`, payload, { headers })
            } else {
              const res = await api.post("/api/phase1/hearing-screening", payload, { headers })
              const created = res?.data?.data ?? res?.data
              if (created?.hearing_screen_id) setP1Ids(prev => ({ ...prev, hearingScreeningId: created.hearing_screen_id }))
            }
            setSectionSuccess(prev => ({ ...prev, hearingScreening: true }));
        } catch (e: any) {
            console.error("submitHearingScreeningSection error:", e);
            setSectionErrors(prev => ({ ...prev, hearingScreening: "Failed to Save this Section" }));
        }
    }

    const submitEarImpressionsSection = async () => {
        const patientId = getPatientId();
        if (!patientId) {
            setSectionErrors(prev => ({ ...prev, earImpressions: "Patient ID required." }));
            return;
        }
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = {
                patient_id: patientId,
                phase1_reg_id: phase1RegId, // NEW
                ear_impression: phase1FormData.ear_impression || null,
                comment: phase1FormData.impression_comments || null
            };
            if (p1Ids.earImpressionId) {
              await api.put(`/api/phase1/ear-impressions/${p1Ids.earImpressionId}`, payload, { headers })
            } else {
              const res = await api.post("/api/phase1/ear-impressions", payload, { headers })
              const created = res?.data?.data ?? res?.data
              if (created?.impression_id) setP1Ids(prev => ({ ...prev, earImpressionId: created.impression_id }))
            }
            setSectionSuccess(prev => ({ ...prev, earImpressions: true }));
        } catch (e: any) {
            console.error("submitEarImpressionsSection error:", e);
            setSectionErrors(prev => ({ ...prev, earImpressions: "Failed to Save this Section" }));
        }
    }

    const submitFinalQCSection = async () => {
        const patientId = getPatientId();
        if (!patientId) {
            setSectionErrors(prev => ({ ...prev, finalQC: "Patient ID required." }));
            return;
        }
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const payload = {
                patient_id: patientId,
                phase1_reg_id: phase1RegId, // NEW
                ear_impressions_inspected_collected: phase1FormData.ear_impressions_inspected_collected,
                shf_id_number_id_card_given: phase1FormData.shf_id_number_id_card_given
            };
            if (p1Ids.finalQcId) {
              await api.put(`/api/phase1/final-qc/${p1Ids.finalQcId}`, payload, { headers })
            } else {
              const res = await api.post("/api/phase1/final-qc", payload, { headers })
              const created = res?.data?.data ?? res?.data
              if (created?.final_qc_id) setP1Ids(prev => ({ ...prev, finalQcId: created.final_qc_id }))
            }
            setSectionSuccess(prev => ({ ...prev, finalQC: true }));
        } catch (e: any) {
            console.error("submitFinalQCSection error:", e);
            setSectionErrors(prev => ({ ...prev, finalQC: "Failed to Save this Section" }));
        }
    }

    // Import the decrypt function at the top of your file


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const payload: any = {
                last_name: patientData.last_name.trim(),
                first_name: patientData.first_name.trim(),
                gender: patientData.gender,
                date_of_birth: patientData.date_of_birth,
                age: patientData.age ? Number(patientData.age) : null,
                mobile_number: patientData.mobile_number,
                alternative_number: patientData.alternative_number,
                region_district: patientData.region_district,
                city_village: patientData.city_village,
                employment_status: patientData.employment_status,
                highest_education_level: patientData.highest_education_level,
            }

            if (patientData.is_student) {
                payload.school_name = patientData.school_name
                payload.school_phone_number = patientData.school_phone_number
            }

            Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] === null) && delete payload[k])

            const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
            const res = await api.post("/api/patients", payload, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            })


            let patientId: number | null = null
            let decryptedData: any = null

            // Try to decrypt the response to get patient ID
            if (res.data.encrypted_data) {
                try {
                    decryptedData = decryptObject(res.data.encrypted_data)

                    // Extract patient ID from decrypted data
                    if (decryptedData.patient_id) {
                        patientId = decryptedData.patient_id
                    } else if (decryptedData.id) {
                        patientId = decryptedData.id
                    } else {
                    }
                } catch (decryptError) {
                    console.error("Failed to decrypt response:", decryptError)
                }
            }

            // If decryption failed or didn't contain patient ID, fall back to search
            if (!patientId) {

                // Search for the patient by name to find the newly created one
                try {
                    const searchResponse = await api.get(`/api/patients?search=${encodeURIComponent(patientData.first_name + ' ' + patientData.last_name)}&limit=10`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    })

                    if (searchResponse.data && searchResponse.data.length > 0) {
                        // Find the most recent patient with matching name
                        const matchingPatients = searchResponse.data.filter((p: any) =>
                            p.first_name?.toLowerCase() === patientData.first_name.toLowerCase() &&
                            p.last_name?.toLowerCase() === patientData.last_name.toLowerCase()
                        )

                        if (matchingPatients.length > 0) {
                            // Sort by patient_id descending to get the most recent (the one we just created)
                            matchingPatients.sort((a: any, b: any) => b.patient_id - a.patient_id)
                            patientId = matchingPatients[0].patient_id
                        }
                    }
                } catch (searchErr: any) {
                    console.error("Failed to search for patient:", searchErr)
                }
            }

            if (!patientId) {
                throw new Error("Patient was created successfully, but we couldn't retrieve the patient ID. Please search for the patient manually using their name or SHF ID to proceed to Phase 1.")
            }

            // Store the patient ID from the response
            setRegisteredPatientId(patientId)

            // Create confirmation before showing Phase 1 form
            const shouldProceed = window.confirm(
                `Patient registered successfully!\nPatient ID: ${patientId}\n\nDo you want to proceed to Phase 1 form?`
            )

            if (shouldProceed) {
                // Preserve the filled patient data before clearing the form
                const preservedPatientData = { ...patientData }

                setPatientData(INITIAL_PATIENT_STATE)
                setSuccess(true)
                setShowPhase1Form(true)

                // Set the patient ID in the phase1 form data
                setPhase1FormData(prev => ({
                    ...prev,
                    patient_id: patientId!
                }))

                // Fetch complete patient info using the patient ID
                try {
                    const patientInfoResponse = await api.get(`/api/patients/${patientId}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    })

                    // Check if the patient info response is also encrypted
                    if (patientInfoResponse.data.encrypted_data) {
                        try {
                            const decryptedPatientInfo = decryptObject(patientInfoResponse.data.encrypted_data)
                            setPatientInfo(decryptedPatientInfo)
                        } catch (decryptErr) {
                            console.error("Failed to decrypt patient info:", decryptErr)
                            // Fallback to using registration data
                            const patientInfoData: PatientInfo = {
                                patient_id: patientId,
                                first_name: preservedPatientData.first_name,
                                last_name: preservedPatientData.last_name,
                                gender: preservedPatientData.gender,
                                date_of_birth: preservedPatientData.date_of_birth,
                                age: parseInt(preservedPatientData.age) || 0,
                                mobile_number: preservedPatientData.mobile_number,
                                region_district: preservedPatientData.region_district,
                                city_village: preservedPatientData.city_village,
                                employment_status: preservedPatientData.employment_status,
                                highest_education_level: preservedPatientData.highest_education_level,
                                school_name: preservedPatientData.school_name,
                                school_phone_number: preservedPatientData.school_phone_number,
                                is_student: preservedPatientData.is_student
                            }
                            setPatientInfo(patientInfoData)
                        }
                    } else {
                        // Response is not encrypted, use directly
                        setPatientInfo(patientInfoResponse.data)
                    }
                } catch (infoErr) {
                    console.error("Failed to fetch patient info, using registration data:", infoErr)
                    // Fallback: Create patient info from the preserved registration data
                    const patientInfoData: PatientInfo = {
                        patient_id: patientId,
                        first_name: preservedPatientData.first_name,
                        last_name: preservedPatientData.last_name,
                        gender: preservedPatientData.gender,
                        date_of_birth: preservedPatientData.date_of_birth,
                        age: parseInt(preservedPatientData.age) || 0,
                        mobile_number: preservedPatientData.mobile_number,
                        region_district: preservedPatientData.region_district,
                        city_village: preservedPatientData.city_village,
                        employment_status: preservedPatientData.employment_status,
                        highest_education_level: preservedPatientData.highest_education_level,
                        school_name: preservedPatientData.school_name,
                        school_phone_number: preservedPatientData.school_phone_number,
                        is_student: preservedPatientData.is_student
                    }
                    setPatientInfo(patientInfoData)
                }

                debugLog("PATIENT_REGISTRATION", "Patient registered successfully", { patientId, decryptedData })
            } else {
                // If user doesn't want to proceed, just show success message
                setSuccess(true)
                setTimeout(() => {
                    setSuccess(false)
                }, 5000)
            }

        } catch (err: any) {
            console.error("Registration error:", err)
            let errorMessage = "Failed to add patient"
            if (err.response?.data?.errors) {
                errorMessage = err.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ")
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message
            } else if (err.message) {
                errorMessage = err.message
            }
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // ADDED: reset all Phase 1 section/UI state before hydrating a new patient's data
    const resetPhase1ForNewSearch = (shf: string) => {
        const cleared = { ...initialPhase1FormState, shf_id: shf }
        setPhase1FormData(cleared)
        setSectionErrors({})
        setSectionSuccess({})
        setPhase1RegId(null)
        setLocks(null)
        setSearchedPatientId(null)
        setRegisteredPatientId(null)
        setPatientInfo(null)
        // ADD: ensure dialog hidden on new search
        setShowPhase1Complete(false)
    }

    // NEW: SHF ID search (aligned with Phase 2 UI/logic)
    const searchPatient = async () => {
        if (!phase1FormData.shf_id.trim()) {
            setSearchError("Please enter an SHF ID")
            return
        }

        setSearchLoading(true)
        setSearchError(null)
        // NEW: clear the current form first
        const shf = phase1FormData.shf_id.trim()
        resetPhase1ForNewSearch(shf)

        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token")
            const headers = token ? { Authorization: `Bearer ${token}` } : {}

            const response = await api.get(`/api/patients/shf?shf=${encodeURIComponent(shf)}`, { headers })

            if (response.data && typeof response.data.patient_id === "number") {
                const pid = response.data.patient_id
                setSearchedPatientId(pid)
                setPhase1FormData(prev => ({ ...prev, patient_id: pid }))
                setPatientFound(true)
                setSearchError(null)

                // fetch full patient info
                try {
                    await fetchPatientInfo(pid)
                } catch {}

                // hydrate existing Phase 1 data (if any) and show complete dialog if all sections are done
                try {
                    const summary = await loadPhaseData(pid)
                    if (summary?.all) {
                      setShowPhase1Complete(true)
                    }
                } catch {}
            } else {
                setSearchError("Patient not found with this SHF ID")
            }
        } catch (error: any) {
            const message = parseError(error)
            if (error?.response?.status === 404) {
                setSearchError(`Patient not found: ${message}`)
            } else if (error?.response?.status === 400) {
                setSearchError(`Invalid SHF ID: ${message}`)
            } else {
                setSearchError(message || "Failed to search for patient")
            }
        } finally {
            setSearchLoading(false)
        }
    }

    const resetForm = () => {
        setPatientData(INITIAL_PATIENT_STATE)
        setError(null)
        setSuccess(false)
        setShowPhase1Form(false)
        setPhase1FormData({ ...initialPhase1FormState })
        setSectionErrors({})
        setSectionSuccess({})
        setRegisteredPatientId(null)
        setSearchedPatientId(null)
        setPatientInfo(null)
        // NEW: reset link/search state
        setArrivedFromLink(false)
        setPatientFound(false)
    }

    const updatePatientData = (field: keyof PatientData, value: any) => {
        setPatientData(prev => ({ ...prev, [field]: value }))
    }

    const handleClose = () => {
        router.push("/forms")
    }

    const completedSections = Object.values(sectionSuccess).filter(Boolean).length
    const totalSections = 5

    function proceedToPhase1(event?: any): void {
        event?.preventDefault?.()

        // Open Phase 1 form (not via the "Already registered?" link)
        setArrivedFromLink(false)
        setShowPhase1Form(true)
        setSuccess(false)

        // Prefer the newly registered patient id, then searched id, then whatever is already in the form
        const pid = registeredPatientId ?? searchedPatientId ?? phase1FormData.patient_id

        if (pid && pid !== 0) {
            setPhase1FormData(prev => ({ ...prev, patient_id: pid }))
            // try to fetch full patient info (best-effort)
            fetchPatientInfo(pid).catch(() => { /* ignore fetch errors here */ })
        }

        // optional: bring the form into view
        try {
            window?.scrollTo?.({ top: 0, behavior: "smooth" })
        } catch {}
    }

    const parsePgTextArray = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
      if (typeof raw === "string") {
        // Handle Postgres text[] returned as "{Medication,Trauma}"
        const trimmed = raw.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          return trimmed
            .slice(1, -1)
            .split(",")
            .map(s => s.replace(/(^"|"$)/g, "").trim())
            .filter(Boolean);
        }
        // Comma separated plain
        return trimmed
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    const safeDateString = (v: any): string => {
      if (!v) return "";
      if (typeof v === "string") {
        const m = v.match(/^\d{4}-\d{2}-\d{2}/);
        if (m) return m[0];
        if (v.includes("T")) return v.split("T")[0];
        return v.slice(0, 10);
      }
      // If Date or timestamp: build YYYY-MM-DD using local getters (no UTC shift)
      try {
        const d = v instanceof Date ? v : new Date(Number(v));
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      } catch {
        return "";
      }
    };

    async function loadPhaseData(pid: number, regId?: number) {
      if (!pid) return;
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `/api/phases/combined/${pid}?phase1_reg_id=${regId || ""}`;
        const res = await api.get(url, { headers });
        const raw = res.data?.encrypted_data
          ? decryptObject(res.data.encrypted_data)
          : (res.data?.data ?? res.data);

        debugLog("PHASE1_LOAD", "Combined payload received", raw);

        // track completion summary without relying on setState ordering
        let doneRegistration = false;
        let doneEarScreening = false;
        let doneHearingScreening = false;
        let doneEarImpressions = false;
        let doneFinalQC = false;

        // UPDATED pickOption to use actual UI radio values
        const pickOption = (value: any, options: string[]) => {
          const s = String(value ?? "").trim().toLowerCase();
          return options.find(o => o.toLowerCase() === s) || "";
        };

        // Fallback: if registration not present, attempt direct fetch (adjust endpoint if needed)
        if (!raw.phase1?.registration) {
          try {
            const direct = await api.get(`/api/phase1/registration?patient_id=${pid}`, { headers });
            const directRaw = direct.data?.data || direct.data;
            raw.phase1 = raw.phase1 || {};
            raw.phase1.registration = directRaw || null;
            debugLog("PHASE1_LOAD", "Used fallback registration endpoint", directRaw);
          } catch (e) {
            debugLog("PHASE1_LOAD", "Fallback registration fetch failed", e);
          }
        }

        if (raw.phase1?.registration) {
          setPhase1RegId(raw.phase1_reg_id);
          const r = raw.phase1.registration;

          const normalized = {
            registration_date: r.registration_date || r.reg_date || r.date || "",
            city: r.city || r.phase1_city || "",
            has_hearing_loss: r.has_hearing_loss || r.hearing_loss || r.loss || "",
            uses_sign_language: r.uses_sign_language || r.sign_language || "",
            uses_speech: r.uses_speech || r.speech_use || "",
            hearing_loss_causes: parsePgTextArray(r.hearing_loss_causes),
            ringing_sensation: r.ringing_sensation || r.tinnitus_experience || "",
            ear_pain: r.ear_pain || r.pain || "",
            hearing_satisfaction_18_plus: r.hearing_satisfaction_18_plus || r.hearing_satisfaction || "",
            conversation_difficulty: r.conversation_difficulty || r.repeat_conversation || r.conversation_repeat || "",
          };

          debugLog("PHASE1_LOAD", "Normalized registration", normalized);

          setPhase1FormData(prev => ({
            ...prev,
            // Use safeDateString (no timezone shift)
            registration_date: safeDateString(normalized.registration_date) || prev.registration_date,
            city: normalized.city || prev.city,
            // keep values exactly as UI expects (case-insensitive match)
            has_hearing_loss: (() => {
              const v = String(normalized.has_hearing_loss ?? "").trim().toLowerCase();
              if (["yes", "undecided", "no"].includes(v)) return v === "yes" ? "Yes" : v; // UI uses "Yes","undecided","no"
              return prev.has_hearing_loss;
            })(),
            uses_sign_language: (() => {
              const v = String(normalized.uses_sign_language ?? "").trim().toLowerCase();
              if (v === "yes") return "Yes";
              if (v === "a little" || v === "alittle" || v === "little") return "A little";
              if (v === "no") return "no";
              return prev.uses_sign_language;
            })(),
            uses_speech: (() => {
              const v = String(normalized.uses_speech ?? "").trim().toLowerCase();
              if (v === "yes") return "Yes";
              if (v === "a little" || v === "alittle" || v === "little") return "A little";
              if (v === "no") return "no";
              return prev.uses_speech;
            })(),
            hearing_loss_causes: normalized.hearing_loss_causes.length ? normalized.hearing_loss_causes : prev.hearing_loss_causes,
            ringing_sensation: (() => {
              const v = String(normalized.ringing_sensation ?? "").trim().toLowerCase();
              if (["yes", "undecided", "no"].includes(v)) return v === "yes" ? "Yes" : v;
              return prev.ringing_sensation;
            })(),
            ear_pain: (() => {
              const v = String(normalized.ear_pain ?? "").trim().toLowerCase();
              if (v === "yes") return "Yes";
              if (v === "a little" || v === "alittle" || v === "little") return "A little";
              if (v === "no") return "No";
              return prev.ear_pain;
            })(),
            hearing_satisfaction_18_plus: (() => {
              const v = String(normalized.hearing_satisfaction_18_plus ?? "").trim().toLowerCase();
              if (v === "unsatisfied") return "Unsatisfied";
              if (v === "undecided") return "Undecided";
              if (v === "satisfied") return "Satisfied";
              return prev.hearing_satisfaction_18_plus;
            })(),
            conversation_difficulty: (() => {
              const v = String(normalized.conversation_difficulty ?? "").trim().toLowerCase();
              if (v === "no") return "No";
              if (v === "sometimes") return "Sometimes";
              if (v === "yes") return "Yes";
              return prev.conversation_difficulty;
            })(),
            patient_id: pid
          }));
          setSectionSuccess(p => ({ ...p, registration: true }));
          doneRegistration = true;
        } else {
          debugLog("PHASE1_LOAD", "No registration data found for patient", { pid });
        }

        if (raw.phase1?.earScreening?.length) {
          const es = raw.phase1.earScreening[0];
          // capture ID for update
          setP1Ids(prev => ({
            ...prev,
            earScreeningId: es.ear_screening_id || es.screening_id || prev.earScreeningId
          }));
          setPhase1FormData((prev) => ({
            ...prev,
            ears_clear_for_impressions:
              pickOption(es.ears_clear_for_impressions ?? es.ears_clear, ["Yes", "No"]) || prev.ears_clear_for_impressions,
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
            comments: es.comments || prev.comments,
            left_ear_clear_for_fitting: es.left_ear_clear_for_fitting || prev.left_ear_clear_for_fitting,
            right_ear_clear_for_fitting: es.right_ear_clear_for_fitting || prev.right_ear_clear_for_fitting,
          }));
          setSectionSuccess((p) => ({ ...p, earScreening: true }));
          doneEarScreening = true;
        }

        if (raw.phase1?.hearingScreening) {
          const hs = raw.phase1.hearingScreening;
          setP1Ids(prev => ({
            ...prev,
            hearingScreeningId: hs.hearing_screen_id || hs.screening_id || prev.hearingScreeningId
          }));
          setPhase1FormData((prev) => ({
            ...prev,
            screening_method: pickOption(hs.screening_method, ["Audiogram", "WFA® Voice Test"]) || prev.screening_method,
            left_ear_result: pickOption(hs.left_ear_result, ["Pass", "Fail"]) || prev.left_ear_result,
            right_ear_result: pickOption(hs.right_ear_result, ["Pass", "Fail"]) || prev.right_ear_result,
            hearing_satisfaction_18_plus_pass:
              pickOption(hs.hearing_satisfaction_18_plus_pass, ["Unsatisfied", "Undecided", "Satisfied"]) ||
              prev.hearing_satisfaction_18_plus_pass,
          }));
          setSectionSuccess((p) => ({ ...p, hearingScreening: true }));
          doneHearingScreening = true;
        }

        if (raw.phase1?.earImpressions?.length) {
          const ei = raw.phase1.earImpressions[0];
          setP1Ids(prev => ({
            ...prev,
            earImpressionId: ei.impression_id || ei.ear_impression_id || prev.earImpressionId
          }));
          setPhase1FormData((prev) => ({
            ...prev,
            ear_impression: pickOption(ei.ear_impression, ["Left", "Right"]) || prev.ear_impression,
            impression_comments: ei.comment || prev.impression_comments,
          }));
          setSectionSuccess((p) => ({ ...p, earImpressions: true }));
          doneEarImpressions = true;
        }

        if (raw.phase1?.finalQC) {
          const qc = raw.phase1.finalQC;
          setP1Ids(prev => ({
            ...prev,
            finalQcId: qc.final_qc_id || qc.qc_id || prev.finalQcId
          }));
          setPhase1FormData((prev) => ({
            ...prev,
            ear_impressions_inspected_collected: !!qc.ear_impressions_inspected_collected,
            shf_id_number_id_card_given: !!qc.shf_id_number_id_card_given,
          }));
          setSectionSuccess((p) => ({ ...p, finalQC: true }));
          doneFinalQC = true;
        }

        setLocks(raw.locks);

        // RETURN completion summary so callers (search flow) can decide to show dialog
        return {
          registration: doneRegistration,
          earScreening: doneEarScreening,
          hearingScreening: doneHearingScreening,
          earImpressions: doneEarImpressions,
          finalQC: doneFinalQC,
          all: doneRegistration && doneEarScreening && doneHearingScreening && doneEarImpressions && doneFinalQC,
        };
      } catch (e) {
        console.warn("loadPhaseData phase1 failed", e);
        debugLog("PHASE1_LOAD", "Error fetching phase1 data", e);
        return null;
      }
    }

    // Call after patient identified
    useEffect(()=>{
      const pid = registeredPatientId ?? searchedPatientId ?? phase1FormData.patient_id;
      if(pid) loadPhaseData(pid);
    },[registeredPatientId,searchedPatientId]);

    const isLocked = (_section:string)=>false; // always allow updates

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-10xl mx-auto">
                {/* ADD: Phase 1 Completed Dialog */}
                <Dialog open={showPhase1Complete} onOpenChange={setShowPhase1Complete}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Phase 1 already completed</DialogTitle>
                      <DialogDescription>
                        This patient has completed all Phase 1 sections. You can proceed to Phase 2.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowPhase1Complete(false)}>
                        Stay in Phase 1
                      </Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => router.push("/forms/phase2")}
                      >
                        Proceed to Phase 2
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {/* Header */}
                <div className="flex items-center space-x-3 mb-6">
                        <User className="h-6 w-6 text-blue-700" />
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        {showPhase1Form ? "Phase 1 Form" : "Patient Registration"}
                    </h1>
                </div>

                {!showPhase1Form ? (
                    /* Patient Registration Form - KEEP THIS PART THE SAME */
                    <Card className="shadow-lg overflow-hidden">
                        <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100 pb-3">
                            <CardTitle className="p-3 text-xl flex items-center gap-2 text-gray-900">
                                <Users className="h-6 w-6 text-green-600" />
                                Register New Patient
                            </CardTitle>
                            <CardDescription className="text-base text-gray-600">
                                Fill in the patient details below.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Name Row */}
                                <div className="grid grid-cols-4 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="last_name" className="text-sm font-medium text-gray-700">Last Name *</Label>
                                        <Input
                                            id="last_name"
                                            value={patientData.last_name}
                                            onChange={(e) => updatePatientData("last_name", e.target.value)}
                                            required
                                            className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="first_name" className="text-sm font-medium text-gray-700">First Name *</Label>
                                        <Input
                                            id="first_name"
                                            value={patientData.first_name}
                                            onChange={(e) => updatePatientData("first_name", e.target.value)}
                                            required
                                            className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="mobile_number" className="text-sm font-medium text-gray-700">Mobile Number</Label>
                                        <Input
                                            id="mobile_number"
                                            value={patientData.mobile_number}
                                            onChange={(e) => updatePatientData("mobile_number", e.target.value)}
                                            placeholder="+63912345678"
                                            className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="alternative_number" className="text-sm font-medium text-gray-700">Alternative Number</Label>
                                        <Input
                                            id="alternative_number"
                                            value={patientData.alternative_number}
                                            onChange={(e) => updatePatientData("alternative_number", e.target.value)}
                                            placeholder="+63923456789"
                                            className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Personal Details Row */}
                                <div className="grid grid-cols-5 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="gender" className="text-sm font-medium text-gray-700">Gender *</Label>
                                        <Select
                                            value={patientData.gender}
                                            onValueChange={(value) => updatePatientData("gender", value)}
                                        >
                                            <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white data-[placeholder]:text-gray-500">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="date_of_birth" className="text-sm font-medium text-gray-700">Date of Birth *</Label>
                                        <div className="relative">
                                            <Input
                                                id="date_of_birth"
                                                type="date"
                                                value={patientData.date_of_birth}
                                                onChange={(e) => updatePatientData("date_of_birth", e.target.value)}
                                                required
                                                className="flex h-10 text-sm bg-white border-gray-300 focus:bg-white pl-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="age" className="text-sm font-medium text-gray-700">Age</Label>
                                        <Input
                                            id="age"
                                            type="number"
                                            value={patientData.age}
                                            onChange={(e) => updatePatientData("age", e.target.value)}
                                            className="h-10 text-sm bg-white border-gray-300"
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="employment_status" className="text-sm font-medium text-gray-700">Employment</Label>
                                        <Select
                                            value={patientData.employment_status}
                                            onValueChange={(value) => updatePatientData("employment_status", value)}
                                        >
                                            <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white data-[placeholder]:text-gray-500">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Employed">Employed</SelectItem>
                                                <SelectItem value="Self Employed">Self Employed</SelectItem>
                                                <SelectItem value="Not Employed">Not Employed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="highest_education_level" className="text-sm font-medium text-gray-700">Education Level</Label>
                                        <Select
                                            value={patientData.highest_education_level}
                                            onValueChange={(value) => updatePatientData("highest_education_level", value)}
                                        >
                                            <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white data-[placeholder]:text-gray-500">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="None">None</SelectItem>
                                                <SelectItem value="Primary">Primary</SelectItem>
                                                <SelectItem value="Secondary">Secondary</SelectItem>
                                                <SelectItem value="Post Secondary">Post Secondary</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Contact Information Row */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="region_district" className="text-sm font-medium text-gray-700">Region/District</Label>
                                        <Select
                                            value={patientData.region_district}
                                            onValueChange={(value) => updatePatientData("region_district", value)}
                                        >
                                            <SelectTrigger className="w-full h-10 min-h-10 px-3 text-sm bg-white border border-gray-300 rounded-md focus:bg-white data-[placeholder]:text-gray-500">
                                                <SelectValue placeholder="Select Region" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="National Capital Region (NCR)">National Capital Region (NCR)</SelectItem>
                                                <SelectItem value="Cordillera Administrative Region (CAR)">Cordillera Administrative Region (CAR)</SelectItem>
                                                <SelectItem value="Ilocos Region (Region I)">Ilocos Region (Region I)</SelectItem>
                                                <SelectItem value="Cagayan Valley (Region II)">Cagayan Valley (Region II)</SelectItem>
                                                <SelectItem value="Central Luzon (Region III)">Central Luzon (Region III)</SelectItem>
                                                <SelectItem value="CALABARZON (Region IV-A)">CALABARZON (Region IV-A)</SelectItem>
                                                <SelectItem value="MIMAROPA (Region IV-B)">MIMAROPA (Region IV-B)</SelectItem>
                                                <SelectItem value="Bicol Region (Region V)">Bicol Region (Region V)</SelectItem>
                                                <SelectItem value="Western Visayas (Region VI)">Western Visayas (Region VI)</SelectItem>
                                                <SelectItem value="Central Visayas (Region VII)">Central Visayas (Region VII)</SelectItem>
                                                <SelectItem value="Eastern Visayas (Region VIII)">Eastern Visayas (Region VIII)</SelectItem>
                                                <SelectItem value="Zamboanga Peninsula (Region IX)">Zamboanga Peninsula (Region IX)</SelectItem>
                                                <SelectItem value="Northern Mindanao (Region X)">Northern Mindanao (Region X)</SelectItem>
                                                <SelectItem value="Davao Region (Region XI)">Davao Region (Region XI)</SelectItem>
                                                <SelectItem value="SOCCSKSARGEN (Region XII)">SOCCSKSARGEN (Region XII)</SelectItem>
                                                <SelectItem value="Caraga (Region XIII)">Caraga (Region XIII)</SelectItem>
                                                <SelectItem value="Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)">
                                                    Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city_village" className="text-sm font-medium text-gray-700">City/Village</Label>
                                        <Input
                                            id="city_village"
                                            value={patientData.city_village}
                                            onChange={(e) => updatePatientData("city_village", e.target.value)}
                                            className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Student Information Section */}
                                <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-white">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="is_student"
                                            checked={patientData.is_student}
                                            onCheckedChange={(checked) => updatePatientData("is_student", !!checked)}
                                            className="h-4 w-4"
                                        />
                                        <Label htmlFor="is_student" className="text-sm font-medium text-gray-700">Current Student</Label>
                                    </div>

                                    {patientData.is_student && (
                                        <div className="grid grid-cols-2 gap-6 pt-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="school_name" className="text-sm font-medium text-gray-700">School Name *</Label>
                                                <Input
                                                    id="school_name"
                                                    value={patientData.school_name}
                                                    onChange={(e) => updatePatientData("school_name", e.target.value)}
                                                    required={patientData.is_student}
                                                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="school_phone_number" className="text-sm font-medium text-gray-700">School Phone Number</Label>
                                                <Input
                                                    id="school_phone_number"
                                                    value={patientData.school_phone_number}
                                                    onChange={(e) => updatePatientData("school_phone_number", e.target.value)}
                                                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Status Messages */}
                                {error && (
                                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <p className="text-red-700 text-sm">{error}</p>
                                    </div>
                                )}

                                {success && !showPhase1Form && (
                                    <div className="flex flex-col gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            <p className="text-green-700 text-sm font-medium">
                                                ✓ Patient registered successfully with ID: {registeredPatientId}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={proceedToPhase1}
                                                className="h-8 px-4 text-sm bg-green-600 hover:bg-green-700"
                                            >
                                                Proceed to Phase 1 Form
                                            </Button>
                                            <Button
                                                onClick={resetForm}
                                                variant="outline"
                                                className="h-8 px-4 text-sm"
                                            >
                                                Register Another Patient
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Form Actions */}
                                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resetForm}
                                        className="h-10 px-6 text-sm border-gray-300"
                                    >
                                        Clear Form
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="h-10 px-6 text-sm bg-green-600 hover:bg-green-700"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {loading ? "Registering..." : "Register Patient"}
                                    </Button>
                                </div>
                                <div className="pt-2 text-right">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArrivedFromLink(true)
                                            setShowPhase1Form(true)
                                        }}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Already registered?
                                    </button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                ) : (

                    /* Phase 1 Form - with Patient Search (if from link) */
                    <div className="space-y-6">
                       {/* Progress Indicator */}
                        <div className="px-6 py-3 bg-blue-25 border-b rounded">
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
                                        width: `${(completedSections / totalSections) * 100}%`
                                    }}
                                />
                            </div>
                        </div>

                        <ScrollArea className="h-[calc(100vh-200px)] w-full pr-4">
                                                    {/* NEW: Patient Search (shown when opened from link and no newly registered patient) */}
                        {arrivedFromLink && !registeredPatientId && (
                            <div className="space-y-6 p-6">
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
                                                value={phase1FormData.shf_id}
                                                onChange={(e) => handlePhase1InputChange("shf_id", e.target.value)}
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
                            </div>
                        )}
                            <div className="space-y-6 p-6">
                                <Card className="shadow-lg overflow-hidden bg-gray">
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
                                                <Label htmlFor="reg-date" className="text-sm font-medium">
                                                    Registration Date
                                                </Label>
                                                <div className="relative">
                                                    <Input
                                                        id="reg-date"
                                                        type="date"
                                                        value={phase1FormData.registration_date}
                                                        onChange={(e) => handlePhase1InputChange("registration_date", e.target.value)}
                                                        className="flex h-10 text-sm bg-white border-gray-300 focus:bg-white pl-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="city" className="text-sm font-medium">
                                                    Phase 1 City
                                                </Label>
                                                <Input
                                                    id="city"
                                                    placeholder="Phase 1 City"
                                                    value={phase1FormData.city}
                                                    onChange={(e) => handlePhase1InputChange("city", e.target.value)}
                                                    className="h-10 text-sm bg-white border-gray-300 focus:bg-white"
                                                />
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-sm text-lg">General Questions</h4>

                                            <div className="grid grid-cols-3 gap-6">
                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>1. Do you have a hearing loss?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.has_hearing_loss}
                                                        onValueChange={(value) => handlePhase1InputChange("has_hearing_loss", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Yes" id="hearing-loss-Yes" />
                                                            <Label htmlFor="hearing-loss-Yes" className="text-sm font-medium cursor-pointer">
                                                                Yes
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="undecided" id="hearing-loss-undecided" />
                                                            <Label htmlFor="hearing-loss-undecided" className="text-sm font-medium cursor-pointer">
                                                                Undecided
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="no" id="hearing-loss-no" />
                                                            <Label htmlFor="hearing-loss-no" className="text-sm font-medium cursor-pointer">
                                                                No
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>2. Do you use sign language?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.uses_sign_language}
                                                        onValueChange={(value) => handlePhase1InputChange("uses_sign_language", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Yes" id="sign-lang-Yes" />
                                                            <Label htmlFor="sign-lang-Yes" className="text-sm font-medium cursor-pointer">
                                                                Yes
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="A little" id="sign-lang-a-little" />
                                                            <Label htmlFor="sign-lang-a-little" className="text-sm font-medium cursor-pointer">
                                                                A Little
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="no" id="sign-lang-no" />
                                                            <Label htmlFor="sign-lang-no" className="text-sm font-medium cursor-pointer">
                                                                No
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>3. Do you use speech?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.uses_speech}
                                                        onValueChange={(value) => handlePhase1InputChange("uses_speech", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Yes" id="speech-Yes" />
                                                            <Label htmlFor="speech-Yes" className="text-sm font-medium cursor-pointer">
                                                                Yes
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="A little" id="speech-a-little" />
                                                            <Label htmlFor="speech-a-little" className="text-sm font-medium cursor-pointer">
                                                                A Little
                                                            </Label>
                                                                                                               </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="no" id="speech-no" />
                                                            <Label htmlFor="speech-no" className="text-sm font-medium cursor-pointer">
                                                                No
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-6">
                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>4. Hearing Loss Cause:</strong></Label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {hearingLossCauses.map((cause) => {
                                                            const id = `cause-${cause.toLowerCase().replace(/\s/g, '-')}`
                                                            const checked = phase1FormData.hearing_loss_causes.includes(cause)

                                                            return (
                                                                <div key={cause} className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={id}
                                                                        checked={checked}
                                                                        onChange={(e) => {
                                                                            const isChecked = e.target.checked
                                                                            setPhase1FormData((prev) => {
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
                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>5. Do you experience a ringing sensation in your ear?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.ringing_sensation}
                                                        onValueChange={(value) => handlePhase1InputChange("ringing_sensation", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Yes" id="ringing-Yes" />
                                                            <Label htmlFor="ringing-Yes" className="text-sm font-medium cursor-pointer">
                                                                Yes
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="undecided" id="ringing-undecided" />
                                                            <Label htmlFor="ringing-undecided" className="text-sm font-medium cursor-pointer">
                                                                Undecided
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="no" id="ringing-no" />
                                                            <Label htmlFor="ringing-no" className="text-sm font-medium cursor-pointer">
                                                                No
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>6. Do you have pain in your ear?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.ear_pain}
                                                        onValueChange={(value) => handlePhase1InputChange("ear_pain", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Yes" id="pain-Yes" />
                                                            <Label htmlFor="pain-Yes" className="text-sm font-medium cursor-pointer">
                                                                Yes
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="A little" id="pain-a-little" />
                                                            <Label htmlFor="pain-a-little" className="text-sm font-medium cursor-pointer">
                                                                A Little
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="No" id="pain-no" />
                                                            <Label htmlFor="pain-no" className="text-sm font-medium cursor-pointer">
                                                                No
                                                            </Label>
                                                        </div>

                                                    </RadioGroup>
                                                </div>
                                            </div>


                                            <div className="text-lg">(FOR PATIENTS 18 & OLDER)</div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>7. How satisfied are you with your hearing?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.hearing_satisfaction_18_plus}
                                                        onValueChange={(value) => handlePhase1InputChange("hearing_satisfaction_18_plus", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Unsatisfied" id="satisfaction-unsatisfied" />
                                                            <Label htmlFor="satisfaction-unsatisfied" className="text-sm font-medium cursor-pointer">
                                                                Unsatisfied
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Undecided" id="satisfaction-undecided" />
                                                            <Label htmlFor="satisfaction-undecided" className="text-sm font-medium cursor-pointer">
                                                                Undecided
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Satisfied" id="satisfaction-satisfied" />
                                                            <Label htmlFor="satisfaction-satisfied" className="text-sm font-medium cursor-pointer">
                                                                Satisfied
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-25">
                                                    <Label className="text-sm font-medium"><strong>8. Do you ask people to repeat themselves or speak louder in conversation?</strong></Label>
                                                    <RadioGroup
                                                        value={phase1FormData.conversation_difficulty}
                                                        onValueChange={(value) => handlePhase1InputChange("conversation_difficulty", value)}
                                                        className="space-y-2"
                                                    >
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="No" id="repeat-no" />
                                                            <Label htmlFor="repeat-no" className="text-sm font-medium cursor-pointer">
                                                                No
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Sometimes" id="repeat-sometimes" />
                                                            <Label htmlFor="repeat-sometimes" className="text-sm font-medium cursor-pointer">
                                                                Sometimes
                                                            </Label>
                                                        </div>
                                                        <div className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                            <RadioGroupItem value="Yes" id="repeat-yes" />
                                                            <Label htmlFor="repeat-yes" className="text-sm font-medium cursor-pointer">
                                                                Yes
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
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

                                        <div className="flex justify-end pt-4">
                                            <Button
                                                onClick={submitRegistrationSection}
                                                className="h-10 px-6 text-sm bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors"
                                            >
                                              {phase1RegId ? "Update Registration" : "Save Registration"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Ear Screening Section */}
                                <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                            <Ear className="h-5 w-5 text-green-600" />
                                            2. Ear Screening & Otoscopy
                                            {sectionSuccess.earScreening && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                                            {sectionErrors.earScreening && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="pt-6 space-y-8">
                                        {/* Section 2A: Initial Ear Clearance for Impressions */}
                                        <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-white">
                                          <Label className="text-sm font-medium block text-gray-700 mb-1">
                                            Ears Clear for Impressions (IF YES, SKIP TO SECTION 3):
                                          </Label>
                                          <RadioGroup
                                            value={phase1FormData.ears_clear_for_impressions}
                                            onValueChange={(value) => handlePhase1InputChange("ears_clear_for_impressions", value)}
                                            className="flex flex-wrap gap-4"
                                          >
                                            <div className="bg-gray-50 flex items-center space-x-2 p-2 rounded-md border border-gray-200 hover:bg-gray-100 transition">
                                              <RadioGroupItem value="Yes" id="ears-clear-yes" />
                                              <Label htmlFor="ears-clear-yes" className="text-sm cursor-pointer">
                                                Yes
                                              </Label>
                                            </div>
                                            <div className="bg-gray-50 flex items-center space-x-2 p-2 rounded-md border border-gray-200 hover:bg-gray-100 transition">
                                              <RadioGroupItem value="No" id="ears-clear-no" />
                                              <Label htmlFor="ears-clear-no" className="text-sm cursor-pointer">
                                                No
                                              </Label>
                                            </div>
                                          </RadioGroup>
                                        </div>

                                        {/* Section 2B: OTOSCOPY (hidden when bothEarsClear) */}
                                        {!bothEarsClear && (
                                            <>
                                                <Separator className="my-6" />
                                                <h3 className="text-base font-semibold text-emerald-700 flex items-center gap-2">
                                                    <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                                                    2B. Otoscopy
                                                </h3>

                                                {/* Ear Findings Section */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-50 transition-colorsshadow-sm">
                                                    {/* Left Ear Findings */}
                                                    <div className="space-y-4 ">
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
                                                                    className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                                                                >
                                                                    <Checkbox
                                                                        id={`left-${key}`}
                                                                        checked={(phase1FormData as any)[`left_${key}`] || false}
                                                                        onCheckedChange={(checked) =>
                                                                            handlePhase1InputChange(`left_${key}` as keyof Phase1FormData, checked)
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
                                                                    className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                                                                >
                                                                    <Checkbox
                                                                        id={`right-${key}`}
                                                                        checked={(phase1FormData as any)[`right_${key}`] || false}
                                                                        onCheckedChange={(checked) =>
                                                                            handlePhase1InputChange(`right_${key}` as keyof Phase1FormData, checked)
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

                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Medical Recommendation */}
                                                    <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                                                        <Label className="text-sm font-medium block text-gray-700 mb-2">
                                                            Medical Recommendation
                                                        </Label>
                                                        <RadioGroup
                                                            className="flex space-x-8"
                                                            value={phase1FormData.medical_recommendation}
                                                            onValueChange={(value) => handlePhase1InputChange("medical_recommendation", value)}
                                                        >
                                                            {["Left", "Right"].map((side) => (
                                                                <div
                                                                    key={side}
                                                                    className="bg-white flex items-center space-x-3 p-2 rounded-lg border border-gray-200 transition-colors"
                                                                >
                                                                    <RadioGroupItem value={side} id={`med_${side.toLowerCase()}`} />
                                                                    <Label
                                                                        htmlFor={`med_${side.toLowerCase()}`}
                                                                        className="text-sm cursor-pointer text-gray-800 font-medium"
                                                                    >
                                                                        {side}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </RadioGroup>
                                                    </div>

                                                    {/* Medication Given */}
                                                    <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-white transition-colors shadow-sm">
                                                        <Label className="text-sm font-medium block text-gray-700 mb-2">
                                                            Medication Given
                                                        </Label>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {medications.map((med) => (
                                                                <div
                                                                    key={med}
                                                                    className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 transition-colors"
                                                                >
                                                                    <Checkbox
                                                                        id={`med-${med.toLowerCase()}`}
                                                                        checked={(phase1FormData as any)[`medication_${med.toLowerCase()}`] || false}
                                                                        onCheckedChange={(checked) =>
                                                                            handlePhase1InputChange(`medication_${med.toLowerCase()}` as keyof Phase1FormData, checked)
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
                                                </div>

                                                {/* Comments */}
                                                <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray transition-colors shadow-sm">
                                                    <Label htmlFor="comments" className="text-sm font-medium text-gray-700">
                                                        Comments
                                                    </Label>
                                                    <Textarea
                                                        id="comments"
                                                        value={phase1FormData.comments}
                                                        onChange={(e) => handlePhase1InputChange("comments", e.target.value)}
                                                        className="bg-white h-24 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors rounded-lg whitespace-pre-wrap break-words w-full"
                                                        placeholder="Enter additional notes here..."
                                                        wrap="soft"
                                                    />
                                                </div>
                                            </>
                                        )}

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

                                        <div className="flex justify-end pt-4">
                                            <Button
                                                onClick={submitEarScreeningSection}
                                                className="h-10 px-6 text-sm bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors"
                                            >
                                              {p1Ids.earScreeningId ? "Update Ear Screening & Otoscopy" : "Save Ear Screening & Otoscopy"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Hearing Screening Section */}
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
                                                <Label className="text-sm font-medium block">Screening Method</Label>
                                                <RadioGroup
                                                    value={phase1FormData.screening_method}
                                                    onValueChange={(value) => handlePhase1InputChange("screening_method", value)}
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
                                                    value={phase1FormData.left_ear_result}
                                                    onValueChange={(value) => handlePhase1InputChange("left_ear_result", value)}
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
                                                    value={phase1FormData.right_ear_result}
                                                    onValueChange={(value) => handlePhase1InputChange("right_ear_result", value)}
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
                                                    value={phase1FormData.hearing_satisfaction_18_plus_pass}
                                                    onValueChange={(value) => handlePhase1InputChange("hearing_satisfaction_18_plus_pass", value)}
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
                                        {sectionSuccess.hearingScreening && (
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
                                              {p1Ids.hearingScreeningId ? "Update Hearing Screening" : "Save Hearing Screening"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Ear Impressions Section */}
                                <Card>
                                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <ClipboardCheck className="h-5 w-5 text-orange-600" />
                                            4. Ear Impressions
                                            {sectionSuccess.earImpressions && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                                            {sectionErrors.earImpressions && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-6 pt-6">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="space-y-3 p-5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                <Label className="text-sm font-medium block text-gray-700">
                                                    Ear Impressions:
                                                </Label>
                                                <RadioGroup
                                                    value={phase1FormData.ear_impression}
                                                    onValueChange={(value) => handlePhase1InputChange("ear_impression", value)}
                                                    className="space-y-3 pt-2"
                                                >
                                                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                                        <RadioGroupItem value="Left" id="side-left" />
                                                        <Label htmlFor="side-left" className="text-sm cursor-pointer">Left</Label>
                                                    </div>
                                                    <div className="bg-white flex items-center space-x-2 p-2 rounded-lg border border-gray-200 hover:bg-white transition-colors">
                                                        <RadioGroupItem value="Right" id="side-right" />
                                                        <Label htmlFor="side-right" className="text-sm cursor-pointer">Right</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>

                                            <div className="col-span-2 space-y-3 p-5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                <Label htmlFor="impression-comments" className="text-sm font-medium block text-gray-700">
                                                    Comments:
                                                </Label>
                                                <Textarea
                                                    id="impression-comments"
                                                    placeholder="Additional comments"
                                                    value={phase1FormData.impression_comments}
                                                    onChange={(e) => handlePhase1InputChange("impression_comments", e.target.value)}
                                                    className="bg-white h-24 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                                />
                                            </div>
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
                                                className="h-10 px-6 text-sm bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors"
                                            >
                                              {p1Ids.earImpressionId ? "Update Ear Impressions" : "Save Ear Impressions"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Final QC Section */}
                                <Card>
                                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-gray-600" />
                                            5. Final Quality Control
                                            {sectionSuccess.finalQC && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                                            {sectionErrors.finalQC && <AlertCircle className="h-5 w-5 text-red-600 ml-auto" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                <Checkbox
                                                    id="impressions-inspected"
                                                    checked={phase1FormData.ear_impressions_inspected_collected}
                                                    onCheckedChange={(checked) => handlePhase1InputChange("ear_impressions_inspected_collected", checked)}
                                                />
                                                <Label htmlFor="impressions-inspected" className="text-md font-medium cursor-pointer">
                                                    Ear Impressions Inspected & Collected
                                                </Label>
                                            </div>

                                            <div className="bg-white flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                                                <Checkbox
                                                    id="shf-id-given"
                                                    checked={phase1FormData.shf_id_number_id_card_given}
                                                    onCheckedChange={(checked) => handlePhase1InputChange("shf_id_number_id_card_given", checked)}
                                                />
                                                <Label htmlFor="shf-id-given" className="text-md font-medium cursor-pointer">
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
                                                className="h-10 px-6 text-sm bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors"
                                            >
                                              {p1Ids.finalQcId ? "Update Final QC" : "Save Final QC"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    )
}