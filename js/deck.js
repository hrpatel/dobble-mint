/**
 * deck.js — Deck settings shared by the designer and the game.
 * Reads/writes settings in the URL hash and turns settings into a rendered deck, so a link
 * produces identical cards on every page.
 */

const SpotItDeck = (() => {
  const SHAPES = ['circle', 'square', 'hexagon', 'octagon'];
  const LAYOUTS = ['ring', 'grid', 'random'];

  const DEFAULTS = {
    order: 7,
    theme: 'animals',
    shape: 'circle',
    layout: 'ring',
    sizeVariance: 0,
    maxAngle: 0,
    pageSize: 'letter',
    cardsPerRow: 3,
    bleedMarks: true,
  };

  function newSeed() {
    return 1 + Math.floor(Math.random() * 99999);
  }

  function symbolsNeeded(order) {
    return order * order + order + 1;
  }

  /** `theme` if it has enough symbols for `order`, otherwise the Mixed pool. */
  function themeFor(theme, order) {
    const t = SpotItSymbols.getThemes().find(x => x.key === theme);
    return t && t.count >= symbolsNeeded(order) ? theme : 'mixed';
  }

  /** Valid settings found in a URL hash; invalid or missing keys are omitted. */
  function parse(hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const int = (key, ok) => {
      const v = Number(params.get(key));
      return params.has(key) && Number.isSafeInteger(v) && ok(v) ? v : undefined;
    };
    const oneOf = (key, list) => (list.includes(params.get(key)) ? params.get(key) : undefined);

    const parsed = {
      order: int('order', v => SpotItMath.SUPPORTED_ORDERS.includes(v)),
      theme: oneOf('theme', SpotItSymbols.getThemes().map(t => t.key)),
      shape: oneOf('shape', SHAPES),
      layout: oneOf('layout', LAYOUTS),
      sizeVariance: int('size', v => v >= 0 && v <= 25),
      maxAngle: int('spin', v => v >= 0 && v <= 180 && v % 10 === 0),
      seed: int('seed', v => v >= 0 && v <= 0xFFFFFFFF),
      pageSize: oneOf('page', ['a4', 'letter']),
      cardsPerRow: int('perRow', v => [2, 3, 4].includes(v)),
      bleedMarks: params.has('bleed') ? params.get('bleed') !== '0' : undefined,
    };
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
  }

  /** URL hash (without '#') for a complete settings object. */
  function serialize(s) {
    return new URLSearchParams({
      order: s.order,
      theme: s.theme,
      shape: s.shape,
      layout: s.layout,
      size: s.sizeVariance,
      spin: s.maxAngle,
      seed: s.seed,
      page: s.pageSize,
      perRow: s.cardsPerRow,
      bleed: s.bleedMarks ? 1 : 0,
    }).toString();
  }

  /**
   * Build and render a deck. Consumes one PRNG in a fixed order (symbols, shuffle, cards),
   * so the same settings always give the same cards. Throws if the theme is too small.
   * @returns {{ deck, symbols: string[], cardSvgs: SVGElement[] }}
   */
  function build(s) {
    const rawDeck = SpotItMath.buildDeck(s.order);
    const prng = SpotItMath.makePRNG(s.seed);
    const symbols = SpotItSymbols.getSymbols(s.theme, rawDeck.numSymbols, prng);

    if (symbols.length < rawDeck.numSymbols) {
      throw new Error(`Theme "${s.theme}" only has ${symbols.length} symbols, but ${rawDeck.numSymbols} are needed for order ${s.order}. Try "Mixed" theme.`);
    }

    const deck = SpotItMath.shuffleDeck(rawDeck, prng);
    const options = {
      shape: s.shape,
      layout: s.layout,
      randomSize: s.sizeVariance > 0,
      sizeRange: [1.0 - (s.sizeVariance / 100), 1.0 + (s.sizeVariance / 100)],
      randomAngle: s.maxAngle > 0,
      maxAngle: s.maxAngle,
    };
    const cardSvgs = deck.cards.map((card, i) =>
      SpotItRenderer.renderCard(card.map(idx => symbols[idx]), options, prng, `clip-${i}`));

    return { deck, symbols, cardSvgs };
  }

  return { DEFAULTS, newSeed, symbolsNeeded, themeFor, parse, serialize, build };
})();
