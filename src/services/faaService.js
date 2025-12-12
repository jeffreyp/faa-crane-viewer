// Real FAA crane data parser for CSV files from OE/AAA system
import Papa from 'papaparse';
import { NOTAM_PROXY_URL, NOTAM_CONFIG } from '../config';

// Constants - using direct absolute path for webpack dev server
const DOF_CSV_PATH = 'data/datafile.csv';
const PART77_CSV_PATH = 'data/part77-data.csv';

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
 * Convert decimal degrees to DMS format required by NOTAM API
 */
const decimalToDMS = (decimal) => {
  const isPositive = decimal >= 0;
  const absDecimal = Math.abs(decimal);

  const degrees = Math.floor(absDecimal);
  const minutesDecimal = (absDecimal - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = Math.floor((minutesDecimal - minutes) * 60);

  return {
    degrees: degrees.toString(),
    minutes: minutes.toString(),
    seconds: seconds.toString(),
    direction: isPositive
  };
};

/**
 * Fetch a single page of NOTAMs from the Cloudflare Worker proxy
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lng - Longitude in decimal degrees
 * @param {number} radiusNM - Search radius in nautical miles
 * @param {number} offset - Pagination offset
 * @returns {Promise<Object>} NOTAM API response
 */
const fetchNOTAMPage = async (lat, lng, radiusNM, offset = 0) => {
  // Convert coordinates to DMS format
  const latDMS = decimalToDMS(lat);
  const lngDMS = decimalToDMS(lng);

  // Build form data matching FAA NOTAM API format
  const formData = new URLSearchParams({
    'searchType': '3', // Geographic search
    'designatorsForLocation': '',
    'designatorForAccountable': '',
    'latDegrees': latDMS.degrees,
    'latMinutes': latDMS.minutes,
    'latSeconds': latDMS.seconds,
    'longDegrees': lngDMS.degrees,
    'longMinutes': lngDMS.minutes,
    'longSeconds': lngDMS.seconds,
    'radius': Math.min(radiusNM, NOTAM_CONFIG.maxRadius).toString(),
    'sortColumns': '5 false',
    'sortDirection': 'true',
    'designatorForNotamNumberSearch': '',
    'notamNumber': '',
    'radiusSearchOnDesignator': 'false',
    'radiusSearchDesignator': '',
    'latitudeDirection': lat >= 0 ? 'N' : 'S',
    'longitudeDirection': lng >= 0 ? 'E' : 'W',
    'freeFormText': '',
    'flightPathText': '',
    'flightPathDivertAirfields': '',
    'flightPathBuffer': '4',
    'flightPathIncludeNavaids': 'true',
    'flightPathIncludeArtcc': 'false',
    'flightPathIncludeTfr': 'true',
    'flightPathIncludeRegulatory': 'false',
    'flightPathResultsType': 'All NOTAMs',
    'archiveDate': '',
    'archiveDesignator': '',
    'offset': offset.toString(),
    'notamsOnly': 'false',
    'filters': '',
    'recaptchaToken': ''
  });

  // Fetch from Cloudflare Worker with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOTAM_CONFIG.timeout);

  const response = await fetch(NOTAM_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      'Accept': 'application/json'
    },
    body: formData.toString(),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`NOTAM proxy returned ${response.status}`);
  }

  return await response.json();
};

