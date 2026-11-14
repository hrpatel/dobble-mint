/**
 * Builds js/openmoji.js: the theme glyph lists and OpenMoji artwork for them.
 * Downloads from a pinned npm release and keeps only allowlisted SVG markup.
 *
 * Usage: node scripts/build-openmoji.js
 */
const fs = require('node:fs');
const path = require('node:path');

const VERSION = '17.0.0';
const CDN = `https://cdn.jsdelivr.net/npm/openmoji@${VERSION}`;
const OUT = path.join(__dirname, '..', 'js', 'openmoji.js');
const BATCH = 20;

/** Themes in menu order; each one is an OpenMoji group (skin-tone variants excluded). */
const THEMES = [
  { key: 'animals', label: 'Animals & Nature', group: 'animals-nature' },
  { key: 'flags', label: 'Flags', group: 'flags' },
  { key: 'food', label: 'Food & Drink', group: 'food-drink' },
  { key: 'symbols', label: 'Symbols', group: 'symbols' },
  { key: 'objects', label: 'Objects', group: 'objects' },
];

const ELEMENTS = new Set(['g', 'path', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect']);
const ATTRIBUTES = new Set([
  'd', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
  'transform', 'fill', 'fill-rule', 'clip-rule', 'fill-opacity', 'opacity', 'color', 'paint-order', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
]);
const DROPPED = new Set(['id', 'stop-color']); // stop-color: stray on paths, no effect

/** Stray text between tags (e.g. a lone "d" in 1F684.svg) is dropped; anything tag-like fails. */
function assertNoMarkup(gap, label) {
  if (/[<>]/.test(gap)) throw new Error(`${label}: unparsed markup "${gap.trim().slice(0, 40)}"`);
}

/** Return the inner markup of an OpenMoji SVG, or throw on anything not allowlisted. */
function sanitize(svg, label) {
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  let out = '';
  let last = 0;
  for (const m of body.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    assertNoMarkup(body.slice(last, m.index), label);
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
  assertNoMarkup(body.slice(last), label);
  return out;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const index = JSON.parse(await fetchText(`${CDN}/data/openmoji.json`));

  const themes = THEMES.map(t => ({
    ...t,
    emojis: index.filter(e => e.group === t.group && !e.skintone).sort((a, b) => a.order - b.order),
  }));
  const all = themes.flatMap(t => t.emojis);
  if (new Set(all.map(e => e.emoji)).size !== all.length) throw new Error('A glyph is in two themes');

  const art = [];
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = await Promise.all(all.slice(i, i + BATCH).map(async e => {
      const svg = await fetchText(`${CDN}/color/svg/${e.hexcode}.svg`);
      return `  [${JSON.stringify(e.emoji)}, ${JSON.stringify(sanitize(svg, e.hexcode))}],`;
    }));
    art.push(...batch);
  }

  const lists = themes.map(t => [
    '  {',
    `    key: ${JSON.stringify(t.key)},`,
    `    label: ${JSON.stringify(t.label)},`,
    `    glyphs: ${JSON.stringify(t.emojis.map(e => e.emoji))},`,
    '  },',
  ].join('\n'));

  fs.writeFileSync(OUT, [
    '/**',
    ` * openmoji.js — OpenMoji ${VERSION} artwork (https://openmoji.org) and the theme glyph lists.`,
    ' * Artwork license: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).',
    ' * Art is the inner markup of a 72×72 viewBox, ids removed, keyed by glyph.',
    ' * Do not edit; regenerate with: node scripts/build-openmoji.js',
    ' */',
    '',
    'const SpotItOpenMojiThemes = [',
    ...lists,
    '];',
    '',
    'const SpotItOpenMoji = new Map([',
    ...art,
    ']);',
    '',
  ].join('\n'));
  console.log(`Wrote ${all.length} glyphs, ${fs.statSync(OUT).size} bytes to ${OUT}`);
  for (const t of themes) console.log(`  ${t.key}: ${t.emojis.length}`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
