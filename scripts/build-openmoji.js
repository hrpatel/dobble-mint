/**
 * Builds js/openmoji.js: OpenMoji artwork for the glyphs of the given themes, keyed by glyph.
 * Downloads from a pinned npm release and keeps only allowlisted SVG markup.
 *
 * Usage: node scripts/build-openmoji.js animals [nature ...]
 */
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('../tests/load');

const VERSION = '17.0.0';
const CDN = `https://cdn.jsdelivr.net/npm/openmoji@${VERSION}`;
const OUT = path.join(__dirname, '..', 'js', 'openmoji.js');

const ELEMENTS = new Set(['g', 'path', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect']);
const ATTRIBUTES = new Set([
  'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
  'transform', 'fill', 'fill-rule', 'fill-opacity', 'opacity', 'color', 'paint-order', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
]);
const DROPPED = new Set(['id']);

/** Strip VS16 so a theme glyph matches OpenMoji's emoji field either way. */
const normalize = s => s.replace(/️/g, '');

/** Return the inner markup of an OpenMoji SVG, or throw on anything not allowlisted. */
function sanitize(svg, label) {
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  let out = '';
  let last = 0;
  for (const m of body.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    if (body.slice(last, m.index).trim()) throw new Error(`${label}: unexpected text`);
    last = m.index + m[0].length;
    const [, close, tag, attrs, selfClose] = m;
    if (!ELEMENTS.has(tag)) throw new Error(`${label}: element <${tag}>`);
    if (close) { out += `</${tag}>`; continue; }
    let kept = '';
    const rest = attrs.replace(/\s([a-zA-Z:-]+[0-9]?)="([^"]*)"/g, (_, name, value) => {
      if (ATTRIBUTES.has(name)) kept += ` ${name}="${value}"`;
      else if (!DROPPED.has(name)) throw new Error(`${label}: attribute ${name}`);
      return '';
    });
    if (rest.trim()) throw new Error(`${label}: unparsed attributes "${rest.trim()}"`);
    out += `<${tag}${kept}${selfClose ? '/' : ''}>`;
  }
  if (body.slice(last).trim()) throw new Error(`${label}: unexpected trailing text`);
  return out;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function main(themes) {
  if (!themes.length) throw new Error('Usage: node scripts/build-openmoji.js <theme> [...]');
  const THEMES = load('symbols.js')('SpotItSymbols.THEMES');
  const glyphs = [...new Set(themes.flatMap(t => {
    if (!THEMES[t]) throw new Error(`Unknown theme "${t}"`);
    return [...THEMES[t].glyphs];
  }))];

  const index = JSON.parse(await fetchText(`${CDN}/data/openmoji.json`));
  const hexcodes = new Map(index.map(e => [normalize(e.emoji), e.hexcode]));

  const entries = [];
  for (const glyph of glyphs) {
    const hex = hexcodes.get(normalize(glyph));
    if (!hex) throw new Error(`No OpenMoji artwork for ${glyph}`);
    const svg = await fetchText(`${CDN}/color/svg/${hex}.svg`);
    entries.push(`  [${JSON.stringify(glyph)}, ${JSON.stringify(sanitize(svg, hex))}],`);
  }

  fs.writeFileSync(OUT, [
    '/**',
    ` * openmoji.js — OpenMoji ${VERSION} artwork (https://openmoji.org), keyed by glyph.`,
    ' * Artwork license: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).',
    ' * Inner markup of a 72×72 viewBox, ids removed. Do not edit; regenerate with:',
    ` *   node scripts/build-openmoji.js ${themes.join(' ')}`,
    ' */',
    '',
    'const SpotItOpenMoji = new Map([',
    ...entries,
    ']);',
    '',
  ].join('\n'));
  console.log(`Wrote ${entries.length} glyphs, ${fs.statSync(OUT).size} bytes to ${OUT}`);
}

main(process.argv.slice(2)).catch(err => {
  console.error(err.message);
  process.exit(1);
});
