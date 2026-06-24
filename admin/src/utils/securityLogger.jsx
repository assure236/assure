const isDev = process.env.NODE_ENV !== 'production';

const redact = (value) => {
  if (!value) return value;
  const text = String(value);
  return text
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(token|password|secret|authorization)["']?\s*[:=]\s*["'][^"']+["']/gi, '$1:"[REDACTED]"');
};

export const securityLogger = {
  // SECURITY FIX: no-op logging in production and redact sensitive values in dev.
  error: (message, meta) => {
    if (!isDev) return;
    console.error(redact(message), meta ? redact(JSON.stringify(meta)) : undefined);
  },
};
