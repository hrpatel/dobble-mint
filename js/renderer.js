/**
 * renderer.js — SVG card renderer for Spot It cards.
 * Supports multiple card shapes, symbol layouts, random sizing and rotation.
 */

const SpotItRenderer = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const CARD_SIZE = 300; // viewBox dimension
  const CENTER = CARD_SIZE / 2;
  const RADIUS = CARD_SIZE / 2 - 10; // inset for padding

  /** Create SVG element helper */
  function el(tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  /** Build the clip path shape */
  function shapeClipPath(shape) {
    const g = el('clipPath', { id: 'card-clip' });
    switch (shape) {
      case 'circle':
        g.appendChild(el('circle', { cx: CENTER, cy: CENTER, r: RADIUS }));
        break;
      case 'square':
        g.appendChild(el('rect', {
          x: CENTER - RADIUS, y: CENTER - RADIUS,
          width: RADIUS * 2, height: RADIUS * 2, rx: 16, ry: 16,
        }));
        break;
      case 'hexagon':
      case 'octagon': {
        const sides = shape === 'hexagon' ? 6 : 8;
        const pts = [];
        for (let i = 0; i < sides; i++) {
          const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
          pts.push(`${CENTER + RADIUS * Math.cos(a)},${CENTER + RADIUS * Math.sin(a)}`);
        }
        g.appendChild(el('polygon', { points: pts.join(' ') }));
        break;
      }
    }
    return g;
  }

  /** Get the outline path data (for visible border) */
  function shapeBorderEl(shape) {
    switch (shape) {
      case 'circle':
        return el('circle', {
          cx: CENTER, cy: CENTER, r: RADIUS,
          fill: 'white', stroke: '#334155', 'stroke-width': 3,
        });
      case 'square':
        return el('rect', {
          x: CENTER - RADIUS, y: CENTER - RADIUS,
          width: RADIUS * 2, height: RADIUS * 2, rx: 16, ry: 16,
          fill: 'white', stroke: '#334155', 'stroke-width': 3,
        });
      case 'hexagon':
      case 'octagon': {
        const sides = shape === 'hexagon' ? 6 : 8;
        const pts = [];
        for (let i = 0; i < sides; i++) {
          const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
          pts.push(`${CENTER + RADIUS * Math.cos(a)},${CENTER + RADIUS * Math.sin(a)}`);
        }
        return el('polygon', {
          points: pts.join(' '),
          fill: 'white', stroke: '#334155', 'stroke-width': 3,
        });
      }
    }
  }

  /** Grid layout: place symbols in a centered grid */
  function layoutGrid(count, shape) {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    
    // For squares, we can use the full RADIUS*2. For circles/polygons, use inscribed square.
    const usableSize = (shape === 'square') ? RADIUS * 2 : RADIUS * 1.414;
    
    // gapRatio is the margin between symbols as a fraction of the symbol size.
    // Also use this gap for the outer border.
    const gapRatio = 0.35; 
    const symbolW = usableSize / (cols + (cols + 1) * gapRatio);
    const symbolH = usableSize / (rows + (rows + 1) * gapRatio);
    
    const baseSize = Math.min(symbolW, symbolH);
    
    const totalW = cols * baseSize + (cols - 1) * (baseSize * gapRatio);
    const totalH = rows * baseSize + (rows - 1) * (baseSize * gapRatio);
    
    const startX = CENTER - totalW / 2 + baseSize / 2;
    const startY = CENTER - totalH / 2 + baseSize / 2;
    
    const positions = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (baseSize * (1 + gapRatio));
      const y = startY + row * (baseSize * (1 + gapRatio));
      positions.push({ x, y, baseSize });
    }
    return positions;
  }

  /** Ring layout: one center + rest on a ring */
  function layoutRing(count) {
    const positions = [];
    if (count === 0) return positions;
    if (count === 1) {
      positions.push({ x: CENTER, y: CENTER, baseSize: RADIUS * 0.8 });
      return positions;
    }
    if (count <= 3) {
      // For count 2 or 3, a pure ring looks better (line or triangle) than a center point
      const innerR = RADIUS * 0.45; 
      const ringSize = RADIUS * 0.5;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        positions.push({
          x: CENTER + innerR * Math.cos(angle),
          y: CENTER + innerR * Math.sin(angle),
          baseSize: ringSize,
        });
      }
      return positions;
    }
    
    // For count > 3, use center + ring
    const innerR = RADIUS * 0.6;
    const centerSize = RADIUS * 0.4;
    
    const availableArc = (2 * Math.PI * innerR) / (count - 1);
    const ringSize = Math.min(RADIUS * 0.4, availableArc * 0.75);

    // center symbol
    positions.push({ x: CENTER, y: CENTER, baseSize: centerSize });
    // ring symbols
    for (let i = 1; i < count; i++) {
      const angle = (Math.PI * 2 * (i - 1)) / (count - 1) - Math.PI / 2;
      positions.push({
        x: CENTER + innerR * Math.cos(angle),
        y: CENTER + innerR * Math.sin(angle),
        baseSize: ringSize,
      });
    }
    return positions;
  }

  /** Random layout: Poisson-disk-ish via rejection sampling */
  function layoutRandom(count, prng) {
    const positions = [];
    if (count === 0) return positions;

    // Dynamically calculate size based on how many we need to fit
    const baseSize = Math.min(RADIUS * 0.6, (RADIUS * 1.3) / Math.sqrt(count));
    const minDist = baseSize * 1.25; // 25% gap between symbol centers
    
    // Max distance from center to ensure symbol doesn't touch border (5% padding)
    const maxDist = Math.max(0, RADIUS * 0.95 - baseSize / 2);

    for (let i = 0; i < count; i++) {
      let placed = false;
      let currentMinDist = minDist;
      
      for (let attempt = 0; attempt < 800; attempt++) {
        // If struggling to find space, slowly reduce the required distance to force placement
        if (attempt > 400) {
          currentMinDist *= 0.98; 
        }
        
        // Use sqrt(prng) for uniform area distribution in the circle
        const angle = prng() * Math.PI * 2;
        const dist = Math.sqrt(prng()) * maxDist; 
        const x = CENTER + dist * Math.cos(angle);
        const y = CENTER + dist * Math.sin(angle);
        
        let ok = true;
        for (const p of positions) {
          const dx = p.x - x, dy = p.y - y;
          if (Math.sqrt(dx * dx + dy * dy) < currentMinDist) { ok = false; break; }
        }
        
        if (ok) { positions.push({ x, y, baseSize }); placed = true; break; }
      }
      
      if (!placed) {
        // Ultimate fallback
        const angle = prng() * Math.PI * 2;
        const dist = Math.sqrt(prng()) * maxDist;
        positions.push({ x: CENTER + dist * Math.cos(angle), y: CENTER + dist * Math.sin(angle), baseSize });
      }
    }
    return positions;
  }

  /**
   * Render a single card as an SVG element.
   * @param {string[]} symbols — the emoji glyphs for this card
   * @param {object} options — { shape, layout, randomSize, sizeRange, randomAngle, maxAngle }
   * @param {function} prng — seedable random function
   * @param {string} clipId — unique clip path id
   */
  function renderCard(symbols, options, prng, clipId) {
    const { shape = 'circle', layout = 'ring', randomSize = false, sizeRange = [0.6, 1.4], randomAngle = false, maxAngle = 45 } = options;

    const svg = el('svg', {
      xmlns: NS, viewBox: `0 0 ${CARD_SIZE} ${CARD_SIZE}`,
      width: CARD_SIZE, height: CARD_SIZE,
    });

    // Defs with clip path
    const defs = el('defs');
    const clip = shapeClipPath(shape);
    clip.setAttribute('id', clipId);
    defs.appendChild(clip);
    svg.appendChild(defs);

    // Background with border
    svg.appendChild(shapeBorderEl(shape));

    // Clipped content group
    const g = el('g', { 'clip-path': `url(#${clipId})` });

    // Layout positions
    let positions;
    switch (layout) {
      case 'grid': positions = layoutGrid(symbols.length, shape); break;
      case 'random': positions = layoutRandom(symbols.length, prng); break;
      case 'ring': default: positions = layoutRing(symbols.length); break;
    }

    // Place symbols
    for (let i = 0; i < symbols.length; i++) {
      const pos = positions[i];
      if (!pos) continue;

      let finalSize = pos.baseSize;
      const sizeRand = prng();
      if (randomSize && sizeRange && sizeRange.length === 2) {
        const factor = sizeRange[0] + sizeRand * (sizeRange[1] - sizeRange[0]);
        finalSize *= factor;
      }

      const angleRand = prng();
      let angle = 0;
      if (randomAngle) {
        angle = (angleRand - 0.5) * 2 * maxAngle;
      }

      // Use a group for rotation/scaling for better browser compatibility
      const symbolG = el('g', {
        transform: `translate(${pos.x}, ${pos.y}) rotate(${angle})`
      });

      const text = el('text', {
        x: 0, y: 0,
        'font-size': Math.round(finalSize),
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'pointer-events': 'none'
      });
      text.textContent = symbols[i];
      symbolG.appendChild(text);
      g.appendChild(symbolG);
    }

    svg.appendChild(g);
    return svg;
  }

  return { renderCard, CARD_SIZE };
})();
