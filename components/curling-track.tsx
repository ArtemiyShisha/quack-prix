'use client';
import { useId } from 'react';
import type { Frame } from '@/lib/race';
import type { Member } from '@/lib/roster';
import { CURLING, distanceToButton, type CurlingFrame } from '@/lib/curling';
import { COLOURS } from '@/lib/track';

const X = (x: number) => 60 + x * 60;
const Y = (y: number) => 260 + y * 60;

export function CurlingTrack({
  members,
  frame,
  overview,
}: {
  members: Member[];
  frame: Frame | null;
  overview: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const iceId = `${id}-ice`,
    stoneId = `${id}-stone`;
  const curling = frame as CurlingFrame | null;
  const players = members.filter((p) => p.active && p.name.trim());
  const stones = curling?.stones.filter((s) => s.delivered) ?? [];
  const active =
    curling?.activeSlot === null
      ? null
      : stones.find((s) => s.slot === curling?.activeSlot);
  const focus = active ?? stones.find((s) => s.slot === curling?.closestSlot);
  const cameraX = Math.max(
    0,
    Math.min(520, X(focus?.x ?? CURLING.targetX) - 280),
  );
  const cx = X(CURLING.targetX);
  const leader = curling?.closestSlot;
  const distances = [...stones].sort((a, b) => {
    const difference = distanceToButton(a) - distanceToButton(b);
    return Math.abs(difference) > 1e-8
      ? difference
      : Number(b.slot === leader) - Number(a.slot === leader);
  });
  return (
    <div className="curling-stage">
      <div className="curling-scorebar">
        <span>
          <span className="curling-live-dot" /> ЛЁД ГОТОВ
        </span>
        <strong>
          {curling
            ? `Бросок ${curling.delivered} / ${players.length}`
            : 'По одному камню. Всё решит лёд.'}
        </strong>
      </div>
      <svg
        className="curling-rink"
        viewBox={overview ? '0 0 1140 530' : `${cameraX} 65 620 390`}
        role="img"
        aria-label="Ледовая дорожка кёрлинга. Побеждает камень ближе к центру мишени."
      >
        <defs>
          <linearGradient id={iceId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7fdff" />
            <stop offset="0.55" stopColor="#e4f3fa" />
            <stop offset="1" stopColor="#d5eaf5" />
          </linearGradient>
          <radialGradient id={stoneId} cx="0.3" cy="0.2">
            <stop offset="0" stopColor="#c1d0d9" />
            <stop offset="0.7" stopColor="#738b9b" />
            <stop offset="1" stopColor="#415e71" />
          </radialGradient>
          <pattern
            id={`${id}-pebble`}
            width="19"
            height="17"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="4" cy="5" r="0.7" fill="#84b9d3" opacity="0.25" />
            <circle cx="14" cy="13" r="0.5" fill="#fff" opacity="0.9" />
          </pattern>
        </defs>
        <rect width="1140" height="530" fill="#c9dfeb" />
        <text x="60" y="58" className="curling-rink-title">
          КРЯК-ПРИ / ЛЕДОВЫЙ КЛУБ
        </text>
        <text x="1080" y="58" textAnchor="end" className="curling-rink-note">
          ОДИН КАМЕНЬ — ОДИН ШАНС
        </text>
        <rect x="48" y="106" width="1044" height="308" rx="18" fill="#8fb8ce" />
        <rect
          x="60"
          y="116"
          width="1020"
          height="288"
          rx="8"
          fill={`url(#${iceId})`}
        />
        <rect
          x="60"
          y="116"
          width="1020"
          height="288"
          rx="8"
          fill={`url(#${id}-pebble)`}
        />
        <path
          d="M60 260H1080"
          stroke="#9dbdce"
          strokeDasharray="9 9"
          opacity="0.6"
        />
        <path d="M380 116V404" stroke="#e98b80" strokeWidth="7" opacity="0.8" />
        <path
          d="M980 116V404"
          stroke="#e98b80"
          strokeWidth="3"
          opacity="0.65"
        />
        <circle
          cx={cx}
          cy="260"
          r={CURLING.houseRadius * 60}
          fill="#538cba"
          opacity="0.92"
        />
        <circle cx={cx} cy="260" r="76" fill="#eff8fc" />
        <circle cx={cx} cy="260" r="48" fill="#ed805f" />
        <circle cx={cx} cy="260" r="20" fill="#eff8fc" />
        <path
          d={`M${cx} 116V404M${cx - 116} 260H${cx + 116}`}
          stroke="#507991"
          strokeWidth="1"
          opacity="0.6"
        />
        <circle cx={cx} cy="260" r="4" fill="#345f79" />
        <path
          d="M131 244V276"
          stroke="#385d73"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <text x="145" y="446" textAnchor="middle" className="curling-rink-note">
          СТАРТ
        </text>
        <text x="380" y="446" textAnchor="middle" className="curling-rink-note">
          ЛИНИЯ БРОСКА
        </text>
        <text x={cx} y="446" textAnchor="middle" className="curling-rink-note">
          ДОМ · БЛИЖЕ К ЦЕНТРУ
        </text>
        {!curling && (
          <g opacity="0.55">
            <path
              d="M240 290Q510 345 735 266"
              fill="none"
              stroke="#578aa8"
              strokeWidth="3"
              strokeDasharray="8 9"
            />
            <path
              d="m723 256 16 9-14 12"
              fill="none"
              stroke="#578aa8"
              strokeWidth="3"
            />
            <text
              x="485"
              y="365"
              textAnchor="middle"
              className="curling-rink-note"
            >
              СКОЛЬЖЕНИЕ + ВРАЩЕНИЕ + СТОЛКНОВЕНИЯ
            </text>
          </g>
        )}
        {stones.map((stone) => {
          const member = players[stone.slot];
          if (!member) return null;
          const colour = COLOURS[member.id % COLOURS.length];
          const closest = stone.slot === leader;
          const radius = CURLING.stoneRadius * 60;
          return (
            <g
              key={stone.slot}
              transform={`translate(${X(stone.x)} ${Y(stone.y)})`}
            >
              <title>
                {member.name}: {distanceToButton(stone).toFixed(2)} м от центра
              </title>
              {closest && (
                <circle
                  r={radius + 7}
                  fill="none"
                  stroke="#f2b850"
                  strokeWidth="3"
                  strokeDasharray="4 3"
                />
              )}
              <ellipse
                cx="1"
                cy="5"
                rx={radius + 1}
                ry={radius}
                fill="#294c64"
                opacity="0.18"
              />
              <circle
                r={radius}
                fill={`url(#${stoneId})`}
                stroke="#3a586c"
                strokeWidth="1.5"
              />
              <g transform={`rotate(${(stone.angle * 180) / Math.PI})`}>
                <circle
                  r={radius * 0.72}
                  fill={colour}
                  stroke="#fff"
                  strokeOpacity="0.55"
                />
                <rect x="-8" y="-3" width="16" height="6" rx="3" fill="#fff" />
                <rect
                  x="-5"
                  y="-1.5"
                  width="10"
                  height="3"
                  rx="1.5"
                  fill={colour}
                />
              </g>
              <rect
                x="-52"
                y="-38"
                width="104"
                height="19"
                rx="8"
                fill="#fff"
                fillOpacity="0.9"
              />
              <text y="-25" textAnchor="middle" className="curling-stone-name">
                {member.name.length > 13
                  ? `${member.name.slice(0, 12)}…`
                  : member.name}
              </text>
            </g>
          );
        })}
        <text x="60" y="494" className="curling-rink-note">
          ПУСТЬ ЛЁД ВЫБЕРЕТ ВЕДУЩЕГО.
        </text>
        <text x="1080" y="494" textAnchor="end" className="curling-rink-note">
          БЕЗ ЩЁТОК. БЕЗ ПОДТАСОВОК.
        </text>
      </svg>
      <div className="curling-lineup" aria-label="Порядок бросков">
        {players.length === 0 && (
          <span className="curling-empty">
            Собери команду слева — камни уже ждут.
          </span>
        )}
        {players.map((member, slot) => (
          <div
            key={member.id}
            className={`curling-player ${curling?.activeSlot === slot ? 'is-throwing' : ''} ${curling?.result?.slot === slot ? 'is-winner' : ''}`}
          >
            <span
              className="curling-mini-stone"
              style={{ backgroundColor: COLOURS[member.id % COLOURS.length] }}
            />
            <span className="curling-player-name">{member.name}</span>
            <span className="curling-player-state">
              {curling?.activeSlot === slot
                ? 'на льду'
                : stones.some((s) => s.slot === slot)
                  ? '✓'
                  : `#${slot + 1}`}
            </span>
          </div>
        ))}
      </div>
      {distances.length > 0 && (
        <div className="curling-distances">
          <span>
            {curling?.result ? 'ИТОГ · ДО ЦЕНТРА' : 'СЕЙЧАС БЛИЖЕ ВСЕХ'}
          </span>
          {distances.slice(0, 3).map((stone, index) => (
            <span key={stone.slot}>
              <b>
                {index + 1}. {players[stone.slot]?.name}
              </b>{' '}
              {distanceToButton(stone).toFixed(2)} м
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
