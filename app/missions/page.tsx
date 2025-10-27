"use client"

import React, { useEffect, useMemo, useState } from "react"
import axios from "axios"

type Mission = {
  id?: number
  title: string
  date: string // ISO
  start_time: string // "09:00"
  end_time: string // "12:00"
  location: string
  team_lead?: string
  notes?: string
  status?: "planned" | "in-progress" | "completed" | "cancelled"
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
  withCredentials: true,
})

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Mission | null>(null)
  const initialForm: Mission = {
    title: "",
    date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "12:00",
    location: "",
    team_lead: "",
    notes: "",
    status: "planned",
  }
  const [form, setForm] = useState<Mission>(initialForm)

  useEffect(() => {
    loadMissions()
  }, [])

  const loadMissions = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await api.get("/api/missions", { headers })
      setMissions(res.data || [])
    } catch (err: any) {
      console.error("Failed to load missions", err)
      setError(err.response?.data?.error || err.message || "Failed to load missions")
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...initialForm })
    setShowForm(true)
  }

  const openEdit = (m: Mission) => {
    setEditing(m)
    setForm({ ...m })
    setShowForm(true)
  }

  const submitForm = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      if (editing?.id) {
        const res = await api.put(`/api/missions/${editing.id}`, form, { headers })
        setMissions((prev) => prev.map((p) => (p.id === editing.id ? res.data : p)))
      } else {
        const res = await api.post("/api/missions", form, { headers })
        setMissions((prev) => [res.data, ...prev])
      }
      setShowForm(false)
    } catch (err: any) {
      console.error("Submit mission failed", err)
      setError(err.response?.data?.error || err.message || "Failed to submit mission")
    }
  }

  const removeMission = async (id?: number) => {
    if (!id || !confirm("Delete this mission?")) return
    setError(null)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await api.delete(`/api/missions/${id}`, { headers })
      setMissions((prev) => prev.filter((m) => m.id !== id))
    } catch (err: any) {
      console.error("Delete failed", err)
      setError(err.response?.data?.error || err.message || "Failed to delete mission")
    }
  }

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Mission[]>()
    missions.forEach((m) => {
      const dateKey = m.date.slice(0, 10)
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(m)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [missions])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Mission Scheduling</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={loadMissions}>
            Refresh
          </button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={openCreate}>
            New Mission
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded shadow p-4">
          <h2 className="font-medium mb-3">Calendar (list view)</h2>
          {loading ? (
            <div>Loading missions...</div>
          ) : missions.length === 0 ? (
            <div>No missions scheduled.</div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([date, items]) => (
                <div key={date} className="border rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold">{date}</div>
                    <div className="text-sm text-gray-500">{items.length} mission(s)</div>
                  </div>
                  <ul className="space-y-2">
                    {items
                      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
                      .map((m) => (
                        <li key={m.id} className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{m.title}</div>
                            <div className="text-sm text-gray-600">
                              {m.start_time} - {m.end_time} • {m.location} {m.team_lead ? `• Lead: ${m.team_lead}` : ""}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="text-sm px-2 py-1 bg-yellow-100 rounded"
                              onClick={() => openEdit(m)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-sm px-2 py-1 bg-red-100 rounded"
                              onClick={() => removeMission(m.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="bg-white rounded shadow p-4">
          <h3 className="font-medium mb-3">Quick Stats</h3>
          <div className="text-sm text-gray-700 mb-2">Total missions: {missions.length}</div>
          <div className="text-sm text-gray-700">
            Next 7 days:{" "}
            {missions.filter((m) => {
              const d = new Date(m.date.slice(0, 10))
              const now = new Date()
              const diff = (d.getTime() - now.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)
              return diff >= 0 && diff < 7
            }).length}
          </div>
        </aside>
      </div>

      {/* FORM MODAL - simple panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowForm(false)} />
          <form
            onSubmit={submitForm}
            className="relative bg-white rounded shadow-lg p-6 w-full max-w-lg z-10"
          >
            <h3 className="text-lg font-semibold mb-4">{editing ? "Edit Mission" : "Create Mission"}</h3>

            <label className="block mb-2">
              <div className="text-sm mb-1">Title</div>
              <input
                className="w-full border rounded px-2 py-1"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-2">
                <div className="text-sm mb-1">Date</div>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1"
                  value={form.date.slice(0, 10)}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </label>
              <label className="block mb-2">
                <div className="text-sm mb-1">Location</div>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block mb-2">
                <div className="text-sm mb-1">Start</div>
                <input
                  type="time"
                  className="w-full border rounded px-2 py-1"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </label>
              <label className="block mb-2">
                <div className="text-sm mb-1">End</div>
                <input
                  type="time"
                  className="w-full border rounded px-2 py-1"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </label>
            </div>

            <label className="block mb-2">
              <div className="text-sm mb-1">Team Lead</div>
              <input
                className="w-full border rounded px-2 py-1"
                value={form.team_lead}
                onChange={(e) => setForm({ ...form, team_lead: e.target.value })}
              />
            </label>

            <label className="block mb-2">
              <div className="text-sm mb-1">Notes</div>
              <textarea
                className="w-full border rounded px-2 py-1"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-3 py-1 bg-gray-200 rounded"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}