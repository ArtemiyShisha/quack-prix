'use client';
import {
  PEGS,
  ROTORS,
  RAILS,
  SLOPES,
  BUMPERS,
  BOOSTS,
  GATE,
  POOL,
  SECTIONS,
  HUES,
  COLOURS,
  startX,
  WALL_X,
  HEIGHT,
  VIEW_HEIGHT,
  FINISH_Y,
} from '@/lib/track';
import type { Frame } from '@/lib/race';
import { wavePoolState } from '@/lib/wave-pool';
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
  const pool = frame?.pool ?? wavePoolState(0, 0);
  const waveHeight = 185 + Math.sin((frame?.elapsed ?? 0) * 3) * 35;
  const poolLabel =
    pool.swirl >= 0
      ? 'ВИХРЬ ПО ЧАСОВОЙ СТРЕЛКЕ'
      : 'ВИХРЬ ПРОТИВ ЧАСОВОЙ СТРЕЛКИ';
  const eventFlash = !!frame && frame.elapsed - frame.chaos.at < 0.85;
  return (
    <svg
      className="race-svg"
      viewBox={`0 ${camera} 960 ${overview ? HEIGHT : VIEW_HEIGHT}`}
      role="img"
      aria-label="Быстрая трасса со случайными гейзерами, пинболом, меняющими направление вертушками и проточным водоворотом"
      style={{ aspectRatio: '960/760' }}
    >
      <defs>
        <clipPath id="inside-pool">
          <rect x="69" width="822" height={HEIGHT} />
        </clipPath>
        <clipPath id="wave-basin">
          <rect
            x="95"
            y={POOL.top - 12}
            width="770"
            height={POOL.bottom - POOL.top + 32}
            rx="42"
          />
        </clipPath>
        <pattern
          id="sluice-stripes"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="32" height="32" fill="#267fbc" />
          <rect width="14" height="32" fill="#b4e8ff" />
        </pattern>
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
      {SECTIONS.map(({ y, label }) => (
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
        <rect
          x="95"
          y={POOL.top - 12}
          width="770"
          height={POOL.bottom - POOL.top + 32}
          rx="42"
          fill="#398ecc"
          fillOpacity=".13"
          stroke="#e2faff"
          strokeWidth="4"
          strokeDasharray="10 8"
        />
        <g clipPath="url(#wave-basin)">
          <rect
            x="95"
            y={POOL.bottom + 20 - waveHeight}
            width="770"
            height={waveHeight}
            fill="#2f9ed4"
            opacity=".23"
          />
          <path
            d={`M95 ${POOL.bottom + 20 - waveHeight}q48 -13 96 0t96 0t96 0t96 0t96 0t96 0t96 0t96 0`}
            fill="none"
            stroke="#e9fdff"
            strokeWidth="5"
            opacity=".8"
          />
          <g
            transform={`translate(${POOL.x} ${POOL.y}) rotate(${pool?.flowAngle ?? 0})`}
            fill="none"
            stroke="#e9ffff"
            strokeWidth="4"
            opacity=".75"
          >
            {[65, 108, 150].map((radius) => (
              <circle
                key={radius}
                r={radius}
                strokeDasharray={`${radius * 1.4} ${radius * 0.7}`}
              />
            ))}
            <path
              d="M150 -18l10 18-18 -2M-108 18l-10 -18 18 2"
              transform={`scale(1 ${pool && pool.swirl < 0 ? -1 : 1})`}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
        <g transform="translate(480 1472)">
          <rect
            x="-168"
            y="-19"
            width="336"
            height="30"
            rx="15"
            fill="#edfaff"
          />
          <text textAnchor="middle" y="1" className="pool-caption">
            {poolLabel}
          </text>
        </g>
      </g>
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
      <g opacity={ghost}>
        {BOOSTS.map((boost, i) => {
          const active = frame?.boostActive[i] ?? true;
          return (
            <g
              key={i}
              transform={`translate(${boost.x} ${boost.y}) rotate(${(boost.angle * 180) / Math.PI})`}
            >
              <rect
                x={-boost.length / 2 - 7}
                y={-boost.width / 2 - 6}
                width={boost.length + 14}
                height={boost.width + 12}
                rx="24"
                fill="#c1fff1"
                opacity={active ? 0.65 : 0.25}
              />
              <rect
                x={-boost.length / 2}
                y={-boost.width / 2}
                width={boost.length}
                height={boost.width}
                rx="20"
                fill={active ? '#21ba9b' : '#79c6c3'}
                opacity=".8"
              />
              {[-48, -12, 24, 60].map((x, j) => (
                <path
                  key={x}
                  d={`M${x - 9} -12L${x + 3} 0L${x - 9} 12`}
                  fill="none"
                  stroke="white"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={
                    active
                      ? 0.6 + 0.4 * Math.sin((frame?.elapsed ?? 0) * 8 - j)
                      : 0.4
                  }
                />
              ))}
            </g>
          );
        })}
        {BUMPERS.map((bumper, i) => {
          const state = frame?.bumpers[i];
          const impact = state
            ? Math.max(0, 1 - ((frame?.elapsed ?? 0) - state.hitAt) / 0.45)
            : 0;
          return (
            <g
              key={i}
              transform={`translate(${state?.x ?? bumper.x} ${bumper.y})`}
            >
              <path
                d={`M${bumper.x - (state?.x ?? bumper.x) - bumper.travel} 0h${bumper.travel * 2}`}
                stroke="#4697ae"
                strokeWidth="8"
                strokeLinecap="round"
                opacity=".25"
              />
              {impact > 0 && (
                <circle
                  r={bumper.radius + 9 + (1 - impact) * 28}
                  fill="none"
                  stroke="#fff8c9"
                  strokeWidth={5 * impact}
                  opacity={impact}
                />
              )}
              <circle
                cy="7"
                r={bumper.radius + 3}
                fill="#458fac"
                opacity=".4"
              />
              <ellipse
                cy={bumper.radius + 8}
                rx={bumper.radius + 10}
                ry="5"
                fill="none"
                stroke="#ecffff"
                strokeWidth="3"
                opacity=".7"
              />
              <circle
                r={bumper.radius}
                fill={impact > 0 ? '#ffe09e' : '#f7869f'}
                stroke="#ffebdf"
                strokeWidth="5"
              />
              <circle
                r={bumper.radius - 11}
                fill="#fff7e4"
                stroke="#d97091"
                strokeWidth="3"
              />
              <path d="M-4 -12H7L0 -1H9L-7 13L-2 2H-10Z" fill="#d97091" />
            </g>
          );
        })}
      </g>
      {ROTORS.map((rotor, i) => (
        <g
          key={i}
          opacity={ghost}
          transform={`translate(${rotor.x} ${rotor.y}) rotate(${frame ? (frame.rotorAngles[i] * 180) / Math.PI : i % 2 ? -25 : 25})`}
        >
          {Array.from(
            { length: rotor.blades },
            (_, j) => (j * 180) / rotor.blades,
          ).map((angle) => (
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
                fill={i === ROTORS.length - 1 ? '#ffcd5a' : '#ff9570'}
                stroke={i === ROTORS.length - 1 ? '#fff0b6' : '#ffd1bb'}
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
      <g clipPath="url(#inside-pool)" opacity={ghost}>
        {GATE.centres.map((x, i) => (
          <g
            key={i}
            transform={`translate(${frame?.gates[i] ?? x + pool.openings[i] * GATE.travel * (i === 0 ? -1 : 1)} ${GATE.y}) rotate(${(GATE.angles[i] * 180) / Math.PI})`}
          >
            <rect
              x={-GATE.width / 2}
              y={-GATE.thickness / 2 + 8}
              width={GATE.width}
              height={GATE.thickness}
              rx="10"
              fill="#338eb0"
              opacity=".35"
            />
            <rect
              x={-GATE.width / 2}
              y={-GATE.thickness / 2}
              width={GATE.width}
              height={GATE.thickness}
              rx="10"
              fill="url(#sluice-stripes)"
              stroke="#e4f9ff"
              strokeWidth="4"
            />
            <circle
              cx={(i === 0 ? 1 : -1) * (GATE.width / 2 - 13)}
              r="6"
              fill="#fff"
            />
          </g>
        ))}
        <path
          transform={`translate(${pool?.openSide === 0 ? 370 : pool?.openSide === 1 ? 590 : 480} ${GATE.y + 68})`}
          d="M-18 0l18 12 18-12M-18 18l18 12 18-12"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".9"
        />
      </g>
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
        const kick = state?.kick;
        const kickGlow =
          kick && frame ? Math.max(0, 1 - (frame.elapsed - kick.at) / 0.65) : 0;
        return (
          <g key={duck.id} opacity={players.length ? 1 : 0.55}>
            <title>{duck.name || `Утка ${slot + 1}`}</title>
            {kick && kickGlow > 0 && (
              <g
                transform={`translate(${x} ${y}) rotate(${(Math.atan2(kick.vy, kick.vx) * 180) / Math.PI})`}
                opacity={kickGlow}
                fill="none"
                stroke={kick.vy < 0 ? '#d746ab' : '#fff2a5'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle r={35 + (1 - kickGlow) * 24} strokeWidth="3" />
                <path d="M37 0H64M53 -11L66 0 53 11M-38 -12H-60M-38 12H-60" />
              </g>
            )}
            {state?.boosted && (
              <g
                transform={`translate(${x} ${y}) rotate(${(Math.atan2(state.vy, state.vx) * 180) / Math.PI})`}
              >
                {[-14, 0, 14].map((offset, i) => (
                  <path
                    key={offset}
                    d={`M-22 ${offset}h-${i === 1 ? 52 : 34}`}
                    stroke="#eaffcd"
                    strokeWidth="6"
                    strokeLinecap="round"
                    opacity=".9"
                  />
                ))}
              </g>
            )}
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
      {eventFlash && (
        <g transform={`translate(95 ${camera + 18})`}>
          <rect
            width="238"
            height="40"
            rx="20"
            fill="#244960"
            stroke="#fff0b0"
            strokeWidth="3"
          />
          <text
            x="119"
            y="26"
            textAnchor="middle"
            fill="white"
            fontSize="15"
            fontWeight="900"
            letterSpacing="1"
          >
            {frame.chaos.title}
          </text>
        </g>
      )}
    </svg>
  );
}
