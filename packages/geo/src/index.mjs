/**
 * @smx/geo — IP-to-country/region resolver
 *
 * In production, back this with a MaxMind GeoLite2 binary DB.
 * Requires the env var: GEOIP_DB_PATH=/path/to/GeoLite2-City.mmdb
 *
 * Falls back to a no-op resolver if the DB file is absent (development).
 */

import fs   from 'node:fs';
import path from 'node:path';

let Reader = null; // lazy import of @maxmind/geoip2-node

async function getReader() {
  if (Reader) return Reader;
  const dbPath = process.env.GEOIP_DB_PATH;
  if (!dbPath || !fs.existsSync(dbPath)) {
    return null; // DB not configured — return null resolver
  }
  try {
    const { WebServiceClient, Reader: R } = await import('@maxmind/geoip2-node');
    void WebServiceClient; // imported for side-effects only
    Reader = await R.open(dbPath);
    return Reader;
  } catch {
    return null;
  }
}

/**
 * @typedef {object} GeoResult
 * @property {string} ip
 * @property {string|null} country  - ISO 3166-1 alpha-2
 * @property {string|null} region   - ISO 3166-2 subdivision code
 * @property {string|null} city
 * @property {number|null} latitude
 * @property {number|null} longitude
 */

/**
 * Resolve an IP address to geographic coordinates.
 * Returns nulls for all fields if the DB is unavailable or the IP is unrecognised.
 *
 * @param {string} ip
 * @returns {Promise<GeoResult>}
 */
export async function resolveIp(ip) {
  const fallback = { ip, country: null, region: null, city: null, latitude: null, longitude: null };

  // Skip private / loopback addresses
  if (isPrivateIp(ip)) return fallback;

  const reader = await getReader();
  if (!reader) return fallback;

  try {
    const response = reader.city(ip);
    return {
      ip,
      country:   response.country?.isoCode   ?? null,
      region:    response.subdivisions?.[0]?.isoCode ?? null,
      city:      response.city?.names?.en     ?? null,
      latitude:  response.location?.latitude  ?? null,
      longitude: response.location?.longitude ?? null,
    };
  } catch {
    return fallback;
  }
}

/**
 * Extract the real client IP from a Fastify request object, respecting
 * X-Forwarded-For when running behind a proxy.
 *
 * @param {object} req - Fastify request
 * @returns {string}
 */
export function extractIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip ?? '0.0.0.0';
}

// ── helpers ────────────────────────────────────────────────────────────────

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateIp(ip) {
  return PRIVATE_RANGES.some(re => re.test(ip));
}
