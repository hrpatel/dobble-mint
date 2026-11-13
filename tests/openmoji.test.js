const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const get = load('symbols.js', 'openmoji.js');
const THEMES = get('SpotItSymbols.THEMES');
const OpenMoji = get('SpotItOpenMoji');

test('every Animals glyph has OpenMoji artwork', () => {
  const missing = THEMES.animals.glyphs.filter(g => !OpenMoji.has(g));
  assert.deepEqual([...missing], []);
});

test('artwork is inner SVG markup with no ids or scripts', () => {
  for (const g of THEMES.animals.glyphs) {
    const svg = OpenMoji.get(g);
    assert.doesNotMatch(svg, /<svg|\sid=|<script|\son\w+=|foreignObject/i, g);
  }
});

test('glyphs without artwork return undefined', () => {
  assert.equal(OpenMoji.get('no such glyph'), undefined);
});
