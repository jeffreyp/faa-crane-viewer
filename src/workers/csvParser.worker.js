// Web Worker for CSV parsing to prevent UI blocking
import Papa from 'papaparse';

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

/**
 * Parse CSV data and return crane data
 * Runs in Web Worker to prevent UI blocking
 */
const parseCSVData = (csvData, dataSource) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        try {
          const totalRows = results.data.length;

          // Report progress: parsing complete
          self.postMessage({
            type: 'progress',
            message: `CSV parsed, processing ${totalRows} rows...`,
            dataSource
          });

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

          // Report progress: filtering complete
          self.postMessage({
            type: 'progress',
            message: `Found ${craneData.length} crane entries`,
            dataSource
          });

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
            const source = entry['DATA_SOURCE'] || dataSource || 'Unknown';

            // Create a unique ID combining ASN and data source to avoid collisions
            const asn = entry['STUDY (ASN)'] || '';
            const uniqueId = asn ? `${asn}-${source}` : `${latitude}-${longitude}-${height}-${source}`;

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
              dataSource: source
            };
          }).filter(entry => entry !== null); // Remove entries with invalid coordinates

          // Report progress: transformation complete
          self.postMessage({
            type: 'progress',
            message: `Transformed ${transformedData.length} crane entries`,
            dataSource
          });

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
              return false;
            }

            return true;
          });

          // Report progress: date filtering complete
          self.postMessage({
            type: 'progress',
            message: `After date filtering: ${activeCranes.length} active cranes`,
            dataSource
          });

          resolve(activeCranes);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { id, csvData, dataSource } = event.data;

  try {
    // Report that we started parsing
    self.postMessage({
      type: 'progress',
      message: `Starting CSV parse for ${dataSource}...`,
      dataSource
    });

    // Parse the CSV data
    const craneData = await parseCSVData(csvData, dataSource);

    // Send the result back to the main thread
    self.postMessage({
      type: 'complete',
      id,
      dataSource,
      data: craneData
    });
  } catch (error) {
    // Send error back to the main thread
    self.postMessage({
      type: 'error',
      id,
      dataSource,
      error: error.message || 'Failed to parse CSV'
    });
  }
});
