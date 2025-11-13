/**
 * Cloudflare Worker: NOTAM API Proxy
 *
 * This worker proxies requests to the FAA NOTAM Search API and adds CORS headers
 * to allow browser-based requests from the FAA Crane Viewer application.
 *
 * Deploy to: https://workers.cloudflare.com/
 * Expected URL: https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev
 */

const NOTAM_API_URL = 'https://notams.aim.faa.gov/notamSearch/search';

// Allowed origins - adjust this for your deployment
const ALLOWED_ORIGINS = [
  'https://jeffreyp.github.io',
  'http://localhost:8080',
  'http://localhost:8888',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8888'
];

/**
 * Handle incoming requests
 */
async function handleRequest(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get the request body
    const body = await request.text();

    // Forward the request to the NOTAM API with proper headers
    const notamResponse = await fetch(NOTAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; FAA-Crane-Viewer/1.0)',
        'Referer': 'https://notams.aim.faa.gov/notamSearch/nsapp.html',
        'Origin': 'https://notams.aim.faa.gov'
      },
      body: body
    });

    // Get the response data
    const data = await notamResponse.text();

    // Create response with CORS headers
    const response = new Response(data, {
      status: notamResponse.status,
      statusText: notamResponse.statusText,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(request)
      }
    });

    return response;

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch NOTAMs',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(request)
      }
    });
  }
}

/**
 * Handle CORS preflight requests
 */
function handleCORS(request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCORSHeaders(request),
      'Access-Control-Max-Age': '86400', // 24 hours
    }
  });
}

/**
 * Get CORS headers based on request origin
 */
function getCORSHeaders(request) {
  const origin = request.headers.get('Origin');

  // Check if origin is allowed
  const allowedOrigin = ALLOWED_ORIGINS.find(allowed =>
    origin && origin.startsWith(allowed)
  );

  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'false'
  };
}

// Cloudflare Worker event listener
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
