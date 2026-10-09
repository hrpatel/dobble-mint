const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const get = load('math.js', 'symbols.js', 'deck.js');
const SpotItDeck = get('SpotItDeck');

const full = {
  order: 5, theme: 'shapes', shape: 'square', layout: 'random', sizeVariance: 12,
  maxAngle: 40, seed: 777, pageSize: 'a4', cardsPerRow: 2, bleedMarks: false,
};

test('serialize then parse round-trips every setting', () => {
  const hash = SpotItDeck.serialize(full);
  assert.match(hash, /^order=5&theme=shapes&/);
  assert.deepEqual(plain(SpotItDeck.parse(`#${hash}`)), full);
});

test('parse ignores invalid values and missing keys', () => {
  const parsed = plain(SpotItDeck.parse('#order=4&theme=nope&shape=star&layout=grid&size=99&spin=45&seed=-3&perRow=9'));
  assert.deepEqual(parsed, { layout: 'grid' });
  assert.deepEqual(plain(SpotItDeck.parse('')), {});
});

test('themeFor falls back to mixed only when the theme is too small', () => {
  assert.equal(SpotItDeck.themeFor('animals', 7), 'animals'); // 101 >= 57
  assert.equal(SpotItDeck.themeFor('animals', 11), 'mixed'); // 101 < 133
  assert.equal(SpotItDeck.themeFor('mixed', 13), 'mixed');
});
