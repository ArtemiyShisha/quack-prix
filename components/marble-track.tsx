'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Frame } from '@/lib/race';
import type { MarbleFrame } from '@/lib/marble-race';
import type { Member } from '@/lib/roster';
import type { createMarbleScene } from '@/lib/marble-scene';
import { createMarbleCourse } from '@/lib/marble-track';
import { MARBLE_PREVIEW_SEED } from '@/lib/marble-path';
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
  const courseSeed =
    (frame as MarbleFrame | null)?.courseSeed ?? MARBLE_PREVIEW_SEED;
  const course = useMemo(() => createMarbleCourse(courseSeed), [courseSeed]);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createMarbleScene> | null>(null);
  const latest = useRef({ members, frame, overview });
  const [status, setStatus] = useState<{
    seed: number;
    failed: boolean;
  } | null>(null);
  const loading = status?.seed !== courseSeed;
  const error = !loading && status?.failed === true;
  useEffect(() => {
    latest.current = { members, frame, overview };
    scene.current?.update(frame as MarbleFrame | null, members, overview);
  }, [members, frame, overview]);
  useEffect(() => {
    let disposed = false;
    onReady(false);
    const failure = () => {
      if (!disposed) {
        setStatus({ seed: course.seed!, failed: true });
        onReady(false);
      }
    };
    import('@/lib/marble-scene')
      .then(({ createMarbleScene }) => {
        if (disposed || !host.current) return;
        try {
          scene.current = createMarbleScene(host.current, failure, course);
          const p = latest.current;
          scene.current.update(
            p.frame as MarbleFrame | null,
            p.members,
            p.overview,
          );
          setStatus({ seed: course.seed!, failed: false });
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
  }, [onReady, course]);
  return (
    <div className="marble-stage">
      {!error && !loading && (
        <div className="marble-route" aria-live="polite">
          <span>Новая трасса каждый заезд</span>
          <strong>{course.name}</strong>
        </div>
      )}
      <div className="marble-canvas" ref={host} />
      {!error && !loading && (
        <span className="marble-camera-hint">
          {overview
            ? 'Потяни, чтобы повернуть трассу · колесо — масштаб'
            : 'Камера следует за гонкой'}
        </span>
      )}
      {loading && <output className="marble-message">Собираем трассу…</output>}
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
