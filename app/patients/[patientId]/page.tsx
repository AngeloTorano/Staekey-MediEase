"use client"

import React, { useEffect, useState, useRef } from "react"
import axios from "axios"
import { useParams, useRouter, useSearchParams } from "next/navigation" // ADDED
import { decryptObject } from "@/utils/decrypt"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

type AnyObj = Record<string, any>

export default function PatientDetailPage() {
  const routeParams = useParams() as { patientId?: string }
  const router = useRouter()
  const searchParams = useSearchParams() // ADDED
  const patientId = String(routeParams?.patientId ?? "").trim()

  const [data, setData] = useState<AnyObj | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [p3Selected, setP3Selected] = useState<any | null>(null)
  const p3DetailsRef = useRef<HTMLDivElement | null>(null)
  const [showP3List, setShowP3List] = useState(true)

  // NEW: phase 3 registration-scoped state
  const [p3Registrations, setP3Registrations] = useState<any[]>([])
  const [p3Sections, setP3Sections] = useState<any | null>(null)
  const [p3Loading, setP3Loading] = useState<boolean>(false)
  const [p3Error, setP3Error] = useState<string | null>(null)
  const initialP3RegId = searchParams?.get("p3RegId") || ""
  const [p3RegId, setP3RegId] = useState<string>(initialP3RegId)

  const formatDate = (v: any) => {
    if (!v) return "—"
    const d = new Date(v)
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString()
  }
  const yesNo = (v: any) => {
    if (v === null || v === undefined || v === "") return "—"
    if (typeof v === "boolean") return v ? "Yes" : "No"
    if (typeof v === "number") return v ? "Yes" : "No"
    if (typeof v === "string") {
      const s = v.toLowerCase()
      if (["yes", "y", "true", "1"].includes(s)) return "Yes"
      if (["no", "n", "false", "0"].includes(s)) return "No"
    }
    return String(v)
  }

  useEffect(() => {
    if (!patientId) return
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await api.get(`/api/patients/${encodeURIComponent(patientId)}/full`, { headers })

        let payload: any = null
        if (res.data?.encrypted_data) {
          try {
            payload = decryptObject(res.data.encrypted_data)
          } catch {
            setError("Failed to decrypt response")
          }
        } else if (res.data?.data) {
          payload = res.data.data
        } else {
          payload = res.data
        }

        setData(payload || null)
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load patient data"
        )
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [patientId])

  // Helper: unwrap API payload and decrypt if necessary
  const unpack = (raw: any) => {
    try {
      const base = raw?.data ?? raw
      if (base?.encrypted_data) {
        const decrypted = decryptObject(base.encrypted_data)
        return decrypted?.data ?? decrypted
      }
      return base?.data ?? base
    } catch (e) {
      console.error("Failed to unpack response", e)
      return null
    }
  }

  // NEW: fetch list of Phase 3 registrations for patient
  useEffect(() => {
    if (!patientId) return
    const fetchRegistrations = async () => {
      try {
        setP3Error(null)
        const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await api.get(`/api/phase3/registration`, {
          headers,
          params: { patient_id: patientId, limit: 100, page: 1 },
        })
        const payload = unpack(res)
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload?.data) ? payload.data : []
        setP3Registrations(rows)
      } catch (e: any) {
        setP3Error(e?.response?.data?.message || e?.message || "Failed to load Phase 3 registrations")
      }
    }
    fetchRegistrations()
  }, [patientId])

  // NEW: fetch sections for a given phase3_reg_id
  const fetchP3SectionsByRegId = async (regId: string | number) => {
    if (!patientId || !regId) return
    try {
      setP3Loading(true)
      setP3Error(null)
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.get(`/api/phase3/sections/${encodeURIComponent(patientId)}/${encodeURIComponent(String(regId))}`, { headers })
      const payload = unpack(res)
      setP3Sections(payload || null)
      setShowP3List(false)
    } catch (e: any) {
      setP3Error(e?.response?.data?.message || e?.message || "Failed to load Phase 3 details")
    } finally {
      setP3Loading(false)
    }
  }

  // NEW: deep-link support (?p3RegId=)
  useEffect(() => {
    if (patientId && initialP3RegId) {
      fetchP3SectionsByRegId(initialP3RegId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, initialP3RegId])

  // UPDATED: list click handler - prefer regId-based fetch, fallback to old combined row
  const onViewAftercare = (row: any) => {
    const regId = row?.phase3_reg_id || row?.p3_reg_id || row?.reg_id
    if (regId) {
      setP3RegId(String(regId))
      fetchP3SectionsByRegId(regId)
      requestAnimationFrame(() => {
        p3DetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
      return
    }
    // fallback to old combined data path
    setP3Selected(row)
    setShowP3List(false)
    requestAnimationFrame(() => {
      p3DetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const onBackToList = () => {
    setP3Selected(null)
    setP3Sections(null)
    setP3RegId("")
    setShowP3List(true)
  }

  // ADDED: global back button handler
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/patients")
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>
  if (!data) return <div className="p-6">No data</div>

  const patient = data.patient || {}
  const p1 = data.phase1 || {}
  const p2 = data.phase2 || {}

  // Phase 3 can have multiple entries. Support arrays from backend:
  // Prefer data.phase3_list or data.phase3Entries; fallback to single object.
  const rawList =
    (Array.isArray(data.phase3_list) && data.phase3_list) ||
    (Array.isArray(data.phase3Entries) && data.phase3Entries) ||
    (data.phase3 ? [data.phase3] : [])
  const p3List = [...rawList].sort((a, b) => {
    const da = new Date(a?.p3_assessment_created_at || a?.p3_registration_date || a?.created_at || 0).getTime()
    const db = new Date(b?.p3_assessment_created_at || b?.p3_registration_date || b?.created_at || 0).getTime()
    return db - da
  })

  // NEW: prefer backend registrations list if available
  const registrationRows = (p3Registrations && p3Registrations.length > 0) ? p3Registrations : p3List

  // Alias for fallback renderer (was referenced as sp3 but not defined)
  const sp3 = p3Selected

  return (
    <div className="p-6 space-y-6">
<div className="flex">
  <Button variant="outline" onClick={goBack}>
    <ArrowLeft className="mr-2 h-4 w-4" /> Back
  </Button>
</div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Patient: {patient.last_name || "—"}, {patient.first_name || "—"}</span>
            {patient.shf_id && <Badge variant="secondary">{patient.shf_id}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div><strong>Gender:</strong> {patient.gender || "—"}</div>
          <div><strong>Date of Birth:</strong> {formatDate(patient.date_of_birth)}</div>
          <div><strong>Age:</strong> {patient.age ?? "—"}</div>
          <div><strong>Region/District:</strong> {patient.region_district || "—"}</div>
          <div><strong>City/Village:</strong> {patient.city_village || "—"}</div>
          <div><strong>Mobile:</strong> {patient.mobile_number || "—"}</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="p1" className="w-full ">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="p1">Phase 1</TabsTrigger>
          <TabsTrigger value="p2">Phase 2</TabsTrigger>
          <TabsTrigger value="p3">Phase 3</TabsTrigger>
        </TabsList>

        {/* Phase 1 */}
        <TabsContent value="p1" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Registration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Date:</strong> {formatDate(p1.p1_registration_date)}</div>
              <div><strong>City:</strong> {p1.p1_city || "—"}</div>
              <div><strong>Has Hearing Loss:</strong> {yesNo(p1.p1_has_hearing_loss)}</div>
              <div><strong>Uses Sign Language:</strong> {yesNo(p1.p1_uses_sign_language)}</div>
              <div><strong>Uses Speech:</strong> {yesNo(p1.p1_uses_speech)}</div>
              <div><strong>Hearing Loss Causes:</strong> {Array.isArray(p1.p1_hearing_loss_causes) ? p1.p1_hearing_loss_causes.join(", ") || "—" : (p1.p1_hearing_loss_causes || "—")}</div>
              <div><strong>Ringing Sensation:</strong> {p1.p1_ringing_sensation || "—"}</div>
              <div><strong>Ear Pain:</strong> {p1.p1_ear_pain || "—"}</div>
              <div><strong>Hearing Satisfaction (18+):</strong> {p1.p1_hearing_satisfaction_18_plus || "—"}</div>
              <div><strong>Ask Repeat in Conversation:</strong> {p1.p1_conversation_difficulty || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ear Screening & Otoscopy</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Ears Clear:</strong> {p1.p1_es_ears_clear || "—"}</div>
              <div><strong>Left Clear for Fitting:</strong> {p1.p1_es_left_clear_for_fitting || "—"}</div>
              <div><strong>Right Clear for Fitting:</strong> {p1.p1_es_right_clear_for_fitting || "—"}</div>
              <div><strong>Wax:</strong> {yesNo(p1.p1_es_otc_wax)}</div>
              <div><strong>Infection:</strong> {yesNo(p1.p1_es_otc_infection)}</div>
              <div><strong>Perforation:</strong> {yesNo(p1.p1_es_otc_perforation)}</div>
              <div><strong>Tinnitus:</strong> {yesNo(p1.p1_es_otc_tinnitus)}</div>
              <div><strong>Atresia:</strong> {yesNo(p1.p1_es_otc_atresia)}</div>
              <div><strong>Implant:</strong> {yesNo(p1.p1_es_otc_implant)}</div>
              <div className="md:col-span-3"><strong>Medical Recommendation:</strong> {p1.p1_es_medical_recommendation || "—"}</div>
              <div className="md:col-span-3"><strong>Medication Given:</strong> {Array.isArray(p1.p1_es_medication_given) ? (p1.p1_es_medication_given.filter(Boolean).join(", ") || "—") : (p1.p1_es_medication_given || "—")}</div>
              <div className="md:col-span-3"><strong>Comments:</strong> {p1.p1_es_comments || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hearing Screening</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Method:</strong> {p1.p1_hs_method || "—"}</div>
              <div><strong>Left Result:</strong> {p1.p1_hs_left_result || "—"}</div>
              <div><strong>Right Result:</strong> {p1.p1_hs_right_result || "—"}</div>
              <div><strong>Satisfaction 18+ (Pass):</strong> {p1.p1_hs_satisfaction_pass || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ear Impressions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Impression:</strong> {p1.p1_ear_impression || "—"}</div>
              <div className="md:col-span-2"><strong>Comments:</strong> {p1.p1_ear_impression_comment || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Final QC</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Impressions Collected:</strong> {yesNo(p1.p1_qc_impressions_collected)}</div>
              <div><strong>ID Card Given:</strong> {yesNo(p1.p1_qc_id_card_given)}</div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phase 2 */}
        <TabsContent value="p2" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Registration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Date:</strong> {formatDate(p2.p2_registration_date)}</div>
              <div><strong>City:</strong> {p2.p2_city || "—"}</div>
              <div><strong>Patient Type:</strong> {p2.p2_patient_type || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ear Screening & Otoscopy</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Ears Clear:</strong> {p2.p2_es_ears_clear || "—"}</div>
              <div><strong>Wax:</strong> {yesNo(p2.p2_es_otc_wax)}</div>
              <div><strong>Infection:</strong> {yesNo(p2.p2_es_otc_infection)}</div>
              <div><strong>Perforation:</strong> {yesNo(p2.p2_es_otc_perforation)}</div>
              <div><strong>Tinnitus:</strong> {yesNo(p2.p2_es_otc_tinnitus)}</div>
              <div><strong>Atresia:</strong> {yesNo(p2.p2_es_otc_atresia)}</div>
              <div><strong>Implant:</strong> {yesNo(p2.p2_es_otc_implant)}</div>
              <div><strong>Other:</strong> {yesNo(p2.p2_es_otc_other)}</div>
              <div className="md:col-span-3"><strong>Medical Recommendation:</strong> {p2.p2_es_medical_recommendation || "—"}</div>
              <div className="md:col-span-3"><strong>Medication Given:</strong> {Array.isArray(p2.p2_es_medication_given) ? (p2.p2_es_medication_given.filter(Boolean).join(", ") || "—") : (p2.p2_es_medication_given || "—")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hearing Screening</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Method:</strong> {p2.p2_hs_method || "—"}</div>
              <div><strong>Left Result:</strong> {p2.p2_hs_left_result || "—"}</div>
              <div><strong>Right Result:</strong> {p2.p2_hs_right_result || "—"}</div>
              <div><strong>Satisfaction 18+ (Pass):</strong> {p2.p2_hs_satisfaction_pass || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fitting Table</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 p-2 text-left">Side</th>
                      <th className="border border-gray-300 p-2">Power Level</th>
                      <th className="border border-gray-300 p-2">Volume</th>
                      <th className="border border-gray-300 p-2">Model</th>
                      <th className="border border-gray-300 p-2">Battery</th>
                      <th className="border border-gray-300 p-2">Earmold</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2 font-semibold">Left</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_left_power_level || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_left_volume || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_left_model || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_left_battery || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_left_earmold || "—"}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2 font-semibold">Right</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_right_power_level || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_right_volume || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_right_model || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_right_battery || "—"}</td>
                      <td className="border border-gray-300 p-2 text-center">{p2.p2_ft_right_earmold || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fitting</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong># Hearing Aids:</strong> {p2.p2_f_number_of_hearing_aid ?? "—"}</div>
              <div><strong>Special Device:</strong> {p2.p2_f_special_device || "—"}</div>
              <div><strong>Normal Hearing:</strong> {yesNo(p2.p2_f_normal_hearing)}</div>
              <div><strong>Distortion:</strong> {yesNo(p2.p2_f_distortion)}</div>
              <div><strong>Implant:</strong> {yesNo(p2.p2_f_implant)}</div>
              <div><strong>Recruitment:</strong> {yesNo(p2.p2_f_recruitment)}</div>
              <div><strong>No Response:</strong> {yesNo(p2.p2_f_no_response)}</div>
              <div><strong>Other:</strong> {yesNo(p2.p2_f_other)}</div>
              <div><strong>Clear for Counseling:</strong> {yesNo(p2.p2_f_clear_for_counseling)}</div>
              <div className="md:col-span-3"><strong>Comment:</strong> {p2.p2_f_comment || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Counseling</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Aftercare Info Given:</strong> {yesNo(p2.p2_c_received_aftercare_info)}</div>
              <div><strong>Student Ambassador Trained:</strong> {yesNo(p2.p2_c_trained_student_amb)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Final QC</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><strong>Batteries 13:</strong> {p2.p2_qc_batt_13 ?? "—"}</div>
              <div><strong>Batteries 675:</strong> {p2.p2_qc_batt_675 ?? "—"}</div>
              <div><strong>Satisfaction (18+):</strong> {p2.p2_qc_satisfaction_18_plus || "—"}</div>
              <div><strong>Confirmation:</strong> {p2.p2_qc_confirmation || "—"}</div>
              <div className="md:col-span-3"><strong>QC Comments:</strong> {p2.p2_qc_comments || "—"}</div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phase 3 */}
        <TabsContent value="p3" className="space-y-6">
          {showP3List ? (
            <Card>
              <CardHeader><CardTitle>Aftercare Records</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {p3Error && <div className="text-red-600 mb-2">{p3Error}</div>}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 p-2 text-left">Phase</th>
                        <th className="border border-gray-300 p-2 text-left">Name</th>
                        <th className="border border-gray-300 p-2 text-left">Country</th>
                        <th className="border border-gray-300 p-2 text-left">Phase City</th>
                        <th className="border border-gray-300 p-2 text-left">Date</th>
                        <th className="border border-gray-300 p-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrationRows.length === 0 && (
                        <tr>
                          <td className="border border-gray-300 p-2 text-center" colSpan={6}>No aftercare records</td>
                        </tr>
                      )}
                      {registrationRows.map((row: any, idx: number) => {
                        // Rows from /api/phase3/registration
                        const regId = row.phase3_reg_id || row.p3_reg_id || row.reg_id
                        const dateVal =
                          row.registration_date || row.p3_registration_date ||
                          row.p3_assessment_created_at || row.created_at
                        const country = row.country || row.p3_country
                        const city = row.city || row.p3_city
                        return (
                          <tr key={regId ? `reg-${regId}` : idx}>
                            <td className="border border-gray-300 p-2">Phase 3</td>
                            <td className="border border-gray-300 p-2">AfterCare</td>
                            <td className="border border-gray-300 p-2">{country || "—"}</td>
                            <td className="border border-gray-300 p-2">{city || "—"}</td>
                            <td className="border border-gray-300 p-2">{formatDate(dateVal)}</td>
                            <td className="border border-gray-300 p-2">
                              <Button size="sm" onClick={() => onViewAftercare(row)}>
                                {regId ? "View" : "View Aftercare"}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end gap-2 items-center">
                <Button variant="outline" size="sm" onClick={onBackToList}>Back to Aftercare Records</Button>
              </div>

              <div ref={p3DetailsRef} />
              {p3Loading ? (
                <div>Loading Phase 3 details...</div>
              ) : p3Sections ? (
                <>
                  {(() => {
                    const reg = p3Sections.sections?.registration || null
                    const es = (p3Sections.sections?.earScreenings || [])[0] || null
                    const aa = (p3Sections.sections?.aftercareAssessments || [])[0] || null
                    const fqc = (p3Sections.sections?.finalQCs || [])[0] || null
                    return (
                      <>
                        <Card>
                          <CardHeader><CardTitle>Registration (Aftercare)</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Date:</strong> {formatDate(reg?.registration_date)}</div>
                            <div><strong>Country:</strong> {reg?.country || "—"}</div>
                            <div><strong>City:</strong> {reg?.city || "—"}</div>
                            <div><strong>Aftercare Type:</strong> {reg?.type_of_aftercare || "—"}</div>
                            <div className="md:col-span-3"><strong>Service Center/School:</strong> {reg?.service_center_school_name || "—"}</div>
                            <div><strong>Return Visit (Pick-up/Repair):</strong> {yesNo(reg?.return_visit_custom_earmold_repair)}</div>
                            <div className="md:col-span-2"><strong>Problem With HA/Earmold:</strong> {reg?.problem_with_hearing_aid_earmold || "—"}</div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader><CardTitle>Aftercare Assessment</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="md:col-span-3"><strong>Assessment Date:</strong> {formatDate(aa?.created_at)}</div>
                            <div className="md:col-span-3 font-semibold">Hearing Aid Evaluation</div>
                            <div>Dead/Broken: {yesNo(aa?.eval_hearing_aid_dead_broken)}</div>
                            <div>Internal Feedback: {yesNo(aa?.eval_hearing_aid_internal_feedback)}</div>
                            <div>Power Change Needed: {yesNo(aa?.eval_hearing_aid_power_change_needed)}</div>
                            <div>Power Too Low: {yesNo(aa?.eval_hearing_aid_power_change_too_low)}</div>
                            <div>Power Too Loud: {yesNo(aa?.eval_hearing_aid_power_change_too_loud)}</div>
                            <div>Lost/Stolen: {yesNo(aa?.eval_hearing_aid_lost_stolen)}</div>
                            <div>No Problem: {yesNo(aa?.eval_hearing_aid_no_problem)}</div>

                            <div className="md:col-span-3 font-semibold pt-2">Earmold Evaluation</div>
                            <div>Too Tight (Discomfort): {yesNo(aa?.eval_earmold_discomfort_too_tight)}</div>
                            <div>Feedback/Too Loose: {yesNo(aa?.eval_earmold_feedback_too_loose)}</div>
                            <div>Damaged/Tubing Cracked: {yesNo(aa?.eval_earmold_damaged_tubing_cracked)}</div>
                            <div>Lost/Stolen: {yesNo(aa?.eval_earmold_lost_stolen)}</div>
                            <div>No Problem: {yesNo(aa?.eval_earmold_no_problem)}</div>

                            <div className="md:col-span-3 font-semibold pt-2">Services Completed</div>
                            <div>Tested with WFA Demo Aids: {yesNo(aa?.service_tested_wfa_demo_hearing_aids)}</div>
                            <div>Sent for Repair/Replacement: {yesNo(aa?.service_hearing_aid_sent_for_repair_replacement)}</div>
                            <div>Not Benefiting from HA: {yesNo(aa?.service_not_benefiting_from_hearing_aid)}</div>
                            <div>Refit New Hearing Aid: {yesNo(aa?.service_refit_new_hearing_aid)}</div>
                            <div>Retubed/Unplugged Earmold: {yesNo(aa?.service_retubed_unplugged_earmold)}</div>
                            <div>Modified Earmold: {yesNo(aa?.service_modified_earmold)}</div>
                            <div>Fit Stock Earmold: {yesNo(aa?.service_fit_stock_earmold)}</div>
                            <div>Took New Ear Impression: {yesNo(aa?.service_took_new_ear_impression)}</div>
                            <div>Refit Custom Earmold: {yesNo(aa?.service_refit_custom_earmold)}</div>

                            <div className="md:col-span-3 font-semibold pt-2">General Services</div>
                            <div>Counseling: {yesNo(aa?.gs_counseling)}</div>
                            <div>Battery 13 Qty: {aa?.gs_batteries_13_qty ?? "—"}</div>
                            <div>Battery 675 Qty: {aa?.gs_batteries_675_qty ?? "—"}</div>
                            <div>Refer Aftercare Center: {yesNo(aa?.gs_refer_aftercare_service_center)}</div>
                            <div>Refer Next Phase 2 Mission: {yesNo(aa?.gs_refer_next_phase2_mission)}</div>
                            <div className="md:col-span-3"><strong>Comments:</strong> {aa?.comment || "—"}</div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader><CardTitle>Ear Screening & Otoscopy</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Ears Clear:</strong> {es?.ears_clear ?? "—"}</div>
                            <div><strong>Wax:</strong> {yesNo(es?.otc_wax)}</div>
                            <div><strong>Infection:</strong> {yesNo(es?.otc_infection)}</div>
                            <div><strong>Perforation:</strong> {yesNo(es?.otc_perforation)}</div>
                            <div><strong>Other:</strong> {yesNo(es?.otc_other)}</div>
                            <div className="md:col-span-3"><strong>Medical Recommendation:</strong> {es?.medical_recommendation || "—"}</div>
                            <div><strong>Left Clear for Fitting:</strong> {es?.left_ear_clear_for_fitting ?? "—"}</div>
                            <div><strong>Right Clear for Fitting:</strong> {es?.right_ear_clear_for_fitting ?? "—"}</div>
                            <div className="md:col-span-3"><strong>Comments:</strong> {es?.comments || "—"}</div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader><CardTitle>Final QC</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div><strong>Satisfaction (18+):</strong> {fqc?.hearing_aid_satisfaction_18_plus ?? "—"}</div>
                            <div><strong>Asks People to Repeat:</strong> {fqc?.ask_people_to_repeat_themselves ?? "—"}</div>
                            <div className="md:col-span-3"><strong>Notes from SHF:</strong> {fqc?.notes_from_shf ?? "—"}</div>
                          </CardContent>
                        </Card>
                      </>
                    )
                  })()}
                </>
              ) : !p3Selected ? (
                <div className="text-sm text-gray-600 px-1">Select an aftercare row to view details.</div>
              ) : (
                // Fallback to your previous combined-details renderer
                <>
                  {/* render using p3Selected (sp3 alias) if needed */}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}