#!/usr/bin/env python3
"""
FAA Obstacle Data Updater
Downloads the latest FAA Digital Obstacle File (DOF) and converts it to match 
the current datafile.csv format used by the crane viewer application.
"""

import requests
import zipfile
import gzip
import pandas as pd
import io
import os
import re
import json
import time
from datetime import datetime
import tempfile
from pathlib import Path
from urllib.parse import urlencode
from typing import Dict, List, Tuple, Optional

# FAA Region codes for Part 77 data
FAA_REGIONS = [
    'AAL',  # Alaska
    'ACE',  # Central
    'AEA',  # Eastern
    'AGL',  # Great Lakes
    'ANM',  # Northwest Mountain
    'ANE',  # New England
    'ASO',  # Southern
    'ASW',  # Southwest
    'AWP'   # Western Pacific
]

# NOTAM API configuration
NOTAM_API_ENDPOINT = "https://notams.aim.faa.gov/notamSearch/search"
NOTAM_REQUEST_DELAY = 2.0  # Seconds between requests
NOTAM_REQUEST_TIMEOUT = 30  # Seconds
NOTAM_MAX_RETRIES = 3
NOTAM_RETRY_DELAY = 5  # Seconds

# Continental US boundaries for NOTAM grid
CONUS_BOUNDS = {
    'min_lat': 24.5,   # Southern Florida
    'max_lat': 49.0,   # Northern border
    'min_lon': -125.0, # West coast
    'max_lon': -66.9   # East coast
}

def download_faa_dof():
    """Download the latest FAA Digital Obstacle File (DOF) CSV."""
    url = "https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP"
    
    print(f"Downloading FAA DOF data from {url}...")
    response = requests.get(url, timeout=300)  # 5 minute timeout
    response.raise_for_status()
    
    return response.content

def download_part77_region(region_code):
    """Download Part 77 data for a specific region."""
    url = f"https://oeaaa.faa.gov/oeaaa/oe3a-external-api/downloadArchives.do?fname=Part77{region_code}2025List.gzip"
    
    print(f"Downloading Part 77 data for {region_code} region from {url}...")
    try:
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        return response.content
    except requests.RequestException as e:
        print(f"Failed to download {region_code} region data: {e}")
        return None

def extract_part77_csv(content):
    """Extract CSV data from Part 77 data (may be gzipped or plain CSV)."""
    try:
        # First try to decompress as gzip
        try:
            csv_content = gzip.decompress(content)
            print("Successfully decompressed gzipped content")
            content_str = csv_content.decode('utf-8')
        except gzip.BadGzipFile:
            # Not a gzip file, try as plain text
            print("Content is not gzipped, trying as plain CSV")
            content_str = content.decode('utf-8')
            
            # Check if it looks like HTML error page
            if content_str.strip().startswith('<!DOCTYPE') or content_str.strip().startswith('<html'):
                print("Received HTML response (likely error page)")
                return None
        
        # Use more robust CSV parsing parameters to handle JSON and special characters
        return pd.read_csv(
            io.StringIO(content_str), 
            quoting=1,  # QUOTE_ALL
            skipinitialspace=True, 
            on_bad_lines='skip',
            engine='python',  # More robust parser
            escapechar='\\',  # Handle escaped characters
            doublequote=True  # Handle double quotes in fields
        )
                
    except Exception as e:
        print(f"Error extracting Part 77 CSV: {e}")
        # Show first 200 characters to debug
        try:
            preview = content.decode('utf-8')[:200]
            print(f"Content preview: {preview}")
        except:
            print(f"Raw content preview: {content[:200]}")
        return None

def extract_csv_from_zip(zip_content):
    """Extract CSV data from the ZIP file."""
    with zipfile.ZipFile(io.BytesIO(zip_content)) as z:
        print(f"Files in ZIP archive: {z.namelist()}")

        # Look for different file types the FAA might use
        csv_files = [f for f in z.namelist() if f.lower().endswith('.csv')]
        txt_files = [f for f in z.namelist() if f.lower().endswith('.txt')]
        dat_files = [f for f in z.namelist() if f.lower().endswith('.dat')]

        # Helper function to try reading with different encodings
        def read_with_encoding(file_obj):
            # Try different encodings in order
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            for encoding in encodings:
                try:
                    file_obj.seek(0)  # Reset file position
                    return pd.read_csv(file_obj, low_memory=False, encoding=encoding)
                except (UnicodeDecodeError, UnicodeError):
                    continue
            # If all encodings fail, try with error handling
            file_obj.seek(0)
            return pd.read_csv(file_obj, low_memory=False, encoding='utf-8', encoding_errors='replace')

        # Try CSV files first
        if csv_files:
            csv_file = csv_files[0]
            print(f"Extracting CSV file: {csv_file}...")
            with z.open(csv_file) as f:
                return read_with_encoding(f)

        # Try TXT files (often CSV format)
        elif txt_files:
            txt_file = txt_files[0]
            print(f"Extracting TXT file as CSV: {txt_file}...")
            with z.open(txt_file) as f:
                return read_with_encoding(f)

        # Try DAT files (also often CSV format)
        elif dat_files:
            dat_file = dat_files[0]
            print(f"Extracting DAT file as CSV: {dat_file}...")
            with z.open(dat_file) as f:
                return read_with_encoding(f)

        # If no recognizable files, try the first file
        elif z.namelist():
            first_file = z.namelist()[0]
            print(f"No CSV/TXT/DAT found, trying first file: {first_file}...")
            with z.open(first_file) as f:
                return read_with_encoding(f)

        else:
            raise ValueError("No files found in the ZIP archive")

