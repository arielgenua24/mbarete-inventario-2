# 🤖 Guía para LLM: Implementación de ImageKit.io

> **Propósito**: Este documento está diseñado para que un LLM pueda implementar un sistema completo de upload de imágenes con ImageKit.io siguiendo instrucciones paso a paso de forma pragmática.

---

## 📋 CONTEXTO RÁPIDO

**¿Qué vamos a hacer?**
Implementar un sistema de upload de imágenes que:
1. Comprime imágenes en el navegador (reduce 90% del tamaño)
2. Sube a ImageKit.io de forma segura
3. Procesa en segundo plano con barra de progreso
4. Maneja errores y archivos grandes

**Stack tecnológico:**
- Frontend: React + Vite
- Backend: Node.js + Express (Vercel Functions)
- CDN: ImageKit.io
- Librerías: `imagekit-javascript`, `compressorjs`

---

## ⚡ PASO 1: CONFIGURACIÓN INICIAL

### 1.1 Obtener credenciales de ImageKit

```bash
# IR A: https://imagekit.io
# Crear cuenta → Developer Options → Copiar:

IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/tu-id"
IMAGEKIT_PUBLIC_KEY="public_XXXXX"
IMAGEKIT_PRIVATE_KEY="private_XXXXX"
```

### 1.2 Instalar dependencias

```bash
# Backend
cd api
npm install imagekit dotenv express

# Frontend
cd frontend
npm install imagekit-javascript compressorjs
```

### 1.3 Crear archivos de entorno

**Backend: `api/.env`**
```env
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/tu-id
IMAGEKIT_PUBLIC_KEY=public_XXXXX
IMAGEKIT_PRIVATE_KEY=private_XXXXX
PORT=3001
NODE_ENV=development
```

**Frontend: `frontend/.env.development`**
```env
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/tu-id
VITE_IMAGEKIT_PUBLIC_KEY=public_XXXXX
```

**Frontend: `frontend/.env.production`**
```env
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/tu-id
VITE_IMAGEKIT_PUBLIC_KEY=public_XXXXX
```

---

## ⚡ PASO 2: BACKEND - ENDPOINT DE AUTENTICACIÓN

### 2.1 Crear `api/auth.js`

```javascript
const ImageKit = require('imagekit');
require('dotenv').config();

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const imagekit = new ImageKit({
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY
    });

    const authenticationParameters = imagekit.getAuthenticationParameters();
    res.status(200).json(authenticationParameters);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
```

### 2.2 Probar endpoint

```bash
# Desarrollo local
curl http://localhost:3001/api/auth

# Debe retornar:
# {
#   "token": "xxx",
#   "expire": 1234567890,
#   "signature": "yyy"
# }
```

---

## ⚡ PASO 3: FRONTEND - SERVICIO DE UPLOAD

### 3.1 Crear `frontend/src/services/uploadImage.js`

```javascript
import ImageKit from "imagekit-javascript";
import Compressor from 'compressorjs';

// Instanciar ImageKit con clave pública
const imagekit = new ImageKit({
  publicKey: import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY,
  urlEndpoint: import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT,
});

// Comprimir imagen
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.6,
      maxWidth: 1024,
      maxHeight: 1024,
      mimeType: "image/jpeg",
      success: resolve,
      error: reject,
    });
  });
};

// Obtener tokens de autenticación
const getAuthParams = async () => {
  const authEndpoint = window.location.hostname === "localhost"
    ? "http://localhost:3001/api/auth"
    : "/api/auth";

  const response = await fetch(authEndpoint);
  if (!response.ok) throw new Error('Auth failed');
  return await response.json();
};

// Subir archivo individual
const uploadFile = async (file, authData) => {
  return new Promise((resolve, reject) => {
    imagekit.upload({
      file: file,
      fileName: file.name,
      token: authData.token,
      signature: authData.signature,
      expire: authData.expire,
    }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// Función principal
async function uploadImages(images) {
  const imageArray = Array.isArray(images) ? images : [images];
  const validImages = imageArray.filter(img => img != null);

  if (validImages.length === 0) {
    throw new Error("No hay imágenes válidas");
  }

  // Comprimir todas
  const compressed = await Promise.all(
    validImages.map(img => compressImage(img))
  );

  // Obtener auth
  const authData = await getAuthParams();

  // Subir todas
  const results = await Promise.all(
    compressed.map(img => uploadFile(img, authData))
  );

  return results;
}

export default uploadImages;
```