/**
 * Fetch NOTAMs from the Cloudflare Worker proxy with pagination support
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

  try {
    console.log(`Fetching NOTAMs from proxy for location: ${lat}, ${lng}, radius: ${radiusNM}nm`);

    let allNotams = [];
    let offset = 0;
    const pageSize = 30; // FAA API returns 30 results per page
    let hasMore = true;

    // Fetch all pages of NOTAM results
    while (hasMore) {
      const data = await fetchNOTAMPage(lat, lng, radiusNM, offset);

      const notamCount = data.notamList?.length || 0;
      console.log(`Received ${notamCount} NOTAMs from API (offset: ${offset})`);

      if (notamCount === 0) {
        // No more results
        hasMore = false;
      } else {
        allNotams.push(...(data.notamList || []));

        // Check if there might be more results
        // If we got a full page, there might be more
        if (notamCount < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;

          // Safety limit: don't fetch more than 300 NOTAMs (10 pages)
          if (offset >= 300) {
            console.warn(`Reached safety limit of 300 NOTAMs, stopping pagination`);
            hasMore = false;
          }
        }
      }
    }

    console.log(`Total NOTAMs fetched: ${allNotams.length}`);

    // Parse and filter NOTAMs for crane-related obstructions
    return parseNOTAMResponse({ notamList: allNotams });

  } catch (error) {
    console.error('Error fetching NOTAMs:', error);
    return []; // Return empty array on error, don't fail the entire search
  }
};

/**
 * Parse FAA NOTAM date format (MM/DD/YYYY HHMM) to JavaScript Date object
 * Example: "11/19/2024 1400" -> Date object
 * @param {string} dateStr - Date string in FAA NOTAM format
 * @returns {Date|null} Parsed Date object or null if invalid
 */
const parseNOTAMDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  // FAA NOTAM format: "MM/DD/YYYY HHMM"
  // Example: "11/19/2024 1400"
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2})(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, month, day, year, hours, minutes] = match;

  // Create date in UTC to avoid timezone issues
  // Note: month is 0-indexed in JavaScript Date constructor
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,  // Convert to 0-indexed month
    parseInt(day),
    parseInt(hours),
    parseInt(minutes)
  ));

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/**
 * Parse NOTAM API response and extract crane-related obstructions
 * @param {Object} data - NOTAM API response
 * @returns {Array} Array of crane objects in standard format
 */
const parseNOTAMResponse = (data) => {
  if (!data.notamList || !Array.isArray(data.notamList)) {
    return [];
  }

  const now = new Date();

  const craneNotams = data.notamList.filter(notam => {
    // Get the message text to search
    const message = (notam.traditionalMessageFrom4thWord || '').toLowerCase();

    // Filter for obstruction-related keywords in the message
    // Check for: obst, obstacle, obstruction
    const isObstruction = notam.keyword === 'OBST' ||
                          notam.featureName === 'Obstruction' ||
                          message.includes('obst') ||
                          message.includes('obstacle') ||
                          message.includes('obstruction');

    // Filter for crane-related keywords in the message
    // Check for: crane, cranes, tower crane, mobile crane, construction crane
    const isCrane = message.includes('crane');

    if (!isObstruction || !isCrane) {
      return false;
    }

    // Filter for currently active NOTAMs based on start/end dates
    // Use custom parser for FAA NOTAM date format
    const startDate = notam.startDate ? parseNOTAMDate(notam.startDate) : null;
    const endDate = notam.endDate ? parseNOTAMDate(notam.endDate) : null;

    // If we have a start date and it's in the future, skip this NOTAM
    if (startDate && startDate > now) {
      return false;
    }

    // If we have an end date and it's in the past, skip this NOTAM
    if (endDate && endDate < now) {
      return false;
    }

    return true;
  });

  console.log(`Filtered to ${craneNotams.length} crane-related NOTAMs (currently active)`);

  // Transform to standard format
  return craneNotams.map(notam => {
    // Parse coordinates from traditionalMessageFrom4thWord
    // Format example: "OBST CRANE (ASN UNKNOWN) 474523N1221521W (0.4NM SE S60) UNKNOWN (230FT AGL)"
    const message = notam.traditionalMessageFrom4thWord || '';

    // Extract coordinates using regex (format: DDMMSSN/SDDDMMSSW/E)
    const coordMatch = message.match(/(\d{6}[NS])(\d{7}[EW])/);
    let lat = 0;
    let lng = 0;

    if (coordMatch) {
      // Parse latitude (DDMMSSN/S)
      const latStr = coordMatch[1];
      const latDeg = parseInt(latStr.substring(0, 2));
      const latMin = parseInt(latStr.substring(2, 4));
      const latSec = parseInt(latStr.substring(4, 6));
      const latDir = latStr.substring(6);
      lat = latDeg + latMin/60 + latSec/3600;
      if (latDir === 'S') lat = -lat;

      // Parse longitude (DDDMMSSW/E)
      const lngStr = coordMatch[2];
      const lngDeg = parseInt(lngStr.substring(0, 3));
      const lngMin = parseInt(lngStr.substring(3, 5));
      const lngSec = parseInt(lngStr.substring(5, 7));
      const lngDir = lngStr.substring(7);
      lng = lngDeg + lngMin/60 + lngSec/3600;
      if (lngDir === 'W') lng = -lng;
    }

    // Parse height (extract from "XXX FT AGL" or "(XXXFT AGL)")
    const heightMatch = message.match(/\((\d+)FT AGL\)|(\d+)FT AGL/i);
    const height = heightMatch ? parseInt(heightMatch[1] || heightMatch[2]) : 0;

    // Parse dates
    const startDate = notam.startDate || '';
    const endDate = notam.endDate || 'UNKNOWN';

    // Create unique ID from NOTAM number
    const notamNumber = notam.notamNumber || `${notam.facilityDesignator}-${notam.number}` || `NOTAM-${lat}-${lng}`;

    return {
      id: notamNumber,
      uniqueId: `${notamNumber}-NOTAM`,
      structureType: 'Crane',
      latitude: lat,
      longitude: lng,
      height: height,
      heightUnit: 'ft AGL',
      status: 'Active NOTAM',
      startDate: startDate,
      endDate: endDate,
      sponsor: notam.facilityDesignator || '',
      city: notam.facilityDesignator || '',
      state: '',
      dataSource: 'NOTAM',
      condition: message,
      icaoLocation: notam.facilityDesignator || ''
    };
  }).filter(crane => crane.latitude !== 0 && crane.longitude !== 0);
};

