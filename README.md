# FAA Construction Crane Viewer

![Update FAA Data](https://github.com/jeffreyp/faa-crane-viewer/actions/workflows/update-faa-data.yml/badge.svg)

An entirely vibe-coded web application that displays construction cranes within a user-specified nautical mile radius of a US address/location.

The application aggregates crane data from three FAA sources:
- **DOF (Digital Obstacle File)** - Permanent crane structures nationwide
- **Part 77 Regional Data** - Aeronautical impact assessments from 9 FAA regions
- **NOTAMs (Notices to Airmen)** - Temporary crane obstructions with active dates

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

The FAA obstacle data is automatically updated daily at 6 AM UTC via GitHub Actions. The workflow:

- Downloads the latest DOF (Digital Obstacle File) data from FAA
- Downloads Part 77 regional data from all 9 FAA regions
- Fetches current NOTAMs via geographic grid search (~1,500 points covering CONUS)
- Filters for crane-related obstructions (class=obstruction, condition contains "CRANE")
- Processes and merges data from all three sources
- Commits updated data and redeploys to GitHub Pages

**Note:** The full update process takes approximately 50-60 minutes due to NOTAM grid search coverage and rate limiting.

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
**Update Frequency:** Daily
**Coverage:** Continental USA (grid search with ~1,500 points, 100 NM spacing)
**Records:** 500-2,000 active crane-related temporary obstructions

NOTAMs provide real-time information about temporary crane obstructions. The application filters for:
- Class: Obstruction
- Condition: Contains "CRANE" keyword
- Date: Currently active (within start/end dates)

**NOTAM Display Features:**
- Orange pulsing triangle marker (distinct from blue crane icons)
- Warning banner in popup showing "Temporary Obstruction"
- Active period display (start and end dates)
- Orange "NOTAM" source badge in table

### Data Processing

All three sources are:
- Converted to a standardized CSV format
- Filtered for crane-related keywords (CRANE, MOBILE, EQUIPMENT, VEHICLE)
- Deduplicated by aeronautical study number (ASN)
- Merged into a single dataset for display
- Saved as separate CSV files for transparency

### Troubleshooting Data Issues

**No NOTAM markers visible?**
- NOTAMs are temporary - they expire and get removed daily
- Orange markers only appear for active crane-related NOTAMs
- Check browser console for "Loaded X NOTAM cranes" message
- Verify `public/data/notams.csv` exists and contains data

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
