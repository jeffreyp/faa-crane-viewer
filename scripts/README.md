# FAA Data Automation Scripts

This directory contains scripts to automate the download and processing of FAA obstacle data.

## Files

- `update_faa_data.py` - Python script that downloads FAA Digital Obstacle File (DOF) and Part 77 regional data, then merges and converts to the format used by the crane viewer
- `fetch_notams.py` - Standalone Python script for testing NOTAM API queries (archived - NOTAMs now fetched on-demand via Cloudflare Worker)
- `test_notam_api.py` - NOTAM API investigation and testing script (archived)
- `download-faa-data.js` - Node.js script to download FAA Part 77 regional data files from all 9 FAA regions
- `merge-faa-data.js` - Node.js script to merge the original datafile.csv with downloaded regional data and create consolidated files

## Background

The crane viewer aggregates data from three official FAA sources to provide comprehensive coverage of both permanent and temporary crane obstructions:

### 1. Digital Obstacle File (DOF)
- **URL:** https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP
- **Coverage:** Nationwide permanent obstacles
- **Format:** ZIP containing CSV
- **Records:** ~700 crane-related structures

The DOF is the FAA's master database of verified obstacles. **Important Note**: The DOF contains ALL types of obstacles (towers, buildings, rigs, etc.), not just construction cranes. The automation script filters the data to focus on:
- Records with "CRANE" in the TYPE field
- Temporary structures and construction equipment
- Mobile equipment and vehicles

### 2. Part 77 Regional Data
- **URL:** https://oeaaa.faa.gov/oeaaa/oe3a-external-api/downloadArchives.do
- **Coverage:** 9 FAA regions (AAL, ACE, AEA, AGL, ANM, ANE, ASO, ASW, AWP)
- **Format:** Gzipped CSV per region
- **Records:** ~38,000 crane-related structures

Part 77 data includes structures that have been evaluated for their aeronautical impact through the OE/AAA review process.

### 3. NOTAMs (Notices to Airmen)
- **URL:** https://notams.aim.faa.gov/notamSearch/
- **Coverage:** User's search area (on-demand)
- **Format:** JSON from real-time API
- **Records:** Varies (typically 10-50 active temporary crane obstructions nationwide)

NOTAMs provide real-time information about temporary obstructions. **Important:** NOTAMs are **NOT** pre-fetched or processed by the automation scripts. Instead, they use an **on-demand architecture**:

**On-Demand Fetching:**
- Fetched when user performs a search in the web application
- Proxied through Cloudflare Worker (CORS bypass)
- Real-time data from FAA NOTAM API
- No pre-fetching or batch processing
- **Runtime:** < 1 second per user search

**Why On-Demand:**
- Real-time data (no staleness)
- No GitHub Actions timeouts
- Faster overall (users only fetch their search area)
- Simpler architecture (no complex batch processing)

## GitHub Actions Workflow

The `.github/workflows/update-faa-data.yml` workflow automatically:
- Runs daily at 6 AM UTC
- Downloads the latest FAA DOF data
- Downloads Part 77 regional data from all 9 FAA regions
- Processes and merges both data sources
- Generates two CSV files:
  - `public/data/datafile.csv` - Merged DOF + Part77 data
  - `public/data/part77-data.csv` - Part77 data only
- Commits and pushes changes if data has been updated
- Rebuilds and redeploys to GitHub Pages

**Note:** The workflow has a 10-minute timeout. DOF + Part77 processing typically completes in 2-3 minutes. NOTAMs are fetched on-demand by users, not by GitHub Actions.

## Manual Testing

### Python Script
To run the full update process (requires pandas and requests):

```bash
pip install requests pandas
python3 scripts/update_faa_data.py
```

### Node.js Scripts
To download regional data using Node.js:

```bash
npm install  # if packages aren't installed
node scripts/download-faa-data.js
```

To merge data using Node.js:

```bash
npm install papaparse  # if not already installed
node scripts/merge-faa-data.js
```

## Data Format Conversion

