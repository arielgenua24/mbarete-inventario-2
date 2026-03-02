# 🚀 Correct Deployment Instructions

## ⚠️ Important: Don't Deploy from `/api` Directory

The error you saw happened because you ran `vercel dev` from the `/api` directory.

**The correct way is to deploy from the PROJECT ROOT.**

---

## ✅ Correct Deployment Steps

### For Local Development

**Option 1: Vercel Dev (Recommended)**
```bash
# From PROJECT ROOT (reina-chura/)
cd /Users/arielgenua/proyectos/reina-chura
vercel dev
```

This will:
- Start backend API at `http://localhost:3000/api/auth`
- Start frontend at `http://localhost:3000`

**Option 2: Separate Servers**

If you prefer to run them separately:

**Terminal 1 - Backend:**
```bash
cd /Users/arielgenua/proyectos/reina-chura
vercel dev --listen 3001
```

**Terminal 2 - Frontend:**
```bash
cd src
npm run dev
```

Then update `src/src/services/uploadImage.js` line 161:
```javascript
const authEndpoint = window.location.hostname === "localhost"
  ? "http://localhost:3001/api/auth"  // Changed from 3000 to 3001
  : "/api/auth";
```

---

### For Production Deployment

**Step 1: Deploy from Project Root**

```bash
# From PROJECT ROOT
cd /Users/arielgenua/proyectos/reina-chura
vercel --prod
```

**Step 2: Vercel will ask questions**

Answer like this:
```
? Set up and deploy "~/proyectos/reina-chura"? YES
? Which scope? [Your scope]
? Link to existing project? NO
? What's your project's name? reina-chura
? In which directory is your code located? ./
```

Vercel will detect:
- Frontend in `src/`
- API functions in `api/`

**Step 3: Add Environment Variables**

In Vercel Dashboard:
1. Go to your project
2. Settings → Environment Variables
3. Add all variables (see list below)
4. Redeploy

---

## 🔧 Project Structure for Vercel

```
reina-chura/              ← Deploy from here!
├── vercel.json           ← Vercel config
├── api/                  ← Backend functions
│   ├── auth.js          ← /api/auth endpoint
│   └── package.json
└── src/                  ← Frontend app
    ├── dist/            ← Build output
    ├── package.json
    └── vite.config.js
```

---

## 📋 Environment Variables Checklist

Add these in Vercel Dashboard for all environments (Production, Preview, Development):

### Backend Variables
```
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
IMAGEKIT_PUBLIC_KEY=public_xxx
IMAGEKIT_PRIVATE_KEY=private_xxx (mark as Sensitive)
NODE_ENV=production
```

### Frontend Variables
```
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
VITE_IMAGEKIT_PUBLIC_KEY=public_xxx

VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🧪 Test Deployment

After deploying:

1. **Test API endpoint:**
```bash
curl https://your-app.vercel.app/api/auth
```

Should return JSON with `token`, `expire`, `signature`.

2. **Test frontend:**
Visit `https://your-app.vercel.app`

3. **Test image upload:**
- Go to inventory
- Add product with image
- Verify it works!

---

## 🆘 If You Already Linked to `/api`

If you already ran `vercel` from the `/api` directory and it created a separate project, you need to:

**Option A: Delete that project**
1. Go to Vercel Dashboard
2. Find the `api` project
3. Settings → Delete Project

**Option B: Remove local link**
```bash
cd /Users/arielgenua/proyectos/reina-chura/api
rm -rf .vercel
```

Then deploy correctly from project root.

---

## ✅ Summary

| ❌ Wrong | ✅ Correct |
|----------|------------|
| `cd api && vercel dev` | `cd reina-chura && vercel dev` |
| Deploy from `/api` | Deploy from project root |
| Separate projects | Single project with both |

---

**The key**: Always deploy from the PROJECT ROOT, not from subdirectories!