// Fetch crane data from DOF, Part77 CSV files and on-demand NOTAMs
export const fetchCraneData = async (location, radiusNM) => {
  try {
    console.log('Fetching crane data from DOF, Part77, and NOTAM sources...');

    // Build array of fetch promises
    const fetchPromises = [
      fetch(DOF_CSV_PATH),
      fetch(PART77_CSV_PATH)
    ];

    // Add NOTAM fetch if location is provided and proxy is configured
    if (location && NOTAM_PROXY_URL) {
      fetchPromises.push(fetchNOTAMs(location.lat, location.lng, radiusNM));
    }

    // Fetch DOF, Part77 CSVs and NOTAMs in parallel
    const results = await Promise.all(fetchPromises);

    const dofResponse = results[0];
    const part77Response = results[1];
    const notamCranes = results[2] || []; // NOTAMs or empty array

    if (!dofResponse.ok && !part77Response.ok) {
      throw new Error(`Failed to fetch CSV files: DOF ${dofResponse.status}, Part77 ${part77Response.status}`);
    }

    let allCraneData = [];

    // Process DOF and Part77 data in parallel using Web Workers
    const parsePromises = [];

    if (dofResponse.ok) {
      console.log('Processing DOF data...');
      const dofText = await dofResponse.text();
      parsePromises.push(
        parseCSVDataWithWorker(dofText, 'DOF').then(dofCranes => {
          console.log(`Loaded ${dofCranes.length} DOF cranes`);
          return dofCranes;
        })
      );
    } else {
      console.warn('Failed to fetch DOF data:', dofResponse.status);
    }

    if (part77Response.ok) {
      console.log('Processing Part77 data...');
      const part77Text = await part77Response.text();
      parsePromises.push(
        parseCSVDataWithWorker(part77Text, 'Part77').then(part77Cranes => {
          console.log(`Loaded ${part77Cranes.length} Part77 cranes`);
          return part77Cranes;
        })
      );
    } else {
      console.warn('Failed to fetch Part77 data:', part77Response.status);
    }

    // Wait for all parsing to complete (parallel parsing in workers)
    const parsedResults = await Promise.all(parsePromises);
    parsedResults.forEach(cranes => allCraneData.push(...cranes));

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

    return { data: allCraneData, usedMockData: false };
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
