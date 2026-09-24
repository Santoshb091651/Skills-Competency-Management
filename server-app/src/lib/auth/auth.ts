import NextAuth, { type NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { provisionSignedInUser } from '@/lib/auth/provision';

/**
 * Auth.js (NextAuth v5) configuration for Microsoft Entra ID single sign-on
 * (FR-SEC-01). The provider is registered only when credentials are present, so
 * a developer without a tenant can still run the app using AUTH_DEV_USER.
 *
 * Roles are resolved once at sign-in and the resulting AppUser id is carried in
 * the JWT, which keeps per-request cost to a single indexed lookup.
 */

const providers: NextAuthConfig['providers'] = [];

if (env.entra.isConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: env.entra.clientId!,
      clientSecret: env.entra.clientSecret!,
      issuer: env.entra.issuer!,
      authorization: { params: { scope: 'openid profile email User.Read' } },
    }),
  );
} else {
  logger.warn('Entra ID is not configured; SSO is disabled', {
    hint: 'set AUTH_MICROSOFT_ENTRA_ID_* or use AUTH_DEV_USER for local development',
  });
}

/** Claims we care about from the Entra ID token. */
type EntraProfile = {
  oid?: string;
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
};

export const authConfig: NextAuthConfig = {
  providers,
  secret: env.authSecret,
  trustHost: true,
  session: {
    strategy: 'jwt',
    // 8 hours of inactivity (FR-SEC-07).
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  callbacks: {
    async jwt({ token, profile }) {
      // `profile` is only present on the sign-in request itself.
      if (profile) {
        const entra = profile as EntraProfile;
        const email = (entra.email ?? entra.preferred_username ?? token.email ?? '').toLowerCase();

        if (email) {
          try {
            const appUserId = await provisionSignedInUser({
              entraObjectId: entra.oid ?? entra.sub ?? null,
              email,
              displayName: entra.name ?? email,
              claims: { roles: entra.roles, groups: entra.groups },
            });
            token.appUserId = appUserId;
            token.email = email;
          } catch (error) {
            // Never block sign-in on a provisioning failure; the request will
            // simply resolve to no current user and the UI will say so.
            logger.error('failed to provision user at sign-in', {
              email,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.appUserId && session.user) {
        // Surfaced so getCurrentUser() can resolve without re-reading claims.
        (session.user as { appUserId?: string }).appUserId = token.appUserId as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
