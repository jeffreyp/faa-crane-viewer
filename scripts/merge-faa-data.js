const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const REGIONS_DIR = path.join(DATA_DIR, 'regions');
const ORIGINAL_FILE = path.join(DATA_DIR, 'datafile.csv');
const MERGED_FILE = path.join(DATA_DIR, 'merged-faa-data.csv');

// FAA Region codes with names
const FAA_REGIONS = {
  'AAL': 'Alaska',
  'ACE': 'Central', 
  'AEA': 'Eastern',
  'AGL': 'Great Lakes',
  'ANM': 'Northwest Mountain',
  'ANE': 'New England', 
  'ASO': 'Southern',
  'ASW': 'Southwest',
  'AWP': 'Western Pacific'
};

// Convert DMS (Degrees-Minutes-Seconds) to decimal degrees
const dmsToDecimal = (dmsStr) => {
  if (!dmsStr) return null;
  
  // Check if it's already a decimal number
  const decimal = parseFloat(dmsStr);
  if (!isNaN(decimal)) return decimal;
  
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
  let result = degrees + (minutes / 60) + (seconds / 3600);
  
  // Adjust sign based on direction
  if (direction === 'S' || direction === 'W') {
    result = -result;
  }
  
  return result;
};

// Parse CSV file
const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const csvData = fs.readFileSync(filePath, 'utf8');
    
    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log(`Parsed ${results.data.length} rows from ${path.basename(filePath)}`);
        resolve(results.data);
      },
      error: reject
    });
  });
};

// Normalize data structure between original and regional files
const normalizeRecord = (record, source) => {
  // Handle coordinate fields (original has typo in column name)
  const longitude = record['LONGITUDE'] || record['LONGITUTDE'];
  const latitude = record['LATITUDE'];
  
  // Convert coordinates to decimal if needed
  const lat = source === 'original' ? dmsToDecimal(latitude) : parseFloat(latitude);
  const lng = source === 'original' ? dmsToDecimal(longitude) : parseFloat(longitude);
  
  // Skip records with invalid coordinates
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return null;
  }
  
  // Get height from various possible fields
  const height = parseInt(
    record['AGL HEIGHT PROPOSED'] || 
    record['AGL HEIGHT DET'] || 
    record['AGL HEIGHT DNE'] || 
    '0'
  );
  
  // Get structure type
  const structureType = record['STRUCTURE TYPE'] || '';
  
  return {
    // Core identification
    id: record['STUDY (ASN)'] || '',
    priorAsn: record['PRIOR ASN'] || '',
    
    // Location data
    latitude: lat,
    longitude: lng,
    city: record['STRUCTURE CITY'] || '',
    county: record['STRUCTURE COUNTY NAME'] || '',
    state: record['STRUCTURE STATE'] || '',
    elevation: parseInt(record['ELEVATION'] || '0'),
    
    // Structure information
    structureType: structureType,
    structureName: record['STRUCTURE NAME'] || '',
    height: height,
    heightUnit: 'ft AGL',
    amslHeight: parseInt(record['AMSL HEIGHT PROPOSED'] || record['AMSL HEIGHT DET'] || record['AMSL HEIGHT DNE'] || '0'),
    
    // Status and dates
    status: record['STATUS'] || '',
    determination: record['DETERMINATION'] || '',
    enteredDate: record['ENTERED DATE'] || '',
    receivedDate: record['RECEIVED DATE'] || '',
    completionDate: record['COMPLETION DATE'] || '',
    expirationDate: record['EXPIRATION DATE'] || '',
    workStartDate: record['WORK SCHEDULE BEGINNING DATE'] || '',
    workEndDate: record['WORK SCHEDULE ENDING DATE'] || '',
    
    // Sponsor and representative
    sponsor: record['SPONSOR NAME '] || record['SPONSOR NAME'] || '',
    representative: record['REPRESENTATIVE NAME '] || record['REPRESENTATIVE NAME'] || '',
    
    // Aviation data
    nearestAirport: record['NEAREST AIRPORT'] || '',
    distanceFromAirport: record['DISTANCE FROM AIRPORT'] || '',
    directionFromAirport: record['DIRECTION FROM AIRPORT'] || '',
    onAirport: record['ON AIRPORT'] || '',
    
    // Additional fields from regional data
    surveyAccuracy: record['SURVEY_ACCURACY'] || '',
    markingLighting: record['MARKING LIGHTING TYPE'] || '',
    proposalDescription: record['PROPOSAL DESCRIPTION'] || '',
    locationDescription: record['LOCATION DESCRIPTION'] || '',
    duration: record['DURATION'] || '',
    durationDays: record['DURATION DAYS'] || '',
    durationMonths: record['DURATION MONTHS'] || '',
    fccNumber: record['FCC NUMBER'] || '',
    signatureControlNumber: record['SIGNATURE CONTROL NUMBER '] || record['SIGNATURE CONTROL NUMBER'] || '',
    frequencyJson: record['FREQUENCY_JSON '] || record['FREQUENCY_JSON'] || '',
    
    // Source tracking
    dataSource: source,
    region: source.startsWith('region-') ? source.replace('region-', '') : 'original'
  };
};

