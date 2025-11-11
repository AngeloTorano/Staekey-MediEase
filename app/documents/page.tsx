"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, FileText, Upload, Plus, Trash2, User } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Document {
    document_id: number
    title: string
    description: string
    version: number
    file_name: string
    original_name: string
    file_size: number
    file_type: string
    created_at: string
    uploaded_by: number
    uploaded_by_first_name: string
    uploaded_by_last_name: string
    uploaded_by_email: string
}

interface UserRole {
    role: string
}

export default function MissionDocumentsPage() {
    const [documents, setDocuments] = useState<Document[]>([])
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(true)
    const [userRole, setUserRole] = useState<UserRole>({ role: "" })
    const { toast } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        version: "",
        document: null as File | null
    })

    // Add this line - point to your backend server on port 9000
    const API_BASE_URL = "http://localhost:9000"

    useEffect(() => {
        const role = sessionStorage.getItem("userRole") || "City Coordinator"
        setUserRole({ role })
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token")
            // Update the URL to use the backend server
            const response = await fetch(`${API_BASE_URL}/api/documents`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })

            if (response.ok) {
                const result = await response.json()
                setDocuments(result.data)
            } else {
                throw new Error("Failed to fetch documents")
            }
        } catch (error) {
            console.error("Error fetching documents:", error)
            toast({
                title: "Error",
                description: "Failed to load documents",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({
                ...prev,
                document: e.target.files![0]
            }))
        }
    }

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title || !formData.description || !formData.version || !formData.document) {
            toast({
                title: "Error",
                description: "Please fill all fields and select a file",
                variant: "destructive"
            })
            return
        }

        // Validate version is a number
        const versionNum = parseInt(formData.version)
        if (isNaN(versionNum)) {
            toast({
                title: "Error",
                description: "Version must be a number",
                variant: "destructive"
            })
            return
        }

        setUploading(true)

        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token")
            const uploadData = new FormData()
            uploadData.append("title", formData.title)
            uploadData.append("description", formData.description)
            uploadData.append("version", formData.version)
            uploadData.append("document", formData.document!)

            // Update the URL to use the backend server
            const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: uploadData
            })

            const result = await response.json()

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Document uploaded successfully"
                })
                setFormData({ title: "", description: "", version: "", document: null })
                setShowUploadForm(false)
                fetchDocuments()
            } else {
                throw new Error(result.message)
            }
        } catch (error) {
            console.error("Error uploading document:", error)
            toast({
                title: "Error",
                description: "Failed to upload document",
                variant: "destructive"
            })
        } finally {
            setUploading(false)
        }
    }

    const handleDownload = async (documentId: number, originalName: string) => {
        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token")
            // Update the URL to use the backend server
            const response = await fetch(`${API_BASE_URL}/api/documents/download/${documentId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })

            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = originalName
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)
            } else {
                throw new Error("Download failed")
            }
        } catch (error) {
            console.error("Error downloading document:", error)
            toast({
                title: "Error",
                description: "Failed to download document",
                variant: "destructive"
            })
        }
    }

    const handleDelete = async (documentId: number) => {
        if (!confirm("Are you sure you want to delete this document?")) {
            return
        }

        try {
            const token = sessionStorage.getItem("token") || localStorage.getItem("token")
            // Update the URL to use the backend server
            const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })

            const result = await response.json()

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Document deleted successfully"
                })
                fetchDocuments()
            } else {
                throw new Error(result.message)
            }
        } catch (error) {
            console.error("Error deleting document:", error)
            toast({
                title: "Error",
                description: "Failed to delete document",
                variant: "destructive"
            })
        }
    }

    const handleContainerClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleCancel = () => {
        setFormData({ title: "", description: "", version: "", document: null })
        setShowUploadForm(false)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const canUpload = userRole.role === "Admin"
    const canDelete = userRole.role === "Admin"

    if (loading) {
        return (
            <div className="container mx-auto py-6">
                <div className="flex items-center justify-center h-64">
                    <div className="text-lg">Loading documents...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header - Updated to match your forms page style */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Mission Documents</h1>
                    </div>
                </div>
            </div>

            {/* Upload Form - Only show for Admins */}
            {showUploadForm && canUpload && (
                <Card>
                    <CardHeader>
                        <CardTitle>Upload New Document</CardTitle>
                        <CardDescription>
                            Fill in the document details and select a PDF file to upload
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title" className="text-md font-semibold">Title *</Label>
                                    <Input
                                        id="title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleInputChange}
                                        placeholder="Document title"
                                        required
                                        className="bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-md font-semibold">Description *</Label>
                                    <Input
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Document description"
                                        required
                                        className="bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="version" className="text-md font-semibold">Version *</Label>
                                    <Input
                                        id="version"
                                        name="version"
                                        type="number"
                                        value={formData.version}
                                        onChange={handleInputChange}
                                        placeholder="e.g., 12, 13"
                                        min="1"
                                        required
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                            
                            {/* File Upload Section - FIXED */}
                            <div className="space-y-2">
                                <Label htmlFor="document" className="text-md font-semibold">PDF File *</Label>
                                <div 
                                    className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                                    onClick={handleContainerClick}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        const files = e.dataTransfer.files
                                        if (files.length > 0 && files[0].type === 'application/pdf') {
                                            setFormData(prev => ({
                                                ...prev,
                                                document: files[0]
                                            }))
                                        }
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                >
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <Upload className="h-8 w-8 text-gray-400" />
                                        <div className="text-sm text-gray-600">
                                            {formData.document ? (
                                                <div className="flex flex-col items-center space-y-2">
                                                    <FileText className="h-6 w-6 text-green-600" />
                                                    <span className="font-medium text-green-700">{formData.document.name}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {(formData.document.size / (1024 * 1024)).toFixed(2)} MB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setFormData(prev => ({ ...prev, document: null }))
                                                        }}
                                                        className="text-xs text-red-600 hover:text-red-500"
                                                    >
                                                        Remove file
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="font-medium text-blue-600">Choose a file</span>
                                                    <p className="pl-1">or drag and drop</p>
                                                </>
                                            )}
                                        </div>
                                        {/* Hide PDF info when file is selected */}
                                        {!formData.document && (
                                            <p className="text-xs text-gray-500">
                                                PDF files only, up to 50MB
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {/* Hidden file input with ref */}
                                <Input
                                    ref={fileInputRef}
                                    id="document"
                                    name="document"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    required
                                    className="sr-only"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" disabled={uploading}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    {uploading ? "Uploading..." : "Upload Document"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Documents List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Available Documents ({documents.length})
                        </CardTitle>
                    </div>
                    {canUpload && (
                        <Button onClick={() => setShowUploadForm(!showUploadForm)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Upload Document
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {documents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No documents available. {canUpload ? "Upload your first document." : "Contact an administrator to upload documents."}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <div className="grid grid-cols-12 bg-muted/50 px-4 py-3 font-medium text-sm">
                                <div className="col-span-3">Title</div>
                                <div className="col-span-3">Description</div>
                                <div className="col-span-1">Version</div>
                                <div className="col-span-1">Size</div>
                                <div className="col-span-2">Uploaded By</div>
                                <div className="col-span-2">Actions</div>
                            </div>

                            <div className="divide-y">
                                {documents.map((document) => (
                                    <div key={document.document_id} className="grid grid-cols-12 px-4 py-3 items-center text-sm">
                                        <div className="col-span-3 font-medium">{document.title}</div>
                                        <div className="col-span-3 text-muted-foreground">{document.description}</div>
                                        <div className="col-span-1">
                                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                                V{document.version}
                                            </span>
                                        </div>
                                        <div className="col-span-1 text-muted-foreground">
                                            {formatFileSize(document.file_size)}
                                        </div>
                                        <div className="col-span-2 text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                <span>{document.uploaded_by_first_name} {document.uploaded_by_last_name}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground/70">
                                                {formatDate(document.created_at)}
                                            </div>
                                        </div>
                                        <div className="col-span-2 flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(document.document_id, document.original_name)}
                                                className="flex items-center gap-2"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download
                                            </Button>
                                            {canDelete && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDelete(document.document_id)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}