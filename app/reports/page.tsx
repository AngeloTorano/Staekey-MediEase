"use client"

import { useState } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Download, FileText, BarChart3, Upload } from "lucide-react"
import { useDropzone } from "react-dropzone"

// Axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [openGenerateModal, setOpenGenerateModal] = useState(false)
  const [openCustomModal, setOpenCustomModal] = useState(false)

  const [selectedPhase, setSelectedPhase] = useState<string>("")
  const [selectedFileType, setSelectedFileType] = useState("csv")

  // Custom report filters
  const [filterGender, setFilterGender] = useState("all")
  const [filterCity, setFilterCity] = useState("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  const handleExportReport = (phase: string, format: string) => {
    console.log(`Generating ${format.toUpperCase()} report for ${phase}`)
  }

  const openGenerateReportModal = (phase: string) => {
    setSelectedPhase(phase)
    setOpenGenerateModal(true)
  }

  const openCustomReportModal = (phase: string) => {
    setSelectedPhase(phase)
    setOpenCustomModal(true)
  }

  const handleConfirmGenerate = () => {
    handleExportReport(selectedPhase, selectedFileType)
    setOpenGenerateModal(false)
  }

  const handleConfirmCustom = () => {
    console.log(
      `Generating CUSTOM ${selectedFileType.toUpperCase()} report for ${selectedPhase}
      Filters: Gender=${filterGender}, City=${filterCity}, Date Range=${customStartDate} to ${customEndDate}`
    )
    setOpenCustomModal(false)
  }

  // File upload logic
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0])
      console.log("File uploaded:", acceptedFiles[0])
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
  })

  const handleImportFile = () => {
    if (!uploadedFile) {
      alert("Please upload a file first!")
      return
    }
    console.log("Importing file:", uploadedFile.name)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Reports
            </h1>
          </div>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Phase Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["Phase 1", "Phase 2", "Phase 3"].map((phase) => (
          <Card
            key={phase}
            className="hover:shadow-lg transition-shadow cursor-pointer"
          >
            <CardHeader>
              <CardTitle>{phase}</CardTitle>
              <CardDescription>
                Generate or customize reports for {phase.toLowerCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => openGenerateReportModal(phase)}
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openCustomReportModal(phase)}
                disabled={loading}
              >
                <FileText className="h-4 w-4 mr-2" />
                Custom Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File Upload Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Import File</CardTitle>
          <CardDescription>
            Drag and drop your file below or click to upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition 
              ${isDragActive ? "border-primary bg-muted" : "border-gray-300"}`}
          >
            <input {...getInputProps()} />
            {uploadedFile ? (
              <p className="text-sm text-gray-700">
                Uploaded: <strong>{uploadedFile.name}</strong>
              </p>
            ) : isDragActive ? (
              <p className="text-gray-700">Drop your file here...</p>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="h-8 w-8 text-gray-500" />
                <p className="text-gray-600 text-sm">
                  Drag & drop or click to upload (CSV or PDF)
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleImportFile} disabled={!uploadedFile}>
              Import File
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generate Report Modal */}
      <Dialog open={openGenerateModal} onOpenChange={setOpenGenerateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Report - {selectedPhase}</DialogTitle>
            <DialogDescription>
              Choose the file type for your report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>File Type</Label>
            <Select value={selectedFileType} onValueChange={setSelectedFileType}>
              <SelectTrigger>
                <SelectValue placeholder="Select file type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Report Modal */}
      <Dialog open={openCustomModal} onOpenChange={setOpenCustomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Report - {selectedPhase}</DialogTitle>
            <DialogDescription>
              Set filters and file type for your report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Gender Filter */}
            <div className="space-y-2">
              <Label>Filter by Gender</Label>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aftercare City Filter */}
            <div className="space-y-2">
              <Label>Filter by Aftercare City</Label>
              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="manila">Manila</SelectItem>
                  <SelectItem value="cebu">Cebu</SelectItem>
                  <SelectItem value="davao">Davao</SelectItem>
                  <SelectItem value="lipa">Lipa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specific Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* File Type */}
            <div className="space-y-2">
              <Label>File Type</Label>
              <Select
                value={selectedFileType}
                onValueChange={setSelectedFileType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select file type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCustomModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCustom}>Generate Custom Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