def decimal_to_dms(decimal_deg, is_longitude=False):
    """Convert decimal degrees to DMS format expected by the website."""
    if pd.isna(decimal_deg):
        return ''
    
    abs_deg = abs(decimal_deg)
    degrees = int(abs_deg)
    minutes = int((abs_deg - degrees) * 60)
    seconds = ((abs_deg - degrees) * 60 - minutes) * 60
    
    # Determine direction
    if is_longitude:
        direction = 'W' if decimal_deg < 0 else 'E'
    else:
        direction = 'S' if decimal_deg < 0 else 'N'
    
    return f"{degrees:02d} - {minutes:02d} - {seconds:05.2f} {direction}"

def convert_part77_to_datafile_format(part77_df, region_code):
    """Convert Part 77 regional data to datafile format."""
    if part77_df is None or part77_df.empty:
        return pd.DataFrame()
    
    print(f"Converting {len(part77_df)} Part 77 records from {region_code} region")
    print(f"Part 77 columns: {list(part77_df.columns)}")
    
    # Filter for crane-related structures
    crane_keywords = ['CRANE', 'MOBILE CRANE', 'TOWER CRANE', 'CONSTRUCTION CRANE']
    structure_type_col = 'STRUCTURE TYPE' if 'STRUCTURE TYPE' in part77_df.columns else None
    structure_name_col = 'STRUCTURE NAME' if 'STRUCTURE NAME' in part77_df.columns else None
    proposal_desc_col = 'PROPOSAL DESCRIPTION' if 'PROPOSAL DESCRIPTION' in part77_df.columns else None
    
    crane_mask = pd.Series([False] * len(part77_df), index=part77_df.index)
    
    if structure_type_col:
        type_mask = part77_df[structure_type_col].str.contains('|'.join(crane_keywords), case=False, na=False)
        crane_mask = crane_mask | type_mask
    if structure_name_col:
        name_mask = part77_df[structure_name_col].str.contains('|'.join(crane_keywords), case=False, na=False)
        crane_mask = crane_mask | name_mask
    if proposal_desc_col:
        desc_mask = part77_df[proposal_desc_col].str.contains('|'.join(crane_keywords), case=False, na=False)
        crane_mask = crane_mask | desc_mask
    
    # Also include construction equipment and mobile structures
    construction_keywords = ['CONSTRUCTION', 'MOBILE', 'EQUIPMENT', 'VEHICLE']
    if structure_type_col:
        construction_mask = part77_df[structure_type_col].str.contains('|'.join(construction_keywords), case=False, na=False)
        crane_mask = crane_mask | construction_mask
    
    crane_df = part77_df[crane_mask].copy() if crane_mask.any() else part77_df.copy()
    print(f"Found {len(crane_df)} crane/construction records in {region_code}")
    
    # Part 77 data is already in a compatible format, so we can use it directly
    # Just add a source indicator
    crane_df = crane_df.copy()
    crane_df['DATA_SOURCE'] = f'Part77-{region_code}'
    
    return crane_df

