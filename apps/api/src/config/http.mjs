function splitCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCorsOrigins(value = process.env.CORS_ORIGIN) {
  return splitCsv(value);
}

export function buildCorsOriginMatcher(value = process.env.CORS_ORIGIN) {
  const allowedOrigins = parseCorsOrigins(value);

  if (allowedOrigins.length === 0) {
    return true;
  }

  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS_ORIGIN`), false);
  };
}

export function buildSessionCookieOptions(env = process.env) {
  return {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: env.SESSION_COOKIE_SAME_SITE ?? 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: env.SESSION_COOKIE_DOMAIN || undefined,
  };
}
