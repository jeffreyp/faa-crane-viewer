// Real FAA crane data parser for CSV files from OE/AAA system
import Papa from 'papaparse';
import { NOTAM_PROXY_URL, NOTAM_CONFIG } from '../config';
import { getCachedDataset, setCachedDataset } from '../utils/cache';

// Constants - using direct absolute path for webpack dev server
const DOF_CSV_PATH = 'data/datafile.csv';
const PART77_CSV_PATH = 'data/part77-data.csv';

// Parsed-data cache settings
// Bump CACHE_VERSION whenever the parsed crane object shape changes
const CACHE_VERSION = 1;
// Skip the network entirely if the cache was validated this recently (matches GitHub Pages max-age)
const REVALIDATE_INTERVAL_MS = 10 * 60 * 1000;
// Discard cached data older than this even if the server says it is unchanged
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
// When the server can't be reached, fall back to cached data no older than this
const MAX_STALE_FALLBACK_MS = 3 * 24 * 60 * 60 * 1000;

// In-memory copy of cache entries so repeat searches skip IndexedDB too
const memoryCache = new Map();
// In-flight loads, so concurrent searches share a single fetch/parse
const inflightLoads = new Map();

// Web Worker support detection and pool management
let workerSupported = false;
let workerPool = [];
let workerId = 0;

// Check if Web Workers are supported
try {
  if (typeof Worker !== 'undefined') {
    workerSupported = true;
    console.log('Web Workers supported - CSV parsing will run in background');
  }
} catch (e) {
  console.warn('Web Workers not supported - CSV parsing will run on main thread');
}

// Create a worker from the worker pool or create a new one
const getWorker = () => {
  if (!workerSupported) {
    return null;
  }

  try {
    // Create worker using Webpack 5's native support
    const worker = new Worker(new URL('../workers/csvParser.worker.js', import.meta.url));
    workerPool.push(worker);
    return worker;
  } catch (error) {
    console.error('Failed to create Web Worker:', error);
    workerSupported = false;
    return null;
  }
};

// Terminate all workers in the pool
const terminateWorkers = () => {
  workerPool.forEach(worker => worker.terminate());
  workerPool = [];
};

// Parse CSV data using Web Worker (non-blocking)
const parseCSVDataWithWorker = async (csvData, dataSource) => {
  return new Promise((resolve, reject) => {
    const worker = getWorker();

    if (!worker) {
      // Fallback to main thread if worker creation failed
      console.warn('Worker unavailable, falling back to main thread parsing');
      return parseCSVData(csvData).then(resolve).catch(reject);
    }

    const currentWorkerId = workerId++;
    let progressCallback = null;

    // Set up message handler
    const messageHandler = (event) => {
      const { type, id, data, error, message } = event.data;

      if (id !== currentWorkerId) {
        // Ignore messages from other workers
        return;
      }

      if (type === 'progress') {
        // Progress update
        console.log(`[Worker ${dataSource}] ${message}`);
        if (progressCallback) {
          progressCallback(message);
        }
      } else if (type === 'complete') {
        // Parsing complete
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        resolve(data);
      } else if (type === 'error') {
        // Error in worker
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
        console.error(`Worker error for ${dataSource}:`, error);
        // Fallback to main thread
        console.log('Falling back to main thread parsing');
        parseCSVData(csvData).then(resolve).catch(reject);
      }
    };

    // Set up error handler
    const errorHandler = (error) => {
      worker.removeEventListener('message', messageHandler);
      worker.removeEventListener('error', errorHandler);
      console.error('Worker error:', error);
      // Fallback to main thread
      console.log('Falling back to main thread parsing');
      parseCSVData(csvData).then(resolve).catch(reject);
    };

    worker.addEventListener('message', messageHandler);
    worker.addEventListener('error', errorHandler);

    // Send CSV data to worker
    worker.postMessage({
      id: currentWorkerId,
      csvData,
      dataSource
    });
  });
};

