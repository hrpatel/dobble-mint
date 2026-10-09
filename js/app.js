/**
 * app.js — UI wiring & state management for the Spot It card generator.
 */

const SpotItApp = (() => {
  let state = {
    order: 7,
    theme: 'animals',
    shape: 'circle',
    layout: 'ring',
    sizeVariance: 0,
    maxAngle: 0,
    pageSize: 'letter',
    cardsPerRow: 3,
    margin: 5,
    bleedMarks: true,
    seed: newSeed(),
  };

  let deck = null;
  let symbols = [];
  let cardSvgs = [];
  let debounceTimer = null;
  let matchMode = false;
  let selected = [];
  let preferredTheme = state.theme; // user's last explicit pick; restored when it fits again
  const sliderSyncs = {};

  function newSeed() {
    return 1 + Math.floor(Math.random() * 99999);
  }

  function init() {
    readUrlState();
    bindControls();
    syncControls();
    regenerate();
    window.addEventListener('hashchange', () => { readUrlState(); syncControls(); regenerate(); });
  }

  function bindControls() {
    // Order
    const orderSel = document.getElementById('order-select');
    SpotItMath.SUPPORTED_ORDERS.forEach(n => {
      const total = n * n + n + 1;
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `${total} cards · ${n + 1} per card`;
      if (n === state.order) opt.selected = true;
      orderSel.appendChild(opt);
    });
    orderSel.addEventListener('change', e => {
      state.order = +e.target.value;
      populateThemes();
      scheduleUpdate();
    });

    // Theme
    populateThemes();
    document.getElementById('theme-select').addEventListener('change', e => {
      state.theme = preferredTheme = e.target.value;
      scheduleUpdate();
    });

    // Shape
    document.querySelectorAll('input[name="shape"]').forEach(inp => {
      inp.addEventListener('change', e => { state.shape = e.target.value; scheduleUpdate(); });
    });

    // Layout
    document.querySelectorAll('input[name="layout"]').forEach(inp => {
      inp.addEventListener('change', e => { state.layout = e.target.value; scheduleUpdate(); });
    });

    // Variation sliders (0 = off)
    bindSlider('size-variance', 'sizeVariance', v => (v ? `±${v}%` : 'Off'));
    bindSlider('max-angle', 'maxAngle', v => (v ? `${v}°` : 'Off'));

    // Seed
    const seedInput = document.getElementById('seed-input');
    seedInput.value = state.seed;
    seedInput.addEventListener('change', e => {
      const seed = Math.trunc(+e.target.value);
      if (!Number.isFinite(seed) || seed < 0) { seedInput.value = state.seed; return; }
      state.seed = seed;
      scheduleUpdate();
    });

    document.getElementById('shuffle-btn').addEventListener('click', () => {
      state.seed = newSeed();
      seedInput.value = state.seed;
      scheduleUpdate();
    });

    // Export
    document.getElementById('page-size').addEventListener('change', e => {
      state.pageSize = e.target.value;
      writeUrlState();
    });
    document.getElementById('cards-per-row').addEventListener('change', e => {
      state.cardsPerRow = +e.target.value;
      writeUrlState();
    });
    document.getElementById('bleed-marks').addEventListener('change', e => {
      state.bleedMarks = e.target.checked;
      writeUrlState();
    });
    document.getElementById('generate-pdf-btn').addEventListener('click', handleGeneratePDF);

    // Copy link
    const copyBtn = document.getElementById('copy-link-btn');
    copyBtn.addEventListener('click', async () => {
      writeUrlState();
      try {
        await navigator.clipboard.writeText(location.href);
        copyBtn.textContent = 'Copied';
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
    });

    // Color scheme
    const schemeBtn = document.getElementById('color-scheme-btn');
    const syncSchemeIcon = () => {
      schemeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';
    };
    syncSchemeIcon();
    schemeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('dm-theme', next);
      syncSchemeIcon();
    });

    // Find the match
    document.getElementById('match-btn').addEventListener('click', () => setMatchMode(!matchMode));
    document.getElementById('card-grid').addEventListener('click', e => {
      const wrapper = e.target.closest('.card-wrapper');
      if (matchMode && wrapper) selectCard(+wrapper.dataset.index);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && matchMode) { selected = []; applySelection(); }
    });
  }

  /** Bind a range input to a numeric state key and its <output> label. */
  function bindSlider(id, key, format) {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}-val`);
    const sync = () => {
      output.textContent = format(state[key]);
      input.style.setProperty('--fill', `${(100 * (state[key] - input.min)) / (input.max - input.min)}%`);
    };
    sliderSyncs[key] = () => { input.value = state[key]; sync(); };
    input.addEventListener('input', e => {
      state[key] = +e.target.value;
      sync();
      scheduleUpdate();
    });
  }

  /** Rebuild theme options, disabling themes too small for the current order. */
  function populateThemes() {
    const themeSel = document.getElementById('theme-select');
    const needed = state.order * state.order + state.order + 1;
    const themes = SpotItSymbols.getThemes();

    const fits = themes.find(t => t.key === preferredTheme).count >= needed;
    state.theme = fits ? preferredTheme : 'mixed';

    themeSel.innerHTML = '';
    themes.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.disabled = t.count < needed;
      opt.textContent = opt.disabled ? `${t.label} · needs ${needed}` : t.label;
      opt.selected = t.key === state.theme;
      themeSel.appendChild(opt);
    });
  }

  // ---------- URL state ----------

  /** Merge valid settings from the URL hash into `state`; invalid or missing keys are ignored. */
  function readUrlState() {
    const params = new URLSearchParams(location.hash.slice(1));
    const int = (key, ok) => {
      const v = Number(params.get(key));
      return params.has(key) && Number.isSafeInteger(v) && ok(v) ? v : undefined;
    };
    const oneOf = (key, list) => (list.includes(params.get(key)) ? params.get(key) : undefined);

    const parsed = {
      order: int('order', v => SpotItMath.SUPPORTED_ORDERS.includes(v)),
      theme: oneOf('theme', SpotItSymbols.getThemes().map(t => t.key)),
      shape: oneOf('shape', ['circle', 'square', 'hexagon', 'octagon']),
      layout: oneOf('layout', ['ring', 'grid', 'random']),
      sizeVariance: int('size', v => v >= 0 && v <= 25),
      maxAngle: int('spin', v => v >= 0 && v <= 180 && v % 10 === 0),
      seed: int('seed', v => v >= 0 && v <= 0xFFFFFFFF),
      pageSize: oneOf('page', ['a4', 'letter']),
      cardsPerRow: int('perRow', v => [2, 3, 4].includes(v)),
      bleedMarks: params.has('bleed') ? params.get('bleed') !== '0' : undefined,
    };
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) state[key] = value;
    }
    if (parsed.theme) preferredTheme = parsed.theme;
  }

  /** Mirror `state` into the URL hash without adding history entries. */
  function writeUrlState() {
    const params = new URLSearchParams({
      order: state.order,
      theme: preferredTheme,
      shape: state.shape,
      layout: state.layout,
      size: state.sizeVariance,
      spin: state.maxAngle,
      seed: state.seed,
      page: state.pageSize,
      perRow: state.cardsPerRow,
      bleed: state.bleedMarks ? 1 : 0,
    });
    history.replaceState(null, '', `#${params}`);
  }

  /** Push `state` into every control (used on load and when the hash changes). */
  function syncControls() {
    document.getElementById('order-select').value = state.order;
    populateThemes();
    document.getElementById(`shape-${state.shape}`).checked = true;
    document.getElementById(`layout-${state.layout}`).checked = true;
    Object.values(sliderSyncs).forEach(sync => sync());
    document.getElementById('seed-input').value = state.seed;
    document.getElementById('page-size').value = state.pageSize;
    document.getElementById('cards-per-row').value = state.cardsPerRow;
    document.getElementById('bleed-marks').checked = state.bleedMarks;
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(regenerate, 200);
  }

  function regenerate() {
    writeUrlState();
    let rawDeck;
    try {
      rawDeck = SpotItMath.buildDeck(state.order);
    } catch (e) {
      showError(e.message);
      return;
    }

    const prng = SpotItMath.makePRNG(state.seed);
    symbols = SpotItSymbols.getSymbols(state.theme, rawDeck.numSymbols, prng);

    if (symbols.length < rawDeck.numSymbols) {
      showError(`Theme "${state.theme}" only has ${symbols.length} symbols, but ${rawDeck.numSymbols} are needed for order ${state.order}. Try "Mixed" theme.`);
      return;
    }

    deck = SpotItMath.shuffleDeck(rawDeck, prng);
    clearError();
    renderAllCards(deck, symbols, prng);
  }

  function renderAllCards(deck, symbols, prng) {
    const grid = document.getElementById('card-grid');
    const frag = document.createDocumentFragment();
    cardSvgs = [];
    selected = [];

    const options = {
      shape: state.shape,
      layout: state.layout,
      randomSize: state.sizeVariance > 0,
      sizeRange: [1.0 - (state.sizeVariance / 100), 1.0 + (state.sizeVariance / 100)],
      randomAngle: state.maxAngle > 0,
      maxAngle: state.maxAngle,
    };
    const digits = String(deck.cards.length).length;

    for (let i = 0; i < deck.cards.length; i++) {
      const cardSymbols = deck.cards[i].map(idx => symbols[idx]);
      const svg = SpotItRenderer.renderCard(cardSymbols, options, prng, `clip-${i}`);
      cardSvgs.push(svg);

      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.className = 'card-wrapper';
      wrapper.dataset.index = i;
      wrapper.disabled = !matchMode;
      wrapper.appendChild(svg);

      const label = document.createElement('span');
      label.className = 'card-label';
      label.textContent = String(i + 1).padStart(digits, '0');
      wrapper.appendChild(label);

      frag.appendChild(wrapper);
    }

    grid.replaceChildren(frag);
    applySelection();
  }

  // ---------- Find the match ----------

  function setMatchMode(on) {
    matchMode = on;
    selected = [];
    document.getElementById('match-btn').setAttribute('aria-pressed', String(on));
    document.querySelector('.main').classList.toggle('match-mode', on);
    document.querySelectorAll('.card-wrapper').forEach(w => { w.disabled = !on; });
    applySelection();
  }

  function selectCard(i) {
    if (selected.length === 2) selected = [i];
    else if (selected.includes(i)) selected = selected.filter(s => s !== i);
    else selected.push(i);
    applySelection();
  }

  /** Sync card highlight classes and the hint text with `selected`. */
  function applySelection() {
    const hint = document.getElementById('match-hint');
    const wrappers = document.querySelectorAll('.card-wrapper');
    const label = i => wrappers[i].querySelector('.card-label').textContent;

    wrappers.forEach((w, i) => {
      w.classList.toggle('is-selected', selected.includes(i));
      w.classList.remove('is-paired');
      w.setAttribute('aria-pressed', String(selected.includes(i)));
    });
    document.querySelectorAll('.symbol.is-match').forEach(s => s.classList.remove('is-match'));

    hint.classList.toggle('hidden', !matchMode);
    if (!matchMode) return;

    if (selected.length < 2) {
      hint.textContent = selected.length
        ? `Card ${label(selected[0])} picked. Pick another card.`
        : 'Pick any two cards to reveal the symbol they share.';
      return;
    }

    const [a, b] = selected;
    const shared = deck.cards[a].find(s => deck.cards[b].includes(s));
    const glyph = symbols[shared];
    for (const i of selected) {
      wrappers[i].classList.add('is-paired');
      wrappers[i].querySelectorAll('.symbol').forEach(s => {
        if (s.dataset.symbol === glyph) s.classList.add('is-match');
      });
    }
    hint.textContent = `Cards ${label(a)} and ${label(b)} share ${glyph}. Pick another card to start over.`;
  }

  async function handleGeneratePDF() {
    const btn = document.getElementById('generate-pdf-btn');
    btn.disabled = true;
    btn.textContent = 'Exporting…';

    try {
      await SpotItPDF.generatePDF(cardSvgs, {
        pageSize: state.pageSize,
        cardsPerRow: state.cardsPerRow,
        margin: state.margin,
        bleedMarks: state.bleedMarks,
      });
    } catch (e) {
      showError('PDF generation failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export PDF';
    }
  }

  function showError(msg) {
    const el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearError() {
    const el = document.getElementById('error-msg');
    el.textContent = '';
    el.classList.add('hidden');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', SpotItApp.init);
