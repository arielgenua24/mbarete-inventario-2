# 🔧 Local Development Setup (Simplest Way)

## The Easiest Way: Run Frontend and Backend Separately

Instead of using `vercel dev`, let's run them separately. This is simpler and works better for local development.

### Step 1: Create API Server Script

I'll create a simple Express server for local development:

**File: `api/server.js`**
```javascript
const express = require('express');
const cors = require('cors');
const authHandler = require('./auth');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/api/auth', (req, res) => {
  authHandler(req, res);
});

app.listen(PORT, () => {
  console.log(`✅ Backend API running at http://localhost:${PORT}`);
  console.log(`✅ API endpoint: http://localhost:${PORT}/api/auth`);
});
```

### Step 2: Update Upload Service

Update the frontend to use port 3001 for local development:

**File: `src/src/services/uploadImage.js`** (line ~161)
```javascript
const authEndpoint = window.location.hostname === "localhost"
  ? "http://localhost:3001/api/auth"  // Changed to 3001
  : "/api/auth";
```

### Step 3: Install Express

```bash
cd api
npm install express cors
```

### Step 4: Add Start Script

Update `api/package.json` to add a dev script:
```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "echo 'No build step required for serverless functions'"
  }
}
```

---

## 🚀 How to Run

### Terminal 1 - Backend API
```bash
cd api
npm run dev
```

You should see:
```
✅ Backend API running at http://localhost:3001
✅ API endpoint: http://localhost:3001/api/auth
```

### Terminal 2 - Frontend
```bash
cd src
npm run dev
```

You should see:
```
  VITE v6.0.5  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

---

## ✅ Test It

1. Open browser: `http://localhost:5173/#/inventory`
2. Click "Agregar Producto"
3. Try uploading an image
4. It should work! 🎉

---

## 🔍 Verify API Works

Test the backend endpoint:
```bash
curl http://localhost:3001/api/auth
```

Should return:
```json
{
  "token": "...",
  "expire": 1234567890,
  "signature": "..."
}
```

---

## 📝 Summary

**Local Development:**
- Backend: `http://localhost:3001` (API only)
- Frontend: `http://localhost:5173` (Vite dev server)

**Production (Vercel):**
- Everything: `https://your-app.vercel.app`
- API: `https://your-app.vercel.app/api/auth`

This separation makes local development easier and more reliable!
