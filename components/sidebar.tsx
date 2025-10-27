"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import Image from "next/image"
import {
  Heart,
  Users,
  FileText,
  Package,
  BarChart3,
  Settings,
  Calendar,
  Map,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react"

interface SidebarProps {
  userRole: string
  collapsed?: boolean
  setCollapsed?: (v: boolean) => void
}

export const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Heart,
    roles: [
      "Admin",
      "Country Coordinator",
      "City Coordinator",
      "Supplies Manager",
    ],
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
  },
  {
    title: "SMS Outreach",
    href: "/sms",
    icon: MessageSquare,
    roles: ["Admin", "Country Coordinator", "City Coordinator"],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["Admin", "Supply Manager"],
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
    title: "Admin Panel",
    href: "/admin",
    icon: Settings,
    roles: ["Admin"],
  },
]

export function Sidebar({ userRole, collapsed: collapsedProp, setCollapsed: setCollapsedProp }: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = typeof collapsedProp === "boolean" ? collapsedProp : internalCollapsed
  const setCollapsed = setCollapsedProp ?? setInternalCollapsed
  const pathname = usePathname()

  const userRoles = sessionStorage.getItem("userRole")

  const navigationItems = NAV_ITEMS

  const filteredItems = navigationItems.filter((item) => item.roles.includes(sessionStorage.getItem("userRole") || "Admin"))

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center justify-between p-4 border-b ">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            {/* Logo */}
            <Image
              src="/img/starkeyLogo.png"
              alt="Starkey Logo"
              width={200}
              height={200}
              className="rounded-md"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-8 w-8" />
          ) : (
            <ChevronLeft className="h-8 w-8" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-4">
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn("w-full justify-start text-lg", collapsed && "px-2")}
                >
                  <Icon className={cn("h-8 w-8", !collapsed && "mr-2")} />
                  {!collapsed && <span>{item.title}</span>}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>


      {/* User Role Badge */}
      {!collapsed && (
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground mb-1">Current Role</div>
          <div className="text-sm font-medium">{userRoles}</div>
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
        // Non-blocking: log but continue to clear client state
        console.error("Backend logout request failed:", err)
      }

      // Clear local session regardless of backend result
      try {
        sessionStorage.removeItem("userRole")
        sessionStorage.removeItem("user")
        sessionStorage.removeItem("token")
        localStorage.removeItem("token")
      } catch (e) {
        console.error("Failed to clear storage:", e)
      }

      router.push("/")
    } finally {
      setBusy(false)
    }
  }

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        className="w-full flex items-center justify-center p-2"
        onClick={handleLogout}
        disabled={busy}
        title="Sign Out"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    )
  }

  return (
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
