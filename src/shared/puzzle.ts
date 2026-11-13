// Lanternpath: daily mirror puzzle. Pure functions shared by client and server.

export type Dir = 0 | 1 | 2 | 3; // 0 = east, 1 = south, 2 = west, 3 = north
export type MirrorKind = '/' | '\\';
export type Mirror = { cell: number; kind: MirrorKind };

export type Puzzle = {
  day: number;
  size: number;
  name: string;
  walls: number[];
  lanterns: number[];
  emitter: { cell: number; dir: Dir }; // first cell the beam enters, and its heading
  budget: number;
};

export type GeneratedPuzzle = Puzzle & { solution: Mirror[] };

export type Trace = {
  path: { cell: number; dir: Dir }[]; // cells the beam passes through, in order
  lit: number[]; // lantern cells reached
  end: { kind: 'exit' | 'wall' | 'loop'; cell: number; dir: Dir };
};

// Day 1 is 2026-11-13 (UTC), the same calendar as Shardline.
const EPOCH_UTC = Date.UTC(2026, 10, 13);
const DAY_MS = 86_400_000;
export const dayNumber = (now: number): number => Math.floor((now - EPOCH_UTC) / DAY_MS) + 1;
export const dayStartMs = (day: number): number => EPOCH_UTC + (day - 1) * DAY_MS;

export const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const DR = [0, 1, 0, -1];
const DC = [1, 0, -1, 0];

// '/' : east->north, north->east, west->south, south->west
// '\' : east->south, south->east, west->north, north->west
export const reflect = (d: Dir, kind: MirrorKind): Dir =>
  (kind === '/' ? [3, 2, 1, 0][d] : [1, 0, 3, 2][d]) as Dir;

export const trace = (p: Puzzle, mirrors: Mirror[]): Trace => {
  const n = p.size;
  const walls = new Set(p.walls);
  const lanterns = new Set(p.lanterns);
  const mir = new Map(mirrors.map((m) => [m.cell, m.kind]));
  const seen = new Set<number>();
  const lit = new Set<number>();
  const path: Trace['path'] = [];
  let cell = p.emitter.cell;
  let dir: Dir = p.emitter.dir;
  for (;;) {
    if (walls.has(cell)) return { path, lit: [...lit], end: { kind: 'wall', cell, dir } };
    const state = cell * 4 + dir;
    if (seen.has(state)) return { path, lit: [...lit], end: { kind: 'loop', cell, dir } };
    seen.add(state);
    const m = mir.get(cell);
    if (m) dir = reflect(dir, m);
    path.push({ cell, dir });
    if (lanterns.has(cell)) lit.add(cell);
    const r = Math.floor(cell / n) + DR[dir]!;
    const c = (cell % n) + DC[dir]!;
    if (r < 0 || r >= n || c < 0 || c >= n) return { path, lit: [...lit], end: { kind: 'exit', cell, dir } };
    cell = r * n + c;
  }
};

export const isSolved = (p: Puzzle, mirrors: Mirror[]): boolean =>
  mirrors.length <= p.budget && trace(p, mirrors).lit.length === p.lanterns.length;

// A mirror layout is legal if every mirror sits on a distinct empty tile.
export const legalMirrors = (p: Puzzle, mirrors: Mirror[]): boolean => {
  const blocked = new Set([...p.walls, ...p.lanterns]);
  const cells = new Set<number>();
  for (const m of mirrors) {
    if (!Number.isInteger(m.cell) || m.cell < 0 || m.cell >= p.size * p.size) return false;
    if (m.kind !== '/' && m.kind !== '\\') return false;
    if (blocked.has(m.cell) || cells.has(m.cell)) return false;
    cells.add(m.cell);
  }
  return mirrors.length <= p.budget;
};

// Weekly rhythm by UTC weekday (0 = Sunday): grid size, turns, spare mirrors.
const RHYTHM = [
  { size: 8, turns: 6, spare: 0 }, // Sun
  { size: 6, turns: 3, spare: 1 }, // Mon
  { size: 6, turns: 4, spare: 0 }, // Tue
  { size: 7, turns: 4, spare: 0 }, // Wed
  { size: 7, turns: 5, spare: 0 }, // Thu
  { size: 7, turns: 5, spare: 0 }, // Fri
  { size: 8, turns: 6, spare: 0 }, // Sat
];

const PLACES = ['Willow Lane', 'Harbor Steps', 'Moss Court', 'Old Mill', 'Crane Alley', 'Fox Hollow', 'Bell Yard', 'Ferry Row', 'Lamplight Square', 'Cobble Bend', 'Orchard Gate', 'Heron Quay', 'Tinker Street', 'Ash Market', 'Saltmarsh', 'Owl Bridge'];

export const weekdayOf = (day: number) => new Date(dayStartMs(day)).getUTCDay();

