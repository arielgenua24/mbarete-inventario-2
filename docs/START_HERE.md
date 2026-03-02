# 👋 START HERE - Image Upload Feature

## ✅ What's Done

The **image upload feature** is fully implemented! Users can now:
- ✅ Add images when creating products
- ✅ Edit/change images on existing products
- ✅ See images in inventory grid
- ✅ See image thumbnails in search results
- ✅ WhatsApp-style upload experience

## 📋 What You Need To Do

### 1️⃣ Get ImageKit Account (2 minutes)

1. Sign up at [imagekit.io](https://imagekit.io) (free tier is fine)
2. Go to **Dashboard** → **Developer** → **API Keys**
3. Copy these three values:
   ```
   URL Endpoint: https://ik.imagekit.io/xxx
   Public Key: public_xxx
   Private Key: private_xxx
   ```

### 2️⃣ Configure Local Environment (2 minutes)

**Backend:**
```bash
cd api
cp .env.example .env
# Edit api/.env and paste your ImageKit credentials
```

**Frontend:**
```bash
cd src
# Edit src/.env (should already exist)
# Add these two lines:
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/xxx
VITE_IMAGEKIT_PUBLIC_KEY=public_xxx
```

### 3️⃣ Test Locally (3 minutes)

**Option A: Single Command (Easiest)**
```bash
./start-dev.sh
```
This starts both backend and frontend automatically!

**Option B: Manual (Two Terminals)**

Terminal 1 - Backend:
```bash
cd api
npm run dev
```
Should start on `http://localhost:3001`

Terminal 2 - Frontend:
```bash
cd src
npm run dev
```
Should start on `http://localhost:5173`

**Test Upload:**
1. Open `http://localhost:5173/#/inventory`
2. Click "Agregar Producto"
3. Drag an image (or click camera icon)
4. Fill product details
5. Click "Guardar"
6. ✅ Image should upload and display!

### 4️⃣ Deploy to Vercel (5 minutes)

**Recommended: Via Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure:
   - Root Directory: `src`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables (both backend and frontend)
5. Click Deploy

**See `VERCEL_DEPLOYMENT.md` for detailed steps**

## 📚 Documentation Map

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **START_HERE.md** | You are here! | First |
| **QUICK_START.md** | 5-minute setup | Getting started |
| **IMAGEKIT_SETUP.md** | Complete setup guide | Detailed setup |
| **VERCEL_DEPLOYMENT.md** | Deploy instructions | Before deploying |
| **TESTING_GUIDE.md** | Test all features | Before production |
| **IMPLEMENTATION_SUMMARY.md** | Technical details | Understanding code |

## 🎯 Quick Reference

### File Locations

**Backend API:**
```
api/
├── auth.js          # ImageKit authentication endpoint
├── .env            # Backend environment variables (YOU CREATE)
└── .env.example    # Template for .env
```

**Frontend Components:**
```
src/src/
├── components/ImageUpload/    # Upload UI component
├── services/uploadImage.js    # Upload logic
├── modals/ProductFormModal/   # Add product with image
└── pages/Products/           # Edit product with image
```

### Environment Variables

**Backend (`api/.env`):**
```env
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/xxx
IMAGEKIT_PUBLIC_KEY=public_xxx
IMAGEKIT_PRIVATE_KEY=private_xxx
NODE_ENV=development
```

**Frontend (`src/.env`):**
```env
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/xxx
VITE_IMAGEKIT_PUBLIC_KEY=public_xxx

# Plus your existing Firebase config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# etc.
```

### Commands

**Install dependencies:**
```bash
cd api && npm install
cd ../src && npm install
```

**Start development:**
```bash
# Terminal 1
cd api && npx vercel dev

# Terminal 2
cd src && npm run dev
```

**Deploy:**
```bash
vercel --prod
```

## 🆘 Troubleshooting

### "Failed to get authentication parameters"
- Check `api/.env` has correct ImageKit credentials
- Verify backend is running: `curl http://localhost:3000/api/auth`

### "Image upload fails"
- Check browser console for errors
- Verify ImageKit credentials are correct
- Try a simple JPG file first (< 5MB)

### "Images don't display"
- Check Firestore: Does product have `imageUrl` field?
- Check ImageKit dashboard: Is image uploaded?
- Try opening image URL directly in browser

### "Vercel build fails"
- Check that `src/package.json` has `"build": "vite build"` in scripts
- Verify Root Directory is set to `src` in Vercel settings
- Check Vercel build logs for specific error

## ✅ Verification Checklist

Before going live:

- [ ] ImageKit account created
- [ ] API keys obtained
- [ ] `api/.env` configured
- [ ] `src/.env` updated with ImageKit keys
- [ ] Backend starts: `npx vercel dev` works
- [ ] Frontend starts: `npm run dev` works
- [ ] Test upload: Image uploads successfully locally
- [ ] Test display: Image shows in inventory
- [ ] Deployed to Vercel
- [ ] Environment variables added in Vercel dashboard
- [ ] Test upload in production
- [ ] Images display correctly in production

## 🎉 Success!

Once all checkboxes are checked, you're done! The image upload feature is live and ready to use.

## 📞 Need Help?

1. Check the relevant documentation file (see table above)
2. Review ImageKit dashboard for upload logs
3. Check Vercel deployment logs
4. Review browser console for frontend errors

---

**Implementation Date**: 2026-01-27
**Status**: ✅ Ready to Configure and Deploy
**Estimated Setup Time**: 15 minutes

**👉 Next Step**: Get your ImageKit credentials and configure `.env` files!
