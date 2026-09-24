import { Role } from '@/generated/prisma/client';
import { env } from '@/lib/env';

/**
 * Role resolution from Entra ID claims (FR-SEC-02, FR-SEC-03).
 *
 * Precedence, highest first:
 *   1. An in-app Admin override on app_user.role — applied by the caller, not here.
 *   2. ADMIN_BOOTSTRAP_EMAILS, so the first admin can exist before any role
 *      assignment is possible.
 *   3. The `roles` claim (Entra app roles).
 *   4. Security group membership, where ENTRA_ROLE_GROUPS is configured.
 *   5. EMPLOYEE by default — a signed-in user with no mapping still gets
 *      read-only access rather than an error.
 */

/** Entra app role values, matched case-insensitively. */
const APP_ROLE_NAMES: Record<string, Role> = {
  'skills.admin': Role.ADMIN,
  'skills.manager': Role.MANAGER,
  'skills.employee': Role.EMPLOYEE,
  admin: Role.ADMIN,
  manager: Role.MANAGER,
  employee: Role.EMPLOYEE,
};

const PRECEDENCE: Record<Role, number> = {
  [Role.ADMIN]: 3,
  [Role.MANAGER]: 2,
  [Role.EMPLOYEE]: 1,
};

/** When a user carries several mappings, the most privileged one wins. */
function highest(roles: Role[]): Role | null {
  return roles.reduce<Role | null>(
    (best, candidate) =>
      best === null || PRECEDENCE[candidate] > PRECEDENCE[best] ? candidate : best,
    null,
  );
}

export type RoleClaims = {
  email: string;
  roles?: string[];
  groups?: string[];
};

export function resolveRoleFromClaims(claims: RoleClaims): Role {
  const email = claims.email.toLowerCase();

  if (env.adminBootstrapEmails.includes(email)) {
    return Role.ADMIN;
  }

  const fromAppRoles = (claims.roles ?? [])
    .map((name) => APP_ROLE_NAMES[name.trim().toLowerCase()])
    .filter((role): role is Role => Boolean(role));

  const appRole = highest(fromAppRoles);
  if (appRole) return appRole;

  const groupIds = new Set(claims.groups ?? []);
  const fromGroups = env.entra.roleGroups
    .filter((mapping) => groupIds.has(mapping.groupId))
    .map((mapping) => mapping.role);

  return highest(fromGroups) ?? Role.EMPLOYEE;
}