export const puzzleForDay = (day: number): GeneratedPuzzle => {
  const { size, turns, spare } = RHYTHM[weekdayOf(day)]!;
  const r = rng(day * 104729 + 7);
  const name = PLACES[Math.floor(r() * PLACES.length)]!;
  for (let attempt = 0; attempt < 500; attempt++) {
    const g = tryGenerate(r, size, turns);
    if (!g) continue;
    const p: GeneratedPuzzle = { day, size, name, ...g, budget: g.solution.length + spare };
    if (isSolved(p, p.solution) && trace(p, []).lit.length < p.lanterns.length) return p;
  }
  throw new Error(`no puzzle for day ${day}`);
};

const tryGenerate = (r: () => number, n: number, turns: number) => {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
  // Emitter on a random edge, beam heading inward.
  const side = Math.floor(r() * 4) as Dir; // the heading
  const k = 1 + Math.floor(r() * (n - 2));
  const start = side === 0 ? k * n : side === 2 ? k * n + n - 1 : side === 1 ? k : (n - 1) * n + k;
  const mirrorCells = new Map<number, MirrorKind>();
  const pathCells = new Set<number>();
  const segments: number[][] = [];
  let cell = start;
  let dir: Dir = side;
  for (let t = 0; t <= turns; t++) {
    const seg: number[] = [];
    // Collect the run of cells ahead (including the current cell).
    const run: number[] = [];
    let cr = Math.floor(cell / n);
    let cc = cell % n;
    for (;;) {
      const here = cr * n + cc;
      if (mirrorCells.has(here)) break;
      run.push(here);
      cr += DR[dir]!;
      cc += DC[dir]!;
      if (cr < 0 || cr >= n || cc < 0 || cc >= n) break;
    }
    if (t === turns) {
      // Final leg must run cleanly out of the grid.
      const last = run[run.length - 1]!;
      const lr = Math.floor(last / n) + DR[dir]!;
      const lc = (last % n) + DC[dir]!;
      if (lr >= 0 && lr < n && lc >= 0 && lc < n) return null;
      run.forEach((c) => {
        seg.push(c);
        pathCells.add(c);
      });
      segments.push(seg);
      break;
    }
    // Choose where to turn: not the first cell of a leg after a mirror (that is the mirror itself),
    // not on an earlier path cell (it would change the earlier leg).
    const options = run.map((c, i) => ({ c, i })).filter(({ c, i }) => i >= 1 && !pathCells.has(c));
    if (!options.length) return null;
    const { c: turnCell, i } = pick(options);
    run.slice(0, i).forEach((c) => {
      seg.push(c);
      pathCells.add(c);
    });
    const newDir = ((dir + (r() < 0.5 ? 1 : 3)) % 4) as Dir;
    const kind: MirrorKind = reflect(dir, '/') === newDir ? '/' : '\\';
    mirrorCells.set(turnCell, kind);
    pathCells.add(turnCell);
    segments.push(seg);
    cell = turnCell;
    dir = newDir;
    // Step off the mirror cell for the next leg.
    const nr = Math.floor(cell / n) + DR[dir]!;
    const nc = (cell % n) + DC[dir]!;
    if (nr < 0 || nr >= n || nc < 0 || nc >= n) return null;
    cell = nr * n + nc;
  }
  // A lantern on every leg after a turn makes every mirror necessary; one more on the first leg sometimes.
  const lanterns: number[] = [];
  segments.forEach((seg, i) => {
    const free = seg.filter((c) => !mirrorCells.has(c) && countOnPath(c, segments) === 1);
    if (i === 0 && r() < 0.5) return;
    if (!free.length) return;
    lanterns.push(pick(free));
  });
  if (lanterns.length < Math.min(3, turns)) return null;
  // Walls off the path, about 22% of the free tiles.
  const walls: number[] = [];
  for (let c = 0; c < n * n; c++) {
    if (pathCells.has(c) || c === start) continue;
    if (r() < 0.22) walls.push(c);
  }
  return {
    walls,
    lanterns,
    emitter: { cell: start, dir: side },
    solution: [...mirrorCells].map(([cell, kind]) => ({ cell, kind })),
  };
};

const countOnPath = (c: number, segments: number[][]) => segments.reduce((a, s) => a + s.filter((x) => x === c).length, 0);

// Public view: no solution.
export const publicPuzzle = (p: GeneratedPuzzle): Puzzle => {
  const { solution: _solution, ...rest } = p;
  return rest;
};

// Ranking: solved beats unsolved, then fewer mirrors, then less time.
export const rankScore = (solved: boolean, mirrors: number, seconds: number): number =>
  solved ? (50 - mirrors) * 100_000 + (99_999 - Math.min(99_999, Math.round(seconds))) : 0;

export const decodeScore = (s: number) =>
  s <= 0 ? { solved: false, mirrors: 0, seconds: 0 } : { solved: true, mirrors: 50 - Math.floor(s / 100_000), seconds: 99_999 - (s % 100_000) };
