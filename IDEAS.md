# Ideas

Improvements considered but not yet implemented.

- **Shareable URL state.** Persist all settings and the seed in the URL hash so a deck can be
  bookmarked, shared, or regenerated exactly.
- **Custom symbols.** Let users add their own text or uploaded images (family photos, class
  vocabulary). Needs a symbol editor and image support in both the SVG renderer and PDF export.
- **Card backs.** Optional back design (logo, pattern) printed on alternating pages for duplex.
- **Lossless PDF export.** PNG rasterization avoids JPEG artifacts but measured about 5.5x larger
  per card (300 KB vs 52 KB at 900px), roughly 19 MB vs 3.5 MB for a 57-card deck. Worth
  revisiting as an opt-in "high quality" toggle.
- **Consistent emoji across platforms.** Symbols use the OS emoji font, so decks look different
  on macOS, Windows, and Android. Bundling an open emoji set (e.g. Twemoji or Noto SVGs) would
  make output identical everywhere.
- **Larger single-theme decks.** Orders 11 and 13 need 133 and 183 symbols; every single theme
  is smaller, so only Mixed works. Growing the themes would unlock them.
