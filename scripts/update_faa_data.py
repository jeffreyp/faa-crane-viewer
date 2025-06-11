#!/usr/bin/env python3
"""
FAA Obstacle Data Updater
Downloads the latest FAA Digital Obstacle File (DOF) and converts it to match 
the current datafile.csv format used by the crane viewer application.
"""

import requests
import zipfile
import pandas as pd
import io
import os
from datetime import datetime

def download_faa_dof():
    """Download the latest FAA Digital Obstacle File (DOF) CSV."""
    url = "https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP"
    
    print(f"Downloading FAA DOF data from {url}...")
    response = requests.get(url, timeout=300)  # 5 minute timeout
    response.raise_for_status()
    
    return response.content

def extract_csv_from_zip(zip_content):
    """Extract CSV data from the ZIP file."""
    with zipfile.ZipFile(io.BytesIO(zip_content)) as z:
        # Find the CSV file in the zip
        csv_files = [f for f in z.namelist() if f.endswith('.csv')]
        if not csv_files:
            raise ValueError("No CSV file found in the ZIP archive")
        
        csv_file = csv_files[0]
        print(f"Extracting {csv_file}...")
        
        with z.open(csv_file) as f:
            return pd.read_csv(f, low_memory=False)

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
        'LONGITUTDE', 'HORIZONTAL DATUM', 'SURVEY_ACCURACY', 'MARKING LIGHTING TYPE', 
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
            result_df['LONGITUTDE'] = crane_df['LONDEC'].apply(lambda x: decimal_to_dms(x, True))
        elif 'DMSLAT' in crane_df.columns and 'DMSLON' in crane_df.columns:
            # Use existing DMS coordinates if available
            result_df['LATITUDE'] = crane_df['DMSLAT']
            result_df['LONGITUTDE'] = crane_df['DMSLON']
        
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
    
    # Filter out rows with missing critical data
    result_df = result_df.dropna(subset=['LATITUDE', 'LONGITUTDE'])
    result_df = result_df[result_df['LATITUDE'] != '']
    result_df = result_df[result_df['LONGITUTDE'] != '']
    
    print(f"Converted {len(result_df)} obstacle records to datafile format")
    return result_df

def save_datafile(df, output_path):
    """Save the dataframe to the datafile.csv location."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save with the same format as original (no index)
    df.to_csv(output_path, index=False)
    print(f"Saved updated data to {output_path}")

def main():
    """Main function to update FAA data."""
    try:
        # Download the latest DOF data
        zip_content = download_faa_dof()
        
        # Extract CSV from ZIP
        dof_df = extract_csv_from_zip(zip_content)
        print(f"Loaded {len(dof_df)} records from DOF")
        
        # Convert to datafile format
        datafile_df = convert_dof_to_datafile_format(dof_df)
        
        # Save the updated datafile
        output_path = "public/data/datafile.csv"
        save_datafile(datafile_df, output_path)
        
        print("FAA data update completed successfully!")
        
    except Exception as e:
        print(f"Error updating FAA data: {e}")
        raise

if __name__ == "__main__":
    main()