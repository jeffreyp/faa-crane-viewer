#!/usr/bin/env python3
"""
Fetch active crane NOTAMs from the FAA NOTAM Management Service (NMS) API.

Keeps currently active crane obstructions and writes them in the frontend's
standard crane record shape to public/data/notam-cranes.json.

The FAA allows at most one bulk pull per 24 hours (more needs FAA approval), so:
  - If the previous file's bulk pull is 24+ hours old (or there is no previous
    file), download the bulk file of all active DOMESTIC NOTAMs.
  - Otherwise, start from the previous file and apply the NOTAMs changed since
    it was generated (lastUpdatedDate query, limited to the last 24 hours).
The previous file is read from the deployed site (PREVIOUS_NOTAM_URL), since
notam-cranes.json is not committed.

Runs in GitHub Actions (see .github/workflows/update-faa-data.yml). NMS blocks
requests from Cloudflare Workers, so NOTAMs can't be proxied on demand.

Environment:
  NMS_CLIENT_ID, NMS_CLIENT_SECRET  OAuth2 client credentials (the KEY and
                                    SECRET from the NMS onboarding spreadsheet)
  NMS_HOST                          Optional. Defaults to production; staging
                                    is https://api-staging.cgifederal-aim.com
  PREVIOUS_NOTAM_URL                Optional. URL of the currently deployed
                                    notam-cranes.json
"""

import gzip
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

import requests

DEFAULT_NMS_HOST = 'https://api-nms.aim.faa.gov'
# FAA production limit: at most one bulk pull per 24 hours
BULK_INTERVAL = timedelta(hours=24)
# lastUpdatedDate may not be more than 24 hours back; overlap runs by a few minutes
MAX_DELTA_WINDOW = timedelta(hours=23, minutes=50)
DELTA_OVERLAP = timedelta(minutes=10)
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'notam-cranes.json')
USER_AGENT = 'FAA-Crane-Viewer/1.0 (+https://jeffreyp.github.io/faa-crane-viewer)'

# DMS coordinates in NOTAM text, e.g. "474523N1221521W" or "474523.40N 1221521.10W"
COORD_RE = re.compile(r'(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])\s*(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])')
HEIGHT_RE = re.compile(r'\((\d+)\s*FT AGL\)|(\d+)\s*FT AGL', re.IGNORECASE)


def get_access_token(session, host, client_id, client_secret):
    response = session.post(
        f'{host}/v1/auth/token',
        data={'grant_type': 'client_credentials'},
        auth=(client_id.strip(), client_secret.strip()),
        timeout=60,
    )
    if not response.ok:
        raise RuntimeError(f'NMS token request returned {response.status_code}: {response.text[:300]}')
    token = response.json().get('access_token')
    if not token:
        raise RuntimeError('NMS token response did not include an access_token')
    return token


def download_domestic_notams(session, host, token):
    """Download and decode the bulk file of all active DOMESTIC NOTAMs"""
    auth_headers = {'Authorization': f'Bearer {token}'}

    # Without redirects, NMS returns a short-lived relative content path in the body
    response = session.get(
        f'{host}/nmsapi/v1/notams',
        params={'classification': 'DOMESTIC', 'allowRedirect': 'false'},
        headers={**auth_headers, 'nmsResponseFormat': 'GEOJSON'},
        allow_redirects=False,
        timeout=120,
    )
    if response.status_code not in (200, 307):
        raise RuntimeError(f'NMS notams request returned {response.status_code}: {response.text[:300]}')

    content_url = (response.json().get('data') or {}).get('url') or response.headers.get('Location')
    if not content_url:
        raise RuntimeError('NMS notams response did not include a content URL')

    if content_url.startswith('http'):
        # Pre-signed storage URL; it must not carry our bearer token
        content = session.get(content_url, timeout=300)
    else:
        # The relative path already starts with /nmsapi
        content = session.get(f'{host}{content_url}', headers=auth_headers, timeout=300)
    if not content.ok:
        raise RuntimeError(f'NMS content download returned {content.status_code}: {content.text[:300]}')

    raw = content.content
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    return extract_features(raw.decode('utf-8'))


