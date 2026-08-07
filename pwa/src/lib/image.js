/**
 * Reduce la foto antes de subirla.
 *
 * Las cámaras de celular sacan imágenes de 4000 px o más; el modelo de visión
 * no aprovecha nada por encima de ~2576 px en el lado largo, así que
 * redimensionar acelera la subida y abarata la extracción sin perder nitidez
 * en las letras.
 */
const MAX_EDGE = 2200;
const QUALITY = 0.9;

export async function downscaleImage(file, maxEdge = MAX_EDGE) {
  if (!file.type.startsWith('image/')) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // Navegador sin createImageBitmap: subimos el original.
  }

  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge <= maxEdge) {
    bitmap.close?.();
    return file;
  }

  const scale = maxEdge / longEdge;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
