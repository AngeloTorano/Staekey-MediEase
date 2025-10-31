"use client"

import React, { useMemo, useState, useEffect } from "react"
import axios from "axios"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Edit, Trash } from "lucide-react"
import { RoleGuard } from "@/components/role-guard"
import { decryptObject } from "@/utils/decrypt"

// API instance (adjust baseURL as needed)
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

type Mission = {
  id: number
  title: string
  type: string
  date: string        // normalized YYYY-MM-DD
  time?: string       // normalized HH:mm
  city?: string
  location?: string
  coordinator?: string
  status?: string
  participants?: number
  description?: string
}

// helper: pad
const pad = (n: number) => String(n).padStart(2, "0")

// normalize incoming date/time strings into { date: 'YYYY-MM-DD', time: 'HH:mm'? }
const normalizeDateTime = (input?: string | null) => {
  if (!input) return { date: "" }
  // If input already looks like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return { date: input }
  try {
    const d = new Date(input)
    if (isNaN(d.getTime())) {
      // fallback: try to extract date part if present
      const m = input.match(/(\d{4}-\d{2}-\d{2})/)
      if (m) return { date: m[1] }
      return { date: "" }
    }
    const y = d.getFullYear()
    const mth = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const date = `${y}-${mth}-${day}`
    const hours = pad(d.getHours())
    const mins = pad(d.getMinutes())
    const time = `${hours}:${mins}`
    return { date, time }
  } catch {
    return { date: "" }
  }
}

