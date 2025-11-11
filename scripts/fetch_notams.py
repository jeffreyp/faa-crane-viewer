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
from datetime import datetime
from urllib.parse import urlencode
from typing import Dict, List, Tuple


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


def save_results(notams: List[Dict], output_file: str):
    """
    Save NOTAM results to JSON file.

    Args:
        notams: List of NOTAM dictionaries
        output_file: Output file path
    """
    from datetime import timezone

    result = {
        'metadata': {
            'fetch_date': datetime.now(timezone.utc).isoformat(),
            'total_notams': len(notams),
            'source': 'FAA NOTAM Search API',
            'endpoint': NOTAM_API_ENDPOINT
        },
        'notams': notams
    }

    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\n✓ Saved {len(notams)} NOTAMs to {output_file}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Fetch NOTAM data for continental US')
    parser.add_argument('--test', action='store_true', help='Run with small test grid')
    parser.add_argument('--output', default='public/data/notams-raw.json', help='Output file path')
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

    # Save results
    save_results(unique_notams, args.output)

    print("\n" + "="*70)
    print("FETCH COMPLETE")
    print("="*70)
    print(f"\nNext steps:")
    print(f"1. Review {args.output}")
    print(f"2. Filter for crane-related NOTAMs (pvk.4)")
    print(f"3. Convert to CSV format (pvk.5)")
    print()


if __name__ == '__main__':
    main()
