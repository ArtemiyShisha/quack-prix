'use client';
import { useEffect, useRef, useState } from 'react';
import type { Frame } from '@/lib/race';
import type { MarbleFrame } from '@/lib/marble-race';
import type { Member } from '@/lib/roster';
import type { createMarbleScene } from '@/lib/marble-scene';
import { appUrl } from '@/lib/urls';
export function MarbleTrack({
  members,
  frame,
  overview,
  onReady,
}: {
  members: Member[];
  frame: Frame | null;
  overview: boolean;
  onReady: (ready: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createMarbleScene> | null>(null);
  const latest = useRef({ members, frame, overview }),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    latest.current = { members, frame, overview };
    scene.current?.update(frame as MarbleFrame | null, members, overview);
  }, [members, frame, overview]);
  useEffect(() => {
    let disposed = false;
    const failure = () => {
      if (!disposed) {
        setError(true);
        setLoading(false);
        onReady(false);
      }
    };
    import('@/lib/marble-scene')
      .then(({ createMarbleScene }) => {
        if (disposed || !host.current) return;
        try {
          scene.current = createMarbleScene(host.current, failure);
          const p = latest.current;
          scene.current.update(
            p.frame as MarbleFrame | null,
            p.members,
            p.overview,
          );
          setLoading(false);
          onReady(true);
        } catch {
          failure();
        }
      })
      .catch(failure);
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [onReady]);
  return (
    <div className="marble-stage">
      <div className="marble-canvas" ref={host} />
      {!error && !loading && (
        <span className="marble-camera-hint">
          {overview
            ? 'Потяни, чтобы повернуть трассу · колесо — масштаб'
            : 'Камера следует за гонкой'}
        </span>
      )}
      {loading && (
        <div className="marble-message" role="status">
          Собираем трассу…
        </div>
      )}
      {error && (
        <div className="marble-message" role="alert">
          <strong>3D здесь не запустился</strong>
          <p>Попробуй браузер с поддержкой WebGL или запусти обычную гонку.</p>
          <a href={appUrl('/')}>К уткам в аквапарк →</a>
        </div>
      )}
    </div>
  );
}
