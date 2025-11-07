"use client"

import React, { useEffect, useState, useRef } from "react"
import axios from "axios"
import { useParams, useRouter } from "next/navigation" // ADDED
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
  const router = useRouter() // ADDED
  const patientId = String(routeParams?.patientId ?? "").trim()

  const [data, setData] = useState<AnyObj | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [p3Selected, setP3Selected] = useState<any | null>(null)
  const p3DetailsRef = useRef<HTMLDivElement | null>(null)
  const [showP3List, setShowP3List] = useState(true) // NEW: toggle list vs details

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

  const onViewAftercare = (row: any) => {
    setP3Selected(row)
    setShowP3List(false) // hide table, show cards
    requestAnimationFrame(() => {
      p3DetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const onBackToList = () => {
    setP3Selected(null)
    setShowP3List(true) // show table again
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
  // Sort newest first by assessment/registration/created_at
  const p3List = [...rawList].sort((a, b) => {
    const da = new Date(a?.p3_assessment_created_at || a?.p3_registration_date || a?.created_at || 0).getTime()
    const db = new Date(b?.p3_assessment_created_at || b?.p3_registration_date || b?.created_at || 0).getTime()
    return db - da
  })
  const sp3 = p3Selected // selected Phase 3 row for details

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
          {/* List view */}
          {showP3List ? (
            <Card>
              <CardHeader><CardTitle>Aftercare Records</CardTitle></CardHeader>
              <CardContent className="text-sm">
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
                      {p3List.length === 0 && (
                        <tr>
                          <td className="border border-gray-300 p-2 text-center" colSpan={6}>No aftercare records</td>
                        </tr>
                      )}
                      {p3List.map((row, idx) => {
                        const dateVal = row.p3_assessment_created_at || row.p3_registration_date || row.created_at
                        return (
                          <tr key={idx}>
                            <td className="border border-gray-300 p-2">Phase 3</td>
                            <td className="border border-gray-300 p-2">AfterCare</td>
                            <td className="border border-gray-300 p-2">{row.p3_country || row.country || "—"}</td>
                            <td className="border border-gray-300 p-2">{row.p3_city || row.city || "—"}</td>
                            <td className="border border-gray-300 p-2">{formatDate(dateVal)}</td>
                            <td className="border border-gray-300 p-2">
                              <Button size="sm" onClick={() => onViewAftercare(row)}>View Aftercare</Button>
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
            // Details view
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={onBackToList}>Back to Aftercare Records</Button>
              </div>

              <div ref={p3DetailsRef} />
              {!sp3 ? (
                <div className="text-sm text-gray-600 px-1">Select an aftercare row to view details.</div>
              ) : (
                <>
                  <Card>
                    <CardHeader><CardTitle>Registration (Aftercare)</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div><strong>Date:</strong> {formatDate(sp3.p3_registration_date || sp3.registration_date)}</div>
                      <div><strong>Country:</strong> {sp3.p3_country || sp3.country || "—"}</div>
                      <div><strong>City:</strong> {sp3.p3_city || sp3.city || "—"}</div>
                      <div><strong>Aftercare Type:</strong> {sp3.p3_type_of_aftercare || sp3.type_of_aftercare || "—"}</div>
                      <div className="md:col-span-3"><strong>Service Center/School:</strong> {sp3.p3_service_center_school_name || sp3.service_center_school_name || "—"}</div>
                      <div><strong>Return Visit (Pick-up/Repair):</strong> {yesNo(sp3.p3_return_visit_custom_earmold_repair ?? sp3.return_visit_custom_earmold_repair)}</div>
                      <div className="md:col-span-2"><strong>Problem With HA/Earmold:</strong> {sp3.p3_problem_with_hearing_aid_earmold || sp3.problem_with_hearing_aid_earmold || "—"}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Aftercare Assessment</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="md:col-span-3"><strong>Assessment Date:</strong> {formatDate(sp3.p3_assessment_created_at || sp3.assessment_created_at)}</div>
                      <div className="md:col-span-3 font-semibold">Hearing Aid Evaluation</div>
                      <div>Dead/Broken: {yesNo(sp3.p3_eval_aid_dead_broken ?? sp3.eval_hearing_aid_dead_broken)}</div>
                      <div>Internal Feedback: {yesNo(sp3.p3_eval_aid_internal_feedback ?? sp3.eval_hearing_aid_internal_feedback)}</div>
                      <div>Power Change Needed: {yesNo(sp3.p3_eval_aid_power_change_needed ?? sp3.eval_hearing_aid_power_change_needed)}</div>
                      <div>Power Too Low: {yesNo(sp3.p3_eval_aid_power_change_too_low ?? sp3.eval_hearing_aid_power_change_too_low)}</div>
                      <div>Power Too Loud: {yesNo(sp3.p3_eval_aid_power_change_too_loud ?? sp3.eval_hearing_aid_power_change_too_loud)}</div>
                      <div>Lost/Stolen: {yesNo(sp3.p3_eval_aid_lost_stolen ?? sp3.eval_hearing_aid_lost_stolen)}</div>
                      <div>No Problem: {yesNo(sp3.p3_eval_aid_no_problem ?? sp3.eval_hearing_aid_no_problem)}</div>

                      <div className="md:col-span-3 font-semibold pt-2">Earmold Evaluation</div>
                      <div>Too Tight (Discomfort): {yesNo(sp3.p3_eval_earmold_discomfort_too_tight ?? sp3.eval_earmold_discomfort_too_tight)}</div>
                      <div>Feedback/Too Loose: {yesNo(sp3.p3_eval_earmold_feedback_too_loose ?? sp3.eval_earmold_feedback_too_loose)}</div>
                      <div>Damaged/Tubing Cracked: {yesNo(sp3.p3_eval_earmold_damaged_tubing_cracked ?? sp3.eval_earmold_damaged_tubing_cracked)}</div>
                      <div>Lost/Stolen: {yesNo(sp3.p3_eval_earmold_lost_stolen ?? sp3.eval_earmold_lost_stolen)}</div>
                      <div>No Problem: {yesNo(sp3.p3_eval_earmold_no_problem ?? sp3.eval_earmold_no_problem)}</div>

                      <div className="md:col-span-3 font-semibold pt-2">Services Completed</div>
                      <div>Tested with WFA Demo Aids: {yesNo(sp3.p3_service_tested_wfa_demo_hearing_aids ?? sp3.service_tested_wfa_demo_hearing_aids)}</div>
                      <div>Sent for Repair/Replacement: {yesNo(sp3.p3_service_sent_for_repair ?? sp3.service_hearing_aid_sent_for_repair_replacement)}</div>
                      <div>Not Benefiting from HA: {yesNo(sp3.p3_service_not_benefiting ?? sp3.service_not_benefiting_from_hearing_aid)}</div>
                      <div>Refit New Hearing Aid: {yesNo(sp3.p3_service_refit_new_aid ?? sp3.service_refit_new_hearing_aid)}</div>
                      <div>Retubed/Unplugged Earmold: {yesNo(sp3.p3_service_retubed_unplugged_earmold ?? sp3.service_retubed_unplugged_earmold)}</div>
                      <div>Modified Earmold: {yesNo(sp3.p3_service_modified_earmold ?? sp3.service_modified_earmold)}</div>
                      <div>Fit Stock Earmold: {yesNo(sp3.p3_service_fit_stock_earmold ?? sp3.service_fit_stock_earmold)}</div>
                      <div>Took New Ear Impression: {yesNo(sp3.p3_service_took_new_ear_impression ?? sp3.service_took_new_ear_impression)}</div>
                      <div>Refit Custom Earmold: {yesNo(sp3.p3_service_refit_custom_earmold ?? sp3.service_refit_custom_earmold)}</div>

                      <div className="md:col-span-3 font-semibold pt-2">General Services</div>
                      <div>Counseling: {yesNo(sp3.p3_gs_counseling ?? sp3.gs_counseling)}</div>
                      <div>Batteries Provided: {yesNo(sp3.p3_gs_batteries_provided ?? sp3.gs_batteries_provided)}</div>
                      <div>Battery 13 Qty: {sp3.p3_gs_batteries_13_qty ?? sp3.gs_batteries_13_qty ?? "—"}</div>
                      <div>Battery 675 Qty: {sp3.p3_gs_batteries_675_qty ?? sp3.gs_batteries_675_qty ?? "—"}</div>
                      <div>Refer Aftercare Center: {yesNo(sp3.p3_gs_refer_aftercare_center ?? sp3.gs_refer_aftercare_service_center)}</div>
                      <div>Refer Next Phase 2 Mission: {yesNo(sp3.p3_gs_refer_next_phase2_mission ?? sp3.gs_refer_next_phase2_mission)}</div>

                      <div className="md:col-span-3"><strong>Comments:</strong> {sp3.p3_aftercare_comment || sp3.comment || "—"}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Ear Screening & Otoscopy</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div><strong>Ears Clear:</strong> {sp3.p3_es_ears_clear ?? sp3.ears_clear ?? "—"}</div>
                      <div><strong>Wax:</strong> {yesNo(sp3.p3_es_otc_wax ?? sp3.otc_wax)}</div>
                      <div><strong>Infection:</strong> {yesNo(sp3.p3_es_otc_infection ?? sp3.otc_infection)}</div>
                      <div><strong>Perforation:</strong> {yesNo(sp3.p3_es_otc_perforation ?? sp3.otc_perforation)}</div>
                      <div><strong>Tinnitus:</strong> {yesNo(sp3.p3_es_otc_tinnitus ?? sp3.otc_tinnitus)}</div>
                      <div><strong>Atresia:</strong> {yesNo(sp3.p3_es_otc_atresia ?? sp3.otc_atresia)}</div>
                      <div><strong>Implant:</strong> {yesNo(sp3.p3_es_otc_implant ?? sp3.otc_implant)}</div>
                      <div><strong>Other:</strong> {yesNo(sp3.p3_es_otc_other ?? sp3.otc_other)}</div>
                      <div className="md:col-span-3"><strong>Medical Recommendation:</strong> {sp3.p3_es_medical_recommendation || sp3.medical_recommendation || "—"}</div>
                      <div><strong>Left Clear for Fitting:</strong> {sp3.p3_es_left_clear_for_fitting ?? sp3.left_ear_clear_for_fitting ?? "—"}</div>
                      <div><strong>Right Clear for Fitting:</strong> {sp3.p3_es_right_clear_for_fitting ?? sp3.right_ear_clear_for_fitting ?? "—"}</div>
                      <div className="md:col-span-3"><strong>Comments:</strong> {sp3.p3_es_comments || sp3.comments || "—"}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Final QC</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div><strong>Satisfaction (18+):</strong> {sp3.p3_qc_satisfaction_18_plus ?? sp3.hearing_aid_satisfaction_18_plus ?? "—"}</div>
                      <div><strong>Asks People to Repeat:</strong> {sp3.p3_qc_ask_repeat ?? sp3.ask_people_to_repeat_themselves ?? "—"}</div>
                      <div className="md:col-span-3"><strong>Notes from SHF:</strong> {sp3.p3_qc_notes ?? sp3.notes_from_shf ?? "—"}</div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}