---

## ⚡ PASO 4: MANEJO DE IMÁGENES GRANDES

### 4.1 Crear `frontend/src/services/intelligentUpload.js`

```javascript
import Compressor from 'compressorjs';
import uploadImages from './uploadImage';

// Obtener dimensiones
const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Analizar archivo
const analyzeFile = async (file) => {
  const fileSizeInMB = file.size / (1024 * 1024);
  const { width, height } = await getImageDimensions(file);
  const megapixels = (width * height) / 1000000;

  // Archivo muy grande - RECHAZAR
  if (fileSizeInMB > 20 || megapixels > 25) {
    return {
      canProcess: false,
      message: `Archivo muy grande (${fileSizeInMB.toFixed(1)}MB, ${width}x${height}).\n\nReduce el tamaño usando:\n1. WhatsApp (envíatela a ti mismo)\n2. Google Photos (versión "Alta calidad")\n3. squoosh.app`
    };
  }

  // Archivo grande - ADVERTIR
  if (fileSizeInMB > 10 || megapixels > 12) {
    return {
      canProcess: true,
      strategy: 'two-phase',
      warning: `Archivo grande (${fileSizeInMB.toFixed(1)}MB). Puede tomar 10-30 segundos.`
    };
  }

  // Archivo normal
  return { canProcess: true, strategy: 'normal' };
};

// Compresión en dos fases (para archivos grandes)
const compressInTwoPhases = async (file) => {
  // Fase 1: Reducir dimensiones
  const phase1 = await new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 1.0,
      maxWidth: 1024,
      maxHeight: 1024,
      mimeType: "image/jpeg",
      success: resolve,
      error: reject,
    });
  });

  // Fase 2: Comprimir calidad
  const phase2 = await new Promise((resolve, reject) => {
    new Compressor(phase1, {
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
      mimeType: "image/jpeg",
      success: resolve,
      error: reject,
    });
  });

  return phase2;
};

// Compresión normal
const compressNormal = (file) => {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.6,
      maxWidth: 1024,
      maxHeight: 1024,
      mimeType: "image/jpeg",
      success: resolve,
      error: reject,
    });
  });
};

// Función principal con análisis inteligente
async function intelligentUpload(file, options = {}) {
  const { onProgress = () => {} } = options;

  try {
    // Analizar
    onProgress({ stage: 'analyzing', progress: 5, message: 'Analizando...' });
    const analysis = await analyzeFile(file);

    // Rechazar si es muy grande
    if (!analysis.canProcess) {
      throw new Error(analysis.message);
    }

    // Mostrar advertencia
    if (analysis.warning) {
      const confirmed = window.confirm(analysis.warning + '\n\n¿Continuar?');
      if (!confirmed) throw new Error('Cancelado por el usuario');
    }

    // Comprimir
    onProgress({ stage: 'compressing', progress: 20, message: 'Comprimiendo...' });
    const compressed = analysis.strategy === 'two-phase'
      ? await compressInTwoPhases(file)
      : await compressNormal(file);

    // Subir
    onProgress({ stage: 'uploading', progress: 70, message: 'Subiendo...' });
    const result = await uploadImages(compressed);

    onProgress({ stage: 'done', progress: 100, message: 'Completado' });
    return result;

  } catch (error) {
    onProgress({ stage: 'error', progress: 0, message: error.message });
    throw error;
  }
}

export default intelligentUpload;
```

