const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const get = load('math.js', 'openmoji.js', 'symbols.js', 'deck.js');
const SpotItDeck = get('SpotItDeck');

const full = {
  order: 5, theme: 'symbols', shape: 'square', layout: 'random', sizeVariance: 12,
  maxAngle: 40, seed: 777, pageSize: 'a4', cardsPerRow: 2, bleedMarks: false,
};

test('serialize then parse round-trips every setting', () => {
  const hash = SpotItDeck.serialize(full);
  assert.match(hash, /^order=5&theme=symbols&/);
  assert.deepEqual(plain(SpotItDeck.parse(`#${hash}`)), full);
});

test('parse ignores invalid values and missing keys', () => {
  const parsed = plain(SpotItDeck.parse('#order=4&theme=nope&shape=star&layout=grid&size=99&spin=45&seed=-3&perRow=9'));
  assert.deepEqual(parsed, { layout: 'grid' });
  assert.deepEqual(plain(SpotItDeck.parse('')), {});
});

test('themeFor falls back to the first theme that fits only when the theme is too small', () => {
  assert.equal(SpotItDeck.themeFor('food', 7), 'food'); // 131 >= 57
  assert.equal(SpotItDeck.themeFor('symbols', 11), 'symbols'); // 224 >= 133
  assert.equal(SpotItDeck.themeFor('food', 11), 'animals'); // 131 < 133
});

test('parse ignores themes that no longer exist', () => {
  assert.deepEqual(plain(SpotItDeck.parse('#theme=nature')), {});
  assert.deepEqual(plain(SpotItDeck.parse('#theme=mixed')), {});
});

test('parse rejects order 13 (14 symbols per card is no longer offered)', () => {
  assert.deepEqual(plain(SpotItDeck.parse('#order=13')), {});
  assert.equal(SpotItDeck.parse('#order=11').order, 11);
});
