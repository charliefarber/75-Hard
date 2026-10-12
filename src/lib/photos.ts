/**
 * Progress photos are shrunk on the phone before they're uploaded:
 *  - a full photo (max 1600 px on its long side) and a small one for the gallery
 *  - re-drawn onto a canvas, which drops the photo's hidden metadata (EXIF), including
 *    the GPS location an iPhone camera adds
 *  - always JPEG, usually 200–400 KB, however big the original was (HEIC, PNG, 12 MP…)
 */

import type { DailyLog } from '../data/types';

export interface PhotoDay {
  date: string;
  path: string;
  /** Challenge day number, if that day counts towards the 75. */
  day: number | null;
}

/** Every day with a progress photo, oldest first. */
export function photoDays(logs: Record<string, DailyLog>, dayOf: (date: string) => number | null): PhotoDay[] {
  return Object.values(logs)
    .filter((l) => !!l.photo_path)
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((l) => ({ date: l.log_date, path: l.photo_path!, day: dayOf(l.log_date) }));
}

export const FULL_EDGE = 1600;
export const THUMB_EDGE = 400;

/** The small version of a stored photo sits next to it: "abc/2026-10-12-x1.jpg" → "abc/2026-10-12-x1.t.jpg". */
export const thumbPath = (path: string) => path.replace(/\.jpg$/, '.t.jpg');

/** Fit (w, h) inside a square of side `edge`, never enlarging. */
export function fitWithin(w: number, h: number, edge: number): { w: number; h: number } {
  const s = Math.min(1, edge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

type Drawable = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<Drawable> {
  // createImageBitmap honours the photo's rotation (imageOrientation defaults to 'from-image').
  // Asking for a smaller width up front keeps memory down for 24–48 MP iPhone photos; only the
  // width is given, so the shape is kept whichever way round the phone applies the rotation.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { resizeWidth: FULL_EDGE, resizeQuality: 'high' });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall back to an <img> (older Safari, unusual formats) */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(src: Drawable, edge: number, quality: number): Promise<Blob> {
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const { w, h } = fitWithin(sw, sh, edge);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This phone couldn’t process the photo.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This phone couldn’t process the photo.'))), 'image/jpeg', quality),
  );
}

export async function preparePhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('That file isn’t a photo.');
  let img: Drawable;
  try {
    img = await decode(file);
  } catch {
    throw new Error('That photo couldn’t be opened. Try a different one.');
  }
  try {
    const full = await encode(img, FULL_EDGE, 0.82);
    const thumb = await encode(img, THUMB_EDGE, 0.72);
    return { full, thumb };
  } finally {
    if ('close' in img) img.close();
  }
}
