"use client"

import { useState, useEffect } from "react"
import { decryptObject } from "@/utils/decrypt"
import axios from "axios"
import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, Shield, Activity, Plus, Edit, Trash2, AlertTriangle, CheckCircle, Eye } from "lucide-react"

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
  // ensure at least one of each category
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += lower[Math.floor(Math.random() * lower.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += symbols[Math.floor(Math.random() * symbols.length)]
  for (let i = pw.length; i < length; i++) {
    pw += all[Math.floor(Math.random() * all.length)]
  }
  return pw.split("").sort(() => 0.5 - Math.random()).join("")
}

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // pagination: users
  const [userPage, setUserPage] = useState<number>(1)
  const [userLimit, setUserLimit] = useState<number>(10)
  const [userTotal, setUserTotal] = useState<number>(0)

  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // pagination: audits
  const [auditPage, setAuditPage] = useState<number>(1)
  const [auditLimit, setAuditLimit] = useState<number>(50)
  const [auditTotal, setAuditTotal] = useState<number>(0)

  const [auditSearch, setAuditSearch] = useState<string>("")
  const [auditActionFilter, setAuditActionFilter] = useState<string>("all")
  const [auditTableFilter, setAuditTableFilter] = useState<string>("all")
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null)

  // Add user dialog / form state (separate first/last)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "",
    cityAssigned: "",
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers(userPage, userLimit)
    fetchAuditLogs(auditPage, auditLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage, userLimit, auditPage, auditLimit])

  const getAuthHeaders = () => {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const tryDecryptValue = (val: any) => {
    if (!val || typeof val !== "string") return val
    if (!val.includes(":")) return val
    try {
      const d = decryptObject(val)
      // decryptObject returns parsed JSON — prefer primitive string if present
      if (typeof d === "string") return d
      // if parsed value is an object/array, return JSON string for display
      return typeof d === "object" ? JSON.stringify(d) : String(d)
    } catch {
      return val
    }
  }

  // New: format audit payloads for easy reading (e.g. {"login_time":"2025-10-25T14:07:45.867Z"} -> "Login Time 2025-10-25")
  const formatKeyLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  const formatAuditPreview = (raw: any) => {
    if (raw === null || raw === undefined) return ""
    let obj: any = raw

    // If it's a string that looks encrypted/JSON, try to decrypt/parse it
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
      } catch {
        // fallback to original string
        return raw
      }
    }

    // If object/record - format nicely
    if (typeof obj === "object") {
      // prefer known timestamp fields
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



      // pick first up to 3 meaningful fields to show
      const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "")
      const parts = entries.slice(0, 3).map(([k, v]) => {
        let val = v
        // shorten ISO datetimes to date only
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
          try {
            val = new Date(v).toISOString().slice(0, 10)
          } catch { }
        }
        // if value is an object/array, stringify briefly
        if (typeof val === "object") val = JSON.stringify(val)
        return `${formatKeyLabel(k)} ${val}`
      })
      return parts.join(", ")
    }

    // fallback
    return String(obj)
  }

  // Analyze audit entry and produce a short human-friendly description
  const analyzeAudit = (log: any) => {
    const action = (log.action_type || log.action || log.type || "").toString().toUpperCase()
    const table = log.table_name || log.table || ""

    const parseRaw = (v: any) => {
      if (!v && v !== 0) return null
      if (typeof v === "object") return v
      if (typeof v === "string") {
        try {
          return JSON.parse(v)
        } catch {
          return v
        }
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
      // formatAuditPreview already handles login_time -> "Login Time YYYY-MM-DD HH:mm:ss"
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

    // fallback to stringified preview or action
    return String(log.action_type || log.action || log.type || formatAuditPreview(newObj) || table || "")
  }

  const extractTotalFromResponse = (res: any, payload: any) => {
    // common places backend might send totals
    const candidates = [
      res?.data?.total,
      res?.data?.count,
      res?.data?.meta?.total,
      res?.data?.meta?.count,
      payload?.total,
      payload?.count,
      payload?.meta?.total,
      payload?.meta?.count,
    ]
    for (const c of candidates) {
      if (typeof c === "number" && !isNaN(c)) return c
      if (typeof c === "string" && !isNaN(Number(c))) return Number(c)
    }
    // fallback to length of array
    if (Array.isArray(payload)) return payload.length
    if (Array.isArray(payload?.data)) return payload.data.length
    return 0
  }

  // Fetch users from backend and decrypt display fields
  const fetchUsers = async (page = 1, limit = 10) => {
    setLoadingUsers(true)
    setFetchError(null)
    try {
      const res = await api.get("/api/users", { headers: getAuthHeaders(), params: { page, limit } })

      // handle encrypted payload like patients page
      let payload: any = null
      if (res.data?.encrypted_data) {
        try {
          const dec = decryptObject(res.data.encrypted_data)
          if (Array.isArray(dec)) payload = dec
          else if (dec?.users && Array.isArray(dec.users)) payload = dec.users
          else if (dec?.data && Array.isArray(dec.data)) payload = dec.data
          else payload = dec
        } catch (e: any) {
          console.error("Failed to decrypt users payload", e)
          setFetchError("Failed to decrypt users data")
          payload = []
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
      // build params with pagination + filters
      const params: any = { page, limit }
      if (filters.search) params.search = filters.search
      if (filters.action) params.action_type = filters.action
      if (filters.table) params.table_name = filters.table

      const res = await api.get("/api/audit", { headers: getAuthHeaders(), params })

      // handle encrypted payload
      let payload: any = null
      if (res.data?.encrypted_data) {
        try {
          const dec = decryptObject(res.data.encrypted_data)
          if (Array.isArray(dec)) payload = dec
          else if (dec?.logs && Array.isArray(dec.logs)) payload = dec.logs
          else if (dec?.data && Array.isArray(dec.data)) payload = dec.data
          else payload = dec
        } catch (e: any) {
          console.error("Failed to decrypt audit payload", e)
          payload = []
        }
      } else {
        payload = res.data?.data ?? res.data ?? res
      }

      const logs = Array.isArray(payload) ? payload : payload?.logs ?? (payload?.data ?? [])

      const mapped = logs.map((al: any) => {
        const newDataRaw = al.new_data ?? al.new ?? null
        const oldDataRaw = al.old_data ?? al.old ?? null

        const newDecoded = typeof newDataRaw === "string" && newDataRaw.includes(":") ? tryDecryptValue(newDataRaw) : newDataRaw
        const oldDecoded = typeof oldDataRaw === "string" && oldDataRaw.includes(":") ? tryDecryptValue(oldDataRaw) : oldDataRaw

        const newData = formatAuditPreview(newDecoded)
        const oldData = formatAuditPreview(oldDecoded)

        const authorFirst = tryDecryptValue(al.first_name)
        const authorLast = tryDecryptValue(al.last_name)
        const author = (authorFirst || authorLast) ? [authorFirst, authorLast].filter(Boolean).join(" ") : al.username
        return {
          ...al,
          author,
          // keep raw decoded payloads for modal view
          new_raw: newDecoded,
          old_raw: oldDecoded,
          new_data: newData,
          old_data: oldData,
          summary: analyzeAudit({ ...al, new_raw: newDecoded, old_raw: oldDecoded }),
        }
      })
      setAuditLogs(mapped)

      // Try to get total from response / payload first
      let total = extractTotalFromResponse(res, payload)

      // If total looks like it's just the returned page length (server didn't provide total),
      // do a lightweight request to obtain the real total.
      const looksLikePageCount = total === logs.length
      if (looksLikePageCount) {
        try {
          const countRes = await api.get("/api/audit", {
            headers: getAuthHeaders(),
            params: { page: 1, limit: 1, ...params },
          })
          let countPayload: any = null
          if (countRes.data?.encrypted_data) {
            try {
              const dec = decryptObject(countRes.data.encrypted_data)
              // dec may be object with total or array; prefer object.total
              countPayload = dec
            } catch {
              countPayload = null
            }
          } else {
            countPayload = countRes.data?.data ?? countRes.data ?? countRes
          }
          const countTotal = extractTotalFromResponse(countRes, countPayload)
          if (typeof countTotal === "number" && countTotal > total) {
            total = countTotal
          }
        } catch (e) {
          // ignore — keep original total
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

  // Create user via backend (uses backend role names)
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
      }

      const res = await api.post("/api/users", payload, { headers: getAuthHeaders() })

      if (res?.status === 201 || res?.data?.data || res?.data?.user_id) {
        // refresh current page
        fetchUsers(userPage, userLimit)
      } else {
        // optimistic UI fallback
        setUsers((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            username: payloadUser.username,
            displayName: `${payloadUser.firstName} ${payloadUser.lastName}`.trim(),
            roles: [backendRole],
            city_assigned: payloadUser.cityAssigned,
            status: "Active",
            lastLogin: "Never",
            createdAt: new Date().toISOString(),
          },
        ])
      }

      resetFn({
        username: "",
        firstName: "",
        lastName: "",
        role: "User",
        cityAssigned: "",
        password: "",
        email: "",
      })
      setIsOpen(false)
    } catch (err: any) {
      console.error("Create user failed", err)
      setError(err?.response?.data?.message ?? err.message ?? "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  // New: deactivate user (calls backend, optimistic UI)
  const handleDeactivateUser = async (userId: string | number) => {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return
    try {
      // optimistic update
      setUsers((prev) => prev.map((u) => (u.user_id === userId || u.id === userId ? { ...u, is_active: false } : u)))
      // try PATCH first; fallback to POST if PATCH fails
      try {
        await api.patch(`/api/users/${userId}/deactivate`, null, { headers: getAuthHeaders() })
      } catch (err) {
        // fallback attempt
        await api.post(`/api/users/${userId}/deactivate`, null, { headers: getAuthHeaders() })
      }
      // refresh list to ensure server state is shown
      fetchUsers(userPage, userLimit)
    } catch (err) {
      console.error("Failed to deactivate user", err)
      // rollback / refresh
      fetchUsers(userPage, userLimit)
    }
  }

  // Explicit pagination handlers (call API immediately)
  const handleAuditLimitChange = (limit: number) => {
    setAuditLimit(limit)
    setAuditPage(1)
    fetchAuditLogs(1, limit)
  }

  const handleAuditPageChange = (page: number) => {
    // guard
    const newPage = Math.max(1, Math.min(Math.max(1, Math.ceil(auditTotal / auditLimit || 1)), page))
    setAuditPage(newPage)
    fetchAuditLogs(newPage, auditLimit)
  }

  // Users pagination handlers
  const handleUserLimitChange = (limit: number) => {
    setUserLimit(limit)
    setUserPage(1)
    fetchUsers(1, limit)
  }

  const handleUserPageChange = (page: number) => {
    const newPage = Math.max(1, Math.min(Math.max(1, Math.ceil(userTotal / userLimit || 1)), page))
    setUserPage(newPage)
    fetchUsers(newPage, userLimit)
  }
  const userTotalPages = Math.max(1, Math.ceil(userTotal / userLimit))
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditLimit))

  // helper: format various timestamp fields into a human friendly string
  const formatDate = (val: any) => {
    if (!val && val !== 0) return ""
    const s = String(val)
    const d = new Date(s)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
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
                    <div className="flex-1">
                      <Label>First name</Label>
                      <Input
                        value={newUser.firstName}
                        onChange={(e) => setNewUser((s) => ({ ...s, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Last name</Label>
                      <Input
                        value={newUser.lastName}
                        onChange={(e) => setNewUser((s) => ({ ...s, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Username</Label>
                      <Input
                        required
                        value={newUser.username}
                        onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                      />
                    </div>
                    <div className="w-36">
                      <Button
                        type="button"
                        onClick={() =>
                          setNewUser((s) => ({
                            ...s,
                            username: generateUsername(s.firstName, s.lastName),
                          }))
                        }
                      >
                        Generate
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Password</Label>
                      <Input
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
                          setNewUser((s) => ({
                            ...s,
                            password: generatePassword(14),
                          }))
                        }
                      >
                        Strong pw
                      </Button>
                    </div>
                  </div>

                  <Label>Email</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))} />

                  <Label>Role</Label>
                  <Select onValueChange={(val) => setNewUser((s) => ({ ...s, role: val }))} value={newUser.role}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(FRONTEND_TO_BACKEND_ROLE).map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Label>City (optional)</Label>
                  <Input value={newUser.cityAssigned} onChange={(e) => setNewUser((s) => ({ ...s, cityAssigned: e.target.value }))} />
                </div>

                {createUserError && <div className="text-red-600 text-sm">{createUserError}</div>}

                <div className="flex justify-end space-x-2">
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userTotal}</div>
            <p className="text-xs text-muted-foreground">{users.filter((u) => u.is_active || u.status === "Active").length} active (page)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
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
          {/* user management table */}
          <div className="flex items-center justify-between">

            <h3 className="text-lg font-semibold">Manage Users</h3>
            <div />
            <div className="flex items-center space-x-2">
              <Button onClick={() => setIsAddUserOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add user</Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow >
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id || user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.displayName || `${user.first_name} ${user.last_name}`}</div>
                          <div className="text-sm text-muted-foreground">{user.username}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{(user.roles && user.roles[0]) || "—"}</Badge>
                      </TableCell>
                      <TableCell>{user.city_assigned || user.cityAssigned || "N/A"}</TableCell>
                      <TableCell>{user.is_active === false ? <Badge variant="secondary">Inactive</Badge> : <Badge>Active</Badge>}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" onClick={() => { /* edit */ }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {user.is_active === false ? (
                            <Badge variant="secondary" className="px-3 py-2">Deactivated</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeactivateUser(user.user_id || user.id)}
                            >
                              <Trash2 className="h-4 w-4" /> Deactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* users pagination */}
              <div className="p-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {users.length} of {userTotal} users
                </div>
                <div className="flex items-center space-x-2">
                  <Select onValueChange={(v) => { handleUserLimitChange(Number(v)); }} value={String(userLimit)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-50">
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="25">25 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" disabled={loadingUsers || userPage <= 1} onClick={() => handleUserPageChange(userPage - 1)}>
                    Prev
                  </Button>
                  <div className="text-sm px-2">
                    Page {userPage} / {userTotalPages}
                  </div>
                  <Button size="sm" disabled={loadingUsers || userPage >= userTotalPages} onClick={() => handleUserPageChange(userPage + 1)}>
                    Next
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <h3 className="text-lg font-semibold">System Audit Logs</h3>

          {/* Filters / Search */}
          <div className="flex flex-col md:flex-row md:items-end md:space-x-4 gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Button onClick={() => { setAuditPage(1); fetchAuditLogs(1, auditLimit, { search: auditSearch, action: auditActionFilter, table: auditTableFilter }); }}>
                Search
              </Button>
              <Button variant="secondary" onClick={() => { setAuditSearch(""); setAuditActionFilter(""); setAuditTableFilter(""); setAuditPage(1); fetchAuditLogs(1, auditLimit); }}>
                Clear
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log, i) => {
                    // prefer backend timestamp fields in order of likelihood
                    const whenRaw =
                      log.change_timestamp ||
                      log.created_at ||
                      log.logged_at ||
                      log.timestamp ||
                      log.created ||
                      ""

                    const whenFormatted = formatDate(whenRaw)
                    const keyFallback = `${log.table_name || "fitting_table"}-${String(log.record_id || "")}-${String(whenRaw || "")}-${i}`

                    return (
                      <TableRow key={log.audit_id || log.id || keyFallback}>
                        <TableCell className="w-[180px] text-xs">{whenFormatted}</TableCell>
                        <TableCell className="text-sm">{log.author || log.username || `${log.first_name || ""} ${log.last_name || ""}`.trim()}</TableCell>
                        <TableCell className="text-sm">{log.action_type || log.action || log.type}</TableCell>
                        <TableCell className="text-center">
                          <Button className="flex items-center" size="sm" variant="ghost" onClick={() => { setSelectedAuditLog(log); setAuditModalOpen(true); }}>
                            <Eye className="h-4 w-8" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* users pagination */}
              <div className="p-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {auditLogs.length} of {auditTotal} logs
                </div>
                <div className="flex items-center space-x-2">
                  <Select onValueChange={(v) => { handleAuditLimitChange(Number(v)); }} value={String(auditLimit)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-50">
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="25">25 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" disabled={loadingAudit || auditPage <= 1} onClick={() => handleAuditPageChange(auditPage - 1)}>
                    Prev
                  </Button>
                  <div className="text-sm px-2">
                    Page {auditPage} / {auditTotalPages}
                  </div>
                  <Button size="sm" disabled={loadingAudit || auditPage >= auditTotalPages} onClick={() => handleAuditPageChange(auditPage + 1)}>
                    Next
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Audit detail dialog */}
      <Dialog open={auditModalOpen} onOpenChange={(open) => { if (!open) setSelectedAuditLog(null); setAuditModalOpen(open); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedAuditLog ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <strong>Actor:</strong> {selectedAuditLog.author || selectedAuditLog.username}
                  <br />
                  <strong>Action:</strong> {selectedAuditLog.action_type || selectedAuditLog.action}
                  <br />
                  <strong>Table:</strong> {selectedAuditLog.table_name}
                  <br />
                  <strong>Date:</strong> {selectedAuditLog.created_at || selectedAuditLog.logged_at || ""}
                </div>

                <div>
                  <h4 className="font-semibold">New Data</h4>
                  <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-xs">
                    {JSON.stringify(selectedAuditLog.new_raw ?? selectedAuditLog.new_data ?? selectedAuditLog.new, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold">Old Data</h4>
                  <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-64 text-xs">
                    {JSON.stringify(selectedAuditLog.old_raw ?? selectedAuditLog.old_data ?? selectedAuditLog.old, null, 2)}
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
