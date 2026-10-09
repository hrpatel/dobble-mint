/**
 * game.js — "The Tower" rules for Spot It, independent of the DOM.
 * Each player holds one card; tapping the symbol it shares with the center card wins the
 * center card, which becomes the player's new card. The game ends when the pile is empty.
 */

const SpotItGame = (() => {
  const MODES = {
    solo: { players: 1, lockoutMs: 0, penaltyMs: 2000 },
    duel: { players: 2, lockoutMs: 1000, penaltyMs: 0 },
  };

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

    return { cards, mode, cfg, players, center, pile, startedAt: now, finishedAt: null, penaltyMs: 0 };
  }

  /**
   * Player `playerIdx` taps `symbol` at time `now`.
   * Returns { result: 'match'|'wrong'|'locked'|'over', ... }.
   */
  function claim(game, playerIdx, symbol, now) {
    const player = game.players[playerIdx];
    if (!player) throw new Error(`No player ${playerIdx}`);
    if (game.finishedAt !== null) return { result: 'over' };
    if (now < player.lockedUntil) return { result: 'locked' };

    const target = sharedSymbol(game.cards[player.card], game.cards[game.center]);
    if (symbol !== target) {
      player.mistakes++;
      player.lockedUntil = now + game.cfg.lockoutMs;
      game.penaltyMs += game.cfg.penaltyMs;
      return { result: 'wrong', target };
    }

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

  /** Snapshot for the HUD and results screen. */
  function summary(game, now) {
    const over = game.finishedAt !== null;
    const elapsedMs = (over ? game.finishedAt : now) - game.startedAt;
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
    };
  }

  return { create, claim, summary, sharedSymbol, MODES };
})();