// Convert DMS (Degrees-Minutes-Seconds) to decimal degrees or return decimal if already in decimal format
const coordinateToDecimal = (coordStr) => {
  if (!coordStr) return null;
  
  // Check if it's already a decimal number (Part77 format)
  const decimal = parseFloat(coordStr);
  if (!isNaN(decimal) && (coordStr.match(/^-?\d+(\.\d+)?$/) || coordStr.match(/^-?\d+$/))) {
    return decimal;
  }
  
  // Handle DMS format: "33 - 27 - 28.73 N"
  const parts = coordStr.split('-').map(part => part.trim());
  if (parts.length !== 3) return null;
  
  const degrees = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  
  // Last part contains seconds and direction (N/S/E/W)
  const secondsParts = parts[2].split(' ');
  const seconds = parseFloat(secondsParts[0]);
  const direction = secondsParts[1];
  
  // Calculate decimal degrees
  let result = degrees + (minutes / 60) + (seconds / 3600);
  
  // Adjust sign based on direction
  if (direction === 'S' || direction === 'W') {
    result = -result;
  }
  
  return result;
};

/**
 * Parse CSV date format (YYYY-MM-DD) to JavaScript Date object
 * @param {string} dateStr - Date string in CSV format
 * @returns {Date|null} Parsed Date object or null if invalid
 */
const parseCSVDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return null;
  }

  // CSV format: "YYYY-MM-DD"
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  // Create date in UTC to avoid timezone issues
  // Note: month is 0-indexed in JavaScript Date constructor
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,  // Convert to 0-indexed month
    parseInt(day),
    0, 0, 0, 0
  ));

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// Parse CSV data and return crane data
const parseCSVData = async (csvData) => {
  return new Promise((resolve) => {
    Papa.parse(csvData, {
      header: true,
      transformHeader: header => header.trim(),
      complete: (results) => {
        console.log(`CSV parsed, total rows: ${results.data.length}`);

        const now = new Date();

        // Filter for crane entries - handle both DOF and Part77 formats
        const craneData = results.data.filter(entry => {
          // DOF format: Look for entries with "CRANE" in the STRUCTURE TYPE field
          if (entry['STRUCTURE TYPE'] &&
              entry['STRUCTURE TYPE'].toUpperCase().includes('CRANE')) {
            return true;
          }

          // Part77 format: Look for entries with "CRANE" in the STRUCTURE TYPE field
          // Part77 data also has crane data marked differently sometimes
          if (entry['STRUCTURE TYPE'] &&
              entry['STRUCTURE TYPE'].includes('CRANE')) {
            return true;
          }

          // Additional check for Part77 format that might have CRANE in other fields
          if ((entry['PROPOSAL DESCRIPTION'] &&
               entry['PROPOSAL DESCRIPTION'].toUpperCase().includes('CRANE')) ||
              (entry['STRUCTURE NAME'] &&
               entry['STRUCTURE NAME'].toUpperCase().includes('CRANE'))) {
            return true;
          }

          return false;
        });

        console.log(`Found ${craneData.length} crane entries in CSV`);
        
        // Transform data to the expected format
        const transformedData = craneData.map(entry => {
          // Parse dates (assuming format YYYY-MM-DD)
          const startDate = entry['WORK SCHEDULE BEGINNING DATE'] || entry['ENTERED DATE'] || '';
          const endDate = entry['WORK SCHEDULE ENDING DATE'] || entry['EXPIRATION DATE'] || '';
          
          // Parse coordinates - handle both DMS and decimal formats from both data sources
          const latitude = coordinateToDecimal(entry['LATITUDE']);
          // Use LONGITUDE column (header was corrected from typo "LONGITUTDE")
          const longitude = coordinateToDecimal(entry['LONGITUDE']);
          
          // Skip entries with invalid coordinates
          if (latitude === null || longitude === null) {
            return null;
          }
          
          // Get height from either AGL HEIGHT PROPOSED or AGL HEIGHT DET
          const height = parseInt(entry['AGL HEIGHT PROPOSED'] || entry['AGL HEIGHT DET'] || '0');
          
          // Identify data source
          const dataSource = entry['DATA_SOURCE'] || 'Unknown';
          
          // Create a unique ID combining ASN and data source to avoid collisions
          const asn = entry['STUDY (ASN)'] || '';
          const uniqueId = asn ? `${asn}-${dataSource}` : `${latitude}-${longitude}-${height}-${dataSource}`;

          return {
            id: asn, // Keep original ID for display
            uniqueId: uniqueId, // Use for internal tracking
            structureType: 'Crane',
            latitude: latitude,
            longitude: longitude,
            height: height,
            heightUnit: 'ft AGL',
            status: entry['STATUS'] || 'Unknown',
            startDate: startDate,
            endDate: endDate,
            sponsor: entry['SPONSOR NAME'] || '',
            city: entry['STRUCTURE CITY'] || '',
            state: entry['STRUCTURE STATE'] || '',
            dataSource: dataSource
          };
        }).filter(entry => entry !== null); // Remove entries with invalid coordinates

        console.log(`Transformed ${transformedData.length} crane entries`);

        // Filter out inactive cranes based on end date
        const activeCranes = transformedData.filter(crane => {
          // If no end date, assume it's still active
          if (!crane.endDate) {
            return true;
          }

          // Parse the end date
          const endDate = parseCSVDate(crane.endDate);

          // If we can't parse the end date, keep the crane (fail safe)
          if (!endDate) {
            return true;
          }

          // Filter out cranes whose end date has passed
          if (endDate < now) {
            console.log(`Filtering out inactive crane ${crane.id}: end date ${crane.endDate} has passed`);
            return false;
          }

          return true;
        });

        console.log(`After date filtering: ${activeCranes.length} active cranes (removed ${transformedData.length - activeCranes.length} inactive)`);
        resolve(activeCranes);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        resolve([]);
      }
    });
  });
};

