/**
 * Configuration for FAA Crane Viewer
 */

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
    enabled: true,
    // Refreshed every few hours by scripts/update_notam_data.py
    path: 'data/notam-cranes.json',
    name: 'NOTAMs'
  }
};
