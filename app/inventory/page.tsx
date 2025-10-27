"use client"

import type React from "react"
import { useState } from "react"
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
import { Search, Plus, Edit, AlertTriangle, Package, TrendingUp, TrendingDown } from "lucide-react"

// Mock supply data based on database schema
const mockSupplies = [
  {
    supply_id: 1,
    item_name: "Hearing Aid Model BTE-13",
    item_type: "Hearing Aid",
    description: "Behind-the-ear hearing aid with size 13 battery",
    current_stock: 45,
    min_stock_level: 20,
    unit_of_measure: "pieces",
    location: "Main Warehouse",
  },
  {
    supply_id: 2,
    item_name: "Battery Size 13",
    item_type: "Battery",
    description: "Zinc-air hearing aid batteries, size 13",
    current_stock: 8,
    min_stock_level: 50,
    unit_of_measure: "packs",
    location: "Main Warehouse",
  },
  {
    supply_id: 3,
    item_name: "Battery Size 675",
    item_type: "Battery",
    description: "Zinc-air hearing aid batteries, size 675",
    current_stock: 120,
    min_stock_level: 30,
    unit_of_measure: "packs",
    location: "Main Warehouse",
  },
  {
    supply_id: 4,
    item_name: "Otoform Putty",
    item_type: "Earmold Material",
    description: "Silicone impression material for earmolds",
    current_stock: 15,
    min_stock_level: 10,
    unit_of_measure: "tubes",
    location: "Cebu Storage",
  },
  {
    supply_id: 5,
    item_name: "Antiseptic Solution",
    item_type: "Medication",
    description: "Ear cleaning antiseptic solution",
    current_stock: 25,
    min_stock_level: 15,
    unit_of_measure: "bottles",
    location: "Main Warehouse",
  },
]

