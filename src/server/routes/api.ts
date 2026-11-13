import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { ErrorResponse, InitResponse, ShareResponse, SubmitRequest, SubmitResponse } from '../../shared/api';
import { dayNumber, isSolved, legalMirrors, publicPuzzle, puzzleForDay } from '../../shared/puzzle';
import { dayForPost } from '../core/post';
import { endJourney } from './journey';
import { bumpStreak, elapsedSeconds, getResult, getStats, getStreak, markStart, recordPlay } from '../core/scores';

export const api = new Hono();

const err = (message: string) => ({ status: 'error', message }) satisfies ErrorResponse;

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(err('postId missing'), 400);
  const today = dayNumber(Date.now());
  const day = await dayForPost(postId);
  const username = (await reddit.getCurrentUsername()) ?? null;
  const [result, stats, streak] = await Promise.all([
    username ? getResult(day, username) : Promise.resolve(null),
    getStats(day),
    username ? getStreak(username, today) : Promise.resolve({ current: 0, best: 0 }),
  ]);
  return c.json<InitResponse>({ type: 'init', postId, username, puzzle: publicPuzzle(puzzleForDay(day)), today, result, stats, streak });
});

api.post('/begin', async (c) => {
  const { postId } = context;
  const username = await reddit.getCurrentUsername();
  if (postId && username) await markStart(await dayForPost(postId), username);
  return c.json({ ok: true });
});

api.post('/submit', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(err('postId missing'), 400);
  const body = await c.req.json<SubmitRequest>();
  const day = await dayForPost(postId);
  const puzzle = puzzleForDay(day);
  const mirrors = Array.isArray(body.mirrors) ? body.mirrors.map((m) => ({ cell: Number(m.cell), kind: m.kind })) : [];
  if (!legalMirrors(puzzle, mirrors)) return c.json(err('Invalid mirror layout'), 400);
  const solved = !body.gaveUp && isSolved(puzzle, mirrors);
  if (!solved && !body.gaveUp) return c.json(err('Not every lantern is lit yet'), 400);
  const moves = Math.max(0, Math.min(9999, Math.round(Number(body.moves) || 0)));
  const username = await reddit.getCurrentUsername();
  const today = dayNumber(Date.now());
  if (!username) {
    const stats = await getStats(day);
    return c.json<SubmitResponse>({
      type: 'submit',
      result: { solved, mirrors, seconds: 0, moves, rank: 0, players: stats.players, solution: puzzle.solution },
      stats,
      streak: { current: 0, best: 0 },
      saved: false,
    });
  }
  const seconds = await elapsedSeconds(day, username);
  const { result, fresh } = await recordPlay(day, username, { solved, mirrors, seconds, moves });
  if (fresh) await endJourney(c.req.header('x-devvit-journey-id') ?? '', solved ? mirrors.length : 0, solved);
  const streak = day === today && result.solved ? await bumpStreak(username, today) : await getStreak(username, today);
  return c.json<SubmitResponse>({ type: 'submit', result, stats: await getStats(day), streak, saved: true });
});

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

api.post('/share', async (c) => {
  const { postId } = context;
  const username = await reddit.getCurrentUsername();
  if (!postId || !username) return c.json<ShareResponse>({ type: 'share', ok: false, message: 'Log in to share' });
  const day = await dayForPost(postId);
  const result = await getResult(day, username);
  if (!result) return c.json<ShareResponse>({ type: 'share', ok: false, message: 'Play first' });
  const p = puzzleForDay(day);
  const lamps = result.solved ? '🏮'.repeat(p.lanterns.length) : '🌑'.repeat(p.lanterns.length);
  const text = result.solved
    ? `Lanternpath #${day} · ${p.name}\n\n${lamps}\n\nLit with **${result.mirrors.length}/${p.budget} mirrors** in ${clock(result.seconds)} · #${result.rank} of ${result.players}`
    : `Lanternpath #${day} · ${p.name}\n\n${lamps}\n\nThe dark won today.`;
  try {
    await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    return c.json<ShareResponse>({ type: 'share', ok: true, message: 'Result posted' });
  } catch (e) {
    console.error('share failed', e);
    return c.json<ShareResponse>({ type: 'share', ok: false, message: 'Could not post comment' });
  }
});