def convert_dof_to_datafile_format(dof_df):
    """
    Convert DOF format to match the current datafile.csv structure.
    
    DOF columns: OAS, VERIFIED STATUS, COUNTRY, STATE, CITY, LATDEC, LONDEC, 
    DMSLAT, DMSLON, TYPE, QUANTITY, AGL, AMSL, LIGHTING, ACCURACY, MARKING, 
    FAA STUDY, ACTION, JDATE
    
    Target columns expected by the website (based on faaService.js):
    STUDY (ASN), STRUCTURE TYPE, LATITUDE, LONGITUDE, AGL HEIGHT DET/PROPOSED,
    STATUS, SPONSOR NAME, STRUCTURE CITY, STRUCTURE STATE, etc.
    """
    
    print("Available DOF columns:")
    print(list(dof_df.columns))
    
    # Filter for crane-related structures first
    # Focus on actual cranes and temporary construction equipment
    crane_keywords = ['CRANE']
    crane_mask = dof_df['TYPE'].str.contains('|'.join(crane_keywords), case=False, na=False)
    
    # Also look for temporary structures and construction equipment
    if 'ACTION' in dof_df.columns:
        temp_mask = dof_df['ACTION'].str.contains('TEMP|CONSTRUCTION', case=False, na=False)
        crane_mask = crane_mask | temp_mask
    
    # Look for mobile equipment in TYPE field
    mobile_keywords = ['MOBILE', 'EQUIPMENT', 'VEHICLE']
    mobile_mask = dof_df['TYPE'].str.contains('|'.join(mobile_keywords), case=False, na=False)
    crane_mask = crane_mask | mobile_mask
    
    crane_df = dof_df[crane_mask].copy()
    print(f"Found {len(crane_df)} potential crane/construction records from {len(dof_df)} total records")
    
    if len(crane_df) == 0:
        print("No crane-related records found, using all records")
        crane_df = dof_df.copy()
    
    # Initialize the output dataframe with the expected columns
    output_columns = [
        'STUDY (ASN)', 'PRIOR ASN', 'STATUS', 'DETERMINATION', 'ENTERED DATE', 
        'RECEIVED DATE', 'COMPLETION DATE', 'EXPIRATION DATE', 'LATITUDE', 
        'LONGITUDE', 'HORIZONTAL DATUM', 'SURVEY_ACCURACY', 'MARKING LIGHTING TYPE', 
        'MARKING LIGHTING TYPE OTHER', 'STRUCTURE NAME', 'STRUCTURE CITY', 
        'STRUCTURE COUNTY NAME', 'STRUCTURE COUNTY ID', 'STRUCTURE STATE', 
        'NEAREST AIRPORT', 'DISTANCE FROM AIRPORT', 'DIRECTION FROM AIRPORT', 
        'ON AIRPORT', 'PROPOSAL DESCRIPTION', 'LOCATION DESCRIPTION', 'NOTICE OF', 
        'DURATION', 'DURATION DAYS', 'DURATION MONTHS', 'WORK SCHEDULE BEGINNING DATE', 
        'WORK SCHEDULE ENDING DATE', 'DATE BUILT', 'FCC NUMBER', 'STRUCTURE TYPE', 
        'STRUCTURE TYPE OTHER', 'AGL HEIGHT DET', 'AGL HEIGHT DNE', 
        'AGL HEIGHT PROPOSED', 'ELEVATION', 'AMSL HEIGHT DET', 'AMSL HEIGHT DNE', 
        'AMSL HEIGHT PROPOSED', 'REPRESENTATIVE NAME ', 'SPONSOR NAME ', 
        'SIGNATURE CONTROL NUMBER ', 'FREQUENCY_JSON '
    ]
    
    # Create empty dataframe with the correct columns
    result_df = pd.DataFrame(columns=output_columns)
    
    # Map DOF columns to expected columns
    if not crane_df.empty:
        # Core mappings from DOF to expected format
        result_df['STUDY (ASN)'] = crane_df.get('OAS', '')
        result_df['STRUCTURE CITY'] = crane_df.get('CITY', '')
        result_df['STRUCTURE STATE'] = crane_df.get('STATE', '')
        result_df['STRUCTURE TYPE'] = crane_df.get('TYPE', 'CRANE$MOBILE')  # Default to crane type
        result_df['AGL HEIGHT DET'] = crane_df.get('AGL', '')
        result_df['AMSL HEIGHT DET'] = crane_df.get('AMSL', '')
        result_df['MARKING LIGHTING TYPE'] = crane_df.get('LIGHTING', 'None')
        result_df['SURVEY_ACCURACY'] = crane_df.get('ACCURACY', '4D')
        
        # Convert decimal coordinates to DMS format
        if 'LATDEC' in crane_df.columns and 'LONDEC' in crane_df.columns:
            result_df['LATITUDE'] = crane_df['LATDEC'].apply(lambda x: decimal_to_dms(x, False))
            result_df['LONGITUDE'] = crane_df['LONDEC'].apply(lambda x: decimal_to_dms(x, True))
        elif 'DMSLAT' in crane_df.columns and 'DMSLON' in crane_df.columns:
            # Use existing DMS coordinates if available
            result_df['LATITUDE'] = crane_df['DMSLAT']
            result_df['LONGITUDE'] = crane_df['DMSLON']
        
        # Set default values for missing data
        result_df['STATUS'] = 'Determined'
        result_df['DETERMINATION'] = 'No Hazard'
        result_df['ENTERED DATE'] = datetime.now().strftime('%Y-%m-%d')
        result_df['NOTICE OF'] = 'Existing'
        result_df['DURATION'] = 'Permanent'
        result_df['HORIZONTAL DATUM'] = ''
        result_df['SPONSOR NAME '] = ''  # Note: space at end to match original
        
        # Set elevation from AMSL if available
        if 'AMSL' in crane_df.columns:
            result_df['ELEVATION'] = crane_df['AMSL']
        
        # For crane-specific data, update structure type to include CRANE
        mask = ~result_df['STRUCTURE TYPE'].str.contains('CRANE', case=False, na=False)
        result_df.loc[mask, 'STRUCTURE TYPE'] = 'CRANE$MOBILE'
    
    # Add source indicator
    result_df['DATA_SOURCE'] = 'DOF'
    
    # Filter out rows with missing critical data
    result_df = result_df.dropna(subset=['LATITUDE', 'LONGITUDE'])
    result_df = result_df[result_df['LATITUDE'] != '']
    result_df = result_df[result_df['LONGITUDE'] != '']
    
    print(f"Converted {len(result_df)} obstacle records to datafile format")
    return result_df

