import { AuditAction, Role } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { resolveRoleFromClaims, type RoleClaims } from '@/lib/auth/roles';

/**
 * Creates or refreshes the AppUser row for someone who has just signed in, and
 * links them to their Employee record by email where one exists (FR-SEC-06).
 *
 * An Admin's in-app role override is respected: once `app_user.role` has been
 * set deliberately, a later sign-in does not overwrite it with the claim value.
 * The only exception is a bootstrap admin email, which always wins so access
 * cannot be locked out.
 */
export async function provisionSignedInUser(input: {
  entraObjectId: string | null;
  email: string;
  displayName: string;
  claims?: Pick<RoleClaims, 'roles' | 'groups'>;
  /** Forces the role, used only by the local development sign-in. */
  forceRole?: Role;
}): Promise<string> {
  const email = input.email.toLowerCase();
  const claimedRole =
    input.forceRole ??
    resolveRoleFromClaims({ email, roles: input.claims?.roles, groups: input.claims?.groups });

  const employee = await prisma.employee.findUnique({
    where: { email },
    select: { id: true },
  });

  const existing = await prisma.appUser.findUnique({
    where: { email },
    select: { id: true, role: true, employeeId: true },
  });

  if (!existing) {
    const created = await prisma.appUser.create({
      data: {
        entraObjectId: input.entraObjectId,
        email,
        displayName: input.displayName,
        role: claimedRole,
        employeeId: employee?.id ?? null,
        lastLoginAt: new Date(),
      },
      select: { id: true },
    });

    logger.info('provisioned new app user', { email, role: claimedRole });
    return created.id;
  }

  // Keep an existing deliberate role unless the claim is more privileged than
  // EMPLOYEE, which means the directory is now the authority for this person.
  const nextRole =
    input.forceRole ?? (claimedRole === Role.EMPLOYEE ? existing.role : claimedRole);

  const roleChanged = nextRole !== existing.role;

  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: existing.id },
      data: {
        entraObjectId: input.entraObjectId ?? undefined,
        displayName: input.displayName,
        role: nextRole,
        // Only fill the link; never unlink an established one automatically.
        employeeId: existing.employeeId ?? employee?.id ?? null,
        lastLoginAt: new Date(),
      },
    });

    if (roleChanged) {
      await tx.auditEvent.create({
        data: {
          actorUserId: existing.id,
          actorRole: nextRole,
          action: AuditAction.ROLE_CHANGED,
          entityType: 'AppUser',
          entityId: existing.id,
          beforeState: { role: existing.role },
          afterState: { role: nextRole },
          reason: 'Role resolved from Entra ID claims at sign-in',
        },
      });
    }
  });

  return existing.id;
}
