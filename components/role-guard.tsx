"use client"

import type { ReactNode } from "react"

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: string[]
  userRole?: string
  fallback?: ReactNode
}

export function RoleGuard({ children, allowedRoles, userRole = "Admin", fallback = null }: RoleGuardProps) {
  if (!allowedRoles.includes(userRole)) {
    return fallback
  }

  return <>{children}</>
}
