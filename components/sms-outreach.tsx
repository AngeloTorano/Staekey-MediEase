"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SmsOutreach() {
  // Mock missions and patients
  const mockMissions = [
    { id: 1, city: "Manila", title: "Phase 1 Screening - Manila" },
    { id: 2, city: "Cebu City", title: "Phase 2 Fitting - Cebu City" },
    { id: 3, city: "Davao City", title: "Phase 3 AfterCare - Davao City" },
  ]

  const mockPatients = [
    { id: 1, name: "Maria Santos", city: "Manila", mobile: "+63912345678" },
    { id: 2, name: "Juan Cruz", city: "Cebu City", mobile: "+63923456789" },
    { id: 3, name: "Ana Garcia", city: "Davao City", mobile: "+63934567890" },
    { id: 4, name: "Pedro Gomez", city: "Manila", mobile: "+63945678901" },
  ]

  const [selectedMission, setSelectedMission] = useState<string>("")
  const [selectedPatients, setSelectedPatients] = useState<number[]>([])
  const [message, setMessage] = useState<string>("")
  const [status, setStatus] = useState<string | null>(null)

  const patientsInCity = mockPatients.filter((p) => {
    if (!selectedMission) return false
    const mission = mockMissions.find((m) => String(m.id) === selectedMission)
    return mission ? p.city === mission.city : false
  })

  const togglePatient = (id: number) => {
    setSelectedPatients((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedMission) {
      setStatus("Please select a mission/city.")
      return
    }
    if (!selectedPatients.length) {
      setStatus("Please select at least one patient.")
      return
    }
    if (!message.trim()) {
      setStatus("Message cannot be empty.")
      return
    }

    // Simulate send
    const recipients = mockPatients.filter((p) => selectedPatients.includes(p.id))
    console.log("Sending SMS to:", recipients, "message:", message)

    // Persist send log to localStorage for UI reporting
    try {
      const existing = JSON.parse(localStorage.getItem("smsSends") || "[]")
      const mission = mockMissions.find((m) => String(m.id) === selectedMission)
      const entry = {
        timestamp: new Date().toISOString(),
        missionId: selectedMission,
        missionTitle: mission?.title || null,
        recipients: recipients.map((r) => ({ id: r.id, name: r.name, mobile: r.mobile })),
        message,
      }
      localStorage.setItem("smsSends", JSON.stringify([entry, ...existing].slice(0, 50)))
    } catch (e) {
      // ignore storage errors
    }

    setStatus(`Message sent to ${recipients.length} patient(s).`)
    setMessage("")
    setSelectedPatients([])
  }

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Select Mission / City</label>
          <Select value={selectedMission} onValueChange={setSelectedMission}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a mission" />
            </SelectTrigger>
            <SelectContent>
              {mockMissions.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium mb-1 block">Select Patients</label>
          <div className="grid gap-2">
            {patientsInCity.length === 0 && <div className="text-sm text-muted-foreground">No patients for selected mission.</div>}
            {patientsInCity.map((p) => (
              <label key={p.id} className="flex items-center space-x-2">
                <input type="checkbox" checked={selectedPatients.includes(p.id)} onChange={() => togglePatient(p.id)} />
                <span className="text-sm">{p.name} — {p.mobile}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Message</label>
        <Textarea className="h-40" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enter SMS message (160 char recommended)" />
      </div>

      <div className="flex items-center space-x-2">
        <Button type="submit">Send SMS</Button>
        {status && <div className="text-sm text-muted-foreground">{status}</div>}
      </div>
    </form>
  )
}