// format a mission's date/time for display (e.g., "Oct 19, 2025 • 2:00 PM" or "Oct 19, 2025")
const formatMissionDate = (m: Mission) => {
  if (!m.date) return ""
  try {
    if (m.time) {
      const dt = new Date(`${m.date}T${m.time}`)
      return `${dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} • ${dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    } else {
      const d = new Date(m.date)
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    }
  } catch {
    return `${m.date}${m.time ? ` • ${m.time}` : ""}`
  }
}

const toDateKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
const firstDayIndex = (y: number, m: number) => new Date(y, m, 1).getDay()

export default function SchedulingPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [selectedCity, setSelectedCity] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false)
  const [isNotifyOpen, setIsNotifyOpen] = useState(false)
  const [selectedMessageType, setSelectedMessageType] = useState<string>("Ongoing")

  // New: editing state for create/update
  const [newMission, setNewMission] = useState<Partial<Mission>>({
    title: "",
    type: "Phase 1",
    date: toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
    time: "09:00",
    city: "",
    status: "",
    location: "",
    coordinator: "",
    description: "",
  })
  const [editingMission, setEditingMission] = useState<Partial<Mission> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // delete confirmation target (use modal instead of alert)
  const [deleteTarget, setDeleteTarget] = useState<Mission | null>(null)

  // Fetch schedules from backend (handles encrypted responses)
  useEffect(() => {
    const fetchSchedules = async () => {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
        const res = await api.get("/api/schedules", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        let schedulesData: any[] = []

        if (res.data.encrypted_data) {
          try {
            const decrypted = decryptObject(res.data.encrypted_data)
            // backend might return array directly or wrapped
            if (Array.isArray(decrypted)) schedulesData = decrypted
            else if (decrypted && Array.isArray(decrypted.schedules)) schedulesData = decrypted.schedules
            else if (decrypted && Array.isArray(decrypted.data)) schedulesData = decrypted.data
            else schedulesData = []
          } catch (e) {
            setError("Failed to decrypt schedules")
            schedulesData = []
          }
        } else if (res.data.data) {
          schedulesData = res.data.data
        } else if (Array.isArray(res.data)) {
          schedulesData = res.data
        }

        // Map backend schedule shape to Mission type used by UI
        const mapped: Mission[] = schedulesData.map((s: any) => {
          const rawDate = s.date || s.scheduled_at || s.datetime || s.created_at
          const { date, time } = normalizeDateTime(rawDate)
          return {
            id: s.schedule_id || s.id,
            title: s.mission_name || s.title || `Mission ${s.schedule_id || s.id}`,
            type: s.type || (s.mission_name && s.mission_name.split(" - ")[0]) || "Phase",
            date: date,
            time: time || (s.time ? normalizeDateTime(s.time).time : undefined),
            city: s.AfterCareCity || s.city,
            location: s.location,
            coordinator: s.coordinator,
            status: s.status || "Pending",
            participants: s.participants || 0,
            description: s.description,
          }
        })

        setMissions(mapped)
      } catch (err: any) {
        console.error("Fetch schedules error:", err)
        setError("Failed to load schedules")
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [])

  // --- Helpers for calendar badges and kanban grouping ---
  const statusToGroup = (status?: string) => {
    if (!status) return "upcoming"
    const s = status.toLowerCase()
    if (s === "postponed" || s === "postpone") return "postponed"
    if (s === "completed" || s === "complete") return "completed"
    // treat pending/ongoing as upcoming
    return "upcoming"
  }

  const getStatusColor = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "upcoming": return "bg-yellow-100 text-yellow-800"
      case "postponed": return "bg-red-100 text-red-800"
      case "completed": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  // return small dot color class for status group
  const getDotClass = (group?: string) => {
    switch ((group || "").toLowerCase()) {
      case "upcoming": return "bg-yellow-500"
      case "postponed": return "bg-red-500"
      case "completed": return "bg-green-500"
      default: return "bg-gray-500"
    }
  }

  // background class for calendar cell based on status (subtle)
  const getCellBg = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "upcoming": return "bg-yellow-50"
      case "postponed": return "bg-red-50"
      case "completed": return "bg-green-50"
      default: return "bg-gray-50"
    }
  }

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      const cityOk = selectedCity === "all" || m.city === selectedCity
      const typeOk = selectedType === "all" || m.type === selectedType
      return cityOk && typeOk
    })
  }, [missions, selectedCity, selectedType])

  const monthGrid = useMemo(() => {
    const weeks: { day: number; monthOffset: -1 | 0 | 1; key: string }[] = []
    const startIdx = firstDayIndex(viewYear, viewMonth)
    const dim = daysInMonth(viewYear, viewMonth)
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
    const prevDim = daysInMonth(prevYear, prevMonth)
    for (let i = startIdx - 1; i >= 0; i--) {
      weeks.push({ day: prevDim - i, monthOffset: -1, key: `p-${i}` })
    }
    for (let d = 1; d <= dim; d++) {
      weeks.push({ day: d, monthOffset: 0, key: `c-${d}` })
    }
    let nextDay = 1
    while (weeks.length % 7 !== 0) {
      weeks.push({ day: nextDay++, monthOffset: 1, key: `n-${nextDay}` })
    }
    const rows: typeof weeks[] = []
    for (let i = 0; i < weeks.length; i += 7) rows.push(weeks.slice(i, i + 7))
    return rows
  }, [viewYear, viewMonth])

  const missionsByDate = useMemo(() => {
    const map = new Map<string, Mission[]>()
    filteredMissions.forEach((m) => {
      const list = map.get(m.date) || []
      list.push(m)
      map.set(m.date, list)
    })
    return map
  }, [filteredMissions])

  // Kanban groups
  const upcoming = useMemo(() => missions.filter(m => ["upcoming"].includes(statusToGroup(m.status))), [missions])
  const postponed = useMemo(() => missions.filter(m => statusToGroup(m.status) === "postponed"), [missions])
  const completed = useMemo(() => missions.filter(m => statusToGroup(m.status) === "completed"), [missions])

  // Create schedule (POST -> backend)
  const submitNewMission = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const payload = {
        mission_name: newMission.title,
        description: newMission.description,
        AfterCareCity: newMission.city,
        date: newMission.date,
        time: newMission.time,
        status: newMission.status,
      }

      const res = await api.post("/api/schedules", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      let created: any = res.data.data
      if (res.data.encrypted_data) {
        const decrypted = decryptObject(res.data.encrypted_data)
        created = Array.isArray(decrypted) ? decrypted[0] : decrypted
      }

      const dt = normalizeDateTime(created.date || payload.date)
      const mapped: Mission = {
        id: created.schedule_id || created.id,
        title: created.mission_name || created.title || newMission.title || "",
        type: created.type || (created.mission_name && created.mission_name.split(" - ")[0]) || (newMission.type || "Phase"),
        date: dt.date,
        time: dt.time || (created.time ? normalizeDateTime(created.time).time : (newMission.time || undefined)),
        city: created.AfterCareCity || created.city || newMission.city,
        location: created.location,
        coordinator: created.coordinator,
        status: created.status || newMission.status || "Pending",
        participants: created.participants || 0,
        description: created.description || newMission.description,
      }

      setMissions((prev) => [mapped, ...prev])
      setIsNewMissionOpen(false)
      setNewMission({
        title: "",
        type: "Phase 1",
        date: toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
        time: "09:00",
        city: "",
        location: "",
        coordinator: "",
        description: "",
      })
    } catch (err: any) {
      console.error("Create schedule error:", err)
      setError(err?.response?.data?.message || "Failed to create schedule")
    } finally {
      setLoading(false)
    }
  }

  // Update schedule (PUT)
  const updateSchedule = async (id: number, updateData: Partial<Mission>) => {
    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const payload: any = {}
      if (updateData.title !== undefined) payload.mission_name = updateData.title
      if (updateData.description !== undefined) payload.description = updateData.description
      if (updateData.city !== undefined) payload.AfterCareCity = updateData.city
      if (updateData.date !== undefined) payload.date = updateData.date
      if (updateData.time !== undefined) payload.time = updateData.time
      if (updateData.status !== undefined) payload.status = updateData.status

      const res = await api.put(`/api/schedules/${id}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      let updated: any = res.data.data
      if (res.data.encrypted_data) {
        updated = decryptObject(res.data.encrypted_data)
      }

      const dt = normalizeDateTime(updated.date || payload.date || updateData.date)
      const mapped: Mission = {
        id: updated.schedule_id || updated.id || id,
        title: updated.mission_name || updated.title || updateData.title || "",
        type: updated.type || (updated.mission_name && updated.mission_name.split(" - ")[0]) || (updateData.type || "Phase"),
        date: dt.date,
        time: dt.time || (updated.time ? normalizeDateTime(updated.time).time : updateData.time),
        city: updated.AfterCareCity || updateData.city,
        location: updated.location || updateData.location,
        coordinator: updated.coordinator || updateData.coordinator,
        status: updated.status || updateData.status,
        participants: updated.participants || updateData.participants || 0,
        description: updated.description || updateData.description,
      }

      setMissions((prev) => prev.map((m) => (m.id === mapped.id ? mapped : m)))
      setEditingMission(null)
    } catch (err: any) {
      console.error("Update schedule error:", err)
      setError(err?.response?.data?.message || "Failed to update schedule")
    } finally {
      setLoading(false)
    }
  }

  // Delete schedule (DELETE)
  const deleteSchedule = async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      await api.delete(`/api/schedules/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setMissions((prev) => prev.filter((m) => m.id !== id))
      setEditingMission(null)
      setDeleteTarget(null)
    } catch (err: any) {
      console.error("Delete schedule error:", err)
      setError(err?.response?.data?.message || "Failed to delete schedule")
    } finally {
      setLoading(false)
    }
  }

  const submitNewMissionLocal = () => submitNewMission()
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else setViewMonth(viewMonth - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else setViewMonth(viewMonth + 1)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Scheduling</h1>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-medium">{new Date(viewYear, viewMonth).toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
          <Button variant="ghost" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* MAIN CALENDAR - LEFT SIDE */}
        <main className="col-span-9 order-1">
          <div className="grid grid-cols-7 gap-2 bg-white rounded shadow p-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-xs text-center font-medium">{d}</div>
            ))}
            {monthGrid.map((week, wi) =>
              week.map((cell) => {
                let cellYear = viewYear
                let cellMonth = viewMonth
                if (cell.monthOffset === -1) {
                  cellMonth = viewMonth === 0 ? 11 : viewMonth - 1
                  if (viewMonth === 0) cellYear = viewYear - 1
                } else if (cell.monthOffset === 1) {
                  cellMonth = viewMonth === 11 ? 0 : viewMonth + 1
                  if (viewMonth === 11) cellYear = viewYear + 1
                }
                const dateKey = toDateKey(cellYear, cellMonth, cell.day)
                const isCurrentMonth = cell.monthOffset === 0
                const list = missionsByDate.get(dateKey) || []
                const isToday = dateKey === toDateKey(today.getFullYear(), today.getMonth(), today.getDate())

                // use status group for dot color but keep raw status for title
                const uniqueStatuses = Array.from(new Set(list.map((x) => `${statusToGroup(x.status)}|${x.status || ""}`)))
                const dotsToShow = uniqueStatuses.slice(0, 3)

                return (
                  // highlight cell when there are schedules for that date (use first mission status as representative)
                  <div
                    key={`${wi}-${cell.key}`}
                    className={`border rounded p-2 min-h-[80px] ${!isCurrentMonth ? "bg-gray-50 text-muted-foreground" : (list.length ? getCellBg(list[0]?.status) : "")}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className={`flex flex-col`}>
                        <div className={`text-sm font-medium ${isToday ? "text-red-600" : ""}`}>{cell.day}</div>
                        {/* show representative name/location when there's at least one schedule */}
                        {list.length > 0 && (
                          <div className="text-xs text-muted-foreground truncate max-w-[8rem]">
                            {list[0]?.location || list[0]?.title}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {list.length > 0 && (
                          <div className="flex items-center gap-1">
                            {dotsToShow.map((ds, idx) => {
                              const [group, rawStatus] = ds.split("|")
                              return <span key={idx} title={rawStatus || "Scheduled"} className={`w-2 h-2 rounded-full ${getDotClass(group)}`} />
                            })}
                            {list.length > 3 && (
                              <span className="ml-1 text-xs font-medium bg-gray-800 text-white rounded-full px-1">{list.length}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {list.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <Badge className={getStatusColor(statusToGroup(m.status))}>{m.status || statusToGroup(m.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* LEGENDS */}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1"><Badge className="bg-yellow-100 text-yellow-800">Upcoming</Badge></div>
            <div className="flex items-center gap-1"><Badge className="bg-green-100 text-green-800">Completed</Badge></div>
            <div className="flex items-center gap-1"><Badge className="bg-red-100 text-red-800">Postponed</Badge></div>
          </div>

          {/* KANBAN BOARD */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming</CardTitle>
              </CardHeader>
              <CardContent>
                {upcoming.length === 0 && <div className="text-sm text-muted-foreground">No upcoming missions</div>}
                <div className="space-y-2">
                  {upcoming.map((m) => (
                    <div key={m.id} className="p-2 border rounded bg-white flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{formatMissionDate(m)}{m.city ? ` • ${m.city}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(statusToGroup(m.status))}>{m.status || statusToGroup(m.status)}</Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingMission(m)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteSchedule(m.id)}><Trash className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Postponed</CardTitle>
              </CardHeader>
              <CardContent>
                {postponed.length === 0 && <div className="text-sm text-muted-foreground">No postponed missions</div>}
                <div className="space-y-2">
                  {postponed.map((m) => (
                    <div key={m.id} className="p-2 border rounded bg-white flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{formatMissionDate(m)}{m.city ? ` • ${m.city}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(statusToGroup(m.status))}>{m.status || statusToGroup(m.status)}</Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingMission(m)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteSchedule(m.id)}><Trash className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completed</CardTitle>
              </CardHeader>
              <CardContent>
                {completed.length === 0 && <div className="text-sm text-muted-foreground">No completed missions</div>}
                <div className="space-y-2">
                  {completed.map((m) => (
                    <div key={m.id} className="p-2 border rounded bg-white flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{formatMissionDate(m)}{m.city ? ` • ${m.city}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(statusToGroup(m.status))}>{m.status || statusToGroup(m.status)}</Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingMission(m)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteSchedule(m.id)}><Trash className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* FILTERS + BUTTONS - RIGHT SIDE */}
        <aside className="col-span-3 order-2">
          <Card>
            <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>AfterCare City</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    <SelectItem value="Manila">Manila</SelectItem>
                    <SelectItem value="Cebu">Cebu</SelectItem>
                    <SelectItem value="Davao">Davao</SelectItem>
                    <SelectItem value="Iloilo">Iloilo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="mt-4 flex flex-col gap-2">
                <Button onClick={() => setIsNotifyOpen(true)} variant="outline">Notify Patient via SMS</Button>
                <RoleGuard allowedRoles={["Admin", "Country Coordinator", "City Coordinator"]}>
                  <Button onClick={() => setIsNewMissionOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add New Mission
                  </Button>
                </RoleGuard>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>





      {/* NOTIFY MODAL */}
      <Dialog open={isNotifyOpen} onOpenChange={setIsNotifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Notify Patient</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Select Message Type</Label>
            <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Upcoming">Mission Upcoming</SelectItem>
                <SelectItem value="Complete">Mission Complete</SelectItem>
                <SelectItem value="Postponed">Mission Postponed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsNotifyOpen(false)}>Cancel</Button>
            <Button onClick={() => alert(`Patient notified: ${selectedMessageType}`)}>Send Notification</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE DIALOG */}
      <Dialog open={isNewMissionOpen} onOpenChange={setIsNewMissionOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Schedule Mission</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label>Mission Name</Label>
              <Input
                value={newMission.title || ""}
                onChange={(e) =>
                  setNewMission({ ...newMission, title: e.target.value })
                }
                placeholder="Enter mission name"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newMission.description || ""}
                onChange={(e) =>
                  setNewMission({ ...newMission, description: e.target.value })
                }
                placeholder="Enter mission description"
                required
              />
            </div>

            <div>
              <Label>AfterCare City</Label>
              <Select
                value={newMission.city || ""}
                onValueChange={(v) =>
                  setNewMission({ ...newMission, city: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manila">Manila</SelectItem>
                  <SelectItem value="Cebu">Cebu</SelectItem>
                  <SelectItem value="Davao">Davao</SelectItem>
                  <SelectItem value="Iloilo">Iloilo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newMission.date || ""}
                  onChange={(e) =>
                    setNewMission({ ...newMission, date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newMission.time || ""}
                  onChange={(e) =>
                    setNewMission({ ...newMission, time: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={newMission.status || "Pending"}
                onValueChange={(v) => setNewMission({ ...newMission, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Upcoming">Upcoming</SelectItem>
                  <SelectItem value="Completed">Complete</SelectItem>
                  <SelectItem value="Postponed">Postponed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsNewMissionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNewMissionLocal} disabled={loading}>{loading ? "Saving..." : "Create Schedule"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editingMission} onOpenChange={() => setEditingMission(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>

          {editingMission && (
            <div className="grid gap-3 py-4">
              <div>
                <Label>Mission Name</Label>
                <Input
                  value={editingMission.title || ""}
                  onChange={(e) => setEditingMission({ ...editingMission, title: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingMission.description || ""}
                  onChange={(e) => setEditingMission({ ...editingMission, description: e.target.value })}
                />
              </div>

              <div>
                <Label>AfterCare City</Label>
                <Select
                  value={editingMission.city || ""}
                  onValueChange={(v) => setEditingMission({ ...editingMission, city: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manila">Manila</SelectItem>
                    <SelectItem value="Cebu">Cebu</SelectItem>
                    <SelectItem value="Davao">Davao</SelectItem>
                    <SelectItem value="Iloilo">Iloilo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={editingMission.date || ""} onChange={(e) => setEditingMission({ ...editingMission, date: e.target.value })} />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input type="time" value={editingMission.time || ""} onChange={(e) => setEditingMission({ ...editingMission, time: e.target.value })} />
                </div>
              </div>

<div>
  <Label>Status</Label>
  <Select
    value={newMission.status || undefined}
    onValueChange={(v) => setNewMission({ ...newMission, status: v })}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="Upcoming">Upcoming</SelectItem>
      <SelectItem value="Completed">Completed</SelectItem>
      <SelectItem value="Postponed">Postponed</SelectItem>
    </SelectContent>
  </Select>
</div>

              {error && <div className="text-red-500">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingMission(null)}>Cancel</Button>
                <Button
                  onClick={() =>
                    editingMission?.id &&
                    updateSchedule(editingMission.id, editingMission as Partial<Mission>)
                  }
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Save"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => editingMission && setDeleteTarget(editingMission as Mission)}
                  disabled={loading}
                >
                  {loading ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this schedule?</p>
            {deleteTarget && (
              <div className="mt-3 text-sm">
                <div className="font-medium">{deleteTarget.title}</div>
                <div className="text-xs text-muted-foreground">{formatMissionDate(deleteTarget)}{deleteTarget.city ? ` • ${deleteTarget.city}` : ""}</div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteSchedule(deleteTarget.id)} disabled={loading}>
            </Button>
            {loading ? "Deleting..." : "Delete"}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
