import { Role } from '@/generated/prisma/client';

/**
 * Central environment access. Every value is read through a getter so that
 * `next build` succeeds without a database or an Entra tenant present — a
 * missing variable fails at the point of use, with a clear message, rather than
 * at module import.
 */

function raw(name: string): string | undefined {
  const value = process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function num(name: string, fallback: number): number {
  const value = raw(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type DevUser = {
  email: string;
  displayName: string;
  role: Role;
};

/** Parses `email|Display Name|ROLE` from AUTH_DEV_USER. */
function parseDevUser(value: string): DevUser | null {
  const [email, displayName, role] = value.split('|').map((part) => part.trim());
  if (!email) return null;
  const normalisedRole = (role ?? '').toUpperCase();
  const isRole = (candidate: string): candidate is Role =>
    candidate === Role.ADMIN || candidate === Role.MANAGER || candidate === Role.EMPLOYEE;

  return {
    email: email.toLowerCase(),
    displayName: displayName || email,
    role: isRole(normalisedRole) ? normalisedRole : Role.EMPLOYEE,
  };
}

export const env = {
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },

  get databaseUrl(): string {
    return raw('DATABASE_URL') ?? '';
  },

  get authSecret(): string | undefined {
    return raw('AUTH_SECRET');
  },

  get authUrl(): string {
    return raw('AUTH_URL') ?? 'http://localhost:3000';
  },

  entra: {
    get clientId(): string | undefined {
      return raw('AUTH_MICROSOFT_ENTRA_ID_ID');
    },
    get clientSecret(): string | undefined {
      return raw('AUTH_MICROSOFT_ENTRA_ID_SECRET');
    },
    get issuer(): string | undefined {
      return raw('AUTH_MICROSOFT_ENTRA_ID_ISSUER');
    },
    get isConfigured(): boolean {
      return Boolean(this.clientId && this.clientSecret && this.issuer);
    },
    /**
     * Optional security-group route to roles, for tenants that prefer groups to
     * app roles (FR-SEC-02). Format: `ADMIN:<group-guid>,MANAGER:<group-guid>`.
     */
    get roleGroups(): Array<{ role: Role; groupId: string }> {
      return (raw('ENTRA_ROLE_GROUPS') ?? '')
        .split(',')
        .map((entry) => entry.split(':').map((part) => part.trim()))
        .flatMap(([role, groupId]) => {
          const upper = (role ?? '').toUpperCase();
          if (!groupId) return [];
          if (upper !== Role.ADMIN && upper !== Role.MANAGER && upper !== Role.EMPLOYEE) return [];
          return [{ role: upper as Role, groupId }];
        });
    },
  },

  /** Granted ADMIN on first sign-in so the first admin exists (FR-SEC-04). */
  get adminBootstrapEmails(): string[] {
    return (raw('ADMIN_BOOTSTRAP_EMAILS') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  },

  /**
   * Local development shortcut: signs in as a fixed user so the app is usable
   * without an Entra tenant. Ignored entirely in production.
   */
  get devUser(): DevUser | null {
    if (this.isProduction) return null;
    const value = raw('AUTH_DEV_USER');
    return value ? parseDevUser(value) : null;
  },

  get uploadDir(): string {
    return raw('UPLOAD_DIR') ?? './uploads';
  },

  get maxUploadBytes(): number {
    return num('MAX_UPLOAD_MB', 5) * 1024 * 1024;
  },

  /** Ratings untouched for this long are flagged stale (FR-DSH-04). */
  get staleRatingMonths(): number {
    return num('STALE_RATING_MONTHS', 6);
  },

  /** Fewer than this many people at rating 3+ is a skill gap (FR-DSH-03). */
  get gapMinPeople(): number {
    return num('GAP_MIN_PEOPLE', 2);
  },

  /** Corrections older than this get an extra confirmation (FR-HIS-08). */
  get correctionWarnMonths(): number {
    return num('CORRECTION_WARN_MONTHS', 12);
  },

  get logLevel(): string {
    return raw('LOG_LEVEL') ?? 'info';
  },
};
