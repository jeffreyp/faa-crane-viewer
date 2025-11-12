# FAA Data Automation Scripts

This directory contains scripts to automate the download and processing of FAA obstacle data.

## Files

- `update_faa_data.py` - Python script that downloads FAA Digital Obstacle File (DOF), Part 77 regional data, and NOTAM data, then merges and converts to the format used by the crane viewer
- `fetch_notams.py` - Standalone Python script for testing NOTAM API queries (used during development)
- `test_notam_api.py` - NOTAM API investigation and testing script
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
- **Coverage:** Continental USA via geographic grid search
- **Format:** JSON API responses converted to CSV
- **Records:** 500-2,000 active temporary crane obstructions

NOTAMs provide real-time information about temporary obstructions. The automation performs:
- Geographic grid search (~1,500 points, 100 NM spacing covering CONUS)
- Filtering for class=obstruction and condition contains "CRANE"
- Active date validation (current date within NOTAM start/end dates)
- 2-second delay between requests for rate limiting
- **Runtime:** ~50 minutes for full grid coverage

## GitHub Actions Workflow

The `.github/workflows/update-faa-data.yml` workflow automatically:
- Runs daily at 6 AM UTC
- Downloads the latest FAA DOF data
- Downloads Part 77 regional data from all 9 FAA regions
- Fetches current NOTAMs via geographic grid search
- Processes and merges all three data sources
- Generates three CSV files:
  - `public/data/datafile.csv` - Merged DOF + Part77 + NOTAM data
  - `public/data/part77-data.csv` - Part77 data only
  - `public/data/notams.csv` - NOTAM data only
- Commits and pushes changes if data has been updated
- Rebuilds and redeploys to GitHub Pages

**Note:** The workflow has a 60-minute timeout to accommodate the NOTAM grid search (~50 minutes).

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
- **NOTAM Format:** JSON responses from NOTAM Search API containing obstacleNumber, classification, location, coordinates, etc.
- **Output:** Three CSV files:
  - `datafile.csv` - Merged data from all three sources
  - `part77-data.csv` - Part 77 data only (for transparency)
  - `notams.csv` - NOTAM data only (for transparency)

All outputs use a standardized 47-column CSV format with a `DATA_SOURCE` field indicating origin (DOF, Part77-{REGION}, or NOTAM).

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
The NOTAM fetching process filters at multiple stages:

**API Query Filters:**
```python
# update_faa_data.py line ~650
params = {
    'startDate': start_date.isoformat() + 'Z',
    'endDate': end_date.isoformat() + 'Z',
    'searchType': 'latlong',
    'classification[]': 'obstruction'  # Only obstruction NOTAMs
}
```

**Post-fetch Filtering:**
```python
# Keyword filtering (line ~730)
crane_keywords = ['CRANE', 'TOWER CRANE', 'MOBILE CRANE']
condition_lower = str(notam.get('condition', '')).lower()
has_crane = any(kw.lower() in condition_lower for kw in crane_keywords)

# Date validation (line ~740)
current_date = datetime.now(timezone.utc)
is_active = start_datetime <= current_date <= end_datetime
```

**Test vs Production Mode:**
To switch between test grid (4 points, ~2 minutes) and production grid (~1,500 points, ~50 minutes):

```python
# update_faa_data.py line 896
use_test_grid = False  # Set to True for testing, False for production
```

### JavaScript Script (`merge-faa-data.js`)
To adjust crane detection in the merge script, modify the `isCraneRelated` function around line 156:

```javascript
// Current filtering:
const craneKeywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE'];

// To include more keywords:
const craneKeywords = ['CRANE', 'TOWER', 'MOBILE CRANE', 'CONSTRUCTION CRANE', 'BOOM'];
```

## Troubleshooting

### NOTAM-Specific Issues

**No NOTAMs in output:**
- NOTAMs are temporary and expire regularly
- Check that `use_test_grid = False` for production data
- Verify API is accessible: https://notams.aim.faa.gov/notamSearch/
- Check console output for "Crane-related NOTAMs: X" message

**NOTAM fetch timeout:**
- Production grid takes ~50 minutes with 2-second delays
- GitHub Actions has 60-minute timeout configured
- For faster testing, set `use_test_grid = True`

**Rate limiting errors:**
- Default delay is 2 seconds between requests
- Increase delay in `fetch_and_process_notams()` if needed:
  ```python
  time.sleep(2)  # Increase this value if rate limited
  ```
