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
 */
export const NOTAM_PROXY_URL = 'https://faa-notam-proxy.jeffreyp07.workers.dev';

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