def save_datafile(df, output_path):
    """Save the dataframe to the datafile.csv location."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save with robust CSV formatting to handle JSON and special characters
    df.to_csv(
        output_path, 
        index=False,
        quoting=1,  # QUOTE_ALL - quotes all fields
        escapechar='\\',  # Escape special characters
        doublequote=True,  # Handle double quotes properly
        lineterminator='\n'  # Use consistent line endings
    )
    print(f"Saved updated data to {output_path}")

def merge_dataframes(dof_df, part77_dfs):
    """Merge DOF data with Part 77 regional data."""
    all_dfs = []
    
    # Add DOF data if available
    if dof_df is not None and not dof_df.empty:
        all_dfs.append(dof_df)
        print(f"Including {len(dof_df)} DOF records")
    
    # Add Part 77 data and track regional statistics
    regional_stats = {}
    arizona_count_before = 0
    
    for df in part77_dfs:
        if df is not None and not df.empty:
            all_dfs.append(df)
            
            # Track Arizona entries for validation
            if 'DATA_SOURCE' in df.columns and 'STRUCTURE STATE' in df.columns:
                source = df['DATA_SOURCE'].iloc[0] if len(df) > 0 else 'Unknown'
                arizona_in_region = len(df[df['STRUCTURE STATE'] == 'AZ']) if 'STRUCTURE STATE' in df.columns else 0
                arizona_count_before += arizona_in_region
                regional_stats[source] = {'total': len(df), 'arizona': arizona_in_region}
                print(f"Including {len(df)} Part 77 records from {source} ({arizona_in_region} Arizona entries)")
            else:
                print(f"Including {len(df)} Part 77 records")
    
    if not all_dfs:
        print("No data to merge!")
        return pd.DataFrame()
    
    # Combine all dataframes with error handling
    try:
        merged_df = pd.concat(all_dfs, ignore_index=True, sort=False)
        print(f"Successfully merged {len(merged_df)} total records")
    except Exception as e:
        print(f"Error during merge: {e}")
        # Try alternative merge approach
        print("Attempting alternative merge approach...")
        merged_df = pd.DataFrame()
        for df in all_dfs:
            merged_df = pd.concat([merged_df, df], ignore_index=True, sort=False)
        print(f"Alternative merge completed: {len(merged_df)} records")
    
    # Validate Arizona entries are preserved
    arizona_count_after = 0
    if 'STRUCTURE STATE' in merged_df.columns:
        arizona_count_after = len(merged_df[merged_df['STRUCTURE STATE'] == 'AZ'])
        print(f"Arizona entries: {arizona_count_before} before merge, {arizona_count_after} after merge")
        
        if arizona_count_after < arizona_count_before:
            print(f"WARNING: Lost {arizona_count_before - arizona_count_after} Arizona entries during merge!")
    
    # Remove duplicates based on STUDY (ASN) if available
    if 'STUDY (ASN)' in merged_df.columns:
        before_dedup = len(merged_df)
        merged_df = merged_df.drop_duplicates(subset=['STUDY (ASN)'], keep='first')
        after_dedup = len(merged_df)
        print(f"Removed {before_dedup - after_dedup} duplicate records based on STUDY (ASN)")
        
        # Recheck Arizona count after deduplication
        if 'STRUCTURE STATE' in merged_df.columns:
            arizona_final = len(merged_df[merged_df['STRUCTURE STATE'] == 'AZ'])
            print(f"Arizona entries after deduplication: {arizona_final}")
    
    print(f"Final merged dataset: {len(merged_df)} total records")
    return merged_df

def nm_to_degrees(nm: float, latitude: float = 37.0) -> float:
    """Convert nautical miles to approximate degrees."""
    # 1 NM = 1/60 degree latitude
    return nm / 60.0

def generate_notam_grid(spacing_nm: float = 100) -> List[Tuple[float, float]]:
    """Generate a grid of coordinates covering the continental US."""
    spacing_degrees = nm_to_degrees(spacing_nm)
    grid_points = []

    lat = CONUS_BOUNDS['min_lat']
    while lat <= CONUS_BOUNDS['max_lat']:
        lon = CONUS_BOUNDS['min_lon']
        while lon <= CONUS_BOUNDS['max_lon']:
            grid_points.append((lat, lon))
            lon += spacing_degrees
        lat += spacing_degrees

    return grid_points

def get_major_airports() -> List[Tuple[str, float, float]]:
    """
    Dynamically fetch all US medium and large airports from OurAirports database.
    Returns list of (ICAO_code, latitude, longitude) tuples.

    Downloads the latest airport data from OurAirports (public domain, updated nightly)
    and filters for US airports with:
    - Type: medium_airport or large_airport
    - GPS code: Starts with 'K' (continental US ICAO codes)

    This provides comprehensive coverage of ~805 airports to supplement the geographic
    grid search and capture NOTAMs that might not appear in radius searches.
    """
    try:
        print("Downloading OurAirports database...")
        url = "https://davidmegginson.github.io/ourairports-data/airports.csv"
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        # Parse CSV
        df = pd.read_csv(io.StringIO(response.text))
        print(f"Loaded {len(df)} airports from OurAirports database")

        # Filter for US medium and large airports with K prefix ICAO codes
        filtered = df[
            (df['iso_country'] == 'US') &
            (df['type'].isin(['medium_airport', 'large_airport'])) &
            (df['gps_code'].notna()) &
            (df['gps_code'].str.startswith('K', na=False))
        ]

        print(f"Filtered to {len(filtered)} US medium/large airports")

        # Convert to list of tuples (ICAO, lat, lon)
        airports = [
            (row['gps_code'], row['latitude_deg'], row['longitude_deg'])
            for _, row in filtered.iterrows()
        ]

        print(f"Returning {len(airports)} airports for NOTAM search")
        return airports

    except Exception as e:
        print(f"Error fetching OurAirports data: {e}")
        print("Falling back to hardcoded major airports...")
        # Fallback to a minimal set of major airports if download fails
        return [
            ('KATL', 33.6407, -84.4277),   # Atlanta
            ('KORD', 41.9742, -87.9073),   # Chicago O'Hare
            ('KDFW', 32.8998, -97.0403),   # Dallas/Fort Worth
            ('KDEN', 39.8561, -104.6737),  # Denver
            ('KLAX', 33.9416, -118.4085),  # Los Angeles
            ('KSFO', 37.6213, -122.3790),  # San Francisco
            ('KLAS', 36.0840, -115.1537),  # Las Vegas
            ('KPHX', 33.4373, -112.0078),  # Phoenix
            ('KIAH', 29.9902, -95.3368),   # Houston
            ('KMIA', 25.7959, -80.2870),   # Miami
            ('KJFK', 40.6413, -73.7781),   # New York JFK
            ('KEWR', 40.6895, -74.1745),   # Newark
            ('KMCO', 28.4312, -81.3081),   # Orlando
            ('KSEA', 47.4502, -122.3088),  # Seattle
            ('KBOS', 42.3656, -71.0096),   # Boston
            ('KPHL', 39.8744, -75.2424),   # Philadelphia
            ('KDTW', 42.2162, -83.3554),   # Detroit
            ('KMSN', 43.1399, -89.3375),   # Minneapolis
            ('KSLC', 40.7899, -111.9791),  # Salt Lake City
            ('KBWI', 39.1774, -76.6684),   # Baltimore
            ('KTPA', 27.9755, -82.5332),   # Tampa
            ('KPDX', 45.5898, -122.5951),  # Portland
            ('KSAN', 32.7336, -117.1897),  # San Diego
            ('KSTL', 38.7499, -90.3700),   # St. Louis
            ('KCLT', 35.2144, -80.9473),   # Charlotte
            ('KAUS', 30.1945, -97.6699),   # Austin
            ('KBNA', 36.1245, -86.6782),   # Nashville
            ('KOAK', 37.7126, -122.2197),  # Oakland
            ('KSAT', 29.5337, -98.4698),   # San Antonio
            ('KSNA', 33.6762, -117.8681),  # Orange County
        ]

def fetch_notams_for_airport(icao_code: str) -> Optional[Dict]:
    """
    Fetch NOTAMs for a specific airport by ICAO code.
    This supplements the geographic grid search.
    """
    form_data = {
        'searchType': '0',  # ICAO search
        'designatorsForLocation': icao_code,
        'designatorForAccountable': '',
        'retrieveLocId': icao_code,
        'reportType': 'Raw',
        'actionType': 'notamRetrievalByICAOs',
        'formatType': 'DOMESTIC',
        'offset': '0',
        'notamsOnly': 'false',
        'filters': '',
        'archiveDate': '',
        'archiveDesignator': '',
        'radius': '100',  # Also get NOTAMs within 100 NM of the airport
        'sortColumns': '5 false',
        'sortDirection': 'true',
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://notams.aim.faa.gov/notamSearch/nsapp.html',
        'Origin': 'https://notams.aim.faa.gov'
    }

    for attempt in range(NOTAM_MAX_RETRIES):
        try:
            encoded_data = urlencode(form_data)
            response = requests.post(
                NOTAM_API_ENDPOINT,
                data=encoded_data,
                headers=headers,
                timeout=NOTAM_REQUEST_TIMEOUT
            )

            if response.status_code == 200:
                try:
                    return response.json()
                except json.JSONDecodeError:
                    if attempt < NOTAM_MAX_RETRIES - 1:
                        time.sleep(NOTAM_RETRY_DELAY)
                        continue
                    return None
            else:
                if attempt < NOTAM_MAX_RETRIES - 1:
                    time.sleep(NOTAM_RETRY_DELAY)
                    continue
                return None

        except Exception as e:
            if attempt < NOTAM_MAX_RETRIES - 1:
                time.sleep(NOTAM_RETRY_DELAY)
                continue
            return None

    return None

def decimal_to_dms_notam(decimal_degrees: float) -> Dict:
    """Convert decimal degrees to DMS format for NOTAM API."""
    is_positive = decimal_degrees >= 0
    decimal_degrees = abs(decimal_degrees)

    degrees = int(decimal_degrees)
    minutes_decimal = (decimal_degrees - degrees) * 60
    minutes = int(minutes_decimal)
    seconds = (minutes_decimal - minutes) * 60

    return {
        'degrees': degrees,
        'minutes': minutes,
        'seconds': int(seconds),
        'direction': is_positive
    }

def fetch_notams_for_location(lat: float, lon: float, radius: int = 100) -> Optional[Dict]:
    """Fetch NOTAMs for a specific geographic location."""
    lat_dms = decimal_to_dms_notam(lat)
    lon_dms = decimal_to_dms_notam(lon)

    form_data = {
        'searchType': '3',
        'designatorsForLocation': '',
        'designatorForAccountable': '',
        'latDegrees': str(lat_dms['degrees']),
        'latMinutes': str(lat_dms['minutes']),
        'latSeconds': str(lat_dms['seconds']),
        'longDegrees': str(lon_dms['degrees']),
        'longMinutes': str(lon_dms['minutes']),
        'longSeconds': str(lon_dms['seconds']),
        'radius': str(radius),
        'sortColumns': '5 false',
        'sortDirection': 'true',
        'designatorForNotamNumberSearch': '',
        'notamNumber': '',
        'radiusSearchOnDesignator': 'false',
        'radiusSearchDesignator': '',
        'latitudeDirection': 'N' if lat_dms['direction'] else 'S',
        'longitudeDirection': 'W' if not lon_dms['direction'] else 'E',
        'freeFormText': '',
        'flightPathText': '',
        'flightPathDivertAirfields': '',
        'flightPathBuffer': '4',
        'flightPathIncludeNavaids': 'true',
        'flightPathIncludeArtcc': 'false',
        'flightPathIncludeTfr': 'true',
        'flightPathIncludeRegulatory': 'false',
        'flightPathResultsType': 'All NOTAMs',
        'archiveDate': '',
        'archiveDesignator': '',
        'offset': '0',
        'notamsOnly': 'false',
        'filters': '',
        'recaptchaToken': ''
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://notams.aim.faa.gov/notamSearch/nsapp.html',
        'Origin': 'https://notams.aim.faa.gov'
    }

    for attempt in range(NOTAM_MAX_RETRIES):
        try:
            encoded_data = urlencode(form_data)
            response = requests.post(
                NOTAM_API_ENDPOINT,
                data=encoded_data,
                headers=headers,
                timeout=NOTAM_REQUEST_TIMEOUT
            )

            if response.status_code == 200:
                try:
                    return response.json()
                except json.JSONDecodeError:
                    if attempt < NOTAM_MAX_RETRIES - 1:
                        time.sleep(NOTAM_RETRY_DELAY)
                        continue
                    return None
            else:
                if attempt < NOTAM_MAX_RETRIES - 1:
                    time.sleep(NOTAM_RETRY_DELAY)
                    continue
                return None

        except Exception as e:
            if attempt < NOTAM_MAX_RETRIES - 1:
                time.sleep(NOTAM_RETRY_DELAY)
                continue
            return None

    return None

def parse_notam_date(date_str: str) -> Optional[datetime]:
    """Parse NOTAM date string to datetime object."""
    if not date_str or date_str.strip() == '':
        return None

    date_str = date_str.strip()

    if date_str.upper() in ['PERM', 'PERMANENT', 'EST', 'ESTIMATED']:
        return datetime(2099, 12, 31, 23, 59)

    try:
        parts = date_str.split()
        if len(parts) >= 2:
            date_part = parts[0]
            time_part = parts[1]
            month, day, year = date_part.split('/')

            if len(time_part) == 4:
                hour = int(time_part[:2])
                minute = int(time_part[2:])
            else:
                hour = 0
                minute = 0

            return datetime(int(year), int(month), int(day), hour, minute)
        elif len(parts) == 1:
            date_part = parts[0]
            month, day, year = date_part.split('/')
            return datetime(int(year), int(month), int(day), 0, 0)
    except (ValueError, IndexError):
        return None

    return None

def parse_notam_coordinates(notam_geometry: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse NOTAM geometry to extract lat/lng coordinates."""
    if not notam_geometry:
        return None, None

    try:
        coords = json.loads(notam_geometry)
        if isinstance(coords, list) and len(coords) == 2:
            lon, lat = coords
            return lat, lon
    except (json.JSONDecodeError, ValueError):
        pass

    dms_pattern = r'(\d{6})([NS])(\d{7})([EW])'
    match = re.match(dms_pattern, notam_geometry.replace(' ', ''))
    if match:
        lat_dms, lat_dir, lon_dms, lon_dir = match.groups()

        lat_deg = int(lat_dms[0:2])
        lat_min = int(lat_dms[2:4])
        lat_sec = int(lat_dms[4:6])
        lat_decimal = lat_deg + lat_min / 60 + lat_sec / 3600
        if lat_dir == 'S':
            lat_decimal = -lat_decimal

        lon_deg = int(lon_dms[0:3])
        lon_min = int(lon_dms[3:5])
        lon_sec = int(lon_dms[5:7])
        lon_decimal = lon_deg + lon_min / 60 + lon_sec / 3600
        if lon_dir == 'W':
            lon_decimal = -lon_decimal

        return lat_decimal, lon_decimal

    return None, None

