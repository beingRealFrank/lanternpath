import './index.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { InitResponse } from '../shared/api';
import { trace } from '../shared/puzzle';
import { Board } from './board';

// Inline feed view: tonight's street in miniature, with the unbent beam escaping.
export const Splash = () => {
  const [data, setData] = useState<InitResponse | null>(null);
  useEffect(() => {
    fetch('/api/init')
      .then((r) => (r.ok ? (r.json() as Promise<InitResponse>) : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);
  const p = data?.puzzle;
  const r = data?.result;
  return (
    <div className="night relative flex flex-col items-center justify-center min-h-screen gap-2 px-4 text-center">
      <div className="text-[11px] tracking-[0.3em] text-[#ffd27a] font-semibold">LANTERNPATH{p ? ` #${p.day}` : ''}</div>
      {p ? (
        <div className="opacity-95">
          <Board puzzle={p} mirrors={r?.solved ? r.mirrors : []} trace={trace(p, r?.solved ? r.mirrors : [])} size={Math.min(170, Math.floor(window.innerHeight * 0.42))} />
        </div>
      ) : (
        <div className="w-[150px] h-[150px] rounded-xl bg-[#16224a] animate-pulse" />
      )}
      <h1 className="font-serif text-xl text-[#f3ead6] leading-tight">
        {p ? (
          <>
            Light all <b>{p.lanterns.length}</b> lanterns on {p.name}
            <br />
            with <b>{p.budget}</b> mirrors.
          </>
        ) : (
          'Lighting the street…'
        )}
      </h1>
      <p className="text-sm text-[#8f9ac2]">
        {r
          ? r.solved
            ? `You lit it with ${r.mirrors.length} mirrors · #${r.rank} of ${r.players}`
            : 'The dark won last time. New street at midnight UTC.'
          : data && data.stats.players > 0
            ? `${data.stats.solved} of ${data.stats.players} have lit the street tonight`
            : 'Bend the light. Fewest mirrors wins.'}
      </p>
      <button
        className="mt-1 h-11 px-8 rounded-full bg-[#ffd27a] text-[#0b1230] font-semibold cursor-pointer"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        {r ? 'See tonight’s results' : 'Light the lamp'}
      </button>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
