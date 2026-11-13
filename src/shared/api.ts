import type { Mirror, Puzzle } from './puzzle';

export type PlayerResult = {
  solved: boolean;
  mirrors: Mirror[];
  seconds: number;
  moves: number;
  rank: number; // 1 = best; 0 when unranked
  players: number;
  solution: Mirror[] | null; // revealed once you have finished
};

export type Streak = { current: number; best: number };

export type DayStats = {
  players: number;
  solved: number;
  mirrorHist: Record<string, number>; // mirrors used -> solvers
  top: { name: string; mirrors: number; seconds: number }[];
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string | null;
  puzzle: Puzzle;
  today: number;
  result: PlayerResult | null;
  stats: DayStats;
  streak: Streak;
};

export type SubmitRequest = { mirrors: Mirror[]; moves: number; gaveUp: boolean };

export type SubmitResponse = {
  type: 'submit';
  result: PlayerResult;
  stats: DayStats;
  streak: Streak;
  saved: boolean;
};

export type ShareResponse = { type: 'share'; ok: boolean; message: string };
export type ErrorResponse = { status: 'error'; message: string };