---

## ⚡ PASO 5: SISTEMA DE COLA CON PROGRESO

### 5.1 Crear `frontend/src/services/UploadQueueManager.js`

```javascript
import intelligentUpload from './intelligentUpload';

class UploadQueueManager {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.queue = [];
    this.active = [];
    this.completed = [];
    this.failed = [];
    this.listeners = [];
    this.isPaused = false;
  }

  addFiles(files) {
    const fileArray = Array.isArray(files) ? files : [files];

    fileArray.forEach((file, index) => {
      this.queue.push({
        id: `${Date.now()}-${index}`,
        file: file,
        status: 'pending',
        progress: 0,
        result: null,
        error: null,
        startTime: null,
        endTime: null
      });
    });

    this.notifyListeners();
    this.processQueue();
  }

  async processQueue() {
    if (this.isPaused || this.active.length >= this.maxConcurrent) return;

    const nextItem = this.queue.find(item => item.status === 'pending');
    if (!nextItem) {
      if (this.active.length === 0) this.onAllCompleted();
      return;
    }

    nextItem.status = 'processing';
    nextItem.startTime = Date.now();
    this.active.push(nextItem);
    this.notifyListeners();

    try {
      const result = await intelligentUpload(nextItem.file, {
        onProgress: (status) => {
          nextItem.progress = status.progress;
          nextItem.statusMessage = status.message;
          this.notifyListeners();
        }
      });

      nextItem.status = 'completed';
      nextItem.progress = 100;
      nextItem.result = result;
      nextItem.endTime = Date.now();
      this.completed.push(nextItem);
      this.active = this.active.filter(item => item.id !== nextItem.id);

    } catch (error) {
      nextItem.status = 'failed';
      nextItem.error = error.message;
      nextItem.endTime = Date.now();
      this.failed.push(nextItem);
      this.active = this.active.filter(item => item.id !== nextItem.id);
    }

    this.notifyListeners();
    this.processQueue();
  }

  pause() {
    this.isPaused = true;
    this.notifyListeners();
  }

  resume() {
    this.isPaused = false;
    this.processQueue();
    this.notifyListeners();
  }

  cancel(itemId) {
    const item = this.queue.find(i => i.id === itemId);
    if (item && item.status === 'pending') {
      item.status = 'cancelled';
      this.failed.push(item);
      this.queue = this.queue.filter(i => i.id !== itemId);
      this.notifyListeners();
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  getState() {
    const total = this.queue.length + this.active.length +
                  this.completed.length + this.failed.length;
    const processed = this.completed.length + this.failed.length;

    return {
      queue: [...this.queue],
      active: [...this.active],
      completed: [...this.completed],
      failed: [...this.failed],
      total,
      processed,
      pending: this.queue.filter(i => i.status === 'pending').length,
      overallProgress: total > 0 ? Math.round((processed / total) * 100) : 0,
      isPaused: this.isPaused,
      isProcessing: this.active.length > 0 ||
                    this.queue.some(i => i.status === 'pending')
    };
  }

  onAllCompleted() {
    console.log('✅ Todos los uploads completados');
    this.notifyListeners();
  }
}

export default UploadQueueManager;
```

### 5.2 Crear hook `frontend/src/hooks/useImageUploadQueue.js`

```javascript
import { useState, useEffect, useRef } from 'react';
import UploadQueueManager from '../services/UploadQueueManager';

function useImageUploadQueue(options = {}) {
  const [state, setState] = useState({
    queue: [],
    active: [],
    completed: [],
    failed: [],
    total: 0,
    processed: 0,
    pending: 0,
    overallProgress: 0,
    isPaused: false,
    isProcessing: false
  });

  const managerRef = useRef(null);

  useEffect(() => {
    managerRef.current = new UploadQueueManager({
      maxConcurrent: options.maxConcurrent || 3
    });

    const unsubscribe = managerRef.current.subscribe((newState) => {
      setState(newState);
    });

    return () => unsubscribe();
  }, []);

  return {
    state,
    addFiles: (files) => managerRef.current.addFiles(files),
    pause: () => managerRef.current.pause(),
    resume: () => managerRef.current.resume(),
    cancel: (itemId) => managerRef.current.cancel(itemId),
  };
}

export default useImageUploadQueue;
```

