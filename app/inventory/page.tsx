"use client"

import type React from "react"
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
import { Search, Plus, Edit, AlertTriangle, Package, TrendingUp, TrendingDown, FileText } from "lucide-react"
import { decryptObject } from "@/utils/decrypt" // <-- decrypt helper

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
  const [filterLocation, setFilterLocation] = useState("All Status")
  const [filterStatus, setFilterStatus] = useState("All Status")

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
    item_type: "",
    description: "",
    current_stock: "",
    min_stock_level: "",
    unit_of_measure: "",
    location: "",
    category_id: "",
  })

  const [newTransaction, setNewTransaction] = useState({
    supply_id: "",
    transaction_type: "",
    quantity_change: "",
    related_event_type: "",
    comments: "",
  })

  // Fetch supplies + meta
  const fetchSupplies = async () => {
    setLoading(true)
    try {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const res = await api.get("/api/supplies", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: { limit: 1000 }, // get enough rows for client-side filtering
      })

      let payload: any = null
      if (res.data?.encrypted_data) {
        payload = decryptObject(res.data.encrypted_data)
      } else {
        payload = res.data?.data ?? res.data
      }

      // backend returns array of supplies
      setSupplies(Array.isArray(payload) ? payload : payload || [])
    } catch (err) {
      console.error("fetchSupplies error:", err)
      setError("Failed to load supplies")
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
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token") || localStorage.getItem("token") : null
      const payload: any = {
        item_name: newSupply.item_name,
        category_id: newSupply.category_id || undefined,
        description: newSupply.description || undefined,
        current_stock_level: newSupply.current_stock ? Number(newSupply.current_stock) : 0,
        reorder_level: newSupply.min_stock_level ? Number(newSupply.min_stock_level) : 0,
        unit_of_measure: newSupply.unit_of_measure || undefined,
        location: newSupply.location || undefined,
      }
      // remove undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])

      const res = await api.post("/api/supplies", payload, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const returned = res.data?.encrypted_data ? decryptObject(res.data.encrypted_data) : res.data?.data ?? res.data
      // Add returned supply
      setSupplies((prev) => [returned, ...prev])
      setShowAddSupply(false)
      setNewSupply({
        item_name: "",
        item_type: "",
        description: "",
        current_stock: "",
        min_stock_level: "",
        unit_of_measure: "",
        location: "",
        category_id: "",
      })
    } catch (err: any) {
      console.error("Add supply failed:", err)
      setError(err?.response?.data?.message || "Failed to add supply")
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

  // Filtered supplies client-side UI
  const filteredSupplies = supplies.filter((supply) => {
    const matchesSearch =
      (supply.item_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supply.description || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === "All Types" || (supply.category_name || supply.item_type) === filterType
    const matchesLocation = filterLocation === "All Status" || (supply.location || "") === filterLocation

    // stock/status filtering
    const current = Number(supply.current_stock_level ?? supply.current_stock ?? 0)
    const min = Number(supply.reorder_level ?? supply.min_stock_level ?? 0)

    const matchesStock =
      filterStock === "All Stocks" ||
      (filterStock === "In Stock" && current > min) ||
      (filterStock === "Low Stock" && current <= min && current > 0) ||
      (filterStock === "Out of Stock" && current <= 0)

    const matchesStatus = filterStatus === "All Status" || (String(supply.status || "").toLowerCase() === String(filterStatus).toLowerCase())

    return matchesSearch && matchesType && matchesLocation && matchesStock && matchesStatus
  })

  const lowStockItems = supplies.filter((supply) => Number(supply.current_stock_level ?? supply.current_stock ?? 0) <= Number(supply.reorder_level ?? supply.min_stock_level ?? 0))

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
                    {/* Populate from categories */}
                    {Array.from(new Set([...categories.map((c) => c.category_name), ...supplies.map((s) => s.item_type || s.category_name)])).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Status">All Status</SelectItem>
                    {Array.from(new Set(supplies.map((s) => s.location))).map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
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
                    <DialogContent className="max-w-2xl">
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
                                <SelectItem value="">(No category)</SelectItem>
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

                        <div className="space-y-2">
                          <Label htmlFor="location">Storage Location</Label>
                          <Input
                            id="location"
                            value={newSupply.location}
                            onChange={(e) => setNewSupply((prev) => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g., Main Warehouse, Cebu Storage"
                          />
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
                      <Button className="whitespace-nowrap">
                        <FileText className="h-4 w-4 mr-2" />
                        Supply Report
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
                      <TableCell className="font-medium">{supply.item_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{supply.category_name || supply.item_type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{supply.current_stock_level ?? supply.current_stock}</TableCell>
                      <TableCell>{supply.reorder_level ?? supply.min_stock_level}</TableCell>
                      <TableCell>{supply.unit_of_measure}</TableCell>
                      <TableCell>
                        {Number(supply.current_stock_level ?? supply.current_stock ?? 0) <= Number(supply.reorder_level ?? supply.min_stock_level ?? 0) ? (
                          <Badge variant="destructive" className="flex items-center space-x-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            <span>Low Stock</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Stock</Badge>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Dialog open={restockOpen && restockSupplyId === supply.supply_id} onOpenChange={(open) => {
                          if (!open) {
                            setRestockOpen(false)
                            setRestockSupplyId(null)
                            setRestockQty("")
                            setRestockNotes("")
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => { setRestockOpen(true); setRestockSupplyId(supply.supply_id); }}>
                              Restock
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Restock {supply.item_name}</DialogTitle>
                              <DialogDescription>Enter quantity to add to stock</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={(e) => handleRestockSubmit(e, supply.supply_id)} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`restock_qty_${supply.supply_id}`}>Quantity *</Label>
                                <Input
                                  id={`restock_qty_${supply.supply_id}`}
                                  type="number"
                                  min={1}
                                  value={restockQty}
                                  onChange={(e) => setRestockQty(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`restock_notes_${supply.supply_id}`}>Notes</Label>
                                <Textarea
                                  id={`restock_notes_${supply.supply_id}`}
                                  value={restockNotes}
                                  onChange={(e) => setRestockNotes(e.target.value)}
                                  placeholder="Optional notes..."
                                />
                              </div>
                              {error && <div className="text-red-500">{error}</div>}
                              <div className="flex justify-end space-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => { setRestockOpen(false); setRestockSupplyId(null); }}>
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                  {loading ? "Processing..." : "Confirm Restock"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedSupply(supply); loadSupplyTransactions(supply.supply_id); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.transaction_id}>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
