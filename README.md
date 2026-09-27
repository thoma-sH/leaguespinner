# The Grand Line Draft

A spinning-wheel team randomiser for League customs. Put 4–16 players in, spin, and
it splits them into blue side and red side with random lanes.

**Live: <https://thoma-sh.github.io/leaguespinner/>**

## Using it

Everything is on one screen and it starts empty. The player list sits directly under
the title, so you never scroll to add anyone. Type or paste names, then spin until
both sides are full.

- `Space`, the Spin button, or a click on the wheel turns it
- **Split evenly** halves the roster; a fixed size (2v2–5v5) sends whoever is left
  over to Spectating, drafted last
- The first pick on each side is marked `C`
- **Copy teams** puts a clean block on the clipboard, ready to paste in Discord
- Editing the roster restarts the draft

Roster, team size, lanes and sound are remembered per browser, so it is only empty
the first time.

## Running it

Static site, no build step, no dependencies. Open `index.html`.

Sound is synthesised with the Web Audio API — no audio files — and unlocks on your
first click, per browser autoplay rules.

## Deploying

It is already live on GitHub Pages from `main`, and every push republishes it.

A plain static site, so Vercel works too, with no build step and no framework preset.

**Dashboard (recommended — every push to `main` redeploys):**

1. Go to <https://vercel.com/new>
2. Import `thoma-sH/leaguespinner`
3. Leave every default alone — no framework, no build command, no output directory
4. Deploy

**Or from the terminal:**

```sh
npx vercel@latest login
npx vercel@latest --prod
```

`vercel.json` turns on `cleanUrls` and sends `Cache-Control: max-age=0,
must-revalidate`, so a push shows up on the live site immediately instead of
sitting behind a stale cache.

## Files

| File | What lives there |
| --- | --- |
| `index.html` | The whole page. One screen, no routing |
| `styles.css` | Tokens at the top of `:root`, then components |
| `wheel.js` | The wheel (canvas) and the confetti |
| `audio.js` | Synthesised ticks, whoosh, impact, horn, spin drone |
| `app.js` | State, draft order, lanes, clipboard export |

## How the draft works

Slots alternate between sides, so neither can be handed the whole pool. Odd rosters
give blue side the extra player. When one player is left for one slot it skips the
spin — there is no suspense in a one-wedge wheel.

Fan-made. Not affiliated with Riot Games.
