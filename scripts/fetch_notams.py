#!/usr/bin/env python3
"""
NOTAM Fetcher Script for Continental US

Fetches NOTAM data from the FAA NOTAM Search API using a grid-based approach.
Covers continental US (48 states + DC) with ~100 NM spacing searches.

Usage:
    python3 scripts/fetch_notams.py [--test] [--output FILE]

Options:
    --test          Run with small test grid (4 points) instead of full grid
    --output FILE   Output file path (default: public/data/notams-raw.json)
    --radius NM     Search radius in nautical miles (default: 100)
    --spacing NM    Grid spacing in nautical miles (default: 100)

Based on API discovery from pvk.2 task.
"""

import requests
import json
import time
import argparse
import re
import pandas as pd
from datetime import datetime
from urllib.parse import urlencode
from typing import Dict, List, Tuple, Optional


# Continental US boundaries (approximate)
CONUS_BOUNDS = {
    'min_lat': 24.5,   # Southern Florida
    'max_lat': 49.0,   # Northern border (Montana/North Dakota)
    'min_lon': -125.0, # West coast (Washington/Oregon)
    'max_lon': -66.9   # East coast (Maine)
}

# API configuration
NOTAM_API_ENDPOINT = "https://notams.aim.faa.gov/notamSearch/search"
REQUEST_DELAY = 2.0  # Seconds between requests (be nice to the API)
REQUEST_TIMEOUT = 30  # Seconds
MAX_RETRIES = 3
RETRY_DELAY = 5  # Seconds


def decimal_to_dms(decimal_degrees: float) -> Dict[str, any]:
    """
    Convert decimal degrees to DMS (Degrees, Minutes, Seconds) format.

    Args:
        decimal_degrees: Float like 33.448056 or -112.286111

    Returns:
        dict with 'degrees', 'minutes', 'seconds', 'direction'
    """
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


def nm_to_degrees(nm: float, latitude: float = 37.0) -> float:
    """
    Convert nautical miles to approximate degrees.

    1 NM = 1 minute of latitude = 1/60 degree latitude
    Longitude spacing varies by latitude (cos(lat) factor)

    Args:
        nm: Distance in nautical miles
        latitude: Reference latitude for longitude conversion

    Returns:
        Approximate degrees
    """
    import math

    # Latitude: 1 NM = 1/60 degree (constant)
    lat_degrees = nm / 60.0

    # For longitude, we'll use the average at the given latitude
    # This is approximate but good enough for grid generation
    return lat_degrees


def generate_grid(spacing_nm: float = 100, bounds: Dict = None) -> List[Tuple[float, float]]:
    """
    Generate a grid of coordinates covering the continental US.

    Args:
        spacing_nm: Grid spacing in nautical miles (default: 100)
        bounds: Dictionary with min_lat, max_lat, min_lon, max_lon

    Returns:
        List of (latitude, longitude) tuples
    """
    if bounds is None:
        bounds = CONUS_BOUNDS

    # Convert spacing to degrees (approximate)
    spacing_degrees = nm_to_degrees(spacing_nm)

    grid_points = []

    lat = bounds['min_lat']
    while lat <= bounds['max_lat']:
        lon = bounds['min_lon']
        while lon <= bounds['max_lon']:
            grid_points.append((lat, lon))
            lon += spacing_degrees
        lat += spacing_degrees

    return grid_points


def generate_test_grid() -> List[Tuple[float, float]]:
    """
    Generate a small test grid with 4 points covering different regions.

    Returns:
        List of (latitude, longitude) tuples
    """
    return [
        (33.4484, -112.0740),  # Phoenix, AZ
        (40.7128, -74.0060),   # New York, NY
        (29.7604, -95.3698),   # Houston, TX
        (47.6062, -122.3321)   # Seattle, WA
    ]


