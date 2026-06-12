/**
 * PROTECTED TENANTS & USERS
 * ─────────────────────────────────────────────────────────────────
 * These tenants and user IDs must NEVER be deleted, demoted, or
 * have their tenant reassigned by any bulk migration or API call.
 *
 * nash@pixwik.com  → auth UUID: c19202d7-9967-468d-bf87-0f90815024b1
 * joshua@pixwik.com→ auth UUID: 93501087-9d35-48f6-8525-cbff6a28d832
 * ─────────────────────────────────────────────────────────────────
 */

export const PROTECTED_TENANT_ID = 'nash-pixwik-admin';

export const PROTECTED_USER_IDS = new Set([
  'c19202d7-9967-468d-bf87-0f90815024b1', // nash@pixwik.com  (super admin)
  '93501087-9d35-48f6-8525-cbff6a28d832', // joshua@pixwik.com (admin)
]);

export const PROTECTED_EMAILS = new Set([
  'nash@pixwik.com',
  'joshua@pixwik.com',
]);

/**
 * Returns true if this user ID is protected and must not be deleted or demoted.
 */
export function isProtectedUser(userId: string): boolean {
  return PROTECTED_USER_IDS.has(userId);
}

/**
 * Returns true if this tenant ID is protected and must not be bulk-modified.
 */
export function isProtectedTenant(tenantId: string): boolean {
  return tenantId === PROTECTED_TENANT_ID;
}

/**
 * Throws an error if the userId is protected — use before any destructive operation.
 */
export function assertNotProtected(userId: string, operation = 'modify'): void {
  if (isProtectedUser(userId)) {
    throw new Error(
      `[PROTECTED] Cannot ${operation} user ${userId}. This account is a system owner and is protected from modification.`
    );
  }
}
