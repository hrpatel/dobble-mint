/**
 * game.js — "The Tower" rules for Spot It, independent of the DOM.
 * Each player holds one card; tapping the symbol it shares with the center card wins the
 * center card, which becomes the player's new card. The game ends when the pile is empty.
 */

const SpotItGame = (() => {
  const MODES = {
    solo: { players: 1, lockoutMs: 0, penaltyMs: 2000 },
    duel: { players: 2, lockoutMs: 1000, penaltyMs: 0 },
    // One player per game; the UI chains turns on the same deal and ranks them
    pass: { players: 1, lockoutMs: 0, penaltyMs: 2000 },
  };

  /** Play time at `now`, excluding time spent paused. */
  function activeMs(game, now) {
    const pausedNow = game.pausedAt === null ? 0 : now - game.pausedAt;
    return now - game.startedAt - game.pausedMs - pausedNow;
  }

  /** The one symbol two cards share (projective plane guarantees exactly one). */
  function sharedSymbol(a, b) {
    return a.find(s => b.includes(s));
  }

  /**
   * Deal a new game.
   * @param {number[][]} cards — deck.cards (symbol indices per card)
   * @param {'solo'|'duel'} mode
   * @param {function} prng — seeded random source for the deal
   * @param {number} now — start time in ms
   */
  function create(cards, mode, prng, now) {
    const cfg = MODES[mode];
    if (!cfg) throw new Error(`Unknown mode "${mode}"`);

    const pile = SpotItMath.shuffle(cards.map((_, i) => i), prng);
    const players = Array.from({ length: cfg.players }, () => ({
      card: pile.pop(), won: 0, mistakes: 0, lockedUntil: 0,
    }));
    const center = pile.pop();

    return {
      cards, mode, cfg, players, center, pile, startedAt: now, finishedAt: null, penaltyMs: 0,
      pausedAt: null, pausedMs: 0, log: [],
    };
  }

  /** Freeze the clock. Claims return 'paused' until `resume`. */
  function pause(game, now) {
    if (game.pausedAt !== null || game.finishedAt !== null) return;
    game.pausedAt = now;
  }

  /** Unfreeze, excluding the paused span from play time and keeping lockouts where they were. */
  function resume(game, now) {
    if (game.pausedAt === null) return;
    const span = now - game.pausedAt;
    game.pausedMs += span;
    game.players.forEach(p => { if (p.lockedUntil > game.pausedAt) p.lockedUntil += span; });
    game.pausedAt = null;
  }

  /**
   * Player `playerIdx` taps `symbol` at time `now`.
   * Returns { result: 'match'|'wrong'|'locked'|'paused'|'over', ... }.
   */
  function claim(game, playerIdx, symbol, now) {
    const player = game.players[playerIdx];
    if (!player) throw new Error(`No player ${playerIdx}`);
    if (game.finishedAt !== null) return { result: 'over' };
    if (game.pausedAt !== null) return { result: 'paused' };
    if (now < player.lockedUntil) return { result: 'locked' };

    const target = sharedSymbol(game.cards[player.card], game.cards[game.center]);
    const t = activeMs(game, now);
    if (symbol !== target) {
      game.log.push({ player: playerIdx, symbol, result: 'wrong', t, card: game.center });
      player.mistakes++;
      player.lockedUntil = now + game.cfg.lockoutMs;
      game.penaltyMs += game.cfg.penaltyMs;
      return { result: 'wrong', target };
    }

    game.log.push({ player: playerIdx, symbol, result: 'match', t, card: game.center });
    player.won++;
    player.card = game.center;
    if (game.pile.length) {
      game.center = game.pile.pop();
    } else {
      game.center = null;
      game.finishedAt = now;
    }
    return { result: 'match', symbol, over: game.finishedAt !== null };
  }

  /**
   * Per-card timing from the claim log. A card's time runs from the previous win (or the start)
   * to its win, plus the solo penalty for each wrong tap along the way.
   */
  function stats(game) {
    const cards = [];
    let prevT = 0;
    let wrong = 0;
    for (const e of game.log) {
      if (e.result === 'wrong') { wrong++; continue; }
      cards.push({
        player: e.player, card: e.card, wrong, ms: e.t - prevT + wrong * game.cfg.penaltyMs,
      });
      prevT = e.t;
      wrong = 0;
    }
    const byTime = [...cards].sort((a, b) => a.ms - b.ms);
    return {
      cards,
      wrongTaps: game.log.filter(e => e.result === 'wrong').length,
      fastest: byTime[0] ?? null,
      slowest: byTime.at(-1) ?? null,
      averageMs: cards.length ? cards.reduce((sum, c) => sum + c.ms, 0) / cards.length : 0,
    };
  }

  /** Count `values` into `bins` equal-width buckets between their min and max. */
  function histogram(values, bins) {
    const counts = Array(bins).fill(0);
    if (!values.length) return counts;
    const min = Math.min(...values);
    const width = (Math.max(...values) - min) / bins;
    for (const v of values) counts[width ? Math.min(bins - 1, Math.floor((v - min) / width)) : 0]++;
    return counts;
  }

  /** Rank pass-and-play results by lowest total time; equal times share a rank. */
  function leaderboard(results) {
    return [...results]
      .sort((a, b) => a.totalMs - b.totalMs)
      .map(r => ({ ...r, rank: 1 + results.filter(o => o.totalMs < r.totalMs).length }));
  }

  /** Snapshot for the HUD and results screen. */
  function summary(game, now) {
    const over = game.finishedAt !== null;
    const elapsedMs = activeMs(game, over ? game.finishedAt : now);
    const scores = game.players.map(p => p.won);
    // Duel never ties: n²+n+1 cards minus 2 in hand leaves an odd number to win
    const winner = over && scores.length === 2 ? (scores[0] > scores[1] ? 0 : 1) : null;
    return {
      over,
      elapsedMs,
      penaltyMs: game.penaltyMs,
      totalMs: elapsedMs + game.penaltyMs,
      cardsLeft: game.pile.length + (game.center === null ? 0 : 1),
      scores,
      mistakes: game.players.map(p => p.mistakes),
      winner,
      get stats() { return stats(game); }, // lazy: the HUD calls summary() every frame
    };
  }

  return { create, claim, pause, resume, summary, histogram, leaderboard, sharedSymbol, MODES };
})();
