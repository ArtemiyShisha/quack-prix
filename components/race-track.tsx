'use client';
import {
  PEGS,
  ROTORS,
  RAILS,
  SLOPES,
  HUES,
  COLOURS,
  startX,
  WALL_X,
  HEIGHT,
  VIEW_HEIGHT,
  FINISH_Y,
} from '@/lib/track';
import type { Frame } from '@/lib/race';
import type { Member } from '@/lib/roster';
export function RaceTrack({
  members,
  frame,
  overview = false,
}: {
  members: Member[];
  frame: Frame | null;
  overview?: boolean;
}) {
  const players = members.filter((p) => p.active && p.name.trim());
  const ducks = players.length
    ? players
    : Array.from({ length: 8 }, (_, id) => ({ id, name: '', active: true }));
  const leadY = frame ? Math.max(...frame.ducks.map((d) => d.y)) : 100;
  const camera = overview
    ? 0
    : Math.max(0, Math.min(HEIGHT - VIEW_HEIGHT, leadY - 430));
  const ghost = frame?.flushing ? 0.15 : 1;
  return (
    <svg
      className="race-svg"
      viewBox={`0 ${camera} 960 ${overview ? HEIGHT : VIEW_HEIGHT}`}
      role="img"
      aria-label="Длинная трасса: слалом, три каскада с вертушками и финишная воронка"
      style={{ aspectRatio: '960/760' }}
    >
      <defs>
        <pattern
          id="pool-grid"
          width="38"
          height="38"
          patternUnits="userSpaceOnUse"
        >
          <path d="M38 0H0V38" fill="none" stroke="#fff" strokeOpacity=".3" />
        </pattern>
        <linearGradient id="water" x2="0" y2="1">
          <stop stopColor="#b8eafa" />
          <stop offset="1" stopColor="#78d0ed" />
        </linearGradient>
        <linearGradient id="peg" x2="0" y2="1">
          <stop stopColor="white" />
          <stop offset="1" stopColor="#bceafa" />
        </linearGradient>
        <pattern
          id="finish"
          width="36"
          height="36"
          patternUnits="userSpaceOnUse"
        >
          <rect width="36" height="36" fill="#fff" />
          <path d="M0 0h18v18H0zM18 18h18v18H18z" fill="#204c60" />
        </pattern>
      </defs>
      <rect width="960" height={HEIGHT} fill="url(#water)" />
      <rect width="960" height={HEIGHT} fill="url(#pool-grid)" />
      <path
        d={`M${WALL_X[0]} 0V${HEIGHT}M${WALL_X[1]} 0V${HEIGHT}`}
        stroke="#61bfdc"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <path
        d={`M${WALL_X[0] - 4} 0V${HEIGHT}M${WALL_X[1] - 4} 0V${HEIGHT}`}
        stroke="#eefcff"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <text x="480" y="48" textAnchor="middle" className="board-label">
        СТАРТОВАЯ ПЛОЩАДКА
      </text>
      <path
        d="M112 143H848"
        stroke="#fff"
        strokeWidth="5"
        strokeDasharray="12 9"
        opacity=".9"
      />
      {[
        [185, '01 / СЛАЛОМ'],
        [535, '02 / ПРАВЫЙ ПОВОРОТ'],
        [894, '03 / МЫЛЬНЫЙ КАСКАД'],
        [1367, '04 / ПОСЛЕДНИЙ ШАНС'],
      ].map(([y, label]) => (
        <text
          key={String(y)}
          x="105"
          y={Number(y)}
          className="board-label"
          opacity=".7"
        >
          {label}
        </text>
      ))}
      <g opacity={ghost}>
        {PEGS.map((peg, i) => (
          <g key={i}>
            <circle
              cx={peg.x}
              cy={peg.y + 6}
              r={peg.radius + 2}
              fill="#51b4d0"
              opacity=".4"
            />
            <circle
              cx={peg.x}
              cy={peg.y}
              r={peg.radius}
              fill="url(#peg)"
              stroke="#fff"
              strokeWidth="3"
            />
            <circle cx={peg.x - 4} cy={peg.y - 5} r="4" fill="white" />
          </g>
        ))}
      </g>
      {ROTORS.map((rotor, i) => (
        <g
          key={i}
          opacity={ghost}
          transform={`translate(${rotor.x} ${rotor.y}) rotate(${frame ? (frame.rotorAngles[i] * 180) / Math.PI : i % 2 ? -25 : 25})`}
        >
          {[0, 90].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <rect
                x={-rotor.length / 2}
                y={-rotor.thickness / 2 + 6}
                width={rotor.length}
                height={rotor.thickness}
                rx="11"
                fill="#55a6bd"
                opacity=".4"
              />
              <rect
                x={-rotor.length / 2}
                y={-rotor.thickness / 2}
                width={rotor.length}
                height={rotor.thickness}
                rx="11"
                fill={i === 3 ? '#ffcd5a' : '#ff9570'}
                stroke={i === 3 ? '#fff0b6' : '#ffd1bb'}
                strokeWidth="4"
              />
            </g>
          ))}
          <circle r="19" fill="#fff" />
          <circle r="8" fill="#24576b" />
        </g>
      ))}
      {[...SLOPES, ...RAILS].map((rail, i) => (
        <g key={i} opacity={i < SLOPES.length ? ghost : 1}>
          <path
            d={`M${rail.x1} ${rail.y1 + 7}L${rail.x2} ${rail.y2 + 7}`}
            stroke="#48afcf"
            strokeWidth="30"
            strokeLinecap="round"
          />
          <path
            d={`M${rail.x1} ${rail.y1}L${rail.x2} ${rail.y2}`}
            stroke="#edfcff"
            strokeWidth="23"
            strokeLinecap="round"
          />
          <path
            d={`M${rail.x1} ${rail.y1 - 3}L${rail.x2} ${rail.y2 - 3}`}
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path d={`M83 ${FINISH_Y}H877`} stroke="url(#finish)" strokeWidth="29" />
      <text
        x="480"
        y={FINISH_Y + 57}
        textAnchor="middle"
        className="board-label"
      >
        ФИНИШ · МИКРОФОН ТВОЙ
      </text>
      {ducks.map((duck, slot) => {
        const state = frame?.ducks[slot];
        const x = state?.x ?? startX(slot, ducks.length),
          y = state?.y ?? 94;
        const winning = frame?.result?.slot === slot;
        return (
          <g key={duck.id} opacity={players.length ? 1 : 0.55}>
            <title>{duck.name || `Утка ${slot + 1}`}</title>
            {winning && (
              <circle
                cx={x}
                cy={y}
                r="39"
                fill="none"
                stroke="#fff4a0"
                strokeWidth="8"
              />
            )}
            <image
              href="/duck.png"
              x={x - 34}
              y={y - 34}
              width="68"
              height="68"
              transform={`rotate(${((state?.angle ?? 0) * 180) / Math.PI} ${x} ${y})`}
              style={{ filter: `hue-rotate(${HUES[duck.id]}deg)` }}
            />
            {duck.name && (
              <g>
                <rect
                  x={x - 48}
                  y={y - 57}
                  width="96"
                  height="26"
                  rx="13"
                  fill="white"
                  fillOpacity=".95"
                  stroke={COLOURS[duck.id]}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={y - 38}
                  textAnchor="middle"
                  className="duck-label"
                >
                  {duck.name.length > 10
                    ? duck.name.slice(0, 9) + '…'
                    : duck.name}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
