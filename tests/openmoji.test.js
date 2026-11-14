const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const get = load('openmoji.js', 'symbols.js');
const THEMES = get('SpotItSymbols.THEMES');
const OpenMoji = get('SpotItOpenMoji');

test('every theme glyph has OpenMoji artwork', () => {
  for (const [key, theme] of Object.entries(THEMES)) {
    const missing = theme.glyphs.filter(g => !OpenMoji.has(g));
    assert.deepEqual([...missing], [], key);
  }
});

test('themes are the five OpenMoji groups, each big enough for order 7', () => {
  assert.deepEqual(Object.keys(THEMES), ['animals', 'flags', 'food', 'symbols', 'objects']);
  for (const [key, theme] of Object.entries(THEMES)) {
    assert.ok(theme.glyphs.length >= 57, key);
    assert.equal(new Set(theme.glyphs).size, theme.glyphs.length, `${key} has duplicates`);
  }
});

test('artwork is inner SVG markup with no ids or scripts', () => {
  for (const svg of OpenMoji.values()) {
    assert.doesNotMatch(svg, /<svg|\sid=|<script|\son\w+=|foreignObject/i);
  }
});

test('glyphs without artwork return undefined', () => {
  assert.equal(OpenMoji.get('no such glyph'), undefined);
});
