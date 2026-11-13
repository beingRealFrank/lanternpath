import { redis } from '@devvit/web/server';
import type { DayStats, PlayerResult, Streak } from '../../shared/api';
import { decodeScore, puzzleForDay, rankScore, type Mirror } from '../../shared/puzzle';

const k = {
  scores: (d: number) => `day:${d}:scores`,
  hist: (d: number) => `day:${d}:mirrorhist`,
  solved: (d: number) => `day:${d}:solved`,
  play: (d: number, u: string) => `day:${d}:play:${u}`,
  start: (d: number, u: string) => `day:${d}:start:${u}`,
  streak: (u: string) => `user:${u}:streak`,
};

type Stored = { solved: boolean; mirrors: Mirror[]; seconds: number; moves: number };

export const getStats = async (day: number): Promise<DayStats> => {
  const [players, hist, solved, top] = await Promise.all([
    redis.zCard(k.scores(day)),
    redis.hGetAll(k.hist(day)),
    redis.get(k.solved(day)),
    redis.zRange(k.scores(day), 0, 9, { by: 'rank', reverse: true }),
  ]);
  const mirrorHist: Record<string, number> = {};
  for (const [m, n] of Object.entries(hist)) mirrorHist[m] = Number(n);
  return {
    players,
    solved: Number(solved ?? 0),
    mirrorHist,
    top: top
      .map((m) => ({ name: m.member, ...decodeScore(m.score) }))
      .filter((t) => t.solved)
      .map(({ name, mirrors, seconds }) => ({ name, mirrors, seconds })),
  };
};

const standing = async (day: number, user: string, solved: boolean) => {
  const [players, asc] = await Promise.all([redis.zCard(k.scores(day)), redis.zRank(k.scores(day), user)]);
  return { players, rank: solved ? players - (asc ?? 0) : 0 };
};

export const getResult = async (day: number, user: string): Promise<PlayerResult | null> => {
  const raw = await redis.get(k.play(day, user));
  if (!raw) return null;
  const s = JSON.parse(raw) as Stored;
  return { ...s, ...(await standing(day, user, s.solved)), solution: puzzleForDay(day).solution };
};

// Server-side clock: the first committed move starts the timer.
export const markStart = async (day: number, user: string) => {
  if (!(await redis.get(k.start(day, user)))) await redis.set(k.start(day, user), String(Date.now()));
};

export const elapsedSeconds = async (day: number, user: string): Promise<number> => {
  const s = await redis.get(k.start(day, user));
  return s ? Math.max(1, Math.round((Date.now() - Number(s)) / 1000)) : 0;
};

export const recordPlay = async (day: number, user: string, s: Stored): Promise<{ result: PlayerResult; fresh: boolean }> => {
  const existing = await getResult(day, user);
  if (existing) return { result: existing, fresh: false };
  await redis.set(k.play(day, user), JSON.stringify({ ...s, at: Date.now() }));
  await redis.zAdd(k.scores(day), { member: user, score: rankScore(s.solved, s.mirrors.length, s.seconds) });
  if (s.solved) {
    await redis.incrBy(k.solved(day), 1);
    await redis.hIncrBy(k.hist(day), String(s.mirrors.length), 1);
  }
  return {
    result: { ...s, ...(await standing(day, user, s.solved)), solution: puzzleForDay(day).solution },
    fresh: true,
  };
};

export const getStreak = async (user: string, today: number): Promise<Streak> => {
  const s = await redis.hGetAll(k.streak(user));
  const last = Number(s.last ?? 0);
  const current = last >= today - 1 ? Number(s.current ?? 0) : 0;
  return { current, best: Number(s.best ?? 0) };
};

export const bumpStreak = async (user: string, today: number): Promise<Streak> => {
  const s = await redis.hGetAll(k.streak(user));
  const last = Number(s.last ?? 0);
  if (last === today) return { current: Number(s.current ?? 1), best: Number(s.best ?? 1) };
  const current = last === today - 1 ? Number(s.current ?? 0) + 1 : 1;
  const best = Math.max(current, Number(s.best ?? 0));
  await redis.hSet(k.streak(user), { last: String(today), current: String(current), best: String(best) });
  return { current, best };
};
