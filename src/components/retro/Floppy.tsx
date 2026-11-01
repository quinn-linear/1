import { DISK_NAME } from "@/lib/retro/boot";
import { PALETTE } from "@/lib/retro/palette";

/**
 * A 5.25" floppy disk, drawn from the top with its leading edge (the oval head
 * window) up, so it slides into the drive's slot above it. Original artwork:
 * black sleeve, hub ring, write-protect notch, a hand-lettered paper label.
 * `year` and the disk name are printed on the label.
 */
export function Floppy({ year, className = "" }: { year: number; className?: string }) {
  const font = { fontFamily: "var(--font-vt323), monospace" } as const;
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="fl-sleeve" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a2822" />
          <stop offset="1" stopColor="#100f0b" />
        </linearGradient>
      </defs>
      <rect x={2} y={2} width={196} height={196} rx={7} fill="url(#fl-sleeve)" stroke="#000" strokeWidth={2} />
      <rect x={5} y={5} width={190} height={5} rx={2} fill="#fff" opacity={0.07} />
      {/* Write-protect notch */}
      <rect x={0} y={62} width={7} height={24} fill="#0e0c09" />
      {/* Head window */}
      <rect x={78} y={14} width={44} height={74} rx={22} fill="#050505" stroke="#4a463a" strokeWidth={2} />
      {/* Hub */}
      <circle cx={100} cy={104} r={32} fill="#17150f" stroke="#5a5444" strokeWidth={2} />
      <circle cx={100} cy={104} r={13} fill="#050505" stroke="#7a7360" strokeWidth={1.5} />
      <rect x={96} y={72} width={8} height={4} fill="#050505" />
      {/* Label */}
      <rect x={28} y={142} width={144} height={50} fill="#e8e0c4" />
      <rect x={28} y={142} width={144} height={8} fill={PALETTE.amber} />
      <text x={36} y={168} fontSize={22} fill="#1c1a14" style={font} letterSpacing={1}>
        {DISK_NAME}
      </text>
      <text x={36} y={186} fontSize={18} fill="#3a362a" style={font} letterSpacing={2}>
        {year}  SIDE A
      </text>
      <rect x={146} y={172} width={18} height={14} fill="none" stroke="#1c1a14" strokeWidth={1.5} />
    </svg>
  );
}

/** Front of an external disk drive: a cream box with a slot, a lip and a lamp. `busy` lights the lamp. */
export function DriveFront({ busy, className = "" }: { busy: boolean; className?: string }) {
  const font = { fontFamily: "var(--font-vt323), monospace" } as const;
  return (
    <svg viewBox="0 0 480 170" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="dr-case" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#ece4c8" />
          <stop offset="1" stopColor={PALETTE.caseShade} />
        </linearGradient>
      </defs>
      <rect x={4} y={4} width={472} height={162} rx={14} fill="url(#dr-case)" stroke="#000" strokeOpacity={0.5} strokeWidth={2} />
      <rect x={4} y={150} width={472} height={16} rx={8} fill="#000" opacity={0.15} />
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x={30 + i * 20} y={18} width={11} height={4} rx={2} fill="#7a715a" opacity={0.6} />
      ))}
      <text x={30} y={62} fontSize={22} fill="#5a5340" style={font} letterSpacing={3}>
        DRIVE 8
      </text>
      <text x={30} y={82} fontSize={16} fill="#7a715a" style={font} letterSpacing={2}>
        5.25 INCH  SINGLE SIDED
      </text>
      <circle cx={420} cy={56} r={7} fill={busy ? "#ff6a3d" : "#4a2a20"} stroke="#000" strokeOpacity={0.4} />
      {busy && <circle cx={420} cy={56} r={16} fill="#ff6a3d" opacity={0.22} />}
      <text x={398} y={82} fontSize={14} fill="#7a715a" style={font} letterSpacing={2}>
        BUSY
      </text>
      {/* Slot and lip: the disk disappears behind the lower lip. */}
      <rect x={34} y={102} width={412} height={34} rx={4} fill="#0a0907" />
      <rect x={34} y={102} width={412} height={6} rx={3} fill="#000" />
      <rect x={30} y={134} width={420} height={8} rx={3} fill="#cfc5a6" stroke="#000" strokeOpacity={0.45} />
      <rect x={430} y={96} width={26} height={12} rx={3} fill="#8d836a" stroke="#000" strokeOpacity={0.5} />
    </svg>
  );
}
