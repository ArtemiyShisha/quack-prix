'use client';
import {
  BOWLS,
  PIPES,
  PADDLES,
  PEGS,
  HEIGHT,
  VIEW_HEIGHT,
  HUES,
  COLOURS,
  startPosition,
} from '@/lib/track';
import type { Frame } from '@/lib/race';
import type { Member } from '@/lib/roster';
const path = (points: { x: number; y: number }[]) =>
  points
    .map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1))
    .join('');
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
  const leader = frame
    ? [...frame.ducks].sort((a, b) => b.progress - a.progress)[0]
    : null;
  const focus =
    leader?.inTube || (leader?.stage ?? 0) >= BOWLS.length
      ? leader!.y
      : BOWLS[Math.min(leader?.stage ?? 0, BOWLS.length - 1)].y;
  const camera = overview
    ? 0
    : Math.max(0, Math.min(HEIGHT - VIEW_HEIGHT, focus - 390));
  const ghost = frame?.flushing ? 0.15 : 1;
  const drawDuck = (duck: Member, slot: number) => {
    const state = frame?.ducks[slot],
      p = state ?? startPosition(slot, ducks.length),
      winning = frame?.result?.slot === slot;
    if (state?.hiddenInDrain) return null;
    const label =
        duck.name.length > 18 ? duck.name.slice(0, 17) + '…' : duck.name,
      labelWidth = Math.max(54, label.length * 8 + 20),
      colour = COLOURS[duck.id % 8];
    return (
      <g
        key={duck.id}
        opacity={players.length ? (state?.inTube ? 0.8 : 1) : 0.55}
      >
        <title>{duck.name || `Утка ${slot + 1}`}</title>
        {winning && (
          <circle
            cx={p.x}
            cy={p.y}
            r="43"
            fill="#ffe8a0"
            stroke="#fff"
            strokeWidth="3"
          />
        )}
        <ellipse
          cx={p.x}
          cy={p.y + 18}
          rx="23"
          ry="9"
          fill="#236a83"
          opacity=".2"
        />
        <g
          transform={`translate(${p.x} ${p.y}) scale(${state?.inTube ? 0.8 : 1}) rotate(${((state?.angle ?? 0) * 180) / Math.PI})`}
        >
          <image
            href="/duck.png"
            x="-43"
            y="-43"
            width="86"
            height="86"
            style={{ filter: `hue-rotate(${HUES[duck.id % 8]}deg)` }}
          />
        </g>
        {label && (
          <g transform={`translate(${p.x} ${p.y + 41})`}>
            <rect
              x={-labelWidth / 2}
              y="-14"
              width={labelWidth}
              height="27"
              rx="13.5"
              fill={winning ? '#fff3c2' : '#fff'}
              stroke={colour}
              strokeWidth="2"
              opacity=".96"
            />
            <text
              y="5"
              textAnchor="middle"
              fill="#244f60"
              fontSize="14"
              fontWeight="750"
            >
              {label}
            </text>
          </g>
        )}
      </g>
    );
  };
  return (
    <svg
      className="race-svg"
      viewBox={`0 ${camera} 960 ${overview ? HEIGHT : VIEW_HEIGHT}`}
      role="img"
      aria-label="Гонка уток по четырём чашам-воронкам с наклонными стенками, открытыми выходами и соединительными желобами"
      style={{ aspectRatio: '960/850' }}
    >
      <defs>
        <pattern
          id="pool-grid"
          width="38"
          height="38"
          patternUnits="userSpaceOnUse"
        >
          <path d="M38 0H0V38" fill="none" stroke="#fff" strokeOpacity=".55" />
        </pattern>
        <radialGradient id="bowl-water">
          <stop offset=".12" stopColor="#56adcd" />
          <stop offset=".55" stopColor="#9bdfed" />
          <stop offset="1" stopColor="#c5f0f6" />
        </radialGradient>
        <radialGradient id="drain">
          <stop stopColor="#15485f" />
          <stop offset="1" stopColor="#2a7d9b" />
        </radialGradient>
        <pattern
          id="finish"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <rect width="28" height="28" fill="#fff" />
          <path d="M0 0H14V14H0ZM14 14H28V28H14Z" fill="#254b5e" />
        </pattern>
        <mask
          id="below-bowls"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="960"
          height={HEIGHT}
        >
          <rect width="960" height={HEIGHT} fill="white" />
          {BOWLS.map((b, i) => (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={b.radius + 8} fill="black" />
              <circle cx={b.x} cy={b.y} r={b.drain} fill="white" />
            </g>
          ))}
        </mask>
      </defs>
      <rect width="960" height={HEIGHT} fill="#d5edf0" />
      <rect width="960" height={HEIGHT} fill="url(#pool-grid)" />
      {PIPES.map((points, i) => (
        <g key={i}>
          <path
            d={path(points)}
            transform="translate(0 8)"
            fill="none"
            stroke="#7bb7c5"
            strokeWidth="96"
          />
          <path
            d={path(points)}
            fill="none"
            stroke="#f4ffff"
            strokeWidth="96"
          />
          <path
            d={path(points)}
            fill="none"
            stroke="#8ad1e4"
            strokeWidth="76"
          />
          <path
            d={path(points)}
            fill="none"
            stroke="#e9fbff"
            strokeWidth="3"
            strokeDasharray="12 20"
            opacity=".6"
          />
        </g>
      ))}
      {BOWLS.map((b, i) => (
        <g key={i}>
          <text
            x={b.x}
            y={b.y - b.radius - 38}
            textAnchor="middle"
            className="board-label"
          >
            {b.label}
          </text>
          <circle cx={b.x} cy={b.y + 10} r={b.radius + 9} fill="#7bb7c5" />
          <circle
            cx={b.x}
            cy={b.y}
            r={b.radius}
            fill="url(#bowl-water)"
            stroke="#f6ffff"
            strokeWidth="14"
          />
          {[0.4, 0.62, 0.83].map((radius) => (
            <circle
              key={radius}
              cx={b.x}
              cy={b.y}
              r={b.radius * radius}
              fill="none"
              stroke="#f3ffff"
              strokeWidth="2"
              opacity=".35"
            />
          ))}
          <path
            d={`M${b.x - b.radius * 0.79} ${b.y - b.radius * 0.3} A${b.radius * 0.84} ${b.radius * 0.84} 0 0 1 ${b.x + b.radius * 0.15} ${b.y - b.radius * 0.82}`}
            fill="none"
            stroke="white"
            strokeWidth="9"
            strokeLinecap="round"
            opacity=".4"
          />
          <circle cx={b.x} cy={b.y + 4} r={b.drain + 3} fill="#4691ac" />
          <circle
            cx={b.x}
            cy={b.y}
            r={b.drain}
            fill="url(#drain)"
            stroke="#daf7fa"
            strokeWidth="4"
          />
          <path
            d={`M${b.x - 10} ${b.y - 5}l10 10 10-10`}
            fill="none"
            stroke="#9edbeb"
            strokeWidth="3"
            opacity=".6"
          />
          <text
            x={b.x}
            y={b.y + b.drain + 28}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            letterSpacing="2"
            fill="#39839d"
          >
            ВЫХОД
          </text>
        </g>
      ))}
      <g opacity={ghost}>
        {PEGS.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y + 5}
              r={p.radius + 2}
              fill="#398ca6"
              opacity=".35"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={p.radius}
              fill="#ffbc91"
              stroke="#fff0d6"
              strokeWidth="4"
            />
            <circle cx={p.x - 5} cy={p.y - 5} r="5" fill="#ffe6c3" />
          </g>
        ))}
        {PADDLES.map((p, i) => (
          <g
            key={i}
            transform={`translate(${p.x} ${p.y}) rotate(${((frame?.rotorAngles[i] ?? 0.5) * 180) / Math.PI})`}
          >
            <rect
              x={-p.length / 2}
              y={-p.width / 2 + 5}
              width={p.length}
              height={p.width}
              rx="6"
              fill="#367c9d"
              opacity=".3"
            />
            <rect
              x={-p.length / 2}
              y={-p.width / 2}
              width={p.length}
              height={p.width}
              rx="6"
              fill="#579bc3"
              stroke="#e1f6ff"
              strokeWidth="3"
            />
            <circle r="11" fill="#f5ffff" />
            <circle r="5" fill="#ffa875" />
          </g>
        ))}
      </g>
      <path d="M719 3300H801" stroke="url(#finish)" strokeWidth="28" />
      <text x="760" y="3380" textAnchor="middle" className="board-label">
        ФИНИШ
      </text>
      {ducks
        .filter((_, slot) => !frame?.ducks[slot]?.inTube)
        .map((duck) => drawDuck(duck, ducks.indexOf(duck)))}
      <g mask="url(#below-bowls)">
        {ducks
          .filter((_, slot) => frame?.ducks[slot]?.inTube)
          .map((duck) => drawDuck(duck, ducks.indexOf(duck)))}
      </g>
    </svg>
  );
}
