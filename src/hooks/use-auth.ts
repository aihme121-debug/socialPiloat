'use client'

import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { hasPermission, hasRole } from '@/lib/rbac'

export function useAuth() {
  const { data: session, status } = useSession()
  
  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const user = session?.user
  
  const checkPermission = (permission: string): boolean => {
    if (!user?.role) return false
    return hasPermission(user.role as UserRole, permission)
  }
  
  const checkRole = (requiredRole: UserRole): boolean => {
    if (!user?.role) return false
    return hasRole(user.role as UserRole, requiredRole)
  }
  
  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!user?.role) return false
    return roles.some(role => hasRole(user.role as UserRole, role))
  }
  
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user?.role) return false
    return permissions.every(permission => hasPermission(user.role as UserRole, permission))
  }
  
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user?.role) return false
    return permissions.some(permission => hasPermission(user.role as UserRole, permission))
  }
  
  return {
    user,
    isLoading,
    isAuthenticated,
    role: user?.role as UserRole | undefined,
    tenantId: user?.tenantId,
    businessId: user?.businessId,
    checkPermission,
    checkRole,
    hasAnyRole,
    hasAllPermissions,
    hasAnyPermission,
  }
}