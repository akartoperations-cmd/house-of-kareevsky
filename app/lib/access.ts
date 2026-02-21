const normalizeEmail = (value: unknown): string => (typeof value === 'string' ? value : '').trim().toLowerCase();

const parseAdminEmailServer = (): string => (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const parseAdminEmailClient = (): string => (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();

const parseAllowlist = (): string[] =>
  (process.env.ACCESS_ALLOWLIST_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/**
 * Server-only admin check.
 * - Only `ADMIN_EMAIL` grants admin rights.
 * - `NEXT_PUBLIC_*` must never affect server authorization.
 */
const isAdminEmailServer = (email: string | null | undefined): boolean => {
  if (typeof window !== 'undefined') return false;
  const adminEmail = parseAdminEmailServer();
  if (!adminEmail) return false;
  const normalized = (email || '').trim().toLowerCase();
  return normalized === adminEmail;
};

/**
 * Client-side helper for UI hints only.
 */
const isAdminEmailClient = (email: string): boolean => {
  const normalized = normalizeEmail(email);
  const adminEmail = parseAdminEmailClient();
  return Boolean(adminEmail) && normalized === adminEmail;
};

/**
 * Temporary eligibility check.
 * Admin is always eligible. Others checked against allowlist.
 * TODO: Replace allowlist with Digistore24 webhook-backed eligibility storage.
 */
const isEmailEligible = (email: string): boolean => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  // Admin is always eligible
  if (isAdminEmailServer(normalized)) return true;

  const allowlist = parseAllowlist();
  if (allowlist.length === 0) return false;

  return allowlist.includes(normalized);
};

export { isAdminEmailServer, isAdminEmailClient, isEmailEligible, normalizeEmail, parseAllowlist };

