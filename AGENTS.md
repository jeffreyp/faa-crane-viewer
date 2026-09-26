# FAA Crane Viewer

A static React + Leaflet app that shows FAA-registered cranes near an address. Users enter an address and radius; the app geocodes it (Nominatim) and plots matching records from pre-fetched FAA CSVs.

Live: https://jeffreyp.github.io/faa-crane-viewer (GitHub Pages, no backend)

## Commands

```bash
npm start                             # dev server, localhost:3000
CARTO_API_KEY=... npm run build       # production build -> public/bundle.js
python3 scripts/update_faa_data.py    # refresh public/data/ (needs requests, pandas)
```

There is no test suite (`npm test` is a stub). Verify changes by running `npm start` and doing a search.

## Architecture

- **Data refresh:** `.github/workflows/update-faa-data.yml` runs daily at 06:00 UTC. It runs `scripts/update_faa_data.py`, commits changed CSVs to `main`, builds, and deploys `public/` with `gh-pages`.
- **Sources:**
  - **Part 77 (OE/AAA):** per-region downloads for the 9 FAA regions (AAL, ACE, AEA, AGL, ANE, ANM, ASO, ASW, AWP). Filtered for crane/construction keywords. Almost all records come from here.
  - **DOF (Digital Obstacle File):** filtered for crane/mobile equipment, DMS converted to decimal. Contributes only a few hundred records.
- **Output:** `public/data/part77-data.csv` (Part 77 only), `public/data/datafile.csv` (Part 77 + DOF, deduped on ASN), and raw per-region files in `public/data/regions/`.
- **Frontend:** `src/services/faaService.js` fetches both CSVs, parses them with PapaParse (in a Web Worker, `src/workers/csvParser.worker.js`, with a main-thread fallback), filters by Haversine distance in nautical miles, and dedupes. `src/App.js` orchestrates; `MapView`, `TableView`, and `SearchBar` are in `src/components/`. `src/utils/sanitize.js` sanitizes popup HTML with DOMPurify.

### NOTAMs: disabled

NOTAM support (`fetchNOTAMs` in `faaService.js`, proxied through `cloudflare-worker/notam-proxy.js`) is turned off. `NOTAM_PROXY_URL = null` in `src/config.js`. The FAA retired the legacy `notamSearch` endpoint in April 2026. Re-enabling requires NMS API credentials and migrating the worker and client; this is tracked in beads epic `fcv-gyi`. Don't treat NOTAM code or docs (including `DEPLOYMENT.md` and `cloudflare-worker/DEPLOYMENT.md`) as describing working behavior.

## Data contract

The CSVs use the OE/AAA column layout as-is (about 47 columns), plus a trailing `DATA_SOURCE` column set to `DOF` or `Part77-{REGION}`. The frontend depends on these exact column names, so don't rename or reorder columns in the Python pipeline:

`STUDY (ASN)`, `STATUS`, `LATITUDE`, `LONGITUDE` (decimal degrees), `STRUCTURE TYPE`, `STRUCTURE NAME`, `STRUCTURE CITY`, `STRUCTURE STATE`, `PROPOSAL DESCRIPTION`, `AGL HEIGHT DET`, `AGL HEIGHT PROPOSED`, `ENTERED DATE`, `EXPIRATION DATE`, `WORK SCHEDULE BEGINNING DATE`, `WORK SCHEDULE ENDING DATE`, `SPONSOR NAME `, `DATA_SOURCE`

Some FAA headers have trailing spaces (for example `"SPONSOR NAME "`); see `fcv-5qr`.

## Gotchas

- Build output (`public/bundle.js` and the other `public/*.bundle.js` chunks) is checked in. Rebuild with `npm run build` before committing source changes, or the deployed site won't match.
- A build without `CARTO_API_KEY` works, but the map tiles are watermarked. CI reads the key from the `CARTO_API_KEY` repo secret, and webpack injects it through `DefinePlugin`. Never hardcode it.
- Individual Part 77 regions fail sometimes. The script is designed to log the failure and continue; keep that behavior (catch, log, return empty rather than abort).

## Conventions

- Commit messages: `Add …` / `Fix …` / `Update …`, with a descriptive body. The data bot uses `Update FAA obstacle data - YYYY-MM-DD`.
- Match the existing style: functional React components, styled-components, and plain JS (no TypeScript).
- Don't commit or push unless asked.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