def extract_height_from_text(text: str) -> Optional[int]:
    """Extract height in feet from NOTAM text."""
    if not text:
        return None

    patterns = [
        r'(\d+)\s*FT\s+AGL',
        r'\((\d+)FT\s+AGL\)',
        r'<b>\s*AGL:\s*</b>\s*<td>(\d+)\s*feet',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1))

    return None

def filter_crane_notams(notams: List[Dict]) -> List[Dict]:
    """Filter NOTAMs for crane-related obstructions with active date ranges."""
    filtered = []
    current_time = datetime.now()

    for notam in notams:
        feature_name = notam.get('featureName', '')
        keyword = notam.get('keyword', '')
        is_obstruction = (feature_name == 'Obstruction' or keyword == 'OBST')

        if not is_obstruction:
            continue

        traditional_msg = notam.get('traditionalMessageFrom4thWord', '')
        plain_msg = notam.get('plainLanguageMessage', '')
        combined_text = f"{traditional_msg} {plain_msg}".upper()
        has_crane = 'CRANE' in combined_text

        if not has_crane:
            continue

        start_date_str = notam.get('startDate', '')
        end_date_str = notam.get('endDate', '')
        start_date = parse_notam_date(start_date_str)
        end_date = parse_notam_date(end_date_str)

        if start_date is None and end_date is None:
            filtered.append(notam)
            continue

        is_active = True
        if start_date and current_time < start_date:
            is_active = False
        if end_date and current_time > end_date:
            is_active = False

        if is_active:
            filtered.append(notam)

    return filtered

