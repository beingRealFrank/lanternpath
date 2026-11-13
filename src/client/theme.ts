import type { Dir, Puzzle, Trace } from '../shared/puzzle';

export const PALETTE = {
  night: '#0b1230',
  tile: '#16224a',
  tileEdge: '#22305f',
  wall: '#070b1d',
  wallTop: '#1b2550',
  beam: '#ffd27a',
  lit: '#ffc55a',
  unlit: '#5b4a2c',
  mirror: '#dfe6ff',
  text: '#f3ead6',
  dim: '#8f9ac2',
};

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export const center = (cell: number, n: number) => ({ x: (cell % n) + 0.5, y: Math.floor(cell / n) + 0.5 });

export const beamPoints = (p: Puzzle, t: Trace): { x: number; y: number }[] => {
  const n = p.size;
  const d0 = p.emitter.dir;
  const s = center(p.emitter.cell, n);
  const pts = [{ x: s.x - DX[d0]! * 0.95, y: s.y - DY[d0]! * 0.95 }];
  for (const step of t.path) pts.push(center(step.cell, n));
  const e = t.end;
  if (e.kind === 'exit') {
    const c = center(e.cell, n);
    pts.push({ x: c.x + DX[e.dir as Dir]! * 1.1, y: c.y + DY[e.dir as Dir]! * 1.1 });
  } else if (e.kind === 'wall') {
    const c = center(e.cell, n);
    pts.push({ x: c.x - DX[e.dir as Dir]! * 0.5, y: c.y - DY[e.dir as Dir]! * 0.5 });
  }
  return pts;
};

