import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { usePhotoUrls } from '../data/usePhotoUrls';
import { IconChevron, IconChevronLeft, IconCompare, IconShare, IconTrash, IconX } from './Icons';
import { tap } from '../lib/haptics';

import type { PhotoDay } from '../lib/photos';

const dayLabel = (p: PhotoDay) => (p.day ? `Day ${p.day}` : format(parseISO(p.date), 'd MMM'));

/**
 * Full-screen progress photo: swipe or tap the arrows between days, compare any two days with a
 * before/after slider, save to the phone, or delete.
 */
export function PhotoViewer({
  photos,
  startIndex,
  startCompare = false,
  onClose,
  onDelete,
}: {
  /** Oldest first. */
  photos: PhotoDay[];
  startIndex: number;
  startCompare?: boolean;
  onClose: () => void;
  onDelete: (date: string) => Promise<void>;
}) {
  const [i, setI] = useState(Math.min(Math.max(0, startIndex), photos.length - 1));
  const [compare, setCompare] = useState(startCompare && photos.length > 1);
  const [before, setBefore] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = photos[i];
  // Never compare a day with itself: the "before" is always an earlier photo (the first by default).
  const beforePhoto = photos[Math.min(before, Math.max(0, i - 1))] ?? photos[0];
  const full = usePhotoUrls([current?.path, compare ? beforePhoto?.path : null], false);
  const thumbs = usePhotoUrls(compare ? photos.map((p) => p.path) : [], true);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const prev = document.activeElement as HTMLElement | null;
    root.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!compare && e.key === 'ArrowLeft') go(-1);
      if (!compare && e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => setConfirm(false), [i, compare]);

  if (!current) return null;

  function go(d: number) {
    const n = i + d;
    if (n < 0 || n >= photos.length) return;
    tap();
    setI(n);
  }

  async function save() {
    const url = full[current.path];
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const name = `75-hard-${current.day ? `day-${current.day}` : current.date}.jpg`;
      const file = new File([blob], name, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name }).catch(() => {});
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      /* the share sheet was dismissed or the download failed; nothing to undo */
    }
  }

  async function remove() {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    try {
      await onDelete(current.date);
      if (photos.length <= 1) onClose();
      else setI((x) => Math.max(0, Math.min(x, photos.length - 2)));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Progress photo, ${dayLabel(current)}`} tabIndex={-1} ref={root}>
      <div className="viewer-top">
        <button type="button" className="viewer-btn" aria-label="Close" onClick={onClose}>
          <IconX size={22} />
        </button>
        <span className="viewer-title">
          {compare ? (
            <>
              {dayLabel(beforePhoto)} → {dayLabel(current)}
            </>
          ) : (
            <>
              <strong>{dayLabel(current)}</strong>
              <span>{format(parseISO(current.date), 'EEE d MMM yyyy')}</span>
            </>
          )}
        </span>
        <span style={{ width: 44 }} />
      </div>

      {compare ? (
        <CompareSlider
          before={full[beforePhoto.path]}
          after={full[current.path]}
          beforeLabel={dayLabel(beforePhoto)}
          afterLabel={dayLabel(current)}
        />
      ) : (
        <div
          className="viewer-stage"
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx < 0 ? 1 : -1);
          }}
        >
          {full[current.path] ? (
            <img key={current.path} src={full[current.path]} alt={`Progress photo, ${dayLabel(current)}`} className="viewer-img" draggable={false} />
          ) : (
            <span className="spinner spinner-light" aria-label="Loading photo" />
          )}
          {i > 0 && (
            <button type="button" className="viewer-nav left" aria-label="Earlier photo" onClick={() => go(-1)}>
              <IconChevronLeft size={26} />
            </button>
          )}
          {i < photos.length - 1 && (
            <button type="button" className="viewer-nav right" aria-label="Later photo" onClick={() => go(1)}>
              <IconChevron size={26} />
            </button>
          )}
          <span className="viewer-count" aria-hidden="true">
            {i + 1} / {photos.length}
          </span>
        </div>
      )}

      {compare && i > 0 && (
        <div className="viewer-strip" role="group" aria-label="Compare with">
          {photos.slice(0, i).map((p, j) => (
            <button key={p.path} type="button" aria-pressed={beforePhoto.path === p.path} onClick={() => (tap(), setBefore(j))} aria-label={`Compare with ${dayLabel(p)}`}>
              {thumbs[p.path] ? <img src={thumbs[p.path]} alt="" /> : <span />}
              <small>{dayLabel(p)}</small>
            </button>
          ))}
        </div>
      )}

      <div className="viewer-bar">
        {photos.length > 1 && (
          <button
            type="button"
            className={`viewer-action${compare ? ' on' : ''}`}
            onClick={() => {
              tap();
              if (!compare && i === 0) setI(photos.length - 1);
              setCompare((c) => !c);
            }}
          >
            <IconCompare size={22} />
            {compare ? 'Done' : 'Compare'}
          </button>
        )}
        {!compare && (
          <>
            <button type="button" className="viewer-action" onClick={save} disabled={!full[current.path]}>
              <IconShare size={22} />
              Save
            </button>
            <button type="button" className={`viewer-action danger${confirm ? ' on' : ''}`} onClick={remove} disabled={busy}>
              <IconTrash size={22} />
              {confirm ? 'Tap to delete' : 'Delete'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CompareSlider({ before, after, beforeLabel, afterLabel }: { before?: string; after?: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div
      className="cmp"
      ref={box}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {after && <img src={after} alt={`After: ${afterLabel}`} className="cmp-img" draggable={false} />}
      {before && (
        <img src={before} alt={`Before: ${beforeLabel}`} className="cmp-img" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />
      )}
      {(!before || !after) && <span className="spinner spinner-light" aria-label="Loading photos" />}
      <div
        className="cmp-handle"
        style={{ left: `${pos}%` }}
        role="slider"
        tabIndex={0}
        aria-label="Before and after divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 5));
          if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 5));
        }}
      >
        <span />
      </div>
      <span className="cmp-tag left">{beforeLabel}</span>
      <span className="cmp-tag right">{afterLabel}</span>
    </div>
  );
}
