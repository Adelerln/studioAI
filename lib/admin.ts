import type { User } from '@supabase/supabase-js';

const ADMIN_ROLE_KEYS = new Set(['admin', 'owner', 'superuser']);

function parseAdminEmails(): string[] {
  const raw = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? '').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: Pick<User, 'email' | 'user_metadata' | 'app_metadata'> | null | undefined): boolean {
  if (!user) {
    return false;
  }

  const metadataRole = (user.user_metadata as Record<string, unknown> | undefined)?.role;
  if (typeof metadataRole === 'string' && ADMIN_ROLE_KEYS.has(metadataRole.toLowerCase())) {
    return true;
  }

  const metadataFlag = (user.user_metadata as Record<string, unknown> | undefined)?.is_admin;
  if (metadataFlag === true) {
    return true;
  }

  const appRoles = (user.app_metadata as Record<string, unknown> | undefined)?.roles;
  if (Array.isArray(appRoles)) {
    if (appRoles.some((role) => typeof role === 'string' && ADMIN_ROLE_KEYS.has(role.toLowerCase()))) {
      return true;
    }
  } else if (typeof appRoles === 'string' && ADMIN_ROLE_KEYS.has(appRoles.toLowerCase())) {
    return true;
  }

  const allowedEmails = parseAdminEmails();
  if (allowedEmails.length > 0 && user.email) {
    return allowedEmails.includes(user.email.toLowerCase());
  }

  return false;
}

