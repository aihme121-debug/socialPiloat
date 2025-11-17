'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole
  requiredPermission?: string
  fallbackUrl?: string
  loadingComponent?: React.ReactNode
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallbackUrl = '/auth/login',
  loadingComponent,
}: ProtectedRouteProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session?.user) {
      router.push(fallbackUrl)
      return
    }
    
    if (requiredRole && session.user.role !== requiredRole) {
      router.push('/unauthorized')
      return
    }
    
    // Note: Permission checking would require the RBAC utilities
    // This is a simplified version for now
  }, [session, status, router, requiredRole, fallbackUrl])
  
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {loadingComponent || (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        )}
      </div>
    )
  }
  
  if (!session?.user) {
    return null
  }
  
  return <>{children}</>
}