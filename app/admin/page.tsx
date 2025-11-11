"use client"

import { useState, useEffect } from "react"
import { decryptObject } from "@/utils/decrypt"
import axios from "axios"
import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription, // Added
  DialogFooter, // Added
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// --- ⭐️ START: IMPORT UPDATED ⭐️ ---
// Make sure CheckCircle is imported (it was already in your file)
import { Users, Shield, Activity, Plus, Edit, Ban, AlertTriangle, CheckCircle, Eye } from "lucide-react"
// --- ⭐️ END: IMPORT UPDATED ⭐️ ---

// --- API and Constants ---

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
})

const FRONTEND_TO_BACKEND_ROLE: Record<string, string> = {
  Admin: "Admin",
  "Country Coordinator": "Country Coordinator",
  "City Coordinator": "City Coordinator",
  "Supplies Manager": "Supplies Manager",
}

// Mock constants for new filter dropdowns
// You could fetch these from your API (e.g., from `audit_logs` table)
// --- ⭐️ START: ADDED "REACTIVATE" ⭐️ ---
const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "DEACTIVATE", "REACTIVATE"]
// --- ⭐️ END: ADDED "REACTIVATE" ⭐️ ---
const AUDIT_TABLES = ["users", "user_roles", "patients", "supplies"] // Add other tables as needed

// --- Utility Functions ---

function generateUsername(first = "", last = "") {
  if (first || last) {
    const f = first.trim().toLowerCase().replace(/\s+/g, "")
    const l = last.trim().toLowerCase().replace(/\s+/g, "")
    const num = Math.floor(100 + Math.random() * 900) // 3 digits
    if (f && l) return `${f.charAt(0)}${l}${num}`
    return `${(f || l)}${num}`
  }
  // fallback random
  return `user${Math.floor(1000 + Math.random() * 9000)}`
}

function generatePassword(length = 12) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const lower = "abcdefghijklmnopqrstuvwxyz"
  const digits = "0123456789"
  const symbols = "!@#$%^&*()-_+=<>?"
  const all = upper + lower + digits + symbols
  let pw = ""
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += lower[Math.floor(Math.random() * lower.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += symbols[Math.floor(Math.random() * symbols.length)]
  for (let i = pw.length; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)]
  }
  return pw.split("").sort(() => 0.5 - Math.random()).join("")
}

