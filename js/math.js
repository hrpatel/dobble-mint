/**
 * math.js — Finite Projective Plane for Spot It card generation.
 * Supports prime orders: 2, 3, 5, 7, 11, 13
 * Each card is a line in PG(2,n); each symbol is a point.
 * Any two cards share exactly one symbol.
 */

const SpotItMath = (() => {
  const SUPPORTED_ORDERS = [2, 3, 5, 7, 11, 13];

  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }

  /** Modular inverse via brute force (n is small prime) */
  function modInv(a, n) {
    a = ((a % n) + n) % n;
    for (let x = 1; x < n; x++) if ((a * x) % n === 1) return x;
    return 1;
  }

  /** Canonical representative of homogeneous triple (first nonzero → 1) */
  function canonical(a, b, c, n) {
    const first = a !== 0 ? a : b !== 0 ? b : c;
    const inv = modInv(first, n);
    return [(a * inv) % n, (b * inv) % n, (c * inv) % n];
  }

  function tripleKey(t) { return `${t[0]},${t[1]},${t[2]}`; }

  /**
   * Build a Spot It deck for prime order n.
   * Returns { cards, numCards, numSymbols, symbolsPerCard, order }
   * cards[i] = sorted array of symbol indices on card i
   */
  function buildDeck(order) {
    const n = order;
    if (!isPrime(n)) throw new Error(`Order ${n} is not prime.`);

    // Enumerate all n²+n+1 canonical points of PG(2,n)
    const points = [];
    const pointIdx = new Map();
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const c = canonical(x, y, z, n);
          const k = tripleKey(c);
          if (!pointIdx.has(k)) {
            pointIdx.set(k, points.length);
            points.push(c);
          }
        }
      }
    }

    // Lines share the same canonical form as points (PG(2,n) is self-dual)
    const lines = points;

    // For each line [a,b,c], collect points satisfying ax+by+cz ≡ 0 (mod n)
    const cards = lines.map(([a, b, c]) =>
      points.reduce((acc, [x, y, z], i) => {
        if ((a * x + b * y + c * z) % n === 0) acc.push(i);
        return acc;
      }, [])
    );

    return {
      cards,
      numCards: cards.length,
      numSymbols: points.length,
      symbolsPerCard: n + 1,
      order: n,
    };
  }

  /** Verify every pair of cards shares exactly 1 symbol. Returns {ok, errors[]} */
  function verify(deck) {
    const errors = [];
    const { cards } = deck;
    for (let i = 0; i < cards.length; i++) {
      const setI = new Set(cards[i]);
      for (let j = i + 1; j < cards.length; j++) {
        const shared = cards[j].filter(s => setI.has(s));
        if (shared.length !== 1) errors.push({ i, j, shared });
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /** Seedable PRNG (mulberry32) for reproducible layouts */
  function makePRNG(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { buildDeck, verify, makePRNG, SUPPORTED_ORDERS, isPrime };
})();
