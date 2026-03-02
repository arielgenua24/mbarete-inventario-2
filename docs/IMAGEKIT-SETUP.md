# ImageKit.io Setup Guide

This document explains how ImageKit integration works in both development and production environments.

## Architecture Overview

The app uses **ImageKit.io** for image hosting with a secure authentication flow:

1. **Frontend** (React/Vite) - Handles image selection and upload UI
2. **Backend API** - Generates secure authentication tokens
3. **ImageKit** - Stores and serves images via CDN

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser   │────1───▶│  Backend API │────2───▶│  ImageKit    │
│  (React)    │◀───4────│  (/api/auth) │         │   CDN        │
└─────────────┘         └──────────────┘         └──────────────┘
       │                                                  ▲
       └──────────────────3──────────────────────────────┘

1. Request auth token
2. Generate signature (using private key)
3. Upload image with token
4. Return image URL
```

## Environment Configuration

### Development (localhost + ngrok)

**Backend Server:** `http://localhost:3001`
**Frontend:** `http://localhost:5173` or `https://your-ngrok-url.ngrok.io`

**File:** `src/.env` or `src/.env.development`
```bash
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/arielgenua
VITE_IMAGEKIT_PUBLIC_KEY=public_JJwG1EFYua4sXmfsyaNxIizE/DQ=
VITE_IMAGEKIT_AUTH_ENDPOINT=http://localhost:3001/api/auth
```

**File:** `api/.env`
```bash
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/arielgenua
IMAGEKIT_PUBLIC_KEY=public_JJwG1EFYua4sXmfsyaNxIizE/DQ=
IMAGEKIT_PRIVATE_KEY=private_XXXXX  # Keep secret!
```

### Production (Vercel)

**Deployed URL:** `https://your-app.vercel.app`

**File:** `src/.env.production`
```bash
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/arielgenua
VITE_IMAGEKIT_PUBLIC_KEY=public_JJwG1EFYua4sXmfsyaNxIizE/DQ=
VITE_IMAGEKIT_AUTH_ENDPOINT=/api/auth  # Relative path for Vercel
```

**Vercel Environment Variables:**
Set these in your Vercel dashboard under Settings → Environment Variables:
```
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/arielgenua
IMAGEKIT_PUBLIC_KEY=public_JJwG1EFYua4sXmfsyaNxIizE/DQ=
IMAGEKIT_PRIVATE_KEY=private_XXXXX
```

## How It Works

### 1. Development Workflow

```bash
# Terminal 1: Start backend API
cd api
npm run dev
# Server running at http://localhost:3001

# Terminal 2: Start frontend
cd src
npm run dev
# Vite running at http://localhost:5173

# Terminal 3: (Optional) Expose via ngrok
ngrok http 5173
# Access via: https://abc123.ngrok.io
```

**Key Point:** Even when accessing via ngrok, the frontend still calls `http://localhost:3001/api/auth` for authentication (configured in `.env`).

### 2. Production Workflow

When deployed to Vercel:
- Frontend is served from `dist/` folder
- API functions are in `api/` folder
- Vercel automatically routes `/api/*` to serverless functions
- `VITE_IMAGEKIT_AUTH_ENDPOINT=/api/auth` becomes relative to your domain

```
https://your-app.vercel.app/          → Frontend (React app)
https://your-app.vercel.app/api/auth  → Backend (Serverless function)
```

## File Structure

```
reina-chura/
├── api/
│   ├── auth.js                 # ImageKit authentication handler
│   ├── server.js               # Local development server
│   ├── package.json
│   └── .env                    # Backend secrets (git-ignored)
│
├── src/
│   ├── src/
│   │   ├── services/
│   │   │   └── uploadImage.js  # Upload logic
│   │   └── components/
│   │       └── ImageUpload/    # Upload UI component
│   ├── .env                    # Development config
│   ├── .env.production         # Production config
│   └── package.json
│
└── vercel.json                 # Vercel configuration
```

## Troubleshooting

### Error: "Unexpected token '<', <!DOCTYPE..."

**Cause:** Frontend is calling wrong API endpoint (getting HTML instead of JSON)

**Solution:**
1. Check `VITE_IMAGEKIT_AUTH_ENDPOINT` in your `.env` file
2. Make sure backend API server is running (`npm run dev` in `api/`)
3. Restart Vite dev server after changing `.env`

### Error: "Failed to get authentication parameters: 500"

**Cause:** Backend can't authenticate with ImageKit (missing/wrong credentials)

**Solution:**
1. Check `api/.env` has correct `IMAGEKIT_PRIVATE_KEY`
2. Verify credentials in ImageKit dashboard
3. Check backend logs for detailed error

### Images not uploading in production

**Cause:** Vercel environment variables not set

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all three ImageKit variables
3. Redeploy your app

## Security Notes

- ✅ **Public Key** - Safe to expose in frontend code
- ✅ **URL Endpoint** - Safe to expose
- ❌ **Private Key** - NEVER commit to git, only in backend `.env`

The authentication flow ensures:
- Private key stays on the server
- Each upload gets a time-limited token
- Tokens expire after use (signatures are single-use)

## Deployment Checklist

Before deploying to production:

- [ ] Set ImageKit environment variables in Vercel dashboard
- [ ] Verify `src/.env.production` has `/api/auth` endpoint
- [ ] Test image upload in development
- [ ] Deploy to Vercel
- [ ] Test image upload in production

## Useful Commands

```bash
# Development
cd api && npm run dev          # Start backend API
cd src && npm run dev          # Start frontend

# Test auth endpoint
curl http://localhost:3001/api/auth

# Production build
cd src && npm run build        # Creates dist/ folder

# Deploy to Vercel
vercel --prod
```

## Environment Variables Reference

| Variable | Location | Environment | Example |
|----------|----------|-------------|---------|
| `VITE_IMAGEKIT_URL_ENDPOINT` | Frontend | Both | `https://ik.imagekit.io/arielgenua` |
| `VITE_IMAGEKIT_PUBLIC_KEY` | Frontend | Both | `public_XXXXX` |
| `VITE_IMAGEKIT_AUTH_ENDPOINT` | Frontend | Development | `http://localhost:3001/api/auth` |
| `VITE_IMAGEKIT_AUTH_ENDPOINT` | Frontend | Production | `/api/auth` |
| `IMAGEKIT_URL_ENDPOINT` | Backend | Both | `https://ik.imagekit.io/arielgenua` |
| `IMAGEKIT_PUBLIC_KEY` | Backend | Both | `public_XXXXX` |
| `IMAGEKIT_PRIVATE_KEY` | Backend | Both | `private_XXXXX` (SECRET) |

---

**Last Updated:** January 2026
**Maintained by:** Reina Chura Development Team
