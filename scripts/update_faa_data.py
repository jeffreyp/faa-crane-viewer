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
from datetime import datetime
import tempfile
from pathlib import Path

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

def download_faa_dof():
    """Download the latest FAA Digital Obstacle File (DOF) CSV."""
    url = "https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP"
    
    print(f"Downloading FAA DOF data from {url}...")
    response = requests.get(url, timeout=300)  # 5 minute timeout
    response.raise_for_status()
    
    return response.content

def download_part77_region(region_code):
    """Download Part 77 data for a specific region."""
    url = f"https://oeaaa.faa.gov/oeaaa/oe3a-external-api/downloadArchives.do?fname=OffAirport{region_code}2025List.gzip"
    
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
            return pd.read_csv(io.StringIO(csv_content.decode('utf-8')), low_memory=False, quoting=1, skipinitialspace=True, on_bad_lines='skip')
        except gzip.BadGzipFile:
            # Not a gzip file, try as plain text
            print("Content is not gzipped, trying as plain CSV")
            content_str = content.decode('utf-8')
            
            # Check if it looks like HTML error page
            if content_str.strip().startswith('<!DOCTYPE') or content_str.strip().startswith('<html'):
                print("Received HTML response (likely error page)")
                return None
                
            return pd.read_csv(io.StringIO(content_str), low_memory=False, quoting=1, skipinitialspace=True, on_bad_lines='skip')
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
        
        # Try CSV files first
        if csv_files:
            csv_file = csv_files[0]
            print(f"Extracting CSV file: {csv_file}...")
            with z.open(csv_file) as f:
                return pd.read_csv(f, low_memory=False)
        
        # Try TXT files (often CSV format)
        elif txt_files:
            txt_file = txt_files[0]
            print(f"Extracting TXT file as CSV: {txt_file}...")
            with z.open(txt_file) as f:
                return pd.read_csv(f, low_memory=False)
        
        # Try DAT files (also often CSV format)
        elif dat_files:
            dat_file = dat_files[0]
            print(f"Extracting DAT file as CSV: {dat_file}...")
            with z.open(dat_file) as f:
                return pd.read_csv(f, low_memory=False)
        
        # If no recognizable files, try the first file
        elif z.namelist():
            first_file = z.namelist()[0]
            print(f"No CSV/TXT/DAT found, trying first file: {first_file}...")
            with z.open(first_file) as f:
                return pd.read_csv(f, low_memory=False)
        
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
    
    # Save with the same format as original (no index)
    df.to_csv(output_path, index=False)
    print(f"Saved updated data to {output_path}")

def merge_dataframes(dof_df, part77_dfs):
    """Merge DOF data with Part 77 regional data."""
    all_dfs = []
    
    # Add DOF data if available
    if dof_df is not None and not dof_df.empty:
        all_dfs.append(dof_df)
        print(f"Including {len(dof_df)} DOF records")
    
    # Add Part 77 data
    for df in part77_dfs:
        if df is not None and not df.empty:
            all_dfs.append(df)
            print(f"Including {len(df)} Part 77 records")
    
    if not all_dfs:
        print("No data to merge!")
        return pd.DataFrame()
    
    # Combine all dataframes
    merged_df = pd.concat(all_dfs, ignore_index=True, sort=False)
    
    # Remove duplicates based on STUDY (ASN) if available
    if 'STUDY (ASN)' in merged_df.columns:
        before_dedup = len(merged_df)
        merged_df = merged_df.drop_duplicates(subset=['STUDY (ASN)'], keep='first')
        after_dedup = len(merged_df)
        print(f"Removed {before_dedup - after_dedup} duplicate records based on STUDY (ASN)")
    
    print(f"Final merged dataset: {len(merged_df)} total records")
    return merged_df

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
        
        for region in FAA_REGIONS:
            try:
                content = download_part77_region(region)
                if content:
                    part77_df = extract_part77_csv(content)
                    if part77_df is not None and not part77_df.empty:
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
        
        # Merge all data
        print("\n=== Merging All Data ===")
        merged_df = merge_dataframes(dof_converted, part77_dfs)
        
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