/**
 * Fetch NOTAMs from the Cloudflare Worker proxy, which queries the FAA NOTAM
 * Management Service (NMS) API and returns crane-related GeoJSON features
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lng - Longitude in decimal degrees
 * @param {number} radiusNM - Search radius in nautical miles
 * @returns {Promise<Array>} Array of NOTAM crane objects in standard format
 */
export const fetchNOTAMs = async (lat, lng, radiusNM) => {
  // Check if NOTAM proxy is configured
  if (!NOTAM_PROXY_URL) {
    console.log('NOTAM proxy not configured, skipping NOTAM fetch');
    return [];
  }

  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    radius: Math.min(radiusNM, NOTAM_CONFIG.maxRadius).toString()
  });

  const attempts = NOTAM_CONFIG.retryOnFailure ? NOTAM_CONFIG.maxRetries + 1 : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NOTAM_CONFIG.timeout);

    try {
      console.log(`Fetching NOTAMs from proxy for location: ${lat}, ${lng}, radius: ${radiusNM}nm`);

      const response = await fetch(`${NOTAM_PROXY_URL}?${params}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`NOTAM proxy returned ${response.status}`);
      }

      const data = await response.json();
      const features = Array.isArray(data.features) ? data.features : [];
      console.log(`Received ${features.length} crane-related NOTAMs from proxy`);

      return parseNOTAMFeatures(features);
    } catch (error) {
      console.error(`Error fetching NOTAMs (attempt ${attempt}/${attempts}):`, error);
      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, NOTAM_CONFIG.retryDelay));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return []; // Don't fail the entire search if NOTAMs are unavailable
};

/**
 * Parse an NMS ISO 8601 timestamp (e.g. "2025-03-17T17:02:00.000Z")
 * @param {string} dateStr - ISO timestamp
 * @returns {Date|null} Parsed Date object or null if missing/invalid
 */
const parseNOTAMDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Format a NOTAM date for display as "YYYY-MM-DD HH:MMZ" (sorts correctly as text)
 */
const formatNOTAMDate = (date) => (
  date ? `${date.toISOString().slice(0, 16).replace('T', ' ')}Z` : ''
);

/**
 * Parse a DMS coordinate pair from NOTAM text, e.g. "474523N1221521W" or
 * "474523.40N 1221521.10W"
 * @returns {{lat: number, lng: number}|null}
 */
const parseNOTAMTextCoordinates = (text) => {
  const match = text.match(/(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])\s*(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])/);
  if (!match) {
    return null;
  }

  const [, latD, latM, latS, latDir, lngD, lngM, lngS, lngDir] = match;
  let lat = parseInt(latD) + parseInt(latM) / 60 + parseFloat(latS) / 3600;
  let lng = parseInt(lngD) + parseInt(lngM) / 60 + parseFloat(lngS) / 3600;
  if (latDir === 'S') lat = -lat;
  if (lngDir === 'W') lng = -lng;
  return { lat, lng };
};

/**
 * Get the first Point from a GeoJSON geometry (Point or GeometryCollection)
 * @returns {{lat: number, lng: number}|null}
 */
const getGeometryPoint = (geometry) => {
  if (!geometry) {
    return null;
  }
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    for (const child of geometry.geometries) {
      const point = getGeometryPoint(child);
      if (point) {
        return point;
      }
    }
  }
  return null;
};

/**
 * Filter NMS GeoJSON NOTAM features to active crane obstructions and convert
 * them to the standard crane record shape
 * @param {Array} features - GeoJSON features from the NMS API
 * @returns {Array} Array of crane objects in standard format
 */
const parseNOTAMFeatures = (features) => {
  const now = new Date();

  const craneFeatures = features.filter(feature => {
    const notam = feature?.properties?.coreNOTAMData?.notam;
    if (!notam) {
      return false;
    }

    const message = (notam.text || '').toLowerCase();

    // Obstruction NOTAMs use Q-codes starting with QOB (e.g. QOBCE, obstacle erected)
    const isObstruction = (notam.selectionCode || '').toUpperCase().startsWith('QOB') ||
                          message.includes('obst');
    const isCrane = message.includes('crane');

    if (!isObstruction || !isCrane) {
      return false;
    }

    // Filter for currently active NOTAMs based on start/end/cancelation dates
    const startDate = parseNOTAMDate(notam.effectiveStart);
    const endDate = parseNOTAMDate(notam.effectiveEnd);
    const cancelationDate = parseNOTAMDate(notam.cancelationDate);

    if (startDate && startDate > now) {
      return false;
    }
    if (endDate && endDate < now) {
      return false;
    }
    if (cancelationDate && cancelationDate < now) {
      return false;
    }

    return true;
  });

  console.log(`Filtered to ${craneFeatures.length} crane-related NOTAMs (currently active)`);

  return craneFeatures.map(feature => {
    const notam = feature.properties.coreNOTAMData.notam;
    // Example text: "OBST CRANE (ASN 2024-ANM-1234-NRA) 474523N1221521W (0.4NM SE S60) 450FT (230FT AGL) FLAGGED AND LGT"
    const message = notam.text || '';

    // The coordinates in the NOTAM text are the crane itself; the geometry may be
    // the NOTAM's reference point, so it's only a fallback
    const position = parseNOTAMTextCoordinates(message) || getGeometryPoint(feature.geometry);

    // Parse height (extract from "XXX FT AGL" or "(XXXFT AGL)")
    const heightMatch = message.match(/\((\d+)\s*FT AGL\)|(\d+)\s*FT AGL/i);
    const height = heightMatch ? parseInt(heightMatch[1] || heightMatch[2]) : 0;

    const startDate = formatNOTAMDate(parseNOTAMDate(notam.effectiveStart));
    const endDate = formatNOTAMDate(parseNOTAMDate(notam.effectiveEnd)) || 'UNKNOWN';

    const location = notam.location || notam.icaoLocation || '';
    const notamNumber = notam.number ? `${location} ${notam.number}`.trim() : notam.id;

    return {
      id: notamNumber,
      uniqueId: `${notam.id || notamNumber}-NOTAM`,
      structureType: 'Crane',
      latitude: position ? position.lat : 0,
      longitude: position ? position.lng : 0,
      height: height,
      heightUnit: 'ft AGL',
      status: 'Active NOTAM',
      startDate: startDate,
      endDate: endDate,
      sponsor: location,
      city: location,
      state: '',
      dataSource: 'NOTAM',
      condition: message,
      icaoLocation: notam.icaoLocation || location
    };
  }).filter(crane => crane.latitude !== 0 && crane.longitude !== 0);
};

// Drop cranes whose end date has passed. Cached data can be up to a day old,
// so this is re-applied every time cached data is used.
const filterActiveCranes = (cranes) => {
  const now = new Date();
  return cranes.filter(crane => {
    const endDate = crane.endDate ? parseCSVDate(crane.endDate) : null;
    return !endDate || endDate >= now;
  });
};

const saveCacheEntry = (path, entry) => {
  memoryCache.set(path, entry);
  // Fire and forget; setCachedDataset never rejects
  setCachedDataset(path, entry);
};

/**
 * Load parsed crane data for one CSV, using the IndexedDB cache when possible.
 * Cached data is revalidated with a conditional request (ETag / Last-Modified)
 * at most every REVALIDATE_INTERVAL_MS, and discarded after MAX_CACHE_AGE_MS.
 * If the server can't be reached, cached data up to MAX_STALE_FALLBACK_MS old is
 * returned with staleSince set so the UI can warn about it.
 * @param {string} path - CSV path
 * @param {string} label - Data source label for logging and the worker
 * @returns {Promise<{cranes: Array, staleSince: number|null}|null>} Active cranes, and the
 *   cache timestamp if they came from a stale fallback; null if the CSV could not be loaded
 */
const loadDataset = async (path, label) => {
  let cached = memoryCache.get(path) || await getCachedDataset(path);
  if (cached && cached.version !== CACHE_VERSION) {
    cached = null;
  }

  const now = Date.now();

  if (cached && now - cached.validatedAt < REVALIDATE_INTERVAL_MS) {
    console.log(`Using cached ${label} data (validated ${Math.round((now - cached.validatedAt) / 1000)}s ago)`);
    memoryCache.set(path, cached);
    return { cranes: filterActiveCranes(cached.data), staleSince: null };
  }

  const staleFallback = () => {
    if (!cached || now - cached.cachedAt > MAX_STALE_FALLBACK_MS) {
      return null;
    }
    console.warn(`Using stale cached ${label} data from ${new Date(cached.cachedAt).toISOString()}`);
    return { cranes: filterActiveCranes(cached.data), staleSince: cached.cachedAt };
  };

  // Only revalidate cache entries younger than a day; older ones get a full refetch
  const revalidatable = cached && now - cached.cachedAt < MAX_CACHE_AGE_MS ? cached : null;
  const headers = {};
  if (revalidatable?.etag) {
    headers['If-None-Match'] = revalidatable.etag;
  } else if (revalidatable?.lastModified) {
    headers['If-Modified-Since'] = revalidatable.lastModified;
  }

  let response;
  try {
    // no-store with conditional headers so a 304 reaches us instead of being
    // resolved against the browser HTTP cache
    response = await fetch(path, revalidatable ? { headers, cache: 'no-store' } : undefined);
  } catch (error) {
    console.warn(`Network error fetching ${label} data:`, error);
    const fallback = staleFallback();
    if (fallback) {
      return fallback;
    }
    throw error;
  }

  // Some servers (e.g. webpack-dev-server) ignore conditional headers on no-cache
  // requests and send a full 200, so also compare validators on the response
  const etag = response.headers.get('ETag');
  const lastModified = response.headers.get('Last-Modified');
  const unchanged = revalidatable && (
    response.status === 304 ||
    (response.ok && (etag ? etag === revalidatable.etag : lastModified && lastModified === revalidatable.lastModified))
  );

  if (unchanged) {
    console.log(`${label} data unchanged on server, using cache`);
    response.body?.cancel();
    saveCacheEntry(path, { ...revalidatable, validatedAt: now });
    return { cranes: filterActiveCranes(revalidatable.data), staleSince: null };
  }

  if (!response.ok) {
    console.warn(`Failed to fetch ${label} data:`, response.status);
    return staleFallback();
  }

  console.log(`Processing ${label} data...`);
  const text = await response.text();
  const cranes = await parseCSVDataWithWorker(text, label);
  console.log(`Loaded ${cranes.length} ${label} cranes`);

  saveCacheEntry(path, {
    version: CACHE_VERSION,
    data: cranes,
    etag,
    lastModified,
    cachedAt: now,
    validatedAt: now
  });

  return { cranes, staleSince: null };
};

// Share one in-flight load per CSV between concurrent searches
const loadDatasetOnce = (path, label) => {
  if (!inflightLoads.has(path)) {
    const promise = loadDataset(path, label).finally(() => inflightLoads.delete(path));
    inflightLoads.set(path, promise);
  }
  return inflightLoads.get(path);
};

// Fetch crane data from DOF, Part77 CSV files and on-demand NOTAMs
export const fetchCraneData = async (location, radiusNM) => {
  try {
    console.log('Fetching crane data from DOF, Part77, and NOTAM sources...');

    // Load DOF and Part77 data (from cache or network) and NOTAMs in parallel
    const [dofResult, part77Result, notamCranes] = await Promise.all([
      loadDatasetOnce(DOF_CSV_PATH, 'DOF'),
      loadDatasetOnce(PART77_CSV_PATH, 'Part77'),
      location && NOTAM_PROXY_URL ? fetchNOTAMs(location.lat, location.lng, radiusNM) : []
    ]);

    if (!dofResult && !part77Result) {
      throw new Error('Failed to fetch CSV files: DOF and Part77 both unavailable');
    }

    let allCraneData = [...(dofResult?.cranes || []), ...(part77Result?.cranes || [])];

    // Oldest cache timestamp among datasets that fell back to stale data, if any
    const staleTimes = [dofResult?.staleSince, part77Result?.staleSince].filter(Boolean);
    const staleDataAsOf = staleTimes.length > 0 ? new Date(Math.min(...staleTimes)) : null;

    // Add NOTAM data (already filtered and formatted)
    if (notamCranes.length > 0) {
      console.log(`Adding ${notamCranes.length} NOTAM cranes`);
      allCraneData.push(...notamCranes);
    }

    console.log(`Total cranes loaded: ${allCraneData.length}`);

    // Remove duplicates based on uniqueId
    const uniqueCranes = new Map();

    allCraneData.forEach(crane => {
      if (!uniqueCranes.has(crane.uniqueId)) {
        uniqueCranes.set(crane.uniqueId, crane);
      }
    });

    allCraneData = Array.from(uniqueCranes.values());
    console.log(`After deduplication: ${allCraneData.length} unique cranes`);

    // Filter data based on location and radius (DOF/Part77 only, NOTAMs already filtered)
    if (location && radiusNM) {
      allCraneData = allCraneData.filter(crane => {
        // Skip filtering for NOTAMs as they're already filtered by the API
        if (crane.dataSource === 'NOTAM') {
          return true;
        }
        return isPointWithinRadius(location, crane, radiusNM);
      });
      console.log(`Filtered to ${allCraneData.length} cranes within ${radiusNM}nm radius`);
    }

    return { data: allCraneData, usedMockData: false, staleDataAsOf };
  } catch (error) {
    console.error('Error fetching crane data:', error);

    // Return mock data as fallback with a flag indicating mock data was used
    return {
      data: MOCK_CRANE_DATA,
      usedMockData: true,
      error: error.message || 'Failed to load CSV data'
    };
  }
};

// Convert nautical miles to meters for Leaflet
export const nauticalMilesToMeters = (nm) => {
  return nm * 1852;
};

// Function to calculate if a point is within a radius
export const isPointWithinRadius = (center, point, radiusNM) => {
  // Convert to radians
  const lat1 = center.lat * Math.PI / 180;
  const lon1 = center.lng * Math.PI / 180;
  const lat2 = point.latitude * Math.PI / 180;
  const lon2 = point.longitude * Math.PI / 180;
  
  // Haversine formula
  const dlon = lon2 - lon1;
  const dlat = lat2 - lat1;
  const a = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceNM = 3440.065 * c; // Earth radius in nautical miles * c
  
  return distanceNM <= radiusNM;
};

// Function to convert crane data to GeoJSON format for the map
export const cranesToGeoJson = (cranes) => {
  return {
    type: "FeatureCollection",
    features: cranes.map(crane => ({
      type: "Feature",
      properties: {
        id: crane.id,
        uniqueId: crane.uniqueId,
        structureType: crane.structureType,
        height: crane.height,
        heightUnit: crane.heightUnit,
        status: crane.status,
        startDate: crane.startDate,
        endDate: crane.endDate,
        sponsor: crane.sponsor,
        dataSource: crane.dataSource
      },
      geometry: {
        type: "Point",
        coordinates: [crane.longitude, crane.latitude]
      }
    }))
  };
};

// Export constants for use in components
export const RADIUS_NM_TO_METERS = nauticalMilesToMeters;

// Export worker cleanup function for use in components (e.g., unmount)
export const cleanupWorkers = terminateWorkers;

// Mock data for crane locations around Tolleson, AZ
// This is used as a fallback if the CSV data can't be loaded
const MOCK_CRANE_DATA = [
  {
    id: "2023-WSW-1234-OE",
    structureType: "Crane",
    latitude: 33.4476,
    longitude: -112.2562,
    height: 190,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-15",
    endDate: "2025-08-15",
    sponsor: "ABC Construction Co.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1235-OE",
    structureType: "Crane",
    latitude: 33.4506,
    longitude: -112.2682,
    height: 210,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-01",
    endDate: "2025-07-30",
    sponsor: "XYZ Builders Inc.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1236-OE",
    structureType: "Crane",
    latitude: 33.4356,
    longitude: -112.2492,
    height: 175,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-01",
    endDate: "2025-09-15",
    sponsor: "Phoenix Development LLC",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1237-OE",
    structureType: "Crane",
    latitude: 33.4556,
    longitude: -112.2392,
    height: 185,
    heightUnit: "ft AGL",
    status: "Pending",
    startDate: "2025-06-15",
    endDate: "2025-10-30",
    sponsor: "Desert Construction Inc.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1238-OE",
    structureType: "Crane",
    latitude: 33.4656,
    longitude: -112.2792,
    height: 195,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-03-15",
    endDate: "2025-08-01",
    sponsor: "Southwest Builders Group",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1239-OE",
    structureType: "Crane",
    latitude: 33.4386,
    longitude: -112.2462,
    height: 160,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-01",
    endDate: "2025-08-30",
    sponsor: "Valley Builders LLC",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1240-OE",
    structureType: "Crane",
    latitude: 33.4526,
    longitude: -112.2532,
    height: 205,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-15",
    endDate: "2025-07-15",
    sponsor: "Metro Construction Group",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1241-OE",
    structureType: "Crane",
    latitude: 33.4406,
    longitude: -112.2612,
    height: 180,
    heightUnit: "ft AGL",
    status: "Pending",
    startDate: "2025-06-01",
    endDate: "2025-09-01",
    sponsor: "Desert Crane Services",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1242-OE",
    structureType: "Crane",
    latitude: 33.4496,
    longitude: -112.2402,
    height: 215,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-03-01",
    endDate: "2025-08-15",
    sponsor: "Arizona Building Co.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1243-OE",
    structureType: "Crane",
    latitude: 33.4536,
    longitude: -112.2712,
    height: 170,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-15",
    endDate: "2025-09-30",
    sponsor: "Western Crane Rentals",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1244-OE",
    structureType: "Crane",
    latitude: 33.4436,
    longitude: -112.2482,
    height: 200,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-01",
    endDate: "2025-08-01",
    sponsor: "Southwestern Development Inc.",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1245-OE",
    structureType: "Crane",
    latitude: 33.4576,
    longitude: -112.2432,
    height: 185,
    heightUnit: "ft AGL",
    status: "Pending",
    startDate: "2025-06-15",
    endDate: "2025-10-15",
    sponsor: "Maricopa Construction LLC",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1246-OE",
    structureType: "Crane",
    latitude: 33.4626,
    longitude: -112.2572,
    height: 195,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-03-15",
    endDate: "2025-07-30",
    sponsor: "Phoenix Metro Builders",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1247-OE",
    structureType: "Crane",
    latitude: 33.4676,
    longitude: -112.2512,
    height: 175,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-05-01",
    endDate: "2025-09-15",
    sponsor: "Arizona Urban Development",
    city: "Tolleson",
    state: "AZ"
  },
  {
    id: "2023-WSW-1248-OE",
    structureType: "Crane",
    latitude: 33.4416,
    longitude: -112.2642,
    height: 210,
    heightUnit: "ft AGL",
    status: "Active",
    startDate: "2025-04-15",
    endDate: "2025-08-15",
    sponsor: "Grand Avenue Construction",
    city: "Tolleson",
    state: "AZ"
  }
];
