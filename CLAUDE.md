# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dobble Mint is a static, dependency-free single page (`index.html`) that designs Spot It (Dobble)
cards, exports them to PDF, and plays the game with them. There is no build step,
package manager, or linter. External runtime dependencies are jsPDF, loaded from a CDN
`<script>` tag (with SRI) in `index.html`, and Google Fonts, imported in `css/style.css`. Published via GitHub Pages at
https://hrpatel.github.io/dobble-mint/.

## Commands

- Run: open `index.html` directly, or serve the folder (e.g. `python3 -m http.server`).
- Unit tests (Node's built-in runner, no install): `node --test "tests/*.test.js"`
- Single test: `node --test --test-name-pattern="locks only" "tests/*.test.js"`

Tests cover `deck.js` (parse, serialize, `themeFor`), `game.js`, and OpenMoji coverage of the
themes; `math.js` and `symbols.js` are exercised through them. The DOM modules are checked by hand in a browser.
`tests/load.js` runs the browser scripts in a shared `vm` context; wrap values from it in
`plain()` before `deepStrictEqual`, since VM-realm arrays fail cross-realm prototype checks.

## Architecture

Each file in `js/` is a classic script exposing one global IIFE module. No ES modules, so
**load order matters**: `math.js` → `openmoji.js` → `symbols.js` → `renderer.js` → `deck.js` → `pdf.js` →
`game.js` → `stats.js` → `play.js` → `app.js` (last: it initializes `SpotItPlay` and routes).

- `SpotItMath` (`math.js`): builds the finite projective plane PG(2,n) for prime n. Points
  become symbols and lines become cards, so any two cards share exactly one symbol. Cards are
  arrays of symbol indices. Also provides `verify()` and the seeded `makePRNG()` (mulberry32).
  Only prime orders work; prime powers (4, 8, 9) would need GF(p^k) arithmetic.
- `SpotItOpenMoji` and `SpotItOpenMojiThemes` (`openmoji.js`): generated, do not edit. The
  themes are five OpenMoji groups (Animals & Nature, Flags, Food & Drink, Symbols, Objects,
  skin-tone variants excluded) as glyph lists, plus a `Map` from glyph to OpenMoji SVG markup
  (72×72 viewBox, ids stripped, allowlisted elements only). Theme groups are defined in
  `scripts/build-openmoji.js`; regenerate with `node scripts/build-openmoji.js` (pinned to
  openmoji@17.0.0). The artwork is CC BY-SA 4.0: keep the credit in the panel and under the
  last PDF card.
- `SpotItSymbols` (`symbols.js`): builds themes from `SpotItOpenMojiThemes` and picks shuffled
  symbols. A theme must hold at least n²+n+1 glyphs to be usable at order n, so Food & Drink
  (131) is too small for order 11 (133).
- `SpotItRenderer` (`renderer.js`): builds one SVG per card (fixed `CARD_SIZE` viewBox) with a
  shape clip path and a layout engine (`ring`, `grid`, or Poisson-disk `random`, shown in the UI
  as "Scatter"). A symbol is a cloned inline `<svg>` of its OpenMoji art (scaled by `ART_SCALE`),
  or SVG `<text>` emoji when the glyph has no art (never true for the built-in themes).
- `SpotItPDF` (`pdf.js`): rasterizes each SVG to a JPEG via canvas (`RASTER_SCALE`), then
  places images on jsPDF pages. Rasterization is deliberate: vector SVG-to-PDF breaks emoji.
- `SpotItDeck` (`deck.js`): `DEFAULTS`, URL `parse()`/`serialize()`, `themeFor()` (falls
  back to the first theme big enough), and `build(settings)`, which picks symbols, shuffles the deck, and renders every
  card SVG from one PRNG.
- `SpotItApp` (`app.js`): designer UI. Holds a single `state` object, binds controls, and
  debounces `regenerate()` (200 ms), which calls `SpotItDeck.build()` and fills the grid and
  `cardSvgs` (used for PDF). Themes too small for the chosen order are disabled.
- `SpotItGame` (`game.js`): "The Tower" rules with no DOM access. `create()` deals with a seeded
  PRNG, `claim(game, player, symbol, now)` returns `match | wrong | locked | over`, and
  `summary()` feeds the HUD. Modes: `solo` (2 s penalty per wrong tap), `duel` (1 s lockout),
  and `pass` (solo rules, one player per game). Duel cannot tie: n²+n+1 cards minus 2 in hand
  is always odd. `pause()`/`resume()` exclude paused time from `summary()` and shift duel
  lockouts; `claim()` returns `paused` meanwhile. Every claim lands in `game.log` (timestamp
  in play time), and `summary().stats` (lazy) derives per-card times, fastest/slowest, and
  wrong taps. `summary().playerStats` gives the same per player. A card's time includes the solo
  penalty for its wrong taps. `histogram()` and `leaderboard()` are pure helpers.
- `SpotItStats` (`stats.js`): renders titled stats blocks (facts plus two SVG bar charts: time
  per card, spread of times) into the results screen, always visible. One block per player in
  duel and Pass & Play, fastest first.
- `SpotItPlay` (`play.js`): game view. `app.js` passes a host (`getDeck`, `setOrder`, `exit`);
  the game clones the designer's card SVGs (renaming `clip-N` to `play-clip-N`, since a
  duplicate id would resolve to the hidden designer copy), moves clones between slots, maps
  `pointerdown` on a symbol's halo to `claim()`, pauses behind an opaque overlay (also when the
  tab is hidden), runs Pass & Play (a roster of 2-6, a hand-off screen before each turn, the
  same deal every turn from one seed drawn from the deal PRNG, then a leaderboard with every player's
  stats below it, ranked; the board lays out as solo), and stores solo best times in `localStorage`
  (`dm-best-<cards>`). Two-player is offered only on touch devices; the top seat is rotated
  180° for a device lying flat between players.

