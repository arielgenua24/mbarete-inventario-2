import ImageKit from "imagekit-javascript";
import Compressor from 'compressorjs';
import authCache from './imagekitAuthCache';

// Initialize ImageKit with public key (safe to expose in frontend)
const imagekit = new ImageKit({
  publicKey: import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY,
  urlEndpoint: import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT,
});

/**
 * Compress image before upload
 * Reduces size by ~90% while maintaining quality
 */
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.6, // 60% quality - good balance
      maxWidth: 1024,
      maxHeight: 1024,
      mimeType: "image/jpeg",
      success: resolve,
      error: reject,
    });
  });
};

/**
 * Check if an error should trigger a retry with fresh token
 *
 * Retry scenarios:
 * 1. Auth errors (token/signature/expire related)
 * 2. 400 Bad Request (often means invalid token)
 * 3. 401 Unauthorized (auth failure)
 *
 * Do NOT retry:
 * - Network errors (timeout, connection lost) - not a token issue
 * - 413 Payload Too Large - file is too big
 * - 5xx Server errors - ImageKit server issue
 * - Rate limits (429) - need to back off, not retry immediately
 */
const shouldRetryWithFreshToken = (error) => {
  if (!error || !error.message) return false;

  const errorMessage = error.message.toLowerCase();
  const errorString = JSON.stringify(error).toLowerCase();

  // Check for explicit auth-related errors
  const hasAuthKeywords =
    errorMessage.includes('token') ||
    errorMessage.includes('signature') ||
    errorMessage.includes('expire') ||
    errorMessage.includes('auth') ||
    errorMessage.includes('unauthorized') ||
    errorString.includes('401');

  // Check for 400 Bad Request (often means invalid token)
  const isBadRequest =
    errorMessage.includes('400') ||
    errorString.includes('400') ||
    errorMessage.includes('bad request');

  // Do NOT retry on network errors (not a token issue)
  const isNetworkError =
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound');

  // Do NOT retry on rate limits or server errors
  const shouldNotRetry =
    errorMessage.includes('429') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('413') ||
    errorMessage.includes('payload too large') ||
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503');

  // Retry if auth error or bad request, but NOT if network/rate limit error
  return (hasAuthKeywords || isBadRequest) && !isNetworkError && !shouldNotRetry;
};

/**
 * Upload a single file to ImageKit
 * Includes automatic retry logic for expired tokens
 */
const uploadFile = async (file, authData, isRetry = false) => {
  return new Promise((resolve, reject) => {
    imagekit.upload({
      file: file,
      fileName: file.name,
      token: authData.token,
      signature: authData.signature,
      expire: authData.expire,
      folder: "/products", // Organize images in products folder
    }, async (err, result) => {
      if (err) {
        // Check if error should trigger a retry with fresh token
        const shouldRetry = shouldRetryWithFreshToken(err);

        // If it's a retryable error and we haven't retried yet, try again with fresh token
        if (shouldRetry && !isRetry) {
          console.warn('[ImageKit Upload] Retryable error detected, fetching fresh token...');
          console.warn('[ImageKit Upload] Error details:', err.message);
          try {
            const freshAuth = await authCache.forceRefresh();
            const retryResult = await uploadFile(file, freshAuth, true);
            resolve(retryResult);
          } catch (retryError) {
            console.error('[ImageKit Upload] Retry failed:', retryError);
            reject(retryError);
          }
        } else {
          // Not retryable or already retried - reject with original error
          if (isRetry) {
            console.error('[ImageKit Upload] Second attempt failed, giving up');
          }
          reject(err);
        }
      } else {
        resolve(result);
      }
    });
  });
};

/**
 * Main function to upload images with compression
 * Accepts single image or array of images
 * Returns array of upload results with URLs
 *
 * Features:
 * - Automatic token caching to reduce API calls
 * - Transparent retry on token expiration
 * - User never needs to re-upload due to expired tokens
 */
async function uploadImages(images) {
  const imageArray = Array.isArray(images) ? images : [images];
  const validImages = imageArray.filter(img => img != null);

  if (validImages.length === 0) {
    throw new Error("No hay imágenes válidas para subir");
  }

  try {
    // Step 1: Compress all images
    console.log('[Upload] Compressing images...');
    const compressed = await Promise.all(
      validImages.map(img => compressImage(img))
    );

    // Step 2: Get authentication parameters (from cache or fetch new)
    console.log('[Upload] Getting authentication...');
    const authData = await authCache.getAuthParams();

    // Step 3: Upload all compressed images
    // Note: uploadFile has built-in retry logic for expired tokens
    console.log('[Upload] Uploading to ImageKit...');
    const results = await Promise.all(
      compressed.map(img => uploadFile(img, authData))
    );

    console.log('[Upload] Success! Uploaded', results.length, 'image(s)');
    return results;
  } catch (error) {
    console.error('[Upload] Error:', error);
    throw new Error(`Error al subir imagen: ${error.message}`);
  }
}

export default uploadImages;
