# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dobble Mint is a static, dependency-free single-page app that generates Spot It (Dobble) cards
and exports them to PDF. There is no build step, package manager, linter, or test suite. Open
`index.html` in a browser to run it. The only external runtime dependency is jsPDF, loaded from
a CDN `<script>` tag in `index.html`.

## Commands

- Run: open `index.html` directly, or serve the folder (e.g. `python3 -m http.server`).
- Verify deck math headlessly (only `math.js` is DOM-free):

  ```sh
  node -e "eval(require('fs').readFileSync('js/math.js','utf8')+';for(const n of SpotItMath.SUPPORTED_ORDERS)console.log(n,SpotItMath.verify(SpotItMath.buildDeck(n)).ok)')"
  ```

## Architecture

Each file in `js/` is a classic script exposing one global IIFE module. No ES modules, so
**load order in `index.html` matters**: `math.js` → `symbols.js` → `renderer.js` → `pdf.js` →
`app.js`.

- `SpotItMath` (`math.js`): builds the finite projective plane PG(2,n) for prime n. Points
  become symbols and lines become cards, so any two cards share exactly one symbol. Cards are
  arrays of symbol indices. Also provides `verify()` and the seeded `makePRNG()` (mulberry32).
  Only prime orders work; prime powers (4, 8, 9) would need GF(p^k) arithmetic.
- `SpotItSymbols` (`symbols.js`): emoji themes. `emojiArray()` dedupes glyphs and drops
  code points <= 255. `mixed` is the union of all themes and is built at load time. A theme
  must hold at least n²+n+1 glyphs to be usable at order n.
- `SpotItRenderer` (`renderer.js`): builds one SVG per card (fixed `CARD_SIZE` viewBox) with a
  shape clip path and a layout engine (`ring`, `grid`, or Poisson-disk `random`, shown in the UI
  as "Scatter"). Symbols are SVG `<text>` emoji, not images.
- `SpotItPDF` (`pdf.js`): rasterizes each SVG to a JPEG via canvas (`RASTER_SCALE`), then
  places images on jsPDF pages. Rasterization is deliberate: vector SVG-to-PDF breaks emoji.
- `SpotItApp` (`app.js`): holds a single `state` object, binds controls, and debounces
  `regenerate()` (200 ms). `regenerate()` builds the deck, picks symbols, shuffles card order
  with `shuffleDeck()`, and renders every card into both the grid and `cardSvgs` (used for PDF).
  Themes too small for the chosen order are disabled in the theme select.

### Find-the-match mode

Each rendered symbol is a `<g class="symbol" data-symbol="…">` containing a halo circle with
`visibility="hidden"`. Match mode toggles CSS classes (`is-selected`, `is-paired`, `is-match`)
to reveal it. The PDF path serializes the SVG without page CSS, so highlights never print;
keep highlight styling in CSS, not SVG attributes.

### URL state

All settings plus the seed are mirrored into the URL hash (`#order=7&theme=food&seed=…`) via
`history.replaceState` on every regenerate and print-setting change. `readUrlState()` validates
each key and ignores bad values; `syncControls()` pushes `state` into the DOM on load and on
`hashchange`. New settings need a parse rule, a write key, and a `syncControls()` line. The URL
stores the user's preferred theme, not the Mixed fallback.

### Reproducibility

One PRNG seeded from `state.seed` drives symbol shuffling and all per-card layout randomness,
consumed in a fixed sequence. `renderCard()` calls `prng()` for size and angle even when those
options are off, so toggling them does not reshuffle other cards. Preserve that call order
when changing the renderer.

## Styling

`css/style.css` uses a "tabletop" design with light and dark tokens on `:root` and
`:root[data-theme="dark"]`. An inline script in `index.html` sets `data-theme` before first
paint from `localStorage` (`dm-theme`) or `prefers-color-scheme`. Fonts: Inter
(`--font-sans`) for controls, Newsreader (`--font-serif`) for brand, section titles, and card
numbers.

Deferred ideas live in `IDEAS.md`.
