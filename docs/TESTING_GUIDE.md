# 🧪 Testing Guide - Image Upload Feature

## Pre-Testing Setup

Before testing, ensure you have:

1. ✅ ImageKit account created
2. ✅ API keys configured in `.env` files
3. ✅ Dependencies installed:
   ```bash
   cd api && npm install
   cd ../src && npm install
   ```

---

## Local Testing

### Test 1: Start Development Servers

**Backend (Vercel Functions):**
```bash
cd api
npx vercel dev
```
Expected: Server running on `http://localhost:3000`

**Frontend (Vite):**
```bash
cd src
npm run dev
```
Expected: Server running on `http://localhost:5173`

### Test 2: Verify API Endpoint

Open browser or use curl:
```bash
curl http://localhost:3000/api/auth
```

Expected response:
```json
{
  "token": "...",
  "expire": 1234567890,
  "signature": "..."
}
```

If this fails, check `api/.env` credentials.

---

## Feature Testing

### Test 3: Add Product with Image

1. Go to `http://localhost:5173/#/inventory`
2. Click **"+ Agregar Producto"**
3. Fill product details:
   - Name: "Test Product"
   - Price: 1000
   - Stock: 10
   - Details: "Test description"
4. **Upload Image**:
   - Click on camera icon OR drag image
   - Try: `test-image.jpg` (< 5MB)
5. Wait for upload (should show progress)
6. Click **"Guardar"**

**Expected Results:**
- ✅ Image compresses automatically
- ✅ Upload completes in < 10 seconds
- ✅ Product saved with image URL
- ✅ Image appears in inventory grid

**What to Check:**
- Browser console: No errors
- Network tab: Check `/api/auth` call succeeds
- ImageKit dashboard: Image appears in Media Library

### Test 4: Search Product with Image

1. Stay on `/inventory`
2. Type product name in search bar
3. View search results

**Expected Results:**
- ✅ Product thumbnail shows in search
- ✅ Image is 80x80px
- ✅ Image loads quickly

### Test 5: Edit Product Image

1. Click **"EDITAR"** on a product
2. Navigate to `/product/:id`
3. See existing image (if any)
4. Click **"Cambiar"** on image
5. Upload new image
6. Click **"Guardar Cambios"**

**Expected Results:**
- ✅ New image replaces old one
- ✅ Changes saved to Firestore
- ✅ Old image URL replaced (optional: delete old from ImageKit)

### Test 6: Remove Product Image

1. Edit a product with an image
2. Click **"Eliminar"** on image
3. Save changes

**Expected Results:**
- ✅ Image removed from preview
- ✅ `imageUrl` field cleared in Firestore

---

## Edge Case Testing

### Test 7: Large Image (Compression)

Upload a large image:
- Try: 4000x3000px, 8MB JPG

**Expected Results:**
- ✅ Compresses to ~200-400KB
- ✅ Resizes to max 1024x1024
- ✅ Upload succeeds

### Test 8: Very Large Image (Rejection)

Upload a very large image:
- Try: 25MB file

**Expected Results:**
- ✅ Shows error: "La imagen es muy grande. Máximo 20MB"
- ✅ Upload blocked

### Test 9: Invalid File Type

Upload non-image file:
- Try: document.pdf or music.mp3

**Expected Results:**
- ✅ Shows error: "Por favor selecciona una imagen válida"
- ✅ Upload blocked

### Test 10: Offline Behavior

1. Start upload
2. Disconnect WiFi mid-upload

**Expected Results:**
- ✅ Shows error message
- ✅ Image preview reverts to previous
- ✅ No corrupted data in Firestore

### Test 11: Multiple Products

Create 5 products with images rapidly:

**Expected Results:**
- ✅ All uploads succeed
- ✅ No duplicate uploads
- ✅ Each product has correct image

---

## Production Testing (Vercel)

### Test 12: Deploy to Vercel

```bash
vercel --prod
```