def fetch_notams_for_location(lat: float, lon: float, radius: int = 100) -> Dict:
    """
    Fetch NOTAMs for a specific geographic location.

    Args:
        lat: Latitude in decimal degrees
        lon: Longitude in decimal degrees
        radius: Search radius in nautical miles

    Returns:
        Dictionary with response data or None on failure
    """
    # Convert to DMS format
    lat_dms = decimal_to_dms(lat)
    lon_dms = decimal_to_dms(lon)

    # Prepare form data (matches browser request from pvk.2)
    form_data = {
        'searchType': '3',  # Geographic search
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
        'minRunwayLength': '',
        'minRunwayWidth': '',
        'runwaySurfaceTypes': '',
        'predefinedAbraka': '',
        'predefinedDabra': '',
        'flightPathAddlBuffer': '',
        'recaptchaToken': ''  # Empty token works (discovered in pvk.2)
    }

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://notams.aim.faa.gov/notamSearch/nsapp.html',
        'Origin': 'https://notams.aim.faa.gov'
    }

    # Retry logic
    for attempt in range(MAX_RETRIES):
        try:
            encoded_data = urlencode(form_data)

            response = requests.post(
                NOTAM_API_ENDPOINT,
                data=encoded_data,
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    return data
                except json.JSONDecodeError:
                    print(f"  ⚠ Non-JSON response at ({lat:.4f}, {lon:.4f})")
                    if attempt < MAX_RETRIES - 1:
                        print(f"    Retrying in {RETRY_DELAY}s...")
                        time.sleep(RETRY_DELAY)
                        continue
                    return None
            else:
                print(f"  ⚠ HTTP {response.status_code} at ({lat:.4f}, {lon:.4f})")
                if attempt < MAX_RETRIES - 1:
                    print(f"    Retrying in {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                    continue
                return None

        except requests.Timeout:
            print(f"  ⚠ Timeout at ({lat:.4f}, {lon:.4f})")
            if attempt < MAX_RETRIES - 1:
                print(f"    Retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
                continue
            return None

        except Exception as e:
            print(f"  ✗ Error at ({lat:.4f}, {lon:.4f}): {e}")
            if attempt < MAX_RETRIES - 1:
                print(f"    Retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
                continue
            return None

    return None


def deduplicate_notams(all_notams: List[Dict]) -> List[Dict]:
    """
    Deduplicate NOTAMs by notamNumber.

    Grid searches will return overlapping results, so we need to deduplicate.

    Args:
        all_notams: List of NOTAM dictionaries

    Returns:
        Deduplicated list of NOTAMs
    """
    seen = set()
    unique_notams = []

    for notam in all_notams:
        notam_number = notam.get('notamNumber', '')
        if notam_number and notam_number not in seen:
            seen.add(notam_number)
            unique_notams.append(notam)

    return unique_notams


def parse_notam_date(date_str: str) -> datetime:
    """
    Parse NOTAM date string to datetime object.

    NOTAM dates come in formats like:
    - "05/14/2025 1443" (MM/DD/YYYY HHmm)
    - "PERM" (permanent - treat as far future)
    - "EST" (estimated - treat as far future)

    Args:
        date_str: Date string from NOTAM

    Returns:
        datetime object, or None if unparseable
    """
    if not date_str or date_str.strip() == '':
        return None

    date_str = date_str.strip()

    # Handle special cases
    if date_str.upper() in ['PERM', 'PERMANENT']:
        # Permanent - use far future date (2099)
        return datetime(2099, 12, 31, 23, 59)

    if date_str.upper() in ['EST', 'ESTIMATED']:
        # Estimated - use far future date
        return datetime(2099, 12, 31, 23, 59)

    # Parse standard format: "05/14/2025 1443"
    try:
        # Split date and time
        parts = date_str.split()
        if len(parts) >= 2:
            date_part = parts[0]  # "05/14/2025"
            time_part = parts[1]  # "1443"

            # Parse date
            month, day, year = date_part.split('/')

            # Parse time (HHmm format)
            if len(time_part) == 4:
                hour = int(time_part[:2])
                minute = int(time_part[2:])
            else:
                hour = 0
                minute = 0

            return datetime(int(year), int(month), int(day), hour, minute)
        elif len(parts) == 1:
            # Just date, no time
            date_part = parts[0]
            month, day, year = date_part.split('/')
            return datetime(int(year), int(month), int(day), 0, 0)
    except (ValueError, IndexError) as e:
        print(f"  ⚠ Could not parse date '{date_str}': {e}")
        return None

    return None


def filter_crane_notams(notams: List[Dict]) -> List[Dict]:
    """
    Filter NOTAMs for crane-related obstructions with active date ranges.

    Filtering criteria (matching pvk.4 requirements):
    1. featureName == "Obstruction" OR keyword == "OBST"
    2. Text contains "CRANE" (case-insensitive)
    3. Current date is within start/end date range

    Args:
        notams: List of all NOTAM dictionaries

    Returns:
        Filtered list of crane-related obstruction NOTAMs
    """
    filtered = []
    current_time = datetime.now()

    print(f"\nFiltering NOTAMs for crane-related obstructions...")
    print(f"Current time: {current_time.strftime('%Y-%m-%d %H:%M')}")

    for notam in notams:
        # Filter 1: Check if it's an obstruction
        feature_name = notam.get('featureName', '')
        keyword = notam.get('keyword', '')

        is_obstruction = (feature_name == 'Obstruction' or keyword == 'OBST')

        if not is_obstruction:
            continue

        # Filter 2: Check if text contains "CRANE"
        traditional_msg = notam.get('traditionalMessageFrom4thWord', '')
        plain_msg = notam.get('plainLanguageMessage', '')
        combined_text = f"{traditional_msg} {plain_msg}".upper()

        has_crane = 'CRANE' in combined_text

        if not has_crane:
            continue

        # Filter 3: Check if NOTAM is currently active
        start_date_str = notam.get('startDate', '')
        end_date_str = notam.get('endDate', '')

        start_date = parse_notam_date(start_date_str)
        end_date = parse_notam_date(end_date_str)

        # If we can't parse dates, include it (be permissive)
        if start_date is None and end_date is None:
            print(f"  ⚠ Including NOTAM {notam.get('notamNumber', 'N/A')} - could not parse dates")
            filtered.append(notam)
            continue

        # Check if current time is within range
        is_active = True

        if start_date and current_time < start_date:
            is_active = False  # Not yet active

        if end_date and current_time > end_date:
            is_active = False  # Expired

        if is_active:
            filtered.append(notam)

    print(f"✓ Filtered to {len(filtered)} crane-related obstruction NOTAMs")
    print(f"  Removed: {len(notams) - len(filtered)} non-crane or inactive NOTAMs")

    return filtered


def decimal_to_dms_format(decimal_degrees: float, is_longitude: bool = False) -> str:
    """
    Convert decimal degrees to DMS format expected by the CSV.

    Args:
        decimal_degrees: Float like 33.448056 or -112.286111
        is_longitude: True if this is a longitude value

    Returns:
        String like "33 - 26 - 53.00 N" or "112 - 17 - 10.00 W"
    """
    if decimal_degrees is None:
        return ''

    abs_deg = abs(decimal_degrees)
    degrees = int(abs_deg)
    minutes = int((abs_deg - degrees) * 60)
    seconds = ((abs_deg - degrees) * 60 - minutes) * 60

    # Determine direction
    if is_longitude:
        direction = 'W' if decimal_degrees < 0 else 'E'
    else:
        direction = 'S' if decimal_degrees < 0 else 'N'

    return f"{degrees:02d} - {minutes:02d} - {seconds:05.2f} {direction}"


def extract_height_from_text(text: str) -> Optional[int]:
    """
    Extract height in feet from NOTAM text.

    Looks for patterns like:
    - "203FT AGL"
    - "(203FT AGL)"
    - "203 feet"

    Args:
        text: NOTAM message text

    Returns:
        Height in feet as integer, or None if not found
    """
    if not text:
        return None

    # Look for patterns like "203FT AGL" or "203 feet"
    patterns = [
        r'(\d+)\s*FT\s+AGL',  # "203FT AGL"
        r'\((\d+)FT\s+AGL\)',  # "(203FT AGL)"
        r'<b>\s*AGL:\s*</b>\s*<td>(\d+)\s*feet',  # HTML table format
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1))

    return None


def parse_notam_coordinates(notam_geometry: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Parse NOTAM geometry to extract lat/lng coordinates.

    Args:
        notam_geometry: JSON array string like "[-94.0207,29.9508]" or
                       DMS string like "295943N0940206W"

    Returns:
        Tuple of (latitude, longitude) in decimal degrees, or (None, None)
    """
    if not notam_geometry:
        return None, None

    # Try parsing as JSON array first
    try:
        coords = json.loads(notam_geometry)
        if isinstance(coords, list) and len(coords) == 2:
            lon, lat = coords  # Note: GeoJSON is [lon, lat]
            return lat, lon
    except (json.JSONDecodeError, ValueError):
        pass

    # Try parsing DMS format like "295943N0940206W"
    # Format: DDMMSSN/SDDDMMSSW/E
    dms_pattern = r'(\d{6})([NS])(\d{7})([EW])'
    match = re.match(dms_pattern, notam_geometry.replace(' ', ''))
    if match:
        lat_dms, lat_dir, lon_dms, lon_dir = match.groups()

        # Parse latitude
        lat_deg = int(lat_dms[0:2])
        lat_min = int(lat_dms[2:4])
        lat_sec = int(lat_dms[4:6])
        lat_decimal = lat_deg + lat_min / 60 + lat_sec / 3600
        if lat_dir == 'S':
            lat_decimal = -lat_decimal

        # Parse longitude
        lon_deg = int(lon_dms[0:3])
        lon_min = int(lon_dms[3:5])
        lon_sec = int(lon_dms[5:7])
        lon_decimal = lon_deg + lon_min / 60 + lon_sec / 3600
        if lon_dir == 'W':
            lon_decimal = -lon_decimal

        return lat_decimal, lon_decimal

    return None, None


def convert_notams_to_csv(notams: List[Dict]) -> pd.DataFrame:
    """
    Convert filtered NOTAM data to CSV format matching DOF/Part77 structure.

    This follows the pattern from update_faa_data.py convert functions.

    Args:
        notams: List of filtered NOTAM dictionaries

    Returns:
        pandas DataFrame with CSV columns matching DOF/Part77 format
    """
    print(f"\nConverting {len(notams)} NOTAMs to CSV format...")

    # Define expected CSV columns (matching DOF/Part77 format)
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
        'SIGNATURE CONTROL NUMBER ', 'FREQUENCY_JSON ', 'DATA_SOURCE'
    ]

    rows = []

    for notam in notams:
        # Extract coordinates
        notam_geom = notam.get('notamGeometry', '')
        lat_decimal, lon_decimal = parse_notam_coordinates(notam_geom)

        # Convert to DMS format
        latitude_dms = decimal_to_dms_format(lat_decimal, is_longitude=False) if lat_decimal else ''
        longitude_dms = decimal_to_dms_format(lon_decimal, is_longitude=True) if lon_decimal else ''

        # Extract height from text
        combined_text = notam.get('traditionalMessageFrom4thWord', '') + ' ' + notam.get('plainLanguageMessage', '')
        height_agl = extract_height_from_text(combined_text)

        # Parse dates
        start_date_obj = parse_notam_date(notam.get('startDate', ''))
        end_date_obj = parse_notam_date(notam.get('endDate', ''))

        start_date_str = start_date_obj.strftime('%Y-%m-%d') if start_date_obj else ''
        end_date_str = end_date_obj.strftime('%Y-%m-%d') if end_date_obj else ''

        # Determine duration
        end_date_raw = notam.get('endDate', '')
        if 'PERM' in end_date_raw.upper():
            duration = 'Permanent'
        else:
            duration = 'Temporary'

        # Build row
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
            'FREQUENCY_JSON ': '',
            'DATA_SOURCE': 'NOTAM'
        }

        rows.append(row)

    # Create DataFrame
    df = pd.DataFrame(rows, columns=output_columns)

    # Filter out rows with missing critical data
    df = df.dropna(subset=['LATITUDE', 'LONGITUDE'])
    df = df[df['LATITUDE'] != '']
    df = df[df['LONGITUDE'] != '']

    print(f"✓ Converted {len(df)} NOTAMs to CSV format")
    if len(df) < len(notams):
        print(f"  ⚠ Dropped {len(notams) - len(df)} NOTAMs due to missing coordinates")

    return df


def fetch_all_notams(grid_points: List[Tuple[float, float]], radius: int = 100) -> List[Dict]:
    """
    Fetch NOTAMs for all grid points with rate limiting.

    Args:
        grid_points: List of (lat, lon) tuples
        radius: Search radius in nautical miles

    Returns:
        List of all NOTAMs (with duplicates)
    """
    all_notams = []
    total_points = len(grid_points)

    print(f"\nFetching NOTAMs from {total_points} grid points...")
    print(f"Search radius: {radius} NM")
    print(f"Estimated time: {(total_points * REQUEST_DELAY / 60):.1f} minutes")
    print("="*70)

    start_time = time.time()

    for i, (lat, lon) in enumerate(grid_points, 1):
        # Progress indicator
        print(f"[{i}/{total_points}] Querying ({lat:.4f}, {lon:.4f})...", end=' ')

        # Fetch NOTAMs
        response = fetch_notams_for_location(lat, lon, radius)

        if response:
            # Extract NOTAMs from response
            notams = []

            if isinstance(response, list):
                notams = response
            elif isinstance(response, dict) and 'notamList' in response:
                notams = response['notamList']

            count = len(notams)
            all_notams.extend(notams)
            print(f"✓ {count} NOTAMs")
        else:
            print(f"✗ Failed")

        # Rate limiting (except for last request)
        if i < total_points:
            time.sleep(REQUEST_DELAY)

    elapsed_time = time.time() - start_time
    print("="*70)
    print(f"Fetching complete in {elapsed_time/60:.1f} minutes")
    print(f"Total NOTAMs collected: {len(all_notams)} (before deduplication)")

    return all_notams


def save_csv(df: pd.DataFrame, output_file: str):
    """
    Save NOTAM DataFrame to CSV file matching DOF/Part77 format.

    Args:
        df: pandas DataFrame with NOTAM data
        output_file: Output CSV file path
    """
    import os

    # Create directory if needed
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Save with robust CSV formatting (matching update_faa_data.py pattern)
    df.to_csv(
        output_file,
        index=False,
        quoting=1,  # QUOTE_ALL - quotes all fields
        escapechar='\\',  # Escape special characters
        doublequote=True,  # Handle double quotes properly
        lineterminator='\n'  # Use consistent line endings
    )

    print(f"\n✓ Saved {len(df)} NOTAMs to {output_file}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Fetch NOTAM data for continental US')
    parser.add_argument('--test', action='store_true', help='Run with small test grid')
    parser.add_argument('--output', default='public/data/notams.csv', help='Output CSV file path')
    parser.add_argument('--radius', type=int, default=100, help='Search radius in NM')
    parser.add_argument('--spacing', type=int, default=100, help='Grid spacing in NM')

    args = parser.parse_args()

    print("="*70)
    print("FAA NOTAM FETCHER")
    print("="*70)
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode: {'TEST' if args.test else 'PRODUCTION'}")
    print(f"Output: {args.output}")

    # Generate grid
    if args.test:
        print("\nGenerating test grid (4 points)...")
        grid_points = generate_test_grid()
    else:
        print(f"\nGenerating grid (spacing: {args.spacing} NM)...")
        grid_points = generate_grid(spacing_nm=args.spacing)

    print(f"Grid points: {len(grid_points)}")

    # Fetch all NOTAMs
    all_notams = fetch_all_notams(grid_points, radius=args.radius)

    # Deduplicate
    print(f"\nDeduplicating NOTAMs...")
    unique_notams = deduplicate_notams(all_notams)
    print(f"Unique NOTAMs: {len(unique_notams)}")
    print(f"Duplicates removed: {len(all_notams) - len(unique_notams)}")

    # Filter for crane-related obstructions (pvk.4)
    filtered_notams = filter_crane_notams(unique_notams)

    # Convert to CSV format (pvk.5)
    notams_df = convert_notams_to_csv(filtered_notams)

    # Save CSV file
    save_csv(notams_df, args.output)

    print("\n" + "="*70)
    print("FETCH COMPLETE")
    print("="*70)
    print(f"\nNext steps:")
    print(f"1. Review {args.output}")
    print(f"2. Integrate into update_faa_data.py (pvk.6)")
    print(f"3. Add frontend loading (pvk.7)")
    print()


if __name__ == '__main__':
    main()
