/**
 * stats.js — Results-screen stats: per-card times, time distribution, fastest/slowest, wrong taps.
 * Takes `stats` objects from SpotItGame.summary(); touches only the element it is given.
 */

const SpotItStats = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BINS = 8;
  const CHART_W = 300;
  const CHART_H = 90;
  const BAR_GAP = 1;

  const seconds = ms => `${(ms / 1000).toFixed(1)}s`;

  function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function chart(label, values, barClass) {
    const svg = svgEl('svg', {
      viewBox: `0 0 ${CHART_W} ${CHART_H}`, class: 'stat-chart', role: 'img', 'aria-label': label,
    });
    const max = Math.max(...values, 1);
    const w = CHART_W / values.length;
    values.forEach((v, i) => {
      const h = Math.max(1, (v / max) * CHART_H);
      svg.appendChild(svgEl('rect', {
        x: i * w, y: CHART_H - h, width: Math.max(1, w - BAR_GAP), height: h,
        class: `stat-bar ${barClass(i)}`,
      }));
    });
    return svg;
  }

  function section(title, svg, left, right) {
    const wrap = document.createElement('figure');
    wrap.className = 'stat-figure';
    const cap = document.createElement('figcaption');
    cap.textContent = title;
    const axis = document.createElement('div');
    axis.className = 'stat-axis';
    for (const text of [left, right]) {
      const span = document.createElement('span');
      span.textContent = text;
      axis.appendChild(span);
    }
    wrap.append(cap, svg, axis);
    return wrap;
  }

  function facts(stats) {
    const label = c => c && `#${stats.cards.indexOf(c) + 1} · ${seconds(c.ms)}`;
    const rows = [
      ['Fastest card', label(stats.fastest)],
      ['Slowest card', label(stats.slowest)],
      ['Average', seconds(stats.averageMs)],
      ['Wrong taps', String(stats.wrongTaps)],
    ];
    const dl = document.createElement('dl');
    dl.className = 'stat-facts';
    for (const [name, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = name;
      const dd = document.createElement('dd');
      dd.textContent = value ?? '–';
      dl.append(dt, dd);
    }
    return dl;
  }

  /** Fill `el` with the stats for one player. */
  function renderOne(el, stats) {
    const times = stats.cards.map(c => c.ms);
    if (!times.length) { el.replaceChildren(); return; }
    const min = Math.min(...times);
    const max = Math.max(...times);

    const perCard = chart(
      'Time per card in play order',
      times,
      i => `${stats.cards[i].wrong ? 'is-wrong' : ''} p${stats.cards[i].player}`,
    );
    const spread = chart(
      'How many cards took each length of time',
      SpotItGame.histogram(times, BINS),
      () => '',
    );
    el.replaceChildren(
      facts(stats),
      section('Time per card', perCard, 'first', 'last'),
      section('Spread of times', spread, seconds(min), seconds(max)),
    );
  }

  /**
   * Fill `el` with one titled block per entry, in the order given. Entries without cards
   * (a player who won nothing) are skipped.
   * @param {HTMLElement} el
   * @param {{ title: string, stats: object }[]} entries
   */
  function render(el, entries) {
    el.replaceChildren(...entries.filter(e => e.stats.cards.length).map(({ title, stats }) => {
      const block = document.createElement('section');
      block.className = 'stat-player';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const body = document.createElement('div');
      body.className = 'stat-player-body';
      renderOne(body, stats);
      block.append(heading, body);
      return block;
    }));
  }

  return { render };
})();
