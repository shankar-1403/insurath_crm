export const ROLES = {
  ADMIN: 'admin',
  MANAGEMENT: 'management',
  SALES: 'sales',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGEMENT]: 'Management',
  [ROLES.SALES]: 'Sales',
}

/** Roles shown on self-service registration (admin accounts are created separately). */
export const REGISTERABLE_ROLES = [ROLES.MANAGEMENT, ROLES.SALES]