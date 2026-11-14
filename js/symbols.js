/**
 * symbols.js — Symbol pool management for Spot It cards.
 * Themes come from the generated openmoji.js, one per OpenMoji group.
 */

const SpotItSymbols = (() => {
  const THEMES = Object.fromEntries(
    SpotItOpenMojiThemes.map(({ key, label, glyphs }) => [key, { label, glyphs }]),
  );

  /** Get theme names */
  function getThemes() {
    return Object.entries(THEMES).map(([key, v]) => ({
      key,
      label: v.label,
      count: v.glyphs.length,
    }));
  }

  /** Get up to `count` unique symbols from a theme, shuffled with PRNG */
  function getSymbols(themeKey, count, prng) {
    const pool = [...THEMES[themeKey].glyphs];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  return { getThemes, getSymbols, THEMES };
})();
