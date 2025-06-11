# FAA Data Automation Scripts

This directory contains scripts to automate the download and processing of FAA obstacle data.

## Files

- `update_faa_data.py` - Main script that downloads FAA Digital Obstacle File (DOF) and converts to the format used by the crane viewer
- `test_faa_download.py` - Test script to verify FAA download functionality (uses only built-in Python modules)

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
- Runs every Sunday at 6 AM UTC
- Downloads the latest FAA DOF data
- Converts it to match the existing datafile.csv format
- Commits and pushes changes if data has been updated

## Manual Testing

To test the download functionality locally:

```bash
python3 scripts/test_faa_download.py
```

To run the full update process (requires pandas and requests):

```bash
pip install requests pandas
python3 scripts/update_faa_data.py
```

## Data Format Conversion

The script converts from the DOF format to the existing datafile.csv format:

**DOF Format:** OAS, VERIFIED STATUS, COUNTRY, STATE, CITY, LATDEC, LONDEC, etc.

**Crane Viewer Format:** STUDY (ASN), STATUS, DETERMINATION, LATITUDE, LONGITUDE, etc.

The conversion maps compatible fields and sets appropriate defaults for missing data.

## Customizing the Filtering

If you need to adjust which obstacles are included, modify the filtering logic in `update_faa_data.py`:

```python
# Current filtering (line ~75):
crane_keywords = ['CRANE']
crane_mask = dof_df['TYPE'].str.contains('|'.join(crane_keywords), case=False, na=False)

# To include more structure types, add them to the list:
crane_keywords = ['CRANE', 'TOWER', 'BUILDING']  # Example: include towers and buildings
```

You can also adjust the temporary/mobile equipment filters in the same section of the script.