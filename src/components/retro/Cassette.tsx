import { TAPE_NAME } from "@/lib/retro/cassette";
import { PALETTE } from "@/lib/retro/palette";

/**
 * A compact cassette tape, drawn from the front: graphite shell, a paper label
 * with a hand-lettered title, and a window onto two reels. Original artwork,
 * decorative (the control that carries it has the accessible name).
 */
export function Cassette({ year, className = "" }: { year: number; className?: string }) {
  const font = { fontFamily: "var(--font-vt323), monospace" } as const;
  const spokes = [0, 60, 120, 180, 240, 300];
  const reel = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy={96} r={13} fill="#17161e" stroke="#8d88a8" strokeWidth={1.5} />
      {spokes.map((a) => (
        <rect key={a} x={cx - 1} y={96 - 12} width={2} height={6} fill="#cfcbe6" transform={`rotate(${a} ${cx} 96)`} />
      ))}
      <circle cx={cx} cy={96} r={4} fill="#050408" />
    </g>
  );
  return (
    <svg viewBox="0 0 200 130" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="cs-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#363444" />
          <stop offset="1" stopColor="#1a1923" />
        </linearGradient>
      </defs>
      <rect x={2} y={2} width={196} height={126} rx={10} fill="url(#cs-shell)" stroke="#000" strokeWidth={2} />
      <rect x={6} y={5} width={188} height={4} rx={2} fill="#fff" opacity={0.08} />
      {/* Label */}
      <rect x={16} y={12} width={168} height={62} rx={4} fill="#e8e0c4" />
      <rect x={16} y={12} width={168} height={9} rx={2} fill={PALETTE.amber} />
      <text x={24} y={44} fontSize={21} fill="#1c1a14" style={font} letterSpacing={1}>
        {TAPE_NAME}
      </text>
      <text x={24} y={62} fontSize={17} fill="#3a362a" style={font} letterSpacing={2}>
        {year}  SIDE A
      </text>
      <line x1={118} y1={62} x2={172} y2={62} stroke="#1c1a14" strokeWidth={1} opacity={0.5} />
      {/* Tape window and reels */}
      <rect x={42} y={78} width={116} height={36} rx={18} fill="#0b0a10" stroke="#4a4760" strokeWidth={1.5} />
      <rect x={72} y={104} width={56} height={5} fill="#3a2b22" />
      {reel(72)}
      {reel(128)}
      {/* Base and screws */}
      <path d="M30 128 L42 114 H158 L170 128 Z" fill="#14131a" stroke="#000" strokeWidth={1} />
      {[12, 188].flatMap((x) => [12, 118].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill="#0c0b11" stroke="#6b6783" strokeWidth={1} />))}
    </svg>
  );
}
