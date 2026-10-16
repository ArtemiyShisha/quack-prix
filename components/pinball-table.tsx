'use client';
import { useEffect, useRef, useState } from 'react';
import type { Frame } from '@/lib/race';
import { initPinballPhysics } from '@/lib/pinball';
import type { ArenaFrame } from '@/lib/pinball-arenas';
import { DEFAULT_PINBALL_MAP, mapInfo } from '@/lib/pinball-maps';
import type { Member } from '@/lib/roster';
import type { createPinballScene } from '@/lib/pinball-arena-scene';
import { COLOURS } from '@/lib/track';
import { appUrl } from '@/lib/urls';
import { pinballHit } from '@/lib/sound';
import { DESCENT_LEVEL_NAMES } from '@/lib/pinball-descent';

export function PinballTable({
  members,
  frame,
  onReady,
  sound,
}: {
  members: Member[];
  frame: Frame | null;
  onReady: (ready: boolean) => void;
  sound: boolean;
}) {
  const mapId = DEFAULT_PINBALL_MAP;
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createPinballScene> | null>(null);
  const latest = useRef<{ members: Member[]; frame: ArenaFrame | null }>({
    members,
    frame: null,
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const candidate = frame as ArenaFrame | null;
  const pinball = candidate?.mapId === mapId ? candidate : null;
  const info = mapInfo(mapId);
  const players = members.filter((m) => m.active && m.name.trim());
  const leadingLevel = Math.max(0, ...(pinball?.stages ?? []));
  const lastSound = useRef({ seed: -1, mapId, hits: 0, returns: 0 });
  useEffect(() => {
    latest.current = { members, frame: pinball };
    scene.current?.update(pinball, members);
  }, [members, pinball]);
  useEffect(() => {
    if (!pinball) return;
    const previous = lastSound.current;
    if (
      previous.seed === pinball.seed &&
      previous.mapId === mapId &&
      sound &&
      !pinball.result &&
      (pinball.contacts > previous.hits || pinball.returns > previous.returns)
    )
      pinballHit(pinball.returns > previous.returns);
    lastSound.current = {
      seed: pinball.seed,
      mapId,
      hits: pinball.contacts,
      returns: pinball.returns,
    };
  }, [pinball, sound, mapId]);
  useEffect(() => {
    let disposed = false;
    setStatus('loading');
    onReady(false);
    const failure = () => {
      if (!disposed) {
        setStatus('failed');
        onReady(false);
      }
    };
    Promise.all([import('@/lib/pinball-arena-scene'), initPinballPhysics()])
      .then(([{ createPinballScene }]) => {
        if (disposed || !host.current) return;
        try {
          scene.current = createPinballScene(host.current, failure, mapId);
          const current = latest.current;
          scene.current.update(
            current.frame?.mapId === mapId ? current.frame : null,
            current.members,
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
  }, [onReady, mapId]);
  return (
    <div className="pinball-game" data-map={mapId}>
      <ol className="pinball-levels" aria-label="Уровни Глубины">
        {DESCENT_LEVEL_NAMES.map((name, index) => (
          <li key={name} className={leadingLevel === index ? 'is-current' : ''}>
            <b>0{index + 1}</b>
            <span>
              {name}
              <small>
                {pinball
                  ? pinball.stages.filter((stage) => stage === index).length
                  : index === 0
                    ? players.length
                    : 0}{' '}
                в игре
              </small>
            </span>
          </li>
        ))}
      </ol>
      <div className="pinball-stage">
        <div className="pinball-canvas" ref={host} />
        {status === 'ready' && (
          <>
            <div className="pinball-hud">
              <span>
                {info.name.toLocaleUpperCase('ru')} · УРОВЕНЬ {leadingLevel + 1}
                /3
              </span>
              <strong>
                {pinball?.result
                  ? pinball.result.reason === 'finish'
                    ? 'Есть попадание!'
                    : 'Раунд завершён'
                  : DESCENT_LEVEL_NAMES[leadingLevel]}
              </strong>
            </div>
            <div className="pinball-stats">
              <b>
                {pinball?.contacts ?? 0}
                <small>УДАРЫ</small>
              </b>
              <b>
                {pinball?.ballContacts ?? 0}
                <small>СТОЛКНОВЕНИЯ</small>
              </b>
              <b>
                {pinball?.stages.reduce((sum, stage) => sum + stage, 0) ?? 0}
                <small>ПЕРЕХОДЫ</small>
              </b>
            </div>
            <div className="pinball-camera-hint">
              {pinball?.rescue
                ? 'Заслоны подняты — путь к финишу открыт'
                : !pinball
                  ? 'Одинаковая высота · общий выпуск'
                  : !pinball.startGateOpen
                    ? 'Общая заслонка выпускает всех одновременно'
                    : [
                        'Первая лунка — переход на второй уровень',
                        'Вторая лунка — ещё один спуск к ядру',
                        'Только третья лунка приносит победу',
                      ][leadingLevel]}
            </div>
          </>
        )}
        {status === 'loading' && (
          <output className="pinball-message">Собираем кряк-машину…</output>
        )}
        {status === 'failed' && (
          <div className="pinball-message" role="alert">
            <strong>3D здесь не запустился</strong>
            <p>
              Не удалось загрузить 3D-сцену или физику. Обнови страницу; для
              игры нужен WebGL 2.
            </p>
            <a href={appUrl('/')}>Вернуться к аквапарку →</a>
          </div>
        )}
      </div>
      {players.length > 0 && (
        <div className="pinball-roster" aria-label="Участники пинбола">
          {players.map((member, slot) => (
            <div
              key={member.id}
              className={`pinball-player ${pinball?.result?.slot === slot ? 'is-winner' : ''}`}
            >
              <span style={{ backgroundColor: COLOURS[member.id % 8] }} />
              <b title={member.name}>{member.name}</b>
              <small title="Уровень участника">
                {pinball?.result?.slot === slot
                  ? '👑 ведущий'
                  : `Уровень ${(pinball?.stages[slot] ?? 0) + 1}/3`}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