---

## ⚡ PASO 6: COMPONENTE UI CON PROGRESO

### 6.1 Crear `frontend/src/components/ImageUploadQueue.jsx`

```javascript
import React, { useState } from 'react';
import useImageUploadQueue from '../hooks/useImageUploadQueue';
import './ImageUploadQueue.css';

function ImageUploadQueue({ onAllCompleted }) {
  const { state, addFiles, pause, resume, cancel } = useImageUploadQueue();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) addFiles(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    );
    if (files.length > 0) addFiles(files);
  };

  React.useEffect(() => {
    if (state.total > 0 && !state.isProcessing && state.completed.length > 0) {
      if (onAllCompleted) {
        onAllCompleted({
          completed: state.completed.map(item => item.result),
          failed: state.failed
        });
      }
    }
  }, [state.isProcessing, state.completed.length, state.total]);

  return (
    <div className="upload-queue">
      {/* DROP ZONE */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-input">
          <div className="drop-zone-icon">📁</div>
          <p>Arrastra imágenes aquí o haz click</p>
        </label>
      </div>

      {/* BARRA GLOBAL */}
      {state.total > 0 && (
        <div className="global-progress">
          <div className="progress-header">
            <h3>Progreso: {state.processed} / {state.total}</h3>
            {state.isProcessing && (
              <button onClick={state.isPaused ? resume : pause}>
                {state.isPaused ? '▶️ Reanudar' : '⏸️ Pausar'}
              </button>
            )}
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${state.overallProgress}%` }}
            >
              {state.overallProgress}%
            </div>
          </div>

          <div className="stats">
            <span>✅ {state.completed.length}</span>
            <span>⏳ {state.active.length}</span>
            <span>📋 {state.pending}</span>
            {state.failed.length > 0 && (
              <span className="failed">❌ {state.failed.length}</span>
            )}
          </div>
        </div>
      )}

      {/* LISTA DE ARCHIVOS */}
      <div className="files-list">
        {[...state.active, ...state.queue, ...state.completed, ...state.failed].map(item => (
          <FileCard key={item.id} item={item} onCancel={() => cancel(item.id)} />
        ))}
      </div>
    </div>
  );
}

function FileCard({ item, onCancel }) {
  const getIcon = () => {
    switch (item.status) {
      case 'processing': return '⏳';
      case 'pending': return '📋';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '📄';
    }
  };

  return (
    <div className={`file-card ${item.status}`}>
      <div className="file-header">
        <span>{getIcon()}</span>
        <span className="file-name">{item.file.name}</span>
        <span className="file-size">
          {(item.file.size / 1024 / 1024).toFixed(2)} MB
        </span>
        {item.status === 'pending' && (
          <button onClick={onCancel}>✖️</button>
        )}
      </div>

      {item.status === 'processing' && (
        <div className="file-progress">
          <div className="file-progress-bar">
            <div
              className="file-progress-fill"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <span>{item.statusMessage}</span>
        </div>
      )}

      {item.status === 'completed' && item.result && (
        <img
          src={item.result[0]?.url}
          alt="Preview"
          className="preview"
        />
      )}

      {item.status === 'failed' && (
        <div className="error">{item.error}</div>
      )}
    </div>
  );
}

export default ImageUploadQueue;
```

### 6.2 Crear `frontend/src/components/ImageUploadQueue.css`

```css
.upload-queue {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  background: #fafafa;
  transition: all 0.3s;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: #4CAF50;
  background: #f0f8f0;
}

