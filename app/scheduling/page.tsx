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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  date: string // normalized YYYY-MM-DD
  time?: string // normalized HH:mm
  city?: string
  location?: string
  coordinator?: string
  status?: string
  participants?: number
  description?: string
}

// helper: pad
const pad = (n: number) => String(n).padStart(2, "0")

// NEW: Month labels for the month filter
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]

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
const formatMissionDate = (m?: Mission | null) => {
  if (!m || !m.date) return ""
  try {
    if (m.time) {
      const dt = new Date(`${m.date}T${m.time}`)
      return `${dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} • ${dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    } else {
      // FIX: Handle YYYY-MM-DD which might be parsed as UTC by new Date()
      // Split and construct date to avoid timezone issues
      const parts = m.date.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    }
  } catch {
    return `${m.date}${m.time ? ` • ${m.time}` : ""}`
  }
}

const toDateKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
const firstDayIndex = (y: number, m: number) => new Date(y, m, 1).getDay()

// Define keys for validation, excluding 'id' or other non-form fields
type MissionFormKeys = keyof Omit<Mission, 'id' | 'type' | 'location' | 'coordinator' | 'participants'>;

// NEW: Default state for the new mission form
const defaultNewMissionState = (date: string) => ({
  title: "",
  type: "Phase 1",
  date: date,
  time: "08:00",
  city: "",
  status: "Upcoming",
  location: "",
  coordinator: "",
  description: "",
})

export default function SchedulingPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  // REMOVE: selectedCity/selectedType in favor of a single month filter
  // const [selectedCity, setSelectedCity] = useState<string>("all")
  // const [selectedType, setSelectedType] = useState<string>("all")

  // NEW: single month filter (0-11). default to current month instead of 'all'
  const [monthFilter, setMonthFilter] = useState<number | 'current'>('current')
  // NEW: status filter ('all' still allowed for cards/calendar)
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'postponed' | 'completed'>('all')

  // --- HYDRATION FIX: Start ---
  const [isClient, setIsClient] = useState(false)
  // Initialize with stable server-side defaults
  const [todayKey, setTodayKey] = useState("")
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  // --- HYDRATION FIX: End ---

  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false)
  const [isNotifyOpen, setIsNotifyOpen] = useState(false)
  const [selectedMessageType, setSelectedMessageType] = useState<string>("Upcoming") // Default to 'Upcoming'

  // New: editing state for create/update
  const [newMission, setNewMission] = useState<Partial<Mission>>(defaultNewMissionState(""))
  const [editingMission, setEditingMission] = useState<Partial<Mission> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // NEW: State for form validation errors
  const [validationErrors, setValidationErrors] = useState<Partial<Record<MissionFormKeys, string>>>({});

  // delete confirmation target (use modal instead of alert)
  const [deleteTarget, setDeleteTarget] = useState<Mission | null>(null)

  // NEW: States for Notification Flow
  const [isNotifyMode, setIsNotifyMode] = useState(false)
  const [notifyTarget, setNotifyTarget] = useState<Mission | null>(null)
  const [isNotifying, setIsNotifying] = useState(false)
  const [notifyError, setNotifyError] = useState<string | null>(null)

  // NEW: Success dialog state (replaces alert)
  const [isNotifySuccessOpen, setIsNotifySuccessOpen] = useState(false)
  const [notifySuccessMessage, setNotifySuccessMessage] = useState<string | null>(null)

  // NEW: Sent messages dialog state
  type SentMessage = {
    sms_id?: number
    message_type: string
    message_content: string
    recipient_count: number
    recipients?: string
    created_at?: string
  }
  const [isSentMessagesOpen, setIsSentMessagesOpen] = useState(false)
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([])
  const [sentLoading, setSentLoading] = useState(false)
  const [sentError, setSentError] = useState<string | null>(null)
  // --- HYDRATION FIX: Set client-specific dates in useEffect ---
  useEffect(() => {
    const today = new Date()
    const key = toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
    setTodayKey(key)
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setNewMission(defaultNewMissionState(key)) // Set default form state with today's key
    setIsClient(true)
  }, []) // Empty dependency array ensures this runs once on mount

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

            // --- FIX 1: Read lowercase 'aftercarecity' from DB ---
            city: s.AfterCareCity || s.aftercarecity,
            // --- END FIX 1 ---

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
    const currentMonthIdx = new Date().getMonth()
    const activeMonth = monthFilter === 'current' ? currentMonthIdx : monthFilter
    return missions.filter(m => {
      if (!m.date) return false
      const parts = m.date.split("-").map(Number)
      if (parts.length < 3) return false
      const mo = parts[1] - 1
      if (mo !== activeMonth) return false
      if (statusFilter !== 'all' && statusToGroup(m.status) !== statusFilter) return false
      return true
    })
  }, [missions, monthFilter, statusFilter])

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
  // Only include schedules that fall within the selected month (ALL shows all)
  const isInSelectedMonth = (m?: Mission) => {
    if (!m?.date) return false
    const currentMonthIdx = new Date().getMonth()
    const activeMonth = monthFilter === 'current' ? currentMonthIdx : monthFilter
    const parts = m.date.split("-").map(Number)
    if (parts.length < 3) return false
    if (parts[1] - 1 !== activeMonth) return false
    if (statusFilter !== 'all' && statusToGroup(m.status) !== statusFilter) return false
    return true
  }

  const upcoming = useMemo(() => filteredMissions.filter(m => statusToGroup(m.status) === "upcoming"), [filteredMissions])
  const postponed = useMemo(() => filteredMissions.filter(m => statusToGroup(m.status) === "postponed"), [filteredMissions])
  const completed = useMemo(() => filteredMissions.filter(m => statusToGroup(m.status) === "completed"), [filteredMissions])

  // NEW: Validation function
  const validateMission = (mission: Partial<Mission>) => {
    const errors: Partial<Record<MissionFormKeys, string>> = {};

    if (!mission.title?.trim()) {
      errors.title = "Mission Name is required";
    }
    if (!mission.description?.trim()) {
      errors.description = "Description is required";
    }
    // --- START CORRECTION ---
    if (!mission.city?.trim()) {
      errors.city = "AfterCare City is required";
    }
    // --- END CORRECTION ---
    if (!mission.date) {
      errors.date = "Date is required";
    }
    if (!mission.time) {
      errors.time = "Time is required";
    }
    if (!mission.status) {
      errors.status = "Status must be selected";
    }

    return errors;
  };

  // Create schedule (POST -> backend)
  const submitNewMission = async () => {
    setLoading(true)
    setError(null) // Clear previous API errors
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

        // --- FIX 2: Read 'aftercarecity' and fallback to 'city' or form state ---
        city: created.AfterCareCity || created.aftercarecity || created.city || newMission.city,
        // --- END FIX 2 ---

        location: created.location,
        coordinator: created.coordinator,
        status: created.status || newMission.status || "Pending",
        participants: created.participants || 0,
        description: created.description || newMission.description,
      }

      setMissions((prev) => [mapped, ...prev])
      setIsNewMissionOpen(false)
      setNewMission(defaultNewMissionState(todayKey)) // Reset form to default
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

        // --- FIX 3: Read 'aftercarecity' and fallback to 'city' or form state ---
        city: updated.AfterCareCity || updated.aftercarecity || updated.city || updateData.city,
        // --- END FIX 3 ---

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

  // UPDATED: This function now validates before submitting
  const submitNewMissionLocal = () => {
    setValidationErrors({}); // Clear old field errors
    const errors = validateMission(newMission);

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return; // Stop submission
    }

    // If validation passes, call the original API function
    submitNewMission();
  }

  const prevMonth = () => {
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else setViewMonth(viewMonth - 1)
    // If user had 'current', switch to explicit month on navigation
    setMonthFilter(typeof monthFilter === 'string' ? newMonth : newMonth)
  }

  const nextMonth = () => {
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else setViewMonth(viewMonth + 1)
    setMonthFilter(typeof monthFilter === 'string' ? newMonth : newMonth)
  }

  // NEW: Handle clicking the "Add New Mission" button
  const handleAddNewClick = () => {
    setValidationErrors({});
    setError(null);
    setNewMission(defaultNewMissionState(todayKey)); // Reset form to default with today's date
    setIsNewMissionOpen(true);
  }

  // UPDATED: Handle clicking a calendar cell (now checks for notify mode)
  const handleCellClick = (dateKey: string, missionsOnDay: Mission[]) => {
    setError(null); // Clear errors for all paths
    setNotifyError(null); // Clear notify errors

    // NEW: Check if we are in 'Notify Mode'
    if (isNotifyMode) {
      if (missionsOnDay.length === 0) {
        // Can't notify for an empty day
        alert("Please select a day that has a scheduled mission.");
        return;
      }

      // We have a schedule. Set it as the target and open the notify modal.
      // We'll just pick the first mission of the day.
      setNotifyTarget(missionsOnDay[0]);
      setIsNotifyOpen(true);
      setIsNotifyMode(false); // Exit notify mode
      return; // Stop further execution
    }

    // --- Original Logic (if not in notify mode) ---
    if (missionsOnDay.length === 0) {
      // CLICKED EMPTY CELL: Open create dialog with cell's date
      setValidationErrors({});
      setNewMission(defaultNewMissionState(dateKey)); // Reset form but use the clicked date
      setIsNewMissionOpen(true);
    } else {
      // CLICKED FILLED CELL: Open edit dialog for the first mission
      setEditingMission(missionsOnDay[0]);
    }
  }

  // NEW: Fetch sent messages
  const openSentMessages = async () => {
    setIsSentMessagesOpen(true)
    setSentError(null)
    setSentLoading(true)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.get("/api/sms/messages?limit=100", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setSentMessages(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch (err: any) {
      setSentError(err?.response?.data?.message || "Failed to load sent messages.")
    } finally {
      setSentLoading(false)
    }
  }

  // NEW: Handle sending the schedule notification via SMS
  const handleSendNotification = async () => {
    if (!notifyTarget || !notifyTarget.city) {
      setNotifyError("No schedule selected or schedule is missing a city.");
      return;
    }

    // Create message from template
    const messageTemplates: Record<string, string> = {
      "Upcoming": `Friendly reminder: Your ${notifyTarget.title} mission in ${notifyTarget.city} is scheduled for ${formatMissionDate(notifyTarget)}. We look forward to seeing you!`,
      "Complete": `Thank you for participating in the ${notifyTarget.title} mission in ${notifyTarget.city}.`,
      "Postponed": `Notice: The ${notifyTarget.title} mission in ${notifyTarget.city} scheduled for ${formatMissionDate(notifyTarget)} has been postponed. We will update you with a new date soon.`
    }

    const message = messageTemplates[selectedMessageType];

    if (!message) {
      setNotifyError("Invalid message type selected.");
      return;
    }

    setIsNotifying(true);
    setNotifyError(null);

    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null

      const payload = {
        AfterCareCity: notifyTarget.city,
        message: message
      }

      const res = await api.post("/api/sms/send-schedule", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // On success: close modal, reset states, SHOW DIALOG (no alert)
      setIsNotifyOpen(false);
      setNotifyTarget(null);
      setNotifySuccessMessage(res?.data?.message || "Notification sent successfully!");
      setIsNotifySuccessOpen(true);

    } catch (err: any)
    {
      console.error("Notify error:", err);
      setNotifyError(err?.response?.data?.message || "Failed to send notification.");
    } finally {
      setIsNotifying(false);
    }
  }


  return (
    // --- HYDRATION FIX: Added suppressHydrationWarning ---
    <div className="p-6 space-y-6" suppressHydrationWarning>
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Scheduling</h1>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-medium">
            {/* --- HYDRATION FIX: Conditional render for locale string --- */}
            {isClient
              ? new Date(viewYear, viewMonth).toLocaleString(undefined, { month: "long", year: "numeric" })
              : new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: "long", year: "numeric" }) // Stable server fallback
            }
          </div>
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
                
                // --- HYDRATION FIX: isToday check is now safe ---
                const isToday = dateKey === todayKey

                // use status group for dot color but keep raw status for title
                const uniqueStatuses = Array.from(new Set(list.map((x) => `${statusToGroup(x.status)}|${x.status || ""}`)))
                const dotsToShow = uniqueStatuses.slice(0, 3)

                return (
                  // UPDATED: Added onClick, cursor-pointer, and hover effect
                  <div
                    key={`${wi}-${cell.key}`}
                    onClick={() => handleCellClick(dateKey, list)}
                    className={`border rounded p-2 min-h-[80px] cursor-pointer transition-colors ${
                      isNotifyMode ? "hover:border-primary hover:border-2" : "" // Highlight on hover in notify mode
                    } ${
                      !isCurrentMonth
                        ? "bg-gray-50 text-muted-foreground hover:bg-gray-100"
                        : (list.length ? `${getCellBg(list[0]?.status)} hover:bg-opacity-70` : "bg-white hover:bg-gray-100")
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className={`flex flex-col`}>
                        <div className={`text-sm font-medium ${isToday ? "text-red-600" : ""}`}>{cell.day}</div>
                        {/* show representative name */}
                        {list.length > 0 && (
                          <div className="text-xs text-muted-foreground truncate max-w-[8rem]">
                            {list[0]?.title}
                          </div>
                        )}
                        {list.length > 0 && (list[0]?.city || list[0]?.location) && (
                          <div className="text-xs text-muted-foreground truncate max-w-[8rem]">
                            {list[0]?.city || list[0]?.location}
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
                           <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)}><Trash className="h-4 w-4 text-destructive" /></Button>
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
                           <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)}><Trash className="h-4 w-4 text-destructive" /></Button>
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
                           <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)}><Trash className="h-4 w-4 text-destructive" /></Button>
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
        <aside className="col-span-3 order-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* SINGLE MONTH FILTER */}
              <div className="space-y-1">
                <Label className="block text-sm font-medium">Filters</Label>
                <div className="flex gap-2">
                  {/* STATUS FILTER */}
                  <div className="flex-1">
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="postponed">Postponed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* MONTH FILTER */}
                  <div className="flex-1">
                    <Select
                      value={monthFilter === 'current' ? 'current' : String(monthFilter)}
                      onValueChange={(v) => {
                        if (v === 'current') {
                          const cm = new Date().getMonth()
                          setMonthFilter('current')
                          setViewMonth(cm)
                          setViewYear(new Date().getFullYear())
                        } else {
                          const mv = parseInt(v, 10)
                          setMonthFilter(mv)
                          setViewMonth(mv)
                          setViewYear(new Date().getFullYear())
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">Current</SelectItem>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="mt-4 flex flex-col gap-2">
                {/* UPDATED: This button now toggles 'Notify Mode' */}
                <Button
                  onClick={() => setIsNotifyMode(true)}
                  variant="outline"
                  disabled={isNotifyMode} // Disable if already in notify mode
                >
                  {isNotifyMode ? "Select a schedule..." : "Notify Patient via SMS"}
                </Button>

                {/* NEW: View sent messages */}
                <Button variant="secondary" onClick={openSentMessages}>
                  View Sent Messages
                </Button>

                <RoleGuard allowedRoles={["Admin", "Country Coordinator", "City Coordinator"]}>
                  <Button onClick={handleAddNewClick}>
                    <Plus className="h-4 w-4 mr-2" /> Add New Mission
                  </Button>
                </RoleGuard>
              </div>

              {/* NEW: Add a helper text when in notify mode */}
              {isNotifyMode && (
                <div className="p-2 text-sm text-primary border border-primary/50 rounded bg-primary/10">
                  Click a schedule on the calendar to send a notification.
                  <Button variant="link" size="sm" className="p-0 h-auto ml-2" onClick={() => setIsNotifyMode(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>


      {/* NOTIFY MODAL - UPDATED */}
      <Dialog open={isNotifyOpen} onOpenChange={(isOpen) => {
        setIsNotifyOpen(isOpen);
        if (!isOpen) {
          // Clear states on close
          setNotifyTarget(null);
          setNotifyError(null);
          setIsNotifying(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Notify Patients</DialogTitle></DialogHeader>

          {/* Show schedule info */}
          {notifyTarget && (
            <div className="space-y-2 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Schedule Details:</p>
              <div className="text-sm">
                <strong>{notifyTarget.title}</strong>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatMissionDate(notifyTarget)}
              </div>
              <div className="text-sm text-muted-foreground">
                City: <strong>{notifyTarget.city || "N/A"}</strong>
              </div>
            </div>
          )}

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
            <p className="text-xs text-muted-foreground">
              This will send an SMS to all patients registered for the
              AfterCare city: <strong>{notifyTarget?.city || "N/A"}</strong>.
            </p>
          </div>

          {/* Show API error */}
          {notifyError && (
            <p className="text-sm text-red-500">{notifyError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsNotifyOpen(false)} disabled={isNotifying}>Cancel</Button>
            {/* UPDATED: onClick now calls the API handler */}
            <Button
              onClick={handleSendNotification}
              disabled={isNotifying || !notifyTarget?.city}
            >
              {isNotifying ? "Sending..." : "Send Notification"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NOTIFY SUCCESS DIALOG - NEW */}
      <Dialog open={isNotifySuccessOpen} onOpenChange={(o) => setIsNotifySuccessOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Notification Sent</DialogTitle></DialogHeader>
          <p className="text-sm">{notifySuccessMessage || "Notification sent successfully!"}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsNotifySuccessOpen(false)}>Close</Button>
            <Button onClick={() => { setIsNotifySuccessOpen(false); openSentMessages(); }}>
              View Sent Messages
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CREATE DIALOG */}
      <Dialog open={isNewMissionOpen} onOpenChange={(isOpen) => {
        setIsNewMissionOpen(isOpen);
        if (!isOpen) {
          setValidationErrors({}); // Clear validation errors
          setError(null); // Clear API error
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Schedule Mission</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label htmlFor="new-title">Mission Name</Label>
              <Input
                id="new-title"
                value={newMission.title || ""}
                onChange={(e) =>
                  setNewMission({ ...newMission, title: e.target.value })
                }
                placeholder="Enter mission name"
              />
              {validationErrors.title && <p className="text-sm text-red-500 mt-1">{validationErrors.title}</p>}
            </div>

            <div>
              <Label htmlFor="new-desc">Description</Label>
              <Textarea
                id="new-desc"
                value={newMission.description || ""}
                onChange={(e) =>
                  setNewMission({ ...newMission, description: e.target.value })
                }
                placeholder="Enter mission description"
              />
              {validationErrors.description && <p className="text-sm text-red-500 mt-1">{validationErrors.description}</p>}
            </div>

            {/* --- START MODIFICATION --- */}
            <div>
              <Label htmlFor="new-city">AfterCare City</Label>
              <Input
                id="new-city"
                value={newMission.city || ""}
                onChange={(e) =>
                  setNewMission({ ...newMission, city: e.target.value })
                }
                placeholder="Enter city name"
              />
              {validationErrors.city && <p className="text-sm text-red-500 mt-1">{validationErrors.city}</p>}
            </div>
            {/* --- END MODIFICATION --- */}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-date">Date</Label>
                <Input
                  id="new-date"
                  type="date"
                  value={newMission.date || ""}
                  onChange={(e) =>
                    setNewMission({ ...newMission, date: e.target.value })
                  }
                />
                {validationErrors.date && <p className="text-sm text-red-500 mt-1">{validationErrors.date}</p>}
              </div>
              <div>
                <Label htmlFor="new-time">Time</Label>
                <Input
                  id="new-time"
                  type="time"
                  value={newMission.time || ""}
                  onChange={(e) =>
                    setNewMission({ ...newMission, time: e.target.value })
                  }
                />
                {validationErrors.time && <p className="text-sm text-red-500 mt-1">{validationErrors.time}</p>}
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={newMission.status || ""}
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
              {validationErrors.status && <p className="text-sm text-red-500 mt-1">{validationErrors.status}</p>}
            </div>
          </div>

          {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsNewMissionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNewMissionLocal} disabled={loading}>{loading ? "Saving..." : "Create Schedule"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editingMission} onOpenChange={(isOpen) => {
        setEditingMission(isOpen ? editingMission : null);
        if (!isOpen) setError(null); // Clear API error on close
      }}>
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

              {/* --- START MODIFICATION --- */}
              <div>
                <Label>AfterCare City</Label>
                <Input
                  value={editingMission.city || ""}
                  onChange={(e) => setEditingMission({ ...editingMission, city: e.target.value })}
                  placeholder="Enter city name"
                />
              </div>
              {/* --- END MODIFICATION --- */}

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
                  value={editingMission.status || ""}
                  onValueChange={(v) => setEditingMission({ ...editingMission, status: v })}
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

              {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

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
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SENT MESSAGES DIALOG - NEW */}
      <Dialog
        open={isSentMessagesOpen}
        onOpenChange={(open) => {
          setIsSentMessagesOpen(open)
          if (!open) {
            setSentMessages([])
            setSentError(null)
          } else {
            // If opened via click and not preloaded, ensure data is present
            if (sentMessages.length === 0 && !sentLoading) openSentMessages()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Sent Messages</DialogTitle></DialogHeader>
          {sentLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {sentError && <p className="text-sm text-red-500">{sentError}</p>}
          {!sentLoading && !sentError && (
            <div className="max-h-[400px] overflow-y-auto divide-y">
              {sentMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages found.</p>
              ) : (
                sentMessages.map((msg) => (
                  <div key={msg.sms_id || msg.created_at} className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="text-sm font-medium">{msg.message_type || "Schedule"}</div>
                      {msg.created_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{msg.message_content}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Recipients: {msg.recipient_count ?? 0}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsSentMessagesOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}