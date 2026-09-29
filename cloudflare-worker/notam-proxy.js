/**
 * Cloudflare Worker: NOTAM API Proxy (FAA NOTAM Management Service)
 *
 * Proxies point+radius NOTAM queries from the FAA Crane Viewer to the FAA NMS API
 * (NMS-API v1), which uses OAuth2 client credentials. The browser never sees the
 * credentials; they live only in Worker secrets:
 *
 *   wrangler secret put NMS_CLIENT_ID      # "KEY" from the NMS onboarding spreadsheet
 *   wrangler secret put NMS_CLIENT_SECRET  # "SECRET" from the NMS onboarding spreadsheet
 *
 * Optional plain var (wrangler.toml [vars]) selecting the NMS environment:
 *   NMS_HOST = https://api-staging.cgifederal-aim.com   (staging / pre-prod, default)
 *            | https://api-nms.aim.faa.gov              (production, after FAA sign-off)
 *
 * Request:  GET /?lat=47.6&lng=-122.3&radius=5   (radius in nautical miles, max 100)
 * Response: { status, features: [GeoJSON NOTAM features that mention CRANE] }
 */

const DEFAULT_NMS_HOST = 'https://api-staging.cgifederal-aim.com';
const MAX_RADIUS_NM = 100;
// Responses are cached at the edge; coordinates are rounded so nearby searches share entries
const CACHE_TTL_SECONDS = 300;
const COORD_PRECISION = 3;
// Workers send no User-Agent by default, which the FAA's gateway rejects with a 403
const USER_AGENT = 'FAA-Crane-Viewer/1.0 (+https://jeffreyp.github.io/faa-crane-viewer)';

// Allowed origins - adjust this for your deployment
const ALLOWED_ORIGINS = [
  'https://jeffreyp.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8888',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8888'
];

// Bearer token cached per Worker isolate
let cachedToken = null;
let cachedTokenExpiresAt = 0;

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    if (request.method !== 'GET') {
      return jsonResponse(request, { error: 'Method not allowed' }, 405);
    }

    if (!env.NMS_CLIENT_ID || !env.NMS_CLIENT_SECRET) {
      return jsonResponse(request, { error: 'NMS credentials are not configured' }, 500);
    }

    const params = parseQuery(new URL(request.url));
    if (params.error) {
      return jsonResponse(request, { error: params.error }, 400);
    }

    // Edge cache keyed on the normalized query only
    const cacheKey = new Request(
      `https://notam-cache.internal/?lat=${params.lat}&lng=${params.lng}&radius=${params.radius}`
    );
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCORS(request, cached);
    }

    try {
      const features = await fetchCraneNotams(env, params);
      const response = new Response(JSON.stringify({ status: 'Success', features }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
        }
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return withCORS(request, response);
    } catch (error) {
      return jsonResponse(request, { error: 'Failed to fetch NOTAMs', message: error.message }, 502);
    }
  }
};

/**
 * Validate and normalize lat/lng/radius query parameters
 */
function parseQuery(url) {
  const lat = parseFloat(url.searchParams.get('lat'));
  const lng = parseFloat(url.searchParams.get('lng'));
  const radius = parseFloat(url.searchParams.get('radius'));

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: 'lat must be a number between -90 and 90' };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { error: 'lng must be a number between -180 and 180' };
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    return { error: 'radius must be a positive number of nautical miles' };
  }

  return {
    lat: lat.toFixed(COORD_PRECISION),
    lng: lng.toFixed(COORD_PRECISION),
    radius: Math.min(radius, MAX_RADIUS_NM).toString()
  };
}

/**
 * Query NMS for active NOTAMs around a point and keep only crane-related ones.
 * NMS returns the full result set in one response (no paging).
 */
async function fetchCraneNotams(env, { lat, lng, radius }) {
  const host = env.NMS_HOST || DEFAULT_NMS_HOST;
  const url = `${host}/nmsapi/v1/notams?latitude=${lat}&longitude=${lng}&radius=${radius}`;

  let response = await nmsGet(env, url);
  if (response.status === 401) {
    // Token may have been revoked or expired early; retry once with a fresh one
    cachedToken = null;
    response = await nmsGet(env, url);
  }

  if (!response.ok) {
    await logErrorBody('NMS notams request', response);
    throw new Error(`NMS returned ${response.status}`);
  }

  const body = await response.json();
  if (body.status !== 'Success') {
    const detail = (body.errors || []).map(e => e.message).join('; ');
    throw new Error(`NMS request failed${detail ? `: ${detail}` : ''}`);
  }

  const features = body.data?.geojson || [];
  // Pre-filter here to keep the browser payload small; the client applies the full filter
  return features.filter(feature => {
    const notam = feature?.properties?.coreNOTAMData?.notam;
    return notam && /CRANE/i.test(notam.text || '');
  });
}

async function nmsGet(env, url) {
  const token = await getAccessToken(env);
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      nmsResponseFormat: 'GEOJSON',
      Accept: 'application/json',
      'User-Agent': USER_AGENT
    }
  });
}

/**
 * Get an OAuth2 bearer token via the client credentials grant, cached until
 * shortly before it expires (NMS tokens last ~30 minutes).
 */
async function getAccessToken(env) {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const host = env.NMS_HOST || DEFAULT_NMS_HOST;
  // Trim in case stray whitespace was pasted into the secrets
  const credentials = `${env.NMS_CLIENT_ID.trim()}:${env.NMS_CLIENT_SECRET.trim()}`;
  const response = await fetch(`${host}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      Authorization: `Basic ${btoa(credentials)}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    await logErrorBody('NMS token request', response);
    throw new Error(`NMS token request returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('NMS token response did not include an access_token');
  }

  const expiresInSeconds = parseInt(data.expires_in, 10) || 1799;
  cachedToken = data.access_token;
  // Refresh a minute early to avoid using a token that expires mid-request
  cachedTokenExpiresAt = Date.now() + Math.max(expiresInSeconds - 60, 30) * 1000;
  return cachedToken;
}

/**
 * Log an upstream error body for `wrangler tail`; it is never returned to the browser
 */
async function logErrorBody(label, response) {
  const body = await response.text().catch(() => '');
  console.error(`${label} returned ${response.status}: ${body.slice(0, 500)}`);
}

function jsonResponse(request, body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders(request)
    }
  });
}

function withCORS(request, response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(getCORSHeaders(request))) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCORSHeaders(request),
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  });
}

/**
 * Get CORS headers based on request origin
 */
function getCORSHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = ALLOWED_ORIGINS.find(allowed => origin === allowed);

  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Vary': 'Origin'
  };
}
