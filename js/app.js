/**
 * app.js — UI wiring & state management for the Spot It card generator.
 */

const SpotItApp = (() => {
  let state = {
    order: 7,
    theme: 'mixed',
    shape: 'circle',
    layout: 'ring',
    randomSize: false,
    sizeMin: 0.6,
    sizeMax: 1.4,
    randomAngle: true,
    maxAngle: 45,
    pageSize: 'a4',
    cardsPerRow: 1,
    margin: 15,
    bleedMarks: false,
    seed: Date.now(),
  };

  let deck = null;
  let symbols = [];
  let cardSvgs = [];
  let debounceTimer = null;

  function init() {
    bindControls();
    regenerate();
  }

  function bindControls() {
    // Order
    const orderSel = document.getElementById('order-select');
    SpotItMath.SUPPORTED_ORDERS.forEach(n => {
      const total = n * n + n + 1;
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `n = ${n}  →  ${total} cards, ${n + 1} symbols/card`;
      if (n === state.order) opt.selected = true;
      orderSel.appendChild(opt);
    });
    orderSel.addEventListener('change', e => { state.order = +e.target.value; scheduleUpdate(); });

    // Theme
    const themeSel = document.getElementById('theme-select');
    SpotItSymbols.getThemes().forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = `${t.label} (${t.count})`;
      if (t.key === state.theme) opt.selected = true;
      themeSel.appendChild(opt);
    });
    themeSel.addEventListener('change', e => { state.theme = e.target.value; scheduleUpdate(); });

    // Shape
    document.querySelectorAll('input[name="shape"]').forEach(inp => {
      inp.addEventListener('change', e => { state.shape = e.target.value; scheduleUpdate(); });
    });

    // Layout
    document.querySelectorAll('input[name="layout"]').forEach(inp => {
      inp.addEventListener('change', e => { state.layout = e.target.value; scheduleUpdate(); });
    });

    // Random size
    const sizeToggle = document.getElementById('random-size');
    const sizeMinInput = document.getElementById('size-min');
    const sizeMaxInput = document.getElementById('size-max');
    const sizeMinVal = document.getElementById('size-min-val');
    const sizeMaxVal = document.getElementById('size-max-val');

    sizeToggle.addEventListener('change', e => {
      state.randomSize = e.target.checked;
      console.log('Random size toggled:', state.randomSize);
      const group = document.getElementById('size-range-group');
      if (group) group.classList.toggle('hidden', !state.randomSize);
      scheduleUpdate();
    });
    sizeMinInput.addEventListener('input', e => {
      state.sizeMin = +e.target.value;
      if (sizeMinVal) sizeMinVal.textContent = state.sizeMin.toFixed(1);
      scheduleUpdate();
    });
    sizeMaxInput.addEventListener('input', e => {
      state.sizeMax = +e.target.value;
      if (sizeMaxVal) sizeMaxVal.textContent = state.sizeMax.toFixed(1);
      scheduleUpdate();
    });

    // Random angle
    const angleToggle = document.getElementById('random-angle');
    const maxAngleInput = document.getElementById('max-angle');
    const maxAngleVal = document.getElementById('max-angle-val');

    angleToggle.addEventListener('change', e => {
      state.randomAngle = e.target.checked;
      console.log('Random angle toggled:', state.randomAngle);
      const group = document.getElementById('angle-range-group');
      if (group) group.classList.toggle('hidden', !state.randomAngle);
      scheduleUpdate();
    });
    maxAngleInput.addEventListener('input', e => {
      state.maxAngle = +e.target.value;
      if (maxAngleVal) maxAngleVal.textContent = `${state.maxAngle}°`;
      scheduleUpdate();
    });

    // Export
    document.getElementById('page-size').addEventListener('change', e => { state.pageSize = e.target.value; });
    document.getElementById('cards-per-row').addEventListener('change', e => { state.cardsPerRow = +e.target.value; });
    document.getElementById('bleed-marks').addEventListener('change', e => { state.bleedMarks = e.target.checked; });

    // Shuffle
    document.getElementById('shuffle-btn').addEventListener('click', () => {
      state.seed = Date.now();
      scheduleUpdate();
    });

    // Generate PDF
    document.getElementById('generate-pdf-btn').addEventListener('click', handleGeneratePDF);
  }

  function scheduleUpdate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(regenerate, 200);
  }

  function regenerate() {
    try {
      deck = SpotItMath.buildDeck(state.order);
    } catch (e) {
      showError(e.message);
      return;
    }

    const prng = SpotItMath.makePRNG(state.seed);
    symbols = SpotItSymbols.getSymbols(state.theme, deck.numSymbols, prng);

    if (symbols.length < deck.numSymbols) {
      showError(`Theme "${state.theme}" only has ${symbols.length} symbols, but ${deck.numSymbols} are needed for order ${state.order}. Try "Mixed" theme.`);
      return;
    }

    clearError();
    updateStats(deck);
    renderAllCards(deck, symbols, prng);
  }

  function updateStats(deck) {
    document.getElementById('stat-cards').textContent = deck.numCards;
    document.getElementById('stat-symbols').textContent = deck.numSymbols;
    document.getElementById('stat-per-card').textContent = deck.symbolsPerCard;
  }

  function renderAllCards(deck, symbols, prng) {
    const grid = document.getElementById('card-grid');
    grid.innerHTML = '';
    cardSvgs = [];

    const options = {
      shape: state.shape,
      layout: state.layout,
      randomSize: state.randomSize,
      sizeRange: [state.sizeMin, state.sizeMax],
      randomAngle: state.randomAngle,
      maxAngle: state.maxAngle,
    };

    // Only show a preview subset for large decks
    const maxPreview = 1;
    const previewCount = Math.min(deck.cards.length, maxPreview);

    for (let i = 0; i < deck.cards.length; i++) {
      const cardSymbols = deck.cards[i].map(idx => symbols[idx]);
      const clipId = `clip-${i}`;
      const svg = SpotItRenderer.renderCard(cardSymbols, options, prng, clipId);
      cardSvgs.push(svg);

      if (i < previewCount) {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.appendChild(svg);

        const label = document.createElement('span');
        label.className = 'card-label';
        label.textContent = `#${i + 1}`;
        wrapper.appendChild(label);

        grid.appendChild(wrapper);
      }
    }

    // Show "and N more" if truncated
    const moreIndicator = document.getElementById('more-cards');
    if (deck.cards.length > maxPreview) {
      moreIndicator.textContent = `… and ${deck.cards.length - maxPreview} more cards in PDF`;
      moreIndicator.classList.remove('hidden');
    } else {
      moreIndicator.classList.add('hidden');
    }
  }

  async function handleGeneratePDF() {
    const btn = document.getElementById('generate-pdf-btn');
    btn.disabled = true;
    btn.textContent = 'Generating…';

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
      btn.textContent = 'Download PDF';
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
