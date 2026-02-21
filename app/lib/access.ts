const normalizeEmail = (value: unknown): string => (typeof value === 'string' ? value : '').trim().toLowerCase();

export { normalizeEmail };

