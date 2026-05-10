/**
 * pdf.js — PDF export for Spot It cards.
 * Rasterizes SVG cards to canvas images, then embeds them in jsPDF.
 * This avoids svg2pdf.js font/emoji issues entirely.
 */

const SpotItPDF = (() => {
  const RASTER_SCALE = 3; // 3x for crisp print quality

  /**
   * Convert an SVG element to a PNG data URL via canvas.
   */
  function svgToImage(svgEl) {
    return new Promise((resolve, reject) => {
      const clone = svgEl.cloneNode(true);
      const w = parseInt(clone.getAttribute('width')) || 300;
      const h = parseInt(clone.getAttribute('height')) || 300;

      // Serialize SVG to a data URL
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clone);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * RASTER_SCALE;
        canvas.height = h * RASTER_SCALE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(RASTER_SCALE, RASTER_SCALE);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to rasterize card SVG'));
      };
      img.src = url;
    });
  }

  /**
   * Generate a PDF from rendered card SVG elements.
   * @param {SVGElement[]} cardSvgs — array of SVG elements
   * @param {object} options — { pageSize, cardsPerRow, margin, bleedMarks }
   */
  async function generatePDF(cardSvgs, options = {}) {
    const {
      pageSize = 'a4',
      cardsPerRow = 1,
      margin = 5, // mm
      bleedMarks = true,
    } = options;

    const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFLib) {
      throw new Error('jsPDF library not loaded. Check your internet connection and try again.');
    }
    const doc = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: pageSize });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    let cardMM = Math.floor(usableW / cardsPerRow);
    
    // Smart fit: if shrinking the card by just 1mm allows us to fit a whole extra row, do it!
    // (e.g. 68mm fits 3.96 rows. 67mm fits 4.02 rows -> gains 3 whole cards per page!)
    if (Math.floor(usableH / (cardMM - 1)) > Math.floor(usableH / cardMM)) {
      cardMM -= 1;
    } else if (Math.floor(usableH / (cardMM - 2)) > Math.floor(usableH / cardMM)) {
      cardMM -= 2;
    }

    const cardsPerCol = Math.floor(usableH / cardMM);
    const cardsPerPage = cardsPerRow * cardsPerCol;

    // Rasterize all cards in parallel (batch to avoid memory spikes)
    const BATCH = 10;
    const images = [];
    for (let b = 0; b < cardSvgs.length; b += BATCH) {
      const batch = cardSvgs.slice(b, b + BATCH).map(svg => svgToImage(svg));
      const results = await Promise.all(batch);
      images.push(...results);
    }

    for (let i = 0; i < images.length; i++) {
      if (i > 0 && i % cardsPerPage === 0) doc.addPage();

      const pageIdx = i % cardsPerPage;
      const col = pageIdx % cardsPerRow;
      const row = Math.floor(pageIdx / cardsPerRow);

      const cardDrawSize = cardMM * 0.95;
      const x = margin + col * cardMM + (cardMM - cardDrawSize) / 2;
      const y = margin + row * cardMM + (cardMM - cardDrawSize) / 2;

      doc.addImage(images[i], 'JPEG', x, y, cardDrawSize, cardDrawSize, undefined, 'FAST');

      // Optional bleed marks
      if (bleedMarks) {
        const bx = margin + col * cardMM;
        const by = margin + row * cardMM;
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        const markLen = 3;
        doc.line(bx, by, bx + markLen, by);
        doc.line(bx, by, bx, by + markLen);
        doc.line(bx + cardMM, by, bx + cardMM - markLen, by);
        doc.line(bx + cardMM, by, bx + cardMM, by + markLen);
        doc.line(bx, by + cardMM, bx + markLen, by + cardMM);
        doc.line(bx, by + cardMM, bx, by + cardMM - markLen);
        doc.line(bx + cardMM, by + cardMM, bx + cardMM - markLen, by + cardMM);
        doc.line(bx + cardMM, by + cardMM, bx + cardMM, by + cardMM - markLen);
      }
    }

    doc.save('dobble-mint-cards.pdf');
  }

  return { generatePDF };
})();
