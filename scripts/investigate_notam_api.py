#!/usr/bin/env python3
"""
NOTAM API Investigation Script

This script tests different approaches to fetching NOTAM data:
1. Old PilotWeb endpoint (pilotweb.nas.faa.gov) - airport-based
2. New NOTAM Search endpoint (notams.aim.faa.gov) - geographic search

Run this to determine which approach is feasible for our crane viewer.
"""

import requests
import json
from datetime import datetime

def test_pilotweb_api():
    """
    Test the old PilotWeb NOTAM API
    This is airport-based, not geographic
    """
    print("\n" + "="*70)
    print("TEST 1: Old PilotWeb API (pilotweb.nas.faa.gov)")
    print("="*70)

    url = "https://pilotweb.nas.faa.gov/PilotWeb/notamRetrievalByICAOAction.do"

    # Test with Phoenix Sky Harbor (KPHX)
    params = {
        'reportType': 'RAW',
        'method': 'displayByICAOs',
        'actionType': 'notamRetrievalByICAOs',
        'retrieveLocId': 'KPHX',
        'formatType': 'ICAO'
    }

    print(f"\nEndpoint: {url}")
    print(f"Parameters: {json.dumps(params, indent=2)}")
    print("\nSending request...")

    try:
        response = requests.get(url, params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Length: {len(response.text)} characters")

        # Check if we got HTML or data
        if 'html' in response.text.lower()[:100]:
            print("\n✓ Received HTML response")

            # Look for NOTAMs in the response
            if 'NOTAM' in response.text or 'notam' in response.text:
                print("✓ Response contains NOTAM data")

                # Save sample to file
                with open('/tmp/pilotweb_response.html', 'w') as f:
                    f.write(response.text)
                print("✓ Saved response to /tmp/pilotweb_response.html")

                # Try to find obstruction NOTAMs
                if 'OBST' in response.text or 'CRANE' in response.text.upper():
                    print("✓ Found obstruction/crane references!")
                else:
                    print("⚠ No obstruction/crane references found in this sample")
            else:
                print("✗ No NOTAM data found in response")
        else:
            print("⚠ Response doesn't appear to be HTML")
            print(f"First 500 chars: {response.text[:500]}")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_notam_search_api():
    """
    Test the new NOTAM Search API
    Attempt to reverse-engineer geographic search
    """
    print("\n" + "="*70)
    print("TEST 2: New NOTAM Search API (notams.aim.faa.gov)")
    print("="*70)

    # Common possible endpoint patterns
    endpoints = [
        "https://notams.aim.faa.gov/notamSearch/search",
        "https://notams.aim.faa.gov/notamSearch/api/search",
        "https://notams.aim.faa.gov/notamSearch/nsapp/search",
        "https://notams.aim.faa.gov/api/notams/search",
    ]

    # Phoenix coordinates
    test_payload = {
        "searchType": "geography",
        "latitude": 33.4484,
        "longitude": -112.0740,
        "radius": 10,
        "radiusUnit": "NM",
        "class": "obstruction"
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    }

    for endpoint in endpoints:
        print(f"\nTrying endpoint: {endpoint}")

        try:
            # Try POST
            response = requests.post(
                endpoint,
                json=test_payload,
                headers=headers,
                timeout=30
            )

            print(f"  POST Status: {response.status_code}")

            if response.status_code == 200:
                print(f"  ✓ Success! Response length: {len(response.text)}")
                print(f"  Response preview: {response.text[:200]}")

                # Save response
                with open('/tmp/notam_search_response.json', 'w') as f:
                    f.write(response.text)
                print(f"  ✓ Saved to /tmp/notam_search_response.json")
                return True

            elif response.status_code == 404:
                print(f"  ✗ Not found")
            elif response.status_code == 403:
                print(f"  ✗ Forbidden")
            else:
                print(f"  ⚠ Unexpected status: {response.text[:200]}")

        except requests.Timeout:
            print(f"  ✗ Timeout")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    print("\n⚠ Could not find working endpoint. Manual investigation needed.")
    print("   Recommendation: Open browser DevTools and inspect network traffic")
    return False


def test_notam_wfs_service():
    """
    Test the NOTAM WFS service
    """
    print("\n" + "="*70)
    print("TEST 3: NOTAM WFS Service")
    print("="*70)

    url = "https://notams.aim.faa.gov/notamWFS/services/notamWFS"

    print(f"\nEndpoint: {url}")
    print("Attempting to access WFS service...")

    try:
        # Try GetCapabilities request
        params = {
            'service': 'WFS',
            'request': 'GetCapabilities'
        }

        response = requests.get(url, params=params, timeout=30)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            print("✓ WFS service is accessible")
            print(f"Response length: {len(response.text)} characters")

            with open('/tmp/notam_wfs_capabilities.xml', 'w') as f:
                f.write(response.text)
            print("✓ Saved capabilities to /tmp/notam_wfs_capabilities.xml")
            return True
        else:
            print(f"✗ Service returned status {response.status_code}")

    except Exception as e:
        print(f"✗ Error: {e}")

    return False


def analyze_feasibility():
    """
    Provide feasibility analysis based on test results
    """
    print("\n" + "="*70)
    print("FEASIBILITY ANALYSIS")
    print("="*70)

    print("\n📊 Summary:")
    print("\nApproach 1: PilotWeb API (airport-based)")
    print("  Pros: Simple, may still work, well-documented")
    print("  Cons: Airport-based only (not geographic), may be deprecated")
    print("  Feasibility: Low - doesn't meet geographic search requirement")

    print("\nApproach 2: NOTAM Search API (geographic)")
    print("  Pros: Supports geographic search (lat/lng/radius)")
    print("  Cons: Undocumented, requires reverse engineering")
    print("  Feasibility: Unknown - needs manual browser inspection")

    print("\nApproach 3: WFS Service")
    print("  Pros: Standards-based (OGC WFS)")
    print("  Cons: May require registration, complex XML")
    print("  Feasibility: Medium - if accessible")

    print("\n" + "="*70)
    print("RECOMMENDED NEXT STEPS")
    print("="*70)
    print("""
1. Manual Browser Investigation:
   - Open https://notams.aim.faa.gov/notamSearch/nsapp.html#/results
   - Open Browser DevTools → Network tab
   - Perform a geographic search with:
     * Latitude: 33.4484
     * Longitude: -112.0740
     * Radius: 10 NM
   - Look for XHR/Fetch requests
   - Document:
     * Endpoint URL
     * Request method (GET/POST)
     * Request payload/parameters
     * Response format

2. Alternative: Airport-Grid Approach
   If geographic API unavailable:
   - Load all US airport ICAO codes (~5000 airports)
   - Query PilotWeb API for each airport
   - Filter for obstruction NOTAMs containing "CRANE"
   - Deduplicate results
   - Pros: Uses known working API
   - Cons: Many API calls, may miss cranes far from airports

3. Alternative: NASA NOTAM API
   - Register for NASA DIP service
   - Use their structured NOTAM API
   - Pros: Official, documented, GeoJSON support
   - Cons: Requires registration
    """)


if __name__ == '__main__':
    print("="*70)
    print("FAA NOTAM API INVESTIGATION")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)

    # Run tests
    pilotweb_works = test_pilotweb_api()
    notam_search_works = test_notam_search_api()
    wfs_works = test_notam_wfs_service()

    # Analyze
    analyze_feasibility()

    print("\n" + "="*70)
    print("INVESTIGATION COMPLETE")
    print("="*70)
    print(f"\nResults:")
    print(f"  PilotWeb API: {'✓ Works' if pilotweb_works else '✗ Failed'}")
    print(f"  NOTAM Search API: {'✓ Works' if notam_search_works else '✗ Failed/Unknown'}")
    print(f"  WFS Service: {'✓ Works' if wfs_works else '✗ Failed'}")
    print()
