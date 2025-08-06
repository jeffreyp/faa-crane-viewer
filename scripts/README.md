# FAA Data Automation Scripts

This directory contains scripts to automate the download and processing of FAA obstacle data.

## Files

- `update_faa_data.py` - Python script that downloads both FAA Digital Obstacle File (DOF) and Part 77 regional data, then merges and converts to the format used by the crane viewer
- `download-faa-data.js` - Node.js script to download FAA Part 77 regional data files from all 9 FAA regions
- `merge-faa-data.js` - Node.js script to merge the original datafile.csv with downloaded regional data and create consolidated files

## Background

The original manual process involved downloading regional files from https://oeaaa.faa.gov/oeaaa/oe3a/main/#/download, but that system is currently closed. 

This automation uses the FAA Digital Obstacle File (DOF) instead, which provides:
- Daily updated obstacle data
- Complete US coverage 
- CSV format available
- Direct download URL: https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP

**Important Note**: The DOF contains ALL types of obstacles (towers, buildings, rigs, etc.), not just construction cranes. The automation script filters the data to focus on:
- Records with "CRANE" in the TYPE field
- Temporary structures and construction equipment
- Mobile equipment and vehicles
- Records marked as temporary/construction in ACTION field

This may result in fewer records than the original manual dataset, but ensures higher relevance for crane tracking.

## GitHub Actions Workflow

The `.github/workflows/update-faa-data.yml` workflow automatically:
- Runs daily at 6 AM UTC
- Downloads the latest FAA DOF data
- Converts it to match the existing datafile.csv format
- Commits and pushes changes if data has been updated

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

The scripts handle multiple data sources:

### Python Script (`update_faa_data.py`)
- **DOF Format:** OAS, VERIFIED STATUS, COUNTRY, STATE, CITY, LATDEC, LONDEC, TYPE, AGL, AMSL, etc.
- **Part 77 Format:** Already compatible with crane viewer format
- **Output:** Merged datafile.csv with both DOF and Part 77 data

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

### JavaScript Script (`merge-faa-data.js`)
To adjust crane detection in the merge script, modify the `isCraneRelated` function around line 156:

```javascript
// Current filtering:
const craneKeywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE'];

// To include more keywords:
const craneKeywords = ['CRANE', 'TOWER', 'MOBILE CRANE', 'CONSTRUCTION CRANE', 'BOOM'];
```