def convert_notams_to_datafile_format(notams: List[Dict]) -> pd.DataFrame:
    """Convert filtered NOTAM data to datafile format."""
    if not notams:
        return pd.DataFrame()

    print(f"Converting {len(notams)} NOTAMs to datafile format")

    output_columns = [
        'STUDY (ASN)', 'PRIOR ASN', 'STATUS', 'DETERMINATION', 'ENTERED DATE',
        'RECEIVED DATE', 'COMPLETION DATE', 'EXPIRATION DATE', 'LATITUDE',
        'LONGITUDE', 'HORIZONTAL DATUM', 'SURVEY_ACCURACY', 'MARKING LIGHTING TYPE',
        'MARKING LIGHTING TYPE OTHER', 'STRUCTURE NAME', 'STRUCTURE CITY',
        'STRUCTURE COUNTY NAME', 'STRUCTURE COUNTY ID', 'STRUCTURE STATE',
        'NEAREST AIRPORT', 'DISTANCE FROM AIRPORT', 'DIRECTION FROM AIRPORT',
        'ON AIRPORT', 'PROPOSAL DESCRIPTION', 'LOCATION DESCRIPTION', 'NOTICE OF',
        'DURATION', 'DURATION DAYS', 'DURATION MONTHS', 'WORK SCHEDULE BEGINNING DATE',
        'WORK SCHEDULE ENDING DATE', 'DATE BUILT', 'FCC NUMBER', 'STRUCTURE TYPE',
        'STRUCTURE TYPE OTHER', 'AGL HEIGHT DET', 'AGL HEIGHT DNE',
        'AGL HEIGHT PROPOSED', 'ELEVATION', 'AMSL HEIGHT DET', 'AMSL HEIGHT DNE',
        'AMSL HEIGHT PROPOSED', 'REPRESENTATIVE NAME ', 'SPONSOR NAME ',
        'SIGNATURE CONTROL NUMBER ', 'FREQUENCY_JSON '
    ]

    rows = []

    for notam in notams:
        notam_geom = notam.get('notamGeometry', '')
        lat_decimal, lon_decimal = parse_notam_coordinates(notam_geom)

        latitude_dms = decimal_to_dms(lat_decimal, is_longitude=False) if lat_decimal else ''
        longitude_dms = decimal_to_dms(lon_decimal, is_longitude=True) if lon_decimal else ''

        combined_text = notam.get('traditionalMessageFrom4thWord', '') + ' ' + notam.get('plainLanguageMessage', '')
        height_agl = extract_height_from_text(combined_text)

        start_date_obj = parse_notam_date(notam.get('startDate', ''))
        end_date_obj = parse_notam_date(notam.get('endDate', ''))
        start_date_str = start_date_obj.strftime('%Y-%m-%d') if start_date_obj else ''
        end_date_str = end_date_obj.strftime('%Y-%m-%d') if end_date_obj else ''

        end_date_raw = notam.get('endDate', '')
        duration = 'Permanent' if 'PERM' in end_date_raw.upper() else 'Temporary'

        row = {
            'STUDY (ASN)': notam.get('notamNumber', 'N/A'),
            'PRIOR ASN': '',
            'STATUS': 'Active NOTAM' if notam.get('status') == 'Active' else notam.get('status', ''),
            'DETERMINATION': 'Obstruction',
            'ENTERED DATE': datetime.now().strftime('%Y-%m-%d'),
            'RECEIVED DATE': '',
            'COMPLETION DATE': '',
            'EXPIRATION DATE': end_date_str,
            'LATITUDE': latitude_dms,
            'LONGITUDE': longitude_dms,
            'HORIZONTAL DATUM': '',
            'SURVEY_ACCURACY': '',
            'MARKING LIGHTING TYPE': '',
            'MARKING LIGHTING TYPE OTHER': '',
            'STRUCTURE NAME': '',
            'STRUCTURE CITY': '',
            'STRUCTURE COUNTY NAME': '',
            'STRUCTURE COUNTY ID': '',
            'STRUCTURE STATE': '',
            'NEAREST AIRPORT': f"{notam.get('facilityDesignator', '')} ({notam.get('airportName', '')})" if notam.get('airportName') else notam.get('facilityDesignator', ''),
            'DISTANCE FROM AIRPORT': '',
            'DIRECTION FROM AIRPORT': '',
            'ON AIRPORT': '',
            'PROPOSAL DESCRIPTION': '',
            'LOCATION DESCRIPTION': notam.get('traditionalMessageFrom4thWord', '')[:100],
            'NOTICE OF': 'Temporary Obstruction',
            'DURATION': duration,
            'DURATION DAYS': '',
            'DURATION MONTHS': '',
            'WORK SCHEDULE BEGINNING DATE': start_date_str,
            'WORK SCHEDULE ENDING DATE': end_date_str,
            'DATE BUILT': '',
            'FCC NUMBER': '',
            'STRUCTURE TYPE': 'CRANE',
            'STRUCTURE TYPE OTHER': '',
            'AGL HEIGHT DET': height_agl if height_agl else '',
            'AGL HEIGHT DNE': '',
            'AGL HEIGHT PROPOSED': '',
            'ELEVATION': '',
            'AMSL HEIGHT DET': '',
            'AMSL HEIGHT DNE': '',
            'AMSL HEIGHT PROPOSED': '',
            'REPRESENTATIVE NAME ': '',
            'SPONSOR NAME ': '',
            'SIGNATURE CONTROL NUMBER ': '',
            'FREQUENCY_JSON ': ''
        }

        rows.append(row)

    df = pd.DataFrame(rows, columns=output_columns)
    df = df.dropna(subset=['LATITUDE', 'LONGITUDE'])
    df = df[df['LATITUDE'] != '']
    df = df[df['LONGITUDE'] != '']

    # Add source indicator
    df['DATA_SOURCE'] = 'NOTAM'

    print(f"Converted {len(df)} NOTAMs to datafile format")
    return df

