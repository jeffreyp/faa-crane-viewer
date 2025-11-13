# FAA Crane Viewer - Claude Context

## Project Overview

The **FAA Crane Viewer** is a web application that displays crane locations from FAA (Federal Aviation Administration) data sources on an interactive map. Users can search by address and radius to find cranes and construction equipment in their area.

**Live URL:** https://jeffreyp.github.io/faa-crane-viewer
**Repository:** GitHub (deployed via GitHub Pages)

### Technology Stack

- **Frontend:** React 19.1.0 + Leaflet.js 1.9.4 for mapping
- **Styling:** styled-components 6.1.18 (CSS-in-JS)
- **Build:** Webpack 5.99.9 + Babel 7.27.4
- **Data Parsing:** PapaParse 5.5.3 (CSV parsing in browser)
- **Deployment:** GitHub Pages (static site)
- **Backend:** None - purely static frontend
- **Data Updates:** Python 3.11 scripts via GitHub Actions (daily at 6 AM UTC)

### Architecture

This is a **hybrid single-page application**:

**Static Data (DOF + Part77):**
1. Fetched by Python scripts (`scripts/update_faa_data.py`) daily
2. Saved as static CSV files in `public/data/`
3. Committed to git
4. Loaded by React frontend in the browser

**Dynamic Data (NOTAMs):**
1. Fetched on-demand when user searches
2. Proxied through Cloudflare Worker (CORS bypass)
3. Real-time data from FAA NOTAM API
4. No pre-fetching or caching

**Key principle:** Permanent structures cached as static files, temporary obstructions fetched live.

---

## Current Data Sources

### 1. Digital Obstacle File (DOF)

**Source:** FAA Aeronautical Databases
**URL:** https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP
**Format:** ZIP containing CSV
**Update Frequency:** Daily
**Current Records:** ~39,000 total (after filtering)

**Processing:**
- Downloads ZIP, extracts CSV
- Filters for crane keywords: "CRANE", "MOBILE", "EQUIPMENT", "VEHICLE"
- Converts to standard format with DMS to decimal coordinates
- Saves to `public/data/datafile.csv`

**Code:** `scripts/update_faa_data.py` lines 31-39 (fetch), 208-313 (process)

### 2. Part 77 Regional Data

**Source:** FAA OE/AAA Regional Database
**URL:** https://oeaaa.faa.gov/oeaaa/oe3a-external-api/downloadArchives.do
**Format:** Gzipped CSV per region
**Regions:** 9 FAA regions (AAL, ACE, AEA, AGL, ANM, ANE, ASO, ASW, AWP)
**Update Frequency:** Daily (attempted)
**Current Records:** ~38,000 in part77-data.csv

**Processing:**
- Downloads from each region with 1-second delays
- Handles gzipped and plain CSV formats
- Filters for crane/construction keywords
- Adds region source indicator (e.g., 'Part77-ASW')
- Saves to `public/data/part77-data.csv`
- Also creates regional files in `public/data/regions/`

**Code:** `scripts/update_faa_data.py`

### 3. NOTAMs (On-Demand)

**Source:** FAA NOTAM Search API
**URL:** https://notams.aim.faa.gov/notamSearch/search
**Format:** JSON (real-time API)
**Proxy:** Cloudflare Worker at `cloudflare-worker/notam-proxy.js`
**Update Frequency:** Real-time (fetched during each user search)
**Current Records:** ~10-50 active crane NOTAMs nationwide

