/**
 * Reading supermarket barcodes (EAN-13, EAN-8, UPC-A, UPC-E) from the camera or a photo.
 * Uses the phone's built-in reader where there is one (Chrome on Android); everywhere else,
 * including iPhone, the ZXing reader compiled to WebAssembly, loaded only when first needed
 * and served from this site (never a third-party CDN).
 */

type Detector = { detect(src: CanvasImageSource | Blob): Promise<{ rawValue: string; format: string }[]> };
type ZX = typeof import('zxing-wasm/reader');

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
let native: Detector | null | undefined;
let zx: Promise<ZX> | null = null;

async function nativeDetector(): Promise<Detector | null> {
  if (native !== undefined) return native;
  native = null;
  const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } })
    .BarcodeDetector;
  if (BD) {
    try {
      const supported = (await BD.getSupportedFormats?.()) ?? [];
      if (FORMATS.some((f) => supported.includes(f))) native = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
    } catch {
      native = null;
    }
  }
  return native;
}

function zxing(): Promise<ZX> {
  if (!zx) {
    zx = (async () => {
      const [mod, wasm] = await Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
      mod.prepareZXingModule({
        overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) },
        fireImmediately: true,
      });
      return mod;
    })();
  }
  return zx;
}

/** Start loading the reader early (e.g. when the scanner opens) so the first frame is fast. */
export function warmUpBarcodeReader() {
  nativeDetector().then((d) => {
    if (!d) zxing().catch(() => {});
  });
}

const clean = (raw: string) => raw.replace(/\D/g, '');

/** A barcode in this frame (from a canvas), if any. */
export async function readFrame(canvas: HTMLCanvasElement): Promise<string | null> {
  const d = await nativeDetector();
  if (d) {
    const found = await d.detect(canvas).catch(() => []);
    return found[0] ? clean(found[0].rawValue) : null;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const z = await zxing();
  const res = await z.readBarcodes(image, { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], tryHarder: true, maxNumberOfSymbols: 1 });
  const hit = res.find((r) => r.isValid && r.text);
  return hit ? clean(hit.text) : null;
}

/** A barcode in a photo she took or picked. */
export async function readPhoto(file: Blob): Promise<string | null> {
  const d = await nativeDetector();
  if (d) {
    try {
      const bmp = await createImageBitmap(file);
      const found = await d.detect(bmp);
      bmp.close();
      if (found[0]) return clean(found[0].rawValue);
    } catch {
      /* fall through to ZXing */
    }
  }
  const z = await zxing();
  const res = await z.readBarcodes(file, { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 1 });
  const hit = res.find((r) => r.isValid && r.text);
  return hit ? clean(hit.text) : null;
}