def download_changed_notams(session, host, token, since):
    """NOTAMs created, updated, or canceled since the given time (active and inactive)"""
    response = session.get(
        f'{host}/nmsapi/v1/notams',
        params={'lastUpdatedDate': since.strftime('%Y-%m-%dT%H:%M:%SZ')},
        headers={'Authorization': f'Bearer {token}', 'nmsResponseFormat': 'GEOJSON'},
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f'NMS changed-NOTAMs request returned {response.status_code}: {response.text[:300]}')
    body = response.json()
    if body.get('status') != 'Success':
        raise RuntimeError(f"NMS changed-NOTAMs request failed: {body.get('errors')}")
    items = (body.get('data') or {}).get('geojson') or []
    return [json.loads(item) if isinstance(item, str) else item for item in items]


def load_previous(url):
    """Previously deployed output, or None if unavailable"""
    if not url:
        return None
    try:
        response = requests.get(url, timeout=60, headers={'Cache-Control': 'no-cache'})
        if response.ok:
            return response.json()
        print(f'Previous NOTAM data returned {response.status_code}; ignoring it')
    except (requests.RequestException, ValueError) as e:
        print(f'Could not load previous NOTAM data: {e}')
    return None


def notam_id(feature):
    notam = (((feature or {}).get('properties') or {}).get('coreNOTAMData') or {}).get('notam') or {}
    return notam.get('id')


def extract_features(text):
    """
    Pull GeoJSON features out of the bulk file. The layout isn't documented, so
    accept a FeatureCollection, an NMS response envelope, a bare array, or
    newline-delimited JSON.
    """
    try:
        documents = [json.loads(text)]
    except json.JSONDecodeError:
        documents = [json.loads(line) for line in text.splitlines() if line.strip()]

    features = []
    for doc in documents:
        if isinstance(doc, dict):
            if 'features' in doc:
                items = doc['features']
            elif isinstance(doc.get('data'), dict) and 'geojson' in doc['data']:
                items = doc['data']['geojson']
            else:
                items = [doc]
        else:
            items = doc
        for item in items:
            features.append(json.loads(item) if isinstance(item, str) else item)
    return features


def parse_time(value):
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None


def format_time(value):
    return value.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%MZ') if value else ''


def text_coordinates(text):
    match = COORD_RE.search(text)
    if not match:
        return None
    lat_d, lat_m, lat_s, lat_dir, lng_d, lng_m, lng_s, lng_dir = match.groups()
    lat = int(lat_d) + int(lat_m) / 60 + float(lat_s) / 3600
    lng = int(lng_d) + int(lng_m) / 60 + float(lng_s) / 3600
    return (-lat if lat_dir == 'S' else lat, -lng if lng_dir == 'W' else lng)


def geometry_point(geometry):
    """First Point in a GeoJSON Point or GeometryCollection, as (lat, lng)"""
    if not isinstance(geometry, dict):
        return None
    if geometry.get('type') == 'Point':
        coords = geometry.get('coordinates') or []
        if len(coords) >= 2:
            return (coords[1], coords[0])
    for child in geometry.get('geometries') or []:
        point = geometry_point(child)
        if point:
            return point
    return None


def to_crane_record(feature, now):
    """Convert an NMS GeoJSON feature to a crane record, or None if it isn't an active crane"""
    notam = (((feature or {}).get('properties') or {}).get('coreNOTAMData') or {}).get('notam')
    if not notam:
        return None

    text = notam.get('text') or ''
    lower = text.lower()
    # Obstruction NOTAMs use Q-codes starting with QOB (e.g. QOBCE, obstacle erected)
    is_obstruction = (notam.get('selectionCode') or '').upper().startswith('QOB') or 'obst' in lower
    if not is_obstruction or 'crane' not in lower:
        return None

    start = parse_time(notam.get('effectiveStart'))
    end = parse_time(notam.get('effectiveEnd'))
    canceled = parse_time(notam.get('cancelationDate'))
    if (start and start > now) or (end and end < now) or (canceled and canceled < now):
        return None

    # The coordinates in the text are the crane itself; the geometry may be the
    # NOTAM's reference point, so it's only a fallback
    position = text_coordinates(text) or geometry_point(feature.get('geometry'))
    if not position:
        return None

    height_match = HEIGHT_RE.search(text)
    height = int(height_match.group(1) or height_match.group(2)) if height_match else 0

    location = notam.get('location') or notam.get('icaoLocation') or ''
    number = notam.get('number')
    notam_id = f'{location} {number}'.strip() if number else notam.get('id', '')

    return {
        'nmsId': notam.get('id'),
        'id': notam_id,
        'uniqueId': f"{notam.get('id') or notam_id}-NOTAM",
        'structureType': 'Crane',
        'latitude': round(position[0], 6),
        'longitude': round(position[1], 6),
        'height': height,
        'heightUnit': 'ft AGL',
        'status': 'Active NOTAM',
        'startDate': format_time(start),
        'endDate': format_time(end) or 'UNKNOWN',
        # ISO end time for filtering out NOTAMs that expire after this file was built
        'endTime': end.astimezone(timezone.utc).isoformat() if end else None,
        'sponsor': location,
        'city': location,
        'state': '',
        'dataSource': 'NOTAM',
        'condition': text,
        'icaoLocation': notam.get('icaoLocation') or location,
    }


