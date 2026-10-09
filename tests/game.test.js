const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const get = load('math.js', 'game.js');
const SpotItMath = get('SpotItMath');
const SpotItGame = get('SpotItGame');

const deckCards = order => plain(SpotItMath.buildDeck(order).cards);
const newGame = (mode, { order = 3, seed = 1, now = 0 } = {}) =>
  SpotItGame.create(deckCards(order), mode, SpotItMath.makePRNG(seed), now);

/** The symbol player `i` must tap to win the current center card. */
const target = (game, i) =>
  SpotItGame.sharedSymbol(game.cards[game.players[i].card], game.cards[game.center]);

/** Any symbol on player `i`'s card that is not the match. */
const wrong = (game, i) => game.cards[game.players[i].card].find(s => s !== target(game, i));

test('deal uses every card exactly once', () => {
  for (const mode of ['solo', 'duel']) {
    const game = newGame(mode, { order: 5 });
    const dealt = [...game.players.map(p => p.card), game.center, ...game.pile];
    assert.equal(dealt.length, 31);
    assert.equal(new Set(dealt).size, 31);
    assert.equal(game.players.length, mode === 'solo' ? 1 : 2);
  }
});

test('deal is deterministic per seed and differs across seeds', () => {
  const deal = seed => plain(newGame('duel', { order: 7, seed }).pile);
  assert.deepEqual(deal(42), deal(42));
  assert.notDeepEqual(deal(42), deal(43));
});

test('correct tap wins the center card and reveals the next one', () => {
  const game = newGame('solo');
  const oldCenter = game.center;
  const nextCenter = game.pile.at(-1);
  const res = SpotItGame.claim(game, 0, target(game, 0), 100);
  assert.equal(res.result, 'match');
  assert.equal(game.players[0].card, oldCenter);
  assert.equal(game.players[0].won, 1);
  assert.equal(game.center, nextCenter);
});

test('solo wrong tap adds a 2 s penalty and does not lock out', () => {
  const game = newGame('solo');
  const res = SpotItGame.claim(game, 0, wrong(game, 0), 100);
  assert.equal(res.result, 'wrong');
  assert.equal(res.target, target(game, 0));
  assert.equal(game.players[0].mistakes, 1);
  assert.equal(SpotItGame.summary(game, 100).penaltyMs, 2000);
  assert.equal(SpotItGame.claim(game, 0, target(game, 0), 101).result, 'match');
});

test('duel wrong tap locks only that player out for 1 s', () => {
  const game = newGame('duel');
  assert.equal(SpotItGame.claim(game, 0, wrong(game, 0), 1000).result, 'wrong');
  assert.equal(SpotItGame.claim(game, 0, target(game, 0), 1999).result, 'locked');
  assert.equal(SpotItGame.summary(game, 1999).penaltyMs, 0);
  // The other player can still play during the lockout
  assert.equal(SpotItGame.claim(game, 1, target(game, 1), 1500).result, 'match');
  assert.equal(SpotItGame.claim(game, 0, target(game, 0), 2000).result, 'match');
});

test('solo game ends after every card is won and reports total time', () => {
  const game = newGame('solo', { order: 3, now: 1000 });
  SpotItGame.claim(game, 0, wrong(game, 0), 1500);
  let claims = 0;
  let res;
  do {
    res = SpotItGame.claim(game, 0, target(game, 0), 2000 + claims);
    claims++;
  } while (!res.over);
  assert.equal(claims, 12); // 13 cards: one starts in hand
  assert.equal(game.center, null);
  assert.equal(SpotItGame.claim(game, 0, 0, 9999).result, 'over');

  const s = SpotItGame.summary(game, 9999);
  assert.equal(s.over, true);
  assert.equal(s.cardsLeft, 0);
  assert.equal(s.elapsedMs, 2011 - 1000); // frozen at the last claim, not `now`
  assert.equal(s.totalMs, 2011 - 1000 + 2000);
});

test('duel cannot tie: n^2+n-1 winnable cards is always odd', () => {
  for (const order of SpotItMath.SUPPORTED_ORDERS) {
    const game = newGame('duel', { order });
    assert.equal((game.pile.length + 1) % 2, 1, `order ${order}`);
  }
});

test('duel winner is the player with more cards', () => {
  const play = picks => {
    const game = newGame('duel', { order: 3 });
    for (const i of picks) SpotItGame.claim(game, i, target(game, i), 0);
    return SpotItGame.summary(game, 0);
  };
  const all0 = play(Array(11).fill(0));
  assert.equal(all0.over, true);
  assert.deepEqual(plain(all0.scores), [11, 0]);
  assert.equal(all0.winner, 0);

  const mid = play([1, 1, 1]);
  assert.equal(mid.over, false);
  assert.equal(mid.winner, null);
  assert.equal(mid.cardsLeft, 8);

  const close = play([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1]);
  assert.deepEqual(plain(close.scores), [5, 6]);
  assert.equal(close.winner, 1);
});

test('programmer errors fail fast', () => {
  assert.throws(() => newGame('trio'), /Unknown mode/);
  const game = newGame('solo');
  assert.throws(() => SpotItGame.claim(game, 1, 0, 0), /No player 1/);
});
