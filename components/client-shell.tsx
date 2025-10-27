"use client"

import React, { useEffect, useState } from "react"
import { Sidebar, NAV_ITEMS } from "./sidebar"
import { usePathname } from "next/navigation" // usePathname is the hook in question

interface Props {
  children: React.ReactNode
}

export default function ClientShell({ children }: Props) {
  // 1. ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const [userRole, setUserRole] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  
  // 🛠️ FIX: Move usePathname here, above the conditional return.
  const pathname = usePathname() || "/" 

  useEffect(() => {
    // Try reading role from localStorage, otherwise default to Admin
    try {
      const stored = localStorage.getItem("userRole")
      setUserRole(stored || "Admin")
    } catch (e) {
      setUserRole("Admin")
    }
  }, [])

  // 2. CONDITIONAL RETURNS OR LOGIC CAN FOLLOW HOOKS
  // While role is loading, render children full-width
  if (!userRole) {
    return <div className="min-h-screen">{children}</div>
  }

  // show sidebar only when current pathname matches a known navigation item's href
  const knownHrefs = NAV_ITEMS.map((n) => n.href)
  const is404 = pathname === "/404" || pathname.startsWith("/404") || pathname.includes("/404") || pathname === "/_error"
  const showSidebar = !is404 && (knownHrefs.some((h) => pathname === h || pathname.startsWith(h + "/")) || pathname.startsWith("/forms"))

  return (
    <div className="min-h-screen flex">
      {showSidebar && (
        <aside className="hidden md:block fixed left-0 top-0 h-full z-10">
          <Sidebar userRole={userRole} collapsed={collapsed} setCollapsed={setCollapsed} />
        </aside>
      )}
      <main className={`flex-1 transition-all duration-300 ${showSidebar ? (collapsed ? 'md:ml-16' : 'md:ml-64') : ''}`}>
        {children}
      </main>
    </div>
  )
}