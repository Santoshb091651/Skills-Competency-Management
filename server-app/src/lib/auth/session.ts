import { cache } from 'react';
import { redirect } from 'next/navigation';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { UnauthenticatedError } from '@/lib/errors';
import { auth } from '@/lib/auth/auth';
import { provisionSignedInUser } from '@/lib/auth/provision';

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  orgWideWrite: boolean;
  /** The Employee record this user is, when the email matched one. */
  employeeId: string | null;
  employeeName: string | null;
  /** True when signed in through the local development bypass. */
  isDevSession: boolean;
};

const SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  orgWideWrite: true,
  employeeId: true,
  isActive: true,
  employee: { select: { fullName: true } },
} as const;

/**
 * Resolves the signed-in user for the current request.
 *
 * `cache` de-duplicates within a single render pass, so a page and its nested
 * server components share one database read.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const devUser = env.devUser;

  if (devUser) {
    // Local development without an Entra tenant. Guarded by env.devUser, which
    // always returns null when NODE_ENV is production.
    const id = await provisionSignedInUser({
      entraObjectId: null,
      email: devUser.email,
      displayName: devUser.displayName,
      forceRole: devUser.role,
    });

    const record = await prisma.appUser.findUnique({ where: { id }, select: SELECT });
    return record ? toCurrentUser(record, true) : null;
  }

  const session = await auth();
  const appUserId = (session?.user as { appUserId?: string } | undefined)?.appUserId;
  const email = session?.user?.email?.toLowerCase();

  const record = appUserId
    ? await prisma.appUser.findUnique({ where: { id: appUserId }, select: SELECT })
    : email
      ? await prisma.appUser.findUnique({ where: { email }, select: SELECT })
      : null;

  if (!record || !record.isActive) return null;
  return toCurrentUser(record, false);
});

type AppUserRecord = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  orgWideWrite: boolean;
  employeeId: string | null;
  isActive: boolean;
  employee: { fullName: string } | null;
};

function toCurrentUser(record: AppUserRecord, isDevSession: boolean): CurrentUser {
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    role: record.role,
    orgWideWrite: record.orgWideWrite,
    employeeId: record.employeeId,
    employeeName: record.employee?.fullName ?? null,
    isDevSession,
  };
}

/** For pages: sends the visitor to sign-in when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return user;
}

/** For route handlers: throws, so the error contract produces a 401. */
export async function requireUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}