### Views

`index.html` holds two views: `#designer-view` and `#play-view` (start, board, results).
`view=play` in the hash selects the game. Play ▶ `pushState`s a `{ fromDesigner: true }` entry,
so Back, the game logo, and "Edit this deck" return to the designer (`history.back()` when that
entry exists, else `replaceState`). `route()` runs on load and `hashchange`; it rebuilds only
when deck settings change, and leaving the game keeps the current deck (its size can change on
the start screen). The designer's scroll positions are saved and restored around the game.

### Find-the-match mode

Each rendered symbol is a `<g class="symbol" data-symbol="…">` containing a halo circle with
`visibility="hidden"`. Match mode toggles CSS classes (`is-selected`, `is-paired`, `is-match`)
to reveal it. The PDF path serializes the SVG without page CSS, so highlights never print;
keep highlight styling in CSS, not SVG attributes.

### URL state

All settings plus the seed are mirrored into the URL hash (`#order=7&theme=food&seed=…`) via
`history.replaceState` on every regenerate and print-setting change. `readUrlState()` validates
each key and ignores bad values; `syncControls()` pushes `state` into the DOM on load and on
`hashchange`. Parsing and serializing live in `SpotItDeck`, so a new setting needs a rule in
`parse()`, a key in `serialize()`, and a `syncControls()` line. The URL stores the user's
preferred theme, not the fallback. `writeUrlState()` keeps `history.state` and appends
`view=play` while the game is open.

### Reproducibility

One PRNG seeded from `state.seed` drives symbol shuffling and all per-card layout randomness,
consumed in a fixed sequence inside `SpotItDeck.build()`. The game deals from a separate PRNG
with the same seed, so the first deal is reproducible from a link. `renderCard()` calls `prng()`
for size and angle even when those options are off, so toggling them does not reshuffle other
cards. Preserve that call order when changing the renderer.

## Styling

`css/style.css` uses a "tabletop" design (Modern Boho palette) with light and dark tokens on `:root`
and `:root[data-theme="dark"]`. An inline script in `index.html` sets `data-theme` before first
paint from `localStorage` (`dm-theme`) or `prefers-color-scheme`. Fonts: Inter (`--font-sans`) for
controls, Newsreader (`--font-serif`) for brand, section titles, and card numbers.

`css/play.css` adds the game layout on top of `style.css` tokens. In the game, the hidden
symbol halo gets `pointer-events: all` to act as a larger tap target.

## Work tracking

All work (features, bugs, ideas, docs) is tracked as GitHub issues at
https://github.com/hrpatel/dobble-mint/issues, labeled by type. Check there before starting
new work, and file an issue instead of leaving notes or TODO files in the repo.
