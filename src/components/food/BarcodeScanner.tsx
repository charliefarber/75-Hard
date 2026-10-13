import { useEffect, useRef, useState } from 'react';
import { readFrame, readPhoto, warmUpBarcodeReader } from '../../lib/barcode';
import { validBarcode } from '../../lib/off';
import { success, tap } from '../../lib/haptics';
import { IconCamera, IconX } from '../Icons';

type State = 'starting' | 'scanning' | 'denied' | 'unavailable';

/**
 * Full-screen barcode scanner: point the camera at a barcode and it's read automatically.
 * If the camera isn't available (or permission was refused) she can take a photo of the
 * barcode or type the number instead.
 */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const [state, setState] = useState<State>('starting');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const done = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const finish = (c: string) => {
    if (done.current) return;
    done.current = true;
    success();
    onCode(c);
  };

  useEffect(() => {
    warmUpBarcodeReader();
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        return setState((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      track.current = stream.getVideoTracks()[0] ?? null;
      const caps = (track.current?.getCapabilities?.() ?? {}) as { torch?: boolean };
      if (caps.torch) setTorch(false);
      setState('scanning');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const loop = async () => {
        if (stopped || done.current) return;
        if (ctx && v.readyState >= 2 && v.videoWidth) {
          // Read the band under the guide box: smaller and faster than the whole frame.
          const w = v.videoWidth;
          const h = v.videoHeight;
          const cw = Math.round(w * 0.86);
          const ch = Math.round(Math.min(h * 0.5, cw * 0.6));
          canvas.width = Math.min(cw, 960);
          canvas.height = Math.round((canvas.width * ch) / cw);
          ctx.drawImage(v, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
          const found = await readFrame(canvas).catch(() => null);
          if (found && found.length >= 8 && !stopped) return finish(found);
        }
        timer = setTimeout(loop, 110);
      };
      loop();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggleTorch = async () => {
    if (!track.current || torch === null) return;
    try {
      await track.current.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  const fromPhoto = async (file: File) => {
    setNote('Reading the photo…');
    const found = await readPhoto(file).catch(() => null);
    if (found) finish(found);
    else setNote('No barcode found in that photo. Try closer, flatter and in good light, or type the number.');
  };

  const typed = code.replace(/\D/g, '');
  const typedOk = typed.length === 8 || (typed.length >= 12 && typed.length <= 14 && validBarcode(typed));

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <video ref={video} className="scanner-video" playsInline muted autoPlay />
      <div className="scanner-shade" aria-hidden="true">
        <div className={`scanner-box${state === 'scanning' ? ' live' : ''}`}>
          <i />
          <i />
          <i />
          <i />
          {state === 'scanning' && <span className="scanner-line" />}
        </div>
      </div>

      <div className="scanner-top">
        <button type="button" className="viewer-btn" aria-label="Close scanner" onClick={onClose}>
          <IconX size={22} />
        </button>
        {torch !== null && (
          <button type="button" className={`viewer-btn${torch ? ' on' : ''}`} aria-label={torch ? 'Torch off' : 'Torch on'} aria-pressed={torch} onClick={toggleTorch}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 2h10l-1 5H8zM8 7l1 4v11h6V11l1-4M12 14v3" />
            </svg>
          </button>
        )}
      </div>

      <div className="scanner-bottom">
        <p className="scanner-hint" aria-live="polite">
          {note ??
            (state === 'starting'
              ? 'Starting the camera…'
              : state === 'scanning'
                ? 'Line the barcode up in the box'
                : state === 'denied'
                  ? 'Camera access is off for this app. Take a photo of the barcode instead, or type the number.'
                  : 'The camera isn’t available here. Take a photo of the barcode instead, or type the number.')}
        </p>
        {typing ? (
          <form
            className="scanner-type"
            onSubmit={(e) => {
              e.preventDefault();
              if (typedOk) finish(typed);
            }}
          >
            <input
              inputMode="numeric"
              autoFocus
              placeholder="Barcode number"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 18))}
              aria-label="Barcode number"
            />
            <button type="submit" className="btn btn-primary" disabled={!typedOk}>
              Look up
            </button>
          </form>
        ) : (
          <div className="scanner-actions">
            <button type="button" className="scanner-action" onClick={() => (tap(), photoInput.current?.click())}>
              <IconCamera size={20} /> Photo of barcode
            </button>
            <button type="button" className="scanner-action" onClick={() => (tap(), setTyping(true))}>
              <span aria-hidden="true" style={{ fontWeight: 800, letterSpacing: '-0.04em' }}>123</span> Type number
            </button>
          </div>
        )}
        {typing && typed.length >= 12 && !typedOk && <p className="scanner-hint small">That number doesn’t look right. Check the digits under the barcode.</p>}
      </div>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) fromPhoto(f);
        }}
      />
    </div>
  );
}
