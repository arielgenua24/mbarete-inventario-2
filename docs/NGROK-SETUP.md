# 📱 Testing with Smartphone via ngrok

## Quick Start

### 1. Start your servers

```bash
# Terminal 1: Backend API
cd api
npm run dev
# ✅ Running at http://localhost:3001

# Terminal 2: Frontend
cd src
npm run dev
# ✅ Running at http://localhost:5173
```

### 2. Expose BOTH servers via ngrok

```bash
# Terminal 3: Expose API
ngrok http 3001
# Copy the URL: https://abc-api-123.ngrok.io

# Terminal 4: Expose Frontend
ngrok http 5173
# Copy the URL: https://def-frontend-456.ngrok.io
```

### 3. Configure ngrok API endpoint

In your ngrok frontend URL, you need to proxy API requests.

**Option A: Use Vite proxy (Recommended)**

Edit `src/vite.config.js` and add:

```javascript
export default defineConfig({
  // ... existing config
  server: {
    proxy: {
      '/api': {
        target: 'https://abc-api-123.ngrok.io', // Your ngrok API URL
        changeOrigin: true,
      }
    }
  }
})
```

Then restart Vite server.

**Option B: Set environment variable**

Create `src/.env.local`:
```bash
VITE_IMAGEKIT_AUTH_ENDPOINT=https://abc-api-123.ngrok.io/api/auth
```

Then restart Vite server.

### 4. Test on smartphone

1. Open your smartphone browser
2. Go to: `https://def-frontend-456.ngrok.io`
3. Navigate to `/#/inventory`
4. Try uploading an image

## How Auto-Detection Works

The app now **automatically** detects the correct API endpoint:

```javascript
// On localhost (computer browser)
→ http://localhost:3001/api/auth

// On ngrok (smartphone)
→ https://def-frontend-456.ngrok.io/api/auth
   → Proxied to → https://abc-api-123.ngrok.io/api/auth

// On production (Vercel)
→ /api/auth (Vercel routing)
```

## Troubleshooting

### "Failed to fetch" on smartphone

**Cause:** Frontend can't reach the API endpoint

**Solution:**
1. Make sure BOTH ngrok tunnels are running (API + Frontend)
2. Configure Vite proxy OR set `VITE_IMAGEKIT_AUTH_ENDPOINT`
3. Restart Vite dev server

### Mixed Content Errors

**Cause:** ngrok uses HTTPS, but trying to call HTTP localhost

**Solution:**
- Always use the ngrok HTTPS URL for API endpoint
- Never use `http://localhost:3001` from smartphone

### CORS Errors

**Cause:** API not allowing ngrok origin

**Solution:**
The API already has CORS enabled with `*` in `api/auth.js`, should work automatically.

## Advanced: Single ngrok Config

Create `ngrok.yml` in project root:

```yaml
version: "2"
authtoken: YOUR_NGROK_AUTHTOKEN

tunnels:
  api:
    addr: 3001
    proto: http

  frontend:
    addr: 5173
    proto: http
```

Then run:
```bash
ngrok start --all --config ngrok.yml
```

This starts both tunnels at once!

## Production Note

When deployed to Vercel, none of this is needed. The auto-detection will use `/api/auth` which Vercel routes to your serverless function.

---

**TL;DR:**
1. Run both servers (API + Frontend)
2. Expose both via ngrok
3. Configure Vite proxy with ngrok API URL
4. Access via ngrok frontend URL on smartphone

✅ **The app now auto-detects the correct endpoint - no manual .env changes needed!**
