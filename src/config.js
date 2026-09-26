/**
 * Configuration for FAA Crane Viewer
 */

/**
 * NOTAM API Proxy URL
 *
 * This is the Cloudflare Worker that proxies requests to the FAA NOTAM API.
 *
 * IMPORTANT: After deploying your Cloudflare Worker, update this URL with your worker's URL.
 *
 * Example: 'https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev'
 *
 * For local testing, you can temporarily set this to null to skip NOTAM fetching.
 *
 * DISABLED (2026-09-25): the FAA retired the legacy notamSearch endpoint this worker
 * proxies (notams.aim.faa.gov/notamSearch) on 2026-04-18 in favor of the new NOTAM
 * Management Service. The old endpoint now returns 403 (Akamai "Access Denied") to
 * every request, including ones sent directly with a real browser User-Agent - it's
 * not fixable via headers/CORS. The old self-serve FAA NOTAM API signup
 * (api.faa.gov/notamapi) is also gone. Re-enable once granted access to the new NMS
 * API (email notams@faa.gov for clientId/clientSecret) and the worker and
 * faaService.js are migrated to it - tracked in beads epic fcv-gyi.
 */
export const NOTAM_PROXY_URL = null;

/**
 * CARTO Basemaps API key
 *
 * Required as of Sept 2026 for CARTO's free raster tile endpoint (basemaps.cartocdn.com).
 * Get a free key at https://carto.com/basemaps/apikey and restrict it to this site's
 * domain in the CARTO dashboard so a copied key can't be reused elsewhere.
 *
 * Injected at build time from the CARTO_API_KEY env var (webpack.config.js) - never
 * hardcode the key value here.
 */
export const CARTO_API_KEY = process.env.CARTO_API_KEY || '';

/**
 * NOTAM search configuration
 */
export const NOTAM_CONFIG = {
  // Maximum radius to search for NOTAMs (nautical miles)
  // Larger values may result in more NOTAMs but slower response times
  maxRadius: 100,

  // Timeout for NOTAM API requests (milliseconds)
  timeout: 10000,

  // Whether to retry failed NOTAM requests
  retryOnFailure: true,

  // Number of retry attempts
  maxRetries: 2,

  // Delay between retries (milliseconds)
  retryDelay: 1000
};

/**
 * Data source configuration
 */
export const DATA_SOURCES = {
  dof: {
    enabled: true,
    path: 'data/datafile.csv',
    name: 'Digital Obstacle File'
  },
  part77: {
    enabled: true,
    path: 'data/part77-data.csv',
    name: 'Part 77 Regional Data'
  },
  notams: {
    enabled: !!NOTAM_PROXY_URL, // Automatically enable if proxy URL is set
    name: 'NOTAMs (Real-time)'
  }
};
