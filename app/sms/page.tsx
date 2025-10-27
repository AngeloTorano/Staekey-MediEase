"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Recipient = { id: number; name: string; phone: string; city: string; optedOut?: boolean }

const SAMPLE_MISSIONS = [
  { id: "m1", title: "Manila — Phase 1 Screening" },
  { id: "m2", title: "Cebu City — Phase 2 Fitting" },
  { id: "m3", title: "Davao City — Phase 3 AfterCare" },
]

export default function SmsPage() {
  const [missionId, setMissionId] = useState<string>(SAMPLE_MISSIONS[0].id)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [message, setMessage] = useState("Hello from SHF — reply STOP to opt-out.")
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("smsSends") || "[]"))
    } catch { setHistory([]) }

    const sample: Recipient[] = Array.from({ length: 20 }).map((_, i) => ({
      id: i + 1,
      name: `Recipient ${i + 1}`,
      phone: `+63917000${String(10 + i)}`,
      city: ["Manila", "Cebu", "Davao", "Iloilo"][i % 4],
      optedOut: i % 13 === 0,
    }))
    setRecipients(sample)
    const pre: Record<number, boolean> = {}
    sample.slice(0, 6).forEach((r) => (pre[r.id] = true))
    setSelected(pre)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipients.filter((r) => {
      if (!q) return true
      return r.name.toLowerCase().includes(q) || r.phone.includes(q) || r.city.toLowerCase().includes(q)
    })
  }, [recipients, query])

  const toggle = (id: number) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const selectAll = () => {
    const all: Record<number, boolean> = {}
    filtered.forEach((r) => { if (!r.optedOut) all[r.id] = true })
    setSelected(all)
  }
  const clear = () => setSelected({})

  const recipientsSelected = useMemo(() => recipients.filter((r) => selected[r.id] && !r.optedOut), [recipients, selected])

  const send = async () => {
    if (recipientsSelected.length === 0) { alert("No recipients selected.") ; return }
    if (!message.trim()) { alert("Empty message.") ; return }

    const payload = {
      missionId,
      missionTitle: SAMPLE_MISSIONS.find((m) => m.id === missionId)?.title,
      recipients: recipientsSelected,
      message,
      timestamp: Date.now(),
      simulateFailure,
    }

    await new Promise((r) => setTimeout(r, 400))

    if (simulateFailure) {
      // show failure UI but keep history unchanged
      alert("Simulated server error (500). Use retry.")
      console.error("Simulated failure", payload)
      return
    }

    const next = [payload, ...history].slice(0, 50)
    localStorage.setItem("smsSends", JSON.stringify(next))
    setHistory(next)
    alert(`Sent ${recipientsSelected.length} messages`)
    // keep message for repeated testing, clear selection for convenience
    setSelected({})
  }

  const resend = (item: any) => {
    // quick resend: restore message, select recipients (only those still available and not opted out)
    setMessage(item.message)
    const sel: Record<number, boolean> = {}
    item.recipients?.forEach((r: any) => {
      const found = recipients.find((x) => x.phone === r.phone)
      if (found && !found.optedOut) sel[found.id] = true
    })
    setSelected(sel)
    setMissionId(item.missionId)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">SMS Outreach — Alternate UI</h1>
          <p className="text-sm text-muted-foreground">Search, filter, preview and send. Local test mode.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={missionId} onValueChange={setMissionId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SAMPLE_MISSIONS.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" onClick={() => { localStorage.removeItem("smsSends"); setHistory([]) }}>Clear History</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-5 bg-card rounded p-4 border">
          <div className="flex items-center gap-2 mb-3">
            <Input placeholder="Search name, phone or city" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button onClick={selectAll}>Select All</Button>
            <Button variant="outline" onClick={clear}>Clear</Button>
          </div>

          <div className="max-h-[60vh] overflow-auto space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className={`flex items-center justify-between p-2 rounded ${r.optedOut ? "bg-red-50" : "bg-white"}`}>
                <div>
                  <div className="font-medium">{r.name} {r.optedOut && <span className="text-xs text-red-600"> (Opted out)</span>}</div>
                  <div className="text-xs text-muted-foreground">{r.phone} • {r.city}</div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggle(r.id)} disabled={r.optedOut} />
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-sm text-muted-foreground p-2">No recipients match the search.</div>}
          </div>
        </section>

        <section className="col-span-7 bg-card rounded p-4 border space-y-3">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <Label>Message</Label>
              <Textarea className="h-50"rows={100} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="text-xs text-muted-foreground mt-1">Chars: {message.length} — Recipients selected: {recipientsSelected.length}</div>
            </div>

            <div className="w-48">
              <Label>Options</Label>
              <div className="flex items-center gap-2 mt-2">
                <input id="simFail" type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
                <label htmlFor="simFail" className="text-sm">Simulate Failure</label>
              </div>

              <div className="mt-4">
                <Button onClick={send} className="w-full">Send Now</Button>
                <Button variant="outline" onClick={() => { setMessage("Reminder: appointment tomorrow at 09:00. Reply STOP to opt-out."); selectAll() }} className="w-full mt-2">Load Reminder Template</Button>
              </div>
            </div>
          </div>

          <div>
            <Label>Preview</Label>
            <div className="p-3 bg-white rounded border whitespace-pre-wrap">{message}</div>
          </div>

          <div>
            <Label>Send History</Label>
            <div className="max-h-40 overflow-auto mt-2 space-y-2">
              {history.length === 0 && <div className="text-sm text-muted-foreground">No sends yet</div>}
              {history.map((h) => (
                <div key={h.timestamp} className="p-2 border rounded flex justify-between items-center">
                  <div className="text-sm">
                    <div className="font-medium">{h.missionTitle}</div>
                    <div className="text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleString()} • {h.recipients?.length ?? 0} recipients</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => resend(h)}>Resend</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}