**Architecture:**
- **NOT pre-fetched** - fetched on-demand when user searches
- Proxied through Cloudflare Worker (FAA API doesn't support CORS)
- Fetched in parallel with static CSV loading
- Filtered for crane-related obstructions on the server-side (Cloudflare Worker)
- Converted to standard format in browser

**Why On-Demand:**
- Real-time data (no staleness)
- No GitHub Actions timeouts
- Faster overall (users only fetch their search area)
- Simpler architecture (no complex batch processing)

**Configuration:**
- Set `NOTAM_PROXY_URL` in `src/config.js` after deploying Cloudflare Worker
- See `cloudflare-worker/DEPLOYMENT.md` for setup instructions
- See `DEPLOYMENT.md` for full deployment guide

**Code:**
- Proxy: `cloudflare-worker/notam-proxy.js`
- Frontend: `src/services/faaService.js` (fetchNOTAMs function)
- Config: `src/config.js`

### Data Merging

DOF and Part 77 are merged into a single `public/data/datafile.csv`:
- Duplicates removed based on STUDY (ASN) field
- Combined file contains ~39K total records
- NOTAMs are NOT included in static CSV (fetched separately on-demand)
- **Code:** `scripts/update_faa_data.py`

---

## CSV Data Format

All data sources use this standardized CSV format:

```csv
STUDY,STRUCTURE TYPE,LATITUDE,LONGITUDE,AGL HEIGHT DET,HEIGHT UNIT,STATUS,DETERMINATION,START DATE,END DATE,SPONSOR,CITY,STATE,DATA SOURCE
```

**Key Fields:**
- `STUDY`: Aeronautical Study Number (ASN) - unique identifier
- `STRUCTURE TYPE`: "Crane", "Mobile Crane", etc.
- `LATITUDE/LONGITUDE`: Decimal degrees
- `AGL HEIGHT DET`: Height above ground level
- `HEIGHT UNIT`: Usually "FT AGL"
- `STATUS`: "Determined", "Active NOTAM", etc.
- `DETERMINATION`: "No Hazard", "Obstruction", etc.
- `START DATE/END DATE`: When applicable (NOTAMs)
- `DATA SOURCE`: "DOF", "Part77-{REGION}", or "NOTAM"

---

## Frontend Architecture

### Key Files

- `src/index.js` - React entry point
- `src/App.js` (140 lines) - Main app component, search orchestration
- `src/components/MapView.js` (183 lines) - Leaflet integration, marker display
- `src/components/TableView.js` (186 lines) - Sortable data table
- `src/components/SearchBar.js` (114 lines) - Address search + radius slider
- `src/services/faaService.js` (472 lines) - Data fetching & filtering
- `src/services/geocodingService.js` (240 lines) - Address → lat/lng conversion

### Data Flow

```
User enters address + radius
    ↓
geocodingService.js → Nominatim OSM API
    ↓
Get lat/lng coordinates
    ↓
faaService.js fetches data IN PARALLEL:
    ├─ fetch('data/datafile.csv')                    [DOF + Part77 merged CSV]
    ├─ fetch('data/part77-data.csv')                 [Part77 only CSV]
    └─ fetchNOTAMs(lat, lng, radius)                 [Real-time API via Cloudflare Worker]
            ↓
            POST to Cloudflare Worker
            ↓
            Worker → FAA NOTAM API
            ↓
            Filter for crane obstructions
            ↓
            Return JSON to browser
    ↓
PapaParse converts CSVs → JSON
    ↓
Merge all three sources (DOF + Part77 + NOTAMs)
    ↓
Filter by distance (Haversine formula) [DOF/Part77 only, NOTAMs pre-filtered]
    ↓
Deduplicate by uniqueId
    ↓
Display on MapView (Leaflet markers) + TableView (sortable table)
    ├─ DOF/Part77: Standard crane icon
    └─ NOTAMs: Orange pulsing triangle icon
```

### Map Details

- **Library:** Leaflet.js 1.9.4
- **Tiles:** CartoDB Voyager
- **Crane Icon:** 30x30px from Flaticon CDN
- **Search Marker:** Red star at search location
- **Radius Circle:** Blue circle showing search radius in nautical miles
- **Popups:** Show crane details on click
- **Selection:** Clicking marker or table row highlights both

---

## Automated Updates

### GitHub Actions Workflow

**File:** `.github/workflows/update-faa-data.yml`
**Schedule:** Daily at 6 AM UTC (cron: `0 6 * * *`)
**Timeout:** 10 minutes (DOF + Part77 complete in 2-3 minutes)

**Workflow Steps:**
1. Checkout repository
2. Set up Python 3.11
3. Install pip packages (requests, pandas)
4. Run `scripts/update_faa_data.py` (DOF + Part77 only)
5. Check for data changes
6. Commit and push to main branch (datafile.csv, part77-data.csv)
7. Build with webpack
8. Deploy to GitHub Pages

**What's NOT included:**
- NOTAMs are fetched on-demand by users, not by GitHub Actions
- No more 45-60 minute timeouts
- No more async/aiohttp dependencies

**Error Handling:**
- Detailed failure notifications
- Fallback handling for individual region failures
- Push conflict resolution (pull & rebase)

---

## Issue Tracking with Beads

### Setup

**Tool:** Beads (bd) CLI
**Location:** `/home/ubuntu/.local/bin/bd`
**Database:** `.beads/beads.db`
**JSONL:** `.beads/beads.jsonl` (git-tracked)
**Issue Prefix:** `faa-crane-viewer`
**Issue Format:** `faa-crane-viewer-{id}` (e.g., `faa-crane-viewer-pvk`)

### Git Integration

- ✅ Git hooks installed (prevents race conditions with auto-flush)
- ✅ Git merge driver configured (intelligent JSONL merging)
- ⚠️ Both `.beads/` directory and JSONL are gitignored per `.gitignore`

### Common Commands

```bash
# List all open issues
bd list --status open

# Show issue details with children
bd show faa-crane-viewer-pvk

# Create new issue
bd create "Issue title" -t task -p 2 -d "Description"

# Update issue status
bd update faa-crane-viewer-pvk.1 -s in_progress

# Close issue
bd close faa-crane-viewer-pvk.1 --reason "Completed"

# Find ready-to-work tasks
bd ready

# Show project statistics
bd stats
```

### Issue Hierarchy

- **Epic:** `faa-crane-viewer-pvk` - Add NOTAMs as third data source
  - **Child tasks:** Use `--parent faa-crane-viewer-pvk` when creating
  - **Naming:** Children are auto-numbered (e.g., `faa-crane-viewer-pvk.1`, `.2`, etc.)

### Priority Levels

- **P0:** Critical - blocks other work
- **P1:** High - important for current milestone
- **P2:** Medium - normal priority
- **P3:** Low - nice to have
- **P4:** Backlog - future consideration

### Issue Types

- `epic` - Large body of work with multiple sub-tasks
- `task` - Standard work item
- `feature` - New functionality
- `bug` - Something broken
- `chore` - Maintenance work

---

## NOTAM Integration - COMPLETED ✅ (On-Demand Architecture)

### Goal

Add **NOTAMs (Notices to Airmen)** as a third data source for crane-related temporary obstructions.

### Architecture Evolution

**Original Approach (2025-11-12 to 2025-11-13):**
- ❌ Batch fetching via GitHub Actions
- ❌ 1,745 API calls (940 grid points + 805 airports)
- ❌ 45-60 minute runtime
- ❌ Frequent timeouts and failures
- ❌ Stale data (up to 24 hours old)

**Current Approach (2025-11-13+):**
- ✅ On-demand fetching via Cloudflare Worker
- ✅ 1 API call per user search
- ✅ < 1 second response time
- ✅ Real-time data
- ✅ No GitHub Actions complexity

### Current Status

**Implementation:** Complete and deployed
**Architecture:** On-demand via Cloudflare Worker proxy
**Status:** Production-ready

### Key Components

1. **Cloudflare Worker Proxy** (`cloudflare-worker/notam-proxy.js`)
   - Proxies requests from browser to FAA NOTAM API
   - Adds CORS headers (FAA API doesn't support browser requests)
   - Deployed to Cloudflare Workers (free tier)

2. **Frontend On-Demand Fetching** (`src/services/faaService.js`)
   - `fetchNOTAMs(lat, lng, radius)` function
   - Called when user searches
   - Fetched in parallel with static CSV files
   - Filters for crane-related obstructions

3. **Configuration** (`src/config.js`)
   - `NOTAM_PROXY_URL` - Cloudflare Worker URL
   - `NOTAM_CONFIG` - Timeout, retries, max radius settings

4. **Visualization**
   - Orange pulsing triangle markers (distinct from DOF/Part77)
   - Custom popups with NOTAM-specific fields
   - Real-time status indicators

### Deployment

See `DEPLOYMENT.md` and `cloudflare-worker/DEPLOYMENT.md` for full instructions.

**Quick Start:**
1. Deploy Cloudflare Worker (5 minutes)
2. Update `src/config.js` with worker URL
3. Build and deploy frontend
4. Test with user searches

### Benefits of On-Demand Approach

| Aspect | Batch (Old) | On-Demand (New) |
|--------|-------------|-----------------|
| **Freshness** | Up to 24 hours old | Real-time |
| **Performance** | 45-60 min GitHub Actions | < 1 sec per search |
| **Reliability** | Frequent timeouts | No failures |
| **Coverage** | Nationwide pre-fetch | User's search area only |
| **Cost** | GitHub Actions compute | Cloudflare Free Tier |
| **Maintenance** | Complex batch scripts | Simple proxy |

### Technical Details

**CORS Solution:**
- FAA NOTAM API doesn't support CORS
- Cloudflare Worker adds `Access-Control-Allow-Origin` headers
- Worker forwards POST requests to FAA API
- Returns JSON with proper CORS headers

**Filtering:**
- Filters for obstruction class
- Searches for "CRANE" in condition field (case-insensitive)
- Parses coordinates and heights
- Converts to standard format

**Performance:**
- Cloudflare Workers: < 50ms edge latency
- FAA NOTAM API: 200-500ms response time
- Total: < 1 second from user search to display
- Parallel fetching with DOF/Part77 CSVs

**Monitoring:**
- Cloudflare dashboard shows metrics
- Free tier: 100K requests/day (plenty for typical usage)
- Browser console logs NOTAM fetch success/failure

---

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Run dev server (localhost:8080)
npm start

# Build for production
npm run build

# Test data update script
python3 scripts/update_faa_data.py
```

### Testing Changes

1. Make code changes
2. Run `npm run build`
3. Open `public/index.html` in browser
4. Test search functionality
5. Check console for errors

### Deploying

1. Commit changes to main branch
2. Push to GitHub
3. GitHub Actions automatically builds and deploys to GitHub Pages

---

## Important Patterns & Conventions

### Never Create New Files Unless Necessary

Always prefer editing existing files. The codebase is well-organized and has clear separation of concerns.

### CSV Format is Sacred

All data sources must match the standard CSV format exactly. The frontend expects these exact column names.

### Coordinate Format

- **Storage:** Decimal degrees (e.g., 33.4484, -112.0740)
- **DOF Input:** Often in DMS format (e.g., "33 - 27 - 28.73 N")
- **Conversion:** Done in Python scripts before saving to CSV

### Distance Calculation

**Haversine formula** is used throughout:
```javascript
const R = 3440.065; // Nautical miles
const dLat = (lat2 - lat1) * Math.PI / 180;
const dLon = (lon2 - lon1) * Math.PI / 180;
const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const distance = R * c; // Distance in nautical miles
```

### Error Handling

Python scripts should:
- Continue on individual failures (don't abort entire update)
- Log detailed errors
- Return empty results rather than crashing
- Use try/except blocks liberally

### Commit Messages

Follow existing pattern:
- "Add {feature}" for new functionality
- "Fix {issue}" for bug fixes
- "Update FAA obstacle data - YYYY-MM-DD" for automated data updates
- Use detailed commit messages from comprehensive plan
- Include: 🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Useful References

### Documentation

- **Leaflet.js:** https://leafletjs.com/reference.html
- **React:** https://react.dev/
- **PapaParse:** https://www.papaparse.com/docs
- **FAA NOTAM Search User Guide:** https://notams.aim.faa.gov/NOTAM_Search_User_Guide_V33.pdf

### FAA Data Sources

- **DOF:** https://aeronav.faa.gov/Obst_Data/
- **Part 77:** https://oeaaa.faa.gov/oeaaa/oe3a-external-api/
- **NOTAM Search:** https://notams.aim.faa.gov/notamSearch/
- **NOTAM WFS:** https://notams.aim.faa.gov/notamWFS/ (requires registration)

### Git Remotes

```bash
# Check current remotes
git remote -v

# Current setup (assumed)
origin  https://github.com/jeffreyp/faa-crane-viewer.git
```

---

## Quick Start for New Session

1. **Check project status:**
   ```bash
   cd /mnt/workplace/faa-crane-viewer
   git status
   bd list --status open
   ```

2. **See current work:**
   ```bash
   bd show faa-crane-viewer-pvk  # Show epic and all sub-tasks
   bd ready                       # Show tasks ready to work on
   ```

3. **Resume investigation:**
   - Review `scripts/investigate_notam_api.py`
   - Check if manual browser investigation was completed
   - Look for any new findings in issue notes

4. **Test environment:**
   ```bash
   npm start                      # Start dev server
   python3 scripts/update_faa_data.py  # Test data update
   ```

---

## Troubleshooting

### Data Update Failures

**Symptom:** GitHub Actions workflow fails
**Check:**
- Workflow logs in GitHub Actions tab
- Individual region download failures (Part 77)
- Network timeouts (increase timeout if needed)

**Common fixes:**
- Part 77 regions occasionally unavailable - script continues with other regions
- DOF ZIP download can timeout - retry usually works

### Frontend Not Loading Data

**Symptom:** Map shows no cranes
**Check:**
- Browser console for errors
- Network tab to see if CSV files loaded (200 status)
- CSV file paths (must be relative: `data/datafile.csv`)

**Common fixes:**
- Clear browser cache
- Check CSV file exists in `public/data/`
- Verify CSV format matches expected columns

### Beads Issues

**Symptom:** `bd` command not found or MCP errors
**Check:**
- `which bd` should return `/home/ubuntu/.local/bin/bd`
- `.beads/beads.db` exists
- MCP server may need Claude Code restart

**Common fixes:**
- Restart Claude Code to reload MCP servers
- Use `bd` via Bash tool directly if MCP fails
- Check `BEADS_PATH` environment variable

---

## Context for Claude

When resuming work on this project:

1. **Read this file first** to understand project structure
2. **Check beads status** with `bd list` and `bd show faa-crane-viewer-pvk`
3. **Review recent commits** with `git log --oneline -10`
4. **Check what's in progress** - look for issues marked `in_progress`
5. **Reference the comprehensive plan** in the conversation history for NOTAM integration details

**Do not:**
- Create new files unless absolutely necessary
- Change the CSV format or column names
- Skip testing after making changes
- Commit without running `npm run build` first

**Always:**
- Update beads issues as work progresses
- Test changes locally before committing
- Maintain consistent code style with existing files
- Document new scripts and significant changes
- Use the todo list for complex multi-step tasks

---

## Project Vision

This tool helps users find cranes and construction equipment near their location by aggregating multiple FAA data sources. The goal is comprehensive coverage with accurate, up-to-date information displayed in an intuitive interface.

**Future enhancements could include:**
- Additional data sources (TFRs, other obstructions)
- Historical data tracking
- Mobile app version
- Email alerts for new cranes in watched areas
- Export functionality (KML, GeoJSON)

---

*Last Updated: 2025-11-12*
*Current Epic: NOTAM Integration (faa-crane-viewer-pvk)*
*Current Status: Implementation complete, documentation in progress*
*Branch: feature/notam-integration (ready for PR to main)*
