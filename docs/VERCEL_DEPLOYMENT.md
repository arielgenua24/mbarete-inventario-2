# 🚀 Vercel Deployment Guide

## Option 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com) and login
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect the configuration

### Step 2: Configure Build Settings

Vercel should auto-detect, but verify:

**Framework Preset**: Vite
**Root Directory**: `src`
**Build Command**: `npm run build`
**Output Directory**: `dist`

### Step 3: Add Environment Variables

In the project settings, add these variables for **Production**, **Preview**, and **Development**:

**Backend Variables:**
```
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id
IMAGEKIT_PUBLIC_KEY=public_XXXXX
IMAGEKIT_PRIVATE_KEY=private_XXXXX (mark as Sensitive)
NODE_ENV=production
```

**Frontend Variables:**
```
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id
VITE_IMAGEKIT_PUBLIC_KEY=public_XXXXX

VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Step 4: Deploy

Click **"Deploy"** and wait for build to complete.

---

## Option 2: Deploy via CLI

### Prerequisites

```bash
npm install -g vercel
vercel login
```

### Deploy from Root Directory

```bash
# Link project (first time only)
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Add Environment Variables via CLI

```bash
# Backend variables
vercel env add IMAGEKIT_URL_ENDPOINT production
vercel env add IMAGEKIT_PUBLIC_KEY production
vercel env add IMAGEKIT_PRIVATE_KEY production
vercel env add NODE_ENV production

# Frontend variables
vercel env add VITE_IMAGEKIT_URL_ENDPOINT production
vercel env add VITE_IMAGEKIT_PUBLIC_KEY production

# Add Firebase variables (if not already added)
vercel env add VITE_FIREBASE_API_KEY production
# ... etc
```

After adding variables, redeploy:
```bash
vercel --prod
```

---

## Project Structure for Vercel

Vercel will detect this structure:

```
reina-chura/
├── src/                    # Frontend (Vite app)
│   ├── dist/              # Build output (generated)
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js
│
└── api/                    # Backend (Serverless functions)
    ├── auth.js            # /api/auth endpoint
    └── package.json       # Backend dependencies
```

---

## Verify Deployment

### 1. Check API Endpoint

```bash
curl https://your-app.vercel.app/api/auth
```

Expected response:
```json
{
  "token": "...",
  "expire": 1234567890,
  "signature": "..."
}
```

### 2. Test Frontend

Visit: `https://your-app.vercel.app`

### 3. Test Image Upload

1. Go to inventory page
2. Add a product with image
3. Verify upload works in production

---

## Troubleshooting

### Build Fails

**Error**: `Missing build script`

**Solution**: The build command should be `npm run build` in the `src` directory.

Vercel settings should be:
- Root Directory: `src`
- Build Command: `npm run build`
- Output Directory: `dist`

### API Returns 404

**Error**: `/api/auth` returns 404

**Solution**:
1. Check that `api/` folder is at project root (not inside `src/`)
2. Verify `api/auth.js` exists
3. Check Vercel function logs

### Environment Variables Not Working

**Error**: Upload fails with auth error

**Solution**:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify all variables are set
3. Make sure you selected the right environment (Production/Preview/Development)
4. Redeploy after adding variables

### CORS Errors

**Error**: CORS blocked when uploading

**Solution**: The `api/auth.js` already includes CORS headers. If still failing:
1. Check browser console for exact error
2. Verify the `Access-Control-Allow-Origin` header is set to `*`
3. Try clearing browser cache

---

## Performance Tips

### 1. Enable Vercel Speed Insights

```bash
npm install @vercel/speed-insights --prefix src
```

Add to your React app:
```javascript
import { SpeedInsights } from '@vercel/speed-insights/react';

function App() {
  return (
    <>
      <YourApp />
      <SpeedInsights />
    </>
  );
}
```

### 2. Enable Analytics

In Vercel Dashboard:
- Go to Analytics tab
- Enable Web Analytics

### 3. Configure Caching

ImageKit automatically handles caching. For optimal performance:
- Images are cached by CDN
- Browser caching enabled
- No additional config needed

---

## Custom Domain (Optional)

### Add Domain

1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Wait for SSL certificate (automatic)

### Update ImageKit CORS

In ImageKit Dashboard:
1. Settings → Security → Allowed Origins
2. Add your custom domain
3. Save changes

---

## Monitoring

### Vercel Dashboard

Monitor:
- Deployments status
- Function execution logs
- Build logs
- Analytics
- Error tracking

### ImageKit Dashboard

Monitor:
- Upload statistics
- Bandwidth usage
- Storage usage
- Request logs

---

## Rollback

If deployment fails or has issues:

```bash
# List deployments
vercel ls

# Promote specific deployment to production
vercel promote <deployment-url>
```

Or in Dashboard:
1. Go to Deployments
2. Find working deployment
3. Click "..." → "Promote to Production"

---

## Cost Estimates

### Vercel Free Tier
- 100 GB bandwidth/month
- Unlimited requests
- Serverless function executions: 100 GB-Hours
- **Sufficient for small-medium inventory apps**

### ImageKit Free Tier
- 20 GB bandwidth/month
- 20 GB storage
- Unlimited transformations
- **Sufficient for ~500-1000 products**

---

## Support

**Vercel Issues**: [vercel.com/support](https://vercel.com/support)
**ImageKit Issues**: [support@imagekit.io](mailto:support@imagekit.io)

---

**Last Updated**: 2026-01-27
