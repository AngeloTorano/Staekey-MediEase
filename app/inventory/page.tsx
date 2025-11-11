"use client"

import  React from "react"
import { useState, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Search, Plus, Edit, AlertTriangle, Package, Loader2, FileText } from "lucide-react"
import { decryptObject } from "@/utils/decrypt" // <-- decrypt helper
import { useReactToPrint } from "react-to-print"

// API instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
})

function mapFrontendTypeToBackend(type: string) {
  // Frontend friendly -> backend transaction type names
  if (type === "Inflow") return "Received"
  if (type === "Outflow") return "Used"
  if (type === "Adjustment") return "Transferred"
  return type
}

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("All Types")
  const [filterStock, setFilterStock] = useState("All Stocks")
  const [filterStatus, setFilterStatus] = useState("All Status") // removed filterLocation

  const [showAddSupply, setShowAddSupply] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [selectedSupply, setSelectedSupply] = useState<any>(null)

  const [supplies, setSupplies] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionTypes, setTransactionTypes] = useState<string[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restock dialog state
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockSupplyId, setRestockSupplyId] = useState<number | null>(null)
  const [restockQty, setRestockQty] = useState<string>("")
  const [restockNotes, setRestockNotes] = useState<string>("")

  const [newSupply, setNewSupply] = useState({
    item_name: "",
    description: "",
    current_stock: "",
    min_stock_level: "",
    unit_of_measure: "",
    category_id: "none",
  })

  const [newTransaction, setNewTransaction] = useState({
    supply_id: "",
    transaction_type: "",
    quantity_change: "",
    related_event_type: "",
    comments: "",
  })

  // Usage dialog state
  const [usageOpen, setUsageOpen] = useState(false)
  const [usageSupply, setUsageSupply] = useState<any>(null)
  const [usageQty, setUsageQty] = useState("")
  const [usagePatientId, setUsagePatientId] = useState("")
  const [usagePhaseId, setUsagePhaseId] = useState("")
  const [usageEvent, setUsageEvent] = useState("")

  // Print reference
  const printRef = React.useRef<HTMLDivElement | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  // EDIT dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState({
    item_name: "",
    unit_of_measure: "",
    reorder_level: "",
    category_id: "none",
  })

  // Fetch supplies + meta
  const fetchSupplies = async () => {
    setLoading(true)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.get("/api/supplies", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: { limit: 1000 },
      })

      let payload: any = null
      if (res.data?.encrypted_data) {
        payload = decryptObject(res.data.encrypted_data)
      } else {
        payload = res.data?.data ?? res.data
      }

      const normalizeSupplies = (raw: any): any[] => {
        if (Array.isArray(raw)) return raw
        if (raw?.supplies && Array.isArray(raw.supplies)) return raw.supplies
        if (raw?.rows && Array.isArray(raw.rows)) return raw.rows
        return []
      }

      setSupplies(normalizeSupplies(payload))
    } catch (err) {
      console.error("fetchSupplies error:", err)
      setError("Failed to load supplies")
      setSupplies([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactionTypes = async () => {
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.get("/api/supplies/transaction-types", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      let payload = res.data?.encrypted_data ? decryptObject(res.data.encrypted_data) : res.data?.data ?? res.data
      // payload may be array of { transaction_type_id, type_name } or strings
      const types = Array.isArray(payload) ? payload.map((t: any) => (typeof t === "string" ? t : t.type_name)) : []
      setTransactionTypes(types)
    } catch (err) {
      console.warn("Failed to fetch transaction types", err)
    }
  }

  const fetchCategories = async () => {
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.get("/api/supplies/categories", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      let payload = res.data?.encrypted_data ? decryptObject(res.data.encrypted_data) : res.data?.data ?? res.data
      setCategories(Array.isArray(payload) ? payload : [])
    } catch (err) {
      console.warn("Failed to fetch categories", err)
    }
  }

  useEffect(() => {
    fetchSupplies()
    fetchTransactionTypes()
    fetchCategories()
  }, [])

  // When selecting a supply, fetch its transactions for the tab view
  const loadSupplyTransactions = async (supplyId: number) => {
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.get(`/api/supplies/${supplyId}/transactions`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      let payload = res.data?.encrypted_data ? decryptObject(res.data.encrypted_data) : res.data?.data ?? res.data
      setTransactions(Array.isArray(payload) ? payload : [])
    } catch (err) {
      console.warn("Failed to load transactions", err)
      setTransactions([])
    }
  }

  // Create supply
  const handleAddSupply = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem("token") || localStorage.getItem("token")
          : null

      // Normalize numbers
      const current = Number(newSupply.current_stock)
      const reorder = Number(newSupply.min_stock_level)

      if (Number.isNaN(current) || Number.isNaN(reorder)) {
        setError("Current stock and min stock level must be numbers")
        setLoading(false)
        return
      }

      const payload: any = {
        item_name: newSupply.item_name.trim(),
        unit_of_measure: newSupply.unit_of_measure.trim(),
        current_stock_level: current,
        reorder_level: reorder,
        description: newSupply.description.trim() || undefined,
        category_id: newSupply.category_id === "none" ? undefined : Number(newSupply.category_id),
        // Provide initial_stock_level if backend expects it
        initial_stock_level: current,
      }

      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])

      const res = await api.post("/api/supplies", payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const returned =
        res.data?.encrypted_data
          ? decryptObject(res.data.encrypted_data)
          : res.data?.data ?? res.data

      setSupplies((prev) => [returned, ...prev])
      setShowAddSupply(false)
      setNewSupply({
        item_name: "",
        description: "",
        current_stock: "",
        min_stock_level: "",
        unit_of_measure: "",
        category_id: "none",
      })
    } catch (err: any) {
      console.error("Add supply failed full response:", err?.response?.data)
      const serverErrors = err?.response?.data?.error
      if (Array.isArray(serverErrors) && serverErrors.length) {
        setError(serverErrors.map((e: any) => e.message || String(e)).join(", "))
      } else {
        setError(err?.response?.data?.message || "Failed to add supply")
      }
    } finally {
      setLoading(false)
    }
  }

  // Record stock transaction (calls PUT /api/supplies/:supplyId/stock)
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const supplyId = Number(newTransaction.supply_id)
      const quantity = Number(newTransaction.quantity_change)
      const transaction_type = mapFrontendTypeToBackend(newTransaction.transaction_type)
      const notes = newTransaction.comments || undefined

      await api.put(`/api/supplies/${supplyId}/stock`, { quantity, transaction_type, notes }, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

      // refresh supply list & selected supply transactions
      await fetchSupplies()
      if (selectedSupply) loadSupplyTransactions(selectedSupply.supply_id)

      setShowAddTransaction(false)
      setNewTransaction({
        supply_id: "",
        transaction_type: "",
        quantity_change: "",
        related_event_type: "",
        comments: "",
      })
    } catch (err: any) {
      console.error("Record transaction failed:", err)
      setError(err?.response?.data?.message || "Failed to record transaction")
    } finally {
      setLoading(false)
    }
  }

  // Restock handler (positive quantity, transaction type Received)
  const handleRestockSubmit = async (e?: React.FormEvent, supplyIdArg?: number) => {
    if (e) e.preventDefault()
    const supplyId = supplyIdArg ?? restockSupplyId
    if (!supplyId) return
    const quantity = Number(restockQty)
    if (!quantity || quantity <= 0) {
      setError("Enter a valid restock quantity")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      await api.put(
        `/api/supplies/${supplyId}/stock`,
        { quantity, transaction_type: "Received", notes: restockNotes || undefined },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )

      await fetchSupplies()
      if (selectedSupply) loadSupplyTransactions(selectedSupply.supply_id)

      // reset/close
      setRestockOpen(false)
      setRestockSupplyId(null)
      setRestockQty("")
      setRestockNotes("")
    } catch (err: any) {
      console.error("Restock failed:", err)
      setError(err?.response?.data?.message || "Failed to restock")
    } finally {
      setLoading(false)
    }
  }

  // Usage submit handler
  const submitUsage = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!usageSupply) return
    const qty = Number(usageQty)
    if (!qty || qty <= 0) {
      setError("Enter a positive quantity")
      return
    }
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      await api.put(
        `/api/supplies/${usageSupply.supply_id}/stock`,
        {
          quantity: -Math.abs(qty),
          transaction_type: "Used",
          notes: usageEvent ? `Usage: ${usageEvent}` : undefined,
          patient_id: usagePatientId ? Number(usagePatientId) : undefined,
          phase_id: usagePhaseId ? Number(usagePhaseId) : undefined,
          related_event_type: usageEvent || undefined,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      setUsageOpen(false)
      setUsageSupply(null)
      setUsageQty("")
      setUsagePatientId("")
      setUsagePhaseId("")
      setUsageEvent("")
      await fetchSupplies()
      if (selectedSupply) loadSupplyTransactions(selectedSupply.supply_id)
    } catch (err: any) {
      console.error("Usage failed:", err)
      setError(err?.response?.data?.message || "Usage failed")
    }
  }

  // Open edit for a row
  const openEdit = (supply: any) => {
    setSelectedSupply(supply)
    setEditData({
      item_name: supply.item_name || "",
      unit_of_measure: supply.unit_of_measure || "",
      reorder_level: String(supply.reorder_level ?? supply.min_stock_level ?? ""),
      category_id: supply.category_id ? String(supply.category_id) : "none",
    })
    setEditOpen(true)
  }

  // Submit edit
  const handleUpdateSupply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSupply) return
    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null

      const payload: any = {
        item_name: editData.item_name.trim(),
        unit_of_measure: editData.unit_of_measure.trim(),
        reorder_level: Number(editData.reorder_level),
      }
      if (editData.category_id !== "none") payload.category_id = Number(editData.category_id)

      if (!payload.item_name || !payload.unit_of_measure || Number.isNaN(payload.reorder_level)) {
        setError("Name, Unit, and Reorder Level are required")
        setLoading(false)
        return
      }

      const res = await api.put(`/api/supplies/${selectedSupply.supply_id}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const updated = res.data?.encrypted_data ? decryptObject(res.data.encrypted_data) : res.data?.data ?? res.data

      // Update local list immediately
      setSupplies((prev) => prev.map((s) => (s.supply_id === selectedSupply.supply_id ? { ...s, ...updated } : s)))

      setEditOpen(false)
    } catch (err: any) {
      console.error("Update supply failed:", err?.response?.data || err)
      setError(err?.response?.data?.message || "Failed to update supply")
    } finally {
      setLoading(false)
    }
  }

  // Filtered supplies client-side UI
  const safeSupplies = Array.isArray(supplies) ? supplies : []

  // Build unique, non-empty option lists with stable keys
  const typeOptions = Array.from(
    new Set([
      ...categories.map((c: any) => c?.category_name).filter(Boolean),
      ...safeSupplies.map((s: any) => s?.category_name || s?.item_type).filter(Boolean),
    ])
  )
  // REMOVED: locationOptions

  const filteredSupplies = safeSupplies.filter((supply) => {
    const matchesSearch =
      (supply.item_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supply.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "All Types" || (supply.category_name || supply.item_type) === filterType
    const current = Number(supply.current_stock_level ?? supply.current_stock ?? 0)
    const min = Number(supply.reorder_level ?? supply.min_stock_level ?? 0)
    const matchesStock =
      filterStock === "All Stocks" ||
      (filterStock === "In Stock" && current > min) ||
      (filterStock === "Low Stock" && current <= min && current > 0) ||
      (filterStock === "Out of Stock" && current <= 0)
    const matchesStatus =
      filterStatus === "All Status" ||
      (String(supply.status || "").toLowerCase() === String(filterStatus).toLowerCase())
    return matchesSearch && matchesType && matchesStock && matchesStatus // removed matchesLocation
  })

  const lowStockItems = safeSupplies.filter(
    (supply) =>
      Number(supply.current_stock_level ?? supply.current_stock ?? 0) <=
      Number(supply.reorder_level ?? supply.min_stock_level ?? 0)
  )

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Supply-Inventory-Report",
    onAfterPrint: () => setIsPrinting(false),
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        </div>
      </div>

      <Tabs defaultValue="supplies" className="space-y-6">
        <TabsContent value="supplies" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search Supplies</CardTitle>
              <CardDescription>Find supplies by name, type, or location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by item name"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Types">All Types</SelectItem>
                    {typeOptions.map((t, i) => (
                      <SelectItem key={`${t}-${i}`} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStock} onValueChange={setFilterStock}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Stocks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Stocks">All Stocks</SelectItem>
                    <SelectItem value="In Stock">In Stock</SelectItem>
                    <SelectItem value="Low Stock">Low Stock</SelectItem>
                    <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Supply List */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between w-full">
                <div>
                  <CardTitle>Supply Inventory ({filteredSupplies.length})</CardTitle>
                  <CardDescription>Current stock levels and supply information</CardDescription>
                </div>
                <div className="flex items-center space-x-2">

                  {/* Add Supply dialog (trigger + content) */}
                  <Dialog open={showAddSupply} onOpenChange={setShowAddSupply}>
                    <DialogTrigger asChild>
                      <Button className="whitespace-nowrap">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent size="2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Supply Item</DialogTitle>
                        <DialogDescription>Add a new item to the inventory system</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddSupply} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item_name">Item Name *</Label>
                            <Input
                              id="item_name"
                              value={newSupply.item_name}
                              onChange={(e) => setNewSupply((prev) => ({ ...prev, item_name: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="category_id">Category</Label>
                            <Select
                              value={String(newSupply.category_id)}
                              onValueChange={(value) => setNewSupply((prev) => ({ ...prev, category_id: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">(No category)</SelectItem> {/* changed value */}
                                {categories.map((c) => (
                                  <SelectItem key={c.category_id} value={String(c.category_id)}>
                                    {c.category_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            className="resize-none"
                            value={newSupply.description}
                            onChange={(e) => setNewSupply((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Detailed description of the supply item..."
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="current_stock">Current Stock *</Label>
                            <Input
                              id="current_stock"
                              type="number"
                              value={newSupply.current_stock}
                              onChange={(e) => setNewSupply((prev) => ({ ...prev, current_stock: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="min_stock_level">Min Stock Level *</Label>
                            <Input
                              id="min_stock_level"
                              type="number"
                              value={newSupply.min_stock_level}
                              onChange={(e) => setNewSupply((prev) => ({ ...prev, min_stock_level: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="unit_of_measure">Unit of Measure *</Label>
                            <Input
                              id="unit_of_measure"
                              value={newSupply.unit_of_measure}
                              onChange={(e) => setNewSupply((prev) => ({ ...prev, unit_of_measure: e.target.value }))}
                              placeholder="e.g., pieces, boxes, ml"
                              required
                            />
                          </div>
                        </div>

                        {error && <div className="text-red-500">{error}</div>}

                        <div className="flex justify-end space-x-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setShowAddSupply(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={loading}>
                            {loading ? "Adding..." : "Add Supply"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Dialog>
                                        <DialogTrigger asChild>

        <Button
          onClick={() => {
            setIsPrinting(true)
            handlePrint()
          }}
          disabled={isPrinting || supplies.length === 0}
          variant="secondary"
          className="print-hide bg-primary"
        >
          {isPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
          {isPrinting ? "Preparing..." : "Supply Report"}
        </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Restock</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSupplies.map((supply) => (
                    <TableRow key={supply.supply_id}>
                      <TableCell className="font-mono text-xs">{supply.item_code}</TableCell>
                      <TableCell className="font-medium">{supply.item_name}</TableCell>
                      <TableCell><Badge variant="outline">{supply.category_name || supply.item_type}</Badge></TableCell>
                      <TableCell className="font-medium">{supply.current_stock_level ?? supply.current_stock}</TableCell>
                      <TableCell>{supply.reorder_level ?? supply.min_stock_level}</TableCell>
                      <TableCell>{supply.unit_of_measure}</TableCell>
                      <TableCell>
                        {Number(supply.current_stock_level ?? supply.current_stock ?? 0) <= Number(supply.reorder_level ?? supply.min_stock_level ?? 0)
                          ? <Badge variant="destructive" className="flex items-center space-x-1"><AlertTriangle className="h-3 w-3 mr-1" />Low Stock</Badge>
                          : <Badge variant="secondary">In Stock</Badge>}
                      </TableCell>
                      <TableCell>
                        <Dialog
                          open={restockOpen && restockSupplyId === supply.supply_id}
                          onOpenChange={(o) => {
                            if (!o) {
                              setRestockOpen(false)
                              setRestockSupplyId(null)
                              setRestockQty("")
                              setRestockNotes("")
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRestockOpen(true)
                                setRestockSupplyId(supply.supply_id)
                              }}
                            >
                              Restock
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Restock: {supply.item_name}</DialogTitle>
                              <DialogDescription>Increase stock level for this item</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={(e) => handleRestockSubmit(e, supply.supply_id)} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="restockQty">Quantity *</Label>
                                <Input
                                  id="restockQty"
                                  type="number"
                                  min={1}
                                  value={restockQty}
                                  onChange={(e) => setRestockQty(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="restockNotes">Notes</Label>
                                <Textarea
                                  id="restockNotes"
                                  value={restockNotes}
                                  onChange={(e) => setRestockNotes(e.target.value)}
                                  placeholder="Optional notes (e.g. supplier, batch)"
                                />
                              </div>
                              {error && <div className="text-red-500 text-sm">{error}</div>}
                              <div className="flex justify-end space-x-2 pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setRestockOpen(false)
                                    setRestockSupplyId(null)
                                    setRestockQty("")
                                    setRestockNotes("")
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={!restockQty || loading}>
                                  {loading ? "Saving..." : "Add Stock"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(supply)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Dialog
                            open={usageOpen && usageSupply?.supply_id === supply.supply_id}
                            onOpenChange={(o) => {
                              if (!o) {
                                setUsageOpen(false)
                                setUsageSupply(null)
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setUsageOpen(true)
                                  setUsageSupply(supply)
                                }}
                              >
                                Use
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Record Usage - {supply.item_name}</DialogTitle>
                                <DialogDescription>Track supply consumption with patient & phase context</DialogDescription>
                              </DialogHeader>
                              <form onSubmit={submitUsage} className="space-y-4">
                                <div>
                                  <Label>Quantity Used *</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={usageQty}
                                    onChange={(e) => setUsageQty(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Patient ID</Label>
                                    <Input
                                      value={usagePatientId}
                                      onChange={(e) => setUsagePatientId(e.target.value)}
                                      placeholder="Optional"
                                    />
                                  </div>
                                  <div>
                                    <Label>Phase (1-3)</Label>
                                    <Input
                                      value={usagePhaseId}
                                      onChange={(e) => setUsagePhaseId(e.target.value)}
                                      placeholder="Optional"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label>Event Type</Label>
                                  <Input
                                    value={usageEvent}
                                    onChange={(e) => setUsageEvent(e.target.value)}
                                    placeholder="e.g. Ear Impression, Fitting"
                                  />
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setUsageOpen(false)
                                      setUsageSupply(null)
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button type="submit" disabled={!usageQty}>
                                    Save
                                  </Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Supply movement history and transaction records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Related Event</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Phase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction, i) => (
                    <TableRow
                      key={
                        transaction.transaction_id ??
                        `${transaction.supply_id}-${transaction.transaction_date}-${i}`
                      }
                    >
                      <TableCell>{new Date(transaction.transaction_date).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{transaction.item_name || transaction.item_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (transaction.type_name || transaction.transaction_type || "").toLowerCase().includes("received")
                              ? "default"
                              : (transaction.type_name || transaction.transaction_type || "").toLowerCase().includes("used")
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {transaction.type_name || transaction.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={transaction.quantity > 0 ? "text-green-600" : "text-red-600"}>
                        {transaction.quantity > 0 ? "+" : ""}
                        {transaction.quantity}
                      </TableCell>
                      <TableCell>{transaction.username || transaction.performed_by}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.related_event_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{transaction.notes || transaction.comments}</TableCell>
                      <TableCell>{transaction.patient_id || "-"}</TableCell>
                      <TableCell>{transaction.phase_id || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden print content */}
      <div style={{ display: "none" }}>
        {supplies.length > 0 && (
          <SupplyPrintReport
            ref={printRef}
            supplies={supplies}
            meta={{
              generatedAt: new Date().toLocaleString(),
              filters: { searchTerm, filterType, filterStock },
              total: supplies.length,
              low: lowStockItems.length,
            }}
          />
        )}
      </div>

      {/* Edit Supply dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supply</DialogTitle>
            <DialogDescription>Update name, type, reorder level, and unit</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSupply} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_item_name">Name *</Label>
              <Input
                id="edit_item_name"
                value={editData.item_name}
                onChange={(e) => setEditData((p) => ({ ...p, item_name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_category">Category</Label>
              <Select
                value={String(editData.category_id)}
                onValueChange={(value) => setEditData((p) => ({ ...p, category_id: value }))}
              >
                <SelectTrigger id="edit_category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(No category)</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.category_id} value={String(c.category_id)}>
                      {c.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_reorder_level">Reorder Level *</Label>
                <Input
                  id="edit_reorder_level"
                  type="number"
                  value={editData.reorder_level}
                  onChange={(e) => setEditData((p) => ({ ...p, reorder_level: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_unit">Unit of Measure *</Label>
                <Input
                  id="edit_unit"
                  value={editData.unit_of_measure}
                  onChange={(e) => setEditData((p) => ({ ...p, unit_of_measure: e.target.value }))}
                  required
                />
              </div>
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Printable report component (similar style to dashboard) ---
interface SupplyPrintMeta {
  generatedAt: string
  filters: { searchTerm: string; filterType: string; filterStock: string }
  total: number
  low: number
}
interface SupplyPrintProps {
  supplies: any[]
  meta: SupplyPrintMeta
}
const SupplyPrintReport = React.forwardRef<HTMLDivElement, SupplyPrintProps>(({ supplies, meta }, ref) => {
  const lowItems = supplies.filter(
    (s) =>
      Number(s.current_stock_level ?? s.current_stock ?? 0) <=
      Number(s.reorder_level ?? s.min_stock_level ?? 0)
  )

  return (
    <div ref={ref} style={{ padding: "18mm", fontFamily: "Arial, sans-serif", fontSize: "11pt", lineHeight: 1.4 }}>
      <style>{`
        .spr-h1{font-size:22pt;color:#3a416f;border-bottom:2px solid #3a416f;margin:0 0 16px;padding-bottom:4px;}
        .spr-h2{font-size:15pt;color:#f95759;margin:24px 0 10px;border-bottom:1px solid #c9cbcb;padding-bottom:2px;page-break-after:avoid;}
        .spr-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10pt;}
        .spr-table th,.spr-table td{border:1px solid #ddd;padding:6px;text-align:left;}
        .spr-table th{background:#f2f2f2;}
        .spr-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:12px 0 20px;}
        .spr-kpi{border:1px solid #c9cbcb;border-radius:6px;padding:10px;text-align:center;}
        .spr-kpi-title{font-size:9pt;text-transform:uppercase;color:#555;margin-bottom:4px;}
        .spr-kpi-val{font-size:20pt;font-weight:bold;color:#3a416f;}
        @page { margin: 15mm; }
      `}</style>

      <h1 className="spr-h1">Supply Inventory Report</h1>
      <p style={{ marginBottom: "10px" }}>
        <strong>Generated:</strong> {meta.generatedAt}
        <br />
        <strong>Filters:</strong>{" "}
        {[
          meta.filters.searchTerm ? `Search="${meta.filters.searchTerm}"` : null,
          meta.filters.filterType !== "All Types" ? `Type="${meta.filters.filterType}"` : null,
          meta.filters.filterStock !== "All Stocks" ? `Stock="${meta.filters.filterStock}"` : null,
        ]
          .filter(Boolean)
          .join("; ") || "None"}
      </p>

      <div className="spr-grid">
        <div className="spr-kpi">
          <div className="spr-kpi-title">Total Items</div>
            <div className="spr-kpi-val">{meta.total}</div>
        </div>
        <div className="spr-kpi">
          <div className="spr-kpi-title">Low Stock Items</div>
          <div className="spr-kpi-val" style={{ color: "#f95759" }}>{meta.low}</div>
        </div>
        <div className="spr-kpi">
          <div className="spr-kpi-title">In Stock</div>
          <div className="spr-kpi-val" style={{ color: "#0d6efd" }}>
            {supplies.filter(
              (s) =>
                Number(s.current_stock_level ?? s.current_stock ?? 0) >
                Number(s.reorder_level ?? s.min_stock_level ?? 0)
            ).length}
          </div>
        </div>
      </div>

      <h2 className="spr-h2">Inventory Details</h2>
      <table className="spr-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Type / Category</th>
            <th>Current</th>
            <th>Min</th>
            <th>Unit</th>
            <th>Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {supplies.map((s, i) => {
            const current = Number(s.current_stock_level ?? s.current_stock ?? 0)
            const min = Number(s.reorder_level ?? s.min_stock_level ?? 0)
            const status = current <= 0 ? "OUT" : current <= min ? "LOW" : "OK"
            return (
              <tr key={i}>
                <td>{s.item_code || "-"}</td>
                <td>{s.item_name}</td>
                <td>{s.category_name || s.item_type || "-"}</td>
                <td>{current}</td>
                <td>{min}</td>
                <td>{s.unit_of_measure || "-"}</td>
                <td style={{ color: status === "LOW" ? "#d9534f" : status === "OUT" ? "#b02d2d" : "#198754" }}>
                  {status}
                </td>
                <td>{(s.description || "").slice(0, 80)}</td>
              </tr>
            )
          })}
          {supplies.length === 0 && (
            <tr>
              <td colSpan={8}>No supplies found for current filters.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="spr-h2">Low Stock Items</h2>
      <table className="spr-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Current</th>
            <th>Min</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {lowItems.map((s, i) => {
            const current = Number(s.current_stock_level ?? s.current_stock ?? 0)
            const min = Number(s.reorder_level ?? s.min_stock_level ?? 0)
            return (
              <tr key={i}>
                <td>{s.item_name}</td>
                <td style={{ color: "#d9534f", fontWeight: 600 }}>{current}</td>
                <td>{min}</td>
                <td>{s.unit_of_measure || "-"}</td>
              </tr>
            )
          })}
          {lowItems.length === 0 && (
            <tr>
              <td colSpan={4}>No items are currently at or below minimum level.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
})
SupplyPrintReport.displayName = "SupplyPrintReport"