### Test 13: Production Environment Variables

In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Verify all variables exist:
   - `IMAGEKIT_URL_ENDPOINT`
   - `IMAGEKIT_PUBLIC_KEY`
   - `IMAGEKIT_PRIVATE_KEY`
   - `VITE_IMAGEKIT_URL_ENDPOINT`
   - `VITE_IMAGEKIT_PUBLIC_KEY`

### Test 14: Production API Endpoint

```bash
curl https://your-app.vercel.app/api/auth
```

Expected: Valid auth response

### Test 15: Production Upload

1. Go to production URL
2. Add product with image
3. Verify upload works

**Check:**
- ✅ API endpoint uses production URL
- ✅ Images stored in ImageKit
- ✅ Images display from ImageKit CDN

---

## Performance Testing

### Test 16: Image Load Speed

Use Chrome DevTools → Network:

**Metrics to check:**
- ImageKit CDN response time: < 200ms
- Image size after compression: 200-500KB
- Total upload time: < 10 seconds

### Test 17: Multiple Uploads

Upload 10 images in different products:

**Expected:**
- ✅ No memory leaks
- ✅ All images load correctly
- ✅ No console errors

---

## Troubleshooting Tests

### Test 18: Wrong ImageKit Credentials

1. Change `IMAGEKIT_PUBLIC_KEY` to invalid value
2. Try upload

**Expected:**
- ✅ Clear error message
- ✅ No crash

### Test 19: Backend Down

1. Stop Vercel dev server
2. Try upload

**Expected:**
- ✅ Shows error: "Failed to get authentication parameters"
- ✅ Graceful failure

### Test 20: Slow Network

Chrome DevTools → Network → Throttle to "Slow 3G":

**Expected:**
- ✅ Shows upload progress
- ✅ Eventually succeeds
- ✅ No timeout errors

---

## Security Testing

### Test 21: Private Key Exposure

1. Check frontend bundle (production build)
2. Search for "private_"

**Expected:**
- ✅ NO private key in frontend code
- ✅ Only public key present

### Test 22: Direct Upload Attempt

Try to upload directly to ImageKit without backend auth:

**Expected:**
- ✅ Upload fails (requires valid token)

---

## Checklist Summary

Print and check off as you test:

**Basic Functionality:**
- [ ] Add product with image
- [ ] Edit product image
- [ ] Remove product image
- [ ] Images display in inventory
- [ ] Images display in search

**Edge Cases:**
- [ ] Large image compression works
- [ ] Very large images rejected
- [ ] Invalid file types rejected
- [ ] Offline errors handled

**Production:**
- [ ] Vercel deployment succeeds
- [ ] Environment variables configured
- [ ] Production uploads work
- [ ] Images served from CDN

**Performance:**
- [ ] Upload time < 10 seconds
- [ ] Image load time < 200ms
- [ ] Compression working (90% reduction)

**Security:**
- [ ] Private key not in frontend
- [ ] Auth token required for uploads
- [ ] CORS configured correctly

---

## When Tests Fail

### Upload Fails

1. Check browser console for errors
2. Check `/api/auth` endpoint works
3. Verify ImageKit credentials
4. Check network tab for failed requests

### Images Don't Display

1. Check Firestore: Does product have `imageUrl`?
2. Check ImageKit: Is image in Media Library?
3. Check image URL is valid (copy-paste in browser)
4. Check CORS (ImageKit serves images publicly by default)

### Performance Issues

1. Check file sizes in ImageKit
2. Verify compression is working
3. Check network speed
4. Use ImageKit transformations if needed

---

## Success Criteria

✅ **All tests pass** means:
- Images upload successfully
- Compression reduces file size by ~90%
- Images display correctly everywhere
- No console errors
- Production deployment works
- Private key stays secure

🎉 **Ready for production!**

---

**Last Updated**: 2026-01-27
**Test Status**: Ready for execution
