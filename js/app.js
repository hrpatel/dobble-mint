/**
 * app.js — UI wiring & state management for the Spot It card generator.
 */

const SpotItApp = (() => {
  let state = { ...SpotItDeck.DEFAULTS, margin: 5, seed: SpotItDeck.newSeed() };

  let deck = null;
  let symbols = [];
  let cardSvgs = [];
  let debounceTimer = null;
  let matchMode = false;
  let selected = [];
  let preferredTheme = state.theme; // user's last explicit pick; restored when it fits again
  let view = 'designer'; // 'designer' | 'play', mirrored in the hash as view=play
  let designerScroll = { page: 0, panel: 0 };
  const sliderSyncs = {};

  function init() {
    bindControls();
    SpotItPlay.init({
      getDeck: () => (deck ? { key: urlHash('designer'), settings: state, deck, symbols, cardSvgs } : null),
      setOrder: order => {
        state.order = order;
        syncControls();
        regenerate();
      },
      exit: exitPlay,
    });
    route();
    // Fires on manual hash edits and on Back/Forward between designer and play entries
    window.addEventListener('hashchange', route);
  }

  // ---------- Views ----------

  /** Apply the URL: rebuild only if deck settings changed, then show the requested view. */
  function route() {
    const before = deck && urlHash('designer');
    const next = new URLSearchParams(location.hash.slice(1)).get('view') === 'play' ? 'play' : 'designer';
    if (view === 'play' && next === 'designer' && deck) {
      // Back from the game keeps the deck as it is now (its size may have changed in the game)
      view = next;
      writeUrlState();
      applyView();
      return;
    }
    view = next;
    readUrlState();
    if (urlHash('designer') !== before) {
      syncControls();
      regenerate();
    } else {
      writeUrlState();
    }
    applyView();
  }

  function applyView() {
    const designer = document.getElementById('designer-view');
    const playing = view === 'play';
    if (playing === SpotItPlay.isOpen()) return;

    if (playing) {
      designerScroll = { page: window.scrollY, panel: document.getElementById('panel').scrollTop };
      designer.classList.add('hidden');
      SpotItPlay.open();
      window.scrollTo(0, 0);
    } else {
      SpotItPlay.close();
      designer.classList.remove('hidden');
      window.scrollTo(0, designerScroll.page);
      document.getElementById('panel').scrollTop = designerScroll.panel;
    }
  }

  function enterPlay() {
    view = 'play';
    history.pushState({ fromDesigner: true }, '', `#${urlHash('play')}`);
    applyView();
  }

  /** Leave the game: pop our own history entry if we pushed it, else replace the URL. */
  function exitPlay() {
    if (history.state?.fromDesigner) {
      history.back();
      return;
    }
    view = 'designer';
    writeUrlState();
    applyView();
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
      state.seed = SpotItDeck.newSeed();
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

    // Play this deck
    document.getElementById('play-btn').addEventListener('click', enterPlay);

    // Logo: back to the top of the designer
    document.getElementById('brand-link').addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.getElementById('panel').scrollTo({ top: 0, behavior: 'smooth' });
    });

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
    const needed = SpotItDeck.symbolsNeeded(state.order);
    const themes = SpotItSymbols.getThemes();
    state.theme = SpotItDeck.themeFor(preferredTheme, state.order);

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
    const parsed = SpotItDeck.parse(location.hash);
    Object.assign(state, parsed);
    if (parsed.theme) preferredTheme = parsed.theme;
  }

  /** Hash for the current settings, plus view=play when `v` is the game. */
  function urlHash(v = view) {
    const hash = SpotItDeck.serialize({ ...state, theme: preferredTheme });
    return v === 'play' ? `${hash}&view=play` : hash;
  }

  /** Mirror `state` into the URL hash without adding history entries. */
  function writeUrlState() {
    history.replaceState(history.state, '', `#${urlHash()}`);
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
    try {
      ({ deck, symbols, cardSvgs } = SpotItDeck.build(state));
    } catch (e) {
      showError(e.message);
      return;
    }
    clearError();
    renderAllCards();
  }

  function renderAllCards() {
    const grid = document.getElementById('card-grid');
    const frag = document.createDocumentFragment();
    const digits = String(cardSvgs.length).length;
    selected = [];

    cardSvgs.forEach((svg, i) => {
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
    });

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
