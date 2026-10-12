import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { PhotoDay } from '../lib/photos';
import { usePhotoUrls } from '../data/usePhotoUrls';
import { IconCamera, IconCompare } from './Icons';
import { tap } from '../lib/haptics';

/** Progress photos, newest first; tap one to open it, or compare the first with the latest. */
export function PhotosCard({ photos, onOpen, onCompare }: { photos: PhotoDay[]; onOpen: (index: number) => void; onCompare: () => void }) {
  const [all, setAll] = useState(false);
  const newestFirst = [...photos].reverse();
  const shown = all ? newestFirst : newestFirst.slice(0, 8);
  const thumbs = usePhotoUrls(shown.map((p) => p.path), true);

  return (
    <section className="card" aria-labelledby="ph-h">
      <div className="card-head">
        <h2 className="card-title" id="ph-h">
          Progress photos
        </h2>
        {photos.length > 0 && <span className="card-sub">{photos.length === 1 ? '1 photo' : `${photos.length} photos`}</span>}
      </div>
      {photos.length === 0 ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="ci-cam" aria-hidden="true" style={{ flex: 'none' }}>
            <IconCamera size={24} />
          </span>
          <p className="card-sub" style={{ margin: 0, lineHeight: 1.5, fontSize: 13 }}>
            Add a photo from Today each morning, same spot and pose, and watch the change build up. Only you can see them.
          </p>
        </div>
      ) : (
        <>
          <div className="ph-grid">
            {shown.map((p) => (
              <button
                key={p.path}
                type="button"
                onClick={() => (tap(), onOpen(photos.indexOf(p)))}
                aria-label={`Photo from ${format(parseISO(p.date), 'EEEE d MMMM')}${p.day ? `, day ${p.day}` : ''}`}
              >
                {thumbs[p.path] && <img src={thumbs[p.path]} alt="" loading="lazy" />}
                <small>{p.day ? `D${p.day}` : format(parseISO(p.date), 'd MMM')}</small>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {photos.length > 1 && (
              <button type="button" className="btn btn-sm btn-dark" style={{ flex: 1, height: 42 }} onClick={() => (tap(), onCompare())}>
                <IconCompare size={18} /> Compare first and latest
              </button>
            )}
            {photos.length > 8 && (
              <button type="button" className="btn btn-sm btn-ghost" style={{ height: 42 }} onClick={() => setAll((a) => !a)}>
                {all ? 'Fewer' : `All ${photos.length}`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