const mockTransactions = [
  {
    transaction_id: 1,
    supply_id: 2,
    item_name: "Battery Size 13",
    transaction_type: "Outflow",
    quantity_change: -10,
    transaction_date: "2024-01-15",
    performed_by: "Maria Santos",
    related_event_type: "Fitting",
    comments: "Used for hearing aid fittings",
  },
  {
    transaction_id: 2,
    supply_id: 1,
    item_name: "Hearing Aid Model BTE-13",
    transaction_type: "Inflow",
    quantity_change: 25,
    transaction_date: "2024-01-14",
    performed_by: "Juan Cruz",
    related_event_type: "Procurement",
    comments: "New shipment received",
  },
  {
    transaction_id: 3,
    supply_id: 3,
    item_name: "Battery Size 675",
    transaction_type: "Outflow",
    quantity_change: -5,
    transaction_date: "2024-01-13",
    performed_by: "Ana Garcia",
    related_event_type: "AfterCare",
    comments: "Provided to patients during aftercare",
  },
]

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("All Types")
  const [filterLocation, setFilterLocation] = useState("All Locations")
  const [showAddSupply, setShowAddSupply] = useState(false)
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [selectedSupply, setSelectedSupply] = useState<any>(null)
  const [newSupply, setNewSupply] = useState({
    item_name: "",
    item_type: "",
    description: "",
    current_stock: "",
    min_stock_level: "",
    unit_of_measure: "",
    location: "",
  })
  const [newTransaction, setNewTransaction] = useState({
    supply_id: "",
    transaction_type: "",
    quantity_change: "",
    related_event_type: "",
    comments: "",
  })

  const filteredSupplies = mockSupplies.filter((supply) => {
    const matchesSearch =
      supply.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supply.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === "All Types" || supply.item_type === filterType
    const matchesLocation = filterLocation === "All Locations" || supply.location === filterLocation

    return matchesSearch && matchesType && matchesLocation
  })

  const lowStockItems = mockSupplies.filter((supply) => supply.current_stock <= supply.min_stock_level)

  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Adding supply:", newSupply)
    setShowAddSupply(false)
    setNewSupply({
      item_name: "",
      item_type: "",
      description: "",
      current_stock: "",
      min_stock_level: "",
      unit_of_measure: "",
      location: "",
    })
  }

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Adding transaction:", newTransaction)
    setShowAddTransaction(false)
    setNewTransaction({
      supply_id: "",
      transaction_type: "",
      quantity_change: "",
      related_event_type: "",
      comments: "",
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Manage medical supplies and track inventory levels</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Supply Transaction</DialogTitle>
                <DialogDescription>Record inflow, outflow, or adjustment of supplies</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supply_id">Supply Item *</Label>
                  <Select
                    value={newTransaction.supply_id}
                    onValueChange={(value) => setNewTransaction((prev) => ({ ...prev, supply_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supply item" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockSupplies.map((supply) => (
                        <SelectItem key={supply.supply_id} value={supply.supply_id.toString()}>
                          {supply.item_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transaction_type">Transaction Type *</Label>
                    <Select
                      value={newTransaction.transaction_type}
                      onValueChange={(value) => setNewTransaction((prev) => ({ ...prev, transaction_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inflow">Inflow</SelectItem>
                        <SelectItem value="Outflow">Outflow</SelectItem>
                        <SelectItem value="Adjustment">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity_change">Quantity Change *</Label>
                    <Input
                      id="quantity_change"
                      type="number"
                      value={newTransaction.quantity_change}
                      onChange={(e) => setNewTransaction((prev) => ({ ...prev, quantity_change: e.target.value }))}
                      placeholder="Enter quantity (+ for inflow, - for outflow)"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="related_event_type">Related Event Type</Label>
                  <Select
                    value={newTransaction.related_event_type}
                    onValueChange={(value) => setNewTransaction((prev) => ({ ...prev, related_event_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fitting">Fitting</SelectItem>
                      <SelectItem value="AfterCare">AfterCare</SelectItem>
                      <SelectItem value="Procurement">Procurement</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    value={newTransaction.comments}
                    onChange={(e) => setNewTransaction((prev) => ({ ...prev, comments: e.target.value }))}
                    placeholder="Additional notes about this transaction..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddTransaction(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Record Transaction</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddSupply} onOpenChange={setShowAddSupply}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Supply
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
                    <Label htmlFor="item_type">Item Type *</Label>
                    <Select
                      value={newSupply.item_type}
                      onValueChange={(value) => setNewSupply((prev) => ({ ...prev, item_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hearing Aid">Hearing Aid</SelectItem>
                        <SelectItem value="Battery">Battery</SelectItem>
                        <SelectItem value="Earmold Material">Earmold Material</SelectItem>
                        <SelectItem value="Medication">Medication</SelectItem>
                        <SelectItem value="Other Medical Supply">Other Medical Supply</SelectItem>
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddSupply(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Supply</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="supplies" className="space-y-6">
        <TabsList>
          <TabsTrigger value="supplies">Supply Inventory</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="alerts">Low Stock Alerts</TabsTrigger>
        </TabsList>

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
                      placeholder="Search by item name or description..."
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
                    <SelectItem value="Hearing Aid">Hearing Aid</SelectItem>
                    <SelectItem value="Battery">Battery</SelectItem>
                    <SelectItem value="Earmold Material">Earmold Material</SelectItem>
                    <SelectItem value="Medication">Medication</SelectItem>
                    <SelectItem value="Other Medical Supply">Other Medical Supply</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Locations">All Locations</SelectItem>
                    <SelectItem value="Main Warehouse">Main Warehouse</SelectItem>
                    <SelectItem value="Cebu Storage">Cebu Storage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Supply List */}
          <Card>
            <CardHeader>
              <CardTitle>Supply Inventory ({filteredSupplies.length})</CardTitle>
              <CardDescription>Current stock levels and supply information</CardDescription>
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
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSupplies.map((supply) => (
                    <TableRow key={supply.supply_id}>
                      <TableCell className="font-medium">{supply.item_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{supply.item_type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{supply.current_stock}</TableCell>
                      <TableCell>{supply.min_stock_level}</TableCell>
                      <TableCell>{supply.unit_of_measure}</TableCell>
                      <TableCell>{supply.location}</TableCell>
                      <TableCell>
                        {supply.current_stock <= supply.min_stock_level ? (
                          <Badge variant="destructive" className="flex items-center space-x-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Low Stock</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSupply(supply)}>
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
                  {mockTransactions.map((transaction) => (
                    <TableRow key={transaction.transaction_id}>
                      <TableCell>{transaction.transaction_date}</TableCell>
                      <TableCell className="font-medium">{transaction.item_name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.transaction_type === "Inflow"
                              ? "default"
                              : transaction.transaction_type === "Outflow"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {transaction.transaction_type === "Inflow" && <TrendingUp className="h-3 w-3 mr-1" />}
                          {transaction.transaction_type === "Outflow" && <TrendingDown className="h-3 w-3 mr-1" />}
                          {transaction.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={transaction.quantity_change > 0 ? "text-green-600" : "text-red-600"}>
                        {transaction.quantity_change > 0 ? "+" : ""}
                        {transaction.quantity_change}
                      </TableCell>
                      <TableCell>{transaction.performed_by}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.related_event_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{transaction.comments}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <span>Low Stock Alerts ({lowStockItems.length})</span>
              </CardTitle>
              <CardDescription>Items that have reached or fallen below minimum stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No low stock alerts at this time</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lowStockItems.map((supply) => (
                    <div
                      key={supply.supply_id}
                      className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5"
                    >
                      <div className="flex items-center space-x-4">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div>
                          <h4 className="font-medium">{supply.item_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Current: {supply.current_stock} {supply.unit_of_measure} | Minimum: {supply.min_stock_level}{" "}
                            {supply.unit_of_measure}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive">
                          {supply.current_stock <= supply.min_stock_level ? "Critical" : "Low"}
                        </Badge>
                        <Button size="sm" onClick={() => setShowAddTransaction(true)}>
                          Restock
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
