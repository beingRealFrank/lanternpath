import './index.css';

import { StrictMode, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { showToast } from '@devvit/web/client';
import type { DayStats, InitResponse, PlayerResult, ShareResponse, Streak, SubmitResponse } from '../shared/api';
import { dayStartMs, trace, type Mirror, type Puzzle } from '../shared/puzzle';
import { Board } from './board';
import { PALETTE } from './theme';

type Phase = 'loading' | 'play' | 'solving' | 'done' | 'error';

const useBoardSize = () => {
  const calc = () => Math.floor(Math.min(window.innerWidth - 16, window.innerHeight - 200, 520));
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const on = () => setSize(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return Math.max(240, size);
};

const post = async <T,>(url: string, body: unknown, journeyId?: string): Promise<T> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(journeyId ? { 'x-devvit-journey-id': journeyId } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const App = () => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [init, setInit] = useState<InitResponse | null>(null);
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
  const [moves, setMoves] = useState(0);
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [streak, setStreak] = useState<Streak>({ current: 0, best: 0 });
  const [saved, setSaved] = useState(true);
  const [nudge, setNudge] = useState('');
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const journeyId = useRef('');
  const bestLit = useRef(0);
  const size = useBoardSize();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as InitResponse;
        setInit(data);
        setStats(data.stats);
        setStreak(data.streak);
        if (data.result) {
          setMirrors(data.result.mirrors);
          setResult(data.result);
          setPhase('done');
        } else setPhase('play');
        void post('/api/journey/ready', {}).catch(() => undefined);
      } catch (e) {
        console.error(e);
        setPhase('error');
      }
    })();
  }, []);

  const puzzle: Puzzle | null = init?.puzzle ?? null;
  const beam = useMemo(() => (puzzle ? trace(puzzle, mirrors) : null), [puzzle, mirrors]);
  const total = puzzle?.lanterns.length ?? 0;
  const litCount = beam?.lit.length ?? 0;
  const left = (puzzle?.budget ?? 0) - mirrors.length;

  const finish = useCallback(
    async (finalMirrors: Mirror[], finalMoves: number, gaveUp: boolean) => {
      try {
        const r = await post<SubmitResponse>('/api/submit', { mirrors: finalMirrors, moves: finalMoves, gaveUp }, journeyId.current);
        setResult(r.result);
        setStats(r.stats);
        setStreak(r.streak);
        setSaved(r.saved);
        if (gaveUp) setShowSolution(true);
        setPhase('done');
      } catch (e) {
        console.error(e);
        showToast('Could not save, try again');
        setPhase('play');
      }
    },
    []
  );

  // Journey progress whenever a new lantern lights up.
  useEffect(() => {
    if (phase !== 'play' || !beam || beam.lit.length <= bestLit.current) return;
    bestLit.current = beam.lit.length;
    void post('/api/journey/progress', { progress: (beam.lit.length / total) * 0.9, action: 'lantern_lit' }, journeyId.current).catch(() => undefined);
  }, [beam, phase, total]);

  const tap = (cell: number) => {
    if (phase !== 'play' || !puzzle) return;
    const existing = mirrors.find((m) => m.cell === cell);
    let next: Mirror[];
    if (!existing) {
      if (left <= 0) {
        setNudge('Out of mirrors. Tap a mirror to flip it or take it back.');
        return;
      }
      next = [...mirrors, { cell, kind: '/' }];
    } else if (existing.kind === '/') next = mirrors.map((m) => (m.cell === cell ? { cell, kind: '\\' } : m));
    else next = mirrors.filter((m) => m.cell !== cell);
    setNudge('');
    setConfirmGiveUp(false);
    setMirrors(next);
    setMoves(moves + 1);
    // Auto-finish when every lantern is lit.
    if (trace(puzzle, next).lit.length === puzzle.lanterns.length) {
      setPhase('solving');
      setTimeout(() => void finish(next, moves + 1, false), 1100);
    }
    if (moves === 0) {
      void post('/api/begin', {}).catch(() => undefined);
      void (async () => {
        const r = await post<{ journeyId: string }>('/api/journey/start', {}).catch(() => ({ journeyId: '' }));
        journeyId.current = r.journeyId;
      })();
    }
  };

  if (phase === 'loading') return <Shell><p className="text-[#8f9ac2] animate-pulse mt-24">Lighting the lamp…</p></Shell>;
  if (phase === 'error' || !puzzle || !init || !beam)
    return <Shell><p className="text-[#8f9ac2] mt-24">Couldn’t load tonight’s street. Pull to refresh.</p></Shell>;

  // First-time hint: point at a tile in the light's path.
  const hintCell =
    phase === 'play' && moves === 0
      ? (beam.path.map((s) => s.cell).find((c, i) => i >= 1 && !puzzle.lanterns.includes(c)) ?? null)
      : null;
  const hint =
    nudge ||
    (moves === 0
      ? 'Tap a tile in the light’s path to set a mirror.'
      : mirrors.length === 1 && moves <= 2
        ? 'Tap it again to flip it. Tap once more to take it back.'
        : `${litCount} of ${total} lanterns lit · ${left} mirror${left === 1 ? '' : 's'} left`);

  const done = phase === 'done' && result;

  return (
    <Shell>
      <header className="w-full max-w-[520px] flex items-end justify-between px-1">
        <div>
          <div className="text-[11px] tracking-[0.25em] text-[#ffd27a] font-semibold">LANTERNPATH #{puzzle.day}</div>
          <h1 className="font-serif text-2xl leading-tight text-[#f3ead6]">{puzzle.name}</h1>
        </div>
        <div className="text-right text-xs text-[#8f9ac2] leading-snug">
          <div>
            <b className="text-[#ffd27a] text-base">{litCount}</b>/{total} lanterns
          </div>
          <div className="flex gap-[3px] justify-end mt-1" aria-label={`${left} mirrors left`}>
            {Array.from({ length: puzzle.budget }, (_, i) => (
              <span key={i} className={`inline-block w-[7px] h-[14px] rounded-sm -skew-x-[30deg] ${i < left ? 'bg-[#dfe6ff]' : 'bg-[#2a3768]'}`} />
            ))}
          </div>
        </div>
      </header>

      <div className="mt-1">
        <Board
          puzzle={puzzle}
          mirrors={mirrors}
          trace={beam}
          size={size}
          hintCell={hintCell}
          celebrate={phase === 'solving' || (!!done && result.solved)}
          {...(showSolution && result?.solution ? { ghost: result.solution.filter((s) => !mirrors.some((m) => m.cell === s.cell && m.kind === s.kind)) } : {})}
          {...(phase === 'play' ? { onTap: tap } : {})}
        />
      </div>

      {phase === 'play' && (
        <>
          <p className="mt-1 text-sm text-[#c6cbe0] min-h-[1.25rem] text-center px-4">{hint}</p>
          <div className="mt-2 flex gap-3">
            <button
              className="h-10 px-5 rounded-full border border-[#2a3768] text-[#c6cbe0] disabled:opacity-30"
              disabled={mirrors.length === 0}
              onClick={() => {
                setMirrors([]);
                setMoves((m) => m + 1);
                setNudge('');
              }}
            >
              Clear
            </button>
            <button
              className={`h-10 px-5 rounded-full border ${confirmGiveUp ? 'border-[#ff8a6a] text-[#ff8a6a]' : 'border-[#2a3768] text-[#8f9ac2]'}`}
              onClick={() => {
                if (!confirmGiveUp) return setConfirmGiveUp(true);
                void finish(mirrors.slice(0, puzzle.budget), moves, true);
              }}
            >
              {confirmGiveUp ? 'Tap again to give up' : 'Give up'}
            </button>
          </div>
        </>
      )}
      {phase === 'solving' && <p className="mt-2 text-lg font-serif text-[#ffd27a] fade-in">The whole street is lit.</p>}

      {done && stats && (
        <ResultCard
          puzzle={puzzle}
          result={result}
          stats={stats}
          streak={streak}
          saved={saved}
          today={init.today}
          showSolution={showSolution}
          onToggleSolution={() => setShowSolution((s) => !s)}
          onShare={async () => {
            const r = await post<ShareResponse>('/api/share', {}).catch(() => ({ ok: false, message: 'Could not post comment' }));
            showToast(r.message);
          }}
        />
      )}
    </Shell>
  );
};

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen w-full flex flex-col items-center justify-start pt-3 pb-6 px-2 select-none night">{children}</div>
);

