/** Required size for admin product / map icons (square). */
export const PRODUCT_ICON_PX = 72;

/**
 * Ensures a local image file has exact pixel dimensions (e.g. 72×72).
 * @returns {Promise<{ width: number, height: number }>}
 */
export function validateImageFileExactDimensions(file, width, height) {
  return new Promise((resolve, reject) => {
    if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG, JPEG, WebP, or GIF).'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w === width && h === height) {
        resolve({ width: w, height: h });
      } else {
        reject(
          new Error(
            `Image must be exactly ${width}×${height} pixels (square). This file is ${w}×${h}. Resize it and try again.`
          )
        );
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image. Try a different PNG or JPEG file.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Same check for a remote URL (e.g. pasted public Supabase URL). May fail if the host blocks CORS.
 */
export function validateImageUrlExactDimensions(urlString, width, height) {
  return new Promise((resolve, reject) => {
    if (!urlString || typeof urlString !== 'string' || !/^https?:\/\//i.test(urlString.trim())) {
      reject(new Error('Enter a valid http(s) image URL.'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w === width && h === height) {
        resolve({ width: w, height: h });
      } else {
        reject(
          new Error(
            `Image at that URL must be exactly ${width}×${height} pixels. It is ${w}×${h}.`
          )
        );
      }
    };
    img.onerror = () => {
      reject(
        new Error(
          'Could not load that URL as an image (CORS or bad link). Upload a file instead, or use a direct image URL that allows cross-origin access.'
        )
      );
    };
    img.src = urlString.trim();
  });
}
