"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import axios, { CancelTokenSource } from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Lock, Loader2, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

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
      if (!token || !user || !user.roles) throw new Error("Invalid authentication response from server")

      secureStorage.setItem("token", token)
      secureStorage.setItem("user", JSON.stringify(user))
      secureStorage.setItem("userRole", Array.isArray(user.roles) ? user.roles[0] : user.roles)

      rememberMe
        ? secureStorage.setItem("rememberedUser", loginForm.username.trim())
        : secureStorage.removeItem("rememberedUser")

      secureStorage.removeItem("loginAttempts")
      secureStorage.removeItem("lastLoginAttempt")
      secureStorage.removeItem("lockTime")
      setLoginAttempts(0)
      setLoginForm((prev) => ({ ...prev, role: user.role }))
      router.push("/dashboard")
    } catch (err: any) {
      if (axios.isCancel(err)) {
        setErrors((prev) => ({ ...prev, general: "Request timed out. Please try again." }))
        return
      }

      if (err.response?.status === 401) {
        const attempts = loginAttempts + 1
        setLoginAttempts(attempts)
        secureStorage.setItem("loginAttempts", attempts.toString())
        secureStorage.setItem("lastLoginAttempt", Date.now().toString())

        if (attempts >= 5) {
          setIsLocked(true)
          setLockTime(300)
          secureStorage.setItem("lockTime", "300")
          setErrors((prev) => ({
            ...prev,
            general: "Too many failed attempts. Account locked for 5 minutes.",
          }))
        } else {
          setErrors((prev) => ({
            ...prev,
            general: `Invalid username or password. ${5 - attempts} attempts remaining.`,
          }))
        }
      } else {
        setErrors((prev) => ({
          ...prev,
          general: err.response?.data?.message || err.message || "Login failed. Please try again.",
        }))
      }
    } finally {
      setLoading(false)
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
                  disabled={loading || isLocked}
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

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Terms and Conditions</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4 text-sm text-gray-700">
                <p>
                  <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
                </p>
                
                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h3>
                  <p>
                    By accessing and using the MediEase System, you accept and agree to be bound by the terms and 
                    provision of this agreement.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">2. Use License</h3>
                  <p>
                    Permission is granted to temporarily use the MediEase System for internal business purposes 
                    only. This is the grant of a license, not a transfer of title.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">3. User Account</h3>
                  <p>
                    You are responsible for maintaining the confidentiality of your account and password and for 
                    restricting access to your computer. You agree to accept responsibility for all activities 
                    that occur under your account.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">4. Privacy Policy</h3>
                  <p>
                    Your use of the MediEase System is also governed by our Privacy Policy. Please review our 
                    Privacy Policy, which also governs the site and informs users of our data collection practices.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">5. Prohibited Uses</h3>
                  <p>
                    You may not use the MediEase System in any manner that could damage, disable, overburden, 
                    or impair the system or interfere with any other party&apos;s use and enjoyment of the system.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">6. Termination</h3>
                  <p>
                    We may terminate or suspend your account and bar access to the system immediately, without 
                    prior notice or liability, under our sole discretion, for any reason whatsoever.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-900 mb-2">7. Governing Law</h3>
                  <p>
                    These Terms shall be governed and construed in accordance with the laws of the United States, 
                    without regard to its conflict of law provisions.
                  </p>
                </section>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  handleInputChange("acceptTerms", true)
                  setShowTermsModal(false)
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Accept Terms
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}