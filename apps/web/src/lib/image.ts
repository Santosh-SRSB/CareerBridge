import { photoFileError } from '@careerbridge/shared';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that photo.'));
    };
    image.src = objectUrl;
  });
}

function drawScaled(image: HTMLImageElement, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process that photo.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function compressImageFile(file: File, maxSize = 480): Promise<string> {
  const invalid = photoFileError(file.type, file.size);
  if (invalid) return Promise.reject(new Error(invalid));
  return loadImage(file).then((image) => drawScaled(image, maxSize).toDataURL('image/jpeg', 0.7));
}

/** Compress to a JPEG Blob for multipart upload (avoids huge JSON data URLs). */
export async function compressImageBlob(file: File, maxSize = 420): Promise<Blob> {
  const invalid = photoFileError(file.type, file.size);
  if (invalid) throw new Error(invalid);
  const image = await loadImage(file);
  const canvas = drawScaled(image, maxSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not process that photo.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.72,
    );
  });
}