def fetch_and_process_notams(use_test_grid: bool = False) -> Optional[pd.DataFrame]:
    """Fetch and process NOTAM data."""
    print("=== Processing NOTAM Data ===")

    try:
        # Generate grid
        if use_test_grid:
            print("Using small test grid (4 points)...")
            grid_points = [
                (33.4484, -112.0740),  # Phoenix, AZ
                (40.7128, -74.0060),   # New York, NY
                (29.7604, -95.3698),   # Houston, TX
                (47.6062, -122.3321)   # Seattle, WA
            ]
        else:
            print("Generating NOTAM grid (75 NM spacing for better coverage)...")
            grid_points = generate_notam_grid(spacing_nm=75)

        print(f"Grid points: {len(grid_points)}")
        print(f"Estimated time: {(len(grid_points) * NOTAM_REQUEST_DELAY / 60):.1f} minutes")

        # Fetch all NOTAMs
        all_notams = []
        start_time = time.time()

        for i, (lat, lon) in enumerate(grid_points, 1):
            if i % 10 == 0:
                print(f"Progress: {i}/{len(grid_points)} ({i/len(grid_points)*100:.1f}%)")

            response = fetch_notams_for_location(lat, lon, radius=100)

            if response:
                notams = []
                if isinstance(response, list):
                    notams = response
                elif isinstance(response, dict) and 'notamList' in response:
                    notams = response['notamList']

                all_notams.extend(notams)

            if i < len(grid_points):
                time.sleep(NOTAM_REQUEST_DELAY)

        elapsed_time = time.time() - start_time
        print(f"Grid search complete in {elapsed_time/60:.1f} minutes")
        print(f"NOTAMs from grid search: {len(all_notams)}")

        # Supplement with airport searches for better coverage
        if not use_test_grid:
            print("\n=== Supplementing with Airport Searches ===")
            airports = get_major_airports()
            print(f"Querying {len(airports)} US medium/large airports...")

            airport_start = time.time()
            for i, (icao, lat, lon) in enumerate(airports, 1):
                if i % 5 == 0:
                    print(f"Airport progress: {i}/{len(airports)}")

                response = fetch_notams_for_airport(icao)

                if response:
                    notams = []
                    if isinstance(response, list):
                        notams = response
                    elif isinstance(response, dict) and 'notamList' in response:
                        notams = response['notamList']

                    all_notams.extend(notams)

                if i < len(airports):
                    time.sleep(NOTAM_REQUEST_DELAY)

            airport_elapsed = time.time() - airport_start
            print(f"Airport search complete in {airport_elapsed/60:.1f} minutes")

        total_elapsed = time.time() - start_time
        print(f"\nTotal fetch time: {total_elapsed/60:.1f} minutes")
        print(f"Total NOTAMs collected: {len(all_notams)}")

        # Deduplicate
        seen = set()
        unique_notams = []
        for notam in all_notams:
            notam_number = notam.get('notamNumber', '')
            if notam_number and notam_number not in seen:
                seen.add(notam_number)
                unique_notams.append(notam)

        print(f"Unique NOTAMs: {len(unique_notams)}")

        # Filter for crane-related obstructions
        filtered_notams = filter_crane_notams(unique_notams)
        print(f"Crane-related NOTAMs: {len(filtered_notams)}")

        # Convert to datafile format
        notams_df = convert_notams_to_datafile_format(filtered_notams)

        return notams_df

    except Exception as e:
        print(f"Error processing NOTAM data: {e}")
        return None

