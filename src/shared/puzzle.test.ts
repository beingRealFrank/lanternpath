import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNumber, decodeScore, isSolved, legalMirrors, puzzleForDay, rankScore, reflect, trace, type Puzzle } from './puzzle.ts';

const open: Puzzle = { day: 0, size: 5, name: 'Test', walls: [], lanterns: [], emitter: { cell: 10, dir: 0 }, budget: 2 };

test('day numbering starts at 1 on 2026-11-13 UTC', () => {
  assert.equal(dayNumber(Date.UTC(2026, 10, 13, 1)), 1);
});

test('mirror reflections', () => {
  assert.equal(reflect(0, '/'), 3);
  assert.equal(reflect(0, '\\'), 1);
  assert.equal(reflect(1, '/'), 2);
  assert.equal(reflect(3, '\\'), 2);
});

test('straight beam exits the far side', () => {
  const t = trace(open, []);
  assert.deepEqual(t.path.map((p) => p.cell), [10, 11, 12, 13, 14]);
  assert.equal(t.end.kind, 'exit');
});

test('a mirror bends the beam and lights a lantern', () => {
  const p = { ...open, lanterns: [2] };
  // beam heads east on row 2, mirror at (2,2) "/" turns it north through (1,2) and (0,2)
  const t = trace(p, [{ cell: 12, kind: '/' }]);
  assert.deepEqual(t.path.map((x) => x.cell), [10, 11, 12, 7, 2]);
  assert.deepEqual(t.lit, [2]);
  assert.ok(isSolved(p, [{ cell: 12, kind: '/' }]));
});

test('walls stop the beam; loops are detected', () => {
  assert.equal(trace({ ...open, walls: [12] }, []).end.kind, 'wall');
  const loop = trace({ ...open, emitter: { cell: 7, dir: 0 } }, [
    { cell: 8, kind: '\\' },
    { cell: 18, kind: '/' },
    { cell: 16, kind: '\\' },
    { cell: 6, kind: '/' },
  ]);
  assert.equal(loop.end.kind, 'loop');
});

test('illegal mirror layouts are rejected', () => {
  const p = { ...open, walls: [3], lanterns: [4] };
  assert.equal(legalMirrors(p, [{ cell: 3, kind: '/' }]), false);
  assert.equal(legalMirrors(p, [{ cell: 4, kind: '/' }]), false);
  assert.equal(legalMirrors(p, [{ cell: 1, kind: '/' }, { cell: 1, kind: '\\' }]), false);
  assert.equal(legalMirrors(p, [{ cell: 1, kind: '/' }, { cell: 2, kind: '/' }, { cell: 5, kind: '/' }]), false);
  assert.equal(legalMirrors(p, [{ cell: 1, kind: '/' }]), true);
});

test('120 consecutive days generate, are solvable within budget, and need at least one mirror', () => {
  for (let d = 1; d <= 120; d++) {
    const p = puzzleForDay(d);
    assert.ok(legalMirrors(p, p.solution), `day ${d} legal`);
    assert.ok(isSolved(p, p.solution), `day ${d} solvable`);
    assert.ok(trace(p, []).lit.length < p.lanterns.length, `day ${d} not trivially solved`);
    assert.ok(p.lanterns.length >= 3, `day ${d} lanterns`);
    assert.deepEqual(puzzleForDay(d), p, `day ${d} deterministic`);
  }
});

test('rank score orders solved, fewer mirrors, faster', () => {
  assert.ok(rankScore(true, 3, 500) > rankScore(true, 4, 10));
  assert.ok(rankScore(true, 3, 10) > rankScore(true, 3, 11));
  assert.ok(rankScore(true, 9, 99999) > rankScore(false, 0, 0));
  assert.deepEqual(decodeScore(rankScore(true, 4, 75)), { solved: true, mirrors: 4, seconds: 75 });
});
