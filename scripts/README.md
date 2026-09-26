# FAA Data Automation Scripts

This directory contains the script that downloads and processes FAA obstacle data.

## Files

- `update_faa_data.py` - Python script that downloads FAA Digital Obstacle File (DOF) and Part 77 regional data, then merges and converts to the format used by the crane viewer

## Background

The crane viewer aggregates crane data from two official FAA sources:

### 1. Digital Obstacle File (DOF)
- **URL:** https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP
- **Coverage:** Nationwide permanent obstacles
- **Format:** ZIP containing CSV
- **Records:** ~800 crane-related structures

The DOF is the FAA's master database of verified obstacles. **Important Note**: The DOF contains ALL types of obstacles (towers, buildings, rigs, etc.), not just construction cranes. The automation script filters the data to focus on:
- Records with "CRANE" in the TYPE field
- Temporary structures and construction equipment
- Mobile equipment and vehicles

### 2. Part 77 Regional Data
- **URL:** https://oeaaa.faa.gov/oeaaa/oe3a-external-api/downloadArchives.do
- **Coverage:** 9 FAA regions (AAL, ACE, AEA, AGL, ANM, ANE, ASO, ASW, AWP)
- **Format:** Gzipped CSV per region
- **Records:** ~43,000 crane-related structures

Part 77 data includes structures that have been evaluated for their aeronautical impact through the OE/AAA review process.

### NOTAMs (disabled)

NOTAMs were a third, on-demand source fetched in the browser through a Cloudflare Worker (`cloudflare-worker/notam-proxy.js`), never by this script. They are currently disabled because the FAA retired the legacy NOTAM Search endpoint; see `NOTAM_PROXY_URL` in `src/config.js` and beads epic `fcv-gyi`.

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

**Note:** The workflow has a 10-minute timeout. DOF + Part77 processing typically completes in 2-3 minutes.

## Manual Testing

To run the full update process (requires pandas and requests):

```bash
pip install requests pandas
python3 scripts/update_faa_data.py
```

## Data Format Conversion

- **DOF Format:** OAS, VERIFIED STATUS, COUNTRY, STATE, CITY, LATDEC, LONDEC, TYPE, AGL, AMSL, etc.
- **Part 77 Format:** STUDY (ASN), STATUS, DETERMINATION, LATITUDE, LONGITUDE, STRUCTURE TYPE, AGL HEIGHT DET, etc.
- **Output:** Two CSV files:
  - `datafile.csv` - Merged DOF + Part77 data
  - `part77-data.csv` - Part 77 data only (for transparency)

All outputs use the Part 77 column layout with a `DATA_SOURCE` field indicating origin (DOF or Part77-{REGION}).

## Customizing the Filtering

To adjust which obstacles are included from DOF data, modify the keyword lists in `convert_dof_to_datafile_format()`:

```python
# Current DOF filtering:
crane_keywords = ['CRANE']
crane_mask = dof_df['TYPE'].str.contains('|'.join(crane_keywords), case=False, na=False)

# To include more structure types, add them to the list:
crane_keywords = ['CRANE', 'TOWER', 'BUILDING']  # Example: include towers and buildings
```

For Part 77 data filtering, modify the keyword lists in `convert_part77_to_datafile_format()`:

```python
# Current Part 77 filtering:
crane_keywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE']
construction_keywords = ['CONSTRUCTION', 'MOBILE', 'EQUIPMENT', 'VEHICLE']
```

## Troubleshooting

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
