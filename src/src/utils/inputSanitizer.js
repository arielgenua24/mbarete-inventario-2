/**
 * Sanitizes variant input strings by:
 * - Converting to lowercase
 * - Trimming whitespace from start and end
 * - Removing extra spaces between words
 * - Returns null for empty inputs
 */
export const sanitizeVariantInput = (input) => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Trim and convert to lowercase
  let sanitized = input.trim().toLowerCase();
  
  // Return null if empty after trim
  if (!sanitized) {
    return null;
  }
  
  // Remove extra whitespace and replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Final trim
  sanitized = sanitized.trim();
  
  return sanitized || null;
};