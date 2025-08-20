import { z } from "zod";

/**
 * Creates a Zod refinement for validating data URI file uploads.
 *
 * @param maxSizeBytes - Maximum file size in bytes
 * @param mimeTypePattern - Optional regex pattern for allowed MIME types (default: any)
 * @returns Zod string schema with data URI validation
 */
export function createDataUriValidator(
  maxSizeBytes: number,
  mimeTypePattern?: RegExp
) {
  const pattern = mimeTypePattern
    ? new RegExp(`^data:(${mimeTypePattern.source});base64,(.+)$`)
    : /^data:([^;]+);base64,(.+)$/;

  return z.string().refine(
    (val) => {
      const parts = val.match(pattern);
      if (!parts) return false;

      // Estimate size from base64 string length
      const estSize = (parts[2].length * 3) / 4;
      return estSize <= maxSizeBytes;
    },
    {
      message: `File size must be less than ${maxSizeBytes / 1024 / 1024}MB`,
    }
  );
}

// Commonly used validators
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const imageDataUriSchema = createDataUriValidator(
  MAX_IMAGE_SIZE,
  /image\/(?:png|jpeg)/
);

export const fileDataUriSchema = createDataUriValidator(MAX_FILE_SIZE);
