# FAA Construction Crane Viewer

![DOF Data](https://img.shields.io/badge/DOF-Daily%20Updates-blue?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)
![OEAAA Data](https://img.shields.io/badge/OEAAA-Daily%20Updates-green?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)
![NOTAM Data](https://img.shields.io/badge/NOTAM-Test%20Data%20(Not%20Live)-red?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)

> [!CAUTION]
> **NOTAM data is being tested with the new FAA NOTAM Management Service (NMS). It is NOT production/live data and cannot be trusted. Do not use it for flight planning or safety decisions.**

An entirely vibe-coded web application that displays construction cranes within a user-specified nautical mile radius of a US address/location.

The application aggregates crane data from FAA sources:
- **DOF (Digital Obstacle File)** - Permanent crane structures nationwide (updated daily)
- **Part 77 Regional Data** - Aeronautical impact assessments from 9 FAA regions (updated daily)
- **NOTAMs (Notices to Airmen)** - Temporary crane obstructions (updated every 3 hours). **Test data only, not live: see the warning above.**

See [demo page](https://jeffreyp.github.io/faa-crane-viewer). 

## Features

- Search for construction cranes near a specific address
- Adjust the search radius (in nautical miles)
- View cranes on an interactive map with source-specific markers:
  - Blue crane icons for DOF/Part77 permanent structures
  - Orange pulsing triangles for NOTAM temporary obstructions
- See crane details in a sortable table view with color-coded source badges
- Comprehensive coverage from multiple FAA data sources

## Running the Application

### Local Development

To run the application locally for development:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. The application will open in your browser at http://localhost:3000

### Building for Production

To build the application for production:

```bash
npm run build
```

This will create optimized files in the `public` directory.

## Deployment

This application is configured for deployment to GitHub Pages:

1. Update the `homepage` field in `package.json` with your GitHub username:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/faa-crane-viewer"
   ```

2. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

3. The application will be available at the URL specified in your homepage field

A manual deploy doesn't include NOTAMs, because `public/data/notam-cranes.json` is only generated in CI. The next scheduled workflow run (within 3 hours) restores them, or you can run the workflow manually instead of deploying from your machine.

## Automated Data Updates

The static FAA obstacle data (DOF and Part 77) is automatically updated daily at 6 AM UTC via GitHub Actions. The daily workflow:

- Downloads the latest DOF (Digital Obstacle File) data from FAA
- Downloads Part 77 regional data from all 9 FAA regions
- Filters for crane-related obstructions
- Processes and merges data from both sources
- Commits updated data and redeploys to GitHub Pages

**NOTAMs** are refreshed on every run: daily at 6 AM UTC and every 3 hours at :30. Each run fetches NOTAMs, rebuilds, and redeploys the site. See [NOTAMs](#3-notams-notices-to-airmen).

**Note:** The static data update process takes approximately 2-3 minutes (DOF + Part77 only).
### Monitoring Updates

The status badge at the top of this README shows whether the automated updates are working:
- ✅ Green badge = updates are running successfully
- ❌ Red badge = last update failed

### Failure Notifications

If data updates fail, you'll be notified via:

1. **GitHub email notifications** - Make sure you have "Actions" notifications enabled in your [GitHub notification settings](https://github.com/settings/notifications)
2. **Workflow summary** - Each failed run includes a detailed summary with troubleshooting steps
3. **Status badge** - The badge will turn red when updates fail

To manually trigger an update, go to the [Actions tab](https://github.com/jeffreyp/faa-crane-viewer/actions/workflows/update-faa-data.yml) and click "Run workflow".

## Data Sources

This application aggregates crane obstruction data from three official FAA sources:

### 1. Digital Obstacle File (DOF)

**Source:** FAA Aeronautical Databases
**URL:** https://aeronav.faa.gov/Obst_Data/
**Update Frequency:** Daily
**Coverage:** Nationwide permanent obstacles
**Records:** ~700 crane-related structures

The DOF is the FAA's master database of verified obstacles. It includes permanent crane installations that have been surveyed and documented.

### 2. Part 77 Regional Data

**Source:** FAA OE/AAA Regional Database
**URL:** https://oeaaa.faa.gov/oeaaa/oe3a-external-api/
**Update Frequency:** Daily
**Coverage:** 9 FAA regions (AAL, ACE, AEA, AGL, ANM, ANE, ASO, ASW, AWP)
**Records:** ~38,000 crane-related structures

Part 77 data includes structures that have been evaluated for their aeronautical impact. This includes construction cranes that have gone through the airspace impact review process.

### 3. NOTAMs (Notices to Airmen)

> [!CAUTION]
> **NOTAMs currently come from the NMS staging (test) environment. They are NOT production/live data and cannot be trusted.** The site shows this warning in a banner, in every NOTAM popup, and on NOTAM table badges. Remove those warnings (`NOTAM_TEST_WARNING` in `src/config.js`) only after switching `NMS_HOST` to production.

**Source:** FAA NOTAM Management Service (NMS) API
**Update Frequency:** Every 3 hours
**Coverage:** All active DOMESTIC NOTAMs, filtered to crane obstructions
**Records:** Varies (typically 10-50 active crane-related temporary obstructions nationwide)

The NMS API requires OAuth2 client credentials (request access from notams@faa.gov) and rejects requests from Cloudflare Workers, so the browser can't query it directly or through a proxy. Instead, `scripts/update_notam_data.py` runs in GitHub Actions: it downloads the NMS bulk file of active DOMESTIC NOTAMs, keeps the active crane obstructions, and writes them to `public/data/notam-cranes.json`, which is deployed with the site.

**Configuration (repository settings):**
- `NMS_CLIENT_ID` and `NMS_CLIENT_SECRET` secrets: the KEY and SECRET from the NMS onboarding spreadsheet
- `NMS_HOST` variable (optional): defaults to staging (`https://api-staging.cgifederal-aim.com`); set it to `https://api-nms.aim.faa.gov` once the FAA approves production access

To run the fetch locally:

```bash
NMS_CLIENT_ID=... NMS_CLIENT_SECRET=... python3 scripts/update_notam_data.py
```

**Filtering Criteria:**
- Class: Obstruction (Q-code `QOB*` or "OBST" in the text)
- Condition: Contains "CRANE"
- Date: Currently active (started, not ended or canceled)
- Location: Within the user's search radius (applied in the browser)

If a fetch fails, the workflow redeploys the previous `notam-cranes.json`. The browser drops any NOTAM whose end time has passed since the file was generated.

**NOTAM Display Features:**
- Orange pulsing triangle marker (distinct from blue crane icons)
- Warning banner in popup showing "Temporary Obstruction"
- Active period display (start and end dates)
- Orange "NOTAM" source badge in table

### Data Processing

**Static sources (DOF and Part 77):**
- Converted to a standardized CSV format
- Filtered for crane-related keywords (CRANE, MOBILE, EQUIPMENT, VEHICLE)
- Deduplicated by aeronautical study number (ASN)
- Merged into static CSV files

**NOTAMs:**
- Fetched every 3 hours in GitHub Actions
- Filtered for active crane obstructions and converted to the standardized format
- Filtered by search radius and merged with the static data in the browser

### Troubleshooting Data Issues

**No NOTAM markers visible?**
- NOTAMs are temporary and relatively rare in any given search area; orange markers only appear for active crane-related NOTAMs within your search radius
- Check the browser console for "Loaded N crane NOTAMs" or "NOTAM data unavailable"
- Check the "Fetch crane NOTAMs" step in the latest [workflow run](https://github.com/jeffreyp/faa-crane-viewer/actions/workflows/update-faa-data.yml); a failed fetch shows a warning in the run summary
- In local development, `public/data/notam-cranes.json` doesn't exist unless you run `scripts/update_notam_data.py`, so no NOTAMs appear

**Missing data from a specific region?**
- Part 77 regional servers occasionally timeout
- The update script continues with available regions
- Check the workflow logs for specific region failures

**Performance issues?**
- Expected load time: < 5 seconds for ~80,000 total records
- CSV files are loaded in parallel for optimal performance
- Data is filtered client-side using efficient algorithms

## Implementation Details

This application is built with:

- React for the user interface
- Leaflet for the interactive map
- CartoDB Voyager tiles for the map display
- Webpack for bundling
- Data from the FAA OE/AAA website

**Important**: The app uses React and loads from `bundle.js` (generated by webpack), not the old `app.js` file.