The scripts handle multiple data sources and convert them to a standardized format:

### Python Script (`update_faa_data.py`)
- **DOF Format:** OAS, VERIFIED STATUS, COUNTRY, STATE, CITY, LATDEC, LONDEC, TYPE, AGL, AMSL, etc.
- **Part 77 Format:** STUDY (ASN), STATUS, DETERMINATION, LATITUDE, LONGITUDE, STRUCTURE TYPE, AGL HEIGHT DET, etc.
- **Output:** Two CSV files:
  - `datafile.csv` - Merged DOF + Part77 data
  - `part77-data.csv` - Part 77 data only (for transparency)

All outputs use a standardized CSV format with a `DATA_SOURCE` field indicating origin (DOF or Part77-{REGION}).

**NOTAMs:** Fetched on-demand via Cloudflare Worker (see `cloudflare-worker/notam-proxy.js`), not processed by this script.

### Node.js Scripts
- **download-faa-data.js:** Downloads Part 77 regional files from all 9 FAA regions
- **merge-faa-data.js:** Merges original datafile.csv with regional data, handles coordinate conversion (DMS to decimal), and creates both merged-faa-data.csv (all structures) and merged-cranes-only.csv (cranes only)

The conversion maps compatible fields and sets appropriate defaults for missing data.

## Customizing the Filtering

### Python Script (`update_faa_data.py`)
To adjust which obstacles are included from DOF data, modify the filtering logic around line 212:

```python
# Current DOF filtering:
crane_keywords = ['CRANE']
crane_mask = dof_df['TYPE'].str.contains('|'.join(crane_keywords), case=False, na=False)

# To include more structure types, add them to the list:
crane_keywords = ['CRANE', 'TOWER', 'BUILDING']  # Example: include towers and buildings
```

For Part 77 data filtering, modify around line 161:

```python
# Current Part 77 filtering:
crane_keywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE']
construction_keywords = ['CONSTRUCTION', 'MOBILE', 'EQUIPMENT', 'VEHICLE']
```

### NOTAM Filtering
NOTAMs are **not processed by the Python script**. They are fetched on-demand via the Cloudflare Worker proxy when users search. The filtering happens in:

1. **Cloudflare Worker** (`cloudflare-worker/notam-proxy.js`):
   - Filters for obstruction class
   - Searches for "CRANE" in condition field (case-insensitive)
   - Returns filtered JSON to browser

2. **Frontend** (`src/services/faaService.js`):
   - Parses NOTAM JSON responses
   - Converts to standard CSV format
   - Merges with DOF/Part77 data for display

See `cloudflare-worker/DEPLOYMENT.md` for NOTAM proxy setup and configuration.

### JavaScript Script (`merge-faa-data.js`)
To adjust crane detection in the merge script, modify the `isCraneRelated` function around line 156:

```javascript
// Current filtering:
const craneKeywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE'];

// To include more keywords:
const craneKeywords = ['CRANE', 'TOWER', 'MOBILE CRANE', 'CONSTRUCTION CRANE', 'BOOM'];
```

## Troubleshooting

### Script-Specific Issues

**DOF download failures:**
- The DOF ZIP file can occasionally timeout during download
- Retry usually works - GitHub Actions will retry failed workflows
- Check if https://aeronav.faa.gov/Obst_Data/ is accessible

**Part 77 region failures:**
- Individual regions may be temporarily unavailable
- The script continues processing other regions when one fails
- Check workflow logs to see which regions succeeded

**No data committed:**
- If no changes are detected, the script doesn't create a commit
- This is normal if FAA data hasn't been updated since last run
- Check workflow logs for "No changes detected" message

### NOTAM Issues

**Note:** NOTAMs are **not processed by this script**. For NOTAM troubleshooting:
- See `cloudflare-worker/DEPLOYMENT.md` for proxy setup
- Check browser console for NOTAM fetch errors
- Verify `NOTAM_PROXY_URL` in `src/config.js`
- NOTAMs are temporary and may not be active in your search area
