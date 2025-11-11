"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save, User as UserIcon, Mail, Phone, MapPin, Key, Eye, EyeOff, Shield, ArrowLeft } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

type UserProfile = {
  user_id: string
  username: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  city_assigned: string
  roles?: string[]
}

type PasswordData = {
  old_password: string
  new_password: string
  confirm_password: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" })

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    city_assigned: "",
  })

  const [passwordData, setPasswordData] = useState<PasswordData>({
    old_password: "",
    new_password: "",
    confirm_password: "",
  })

  // OTP flow state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpMsg, setOtpMsg] = useState<{ type: "success" | "error" | ""; text: string }>({ type: "", text: "" })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token")
        if (!token) {
          router.push("/")
          return
        }

        const cached = sessionStorage.getItem("user")
        if (cached) {
          const u = JSON.parse(cached) as UserProfile
          setProfile(u)
          setFormData({
            first_name: u.first_name || "",
            last_name: u.last_name || "",
            email: u.email || "",
            phone_number: u.phone_number || "",
            city_assigned: u.city_assigned || "",
          })
          setLoading(false)
          return
        }

        const userId = sessionStorage.getItem("userId") || localStorage.getItem("userId")
        if (!userId) throw new Error("No user ID found")

        const base = process.env.NEXT_PUBLIC_API_URL || ""
        const res = await fetch(`${base}/api/users/${userId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        })

        if (!res.ok) throw new Error("Failed to fetch profile")

        const json = await res.json()
        const u = (json?.data || json) as UserProfile

        setProfile(u)
        setFormData({
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          email: u.email || "",
          phone_number: u.phone_number || "",
          city_assigned: u.city_assigned || "",
        })
        sessionStorage.setItem("user", JSON.stringify(u))
        sessionStorage.setItem("userFirstName", u.first_name || "")
        sessionStorage.setItem("userLastName", u.last_name || "")
      } catch (e) {
        console.error(e)
        setMessage({ type: "error", text: "Unable to load profile data." })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  const onField = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const onSave = async () => {
    if (!profile) return
    setSaving(true)
    setMessage({ type: "", text: "" })

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const base = process.env.NEXT_PUBLIC_API_URL || ""

      // Only send changed, non-empty fields
      const payload: Record<string, any> = {}
      Object.entries(formData).forEach(([key, value]) => {
        const original = (profile as any)[key]
        if (value === original) return
        if (value === "") return
        payload[key] = value
      })

      if (Object.keys(payload).length === 0) {
        setMessage({ type: "success", text: "No changes to save." })
        setSaving(false)
        return
      }

      // Use PUT with merged data to avoid clearing unspecified fields
      const method = "PUT"
      const url = `${base}/api/users/${profile.user_id}`
      const mergedBody = { ...profile, ...payload }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(mergedBody),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || "Failed to update profile")
      }

      const json = await res.json()
      const updated = (json?.data || json) as UserProfile

      const merged: UserProfile = { ...profile, ...updated }
      setProfile(merged)
      sessionStorage.setItem("user", JSON.stringify(merged))
      sessionStorage.setItem("userFirstName", merged.first_name || "")
      sessionStorage.setItem("userLastName", merged.last_name || "")
      window.dispatchEvent(new Event("user-profile-updated"))

      setMessage({ type: "success", text: "Profile updated successfully." })
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Failed to update profile." })
    } finally {
      setSaving(false)
    }
  }

  const [showPw, setShowPw] = useState({ old: false, next: false, confirm: false })

  const onChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: "error", text: "New passwords do not match." })
      return
    }
    if (passwordData.new_password.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters." })
      return
    }

    setChangingPassword(true)
    setMessage({ type: "", text: "" })
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const base = process.env.NEXT_PUBLIC_API_URL || ""
      const res = await fetch(`${base}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          old_password: passwordData.old_password,
          new_password: passwordData.new_password,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || "Failed to change password")
      }

      setMessage({ type: "success", text: "Password changed successfully." })
      setPasswordData({ old_password: "", new_password: "", confirm_password: "" })
      setShowChangePassword(false)
      setOtpVerified(false)
      setOtpSent(false)
      setOtpCode("")
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Failed to change password." })
    } finally {
      setChangingPassword(false)
    }
  }

  // OTP helpers
  const maskPhone = (p?: string) => {
    if (!p) return ""
    const s = String(p).replace(/\s/g, "")
    if (s.length <= 4) return s
    const last4 = s.slice(-4)
    return `${s.slice(0, 2)}*****${last4}`
  }

  const sendOtp = async () => {
    if (!profile) return
    setOtpMsg({ type: "", text: "" })
    setOtpSending(true)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const base = process.env.NEXT_PUBLIC_API_URL || ""
      const res = await fetch(`${base}/api/sms/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          user_id: profile.user_id,
          phone_number: profile.phone_number,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || "Failed to send OTP")
      }
      setOtpSent(true)
      setOtpMsg({ type: "success", text: "OTP sent. Please check your phone." })
    } catch (e: any) {
      setOtpMsg({ type: "error", text: e?.message || "Failed to send OTP." })
    } finally {
      setOtpSending(false)
    }
  }

  const verifyOtp = async () => {
    if (!profile || !otpCode) return
    setOtpMsg({ type: "", text: "" })
    setOtpVerifying(true)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const base = process.env.NEXT_PUBLIC_API_URL || ""
      const res = await fetch(`${base}/api/sms/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          user_id: profile.user_id,
          otp_code: otpCode,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || "Invalid or expired OTP")
      }
      setOtpVerified(true)
      setOtpMsg({ type: "success", text: "OTP verified. You can now change your password." })
    } catch (e: any) {
      setOtpMsg({ type: "error", text: e?.message || "OTP verification failed." })
    } finally {
      setOtpVerifying(false)
    }
  }

  const cancelChangePasswordFlow = () => {
    setShowChangePassword(false)
    setOtpVerified(false)
    setOtpSent(false)
    setOtpCode("")
    setOtpMsg({ type: "", text: "" })
    setPasswordData({ old_password: "", new_password: "", confirm_password: "" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 overflow-y-auto px-6 py-8 bg-gray-50">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.back()}
                aria-label="Go back"
                className="h-9 w-9"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <UserIcon className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile Management</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showChangePassword ? (
                <Button variant="outline" onClick={cancelChangePasswordFlow}>
                  Cancel
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={async () => {
                  setShowChangePassword(true)
                  setOtpVerified(false)
                  setOtpSent(false)
                  setOtpCode("")
                  await sendOtp()
                }}
                disabled={!profile || otpSending}
              >
                {otpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Change Password
              </Button>
            </div>
          </div>

          {message.text ? (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertDescription className="font-medium">{message.text}</AlertDescription>
            </Alert>
          ) : null}

          {profile ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your details and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" value={profile.username || ""} disabled className="bg-gray-50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user_id">User ID</Label>
                      <Input id="user_id" value={profile.user_id || ""} disabled className="bg-gray-50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => onField("first_name", e.target.value)}
                        placeholder="Enter your first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => onField("last_name", e.target.value)}
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => onField("email", e.target.value)}
                      placeholder="Enter your email address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number}
                      onChange={(e) => onField("phone_number", e.target.value)}
                      placeholder="Enter your phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city_assigned" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Assigned City
                    </Label>
                    <Input
                      id="city_assigned"
                      value={formData.city_assigned}
                      onChange={(e) => onField("city_assigned", e.target.value)}
                      placeholder="Enter your assigned city"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={onSave} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* OTP Verification and Password Change (lazy-revealed) */}
              {showChangePassword && (
                <>
                  {!otpVerified ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Verify Identity</CardTitle>
                        <CardDescription>
                          We sent a one-time code to your phone {maskPhone(profile.phone_number)}. Enter it to proceed.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {otpMsg.text ? (
                          <Alert variant={otpMsg.type === "error" ? "destructive" : "default"}>
                            <AlertDescription>{otpMsg.text}</AlertDescription>
                          </Alert>
                        ) : null}

                        <div className="flex items-center gap-3">
                          <Input
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={6}
                            placeholder="Enter 6-digit OTP"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="max-w-[200px] tracking-widest text-center"
                          />
                          <Button onClick={verifyOtp} disabled={otpVerifying || otpCode.length !== 6}>
                            {otpVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Verify OTP
                          </Button>
                          <Button type="button" variant="outline" onClick={sendOtp} disabled={otpSending} title="Resend OTP">
                            {otpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Resend OTP
                          </Button>
                          <Button type="button" variant="ghost" onClick={cancelChangePasswordFlow}>
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Enter your new password below</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="old_password">Current Password</Label>
                          <div className="relative">
                            <Input
                              id="old_password"
                              type={showPw.old ? "text" : "password"}
                              value={passwordData.old_password}
                              onChange={(e) => setPasswordData((p) => ({ ...p, old_password: e.target.value }))}
                              placeholder="Enter your current password"
                              className="pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-4 hover:bg-transparent"
                              onClick={() => setShowPw((s) => ({ ...s, old: !s.old }))}
                              aria-label="Toggle current password visibility"
                            >
                              {showPw.old ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="new_password">New Password</Label>
                          <div className="relative">
                            <Input
                              id="new_password"
                              type={showPw.next ? "text" : "password"}
                              value={passwordData.new_password}
                              onChange={(e) => setPasswordData((p) => ({ ...p, new_password: e.target.value }))}
                              placeholder="Enter your new password"
                              className="pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-4 hover:bg-transparent"
                              onClick={() => setShowPw((s) => ({ ...s, next: !s.next }))}
                              aria-label="Toggle new password visibility"
                            >
                              {showPw.next ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirm_password">Confirm New Password</Label>
                          <div className="relative">
                            <Input
                              id="confirm_password"
                              type={showPw.confirm ? "text" : "password"}
                              value={passwordData.confirm_password}
                              onChange={(e) => setPasswordData((p) => ({ ...p, confirm_password: e.target.value }))}
                              placeholder="Confirm your new password"
                              className="pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-4 hover:bg-transparent"
                              onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                              aria-label="Toggle confirm password visibility"
                            >
                              {showPw.confirm ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
                          <div className="flex items-start gap-3">
                            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div>
                              <p className="text-yellow-800 font-semibold text-sm">Password Requirements</p>
                              <p className="text-yellow-700 text-sm mt-1">At least 6 characters long</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <Button type="button" variant="ghost" onClick={cancelChangePasswordFlow}>
                            Cancel
                          </Button>
                          <Button onClick={onChangePassword} disabled={changingPassword} className="gap-2">
                            {changingPassword ? <Loader2 className="h-5 w-5 animate-spin" /> : <Key className="h-5 w-5" />}
                            {changingPassword ? "Updating..." : "Change Password"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Profile Not Found</h3>
                <p className="text-gray-600 mb-6">Unable to load your profile data. Please try again.</p>
                <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Reload Page
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}