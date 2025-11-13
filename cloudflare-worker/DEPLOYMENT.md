# Cloudflare Worker Deployment Guide

This guide will walk you through deploying the NOTAM API proxy to Cloudflare Workers.

## Prerequisites

- A Cloudflare account (free tier is sufficient)
- Your GitHub Pages URL: `https://jeffreyp.github.io/faa-crane-viewer`

## Deployment Steps

### Option 1: Dashboard Deployment (Easiest)

1. **Go to Cloudflare Workers Dashboard**
   - Visit: https://dash.cloudflare.com/
   - Sign up or log in
   - Navigate to "Workers & Pages" in the left sidebar

2. **Create a New Worker**
   - Click "Create Worker"
   - Give it a name: `faa-notam-proxy` (or similar)
   - Click "Deploy"

3. **Edit the Worker Code**
   - Click "Edit Code" button
   - Delete the default code
   - Copy and paste the contents of `notam-proxy.js`
   - Click "Save and Deploy"

4. **Get Your Worker URL**
   - Your worker will be available at: `https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev`
   - Copy this URL - you'll need it for the frontend configuration

5. **Test the Worker**
   ```bash
   curl -X POST https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "searchType=3&latDegrees=33&latMinutes=26&latSeconds=54&longDegrees=112&longMinutes=4&longSeconds=26&radius=25&latitudeDirection=N&longitudeDirection=W&offset=0&notamsOnly=false&filters=&recaptchaToken="
   ```

### Option 2: Wrangler CLI Deployment (Advanced)

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create wrangler.toml**
   ```toml
   name = "faa-notam-proxy"
   main = "notam-proxy.js"
   compatibility_date = "2025-01-01"

   [vars]
   ENVIRONMENT = "production"
   ```

4. **Deploy**
   ```bash
   cd cloudflare-worker
   wrangler deploy
   ```

## Configuration

### Update Frontend to Use Worker

After deployment, update `src/config.js` (you'll create this):

```javascript
export const NOTAM_PROXY_URL = 'https://faa-notam-proxy.YOUR-SUBDOMAIN.workers.dev';
```

Replace `YOUR-SUBDOMAIN` with your actual Cloudflare Workers subdomain.

### Allowed Origins

The worker is pre-configured to allow requests from:
- `https://jeffreyp.github.io` (your production site)
- `http://localhost:8080` (local development)
- `http://localhost:8888` (local development)

If you need to add more origins, edit the `ALLOWED_ORIGINS` array in `notam-proxy.js`.

## Monitoring and Limits

### Free Tier Limits
- **100,000 requests per day**
- **10ms CPU time per request**
- More than enough for the FAA Crane Viewer use case

### Monitor Usage
- Go to Workers Dashboard
- Click on your worker
- View metrics: requests, errors, CPU time

### Expected Usage
- Average user search: 1 NOTAM API request
- Typical response time: 50-200ms
- With 100 users/day: ~100 requests (well within limits)

## Troubleshooting

### Worker Returns 500 Error
- Check the worker logs in the Cloudflare dashboard
- Verify the NOTAM API is accessible
- Test the API directly from the worker's Quick Edit feature

### CORS Errors in Browser
- Verify your site's origin is in `ALLOWED_ORIGINS`
- Check browser console for specific error messages
- Ensure worker is deployed and accessible

### Slow Response Times
- Cloudflare Workers are globally distributed (edge network)
- First request might be slower (cold start)
- Subsequent requests should be < 100ms

## Security Considerations

### No Authentication Required
- The FAA NOTAM API is public and requires no API keys
- The worker adds no authentication

### Rate Limiting
- Cloudflare automatically protects against DDoS
- No manual rate limiting needed
- If abuse occurs, add rate limiting in worker code

### Data Privacy
- No user data is logged or stored
- Worker only forwards geographic coordinates to FAA API
- All data is public FAA information

## Cost Estimate

**Free Tier:** 100% adequate for this project

**If you exceed free tier:**
- Paid plan: $5/month for 10 million requests
- Extremely unlikely to be needed for this use case

## Next Steps

After deploying:

1. Copy your worker URL
2. Update `src/config.js` with the URL
3. Test locally with `npm start`
4. Deploy to GitHub Pages
5. Celebrate real-time NOTAMs! 🎉