.drop-zone-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.global-progress {
  margin-top: 24px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.progress-bar {
  width: 100%;
  height: 32px;
  background: #e0e0e0;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
}

.stats {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 14px;
}

.stats .failed {
  color: #f44336;
}

.files-list {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-card {
  padding: 16px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.file-card.processing {
  border-left: 4px solid #2196F3;
}

.file-card.completed {
  border-left: 4px solid #4CAF50;
}

.file-card.failed {
  border-left: 4px solid #f44336;
}

.file-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-progress {
  margin-top: 12px;
}

.file-progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.file-progress-fill {
  height: 100%;
  background: #2196F3;
  transition: width 0.3s;
}

.preview {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  margin-top: 12px;
}

.error {
  margin-top: 8px;
  padding: 8px;
  background: #ffebee;
  border-radius: 4px;
  color: #c62828;
  font-size: 12px;
}
```

---

## ⚡ PASO 7: USO EN TU APLICACIÓN

### 7.1 Ejemplo de uso

```javascript
import React, { useState } from 'react';
import ImageUploadQueue from '../components/ImageUploadQueue';

function ProductForm() {
  const [productImages, setProductImages] = useState([]);

  const handleUploadComplete = ({ completed, failed }) => {
    const urls = completed.map(result => result[0].url);
    setProductImages(urls);

    if (completed.length > 0) {
      alert(`${completed.length} imágenes subidas!`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Guardar producto con imágenes
    await saveProduct({
      name: productName,
      images: productImages
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nombre del producto"
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
      />

      <ImageUploadQueue onAllCompleted={handleUploadComplete} />

      {productImages.length > 0 && (
        <div className="preview-grid">
          {productImages.map((url, i) => (
            <img key={i} src={url} alt={`Producto ${i + 1}`} />
          ))}
        </div>
      )}

      <button type="submit">Guardar Producto</button>
    </form>
  );
}

export default ProductForm;
```

---

## ⚡ PASO 8: DEPLOYMENT EN VERCEL

### 8.1 Crear `vercel.json`

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

### 8.2 Configurar variables en Vercel

```bash
# En el dashboard de Vercel:
# Settings → Environment Variables → Agregar:

IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/tu-id
IMAGEKIT_PUBLIC_KEY=public_XXXXX
IMAGEKIT_PRIVATE_KEY=private_XXXXX (marcar como sensible)
```

### 8.3 Deploy

```bash
git add .
git commit -m "Add ImageKit upload system"
git push

# Vercel detectará automáticamente y hará el deploy
```

---

## 📊 DIAGRAMA DE FLUJO COMPLETO

```
Usuario selecciona archivo(s)
         │
         ▼
¿Tamaño > 20MB?
    │         │
   Sí        No
    │         │
    │         ▼
    │    ¿Tamaño > 10MB?
    │         │        │
    │        Sí       No
    │         │        │
    │         ▼        ▼
    │   Compresión  Compresión
    │   dos fases    normal
    │         │        │
    │         └────────┘
    │              │
    │              ▼
    │         Comprimir con
    │         Compressor.js
    │              │
    │              ▼
    │         Solicitar tokens
    │         GET /api/auth
    │              │
    │              ▼
    │         Subir a ImageKit
    │              │
    │              ▼
    │         Retornar URL
    │              │
    ▼              ▼
Rechazar      Completado ✅
con guía
```

---

## 🎯 CHECKLIST DE IMPLEMENTACIÓN

```
□ Paso 1: Obtener credenciales de ImageKit
□ Paso 2: Instalar dependencias (backend y frontend)
□ Paso 3: Crear archivos .env
□ Paso 4: Implementar api/auth.js
□ Paso 5: Probar endpoint de auth
□ Paso 6: Implementar uploadImage.js
□ Paso 7: Implementar intelligentUpload.js
□ Paso 8: Implementar UploadQueueManager.js
□ Paso 9: Implementar useImageUploadQueue hook
□ Paso 10: Implementar ImageUploadQueue componente
□ Paso 11: Agregar CSS
□ Paso 12: Usar en tu aplicación
□ Paso 13: Probar localmente
□ Paso 14: Configurar vercel.json
□ Paso 15: Agregar variables en Vercel
□ Paso 16: Deploy
□ Paso 17: Probar en producción
```

---

## 🚨 MANEJO DE ERRORES COMUNES

### Error: "Token inválido o expirado"
```javascript
// Solución: Verificar que el endpoint /api/auth retorna correctamente
// Verificar que las variables de entorno están configuradas
console.log(process.env.IMAGEKIT_PRIVATE_KEY); // Debe existir
```

### Error: "CORS blocked"
```javascript
// Solución: Verificar CORS headers en api/auth.js
res.setHeader('Access-Control-Allow-Origin', '*');
```

### Error: "Navegador se congela con imágenes grandes"
```javascript
// Solución: Ya implementado en intelligentUpload.js
// Rechaza archivos >20MB y usa dos fases para 10-20MB
```

### Error: "Compressor.js falla"
```javascript
// Solución: Validar tipo de archivo antes de comprimir
if (!file.type.startsWith('image/')) {
  throw new Error('No es una imagen');
}
```

---

## 🎓 CONCEPTOS CLAVE PARA ENTENDER

1. **Token de autenticación**: Cadena temporal que prueba permiso para subir
2. **Signature**: Firma criptográfica que valida el token
3. **Expire**: Timestamp Unix que indica cuándo expira el token
4. **Compresión en dos fases**: Primero reduce dimensiones, luego calidad
5. **Cola de uploads**: Procesa múltiples archivos con límite de concurrencia
6. **Public key**: Va en el frontend (seguro exponerla)
7. **Private key**: Solo en backend (NUNCA exponerla)

---

## ✅ RESULTADO ESPERADO

Al finalizar, tendrás:
- ✅ Sistema de upload que comprime 90% del tamaño
- ✅ Barra de progreso global y por archivo
- ✅ Drag & drop funcional
- ✅ Manejo de archivos grandes (hasta 20MB)
- ✅ Procesamiento en segundo plano
- ✅ Pausar/reanudar uploads
- ✅ Manejo robusto de errores
- ✅ UI profesional con feedback visual
- ✅ Deployed en Vercel

---

## 📚 ARCHIVOS NECESARIOS (RESUMEN)

```
proyecto/
├── api/
│   ├── .env
│   ├── auth.js
│   └── package.json
├── frontend/
│   ├── .env.development
│   ├── .env.production
│   ├── src/
│   │   ├── services/
│   │   │   ├── uploadImage.js
│   │   │   ├── intelligentUpload.js
│   │   │   └── UploadQueueManager.js
│   │   ├── hooks/
│   │   │   └── useImageUploadQueue.js
│   │   └── components/
│   │       ├── ImageUploadQueue.jsx
│   │       └── ImageUploadQueue.css
│   └── package.json
└── vercel.json
```

---

## 🤖 INSTRUCCIONES PARA LLM

Cuando implementes esto:

1. **Sigue el orden exacto** de los pasos (1→8)
2. **Copia el código completo** de cada sección
3. **No omitas ningún paso**, todos son necesarios
4. **Verifica cada paso** antes de continuar al siguiente
5. **Usa los nombres exactos** de archivos y carpetas
6. **No modifiques** la lógica del código sin razón
7. **Si algo falla**, consulta la sección "Manejo de errores"
8. **Prueba localmente** antes de hacer deploy

**Orden de ejecución recomendado:**
```
Backend (Pasos 1-2) → Test → Frontend Service (Paso 3) →
Test → Upload Inteligente (Paso 4) → Sistema de Cola (Paso 5) →
UI (Paso 6) → Integración (Paso 7) → Deploy (Paso 8)
```

---

**FIN DE LA GUÍA** ✅
