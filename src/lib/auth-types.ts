import { $Enums } from '@prisma/client'

export type UserRole = $Enums.UserRole

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  avatar: string | null
  role: UserRole
  isActive: boolean
  tenantId: string
  businessId: string | null
  lastLogin: Date | null
  createdAt: Date
  updatedAt: Date
}