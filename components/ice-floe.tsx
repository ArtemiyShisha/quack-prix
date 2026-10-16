'use client';
import { useEffect, useRef, useState } from 'react';
import type { Frame } from '@/lib/race';
import { ICE, type IceFrame } from '@/lib/ice-floe';
import type { Member } from '@/lib/roster';
import type { createIceScene } from '@/lib/ice-scene';
import { COLOURS } from '@/lib/track';
import { appUrl } from '@/lib/urls';

export function IceFloe({
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
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createIceScene> | null>(null);
  const latest = useRef({ members, frame, overview });
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const ice = frame as IceFrame | null;
  const players = members.filter(
    (member) => member.active && member.name.trim(),
  );
  useEffect(() => {
    latest.current = { members, frame, overview };
    scene.current?.update(frame as IceFrame | null, members, overview);
  }, [members, frame, overview]);
  useEffect(() => {
    let disposed = false;
    onReady(false);
    const failure = () => {
      if (!disposed) {
        setStatus('failed');
        onReady(false);
      }
    };
    import('@/lib/ice-scene')
      .then(({ createIceScene }) => {
        if (disposed || !host.current) return;
        try {
          scene.current = createIceScene(host.current, failure);
          const current = latest.current;
          scene.current.update(
            current.frame as IceFrame | null,
            current.members,
            current.overview,
          );
          setStatus('ready');
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
    <div className="ice-game">
      <div className="ice-stage">
        <div className="ice-canvas" ref={host} />
        {status === 'ready' && (
          <>
            <div className="ice-hud">
              <span>ХРУПКОЕ РАВНОВЕСИЕ</span>
              <strong>
                {ice?.result
                  ? 'Лёд выбрал ведущего'
                  : ice
                    ? `${ice.remaining} из ${players.length} ещё на льдине`
                    : 'Последняя утка — ведущий'}
              </strong>
            </div>
            <div className="ice-danger">
              <span
                style={{
                  width: `${ice ? (ice.iceRadius / ICE.radius) * 100 : 100}%`,
                }}
              />
              <b>ЛЁД ТАЕТ</b>
            </div>
            <span className="ice-camera-hint">
              {overview
                ? 'Потяни, чтобы повернуть · колесо — масштаб'
                : 'Все на льдине. До первого толчка.'}
            </span>
          </>
        )}
        {status === 'loading' && (
          <output className="marble-message">Замораживаем льдину…</output>
        )}
        {status === 'failed' && (
          <div className="marble-message" role="alert">
            <strong>3D здесь не запустился</strong>
            <p>Для льдины нужен браузер с поддержкой WebGL 2.</p>
            <a href={appUrl('/')}>Вернуться к аквапарку →</a>
          </div>
        )}
      </div>
      {players.length > 0 && (
        <div className="ice-roster" aria-label="Кто остался на льдине">
          {players.map((member, slot) => {
            const alive = ice?.iceDucks[slot]?.alive ?? true;
            const won = ice?.result?.slot === slot;
            return (
              <div
                key={member.id}
                className={`ice-player ${!alive ? 'is-out' : ''} ${won ? 'is-winner' : ''}`}
              >
                <span
                  className="ice-player-dot"
                  style={{ backgroundColor: COLOURS[member.id % 8] }}
                />
                <b>{member.name}</b>
                <span>{won ? '👑 ведущий' : alive ? 'на льду' : 'в воде'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
