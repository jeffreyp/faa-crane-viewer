# FAA Construction Crane Viewer

![DOF Data](https://img.shields.io/badge/DOF-Daily%20Updates-blue?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)
![OEAAA Data](https://img.shields.io/badge/OEAAA-Daily%20Updates-green?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)
![NOTAM Data](https://img.shields.io/badge/NOTAM-On--Demand-orange?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==)

An entirely vibe-coded web application that displays construction cranes within a user-specified nautical mile radius of a US address/location.

The application aggregates crane data from three FAA sources:
- **DOF (Digital Obstacle File)** - Permanent crane structures nationwide (updated daily)
- **Part 77 Regional Data** - Aeronautical impact assessments from 9 FAA regions (updated daily)
- **NOTAMs (Notices to Airmen)** - Temporary crane obstructions fetched in real-time

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

## Automated Data Updates

The static FAA obstacle data (DOF and Part 77) is automatically updated daily at 6 AM UTC via GitHub Actions. The workflow:

- Downloads the latest DOF (Digital Obstacle File) data from FAA
- Downloads Part 77 regional data from all 9 FAA regions
<<<<<<< HEAD
- Processes and merges data from both sources
- Commits updated data and redeploys to GitHub Pages
- 
=======
- Filters for crane-related obstructions
- Processes and merges data from both sources
- Commits updated data and redeploys to GitHub Pages

**NOTAMs** are fetched on-demand when users search, providing real-time data without batch processing delays.

**Note:** The static data update process takes approximately 2-3 minutes.

>>>>>>> e306d50 (Update documentation to reflect completed NOTAM integration)
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

**Source:** FAA NOTAM Search API
**URL:** https://notams.aim.faa.gov/notamSearch/
<<<<<<< HEAD
**Coverage:** Continental USA via hybrid search strategy
**Records:** Varies (typically 10-50 active crane-related temporary obstructions)
=======
**Update Frequency:** Real-time (fetched on-demand during user searches)
**Coverage:** User's search area
**Records:** Varies (typically 10-50 active crane-related temporary obstructions nationwide)
>>>>>>> e306d50 (Update documentation to reflect completed NOTAM integration)

NOTAMs provide real-time information about temporary crane obstructions. The application uses an **on-demand architecture**:

<<<<<<< HEAD
=======
**On-Demand Fetching:**
- Fetched when user performs a search
- Proxied through Cloudflare Worker (CORS bypass)
- Real-time data from FAA NOTAM API
- No pre-fetching or batch processing

**Filtering Criteria:**
- Class: Obstruction
- Condition: Contains "CRANE" keyword (server-side filtering)
- Location: Within user's search radius
- Date: Currently active (within start/end dates)

>>>>>>> e306d50 (Update documentation to reflect completed NOTAM integration)
**NOTAM Display Features:**
- Orange pulsing triangle marker (distinct from blue crane icons)
- Warning banner in popup showing "Temporary Obstruction"
- Active period display (start and end dates)
- Orange "NOTAM" source badge in table

### Data Processing

<<<<<<< HEAD
Sources are:
=======
**Static sources (DOF and Part 77):**
>>>>>>> e306d50 (Update documentation to reflect completed NOTAM integration)
- Converted to a standardized CSV format
- Filtered for crane-related keywords (CRANE, MOBILE, EQUIPMENT, VEHICLE)
- Deduplicated by aeronautical study number (ASN)
- Merged into static CSV files

**Dynamic source (NOTAMs):**
- Fetched on-demand when user searches
- Filtered server-side for crane-related obstructions
- Converted to standardized format in browser
- Merged with static data for display

### Troubleshooting Data Issues

**No NOTAM markers visible?**
- NOTAMs are temporary and relatively rare in any given search area
- Orange markers only appear for active crane-related NOTAMs within your search radius
- Check browser console for NOTAM fetch success/failure messages
- Verify `NOTAM_PROXY_URL` is configured in `src/config.js`
- Ensure Cloudflare Worker is deployed and accessible

<<<<<<< HEAD
=======
**Known NOTAM API Limitations:**
- The FAA NOTAM Search API may not return all NOTAMs visible on the web interface
- API responses are sometimes incomplete or delayed
- On-demand fetching ensures you get the most current data available

>>>>>>> e306d50 (Update documentation to reflect completed NOTAM integration)
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
