export const UserRole = {
  ADMIN: 'admin',
  STAFF: 'staff',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const USER_ROLE_VALUES = Object.values(UserRole)

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.STAFF]: 'Staff',
}