const Countdown = ({ today }: { today: number }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, dayStartMs(today + 1) - now);
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  return <span className="font-mono">{`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`}</span>;
};

const ResultCard = (props: {
  puzzle: Puzzle;
  result: PlayerResult;
  stats: DayStats;
  streak: Streak;
  saved: boolean;
  today: number;
  showSolution: boolean;
  onToggleSolution: () => void;
  onShare: () => void;
}) => {
  const { puzzle, result, stats, streak, saved, today } = props;
  const solvedPct = stats.players ? Math.round((stats.solved / stats.players) * 100) : 0;
  const counts = Array.from({ length: puzzle.budget }, (_, i) => stats.mirrorHist[String(i + 1)] ?? 0);
  const max = Math.max(1, ...counts);
  return (
    <section className="mt-3 w-full max-w-[520px] rounded-2xl bg-[#121a3d] border border-[#1f2b5a] p-4 text-[#f3ead6] fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-2xl leading-tight">{result.solved ? `All ${puzzle.lanterns.length} lanterns lit` : 'The dark won tonight'}</div>
          <div className="text-sm text-[#ffd27a] mt-1">
            {result.solved ? (
              <>
                {result.mirrors.length} of {puzzle.budget} mirrors{result.seconds > 0 ? ` · ${clock(result.seconds)}` : ''} · {result.moves} taps
              </>
            ) : (
              'Come back tomorrow for a new street.'
            )}
          </div>
        </div>
        <div className="text-right text-sm text-[#8f9ac2] shrink-0">
          {saved && result.rank > 0 ? (
            <div>
              <b className="text-[#f3ead6]">#{result.rank}</b> of {result.players}
            </div>
          ) : !saved ? (
            <div>Log in to rank</div>
          ) : null}
          {streak.current > 0 && <div className="text-[#ffd27a]">🏮 {streak.current}-night streak</div>}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] tracking-widest text-[#6c77a3] mb-1">
          {solvedPct}% OF {stats.players} LIT IT · MIRRORS USED
        </div>
        <div className="flex items-end gap-1 h-14">
          {counts.map((c, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${Math.max(5, (c / max) * 100)}%`,
                  background: result.solved && result.mirrors.length === i + 1 ? PALETTE.beam : '#2a3768',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 text-[10px] text-[#6c77a3] mt-1 font-mono">
          {counts.map((_, i) => (
            <span key={i} className="flex-1 text-center">
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      {stats.top.length > 0 && (
        <ol className="mt-3 text-sm space-y-1">
          {stats.top.slice(0, 5).map((t, i) => (
            <li key={t.name} className="flex justify-between">
              <span className="text-[#c6cbe0]">
                {i + 1}. u/{t.name}
              </span>
              <span className="font-mono text-[#f3ead6]">
                {t.mirrors} <span className="inline-block w-[5px] h-[11px] rounded-sm -skew-x-[30deg] bg-[#dfe6ff] mr-2" /> {clock(t.seconds)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {saved && (
            <button className="h-10 px-4 rounded-full bg-[#ffd27a] text-[#0b1230] font-semibold whitespace-nowrap" onClick={props.onShare}>
              Share to comments
            </button>
          )}
          {result.solution && (
            <button className="h-10 px-4 rounded-full border border-[#2a3768] text-[#c6cbe0] whitespace-nowrap" onClick={props.onToggleSolution}>
              {props.showSolution ? 'Hide' : 'Show'} a route
            </button>
          )}
        </div>
        <div className="text-xs text-[#8f9ac2]">
          {puzzle.day === today ? (
            <>
              Next street in <Countdown today={today} />
            </>
          ) : (
            <>Tonight’s puzzle is #{today}</>
          )}
        </div>
      </div>
    </section>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
