const normalizeEmail = (value: unknown): string => (typeof value === 'string' ? value : '').trim().toLowerCase();

const parseAdminEmail = (): string =>
  (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();

const parseAllowlist = (): string[] =>
  (process.env.ACCESS_ALLOWLIST_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/**
 * Check if email is the configured admin.
 */
const isAdminEmail = (email: string): boolean => {
  const normalized = normalizeEmail(email);
  const adminEmail = parseAdminEmail();
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
  if (isAdminEmail(normalized)) return true;

  const allowlist = parseAllowlist();
  if (allowlist.length === 0) return false;

  return allowlist.includes(normalized);
};

export { isEmailEligible, isAdminEmail, normalizeEmail, parseAllowlist };

