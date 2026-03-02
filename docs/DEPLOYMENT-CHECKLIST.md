# 🚀 Deployment Checklist for Vercel

## Before Deploying

### 1. Set Environment Variables in Vercel Dashboard

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables for **Production**:

```
IMAGEKIT_URL_ENDPOINT = https://ik.imagekit.io/arielgenua
IMAGEKIT_PUBLIC_KEY = public_JJwG1EFYua4sXmfsyaNxIizE/DQ=
IMAGEKIT_PRIVATE_KEY = private_XXXXX (get from api/.env)
```

### 2. Verify Local Files

✅ `src/.env.production` - Should have:
```bash
VITE_IMAGEKIT_AUTH_ENDPOINT=/api/auth
```

✅ `vercel.json` - Should include API routing configuration

✅ `api/auth.js` - Serverless function ready

## Deploy

```bash
# Option 1: Deploy via Git Push
git push origin main
# Vercel will auto-deploy if connected to GitHub

# Option 2: Deploy via CLI
vercel --prod
```

## After Deployment

### Test the API endpoint

```bash
# Replace with your actual Vercel URL
curl https://your-app.vercel.app/api/auth
```

Expected response:
```json
{
  "token": "xxx",
  "signature": "xxx",
  "expire": 1234567890
}
```

### Test Image Upload

1. Go to `https://your-app.vercel.app/#/inventory`
2. Try uploading an image
3. Should upload successfully to ImageKit

## If Something Goes Wrong

### Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `/api/auth`
3. View the logs

### Common Issues

**Problem:** API returns 500 error
**Solution:** Check environment variables are set correctly in Vercel

**Problem:** CORS errors
**Solution:** Verify `vercel.json` has CORS headers configured

**Problem:** Can't find `/api/auth`
**Solution:** Make sure `api/auth.js` is committed to git

## Rollback Plan

If production breaks:

1. Revert to previous deployment:
   ```bash
   vercel rollback
   ```

2. Or redeploy a specific commit:
   ```bash
   vercel --prod
   ```

---

✅ **Current Status:** Ready for production deployment
📝 **Last Updated:** January 30, 2026
