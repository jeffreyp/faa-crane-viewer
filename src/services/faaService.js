// Real FAA crane data parser for CSV files from OE/AAA system
import Papa from 'papaparse';

// Constants - using direct absolute path for webpack dev server
const CSV_PATH = 'data/OffAirportAWP2025List.csv';

// Convert DMS (Degrees-Minutes-Seconds) to decimal degrees
const dmsToDecimal = (dmsStr) => {
  if (!dmsStr) return null;
  
  // Example format: "33 - 27 - 28.73 N"
  const parts = dmsStr.split('-').map(part => part.trim());
  if (parts.length !== 3) return null;
  
  const degrees = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  
  // Last part contains seconds and direction (N/S/E/W)
  const secondsParts = parts[2].split(' ');
  const seconds = parseFloat(secondsParts[0]);
  const direction = secondsParts[1];
  
  // Calculate decimal degrees
  let decimal = degrees + (minutes / 60) + (seconds / 3600);
  
  // Adjust sign based on direction
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
};

// Parse CSV data and return crane data
const parseCSVData = async (csvData) => {
  return new Promise((resolve) => {
    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        // Filter for crane entries
        const craneData = results.data.filter(entry => {
          // Look for entries with "CRANE" in the STRUCTURE TYPE field
          return entry['STRUCTURE TYPE'] && entry['STRUCTURE TYPE'].includes('CRANE');
        });
        
        // Transform data to the expected format
        const transformedData = craneData.map(entry => {
          // Parse dates (assuming format YYYY-MM-DD)
          const startDate = entry['WORK SCHEDULE BEGINNING DATE'] || entry['ENTERED DATE'] || '';
          const endDate = entry['WORK SCHEDULE ENDING DATE'] || entry['EXPIRATION DATE'] || '';
          
          // Parse coordinates from DMS to decimal
          const latitude = dmsToDecimal(entry['LATITUDE']);
          const longitude = dmsToDecimal(entry['LONGITUTDE']); // Note the typo in the CSV header
          
          // Get height from either AGL HEIGHT PROPOSED or AGL HEIGHT DET
          const height = parseInt(entry['AGL HEIGHT PROPOSED'] || entry['AGL HEIGHT DET'] || '0');
          
          return {
            id: entry['STUDY (ASN)'] || '',
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
            state: entry['STRUCTURE STATE'] || ''
          };
        });
        
        resolve(transformedData);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        resolve([]);
      }
    });
  });
};

// Fetch crane data from local CSV file
export const fetchCraneData = async (location, radiusNM) => {
  try {
    // Fetch the CSV file
    const response = await fetch(CSV_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    let craneData = await parseCSVData(csvText);
    
    // Filter data based on location and radius
    if (location && radiusNM) {
      craneData = craneData.filter(crane => 
        isPointWithinRadius(location, crane, radiusNM)
      );
    }
    
    return craneData;
  } catch (error) {
    console.error('Error fetching crane data:', error);
    
    // Fallback to mock data if there's an error
    console.warn('Falling back to mock data');
    let filteredData = MOCK_CRANE_DATA;
    
    // Only filter by location if both location and radius are provided
    if (location && radiusNM) {
      filteredData = MOCK_CRANE_DATA.filter(crane => 
        isPointWithinRadius(location, crane, radiusNM)
      );
    }
    
    return filteredData;
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
        structureType: crane.structureType,
        height: crane.height,
        heightUnit: crane.heightUnit,
        status: crane.status,
        startDate: crane.startDate,
        endDate: crane.endDate,
        sponsor: crane.sponsor
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
  }
];