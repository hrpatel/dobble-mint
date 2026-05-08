/**
 * symbols.js — Unicode symbol pool management for Spot It cards.
 * Provides themed sets of emoji/symbol glyphs.
 * Uses Array.from() for correct multi-byte Unicode handling.
 */

const SpotItSymbols = (() => {
  /** Helper: deduplicate an emoji string into an array of unique glyphs */
  function emojiArray(str) {
    return [...new Set(Array.from(str))].filter(c => c.codePointAt(0) > 255);
  }

  const THEMES = {
    animals: {
      label: 'Animals',
      glyphs: emojiArray('🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🐢🐍🦎🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🐈🐓🦃🦚🦜🦢🦩🐇🦝🦨🦡🦫🦦🦥🐁🐀🐿🦔🐉🦂🐚🪲🪳🪰🪱🦠🦭🦣'),
    },
    nature: {
      label: 'Nature & Weather',
      glyphs: emojiArray('🌸💐🌷🌹🥀🌺🌻🌼🌱🌲🌳🌴🌵🍀🍁🍂🍃🍄🌾🌈🌤🌥🌦🌧🌩🌨🌬💨🌪🌫🌊💧💦🔥✨🌟💫⭐🌙🌛🌜🌝🌞🪐🌍🌎🌏🗻🏔🌋🏜🏝🏞🪵🪨🪴🌿🍇🍈🍉🍊🍋🍌🍍🥭🍎🍏🍐🍑🍒🍓🥝🍅🥥🥑🌽🥕🥬🥔🍠🌶🥒🥦🥜🌰🍯🪷🪻'),
    },
    food: {
      label: 'Food & Drink',
      glyphs: emojiArray('🍕🍔🍟🌭🍿🥨🥯🍞🥐🥖🧀🥚🍳🥞🧇🥓🥩🍗🍖🌮🌯🥙🧆🥗🥣🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍩🍪🥛🍼🍵🧃🥤🧋🍶🍺🍻🥂🍷🥃🍸🍹🧉🍾🧊🥄🍴🍽🥡🥢'),
    },
    objects: {
      label: 'Objects & Activities',
      glyphs: emojiArray('⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🏓🏸🏒🥍🏑🥅🪁🏹🎣🥊🥋🎽🛹🛼🛷🥌🎿🏂🪂🤺🎯🎮🕹🎲🧩🎰🎳🎪🎭🎨🧵🧶🪡🎼🎵🎶🎙🎚🎛🎤🎧🎷🪗🎸🎹🎺🎻🪕🥁🪘📷📹🎥🎬📺📱💻🖥🖨💾💿📀🧮📞🔌🔋💡🔦🕯💸💵💎🧰🔧🔨🛠🔩🧱🧲🔮📿🧿🔭🔬💊💉🧬🧫🧪🧹🧺🧻🧼🪥🧽🪣🧴🔑🪑🛋🧸🪆🖼🪞🪟'),
    },
    transport: {
      label: 'Transport & Travel',
      glyphs: emojiArray('🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🛻🚚🚛🚜🏍🛵🚲🛴🛺🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉🛫🛬🛩💺🛰🚀🛸🚁🛶🚤🛥🛳🚢🚧🚦🚥🚏🗺🗿🗽🗼🏰🏯🏟🎡🎢🎠🏖🏠🏡🏘🏗🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛🛤🛣🌅🌄🌠🎇🎆🌇🌆🏙🌃🌌🌉🌁'),
    },
    shapes: {
      label: 'Shapes & Symbols',
      glyphs: emojiArray('⬛⬜◼◻◾◽▪▫🔶🔷🔸🔹🔺🔻💠🔘🔴🟠🟡🟢🔵🟣🟤⚫⚪🟥🟧🟨🟩🟦🟪🟫❤🧡💛💚💙💜🖤🤍🤎💔💕💞💓💗💖💘💝♈♉♊♋♌♍♎♏♐♑♒♓⛎🔱📛🔰⭕✅❌❎➕➖➗♾❓❔❕❗💱💲♻⚜🔅🔆⚠🚸⚡'),
    },
  };

  // Build mixed pool from all themes (deduplicated)
  const allGlyphs = new Set();
  for (const key of Object.keys(THEMES)) {
    THEMES[key].glyphs.forEach(g => allGlyphs.add(g));
  }
  THEMES.mixed = {
    label: 'Mixed (All)',
    glyphs: [...allGlyphs],
  };

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
    const pool = [...(THEMES[themeKey] || THEMES.mixed).glyphs];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  return { getThemes, getSymbols, THEMES };
})();
