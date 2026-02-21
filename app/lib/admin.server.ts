import 'server-only';

import { normalizeEmail } from '@/app/lib/access';

const parseAdminEmailServer = (): string => (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

export const isAdminEmailServer = (email: string | null | undefined): boolean => {
  const adminEmail = parseAdminEmailServer();
  if (!adminEmail) return false;
  return normalizeEmail(email) === adminEmail;
};