// Check if structure contains crane-related keywords
const isCraneRelated = (record) => {
  const structureType = (record.structureType || '').toUpperCase();
  const structureName = (record.structureName || '').toUpperCase();
  const proposalDescription = (record.proposalDescription || '').toUpperCase();
  
  const craneKeywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE'];
  
  return craneKeywords.some(keyword => 
    structureType.includes(keyword) || 
    structureName.includes(keyword) || 
    proposalDescription.includes(keyword)
  );
};

async function mergeAllData() {
  console.log('=== FAA Data Merger ===\n');
  
  const allRecords = [];
  const stats = {
    original: 0,
    regional: 0,
    totalCranes: 0,
    totalStructures: 0,
    invalidCoords: 0
  };
  
  // Process original file
  try {
    console.log('Processing original datafile.csv...');
    const originalData = await parseCSVFile(ORIGINAL_FILE);
    
    for (const record of originalData) {
      const normalized = normalizeRecord(record, 'original');
      if (normalized) {
        allRecords.push(normalized);
        stats.original++;
        if (isCraneRelated(normalized)) {
          stats.totalCranes++;
        }
        stats.totalStructures++;
      } else {
        stats.invalidCoords++;
      }
    }
  } catch (error) {
    console.log(`Warning: Could not process original file: ${error.message}`);
  }
  
  // Process regional files
  const regionFiles = fs.readdirSync(REGIONS_DIR).filter(file => 
    file.startsWith('OffAirport') && file.endsWith('2025List.csv')
  );
  
  for (const filename of regionFiles) {
    const regionCode = filename.match(/OffAirport([A-Z]+)2025List\.csv/)[1];
    const regionName = FAA_REGIONS[regionCode] || regionCode;
    
    try {
      console.log(`Processing ${regionName} region (${filename})...`);
      const filePath = path.join(REGIONS_DIR, filename);
      const regionData = await parseCSVFile(filePath);
      
      let regionCount = 0;
      let regionCranes = 0;
      
      for (const record of regionData) {
        const normalized = normalizeRecord(record, `region-${regionCode}`);
        if (normalized) {
          allRecords.push(normalized);
          regionCount++;
          stats.totalStructures++;
          
          if (isCraneRelated(normalized)) {
            regionCranes++;
            stats.totalCranes++;
          }
        } else {
          stats.invalidCoords++;
        }
      }
      
      stats.regional += regionCount;
      console.log(`  Added ${regionCount} records (${regionCranes} cranes) from ${regionName}`);
      
    } catch (error) {
      console.log(`  Warning: Could not process ${regionName}: ${error.message}`);
    }
  }
  
  // Remove duplicates based on STUDY (ASN)
  console.log('\nRemoving duplicates...');
  const uniqueRecords = [];
  const seenIds = new Set();
  
  for (const record of allRecords) {
    if (record.id && !seenIds.has(record.id)) {
      seenIds.add(record.id);
      uniqueRecords.push(record);
    }
  }
  
  console.log(`Removed ${allRecords.length - uniqueRecords.length} duplicate records`);
  
  // Sort by state, then by city, then by structure type
  uniqueRecords.sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    return a.structureType.localeCompare(b.structureType);
  });
  
  // Write merged CSV
  console.log('\\nWriting merged data...');
  const csv = Papa.unparse(uniqueRecords);
  fs.writeFileSync(MERGED_FILE, csv);
  
  // Create crane-only file
  const craneRecords = uniqueRecords.filter(isCraneRelated);
  const cranesCsv = Papa.unparse(craneRecords);
  const craneOnlyFile = path.join(DATA_DIR, 'merged-cranes-only.csv');
  fs.writeFileSync(craneOnlyFile, cranesCsv);
  
  // Summary
  console.log('\\n=== Merge Complete ===');
  console.log(`Original file records: ${stats.original}`);
  console.log(`Regional files records: ${stats.regional}`);
  console.log(`Total structures: ${uniqueRecords.length}`);
  console.log(`Total cranes: ${craneRecords.length}`);
  console.log(`Invalid coordinates skipped: ${stats.invalidCoords}`);
  console.log('\\nFiles created:');
  console.log(`  ${MERGED_FILE} - All structures`);
  console.log(`  ${craneOnlyFile} - Cranes only`);
  
  // Regional breakdown
  console.log('\\nRecords by region:');
  const regionBreakdown = {};
  uniqueRecords.forEach(record => {
    const region = record.region;
    if (!regionBreakdown[region]) regionBreakdown[region] = { total: 0, cranes: 0 };
    regionBreakdown[region].total++;
    if (isCraneRelated(record)) regionBreakdown[region].cranes++;
  });
  
  Object.entries(regionBreakdown)
    .sort(([,a], [,b]) => b.total - a.total)
    .forEach(([region, counts]) => {
      const regionName = FAA_REGIONS[region] || region;
      console.log(`  ${regionName}: ${counts.total} total (${counts.cranes} cranes)`);
    });
    
  return {
    totalStructures: uniqueRecords.length,
    totalCranes: craneRecords.length,
    mergedFile: MERGED_FILE,
    craneOnlyFile: craneOnlyFile
  };
}

// Run the merge
if (require.main === module) {
  mergeAllData()
    .then(result => {
      console.log('\\nMerge process completed successfully.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Merge process failed:', error);
      process.exit(1);
    });
}

module.exports = { mergeAllData };