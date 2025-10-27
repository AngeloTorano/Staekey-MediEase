"use client"

import React, { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react"
import { RoleGuard } from "@/components/role-guard"

type Mission = {
  id: number
  title: string
  type: string
  date: string // yyyy-mm-dd
  time?: string
  city?: string
  location?: string
  coordinator?: string
  status?: string
  participants?: number
  description?: string
}

const sampleMissions: Mission[] = [
  { id: 1, title: "Phase 1 - Manila", type: "Phase 1", date: "2024-01-15", time: "09:00", city: "Manila", status: "Scheduled", participants: 45 },
  { id: 2, title: "Phase 2 - Cebu", type: "Phase 2", date: "2024-01-18", time: "08:30", city: "Cebu", status: "In Progress", participants: 32 },
  { id: 3, title: "AfterCare - Davao", type: "Phase 3", date: "2024-01-20", time: "10:00", city: "Davao", status: "Completed", participants: 28 },
]

// date helpers (no external deps)
const toDateKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
const firstDayIndex = (y: number, m: number) => new Date(y, m, 1).getDay() // 0 Sun

export default function SchedulingPage() {
  const [missions, setMissions] = useState<Mission[]>(sampleMissions)
  const [selectedCity, setSelectedCity] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-index
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)

  // new mission form
  const [newMission, setNewMission] = useState<Partial<Mission>>({
    title: "",
    type: "Phase 1",
    date: toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
    time: "09:00",
    city: "",
    location: "",
    coordinator: "",
    description: "",
  })

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      const cityOk = selectedCity === "all" || !selectedCity || m.city === selectedCity
      const typeOk = selectedType === "all" || !selectedType || m.type === selectedType
      return cityOk && typeOk
    })
  }, [missions, selectedCity, selectedType])

  const monthGrid = useMemo(() => {
    const weeks: { day: number; monthOffset: -1 | 0 | 1; key: string }[] = []
    const startIdx = firstDayIndex(viewYear, viewMonth)
    const dim = daysInMonth(viewYear, viewMonth)
    // previous month days
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
    const prevDim = daysInMonth(prevYear, prevMonth)
    for (let i = startIdx - 1; i >= 0; i--) {
      const d = prevDim - i
      weeks.push({ day: d, monthOffset: -1, key: `p-${d}` })
    }
    // current month
    for (let d = 1; d <= dim; d++) {
      weeks.push({ day: d, monthOffset: 0, key: `c-${d}` })
    }
    // next month to fill 7*n grid
    let nextDay = 1
    while (weeks.length % 7 !== 0) {
      weeks.push({ day: nextDay++, monthOffset: 1, key: `n-${nextDay - 1}` })
    }
    // group into rows of 7
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

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const openCreateFor = (dateKey?: string) => {
    setPrefillDate(dateKey || null)
    setNewMission((prev) => ({ ...prev, date: dateKey ?? prev.date }))
    setIsNewMissionOpen(true)
  }

  const submitNewMission = () => {
    const id = (missions.reduce((mx, m) => Math.max(mx, m.id), 0) || 0) + 1
    const payload: Mission = {
      id,
      title: newMission.title || `Mission ${id}`,
      type: newMission.type || "Phase 1",
      date: newMission.date || toDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
      time: newMission.time,
      city: newMission.city,
      location: newMission.location,
      coordinator: newMission.coordinator,
      status: "Scheduled",
      participants: 0,
      description: newMission.description,
    }
    setMissions((prev) => [payload, ...prev])
    setIsNewMissionOpen(false)
    setNewMission({
      title: "",
      type: "Phase 1",
      date: payload.date,
      time: "09:00",
      city: "",
      location: "",
      coordinator: "",
      description: "",
    })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Phase 1":
        return "bg-purple-100 text-purple-800"
      case "Phase 2":
        return "bg-indigo-100 text-indigo-800"
      case "Phase 3":
        return "bg-teal-100 text-teal-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduling — Calendar</h1>
          <p className="text-muted-foreground">Month view — click a day to schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">
            {new Date(viewYear, viewMonth).toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <RoleGuard allowedRoles={["Admin", "Country Coordinator", "City Coordinator"]}>
            <Dialog open={isNewMissionOpen} onOpenChange={setIsNewMissionOpen}>
              <DialogTrigger asChild>
                <Button className="ml-2">
                  <Plus className="h-4 w-4 mr-2" />
                  New Mission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Schedule Mission</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div>
                    <Label>Title</Label>
                    <Input value={newMission.title || ""} onChange={(e) => setNewMission({ ...newMission, title: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={newMission.type} onValueChange={(v) => setNewMission({ ...newMission, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Phase 1">Phase 1</SelectItem>
                          <SelectItem value="Phase 2">Phase 2</SelectItem>
                          <SelectItem value="Phase 3">Phase 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={newMission.date?.slice(0, 10)} onChange={(e) => setNewMission({ ...newMission, date: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Time</Label>
                      <Input type="time" value={newMission.time || ""} onChange={(e) => setNewMission({ ...newMission, time: e.target.value })} />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input value={newMission.city || ""} onChange={(e) => setNewMission({ ...newMission, city: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={newMission.location || ""} onChange={(e) => setNewMission({ ...newMission, location: e.target.value })} />
                  </div>
                  <div>
                    <Label>Coordinator</Label>
                    <Input value={newMission.coordinator || ""} onChange={(e) => setNewMission({ ...newMission, coordinator: e.target.value })} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={newMission.description || ""} onChange={(e) => setNewMission({ ...newMission, description: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNewMissionOpen(false)}>Cancel</Button>
                  <Button onClick={submitNewMission}>Create Mission</Button>
                </div>
              </DialogContent>
            </Dialog>
          </RoleGuard>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>City</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    <SelectItem value="Manila">Manila</SelectItem>
                    <SelectItem value="Cebu">Cebu</SelectItem>
                    <SelectItem value="Davao">Davao</SelectItem>
                    <SelectItem value="Iloilo">Iloilo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mission Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Phase 1">Phase 1</SelectItem>
                    <SelectItem value="Phase 2">Phase 2</SelectItem>
                    <SelectItem value="Phase 3">Phase 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Card className="mt-2">
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      <div>
                        <div className="text-sm font-medium">Today</div>
                        <div className="text-xs text-muted-foreground">{today.toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm">Total missions: {missions.length}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => { setSelectedCity("all"); setSelectedType("all") }}>Reset</Button>
                <Button onClick={() => openCreateFor()}>Quick New</Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="col-span-9">
          <div className="grid grid-cols-7 gap-2 bg-white rounded shadow p-4">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-xs text-center font-medium">{d}</div>
            ))}
            {monthGrid.map((week, wi) =>
              week.map((cell) => {
                // compute date for cell
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
                const isToday =
                  dateKey === toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
                return (
                  <div
                    key={`${wi}-${cell.key}`}
                    className={`border rounded p-2 min-h-[80px] ${isCurrentMonth ? "" : "bg-gray-50 text-muted-foreground"}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className={`text-sm font-medium ${isToday ? "text-blue-600" : ""}`}>{cell.day}</div>
                      <button
                        className="text-xs text-gray-500 hover:text-gray-700"
                        onClick={() => openCreateFor(dateKey)}
                        title="Create mission on this date"
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-2 space-y-1">
                      {list.slice(0, 3).map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <Badge className={getTypeColor(m.type)}>{m.type}</Badge>
                          <div className="ml-2 text-xs truncate">{m.time ? `${m.time} • ` : ""}{m.title}</div>
                        </div>
                      ))}
                      {list.length > 3 && (
                        <div className="text-xs text-gray-500">+{list.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="mt-4 space-y-3">
            <h3 className="text-lg font-semibold">Upcoming missions</h3>
            <div className="grid gap-3">
              {filteredMissions.slice(0, 6).map((m) => (
                <Card key={m.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{m.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {m.date} {m.time ? `• ${m.time}` : ""} • {m.city}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <Badge className={getTypeColor(m.type)}>{m.type}</Badge>
                        <div className="text-sm mt-2">{m.participants ?? 0} participants</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">{m.description}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}