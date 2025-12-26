const normalizeEmail = (value: unknown): string => (typeof value === 'string' ? value : '').trim().toLowerCase();

const parseAllowlist = (): string[] =>
  (process.env.ACCESS_ALLOWLIST_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/**
 * Temporary eligibility check.
 * TODO: Replace with Digistore24 webhook-backed eligibility storage.
 */
const isEmailEligible = (email: string): boolean => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const allowlist = parseAllowlist();
  if (allowlist.length === 0) return false;

  return allowlist.includes(normalized);
};

export { isEmailEligible, normalizeEmail, parseAllowlist };