def main():
    client_id = os.environ.get('NMS_CLIENT_ID')
    client_secret = os.environ.get('NMS_CLIENT_SECRET')
    if not client_id or not client_secret:
        print('NMS_CLIENT_ID and NMS_CLIENT_SECRET must be set', file=sys.stderr)
        return 1
    host = os.environ.get('NMS_HOST') or DEFAULT_NMS_HOST
    now = datetime.now(timezone.utc)

    previous = load_previous(os.environ.get('PREVIOUS_NOTAM_URL'))
    last_bulk = parse_time((previous or {}).get('bulkFetchedAt'))
    last_generated = parse_time((previous or {}).get('generatedAt'))
    # Records without nmsId predate incremental updates and can't be merged
    previous_ok = previous and all((c or {}).get('nmsId') for c in previous.get('cranes', []))

    session = requests.Session()
    session.headers['User-Agent'] = USER_AGENT
    session.headers['Accept'] = 'application/json'

    if not previous_ok or not last_bulk or now - last_bulk >= BULK_INTERVAL:
        print(f'Fetching all active DOMESTIC NOTAMs from {host} (bulk pull)')
        token = get_access_token(session, host, client_id, client_secret)
        features = download_domestic_notams(session, host, token)
        print(f'Downloaded {len(features)} NOTAMs')
        cranes = [record for record in (to_crane_record(f, now) for f in features) if record]
        bulk_fetched_at = now
    elif not last_generated or now - last_generated > MAX_DELTA_WINDOW:
        # Too old to catch up incrementally, and a bulk pull isn't allowed yet;
        # keep the previous data (expired entries are dropped below) until the next bulk pull
        print(f'Previous NOTAM data is too old to update incrementally; next bulk pull after {last_bulk + BULK_INTERVAL}')
        cranes = previous['cranes']
        bulk_fetched_at = last_bulk
    else:
        since = last_generated - DELTA_OVERLAP
        print(f'Fetching NOTAMs changed since {since.isoformat()} from {host}')
        token = get_access_token(session, host, client_id, client_secret)
        changed = download_changed_notams(session, host, token, since)
        print(f'Downloaded {len(changed)} changed NOTAMs')
        by_id = {c['nmsId']: c for c in previous['cranes']}
        for feature in changed:
            nms_id = notam_id(feature)
            if not nms_id:
                continue
            record = to_crane_record(feature, now)
            if record:
                by_id[nms_id] = record
            else:
                # Canceled, expired, or no longer a crane
                by_id.pop(nms_id, None)
        cranes = list(by_id.values())
        bulk_fetched_at = last_bulk

    # Drop anything that has expired since it was fetched
    cranes = [c for c in cranes if not parse_time(c.get('endTime')) or parse_time(c['endTime']) >= now]
    print(f'Kept {len(cranes)} active crane NOTAMs')

    with open(OUTPUT_PATH, 'w') as f:
        json.dump({
            'generatedAt': now.isoformat(),
            'bulkFetchedAt': bulk_fetched_at.isoformat(),
            'cranes': cranes,
        }, f, separators=(',', ':'))
    print(f'Wrote {os.path.normpath(OUTPUT_PATH)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
