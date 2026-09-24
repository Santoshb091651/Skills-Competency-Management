import { cache } from 'react';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError } from '@/lib/errors';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';

/**
 * Read and write reach for the current request (ARCHITECTURE.md section 8.2).
 *
 * `writableEmployeeIds` is:
 *   - 'ALL'  for an Admin, or a Manager with the org-wide override
 *   - a Set  for a Manager, holding their whole reporting line
 *   - null   for an Employee, who can never write
 */
export type Scope = {
  user: CurrentUser;
  role: Role;
  writableEmployeeIds: 'ALL' | Set<string> | null;
};

/**
 * Every employee below this manager in the reporting tree, direct and indirect.
 * A recursive CTE is used rather than repeated queries because the depth is not
 * known, and `UNION` (not `UNION ALL`) makes it terminate even if bad data ever
 * produced a cycle.
 */
async function reportingLine(managerEmployeeId: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE line AS (
      SELECT id
      FROM   employee
      WHERE  manager_id = ${managerEmployeeId}::uuid

      UNION

      SELECT e.id
      FROM   employee e
      JOIN   line l ON e.manager_id = l.id
    )
    SELECT id FROM line
  `;

  const ids = new Set(rows.map((row) => row.id));
  // A manager may maintain their own record too.
  ids.add(managerEmployeeId);
  return ids;
}

export const resolveScope = cache(async (): Promise<Scope | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.role === Role.ADMIN) {
    return { user, role: user.role, writableEmployeeIds: 'ALL' };
  }

  if (user.role === Role.MANAGER) {
    if (user.orgWideWrite) {
      return { user, role: user.role, writableEmployeeIds: 'ALL' };
    }
    // A manager not linked to an employee record has no reporting line to
    // derive, so they get read-only access until an Admin links or overrides.
    const writable = user.employeeId ? await reportingLine(user.employeeId) : new Set<string>();
    return { user, role: user.role, writableEmployeeIds: writable };
  }

  return { user, role: user.role, writableEmployeeIds: null };
});

export async function requireScope(): Promise<Scope> {
  const scope = await resolveScope();
  if (!scope) throw new ForbiddenError('Sign-in required');
  return scope;
}

export function isAdmin(scope: Scope): boolean {
  return scope.role === Role.ADMIN;
}

/** Catalog entries may be created by managers as well as admins (FR-CAT-04). */
export function canEditCatalog(scope: Scope): boolean {
  return scope.role === Role.ADMIN || scope.role === Role.MANAGER;
}

export function canWrite(scope: Scope, employeeId: string): boolean {
  if (scope.writableEmployeeIds === 'ALL') return true;
  if (scope.writableEmployeeIds === null) return false;
  return scope.writableEmployeeIds.has(employeeId);
}

/**
 * The single assertion every mutating service starts with. Hiding a button in
 * the UI is a convenience; this is the control (FR-SEC-05, AC-9, AC-10).
 */
export function assertCanWrite(scope: Scope, employeeId: string): void {
  if (!canWrite(scope, employeeId)) {
    throw new ForbiddenError('You cannot change skills for this employee');
  }
}

export function assertAdmin(scope: Scope): void {
  if (!isAdmin(scope)) {
    throw new ForbiddenError('This action is restricted to administrators');
  }
}

export function assertCanEditCatalog(scope: Scope): void {
  if (!canEditCatalog(scope)) {
    throw new ForbiddenError('This action is restricted to managers and administrators');
  }
}

/**
 * History, assessment notes, and personal trends are private: visible for your
 * own record, for an Admin, and for a Manager over their scope (FR-SEC section 3.2).
 */
export function canReadHistory(scope: Scope, employeeId: string): boolean {
  if (scope.user.employeeId === employeeId) return true;
  if (scope.role === Role.ADMIN) return true;
  if (scope.role === Role.MANAGER) return canWrite(scope, employeeId);
  return false;
}

export function assertCanReadHistory(scope: Scope, employeeId: string): void {
  if (!canReadHistory(scope, employeeId)) {
    throw new ForbiddenError('You cannot view the history for this employee');
  }
}
