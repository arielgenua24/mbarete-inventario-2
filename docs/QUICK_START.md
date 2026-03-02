# ⚡ Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Get ImageKit Credentials (2 min)
1. Go to [imagekit.io](https://imagekit.io) → Sign up
2. Dashboard → Developer → API Keys
3. Copy these 3 values:
   - URL Endpoint: `https://ik.imagekit.io/xxx`
   - Public Key: `public_xxx`
   - Private Key: `private_xxx`

### Step 2: Setup Backend (1 min)
```bash
cd api
npm install
cp .env.example .env
# Edit .env and paste your ImageKit credentials
```

### Step 3: Setup Frontend (1 min)
```bash
cd ../src
npm install
# Your .env should already exist with Firebase config
# Add these two lines to src/.env:
echo "VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/xxx" >> .env
echo "VITE_IMAGEKIT_PUBLIC_KEY=public_xxx" >> .env
```

### Step 4: Start Development (1 min)
```bash
# Terminal 1 (Backend)
cd api
npx vercel dev

# Terminal 2 (Frontend)
cd src
npm run dev
```

### Step 5: Test It! (30 sec)
1. Open `http://localhost:5173/#/inventory`
2. Click "Agregar Producto"
3. Drag an image to upload
4. Fill product details
5. Click "Guardar"
6. ✅ Done!

---

## 🔥 Deploy to Production

### Option A: Via Vercel Dashboard (Easiest)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Add environment variables (see `VERCEL_DEPLOYMENT.md`)
4. Click Deploy

### Option B: Via CLI
```bash
vercel login
vercel link  # First time only
vercel --prod
```

Then add environment variables in Vercel Dashboard:
- `IMAGEKIT_URL_ENDPOINT`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY` (mark as sensitive)
- `VITE_IMAGEKIT_URL_ENDPOINT`
- `VITE_IMAGEKIT_PUBLIC_KEY`
- Plus all your Firebase variables

**See `VERCEL_DEPLOYMENT.md` for detailed instructions**

---

## 📖 Full Documentation

- **Setup**: `IMAGEKIT_SETUP.md`
- **Testing**: `TESTING_GUIDE.md`
- **Summary**: `IMPLEMENTATION_SUMMARY.md`

---

## 🆘 Quick Troubleshooting

**Upload fails?**
- Check `http://localhost:3000/api/auth` returns JSON
- Verify ImageKit credentials in `.env`
- Check browser console for errors

**Images don't show?**
- Check Firestore: Does product have `imageUrl`?
- Check ImageKit dashboard: Is image uploaded?
- Try opening image URL directly in browser

**Vercel deploy fails?**
- Check all environment variables are set
- Redeploy after adding variables
- Check Vercel logs for errors

---

**Need Help?** Check the full guides in the repo! 📚
