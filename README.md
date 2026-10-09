# ⊙ Dobble Mint (Spot It Card Generator)

A premium single-page application for generating custom **Spot It** (also known as **Dobble**) game cards. Built with pure mathematics and modern web technologies.

![alt text](/media/preview.png)

## 🧬 The Mathematics

The "magic" behind Spot It is based on **Finite Projective Planes**. 
- Each **card** represents a **line** in the projective plane.
- Each **symbol** represents a **point** in the projective plane.
- By the axioms of projective geometry, **any two lines intersect at exactly one point**.
- This translates to: **Any two cards share exactly one symbol in common.**

This generator currently supports prime orders $n \in \{2, 3, 5, 7, 11, 13\}$. 
- **Total Cards:** $n^2 + n + 1$
- **Symbols per Card:** $n + 1$
- **Total Unique Symbols:** $n^2 + n + 1$

## ✨ Features

- **Mathematical Precision:** Generates valid incidence structures for various orders.
- **Symbol Themes:** Choose from curated emoji sets (Animals, Nature, Food, Objects, etc.).
- **Card Shapes:** Generate cards as Circles, Squares, Hexagons, or Octagons.
- **Layout Engines:**
  - **Ring:** Classic Spot It layout with a center symbol.
  - **Grid:** Orderly placement for clarity.
  - **Scatter:** Poisson-disk sampling for a more organic feel.
- **Deep Customization:**
  - Size variance and rotation sliders.
  - Editable seed for reproducible decks.
- **Shareable Links:** Every setting and the seed live in the URL, so a link recreates the exact deck.
- **Find the Match:** Click any two cards to highlight the symbol they share.
- **Light and Dark Modes:** Follows your system setting, with a manual toggle.
- **High-Quality PDF Export:** Hardware-accelerated canvas rasterization generates incredibly crisp, print-ready PDFs (with optional bleed marks) while perfectly preserving complex system emojis without bloating file sizes.

## 🚀 Getting Started

Simply open `index.html` in any modern web browser. No server or installation required!

### Local Development
The project is built with:
- **Core:** HTML5, CSS3, Vanilla JavaScript.
- **PDF Engine:** [jsPDF](https://github.com/parallax/jsPDF) (using high-fidelity canvas rasterization).
- **Fonts:** Inter (via Google Fonts).

## 🛠️ Project Structure

```text
dobble-mint/
├── index.html       # Main application shell
├── css/
│   └── style.css    # Tabletop design system (light + dark)
└── js/
    ├── math.js      # Projective plane construction engine
    ├── symbols.js   # Unicode/Emoji pool management
    ├── renderer.js  # SVG card rendering logic
    ├── pdf.js       # PDF assembly and export
    └── app.js       # UI orchestration & state management
```

## 📝 License

MIT License - feel free to use and modify for your own game nights!
