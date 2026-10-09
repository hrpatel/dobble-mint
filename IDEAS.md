# Ideas

Improvements considered but not yet implemented.

- **Custom symbols.** Let users add their own text or uploaded images (family photos, class
  vocabulary). Needs a symbol editor and image support in both the SVG renderer and PDF export.
- **Card backs.** Optional back design (logo, pattern) printed on alternating pages for duplex.
- **Lossless PDF export.** PNG rasterization avoids JPEG artifacts but measured about 5.5x larger
  per card (300 KB vs 52 KB at 900px), roughly 19 MB vs 3.5 MB for a 57-card deck. Worth
  revisiting as an opt-in "high quality" toggle.
- **Consistent emoji across platforms.** Symbols use the OS emoji font, so decks look different
  on macOS, Windows, and Android. Bundling an open emoji set (e.g. Twemoji or Noto SVGs) would
  make output identical everywhere.
- **Online two-player.** Both devices open the same deck link, so only claims need sending.
  GitHub Pages has no server: use WebRTC (e.g. PeerJS, paired by QR code) with one device as
  referee to settle who tapped first.
- **Pause button.** Pause during play: cover the cards so nobody can study them, ignore taps,
  and stop the solo timer. `game.js` would track paused time so `summary()` excludes it and
  duel lockouts resume where they left off.
- **Pass-and-play time trial.** Two or more players take turns playing solo on one device; the
  lowest total time wins. Deal every turn from the same seed so each player gets the identical
  deal, then show a leaderboard of names and times.
- **Advanced stats.** After a game, show how long each card took, the distribution of those
  times, fastest and slowest cards, and wrong taps. Needs `game.js` to log each claim
  (timestamp, player, result) so `summary()` can derive the stats.
- **Points or time scoring.** Let players choose how a game is scored: by time, or by points
  for each card won. Points follow the same rules as time, e.g. a deduction for each wrong tap.
  Fits as a per-mode setting next to `penaltyMs` in `MODES`.
- **Computer opponent.** A bot with adjustable reaction time for solo play.
- **Game polish.** Sound effects, other Spot It variants (The Well, Hot Potato), and two-player
  on desktop (side by side with keyboard keys mapped to symbols).
- **Larger single-theme decks.** Orders 11 and 13 need 133 and 183 symbols; every single theme
  is smaller, so only Mixed works. Growing the themes would unlock them.
