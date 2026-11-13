import type { Mirror, Puzzle, Trace } from '../shared/puzzle';
import { DX, DY, PALETTE, beamPoints, center } from './theme';

type Props = {
  puzzle: Puzzle;
  mirrors: Mirror[];
  trace: Trace;
  size: number;
  ghost?: Mirror[]; // solution overlay
  hintCell?: number | null;
  celebrate?: boolean;
  onTap?: (cell: number) => void;
};

export const Board = ({ puzzle, mirrors, trace, size, ghost, hintCell, celebrate, onTap }: Props) => {
  const n = puzzle.size;
  const pad = 0.9;
  const walls = new Set(puzzle.walls);
  const lanterns = new Set(puzzle.lanterns);
  const lit = new Set(trace.lit);
  const mir = new Map(mirrors.map((m) => [m.cell, m.kind]));
  const pts = beamPoints(puzzle, trace);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ');
  const em = center(puzzle.emitter.cell, n);
  const ed = puzzle.emitter.dir;
  const ex = em.x - DX[ed]! * 0.95;
  const ey = em.y - DY[ed]! * 0.95;
  const end = trace.end;
  const endPt = pts[pts.length - 1]!;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`}
      style={{ touchAction: 'manipulation', display: 'block' }}
      role="grid"
      aria-label={`${n} by ${n} lantern grid`}
    >
      <defs>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#ffb547" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.09" />
        </filter>
      </defs>

      {/* tiles */}
      {Array.from({ length: n * n }, (_, cell) => {
        const x = cell % n;
        const y = Math.floor(cell / n);
        if (walls.has(cell))
          return (
            <g key={cell}>
              <rect x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.1} fill={PALETTE.wall} />
              <path
                d={`M${x + 0.1} ${y + 0.35}h0.8M${x + 0.1} ${y + 0.65}h0.8M${x + 0.5} ${y + 0.1}v0.25M${x + 0.3} ${y + 0.35}v0.3M${x + 0.7} ${y + 0.35}v0.3M${x + 0.5} ${y + 0.65}v0.25`}
                stroke={PALETTE.wallTop}
                strokeWidth={0.045}
                strokeLinecap="round"
              />
            </g>
          );
        const tappable = !lanterns.has(cell) && !!onTap;
        return (
          <rect
            key={cell}
            x={x + 0.04}
            y={y + 0.04}
            width={0.92}
            height={0.92}
            rx={0.12}
            fill={PALETTE.tile}
            stroke={PALETTE.tileEdge}
            strokeWidth={0.03}
            className={tappable ? 'tile' : undefined}
            onClick={tappable ? () => onTap(cell) : undefined}
            aria-label={tappable ? `tile ${y + 1}, ${x + 1}` : undefined}
          />
        );
      })}

      {/* glow pools under lit lanterns */}
      {puzzle.lanterns.map((cell) =>
        lit.has(cell) ? (
          <circle key={`g${cell}`} cx={center(cell, n).x} cy={center(cell, n).y} r={1.0} fill="url(#glow)" className={celebrate ? 'pulse' : 'glow-in'} pointerEvents="none" />
        ) : null
      )}

      {/* beam */}
      <g pointerEvents="none">
        <path d={d} fill="none" stroke={PALETTE.beam} strokeOpacity={0.35} strokeWidth={0.3} strokeLinejoin="round" strokeLinecap="round" filter="url(#soft)" />
        <path d={d} fill="none" stroke="#fff4d6" strokeWidth={0.07} strokeLinejoin="round" strokeLinecap="round" />
        <path d={d} fill="none" stroke={PALETTE.beam} strokeWidth={0.07} strokeDasharray="0.18 0.32" strokeLinecap="round" className="beam-flow" />
        {end.kind === 'wall' && <circle cx={endPt.x} cy={endPt.y} r={0.12} fill="#ffe7b0" className="spark" />}
      </g>

      {/* ghost solution */}
      {ghost?.map((m) => (
        <MirrorGlyph key={`s${m.cell}`} cell={m.cell} kind={m.kind} n={n} ghost />
      ))}

      {/* mirrors */}
      {mirrors.map((m) => (
        <MirrorGlyph key={`m${m.cell}`} cell={m.cell} kind={m.kind} n={n} />
      ))}

      {/* lanterns */}
      {puzzle.lanterns.map((cell) => {
        const c = center(cell, n);
        const on = lit.has(cell);
        return (
          <g key={`l${cell}`} transform={`translate(${c.x} ${c.y})`} pointerEvents="none">
            <path d="M-0.06 -0.36h0.12v0.07h-0.12z" fill={on ? '#7a4e12' : '#2c2416'} />
            <ellipse cx={0} cy={0.02} rx={0.24} ry={0.3} fill={on ? PALETTE.lit : PALETTE.unlit} stroke={on ? '#fff0c4' : '#7d6538'} strokeWidth={0.03} />
            <path d="M-0.12 -0.24q-0.08 0.26 0 0.52M0.12 -0.24q0.08 0.26 0 0.52M0 -0.28v0.6" stroke={on ? '#d98a1c' : '#3d3220'} strokeWidth={0.025} fill="none" />
            <path d="M-0.1 0.31h0.2v0.06h-0.2z" fill={on ? '#7a4e12' : '#2c2416'} />
          </g>
        );
      })}

      {/* emitter: a little lamp on the wall, facing in */}
      <g transform={`translate(${ex} ${ey}) rotate(${ed * 90})`} pointerEvents="none">
        <circle r={0.42} fill="url(#glow)" />
        <path d="M-0.28 -0.2h0.22l0.18 0.12v0.16l-0.18 0.12h-0.22z" fill="#c9a25a" stroke="#fff0c4" strokeWidth={0.03} />
        <circle cx={0.1} cy={0} r={0.07} fill="#fff4d6" />
      </g>

      {hintCell != null && (
        <rect
          x={(hintCell % n) + 0.04}
          y={Math.floor(hintCell / n) + 0.04}
          width={0.92}
          height={0.92}
          rx={0.12}
          fill="none"
          stroke={PALETTE.beam}
          strokeWidth={0.06}
          className="hint-ring"
          pointerEvents="none"
        />
      )}

      {/* mirror tap targets sit above glyphs so taps reach the tile handler */}
      {onTap &&
        [...mir.keys()].map((cell) => (
          <rect key={`t${cell}`} x={cell % n} y={Math.floor(cell / n)} width={1} height={1} fill="transparent" onClick={() => onTap(cell)} />
        ))}
    </svg>
  );
};

const MirrorGlyph = ({ cell, kind, n, ghost }: { cell: number; kind: '/' | '\\'; n: number; ghost?: boolean }) => {
  const x = cell % n;
  const y = Math.floor(cell / n);
  const [x1, y1, x2, y2] = kind === '/' ? [x + 0.2, y + 0.8, x + 0.8, y + 0.2] : [x + 0.2, y + 0.2, x + 0.8, y + 0.8];
  if (ghost)
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PALETTE.mirror} strokeOpacity={0.45} strokeWidth={0.1} strokeDasharray="0.08 0.08" strokeLinecap="round" pointerEvents="none" />;
  return (
    <g pointerEvents="none" className="pop">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5d6a9c" strokeWidth={0.2} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PALETTE.mirror} strokeWidth={0.11} strokeLinecap="round" />
    </g>
  );
};
