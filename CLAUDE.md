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

This is a **single-page application with no backend**. All data is:
1. Fetched by Python scripts (`scripts/update_faa_data.py`)
2. Saved as static CSV files in `public/data/`
3. Committed to git
4. Loaded by the React frontend in the browser
5. Filtered and displayed using Leaflet maps

**Key principle:** Everything is static files. No server-side API calls during user interaction.

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

**Code:** `scripts/update_faa_data.py` lines 41-52 (fetch), 166-206 (process)

### Data Merging

Both DOF and Part 77 are merged into a single `public/data/datafile.csv`:
- Duplicates removed based on STUDY (ASN) field
- Combined file contains ~39K total records
- **Code:** `scripts/update_faa_data.py` lines 330-396

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
faaService.js loads CSV files
    ├─ fetch('data/datafile.csv')      [DOF + Part77 merged]
    └─ fetch('data/part77-data.csv')   [Part77 only]
    ↓
PapaParse converts CSV → JSON
    ↓
Filter by distance (Haversine formula)
    ↓
Filter by crane keywords
    ↓
Deduplicate by uniqueId
    ↓
Display on MapView (Leaflet markers) + TableView (sortable table)
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
**Timeout:** Currently 10 minutes (will need to increase to 60 for NOTAMs)

**Workflow Steps:**
1. Checkout repository
2. Set up Python 3.11
3. Install pip packages (requests, pandas)
4. Run `scripts/update_faa_data.py`
5. Check for data changes
6. Commit and push to main branch
7. Build with webpack
8. Deploy to GitHub Pages

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

## NOTAM Integration - COMPLETED ✅

### Goal

Add **NOTAMs (Notices to Airmen)** as a third data source for crane-related temporary obstructions.

### Requirements

- **Search Method:** Hybrid approach (geographic grid + airport searches)
- **Filtering:**
  - class = "obstruction"
  - condition contains "CRANE" (case-insensitive)
  - Current date within NOTAM start/end date range
- **Coverage:** Continental USA (48 states + DC)
- **Update Frequency:** Daily (1x per day via GitHub Actions)
- **Display:** Consistent with DOF/Part77 but visually distinct (different icon/color)

### Current Status

**Epic:** `faa-crane-viewer-pvk` (P2, open)
**Implementation:** Complete with enhanced coverage improvements
**Remaining Tasks:** pvk.10 (data source filters UI)

**✅ Completed Implementation:**
- API endpoint discovered: `https://notams.aim.faa.gov/notamSearch/search`
- Backend: Hybrid NOTAM fetching strategy with enhanced coverage
  - Geographic grid search: 940 points at 75 NM spacing
  - Airport supplemental search: 30 major US airports by ICAO code
  - Deduplication across both search methods
- Frontend: NOTAM data loading, orange pulsing triangle markers, custom popups
- GitHub Actions: 60-minute timeout (runtime ~37 minutes total)
- Testing: End-to-end verification completed
- Documentation: All README files updated with hybrid search details

**Tasks Completed (pvk.1 through pvk.12):**
1. pvk.1 - Reverse engineer NOTAM Search API ✅
2. pvk.2 - Test Python access to NOTAM API ✅
3. pvk.3 - Analyze NOTAM response format ✅
4. pvk.4 - Implement NOTAM filtering for crane obstructions ✅
5. pvk.5 - Convert NOTAMs to CSV format matching DOF/Part77 ✅
6. pvk.6 - Integrate NOTAM fetching into update pipeline ✅
7. pvk.7 - Add NOTAM data loading to faaService.js ✅
8. pvk.8 - Create distinct visual styling for NOTAM markers ✅
9. pvk.9 - Update popups and table for NOTAM-specific fields ✅
10. pvk.11 - End-to-end testing and validation ✅
11. pvk.12 - Documentation updates for all three sources ✅

**Coverage Improvements:**
- **2025-11-12:** Increased grid density: 100 NM → 75 NM spacing (+79% more points)
- **2025-11-12:** Added airport-based searches (30 hardcoded major airports)
- **2025-11-13:** Expanded to all 805 US medium/large airports using OurAirports database
  - Dynamically fetches airport list (updated nightly)
  - Addresses FAA API limitations where some NOTAMs don't appear in results
  - Total queries: 1,745 (940 grid + 805 airports), runtime ~58 minutes

### Implementation Plan (12 tasks total)

See epic `faa-crane-viewer-pvk` for full task breakdown:

**Phase 1: API Discovery (P0)**
- Reverse engineer API
- Test Python access
- Analyze response format

**Phase 2: Backend Data Collection (P1)**
- Create fetcher script with hybrid search approach
  - Geographic grid: 940 points at 75 NM spacing
  - Airport supplemental: 805 US medium/large airports from OurAirports
    - Dynamically downloaded from public domain database
    - Filters for iso_country='US', type IN ('medium_airport', 'large_airport')
    - GPS codes starting with 'K' (continental US ICAO codes)
- Implement filtering logic
- Convert to CSV format
- Integrate into update pipeline

**Phase 3: Frontend Integration (P1)**
- Add NOTAM data loading to faaService.js
- Create distinct visual styling (orange warning icon, pulse animation)
- Update popups and table for NOTAM-specific fields
- Add data source filter checkboxes

**Phase 4: Testing & Documentation (P1-P2)**
- End-to-end testing
- Performance validation (< 5s load time)
- Update README.md

### Technical Considerations

**Rate Limiting:**
- 1,745 API calls for full coverage (940 grid + 805 airports)
- 2-second delays between requests
- Exponential backoff on errors
- Total runtime: ~58 minutes for NOTAMs (within 60-minute GitHub Actions timeout)

**CORS Issues:**
- Mitigated by Python script approach (not browser-based)
- Backend fetches data, saves as static CSV

**Data Deduplication:**
- Hybrid search returns overlapping results
- Deduplicate by NOTAM number before saving
- Prevents duplicates from grid and airport searches

**Date Handling:**
- NOTAM dates often in format: YYMMDDHHmm (e.g., 2511112359)
- Can have "PERM" (permanent) or "EST" (estimated)
- Times are in UTC

**Performance:**
- Actual NOTAM count: Typically 10-50 active crane NOTAMs
- Lower than expected due to FAA API limitations
- Some NOTAMs visible on web interface don't appear in API results
- Total dataset: ~39K records (39K DOF+Part77 + 10-50 NOTAM)
- Frontend performance: < 5s load time achieved

**Known API Limitations:**
- FAA NOTAM Search API occasionally doesn't return certain NOTAMs
- Both geographic and ICAO searches can miss specific NOTAMs
- Example: NOTAM 10/123 (KPHX crane) visible on web but not in API
- Hybrid search strategy helps but cannot guarantee 100% capture

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
