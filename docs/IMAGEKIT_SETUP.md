# 📸 ImageKit Setup Guide for Reina Chura

This guide will help you set up ImageKit.io for product image uploads in the Reina Chura inventory system.

---

## 🚀 Quick Start

### Step 1: Create ImageKit Account

1. Go to [ImageKit.io](https://imagekit.io)
2. Sign up for a free account
3. Navigate to **Developer Options** → **API Keys**
4. Copy the following credentials:
   - **URL Endpoint** (e.g., `https://ik.imagekit.io/your-id`)
   - **Public Key** (starts with `public_`)
   - **Private Key** (starts with `private_`)

### Step 2: Configure Backend (API)

1. Create `.env` file in `/api` directory:

```bash
cd api
cp .env.example .env
```

2. Edit `api/.env` and add your ImageKit credentials:

```env
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id
IMAGEKIT_PUBLIC_KEY=public_XXXXX
IMAGEKIT_PRIVATE_KEY=private_XXXXX
NODE_ENV=development
```

⚠️ **IMPORTANT**: Never commit `.env` files to Git. The private key must stay secret.

### Step 3: Configure Frontend (React App)

1. Create `.env` file in `/src` directory:

```bash
cd src
cp .env.example .env
```

2. Edit `src/.env` and add your ImageKit public credentials:

```env
# ImageKit Configuration (Public - Safe for frontend)
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id
VITE_IMAGEKIT_PUBLIC_KEY=public_XXXXX

# Keep your existing Firebase config here too
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# ... etc
```

### Step 4: Test Locally

1. Start the backend API server:

```bash
cd api
npm install
# For testing, you can use Vercel CLI:
npx vercel dev
```

This will start a local server at `http://localhost:3000` with the API endpoint available at `http://localhost:3000/api/auth`.

2. Start the frontend development server:

```bash
cd src
npm run dev
```

3. Test image upload:
   - Go to `http://localhost:5173/#/inventory`
   - Click "Agregar Producto"
   - Try uploading an image
   - Check that it uploads successfully

### Step 5: Deploy to Vercel

1. Install Vercel CLI (if not installed):

```bash
npm install -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

3. Deploy from project root:

```bash
vercel
```

4. Add environment variables in Vercel Dashboard:
   - Go to your project → **Settings** → **Environment Variables**
   - Add the following variables:

**Backend Variables** (all environments):
- `IMAGEKIT_URL_ENDPOINT` → `https://ik.imagekit.io/your-id`
- `IMAGEKIT_PUBLIC_KEY` → `public_XXXXX`
- `IMAGEKIT_PRIVATE_KEY` → `private_XXXXX` (mark as **Sensitive**)
- `NODE_ENV` → `production`

**Frontend Variables** (all environments):
- `VITE_IMAGEKIT_URL_ENDPOINT` → `https://ik.imagekit.io/your-id`
- `VITE_IMAGEKIT_PUBLIC_KEY` → `public_XXXXX`

5. Redeploy after adding variables:

```bash
vercel --prod
```

---

## 📁 Project Structure

```
reina-chura/
├── api/                          # Backend (Vercel Functions)
│   ├── auth.js                   # ImageKit authentication endpoint
│   ├── .env                      # Backend environment variables (gitignored)
│   ├── .env.example              # Backend environment template
│   └── package.json
│
├── src/                          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   └── ImageUpload/      # WhatsApp-style upload component
│   │   │       ├── index.jsx
│   │   │       └── styles.css
│   │   ├── services/
│   │   │   └── uploadImage.js    # ImageKit upload service
│   │   ├── pages/
│   │   │   ├── Inventory/        # Product list with images
│   │   │   └── Products/         # Edit product with image
│   │   └── modals/
│   │       └── ProductFormModal/ # Add product with image
│   ├── .env                      # Frontend environment variables (gitignored)
│   ├── .env.example              # Frontend environment template
│   └── package.json
│
└── vercel.json                   # Vercel deployment configuration
```

---

## 🎨 Features Implemented

### 1. WhatsApp-Style Image Upload
- Familiar drag-and-drop interface
- Instant preview
- Click or drag to upload
- Change/Remove options

### 2. Automatic Image Compression
- Reduces file size by ~90%
- Max dimensions: 1024x1024
- Quality: 60% (JPEG)
- Prevents large uploads (max 20MB)

### 3. Product Management with Images
- **Add Product**: Upload image when creating new product
- **Edit Product**: Change or add image to existing product
- **View Products**: Images displayed in inventory grid
- **Search Products**: Thumbnails shown in search results

### 4. Secure Upload Flow
1. User selects image in browser
2. Image compressed locally
3. Frontend requests auth token from backend (`/api/auth`)
4. Backend generates secure token (using private key)
5. Frontend uploads to ImageKit with token
6. ImageKit URL saved to Firestore

---

## 🔒 Security

### Private Key Protection
- ✅ Private key stays on backend only
- ✅ Never exposed to frontend
- ✅ Backend generates temporary auth tokens
- ✅ Tokens expire after use

### Public Key Safety
- ✅ Public key can be safely used in frontend
- ✅ Only works with valid auth tokens
- ✅ Cannot be used to upload without backend auth

---

## 🐛 Troubleshooting

### Issue: "Failed to get authentication parameters"

**Solution**:
- Check that `/api/auth.js` is deployed
- Verify backend environment variables are set
- Test endpoint: `curl https://your-app.vercel.app/api/auth`

### Issue: "CORS blocked"

**Solution**:
- Ensure `auth.js` has CORS headers (already configured)
- Check Vercel logs for errors

### Issue: "Image upload fails"

**Solution**:
- Check browser console for errors
- Verify ImageKit credentials are correct
- Ensure file is < 20MB
- Test with a simple JPG/PNG first

### Issue: "Local development auth fails"

**Solution**:
- Make sure `api/.env` exists with credentials
- Start Vercel dev server: `npx vercel dev` (not just `node api/auth.js`)
- Update upload service to use correct local URL (already configured)

### Issue: Images not showing in Vercel production

**Solution**:
- Verify environment variables are set in Vercel Dashboard
- Check that `VITE_` prefix is used for frontend variables
- Redeploy after adding variables

---

## 📊 ImageKit Dashboard

Access your ImageKit dashboard at: [https://imagekit.io/dashboard](https://imagekit.io/dashboard)

### Useful Features:
- **Media Library**: View all uploaded images
- **Transformations**: Resize/optimize images on-the-fly
- **Analytics**: Monitor bandwidth usage
- **Settings**: Configure storage, transformations, webhooks

---

## 💰 Pricing

ImageKit.io free tier includes:
- 20GB bandwidth/month
- 20GB media storage
- Unlimited image transformations
- CDN delivery worldwide

This is sufficient for ~500-1000 products with images.

---

## ✅ Verification Checklist

Before going live, verify:

- [ ] ImageKit account created
- [ ] API keys obtained
- [ ] Backend `.env` configured
- [ ] Frontend `.env` configured
- [ ] Local upload works
- [ ] Vercel environment variables added
- [ ] Production upload works
- [ ] Images display in inventory
- [ ] Images display in search
- [ ] Edit product image works
- [ ] Compression working (check file sizes in ImageKit)

---

## 🆘 Support

If you encounter issues:

1. Check ImageKit logs: [Dashboard → Analytics → Logs](https://imagekit.io/dashboard)
2. Check Vercel logs: [Project → Deployments → Click deployment → View Logs]
3. Check browser console for errors
4. Verify all environment variables are set correctly

---

## 📚 Additional Resources

- [ImageKit Documentation](https://docs.imagekit.io/)
- [ImageKit JavaScript SDK](https://github.com/imagekit-developer/imagekit-javascript)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)

---

**Setup Date**: 2026-01-27
**Version**: 1.0
**Author**: Claude + Ariel
