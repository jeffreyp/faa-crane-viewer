# Deployment Instructions for On-Demand NOTAM Architecture

This document provides step-by-step instructions for deploying the new on-demand NOTAM fetching architecture.

## Overview

The FAA Crane Viewer now uses a **hybrid data architecture**:
- **DOF + Part 77**: Pre-fetched daily via GitHub Actions, stored as static CSV files
- **NOTAMs**: Fetched on-demand when users search, via Cloudflare Worker proxy

This eliminates the unreliable batch NOTAM fetching and provides real-time data.

## Prerequisites

- Cloudflare account (free tier is sufficient)
- GitHub repository access
- Node.js and npm installed locally

## Deployment Steps

### Step 1: Deploy Cloudflare Worker

1. **Create Cloudflare Worker**
   - Go to https://dash.cloudflare.com/
   - Navigate to "Workers & Pages" → "Create Worker"
   - Name it: `faa-notam-proxy`

2. **Copy Worker Code**
   - Edit the worker
   - Delete default code
   - Paste contents of `cloudflare-worker/notam-proxy.js`
   - Click "Save and Deploy"

3. **Get Worker URL**
   - Copy your worker URL: `https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev`
   - You'll need this for Step 2

### Step 2: Configure Frontend

1. **Update Config File**
   - Open `src/config.js`
   - Update `NOTAM_PROXY_URL` with your Cloudflare Worker URL:
   ```javascript
   export const NOTAM_PROXY_URL = 'https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev';
   ```

2. **Test Locally**
   ```bash
   npm start
   # Open http://localhost:8080
   # Search for an address and verify:
   # 1. DOF/Part77 data loads (from static CSVs)
   # 2. NOTAM data loads (from Cloudflare Worker)
   # 3. Orange triangle markers appear for NOTAMs
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

### Step 3: Deploy to GitHub Pages

1. **Commit Changes**
   ```bash
   git add src/config.js cloudflare-worker/ DEPLOYMENT.md
   git commit -m "Add on-demand NOTAM fetching via Cloudflare Worker

   - Deploy Cloudflare Worker proxy for NOTAM API
   - Update frontend to fetch NOTAMs on-demand during searches
   - Remove batch NOTAM fetching from GitHub Actions
   - Reduce workflow timeout from 45 to 10 minutes
   - NOTAMs now provide real-time data instead of stale batch data

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   git push origin main
   ```

2. **Verify Deployment**
   - GitHub Actions will automatically build and deploy
   - Check workflow at: https://github.com/jeffreyp/faa-crane-viewer/actions
   - Visit live site: https://jeffreyp.github.io/faa-crane-viewer

### Step 4: Test End-to-End

1. **Test Search Functionality**
   - Go to live site
   - Search for a location with known cranes (e.g., "Phoenix, AZ")
   - Verify all three data sources appear:
     - DOF markers (standard crane icon)
     - Part77 markers (standard crane icon)
     - NOTAM markers (orange pulsing triangles)

2. **Check Browser Console**
   - Open Developer Tools → Console
   - Look for log messages:
     - "Fetching NOTAMs from proxy..."
     - "Received X NOTAMs from API"
     - "Filtered to Y crane-related NOTAMs"

3. **Test CORS**
   - Ensure no CORS errors in console
   - Cloudflare Worker should add proper headers

### Step 5: Monitor

1. **Cloudflare Worker Metrics**
   - Go to Workers Dashboard → Your Worker → Metrics
   - Monitor: requests, errors, CPU time
   - Free tier: 100K requests/day (plenty for typical usage)

2. **GitHub Actions**
   - Monitor daily data updates
   - Should complete in 2-3 minutes (down from 45-58 minutes)
   - No more NOTAM-related timeouts

## Troubleshooting

### NOTAM Data Not Loading

**Check:**
1. `src/config.js` has correct Cloudflare Worker URL
2. Browser console for errors
3. Cloudflare Worker logs (in dashboard)

**Common Issues:**
- CORS errors: Verify allowed origins in `notam-proxy.js`
- Timeout errors: NOTAM API may be slow, worker will return empty array
- No NOTAMs found: Normal - only 10-50 crane NOTAMs exist nationwide

### GitHub Actions Failures

**Check:**
1. Workflow timeout is set to 10 minutes (not 45)
2. No references to `notams.csv` in commit commands
3. No `aiohttp` in pip dependencies

**Common Issues:**
- DOF or Part77 APIs may be temporarily down
- Workflow will continue with available data sources

### Worker Exceeding Free Tier

**Unlikely but possible if:**
- Site has >100K unique users per day
- Each user performs multiple searches

**Solution:**
- Upgrade to Cloudflare Workers paid plan ($5/month for 10M requests)
- Add caching layer in worker (cache NOTAMs for 5-10 minutes)

## Architecture Benefits

### Before (Batch Fetching)
- ❌ 1,745 API calls every night
- ❌ 45-58 minute execution time
- ❌ Frequent GitHub Actions timeouts
- ❌ NOTAMs up to 24 hours stale
- ❌ Coverage gaps due to FAA API limitations

### After (On-Demand)
- ✅ 1 API call per user search
- ✅ < 1 second response time
- ✅ No GitHub Actions failures
- ✅ Real-time NOTAM data
- ✅ Only fetch data users actually view

## Rollback Plan

If issues arise, you can temporarily disable NOTAM fetching:

1. **Quick Disable**
   ```javascript
   // In src/config.js
   export const NOTAM_PROXY_URL = null; // Disables NOTAM fetching
   ```

2. **Rebuild and Deploy**
   ```bash
   npm run build
   git add src/config.js
   git commit -m "Temporarily disable NOTAM fetching"
   git push
   ```

3. **App continues working** with DOF + Part77 data (39K cranes)

## Cost Estimate

**Cloudflare Workers (Free Tier)**
- 100,000 requests per day
- Sufficient for estimated usage:
  - 100 users/day × 2 searches each = 200 requests/day
  - 99.8% under limit

**GitHub Actions (Free)**
- 2,000 minutes/month limit
- Current usage: ~3 minutes/day × 30 = 90 minutes/month
- 95.5% under limit

**Total Cost: $0/month** for typical usage

## Next Steps

After successful deployment:

1. Monitor Cloudflare Worker metrics for first week
2. Check GitHub Actions daily runs
3. Gather user feedback on NOTAM data accuracy
4. Consider adding:
   - Caching layer in Cloudflare Worker
   - Rate limiting if needed
   - Analytics to track NOTAM fetch success rate

## Support

- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- Worker code: `cloudflare-worker/notam-proxy.js`
- Frontend code: `src/services/faaService.js` (fetchNOTAMs function)
- GitHub Issues: https://github.com/jeffreyp/faa-crane-viewer/issues
