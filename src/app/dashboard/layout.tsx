'use client'

import { DashboardNav } from '@/components/dashboard/dashboard-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      <DashboardNav />
      <main className="flex-1 min-w-0 overflow-auto relative">
        {/* Background gradient layer */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900" />
        <div className="relative z-0">
          {children}
        </div>
      </main>
    </div>
  )
}