def main():
    """Main function to update FAA data."""
    try:
        all_dataframes = []
        
        # Download and process DOF data
        print("=== Processing DOF Data ===")
        try:
            zip_content = download_faa_dof()
            dof_df = extract_csv_from_zip(zip_content)
            print(f"Loaded {len(dof_df)} records from DOF")
            dof_converted = convert_dof_to_datafile_format(dof_df)
            if not dof_converted.empty:
                all_dataframes.append(dof_converted)
        except Exception as e:
            print(f"Error processing DOF data: {e}")
            dof_converted = None
        
        # Download and process Part 77 regional data
        print("\n=== Processing Part 77 Regional Data ===")
        part77_dfs = []

        # Always download fresh regional data to ensure we have the latest updates
        print("Downloading fresh regional data...")
        for region in FAA_REGIONS:
            try:
                content = download_part77_region(region)
                if content:
                    part77_df = extract_part77_csv(content)
                    if part77_df is not None and not part77_df.empty:
                        # Save the fresh regional data for reference
                        local_data_path = "public/data/regions"
                        os.makedirs(local_data_path, exist_ok=True)
                        local_file = f"{local_data_path}/Part77{region}2025List.csv"
                        part77_df.to_csv(local_file, index=False, quoting=1, escapechar='\\', doublequote=True)
                        print(f"Saved fresh {region} data to {local_file}")

                        converted_df = convert_part77_to_datafile_format(part77_df, region)
                        if not converted_df.empty:
                            part77_dfs.append(converted_df)
                            print(f"Successfully processed {region}: {len(converted_df)} records")
                        else:
                            print(f"No crane records found in {region}")
                    else:
                        print(f"Failed to extract data for {region}")
                else:
                    print(f"Failed to download data for {region}")
            except Exception as e:
                print(f"Error processing {region}: {e}")

        # Download and process NOTAM data
        print("\n=== Processing NOTAM Data ===")
        notam_converted = None
        try:
            # Use test grid for quick testing (set to False for production)
            use_test_grid = False
            notam_converted = fetch_and_process_notams(use_test_grid=use_test_grid)
            if notam_converted is not None and not notam_converted.empty:
                all_dataframes.append(notam_converted)
                print(f"Successfully processed NOTAMs: {len(notam_converted)} records")
            else:
                print("No NOTAM records found or processing failed")
        except Exception as e:
            print(f"Error processing NOTAM data: {e}")
            print("Continuing with DOF and Part77 data only")

        # Merge all data (DOF + Part77 + NOTAMs)
        print("\n=== Merging All Data ===")

        # Collect all dataframes for merging
        all_merge_dfs = []
        if dof_converted is not None and not dof_converted.empty:
            all_merge_dfs.append(dof_converted)
        if part77_dfs:
            all_merge_dfs.extend(part77_dfs)
        if notam_converted is not None and not notam_converted.empty:
            all_merge_dfs.append(notam_converted)

        # Use existing merge function for DOF + Part77
        merged_df = merge_dataframes(dof_converted, part77_dfs)

        # Add NOTAMs if available
        if notam_converted is not None and not notam_converted.empty:
            print(f"Adding {len(notam_converted)} NOTAM records to merged dataset")
            merged_df = pd.concat([merged_df, notam_converted], ignore_index=True, sort=False)
            print(f"Total records after adding NOTAMs: {len(merged_df)}")

        if merged_df.empty:
            print("No data to save!")
            return

        # Save the merged datafile
        output_path = "public/data/datafile.csv"
        save_datafile(merged_df, output_path)

        # Also save individual crane and Part 77 files for analysis
        if part77_dfs:
            part77_only = pd.concat(part77_dfs, ignore_index=True)
            part77_output = "public/data/part77-data.csv"
            save_datafile(part77_only, part77_output)
            print(f"Saved Part 77 data separately to {part77_output}")

        # Save NOTAM data separately
        if notam_converted is not None and not notam_converted.empty:
            notam_output = "public/data/notams.csv"
            save_datafile(notam_converted, notam_output)
            print(f"Saved NOTAM data separately to {notam_output}")
        
        # Print summary statistics
        print("\n=== Summary ===")
        if 'DATA_SOURCE' in merged_df.columns:
            source_counts = merged_df['DATA_SOURCE'].value_counts()
            for source, count in source_counts.items():
                print(f"  {source}: {count} records")
        
        # Crane analysis
        if 'STRUCTURE TYPE' in merged_df.columns:
            crane_records = merged_df[merged_df['STRUCTURE TYPE'].str.contains('CRANE', case=False, na=False)]
            print(f"  Total crane-related records: {len(crane_records)}")
        
        print("\nFAA data update completed successfully!")
        
    except Exception as e:
        print(f"Error updating FAA data: {e}")
        raise

if __name__ == "__main__":
    main()