/**
 * Client-side image utilities: compression, HEIC conversion, processing pipeline
 */

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.75;

/**
 * Compress an image file: resize to max 1280px on longest side, output JPEG 75% quality
 */
export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Convert HEIC/HEIF file to JPEG using heic2any library
 */
export async function convertHeic(file: File): Promise<File> {
  const ext = file.name.toLowerCase();
  const isHeic = ext.endsWith('.heic') || ext.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
  if (!isHeic) return file;

  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const converted = Array.isArray(blob) ? blob[0] : blob;
    return new File([converted], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    // Fallback: try loading directly (some browsers support HEIC natively)
    return file;
  }
}

/**
 * Full processing pipeline: detect HEIC → convert → compress → return data URL
 */
export async function processImageFile(file: File): Promise<string> {
  const converted = await convertHeic(file);
  return compressImage(converted);
}
