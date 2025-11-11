"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import axios from "axios"
import {
  Heart,
  Users,
  FileText,
  Package,
  BarChart3,
  Settings,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
  ChevronRight as ChevronIcon,
  FileSearch,
  Archive,
} from "lucide-react"
import { decryptObject } from "@/utils/decrypt"

interface SidebarProps {
  userRole: string
  collapsed?: boolean
  setCollapsed?: (v: boolean) => void
}

interface NavItem {
  title: string
  href: string
  icon: any
  roles: string[]
  subItems?: { title: string; href: string }[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Heart,
    roles: ["Admin", "Country Coordinator", "City Coordinator", "Supplies Manager", "Supply Manager"], // added "Supply Manager"
  },
  {
    title: "Patients",
    href: "/patients",
    icon: Users,
    roles: ["Admin", "Country Coordinator", "City Coordinator"],
  },
  {
    title: "Phase Forms",
    href: "/forms",
    icon: FileText,
    roles: ["Admin", "Country Coordinator", "City Coordinator"],
    subItems: [
      { title: "Phase 1 Forms", href: "/forms/phase1" },
      { title: "Phase 2 Forms", href: "/forms/phase2" },
      { title: "Phase 3 Forms", href: "/forms/phase3" },
    ],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["Admin", "Supplies Manager", "Supply Manager"], // added "Supply Manager"
  },
  {
    title: "Scheduling",
    href: "/scheduling",
    icon: Calendar,
    roles: ["Admin", "Country Coordinator", "City Coordinator"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["Admin", "Country Coordinator", "City Coordinator"],
  },
   {
    title: "Mission Documents",
    href: "/documents",
    icon: FileSearch,
    roles: ["Admin", "Country Coordinator", "City Coordinator"],
  },
  {
    title: "Admin Panel",
    href: "/admin",
    icon: Settings,
    roles: ["Admin"],
  },
    {
    title: "Archival",
    href: "/archival",
    icon: Archive,
    roles: ["Admin"],
  }
]

const apiBaseURL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "")

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
})

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token")
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function Sidebar({ collapsed: collapsedProp, setCollapsed: setCollapsedProp }: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = typeof collapsedProp === "boolean" ? collapsedProp : internalCollapsed
  const setCollapsed = setCollapsedProp ?? setInternalCollapsed
  const pathname = usePathname()
  const router = useRouter()

  const userRole = sessionStorage.getItem("userRole") || "Admin"
  const userFirstName = sessionStorage.getItem("userFirstName") || "" // Add this
  const userLastName = sessionStorage.getItem("userLastName") || "" // Add this
  const filteredItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole))

  const [lowStockCount, setLowStockCount] = useState<number>(0)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null)
  const [flyoutAnchor, setFlyoutAnchor] = useState<HTMLElement | null>(null)

  // Only fetch low stock if user can see Inventory
  const hasInventoryAccess = filteredItems.some((i) => i.title === "Inventory")

  // ✅ Keep Phase Forms expanded when navigating inside its subpages
  useEffect(() => {
    if (pathname.startsWith("/forms")) {
      setExpandedItem("Phase Forms")
    } else {
      setExpandedItem(null)
    }
  }, [pathname])

  // ✅ Fetch low-stock count (on mount, focus, and every 60s) with decryption (reference: patients page)
  useEffect(() => {
    if (!hasInventoryAccess) {
      setLowStockCount(0)
      return
    }
    let mounted = true

    const fetchLowStockCount = async () => {
      try {
        const res = await api.get("/api/supplies", {
          params: { low_stock: "true", page: 1, limit: 1 },
        })

        // Decrypt if encrypted_data present (same pattern as patients page)
        let payload: any
        if (res.data?.encrypted_data) {
          try {
            payload = decryptObject(res.data.encrypted_data)
          } catch {
            console.error("Low-stock decrypt failed")
            payload = {}
          }
        } else {
          payload = res.data?.data ?? res.data
        }

        // Try multiple possible locations for totalCount
        const raw =
          payload?.totalCount ??
          payload?.data?.totalCount ??
          payload?.meta?.totalCount ??
          0

        const count = typeof raw === "string" ? parseInt(raw, 10) : Number(raw) || 0
        if (mounted) setLowStockCount(count)
      } catch (err) {
        console.error("Failed to load low-stock count", err)
        if (mounted) setLowStockCount(0)
      }
    }

    fetchLowStockCount()
    const id = window.setInterval(fetchLowStockCount, 60000)
    const onFocus = () => fetchLowStockCount()
    window.addEventListener("focus", onFocus)

    return () => {
      mounted = false
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [hasInventoryAccess])

  // ✅ Handles click behavior
  const handleParentClick = (item: NavItem, anchor?: HTMLElement) => {
    if (item.subItems) {
      if (collapsed) {
        setActiveFlyout((prev) => (prev === item.title ? null : item.title))
        if (anchor) setFlyoutAnchor(anchor)
      } else {
        setExpandedItem(expandedItem === item.title ? null : item.title)
      }
    } else {
      setExpandedItem(null)
      setActiveFlyout(null)
      setFlyoutAnchor(null)
      router.push(item.href)
    }
  }

  const handleProfileClick = () => {
    router.push("/profile")
  }
  
  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <Image
            src="/img/starkeyLogo.png"
            alt="Starkey Logo"
            width={200}
            height={200}
            className="rounded-md"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? <ChevronRight className="h-8 w-8" /> : <ChevronLeft className="h-8 w-8" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-4">
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const isExpanded = expandedItem === item.title
            const hasChildren = !!item.subItems?.length

            return (
              <div key={item.href} className="relative group">
                <Button
                  aria-expanded={hasChildren ? (collapsed ? activeFlyout === item.title : isExpanded) : undefined}
                  aria-haspopup={hasChildren ? "menu" : undefined}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start text-lg flex items-center transition-all",
                    collapsed && "px-2"
                  )}
                  onClick={(e) => handleParentClick(item, e.currentTarget as HTMLElement)}
                  onMouseEnter={(e) => {
                    if (collapsed && hasChildren) {
                      setActiveFlyout(item.title)
                      setFlyoutAnchor(e.currentTarget as HTMLElement)
                    }
                  }}
                >
                  <div className="flex items-center w-full justify-between">
                    <div className="flex items-center">
                      {/* Icon with indicators */}
                      <div className="relative">
                        <Icon className={cn("h-8 w-8", !collapsed && "mr-2")} />
                        {/* Collapsed: show tiny chevron to indicate expandable */}
                        {collapsed && hasChildren && (
                          <ChevronIcon
                            className={cn(
                              "absolute -bottom-1 -right-1 h-3 w-3 opacity-70 transition-transform",
                              (activeFlyout === item.title) && "rotate-90"
                            )}
                          />
                        )}
                        {/* Collapsed: Inventory low-stock red dot */}
                        {collapsed && item.title === "Inventory" && lowStockCount > 0 && (
                          <span
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card"
                            aria-label="Low stock alert"
                          />
                        )}
                      </div>
                      {!collapsed && <span className="ml-2">{item.title}</span>}
                    </div>

                    {/* Expanded sidebar: chevron for submenu */}
                    {!collapsed && hasChildren && (
                      <ChevronIcon
                        className={cn(
                          "h-5 w-5 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                    )}

                    {/* Inventory badge (expanded) */}
                    {!collapsed && item.title === "Inventory" && lowStockCount > 0 && (
                      <div className="flex items-center space-x-2">
                        <Bell className="h-5 w-5 stroke-red-500 fill-red-500" />
                        <div className="text-xs font-semibold text-destructive">{lowStockCount}</div>
                      </div>
                    )}
                  </div>
                </Button>

                {/* ✅ Sub Items (expanded sidebar) */}
                {!collapsed && hasChildren && expandedItem === item.title ? (
                  <div className="ml-10 mt-1 space-y-1 animate-slideDown">
                    {item.subItems!.map((sub) => {
                      const subActive = pathname === sub.href
                      return (
                        <Button
                          key={sub.href}
                          role="menuitem"
                          variant={subActive ? "secondary" : "ghost"}
                          className="w-full justify-start text-base"
                          onClick={() => router.push(sub.href)}
                        >
                          {sub.title}
                        </Button>
                      )
                    })}
                  </div>
                ) : null}

                {/* ✅ Collapsed flyout submenu via portal (not clipped by ScrollArea) */}
                {collapsed && hasChildren && activeFlyout === item.title && (
                  <FlyoutPortal
                    anchor={flyoutAnchor}
                    open
                    onClose={() => setActiveFlyout(null)}
                  >
                    {item.subItems!.map((sub) => {
                      const subActive = pathname === sub.href
                      return (
                        <Button
                          key={sub.href}
                          role="menuitem"
                          variant={subActive ? "secondary" : "ghost"}
                          className="w-full justify-start text-base"
                          onClick={() => {
                            setActiveFlyout(null)
                            router.push(sub.href)
                          }}
                        >
                          {sub.title}
                        </Button>
                      )
                    })}
                  </FlyoutPortal>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Current Role */}
      {!collapsed && (
        <div className="p-4 border-t">
          <div 
            onClick={handleProfileClick}
            className="cursor-pointer hover:bg-blue-500/50 rounded-md p-2 transition-colors"
          >
            <div className="text-lg font-semibold">{userFirstName} {userLastName}</div>
            <div className="text-xs text-muted-foreground">{userRole}</div>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className={cn("p-4 border-t mt-auto", collapsed ? "text-center" : "")}>
        <LogoutButton collapsed={collapsed} />
      </div>
    </div>
  )
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const handleLogout = async () => {
    setBusy(true)
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token")
      const base = process.env.NEXT_PUBLIC_API_URL || ""
      const logoutUrl = base ? `${base}/api/auth/logout` : "/api/auth/logout"

      try {
        await fetch(logoutUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        })
      } catch (err) {
        console.error("Backend logout request failed:", err)
      }

      sessionStorage.clear()
      localStorage.removeItem("token")
      router.push("/")
    } finally {
      setBusy(false)
    }
  }

  return collapsed ? (
    <Button
      variant="ghost"
      className="w-full flex items-center justify-center p-2"
      onClick={handleLogout}
      disabled={busy}
      title="Sign Out"
    >
      <LogOut className="h-5 w-5" />
    </Button>
  ) : (
    <Button
      variant="outline"
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-lg"
      onClick={handleLogout}
      disabled={busy}
    >
      <LogOut />
      Sign Out
    </Button>
  )
}

function FlyoutPortal({
  anchor,
  open,
  onClose,
  children,
}: {
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  children: any
}) {
  if (!open || !anchor) return null
  const rect = anchor.getBoundingClientRect()
  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.top,
    left: rect.right + 8,
    zIndex: 1000,
  }
  return createPortal(
    <div
      role="menu"
      style={style}
      className="min-w-44 rounded-md border bg-popover shadow-md p-2"
      onMouseLeave={onClose}
      onMouseEnter={() => {}}
    >
      {children}
    </div>,
    document.body
  )
}
