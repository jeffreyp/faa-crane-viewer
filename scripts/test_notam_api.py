#!/usr/bin/env python3
"""
NOTAM API Test Script

Tests the discovered NOTAM Search API endpoint with Phoenix area coordinates.
Based on reverse-engineering browser network traffic.

Usage:
    python3 scripts/test_notam_api.py
"""

import requests
import json
from datetime import datetime
from urllib.parse import urlencode


def decimal_to_dms(decimal_degrees):
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


def test_notam_search_api(lat, lon, radius=10):
    """
    Test the NOTAM Search API with geographic coordinates.

    Args:
        lat: Latitude in decimal degrees (e.g., 33.4484)
        lon: Longitude in decimal degrees (e.g., -112.0740)
        radius: Search radius in nautical miles (default: 10)
    """
    print("="*70)
    print("NOTAM SEARCH API TEST")
    print("="*70)

    # Convert decimal to DMS
    lat_dms = decimal_to_dms(lat)
    lon_dms = decimal_to_dms(lon)

    print(f"\nSearch Parameters:")
    print(f"  Latitude:  {lat}° → {lat_dms['degrees']}° {lat_dms['minutes']}' {lat_dms['seconds']}\" {'N' if lat_dms['direction'] else 'S'}")
    print(f"  Longitude: {lon}° → {lon_dms['degrees']}° {lon_dms['minutes']}' {lon_dms['seconds']}\" {'E' if lon_dms['direction'] else 'W'}")
    print(f"  Radius:    {radius} NM")

    # Prepare form data (matches browser request)
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
        'recaptchaToken': ''  # Try without token first
    }

    endpoint = "https://notams.aim.faa.gov/notamSearch/search"

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://notams.aim.faa.gov/notamSearch/nsapp.html',
        'Origin': 'https://notams.aim.faa.gov'
    }

    print(f"\nEndpoint: {endpoint}")
    print(f"Method: POST")
    print(f"Content-Type: {headers['Content-Type']}")
    print("\nSending request...")

    try:
        # Encode form data
        encoded_data = urlencode(form_data)

        response = requests.post(
            endpoint,
            data=encoded_data,
            headers=headers,
            timeout=30
        )

        print(f"\n✓ Response received!")
        print(f"  Status Code: {response.status_code}")
        print(f"  Content-Type: {response.headers.get('Content-Type', 'unknown')}")
        print(f"  Response Length: {len(response.text)} characters")

        if response.status_code == 200:
            # Try to parse as JSON
            try:
                data = response.json()
                print(f"\n✓ JSON Response parsed successfully!")
                print(f"  Keys: {list(data.keys()) if isinstance(data, dict) else 'Array with ' + str(len(data)) + ' items'}")

                # Save response
                output_file = '/tmp/notam_search_response.json'
                with open(output_file, 'w') as f:
                    json.dump(data, f, indent=2)
                print(f"  ✓ Saved to {output_file}")

                # Analyze structure
                print("\nResponse Structure:")
                print(json.dumps(data, indent=2)[:1000] + "..." if len(json.dumps(data)) > 1000 else json.dumps(data, indent=2))

                # Look for NOTAMs
                if isinstance(data, list):
                    print(f"\n✓ Found {len(data)} results")
                    if len(data) > 0:
                        print(f"\nFirst result sample:")
                        print(json.dumps(data[0], indent=2)[:500])
                elif isinstance(data, dict):
                    # Try common keys
                    for key in ['notamList', 'notams', 'results', 'data', 'items']:
                        if key in data:
                            print(f"\n✓ Found NOTAM data in '{key}' field")
                            print(f"  Count: {len(data[key])}")
                            if len(data[key]) > 0:
                                print(f"\nFirst NOTAM sample:")
                                print(json.dumps(data[key][0], indent=2)[:500])
                            break

                return True

            except json.JSONDecodeError:
                print(f"\n⚠ Response is not JSON")
                print(f"First 500 chars: {response.text[:500]}")

                # Check if it's an error message
                if 'recaptcha' in response.text.lower():
                    print("\n✗ reCAPTCHA required!")
                    print("   The API requires reCAPTCHA verification.")
                elif 'error' in response.text.lower():
                    print("\n✗ API returned an error")

                # Save response anyway
                with open('/tmp/notam_search_response.html', 'w') as f:
                    f.write(response.text)
                print(f"✓ Saved raw response to /tmp/notam_search_response.html")

        elif response.status_code == 403:
            print("\n✗ 403 Forbidden - reCAPTCHA likely required")
        elif response.status_code == 401:
            print("\n✗ 401 Unauthorized - authentication required")
        else:
            print(f"\n⚠ Unexpected status code: {response.status_code}")
            print(f"Response: {response.text[:500]}")

        return False

    except requests.Timeout:
        print("\n✗ Request timed out")
        return False
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def analyze_results():
    """
    Analyze the results and provide recommendations.
    """
    print("\n" + "="*70)
    print("ANALYSIS & NEXT STEPS")
    print("="*70)

    print("""
DISCOVERED API DETAILS:
  Endpoint: https://notams.aim.faa.gov/notamSearch/search
  Method: POST
  Content-Type: application/x-www-form-urlencoded
  Coordinates: DMS format (Degrees, Minutes, Seconds)
  Radius: Nautical miles
  reCAPTCHA: Required (token in request)

POTENTIAL SOLUTIONS IF RECAPTCHA BLOCKS US:

1. Headless Browser Automation (Selenium/Playwright)
   Pros: Can solve reCAPTCHA with human-like interaction
   Cons: Complex, slow, may be detected as bot
   Effort: High

2. reCAPTCHA Solving Services
   Pros: Automated, reliable
   Cons: Costs money (~$1-3 per 1000 CAPTCHAs)
   Effort: Medium
   Examples: 2captcha.com, anti-captcha.com

3. NASA NOTAM API (Recommended)
   URL: https://dip.amesaero.nasa.gov
   Pros: Official, documented, no CAPTCHA, GeoJSON support
   Cons: Requires free registration
   Effort: Low-Medium

4. FAA SWIM/SCDS Service
   URL: https://scds.faa.gov
   Pros: Official FAA data feed
   Cons: Requires account, may require justification
   Effort: Medium-High

5. Contact FAA for API Access
   Email: 9-awa-notamoffice@faa.gov
   Pros: Official access, no CAPTCHA
   Cons: May take time, uncertain approval
   Effort: Medium

RECOMMENDATION:
If the test shows reCAPTCHA is required, pursue NASA NOTAM API as it's
free, official, and designed for programmatic access.

If API works without CAPTCHA, we can proceed with this endpoint!
    """)


if __name__ == '__main__':
    print("FAA NOTAM Search API Test")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Test with Phoenix coordinates
    phoenix_lat = 33.4484
    phoenix_lon = -112.0740

    success = test_notam_search_api(phoenix_lat, phoenix_lon, radius=10)

    analyze_results()

    print("\n" + "="*70)
    print("TEST COMPLETE")
    print("="*70)

    if success:
        print("\n✓ API is accessible! We can proceed with implementation.")
    else:
        print("\n⚠ API access blocked or modified. Review alternatives above.")

    print()
