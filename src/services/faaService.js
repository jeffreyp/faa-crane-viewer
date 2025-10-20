// Real FAA crane data parser for CSV files from OE/AAA system
import Papa from 'papaparse';

// Constants - using direct absolute path for webpack dev server
const DOF_CSV_PATH = 'data/datafile.csv';
const PART77_CSV_PATH = 'data/part77-data.csv';

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

// Parse CSV data and return crane data
const parseCSVData = async (csvData) => {
  return new Promise((resolve) => {
    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        console.log(`CSV parsed, total rows: ${results.data.length}`);
        
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
        resolve(transformedData);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        resolve([]);
      }
    });
  });
};

// Fetch crane data from both DOF and Part77 CSV files
export const fetchCraneData = async (location, radiusNM) => {
  try {
    console.log('Fetching crane data from both DOF and Part77 sources...');
    
    // Fetch both CSV files in parallel
    const [dofResponse, part77Response] = await Promise.all([
      fetch(DOF_CSV_PATH),
      fetch(PART77_CSV_PATH)
    ]);
    
    if (!dofResponse.ok && !part77Response.ok) {
      throw new Error(`Failed to fetch both CSV files: DOF ${dofResponse.status}, Part77 ${part77Response.status}`);
    }
    
    let allCraneData = [];
    
    // Process DOF data if available
    if (dofResponse.ok) {
      console.log('Processing DOF data...');
      const dofText = await dofResponse.text();
      const dofCranes = await parseCSVData(dofText);
      allCraneData.push(...dofCranes);
      console.log(`Loaded ${dofCranes.length} DOF cranes`);
    } else {
      console.warn('Failed to fetch DOF data:', dofResponse.status);
    }
    
    // Process Part77 data if available
    if (part77Response.ok) {
      console.log('Processing Part77 data...');
      const part77Text = await part77Response.text();
      const part77Cranes = await parseCSVData(part77Text);
      allCraneData.push(...part77Cranes);
      console.log(`Loaded ${part77Cranes.length} Part77 cranes`);
    } else {
      console.warn('Failed to fetch Part77 data:', part77Response.status);
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

    // Filter data based on location and radius
    if (location && radiusNM) {
      allCraneData = allCraneData.filter(crane =>
        isPointWithinRadius(location, crane, radiusNM)
      );
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
