/**
 * play.js — Game view: deals "The Tower" with the designer's current deck and handles taps.
 * Rules live in game.js; the host (app.js) owns the deck, the URL, and switching views.
 */

const SpotItPlay = (() => {
  const TOUCH = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  const MATCH_FLASH_MS = 350;
  const RESULTS_DELAY_MS = 600;
  const CARD_GAP = 8; // px between cards and around HUD text

  // host: { getDeck() -> { key, settings, deck, symbols, cardSvgs } | null, setOrder(n), exit() }
  let host = null;
  let view = null; // the host's deck with cloned card SVGs we can move between slots
  let viewKey = '';
  let symbolIndex = null; // glyph -> symbol index
  let dealPrng = null;
  let game = null;
  let mode = 'solo';
  let cardShape = 'circle';
  let rafId = 0;
  let isOpen = false;

  const $ = id => document.getElementById(id);
  const board = () => $('board');
  const slot = name => board().querySelector(`[data-slot="${name}"]`);
  const seat = player => board().querySelector(`[data-seat="${player}"]`);

  function init(h) {
    host = h;
    bindStart();
    bindBoard();
  }

  /** Show the start screen for the host's current deck. */
  function open() {
    isOpen = true;
    const d = host.getDeck();
    if (d) $('play-order').value = d.settings.order;
    showMenu();
    $('play-view').classList.remove('hidden');
  }

  function close() {
    isOpen = false;
    stopTimer();
    game = null;
    document.body.classList.remove('playing');
    $('play-view').classList.add('hidden');
  }

  // ---------- Start screen ----------

  function bindStart() {
    const orderSel = $('play-order');
    SpotItMath.SUPPORTED_ORDERS.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `${SpotItDeck.symbolsNeeded(n)} cards · ${n + 1} per card`;
      orderSel.appendChild(opt);
    });
    orderSel.addEventListener('change', e => {
      host.setOrder(+e.target.value);
      syncBest();
    });

    document.querySelectorAll('input[name="mode"]').forEach(inp => {
      inp.addEventListener('change', e => { mode = e.target.value; syncBest(); });
    });
    if (!TOUCH) {
      $('mode-duel').disabled = true;
      $('mode-note').textContent = '2 Players needs a touch screen: a phone or tablet laid flat.';
    }

    for (const id of ['play-brand-link', 'edit-link', 'play-back-btn']) {
      $(id).addEventListener('click', e => { e.preventDefault(); host.exit(); });
    }
    $('start-btn').addEventListener('click', startGame);
    $('again-btn').addEventListener('click', startGame);
    $('menu-btn').addEventListener('click', showMenu);
    $('quit-btn').addEventListener('click', showMenu);
  }

  function readBest(cards) {
    try { return Number(localStorage.getItem(`dm-best-${cards}`)) || null; } catch { return null; }
  }

  function writeBest(cards, ms) {
    try { localStorage.setItem(`dm-best-${cards}`, String(Math.round(ms))); } catch { /* private mode */ }
  }

  function syncBest() {
    const best = mode === 'solo' && readBest(SpotItDeck.symbolsNeeded(+$('play-order').value));
    $('best-time').textContent = best ? `Best time: ${formatTime(best)}` : '';
  }

  function showMenu() {
    stopTimer();
    game = null;
    board().classList.add('hidden');
    $('results').classList.add('hidden');
    $('start-screen').classList.remove('hidden');
    $('play-error').classList.add('hidden');
    document.body.classList.remove('playing');
    syncBest();
  }

  // ---------- Game ----------

  /**
   * Copy a designer card for the board. The clip-path id is renamed so it never resolves to the
   * hidden designer copy (resources inside display:none subtrees may not render).
   */
  function cloneCard(svg, i) {
    const copy = svg.cloneNode(true);
    const id = `play-clip-${i}`;
    copy.querySelector('clipPath').id = id;
    copy.querySelector('[clip-path]').setAttribute('clip-path', `url(#${id})`);
    copy.querySelectorAll('.is-match').forEach(s => s.classList.remove('is-match'));
    return copy;
  }

  function startGame() {
    const d = host.getDeck();
    if (!d) {
      $('play-error').textContent = 'This deck could not be built. Edit the deck and try again.';
      $('play-error').classList.remove('hidden');
      return;
    }
    if (d.key !== viewKey) {
      view = { deck: d.deck, symbols: d.symbols, cardSvgs: d.cardSvgs.map(cloneCard) };
      symbolIndex = new Map(d.symbols.map((glyph, i) => [glyph, i]));
      dealPrng = SpotItMath.makePRNG(d.settings.seed); // first deal reproducible from the link
      viewKey = d.key;
    }
    cardShape = d.settings.shape;
    view.cardSvgs.forEach(svg => svg.querySelectorAll('.is-match').forEach(s => s.classList.remove('is-match')));
    ['p0', 'p1', 'center'].forEach(name => slot(name).replaceChildren());
    [0, 1].forEach(p => seat(p).classList.remove('locked'));

    game = SpotItGame.create(view.deck.cards, mode, dealPrng, performance.now());

    board().dataset.mode = mode;
    $('start-screen').classList.add('hidden');
    $('results').classList.add('hidden');
    board().classList.remove('hidden');
    document.body.classList.add('playing');
    $('penalty-toast').textContent = '';
    renderState();
    layoutBoard();
    if (mode === 'solo') startTimer();
  }

  // ---------- Layout ----------

  /** Size cards to the largest that fits the board for the current mode. */
  function layoutBoard() {
    if (!game) return;
    const b = board();
    const cs = getComputedStyle(b);
    const w = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const size = mode === 'solo' ? soloCardSize(w, h) : duelCardSize(w, h);
    b.style.setProperty('--card', `${Math.max(0, Math.floor(size))}px`);
  }

  /** Stack (pile above your card) or side by side, whichever gives bigger cards. */
  function soloCardSize(w, h) {
    const centerRow = board().querySelector('.center-row');
    const rowGap = parseFloat(getComputedStyle(centerRow).rowGap) || 0;
    const chrome = $('solo-hud').offsetHeight + board().querySelector('.center-meta').offsetHeight + 2 * rowGap;
    const stack = Math.min(w, (h - chrome) / 2);
    const side = Math.min(w / 2 - CARD_GAP, h - chrome);
    board().dataset.layout = side > stack ? 'side' : 'stack';
    return Math.max(stack, side);
  }

  /**
   * Pile at left-middle, players at top-right and bottom-right. For circles, the largest
   * diameter d makes the pile touch both players: (w-d)² + ((h-d)/2)² = d², which solves to
   * d = 4w + h - 2√(3w² + 2wh). Hexagons and octagons sit inside that circle; squares cannot
   * interleave, so they need clear rows or columns. Room is kept for the scores on the left.
   */
  function duelCardSize(w, h) {
    const d = cardShape === 'square'
      ? Math.min(w, h / 2, Math.max(w / 2, h / 3))
      : Math.min(w, h / 2, 4 * w + h - 2 * Math.sqrt(3 * w * w + 2 * w * h));
    const hudWidth = Math.max(...[0, 1].map(p => seat(p).querySelector('.seat-hud').offsetWidth));
    return Math.min(d - CARD_GAP, w - hudWidth - 2 * CARD_GAP);
  }

  /** Place each card's SVG in its slot. Players first: the old center may move to a player. */
  function renderState() {
    game.players.forEach((p, i) => slot(`p${i}`).replaceChildren(view.cardSvgs[p.card]));
    if (game.center !== null) slot('center').replaceChildren(view.cardSvgs[game.center]);
    else slot('center').replaceChildren();

    const s = SpotItGame.summary(game, performance.now());
    $('cards-left').textContent = s.cardsLeft;
    s.scores.forEach((n, i) => { $(`score-${i}`).textContent = n; });
  }

  function bindBoard() {
    new ResizeObserver(layoutBoard).observe(board());

    // pointerdown (not click): lower latency and lets two players tap at the same time
    board().addEventListener('pointerdown', e => {
      if (!game) return;
      const sym = e.target.closest('.symbol');
      const slotEl = e.target.closest('[data-slot]');
      if (!sym || !slotEl) return;
      const player = playerForSlot(slotEl.dataset.slot);
      if (player === null) return;
      e.preventDefault();
      handleClaim(player, symbolIndex.get(sym.dataset.symbol));
    });
  }

  /** Solo may tap either card; in a duel each player taps only their own. */
  function playerForSlot(name) {
    if (name === 'p0') return 0;
    if (name === 'p1') return mode === 'duel' ? 1 : null;
    return mode === 'solo' ? 0 : null;
  }

  function handleClaim(player, symbol) {
    const res = SpotItGame.claim(game, player, symbol, performance.now());

    if (res.result === 'match') {
      renderState();
      flashMatch(player, symbol);
      if (res.over) {
        stopTimer();
        const finished = game;
        setTimeout(() => { if (game === finished) showResults(); }, RESULTS_DELAY_MS);
      }
    } else if (res.result === 'wrong') {
      restartAnimation(seat(player), 'shake');
      navigator.vibrate?.(60);
      if (game.cfg.lockoutMs) lockSeat(player, game.cfg.lockoutMs);
      if (game.cfg.penaltyMs) showPenalty(game.cfg.penaltyMs);
    }
  }

  function flashMatch(player, symbol) {
    const glyph = view.symbols[symbol];
    const svg = view.cardSvgs[game.players[player].card];
    const sym = [...svg.querySelectorAll('.symbol')].find(s => s.dataset.symbol === glyph);
    sym.classList.add('is-match');
    restartAnimation(seat(player), 'won');
    setTimeout(() => sym.classList.remove('is-match'), MATCH_FLASH_MS);
  }

  function lockSeat(player, ms) {
    const el = seat(player);
    el.classList.add('locked');
    const current = game;
    setTimeout(() => { if (game === current) el.classList.remove('locked'); }, ms);
  }

  function showPenalty(ms) {
    const toast = $('penalty-toast');
    toast.textContent = `+${ms / 1000}s`;
    restartAnimation(toast, 'show');
  }

  /** Re-trigger a CSS animation class even if it is already applied. */
  function restartAnimation(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---------- Timer & results ----------

  function formatTime(ms) {
    const tenths = Math.floor(ms / 100);
    const m = Math.floor(tenths / 600);
    const s = ((tenths % 600) / 10).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  }

  function startTimer() {
    stopTimer();
    const tick = () => {
      $('timer').textContent = formatTime(SpotItGame.summary(game, performance.now()).totalMs);
      rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopTimer() {
    cancelAnimationFrame(rafId);
    if (game && mode === 'solo') $('timer').textContent = formatTime(SpotItGame.summary(game, performance.now()).totalMs);
  }

  function fillResult(el, title, lines) {
    const h = document.createElement('h2');
    h.className = 'result-title';
    h.textContent = title;
    el.replaceChildren(h, ...lines.map(text => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    }));
  }

  function showResults() {
    const s = SpotItGame.summary(game, performance.now());
    const cards = game.cards.length;
    const results = $('results');
    results.dataset.mode = mode;

    if (mode === 'solo') {
      const best = readBest(cards);
      const isBest = !best || s.totalMs < best;
      if (isBest) writeBest(cards, s.totalMs);
      const mistakes = s.mistakes[0];
      fillResult($('result-0'), isBest ? 'New best time!' : 'Deck cleared!', [
        formatTime(s.totalMs),
        mistakes ? `${mistakes} wrong tap${mistakes > 1 ? 's' : ''} (+${s.penaltyMs / 1000}s)` : 'No wrong taps',
        isBest ? `${cards}-card deck` : `Best: ${formatTime(best)}`,
      ]);
    } else {
      [0, 1].forEach(p => {
        const won = s.winner === p;
        fillResult($(`result-${p}`), won ? 'You win!' : 'So close!', [
          `${s.scores[p]} – ${s.scores[1 - p]}`,
        ]);
      });
    }
    results.classList.remove('hidden');
  }

  return { init, open, close, isOpen: () => isOpen };
})();
