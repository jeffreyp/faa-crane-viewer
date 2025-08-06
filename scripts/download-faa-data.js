const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// FAA Region codes
const FAA_REGIONS = [
  'AAL', // Alaska
  'ACE', // Central
  'AEA', // Eastern
  'AGL', // Great Lakes
  'ANM', // Northwest Mountain
  'ANE', // New England
  'ASO', // Southern
  'ASW', // Southwest
  'AWP'  // Western Pacific
];

const BASE_URL = 'https://oeaaa.faa.gov/oeaaa/oe3a-external-api/downloadArchives.do?fname=OffAirport';
const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'regions');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${filename}...`);
    
    const file = fs.createWriteStream(path.join(DATA_DIR, filename));
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${filename}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(path.join(DATA_DIR, filename), () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

function renameToCSV(gzFilename) {
  return new Promise((resolve, reject) => {
    const gzPath = path.join(DATA_DIR, gzFilename);
    const csvPath = path.join(DATA_DIR, gzFilename.replace('.gzip', '.csv'));
    
    console.log(`Renaming ${gzFilename} to CSV format...`);
    
    // The file is already CSV format, just rename it
    fs.rename(gzPath, csvPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`✓ Renamed to ${path.basename(csvPath)}`);
        resolve(csvPath);
      }
    });
  });
}

async function downloadAllRegions() {
  console.log(`Starting download for ${FAA_REGIONS.length} FAA regions...\n`);
  
  const results = {
    successful: [],
    failed: []
  };
  
  for (const region of FAA_REGIONS) {
    const filename = `OffAirport${region}2025List.gzip`;
    const url = `${BASE_URL}${region}2025List.gzip`;
    
    try {
      await downloadFile(url, filename);
      const csvPath = await renameToCSV(filename);
      results.successful.push({ region, filename, csvPath });
      
      // Add a small delay between downloads to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`✗ Failed to download ${region}: ${error.message}`);
      results.failed.push({ region, filename, error: error.message });
    }
  }
  
  console.log('\n=== Download Summary ===');
  console.log(`Successful: ${results.successful.length}`);
  console.log(`Failed: ${results.failed.length}`);
  
  if (results.successful.length > 0) {
    console.log('\nSuccessful downloads:');
    results.successful.forEach(({ region, csvPath }) => {
      console.log(`  ${region}: ${path.basename(csvPath)}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\nFailed downloads:');
    results.failed.forEach(({ region, error }) => {
      console.log(`  ${region}: ${error}`);
    });
  }
  
  return results;
}

// Run the download
if (require.main === module) {
  downloadAllRegions()
    .then(results => {
      console.log('\nDownload process completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Download process failed:', error);
      process.exit(1);
    });
}

module.exports = { downloadAllRegions, FAA_REGIONS };