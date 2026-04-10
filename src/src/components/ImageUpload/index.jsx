import { useState, useRef, useEffect } from 'react';
import uploadImages from '../../services/uploadImage';
import './styles.css';

/**
 * WhatsApp-style Image Upload Component
 * Simple, familiar UX for uploading a single product image
 */
function ImageUpload({ onImageUploaded, existingImageUrl = null, label = 'Imagen del producto' }) {
  const [preview, setPreview] = useState(existingImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Keep preview in sync when DB image arrives asynchronously (e.g. /#/product/:id)
  useEffect(() => {
    setPreview(existingImageUrl || null);
  }, [existingImageUrl]);

  /**
   * Handle file selection (from input or drag-drop)
   */
  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file type
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen válida');
      return;
    }
    if (!supportedTypes.includes(file.type)) {
      setError(`Formato no soportado (${file.type.split('/')[1]}). Usá JPG, PNG o WEBP.`);
      return;
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > maxSize) {
      setError(`La imagen pesa ${fileSizeMB}MB y el máximo es 20MB. Comprimila antes de subirla.`);
      return;
    }

    setError(null);

    // Show preview immediately (better UX)
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to ImageKit
    try {
      setIsUploading(true);
      setUploadProgress(30);

      const results = await uploadImages(file);

      setUploadProgress(100);

      // Get the URL from ImageKit response
      const imageUrl = results[0].url;

      // Call parent callback with the uploaded URL
      if (onImageUploaded) {
        onImageUploaded(imageUrl);
      }

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setPreview(existingImageUrl); // Restore previous image
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Handle input change
   */
  const handleInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * Remove image
   */
  const handleRemove = () => {
    setPreview(null);
    if (onImageUploaded) {
      onImageUploaded(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="image-upload-container">
      <label className="image-upload-label">{label}</label>

      {/* Upload area - WhatsApp style */}
      {!preview ? (
        <div
          className="image-upload-dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          <div className="image-upload-icon">📷</div>
          <p className="image-upload-text">Toca para agregar foto</p>
          <p className="image-upload-subtext">o arrastra aquí</p>
        </div>
      ) : (
        <div className="image-upload-preview">
          <img src={preview} alt="Vista previa" />

          {/* Loading overlay */}
          {isUploading && (
            <div className="image-upload-loading">
              <div className="image-upload-spinner"></div>
              <p>Subiendo... {uploadProgress}%</p>
            </div>
          )}

          {/* Action buttons */}
          {!isUploading && (
            <div className="image-upload-actions">
              <button
                type="button"
                className="image-upload-btn image-upload-btn-change"
                onClick={() => fileInputRef.current?.click()}
              >
                Cambiar
              </button>
              <button
                type="button"
                className="image-upload-btn image-upload-btn-remove"
                onClick={handleRemove}
              >
                Eliminar
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="image-upload-error">
          ⚠️ {error}
        </div>
      )}

      {/* Help text */}
      {!preview && !error && (
        <p className="image-upload-help">
          Máximo: 20MB. Formatos: JPG, PNG, WEBP, BMP, GIF
        </p>
      )}
    </div>
  );
}

export default ImageUpload;