// --- ⭐️ NEW: Reusable Pagination Hook ⭐️ ---
function usePagination(defaultLimit = 10) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(defaultLimit)
  const [total, setTotal] = useState(0)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.max(1, Math.min(totalPages, newPage))
    setPage(clampedPage)
    return clampedPage // Return the new page for immediate fetching
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to page 1
    return { newLimit, newPage: 1 } // Return new values for immediate fetching
  }

  return {
    page,
    limit,
    total,
    totalPages,
    setTotal,
    handlePageChange,
    handleLimitChange,
  }
}
// --- ⭐️ End of Hook ⭐️ ---

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Use the new hook for user pagination
  const {
    page: userPage,
    limit: userLimit,
    total: userTotal,
    totalPages: userTotalPages,
    setTotal: setUserTotal,
    handlePageChange: _handleUserPageChange,
    handleLimitChange: _handleUserLimitChange,
  } = usePagination(10)

  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Use the new hook for audit pagination
  const {
    page: auditPage,
    limit: auditLimit,
    total: auditTotal,
    totalPages: auditTotalPages,
    setTotal: setAuditTotal,
    handlePageChange: _handleAuditPageChange,
    handleLimitChange: _handleAuditLimitChange,
  } = usePagination(50)

  // NEW: derived pagination ranges
  const userStartItem = users.length === 0 ? 0 : (userPage - 1) * userLimit + 1
  const userEndItem = Math.min(userPage * userLimit, userTotal)
  const auditStartItem = auditLogs.length === 0 ? 0 : (auditPage - 1) * auditLimit + 1
  const auditEndItem = Math.min(auditPage * auditLimit, auditTotal)

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState<string>("")
  const [auditActionFilter, setAuditActionFilter] = useState<string>("all")
  const [auditTableFilter, setAuditTableFilter] = useState<string>("all")
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null)

  // --- User filters state ---
  const [userFilters, setUserFilters] = useState<{ search?: string; role?: string; status?: string }>({
    search: "",
    role: "all",
    status: "all",
  })
  const [userSearch, setUserSearch] = useState<string>("")
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all")
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all")

  // Add user dialog state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "",
    cityAssigned: "",
    phoneNumber: "", // ADDED
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState<string | null>(null)

  // --- ⭐️ START: Edit User State ⭐️ ---
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<any | null>(null)
  const [editUserData, setEditUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    // cityAssigned: "", // Removed
  })
  const [editingUser, setEditingUser] = useState(false)
  const [editUserError, setEditUserError] = useState<string | null>(null)
  // --- ⭐️ END: Edit User State ⭐️ ---

  // --- ⭐️ START: Confirmation Dialog State ⭐️ ---
  const [userToToggle, setUserToToggle] = useState<any | null>(null)
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] = useState(false)
  // --- ⭐️ END: Confirmation Dialog State ⭐️ ---

  // Initial data fetch
  useEffect(() => {
    // Note: Filters are NOT applied on initial load or pagination change,
    // only when the "Search" button is clicked. This matches your original logic.
    fetchUsers(userPage, userLimit)
    fetchAuditLogs(auditPage, auditLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage, userLimit, auditPage, auditLimit])

  const getAuthHeaders = () => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // --- Data Fetching ---

  // Fetch users from backend and decrypt display fields
  const fetchUsers = async (page = 1, limit = 10, filters: any = {}) => {
    setLoadingUsers(true)
    setFetchError(null)
    try {
      const params: any = { page, limit }
      if (filters.search) params.search = filters.search
      if (filters.role && filters.role !== "all") params.role = FRONTEND_TO_BACKEND_ROLE[filters.role] ?? filters.role
      if (filters.status && filters.status !== "all") params.is_active = filters.status === "active"
      const res = await api.get("/api/users", { headers: getAuthHeaders(), params })

      let payload: any = null
      if (res.data?.encrypted_data) {
        try {
          const dec = decryptObject(res.data.encrypted_data)
          payload = dec?.data ?? dec?.users ?? dec
        } catch (e: any) {
          console.error("Failed to decrypt users payload", e)
          setFetchError("Failed to decrypt users data")
          payload = { data: [], total: 0 }
        }
      } else {
        payload = res.data?.data ?? res.data ?? res
      }

      const list = Array.isArray(payload) ? payload : payload?.users ?? payload?.data ?? []

      const decrypted = list.map((u: any) => {
        const first = tryDecryptValue(u.first_name)
        const last = tryDecryptValue(u.last_name)
        const email = tryDecryptValue(u.email)
        const displayName = [first, last].filter(Boolean).join(" ").trim() || u.username
        return {
          ...u,
          first_name: first,
          last_name: last,
          email,
          displayName,
          roles: Array.isArray(u.roles) ? u.roles.filter(Boolean) : [],
        }
      })
      setUsers(decrypted)

      // This helper is great! It robustly finds the total.
      const total = extractTotalFromResponse(res, payload)
      setUserTotal(total)
    } catch (err: any) {
      console.error("Failed to fetch users", err)
      setFetchError(err?.response?.data?.message ?? err.message ?? "Failed to fetch users")
    } finally {
      setLoadingUsers(false)
    }
  }

  // Fetch audit logs and decrypt old/new payloads for display
  const fetchAuditLogs = async (page = 1, limit = 50, filters: any = {}) => {
    setLoadingAudit(true)
    try {
      const params: any = { page, limit }
      if (filters.search) params.search = filters.search
      if (filters.action && filters.action !== "all") params.action_type = filters.action
      // if (filters.table && filters.table !== "all") params.table_name = filters.table

      const res = await api.get("/api/audit", { headers: getAuthHeaders(), params })

      let payload: any = null
      if (res.data?.encrypted_data) {
        try {
          const dec = decryptObject(res.data.encrypted_data)
          payload = dec?.data ?? dec?.logs ?? dec
        } catch (e: any) {
          console.error("Failed to decrypt audit payload", e)
          payload = { data: [], total: 0 }
        }
      } else {
        payload = res.data?.data ?? res.data ?? res
      }

      const logs = Array.isArray(payload) ? payload : payload?.logs ?? payload?.data ?? []

      const mapped = logs.map((al: any) => {
        const newDataRaw = al.new_data ?? al.new ?? null
        const oldDataRaw = al.old_data ?? al.old ?? null

        const newDecoded = typeof newDataRaw === "string" && newDataRaw.includes(":") ? tryDecryptValue(newDataRaw) : newDataRaw
        const oldDecoded = typeof oldDataRaw === "string" && oldDataRaw.includes(":") ? tryDecryptValue(oldDataRaw) : oldDataRaw

        const authorFirst = tryDecryptValue(al.first_name)
        const authorLast = tryDecryptValue(al.last_name)
        const author = (authorFirst || authorLast) ? [authorFirst, authorLast].filter(Boolean).join(" ") : al.username
        return {
          ...al,
          author,
          new_raw: newDecoded,
          old_raw: oldDecoded,
          // These formatted strings aren't used, but `analyzeAudit` is, which is good.
          new_data: formatAuditPreview(newDecoded),
          old_data: formatAuditPreview(oldDecoded),
          summary: analyzeAudit({ ...al, new_raw: newDecoded, old_raw: oldDecoded }),
        }
      })
      setAuditLogs(mapped)

      let total = extractTotalFromResponse(res, payload)

      // This double-fetch logic is a smart workaround for a backend that
      // doesn't return the total count. Ideally, the /api/audit endpoint
      // should always return a `total` field, making this unnecessary.
      const looksLikePageCount = total === logs.length
      if (looksLikePageCount && logs.length > 0) {
        try {
          const countRes = await api.get("/api/audit", {
            headers: getAuthHeaders(),
            params: { page: 1, limit: 1, ...params },
          })
          let countPayload: any = null
          if (countRes.data?.encrypted_data) {
            try {
              countPayload = decryptObject(countRes.data.encrypted_data)
            } catch { countPayload = null }
          } else {
            countPayload = countRes.data?.data ?? countRes.data ?? countRes
          }
          const countTotal = extractTotalFromResponse(countRes, countPayload)
          if (typeof countTotal === "number" && countTotal > total) {
            total = countTotal
          }
        } catch (e) {
          console.warn("Failed to fetch audit total separately:", e)
        }
      }

      setAuditTotal(total)
    } catch (err) {
      console.error("Failed to fetch audit logs", err)
    } finally {
      setLoadingAudit(false)
    }
  }

  // --- Formatting & Analysis Helpers ---

  const tryDecryptValue = (val: any) => {
    if (!val || typeof val !== "string" || !val.includes(":")) return val
    try {
      const d = decryptObject(val)
      if (typeof d === "string") return d
      return typeof d === "object" ? JSON.stringify(d) : String(d)
    } catch {
      return val
    }
  }

  const formatKeyLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  // This function is complex but specific to your data. No changes made.
  const formatAuditPreview = (raw: any) => {
    if (raw === null || raw === undefined) return ""
    let obj: any = raw
    if (typeof raw === "string") {
      try {
        const maybe = raw.includes(":") ? tryDecryptValue(raw) : raw
        if (typeof maybe === "string") {
          const trimmed = maybe.trim()
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            obj = JSON.parse(trimmed)
          } else {
            return trimmed
          }
        } else {
          obj = maybe
        }
      } catch { return raw }
    }

    if (typeof obj === "object") {
      if (obj.login_time) {
        try {
          const d = new Date(obj.login_time)
          if (!isNaN(d.getTime())) return `Login Time ${d.toLocaleString()}`
        } catch { }
      } else if (obj.logout_time) {
        try {
          const d = new Date(obj.logout_time)
          if (!isNaN(d.getTime())) return `Logout Time ${d.toLocaleString()}`
        } catch { }
      }
      const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "")
      const parts = entries.slice(0, 3).map(([k, v]) => {
        let val = v
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
          try { val = new Date(v).toISOString().slice(0, 10) } catch { }
        }
        if (typeof val === "object") val = JSON.stringify(val)
        return `${formatKeyLabel(k)} ${val}`
      })
      return parts.join(", ")
    }
    return String(obj)
  }
  const analyzeAudit = (log: any) => {
    const action = (log.action_type || log.action || log.type || "").toString().toUpperCase()
    const table = log.table_name || log.table || ""
    const parseRaw = (v: any) => {
      if (!v && v !== 0) return null
      if (typeof v === "object") return v
      if (typeof v === "string") {
        try { return JSON.parse(v) } catch { return v }
      }
      return v
    }
    const newObj = parseRaw(log.new_raw ?? log.new_data ?? log.new)
    const oldObj = parseRaw(log.old_raw ?? log.old_data ?? log.old)
    const pickIdentity = (obj: any) => {
      if (!obj) return null
      if (typeof obj === "string") return obj
      return obj.username || obj.name || `${obj.first_name || ""} ${obj.last_name || ""}`.trim() || obj.id || obj.user_id || obj.record_id || null
    }

    if (action.includes("CREATE")) {
      const id = pickIdentity(newObj)
      return `Created ${table}${id ? `: ${id}` : ""}`
    }
    if (action.includes("UPDATE")) {
      if (typeof newObj === "object" && typeof oldObj === "object" && newObj && oldObj) {
        const changed = Object.keys({ ...newObj, ...oldObj }).filter((k) => String(newObj[k]) !== String(oldObj[k]))
        return changed.length > 0 ? `Updated ${changed.slice(0, 5).join(", ")}` : `Updated ${table}`
      }
      return `Updated ${table}`
    }
    if (action.includes("DELETE")) {
      const id = pickIdentity(oldObj) || pickIdentity(newObj)
      return `Deleted ${table}${id ? `: ${id}` : ""}`
    }
    if (action.includes("LOGIN")) {
      return typeof newObj === "object" && newObj?.login_time
        ? `Login Time ${new Date(newObj.login_time).toLocaleString()}`
        : "User logged in";
    }
    if (action.includes("LOGOUT")) {
      return "User logged out"
    }
    if (action.includes("DEACT") || action.includes("DISABLE")) {
      const id = pickIdentity(newObj) || pickIdentity(oldObj)
      return `Deactivated ${table}${id ? `: ${id}` : ""}`
    }
    // New case
    if (action.includes("REACTIVATE")) {
      const id = pickIdentity(newObj) || pickIdentity(oldObj)
      return `Reactivated ${table}${id ? `: ${id}` : ""}`
    }
    return String(log.action_type || log.action || log.type || formatAuditPreview(newObj) || table || "")
  }
  // --- ⭐️ END: UPDATED AUDIT ANALYSIS ⭐️ ---

  // This helper is great, no changes needed.
  const extractTotalFromResponse = (res: any, payload: any) => {
    const candidates = [
      res?.data?.total, res?.data?.count, res?.data?.meta?.total, res?.data?.meta?.count,
      payload?.total, payload?.count, payload?.meta?.total, payload?.meta?.count,
    ]
    for (const c of candidates) {
      const num = Number(c)
      if (!isNaN(num)) return num
    }
    if (Array.isArray(payload)) return payload.length
    if (Array.isArray(payload?.data)) return payload.data.length
    return 0
  }

  const formatDate = (val: any) => {
    if (!val && val !== 0) return ""
    const d = new Date(String(val))
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString()
  }

  // --- Event Handlers ---

  // Create user via backend
  const handleAddUser = async (
    e: React.FormEvent,
    payloadUser: any,
    setIsOpen: (b: boolean) => void,
    setCreating: (b: boolean) => void,
    setError: (s: string | null) => void,
    resetFn: (v: any) => void
  ) => {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const roleLabel = payloadUser.role || "User"
      const backendRole = FRONTEND_TO_BACKEND_ROLE[roleLabel] || roleLabel.toLowerCase()

      const payload = {
        username: payloadUser.username,
        password: payloadUser.password,
        first_name: payloadUser.firstName,
        last_name: payloadUser.lastName,
        email: payloadUser.email || "",
        roles: [backendRole],
        city_assigned: payloadUser.cityAssigned || null,
        phone_number: payloadUser.phoneNumber || null, // ADDED
      }

      const res = await api.post("/api/users", payload, { headers: getAuthHeaders() })

      if (res?.status === 201 || res?.data?.data || res?.data?.user_id) {
        // Success! Refresh user list
        fetchUsers(userPage, userLimit)
      } else {
        // API call was 200 OK but maybe didn't return expected data
        // Your optimistic update is a good fallback here.
        setUsers((prev) => [
          {
            id: prev.length + 1,
            ...payload,
            displayName: `${payload.first_name} ${payload.last_name}`.trim(),
            status: "Active",
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ])
      }

      resetFn({
        username: "", firstName: "", lastName: "", email: "",
        password: "", role: "User", cityAssigned: "", phoneNumber: "", // RESET ADDED
      })
      setIsOpen(false)
    } catch (err: any)
{
      setError(err?.response?.data?.message ?? err.message ?? "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  // --- ⭐️ START: Edit User Functions ⭐️ ---
  const initiateEditUser = (user: any) => {
    setUserToEdit(user)
    setEditUserData({
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
      role: (user.roles && user.roles[0]) || "",
      // cityAssigned: user.city_assigned || user.cityAssigned || "", // Removed
    })
    setEditUserError(null)
    setIsEditUserOpen(true)
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userToEdit) return

    setEditingUser(true)
    setEditUserError(null)

    const userId = userToEdit.user_id || userToEdit.id
    const authHeaders = getAuthHeaders()

    try {
      // API Call 1: Update user details
      const userDetailsPayload = {
        first_name: editUserData.firstName,
        last_name: editUserData.lastName,
        email: editUserData.email,
        // city_assigned: editUserData.cityAssigned || null, // Removed
      }
      await api.put(`/api/users/${userId}`, userDetailsPayload, { headers: authHeaders })

      // API Call 2: Update user roles
      const roleLabel = editUserData.role || "User" // Default role
      const backendRole = FRONTEND_TO_BACKEND_ROLE[roleLabel] || roleLabel
      const userRolesPayload = {
        roles: [backendRole],
      }
      await api.put(`/api/users/${userId}/roles`, userRolesPayload, { headers: authHeaders })

      // Success
      setIsEditUserOpen(false)
      setUserToEdit(null)
      fetchUsers(userPage, userLimit) // Refresh table
    } catch (err: any) {
      setEditUserError(err?.response?.data?.message ?? err.message ?? "Failed to update user")
    } finally {
      setEditingUser(false)
    }
  }
  // --- ⭐️ END: Edit User Functions ⭐️ ---

  // --- ⭐️ START: UPDATED FUNCTIONS ⭐️ ---
  // This function just opens the confirmation dialog
  const initiateToggleUserActiveState = (user: any) => {
    setUserToToggle(user)
    setIsConfirmToggleOpen(true)
  }

  // This function performs the actual API call
  const handleConfirmToggle = async () => {
    if (!userToToggle) return

    const userId = userToToggle.user_id || userToToggle.id
    const currentIsActive = userToToggle.is_active !== false // Default to active
    const actionText = currentIsActive ? "Deactivate" : "Reactivate"

    try {
      // Optimistic update
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId || u.id === userId ? { ...u, is_active: !currentIsActive } : u
        )
      )
      // API call to the new endpoint
      await api.patch(`/api/users/${userId}/toggle-active`, {}, { headers: getAuthHeaders() })

      // Full refresh
      fetchUsers(userPage, userLimit)
    } catch (err: any) {
      console.error(`Failed to ${actionText} user`, err)
      // Rollback on error
      fetchUsers(userPage, userLimit)
    } finally {
      // Close dialog and reset state
      setIsConfirmToggleOpen(false)
      setUserToToggle(null)
    }
  }
  // --- ⭐️ END: UPDATED FUNCTIONS ⭐️ ---

  // --- Pagination Handlers (Simplified) ---

  const handleAuditLimitChange = (limitStr: string) => {
    const { newLimit, newPage } = _handleAuditLimitChange(Number(limitStr))
    fetchAuditLogs(newPage, newLimit)
  }

  const handleAuditPageChange = (page: number) => {
    const newPage = _handleAuditPageChange(page)
    fetchAuditLogs(newPage, auditLimit)
  }

  const handleUserLimitChange = (limitStr: string) => {
    const { newLimit, newPage } = _handleUserLimitChange(Number(limitStr))
    fetchUsers(newPage, newLimit, userFilters)
  }

  const handleUserPageChange = (page: number) => {
    const newPage = _handleUserPageChange(page)
    fetchUsers(newPage, userLimit, userFilters)
  }

  // --- Audit Filter Handlers ---
  const handleAuditSearch = () => {
    _handleAuditPageChange(1)
    fetchAuditLogs(1, auditLimit, {
      search: auditSearch,
      action: auditActionFilter,
    })
  }

  const handleAuditFilterClear = () => {
    setAuditSearch("")
    setAuditActionFilter("all")
    _handleAuditPageChange(1)
    fetchAuditLogs(1, auditLimit)
  }

  // User filter handlers
  const handleUserSearch = () => {
    const filters = { search: userSearch, role: userRoleFilter, status: userStatusFilter }
    setUserFilters(filters)
    // reset to page 1
    _handleUserPageChange(1)
    fetchUsers(1, userLimit, filters)
  }

  const handleUserFilterClear = () => {
    setUserSearch("")
    setUserRoleFilter("all")
    setUserStatusFilter("all")
    const filters = { search: "", role: "all", status: "all" }
    setUserFilters(filters)
    _handleUserPageChange(1)
    fetchUsers(1, userLimit, filters)
  }

  // --- ⭐️ START: Helper for confirmation dialog ⭐️ ---
  const getToggleConfirmText = () => {
    if (!userToToggle) return { title: "", description: "", button: "" }
    const currentIsActive = userToToggle.is_active !== false
    const action = currentIsActive ? "Deactivate" : "Reactivate"
    return {
      title: `${action} User?`,
      description: `Are you sure you want to ${action.toLowerCase()} the user "${userToToggle.displayName || userToToggle.username}"?`,
      button: action,
      buttonVariant: currentIsActive ? "destructive" : "default",
    }
  }
  const confirmInfo = getToggleConfirmText()
  // --- ⭐️ END: Helper for confirmation dialog ⭐️ ---

  // --- JSX ---

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          </div>
        </div>
      </div>

      {/* --- Add User Dialog (Now with accessible labels) --- */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create new user</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => handleAddUser(e, newUser, setIsAddUserOpen, setCreatingUser, setCreateUserError, setNewUser)}
            className="space-y-3 mt-2"
          >
            <div className="grid gap-2">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser((s) => ({ ...s, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser((s) => ({ ...s, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                  />
                </div>
                <div className="w-36">
                  <Button
                    type="button"
                    onClick={() =>
                      setNewUser((s) => ({ ...s, username: generateUsername(s.firstName, s.lastName) }))
                    }
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="text"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                  />
                </div>
                <div className="w-36">
                  <Button
                    type="button"
                    onClick={() =>
                      setNewUser((s) => ({ ...s, password: generatePassword(14) }))
                    }
                  >
                    Strong pw
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))} />
              </div>

              {/* ADDED: Phone Number */}
              <div className="space-y-1">
                <Label htmlFor="phone">Phone number (E.164, e.g. +639xxxxxxxxx)</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  placeholder="+639XXXXXXXXX"
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser((s) => ({ ...s, phoneNumber: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={(val) => setNewUser((s) => ({ ...s, role: val }))} value={newUser.role}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(FRONTEND_TO_BACKEND_ROLE).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="city">City (optional)</Label>
                <Input id="city" value={newUser.cityAssigned} onChange={(e) => setNewUser((s) => ({ ...s, cityAssigned: e.target.value }))} />
              </div>
            </div>

            {createUserError && <div className="text-red-600 text-sm">{createUserError}</div>}

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsAddUserOpen(false)} disabled={creatingUser}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser ? "Creating…" : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- ⭐️ START: Edit User Dialog ⭐️ --- */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Editing user: {userToEdit?.displayName || userToEdit?.username}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleEditUser}
            className="space-y-3 mt-2"
          >
            <div className="grid gap-2">
              <div className="space-y-1">
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    value={userToEdit?.username || ""}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Usernames cannot be changed.</p>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="edit-firstName">First name</Label>
                  <Input
                    id="edit-firstName"
                    value={editUserData.firstName}
                    onChange={(e) => setEditUserData((s) => ({ ...s, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="edit-lastName">Last name</Label>
                  <Input
                    id="edit-lastName"
                    value={editUserData.lastName}
                    onChange={(e) => setEditUserData((s) => ({ ...s, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editUserData.email} onChange={(e) => setEditUserData((s) => ({ ...s, email: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-role">Role</Label>
                <Select onValueChange={(val) => setEditUserData((s) => ({ ...s, role: val }))} value={editUserData.role}>
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(FRONTEND_TO_BACKEND_ROLE).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Removed City Field
              <div className="space-y-1">
                <Label htmlFor="edit-city">City (optional)</Label>
                <Input id="edit-city" value={editUserData.cityAssigned} onChange={(e) => setEditUserData((s) => ({ ...s, cityAssigned: e.target.value }))} />
              </div>
              */}
            </div>

            {editUserError && <div className="text-red-600 text-sm">{editUserError}</div>}

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditUserOpen(false)} disabled={editingUser}>
                Cancel
              </Button>
              <Button type="submit" disabled={editingUser}>
                {editingUser ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* --- ⭐️ END: Edit User Dialog ⭐️ --- */}

      {/* --- ⭐️ START: Confirmation Dialog ⭐️ --- */}
      <Dialog open={isConfirmToggleOpen} onOpenChange={setIsConfirmToggleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmInfo.title}</DialogTitle>
            <DialogDescription>
              {confirmInfo.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirmToggleOpen(false)
                setUserToToggle(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant={confirmInfo.buttonVariant as any}
              onClick={handleConfirmToggle}
            >
              {confirmInfo.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- ⭐️ END: Confirmation Dialog ⭐️ --- */}


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userTotal}</div>
            <p className="text-xs text-muted-foreground">{users.filter((u) => u.is_active !== false).length} active on this page</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditTotal}</div>
            <p className="text-xs text-muted-foreground">Log entries total</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4 ">
        <TabsList className="w-full">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Optional: keep external heading, or remove for cleaner card-only UI */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Manage Users</h3>
            <Button onClick={() => setIsAddUserOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add user</Button>
          </div>

          {/* Filters remain unchanged */}
          <div className="flex flex-col md:flex-row md:items-end md:space-x-2 gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="userSearch">Search</Label>
              <Input id="userSearch" placeholder="Search by name, username or email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <div className="md:max-w-[200px]">
              <Label htmlFor="userRole">Role</Label>
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger id="userRole"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.keys(FRONTEND_TO_BACKEND_ROLE).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="max-w-[1600px]">
              <Label htmlFor="userStatus">Status</Label>
              <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                <SelectTrigger id="userStatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={handleUserSearch}>Search</Button>
              <Button variant="secondary" onClick={handleUserFilterClear}>Clear</Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                 <div>
                   <CardTitle>Users ({userTotal})</CardTitle>
                   <CardDescription>Manage active and inactive users</CardDescription>
                 </div>
                 <div className="flex flex-wrap items-center gap-4">
                   <div className="text-sm text-muted-foreground">
                     {userTotal === 0
                       ? "No results"
                       : `Showing ${userStartItem}–${userEndItem} of ${userTotal}`}
                   </div>
                   <div className="flex items-center space-x-2">
                     <label htmlFor="userRows" className="text-sm text-muted-foreground">Rows</label>
                     <select
                       id="userRows"
                       className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none"
                       value={userLimit}
                       onChange={(e) => handleUserLimitChange(e.target.value)}
                     >
                       {[10,25,50].map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                   </div>
                   <div className="flex items-center space-x-1">
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={loadingUsers || userPage === 1}
                       onClick={() => handleUserPageChange(userPage - 1)}
                     >
                       Prev
                     </Button>
                     <span className="px-2 text-sm">
                       Page {userPage} / {userTotalPages}
                     </span>
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={loadingUsers || userPage === userTotalPages}
                       onClick={() => handleUserPageChange(userPage + 1)}
                     >
                       Next
                     </Button>
                   </div>
                 </div>
               </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingUsers && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-4 text-center text-sm text-muted-foreground">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingUsers && users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-4 text-center text-sm text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingUsers && users.map((user) => {
                    const name = user.displayName || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username
                    return (
                      <TableRow key={user.user_id || user.id}>
                        <TableCell>
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">{user.username}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{(user.roles && user.roles[0]) || "—"}</Badge>
                        </TableCell>
                        <TableCell>{user.phone_number || "—"}</TableCell>
                        <TableCell>{user.city_assigned || user.cityAssigned || "—"}</TableCell>
                        <TableCell>
                          {user.is_active === false
                            ? <Badge variant="secondary">Inactive</Badge>
                            : <Badge>Active</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => initiateEditUser(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {user.is_active === false ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-600 hover:text-green-700 hover:border-green-700 hover:bg-green-50"
                                onClick={() => initiateToggleUserActiveState(user)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => initiateToggleUserActiveState(user)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <h3 className="text-lg font-semibold">System Audit Logs</h3>
          {/* Filters unchanged */}
          <div className="flex flex-col md:flex-row md:items-end md:space-x-2 gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="auditSearch">Search</Label>
              <Input
                id="auditSearch"
                placeholder="Search by user, ID, or data..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1 md:max-w-[200px]">
              <Label htmlFor="auditAction">Action</Label>
              <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                <SelectTrigger id="auditAction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {AUDIT_ACTIONS.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={handleAuditSearch}>Search</Button>
              <Button variant="secondary" onClick={handleAuditFilterClear}>Clear</Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                 <div>
                   <CardTitle>Audit Logs ({auditTotal})</CardTitle>
                   <CardDescription>Recent system changes</CardDescription>
                 </div>
                 <div className="flex flex-wrap items-center gap-4">
                   <div className="text-sm text-muted-foreground">
                     {auditTotal === 0
                       ? "No results"
                       : `Showing ${auditStartItem}–${auditEndItem} of ${auditTotal}`}
                   </div>
                   <div className="flex items-center space-x-2">
                     <label htmlFor="auditRows" className="text-sm text-muted-foreground">Rows</label>
                     <select
                       id="auditRows"
                       className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none"
                       value={auditLimit}
                       onChange={(e) => handleAuditLimitChange(e.target.value)}
                     >
                       {[10,25,50].map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                   </div>
                   <div className="flex items-center space-x-1">
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={loadingAudit || auditPage === 1}
                       onClick={() => handleAuditPageChange(auditPage - 1)}
                     >
                       Prev
                     </Button>
                     <span className="px-2 text-sm">
                       Page {auditPage} / {auditTotalPages}
                     </span>
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={loadingAudit || auditPage === auditTotalPages}
                       onClick={() => handleAuditPageChange(auditPage + 1)}
                     >
                       Next
                     </Button>
                   </div>
                 </div>
               </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAudit && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-4 text-center text-sm text-muted-foreground">
                        Loading audit logs...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingAudit && auditLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-4 text-center text-sm text-muted-foreground">
                        No audit logs found.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingAudit && auditLogs.map((log, i) => {
                    const whenRaw = log.change_timestamp || log.created_at || log.logged_at || log.timestamp || log.created || ""
                    const whenFormatted = formatDate(whenRaw)
                    const keyFallback = `${log.table_name || "log"}-${String(log.record_id || "")}-${String(whenRaw || "")}-${i}`

                    return (
                      <TableRow key={log.audit_id || log.id || keyFallback}>
                        <TableCell className="w-[180px] text-xs">{whenFormatted}</TableCell>
                        <TableCell className="text-sm">{log.author}</TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="outline">{log.action_type || log.action || log.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.summary}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setSelectedAuditLog(log); setAuditModalOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- Audit Detail Dialog (Simplified) --- */}
      <Dialog open={auditModalOpen} onOpenChange={(open) => { if (!open) setSelectedAuditLog(null); setAuditModalOpen(open); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedAuditLog ? (
              <>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div><strong>Actor:</strong> {selectedAuditLog.author || selectedAuditLog.username}</div>
                  <div><strong>Action:</strong> {selectedAuditLog.action_type || selectedAuditLog.action}</div>
                  <div><strong>Table:</strong> {selectedAuditLog.table_name}</div>
                  <div><strong>Date:</strong> {formatDate(selectedAuditLog.created_at || selectedAuditLog.logged_at || "")}</div>
                </div>

                <div>
                  <h4 className="font-semibold">New Data</h4>
                  <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-xs">
                    {JSON.stringify(selectedAuditLog.new_raw, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold">Old Data</h4>
                  <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-xs">
                    {JSON.stringify(selectedAuditLog.old_raw, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div>No audit selected</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

