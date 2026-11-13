# Judging criteria → features

| Criterion | How Lanternpath meets it | Where |
|---|---|---|
| Delightful UX | One gesture (tap to cycle a mirror); the beam re-traces instantly and lanterns glow as they light; a pulsing tile shows where to start; the street lights up on a solve | `src/client/board.tsx`, `game.tsx` |
| Polish | Night-street identity (deep blue, warm light, paper lanterns, stone walls); fits mobile viewports; server-verified results and server-side timing; unit-tested engine | `src/shared/puzzle.test.ts` |
| Reddit-y | Same street for the whole community each day; "% who lit it" and mirror-count chart; daily top 5; opt-in "Share to comments" fills each day's thread; mod menu action | `src/server/routes/api.ts` |
| Daily Content | New generated street every day, always solvable, with a weekly difficulty rhythm; scheduler posts it at 00:05 UTC; streaks; archive posts stay playable | `devvit.json` scheduler; `puzzle.ts` |
| Stand-out list: Journeys | App.Ready, Journey.Start/Progress/End | `src/server/routes/journey.ts` |
