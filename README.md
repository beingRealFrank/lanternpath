# Lanternpath

**Every night, one dark street. One lamp. A handful of mirrors. Light every lantern.**

Lanternpath is a daily puzzle for Reddit, built on Devvit Web as an interactive post.
Every day at 00:05 UTC the app posts a new street, for example
*"Lanternpath #12: light all 5 lanterns on Heron Quay with 4 mirrors."*
Everyone in the community gets the same street, and the race is to light it with the fewest mirrors.

## How to play

1. Open today's Lanternpath post and tap **Light the lamp**.
2. A lamp on the edge of the grid shines a beam straight in. It passes through lanterns
   (lighting them), stops at stone walls, and leaves the grid at the edge.
3. **Tap a tile** to set a mirror `/`. Tap again to flip it to `\`. Tap a third time to take it back.
   The beam re-traces instantly, so you see every change.
4. Light **every** lantern with the beam, using no more mirrors than the day allows
   (the slanted bars at the top right are your mirrors left).
5. When the last lantern lights, the street glows and your result is saved.
   Stuck? **Give up** shows a route that works.

Ranking: solved first, then fewer mirrors, then less time (timed by the server from your first tap).

## Daily loop

- **One shared street per day**, generated from the date. Every puzzle is built backwards from
  a real beam path, so it is always solvable within the mirror budget (unit-tested over 120 days).
- **Weekly rhythm:** Monday is a gentle 6x6 with a spare mirror; mid-week streets are 7x7;
  weekends are 8x8 with six turns.
- **Results card:** solved or not, mirrors used, time and taps, your rank, what share of the
  community lit the street, a chart of how many mirrors solvers needed, the night's top 5,
  your streak, and a countdown to the next street.
- **Share to comments:** one tap posts your result (a row of lanterns, mirrors used, time, rank)
  as a comment from your account. Nothing is posted without that tap.
- Older posts stay playable, each with its own leaderboard.

## For moderators

Install the app on a subreddit. It creates today's post on install and a new one every day at
00:05 UTC. Moderators can also post today's puzzle from the subreddit menu
(**Lanternpath: post today's puzzle**).

## How it is built

- **Devvit Web** interactive post: React 19 + SVG client (`src/client`), Hono server
  (`src/server`), Redis for results, leaderboards, mirror histograms and streaks, the Devvit
  scheduler for the daily post, and user actions (`SUBMIT_COMMENT`) for opt-in sharing.
- **Puzzle engine** (`src/shared/puzzle.ts`) is shared by client and server. **The server
  re-traces the beam from your submitted mirrors** and times the attempt itself, so results
  cannot be forged from the client.
- **Devvit Journeys:** App.Ready on load, Journey.Start on the first mirror, Journey.Progress as
  lanterns light, Journey.End with the result.

```bash
npm install
npm run test:unit   # beam tracing and generator tests
npm run dev         # devvit playtest
npm run deploy      # type-check, lint, devvit upload
```

## AI disclosure

The code, documentation and video for this project were produced by Claude Code AI agents.
The entrant chose and edited the concept, approved the scope and reviewed the submission.
See [AI_USE.md](AI_USE.md).

## License

MIT. See [LICENSE](LICENSE).
