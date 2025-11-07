"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import axios, { CancelTokenSource } from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Lock, Loader2, Eye, EyeOff, FileText } from "lucide-react"
import Image from "next/image"
// ADD: Dialog imports
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
  withCredentials: true,
})

const secureStorage = {
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      localStorage.setItem(key, value)
    }
  },
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key) || localStorage.getItem(key)
    } catch {
      return localStorage.getItem(key)
    }
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  },
  clear: () => {
    try {
      sessionStorage.clear()
      localStorage.clear()
    } catch {
      localStorage.clear()
    }
  },
}

interface LoginForm {
  username: string
  password: string
  role: string
  acceptTerms: boolean
}

interface FormErrors {
  username: string
  password: string
  acceptTerms: string
  general: string
}

export default function StarkeySystemLoginPage() {
  const [loginForm, setLoginForm] = useState<LoginForm>({ 
    username: "", 
    password: "", 
    role: "", 
    acceptTerms: false 
  })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [lockTime, setLockTime] = useState(0)
  const [errors, setErrors] = useState<FormErrors>({ 
    username: "", 
    password: "", 
    acceptTerms: "", 
    general: "" 
  })
  const [showTermsModal, setShowTermsModal] = useState(false)
  // ADD: local terms dialog state
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsScrolled, setTermsScrolled] = useState(false)
  const [otpStep, setOtpStep] = useState(false)           // ADDED
  const [otpCode, setOtpCode] = useState("")              // ADDED
  const [pendingToken, setPendingToken] = useState<string | null>(null)  // ADDED
  const [pendingUser, setPendingUser] = useState<any>(null)              // ADDED
  const [otpSending, setOtpSending] = useState(false)     // ADDED
  const [otpVerifying, setOtpVerifying] = useState(false) // ADDED
  // ADD: control dialog visibility
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false)
  const router = useRouter()

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = { username: "", password: "", acceptTerms: "", general: "" }
    let isValid = true

    if (!loginForm.username.trim()) {
      newErrors.username = "Username is required"
      isValid = false
    } else if (loginForm.username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters"
      isValid = false
    }

    if (!loginForm.password) {
      newErrors.password = "Password is required"
      isValid = false
    } else if (loginForm.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
      isValid = false
    }

    if (!loginForm.acceptTerms) {
      newErrors.acceptTerms = "You must accept the terms and conditions"
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }, [loginForm.username, loginForm.password, loginForm.acceptTerms])

  useEffect(() => {
    if (loginForm.username || loginForm.password || loginForm.acceptTerms) {
      validateForm()
    }
  }, [loginForm.username, loginForm.password, loginForm.acceptTerms, validateForm])

  useEffect(() => {
    const checkLockStatus = () => {
      const storedAttempts = parseInt(secureStorage.getItem("loginAttempts") || "0")
      const lastAttempt = parseInt(secureStorage.getItem("lastLoginAttempt") || "0")

      if (storedAttempts >= 5 && Date.now() - lastAttempt < 300000) {
        setIsLocked(true)
        setLockTime(Math.ceil((300000 - (Date.now() - lastAttempt)) / 1000))
      } else if (storedAttempts >= 5) {
        secureStorage.removeItem("loginAttempts")
        secureStorage.removeItem("lastLoginAttempt")
        secureStorage.removeItem("lockTime")
        setLoginAttempts(0)
        setIsLocked(false)
      }
    }

    checkLockStatus()

    if (isLocked) {
      const timer = setInterval(() => {
        setLockTime((prev) => {
          if (prev <= 1) {
            setIsLocked(false)
            secureStorage.removeItem("loginAttempts")
            secureStorage.removeItem("lastLoginAttempt")
            secureStorage.removeItem("lockTime")
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isLocked])

  useEffect(() => {
    const rememberedUser = secureStorage.getItem("rememberedUser")
    if (rememberedUser) {
      setLoginForm((prev) => ({ ...prev, username: rememberedUser }))
      setRememberMe(true)
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = secureStorage.getItem("token")
        const storedRole = secureStorage.getItem("userRole")

        if (token && storedRole) {
          const response = await api.get("/api/auth/verify", {
            headers: { Authorization: `Bearer ${token}` },
          })

          if (response.status === 200) {
            router.push("/dashboard")
          }
        }
      } catch {
        secureStorage.clear()
      }
    }
    checkAuth()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({ username: "", password: "", acceptTerms: "", general: "" })

    if (isLocked) {
      setErrors((prev) => ({
        ...prev,
        general: `Account temporarily locked. Please try again in ${lockTime} seconds.`,
      }))
      return
    }

    if (!validateForm()) return

    setLoading(true)
    let source: CancelTokenSource | null = null

    try {
      source = axios.CancelToken.source()
      const timeout = setTimeout(() => source?.cancel("Request timeout"), 10000)

      const res = await api.post(
        "/api/auth/login",
        { username: loginForm.username.trim(), password: loginForm.password },
        { cancelToken: source.token }
      )

      clearTimeout(timeout)

      if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

      const { token, user } = res.data.data
      if (!token || !user) throw new Error("Invalid authentication response from server")

      // Ensure phone exists
      if (!user.phone_number) {
        throw new Error("No phone number on file. Please contact admin.")
      }

      // Save pending, do NOT persist token yet
      setPendingToken(token)
      setPendingUser(user)

      // Send OTP
      setOtpSending(true)
      await api.post("/api/sms/send-otp", {
        user_id: user.user_id || user.id,
        phone_number: user.phone_number,
      })
      setOtpStep(true) // Show OTP step
      setIsOtpDialogOpen(true) // OPEN DIALOG
      setErrors((prev) => ({ ...prev, general: "OTP sent. Please enter the code to continue." }))
    } catch (err: any) {
      if (axios.isCancel(err)) {
        setErrors((prev) => ({ ...prev, general: "Request timed out. Please try again." }))
      } else {
        setErrors((prev) => ({
          ...prev,
          general: err?.response?.data?.message || err.message || "Login failed. Please try again.",
        }))
      }
    } finally {
      setOtpSending(false)
      setLoading(false)
    }
  }

  // ADDED: Verify OTP, then persist token and proceed
  const handleVerifyOtp = async () => {
    if (!pendingUser || !pendingToken) {
      setErrors((prev) => ({ ...prev, general: "No pending session. Please login again." }))
      return
    }
    if (!otpCode.trim()) {
      setErrors((prev) => ({ ...prev, general: "Please enter the OTP code." }))
      return
    }
    setOtpVerifying(true)
    setErrors((prev) => ({ ...prev, general: "" }))
    try {
      const res = await api.post("/api/sms/verify-otp", {
        user_id: pendingUser.user_id || pendingUser.id,
        otp_code: otpCode.trim(),
      })
      if (res.status === 200) {
        // Now persist token and user, then redirect
        secureStorage.setItem("token", pendingToken)
        secureStorage.setItem("user", JSON.stringify(pendingUser))
        secureStorage.setItem("userRole", Array.isArray(pendingUser.roles) ? pendingUser.roles[0] : pendingUser.roles)

        rememberMe
          ? secureStorage.setItem("rememberedUser", loginForm.username.trim())
          : secureStorage.removeItem("rememberedUser")

        secureStorage.removeItem("loginAttempts")
        secureStorage.removeItem("lastLoginAttempt")
        secureStorage.removeItem("lockTime")
        setLoginAttempts(0)
        router.push("/dashboard")
        // CLOSE OTP dialog after success
        setIsOtpDialogOpen(false)
      } else {
        throw new Error("Invalid server response.")
      }
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        general: err?.response?.data?.message || err.message || "OTP verification failed.",
      }))
    } finally {
      setOtpVerifying(false)
    }
  }

  // ADDED: Resend OTP
  const handleResendOtp = async () => {
    if (!pendingUser) return
    setOtpSending(true)
    try {
      await api.post("/api/sms/send-otp", {
        user_id: pendingUser.user_id || pendingUser.id,
        phone_number: pendingUser.phone_number,
      })
      setErrors((prev) => ({ ...prev, general: "OTP re-sent." }))
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err?.response?.data?.message || "Failed to resend OTP." }))
    } finally {
      setOtpSending(false)
    }
  }

  const handleInputChange = (field: keyof LoginForm, value: string | boolean) => {
    setLoginForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: "" }))
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Top Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white-100 to-blue-200 z-0"/>

      {/* Main Content */}
      <div className="w-full max-w-md space-y-8 z-10 px-4">
        {/* Header with Logo */}
        <div className="text-center space-y-4">
          <div className="flex flex-col items-center justify-center space-y-2">
            <Image
              src="/img/starkeyLogo.png"
              alt="Starkey Hearing Foundation Logo"
              width={300}
              height={180}
              priority
              className="drop-shadow-md"
            />
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-2 border-blue-50">
          <CardHeader className="space-y-3 flex flex-col items-center pb-6">
            <CardTitle className="text-2xl font-bold text-center text-blue-800">LOGIN</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Username Field with Fixed Height Container */}
              <div className="space-y-1">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className={`h-11 transition-all duration-200 ${
                      errors.username ? "border-red-500 focus:border-red-500" : ""
                    }`}
                    placeholder="Enter your username or email"
                    disabled={loading || isLocked}
                  />
                  {/* Absolute positioned error message */}
                  {errors.username && (
                    <div className="absolute -bottom-5 left-0 right-0">
                      <p className="text-sm text-red-500 text-left">⚠ {errors.username}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Password Field with Fixed Height Container */}
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className={`h-11 pr-10 transition-all duration-200 ${
                        errors.password ? "border-red-500 focus:border-red-500" : ""
                      }`}
                      placeholder="Enter your password"
                      disabled={loading || isLocked}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading || isLocked}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  {/* Absolute positioned error message */}
                  {errors.password && (
                    <div className="absolute -bottom-5 left-0 right-0">
                      <p className="text-sm text-red-500 text-left">⚠ {errors.password}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Remember Me & Terms - Fixed Height Container */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rememberMe"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      disabled={loading || isLocked}
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-gray-600">
                      Remember me
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-blue-600 hover:text-blue-800 p-0 h-auto"
                    disabled={loading || isLocked}
                  >
                    Forgot password?
                  </Button>
                </div>

                {/* Terms and Conditions with Fixed Height Container */}
                <div className="relative">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="acceptTerms"
                      checked={loginForm.acceptTerms}
                      onCheckedChange={(checked) => handleInputChange("acceptTerms", checked as boolean)}
                      disabled={loading || isLocked}
                      className="mt-1"
                    />
                    <div className="space-y-1 flex-1">
                      <Label htmlFor="acceptTerms" className="text-sm text-gray-600 cursor-pointer">
                        I accept the{" "}
                        <Button
                          type="button"
                          variant="link"
                          className="p-0 h-auto text-blue-600 hover:text-blue-800 text-sm font-normal"
                          onClick={() => setShowTermsModal(true)}
                        >
                          Terms and Conditions
                        </Button>
                      </Label>
                    </div>
                  </div>
                  {/* Absolute positioned error message */}
                  {errors.acceptTerms && (
                    <div className="absolute -bottom-5 left-0 right-0">
                      <p className="text-sm text-red-500 text-left">⚠ {errors.acceptTerms}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* General Error - This one can push content down since it's more important */}
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 animate-in fade-in-50 mt-2">
                  ⚠ {errors.general}
                </div>
              )}

              {/* Login Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 transition-all duration-200"
                  disabled={loading || isLocked || otpStep} // keep disabled while OTP is pending
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Authenticating...
                    </>
                  ) : isLocked ? (
                    `Locked (${lockTime}s)`
                  ) : (
                    "Login"
                  )}
                </Button>
              </div>

              {/* REMOVE inline OTP UI (moved to dialog) */}
            </form>

            {/* Security Notice */}
            <div className="mt-8 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700 text-center flex items-center justify-center space-x-1">
                <Lock className="h-3 w-3" />
                <span>Secure portal access for the MediEase system.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} MediEase System. All rights reserved.
          </p>
        </div>
      </div>

      {/* OTP Dialog */}
      <Dialog
        open={isOtpDialogOpen}
        onOpenChange={(open) => {
          setIsOtpDialogOpen(open)
          if (!open) {
            // Cancel OTP flow when closed
            setOtpStep(false)
            setOtpCode("")
            setPendingToken(null)
            setPendingUser(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Two-Factor Verification</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to{" "}
              <strong>{pendingUser?.phone_number || "your phone"}</strong>.
            </p>

            <div className="space-y-1">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                placeholder="6-digit code"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                autoFocus
              />
            </div>

            {errors.general && (
              <p className="text-sm text-red-500">⚠ {errors.general}</p>
            )}
          </div>

          <DialogFooter className="mt-2 flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                if (!pendingUser) return
                setOtpSending(true)
                try {
                  await api.post("/api/sms/send-otp", {
                    user_id: pendingUser.user_id || pendingUser.id,
                    phone_number: pendingUser.phone_number,
                  })
                  setErrors((prev) => ({ ...prev, general: "OTP re-sent." }))
                } catch (err: any) {
                  setErrors((prev) => ({ ...prev, general: err?.response?.data?.message || "Failed to resend OTP." }))
                } finally {
                  setOtpSending(false)
                }
              }}
              disabled={otpSending}
            >
              {otpSending ? "Sending…" : "Resend OTP"}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOtpDialogOpen(false)
                  setOtpStep(false)
                  setOtpCode("")
                  setPendingToken(null)
                  setPendingUser(null)
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleVerifyOtp} disabled={otpVerifying}>
                {otpVerifying ? "Verifying…" : "Verify OTP"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terms and Conditions Dialog (polished) */}
      <Dialog
        open={showTermsModal}
        onOpenChange={(open) => {
          setShowTermsModal(open)
          if (!open) {
            setTermsChecked(false)
            setTermsScrolled(false)
          }
        }}
      >
        <DialogContent className="w-[100vw] max-w-7xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Terms and Conditions
            </DialogTitle>
            <DialogDescription>
              Please review the following terms carefully. Last updated: {new Date().toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <div
            className="max-h-[60vh] overflow-auto rounded-md border bg-muted/20 p-5 text-sm"
            onScroll={(e) => {
              const el = e.currentTarget
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
                setTermsScrolled(true)
              }
            }}
          >
            <div className="space-y-5 text-gray-700">
              <section>
                <h3 className="font-semibold text-gray-900 mb-1">1. Introduction</h3>
                <p>
                  MediEase is the centralized healthcare information management system of the Starkey Hearing Foundation. By
                  logging in, you agree to comply with the organization’s Data Privacy Policy, Information Security Policy, and
                  Code of Conduct, as well as applicable laws and standards including the Data Privacy Act of 2012 and ISO/IEC
                  27001:2022.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">2. Purpose</h3>
                <p>
                  These Terms protect the integrity, confidentiality, and availability of data within MediEase and ensure
                  responsible and ethical system use.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">3. Authorized Use</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Access is limited to authorized staff with assigned credentials.</li>
                  <li>Accounts are personal and non-transferable; you are accountable for actions under your username.</li>
                  <li>Use is restricted to official purposes; logout after use and never leave active sessions unattended.</li>
                  <li>Unauthorized access, misuse, alteration, or destruction of data may result in disciplinary/legal action.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">4. Data Privacy and Confidentiality</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>All patient, mission, and inventory data are confidential and protected by applicable laws.</li>
                  <li>Do not disclose, copy, or distribute system data without explicit authorization.</li>
                  <li>Collect/process personal data only for legitimate operational purposes.</li>
                  <li>Report any suspected data breach immediately; never store data on unsecured devices or transmit unencrypted data.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">5. Data Accuracy and Integrity</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Ensure information entered/updated is accurate, complete, and current.</li>
                  <li>Falsifying or manipulating records is prohibited.</li>
                  <li>All user actions are logged for accountability (audit trails).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">6. Information Security and ISO Compliance</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Security controls include encryption, 2FA, firewalls, and role-based access control.</li>
                  <li>Use only secure devices and networks; avoid unauthorized software; follow strong password practices.</li>
                  <li>Access logs and changes are monitored and audited for compliance.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">7. Intellectual Property</h3>
                <p>
                  MediEase software, design, and documentation are the property of the Starkey Hearing Foundation. Reverse
                  engineering or redistribution is prohibited. Data in MediEase remains property of the organization and its
                  beneficiaries.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">8. Monitoring and Audit</h3>
                <p>
                  System activities are monitored and audited for operational, security, and compliance purposes. The Foundation
                  may review logs and act on policy violations.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">9. Liability and Disciplinary Action</h3>
                <p>
                  Non-compliance may result in account suspension, termination, or legal action. Report vulnerabilities
                  immediately and do not attempt to exploit them.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">10. Availability and Maintenance</h3>
                <p>
                  The system may undergo scheduled maintenance and updates. Some functions may be temporarily restricted during
                  these periods.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">11. Agreement</h3>
                <p>
                  By selecting “I Agree,” you confirm you are authorized, have read and understood these Terms, and agree to
                  comply with all policies and laws governing system use.
                </p>
              </section>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2">
            <Checkbox
              id="acceptTermsConfirm"
              checked={termsChecked}
              onCheckedChange={(v) => setTermsChecked(Boolean(v))}
              className="mt-1"
            />
            <Label htmlFor="acceptTermsConfirm" className="text-sm text-gray-700">
              I have read and agree to the Terms and Conditions.
            </Label>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowTermsModal(false)
                setTermsChecked(false)
                setTermsScrolled(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleInputChange("acceptTerms", true)
                setShowTermsModal(false)
                setTermsChecked(false)
                setTermsScrolled(false)
              }}
              disabled={!termsChecked || !termsScrolled}
              className="bg-blue-600 hover:bg-blue-700"
            >
              I Agree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REMOVE old custom Terms overlay if present */}
    </div>
  )
}