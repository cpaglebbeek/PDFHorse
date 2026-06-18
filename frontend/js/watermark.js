/*!
 * PDFHorse — watermark-engine (window.PDFHorseWatermark)
 * Injecteer en lees (vrijwel) onzichtbare watermerken in een PDF.
 *
 *  - Tekst-watermerk: tekst in de dominante achtergrondkleur (meestal wit), in
 *    klein font getegeld over elke pagina → onzichtbaar maar in de tekstlaag leesbaar.
 *  - Beeld-watermerk (SVG of PNG): PNG wordt eerst naar SVG getraceerd (ImageTracer)
 *    zodat het als vector-object bewaard blijft; herkleurd naar de achtergrondkleur
 *    en getegeld. De canonieke SVG wordt als payload bewaard → altijd terug te lezen.
 *  - Read: leest de payload (tekst + SVG) uit de PDF-metadata (Keywords) — betrouwbaar —
 *    plus de tekstlaag (PDF.js) als bevestiging/detectie.
 *
 * Vereist (al geladen door de app): window.PDFLib (pdf-lib), window.pdfjsLib (PDF.js).
 * ImageTracer wordt lazy van CDN geladen wanneer een PNG getraceerd moet worden.
 */
(function () {
  var WM_TAG = 'PDFHORSE-WM:';
  var IMAGETRACER_SRC = 'https://cdn.jsdelivr.net/npm/imagetracerjs@1.2.6/imagetracer_v1.2.6.js';

  function b64encode(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64decode(s) { return decodeURIComponent(escape(atob(s))); }

  function ensurePdfjs() {
    return new Promise(function (res, rej) {
      var t = 0;
      (function poll() {
        if (window.pdfjsLib && window.pdfjsLib.getDocument) return res(window.pdfjsLib);
        if ((t += 50) > 4000) return rej(new Error('PDF.js niet geladen'));
        setTimeout(poll, 50);
      })();
    });
  }
  var _itP = null;
  function ensureImageTracer() {
    if (window.ImageTracer) return Promise.resolve(window.ImageTracer);
    if (_itP) return _itP;
    _itP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = IMAGETRACER_SRC;
      s.onload = function () { window.ImageTracer ? res(window.ImageTracer) : rej(new Error('ImageTracer laadde niet')); };
      s.onerror = function () { rej(new Error('ImageTracer kon niet laden')); };
      document.head.appendChild(s);
    });
    return _itP;
  }

  // Dominante (achtergrond)kleur per pagina via een kleine PDF.js-render + histogram.
  async function detectBgColors(pdfBytes) {
    var pdfjs = await ensurePdfjs();
    var pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
    var out = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var vp = page.getViewport({ scale: 0.4 });
      var c = document.createElement('canvas'); c.width = Math.max(1, vp.width | 0); c.height = Math.max(1, vp.height | 0);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      var d = ctx.getImageData(0, 0, c.width, c.height).data, counts = {}, best = '240,240,240', bc = -1;
      for (var p = 0; p < d.length; p += 4 * 11) {
        if (d[p + 3] < 200) continue;
        var k = (d[p] & 0xF0) + ',' + (d[p + 1] & 0xF0) + ',' + (d[p + 2] & 0xF0);
        counts[k] = (counts[k] || 0) + 1;
        if (counts[k] > bc) { bc = counts[k]; best = k; }
      }
      var rgb = best.split(',').map(Number);
      out.push({ r: rgb[0], g: rgb[1], b: rgb[2] });
    }
    return out;
  }

  function _setPayload(doc, obj) {
    var existing = '';
    try { existing = doc.getKeywords() || ''; } catch (e) {}
    var tag = WM_TAG + b64encode(JSON.stringify(obj));
    doc.setKeywords([existing, tag].filter(Boolean));
  }

  // ---- Inject tekst ----
  async function injectText(pdfBytes, text, opts) {
    opts = opts || {};
    if (!text) throw new Error('Geen watermerk-tekst opgegeven');
    var L = window.PDFLib;
    var doc = await L.PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: false });
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    var fontSize = opts.fontSize || 6;
    var colors = opts.color ? null : await detectBgColors(pdfBytes);
    var pages = doc.getPages();
    for (var i = 0; i < pages.length; i++) {
      var col = opts.color || colors[i] || { r: 255, g: 255, b: 255 };
      var c = L.rgb(col.r / 255, col.g / 255, col.b / 255);
      var page = pages[i]; var sz = page.getSize();
      var unit = (text + '   ');
      var stepX = Math.max(40, font.widthOfTextAtSize(unit, fontSize));
      var stepY = Math.max(14, fontSize * 2.2);
      var count = 0, MAX = 1200;
      for (var y = sz.height - fontSize; y > 0 && count < MAX; y -= stepY) {
        for (var x = 2; x < sz.width && count < MAX; x += stepX) {
          page.drawText(text, { x: x, y: y, size: fontSize, font: font, color: c, opacity: 1 });
          count++;
        }
      }
    }
    _setPayload(doc, { type: 'text', text: text });
    return await doc.save();
  }

  // ---- PNG → SVG (vector, zodat het object terug te lezen is) ----
  async function pngToSvg(pngDataUrl) {
    var IT = await ensureImageTracer();
    return new Promise(function (res, rej) {
      try {
        IT.imageToSVG(pngDataUrl, function (svg) { res(svg); }, { numberofcolors: 2, ltres: 1, qtres: 1, scale: 1, strokewidth: 0 });
      } catch (e) { rej(e); }
    });
  }

  // Herkleur een SVG-string naar één kleur (fill+stroke) en geef een dataURL terug.
  function recolorSvg(svgString, hex) {
    var safe = svgString.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Forceer 1 kleur op alle vorm-elementen
    safe = safe.replace(/fill\s*:\s*[^;"']+/gi, 'fill:' + hex).replace(/fill\s*=\s*"(?!none)[^"]*"/gi, 'fill="' + hex + '"');
    safe = safe.replace(/stroke\s*:\s*[^;"']+/gi, 'stroke:' + hex);
    return safe;
  }
  function hex(col) {
    function h(n) { return ('0' + (n & 255).toString(16)).slice(-2); }
    return '#' + h(col.r) + h(col.g) + h(col.b);
  }

  // ---- Inject beeld (SVG; PNG wordt eerst getraceerd) ----
  async function injectImage(pdfBytes, src, opts) {
    opts = opts || {};
    var svgString = src.svg;
    if (!svgString && src.pngDataUrl) svgString = await pngToSvg(src.pngDataUrl);
    if (!svgString) throw new Error('Geen SVG/PNG opgegeven');

    var L = window.PDFLib;
    var doc = await L.PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: false });
    var colors = opts.color ? null : await detectBgColors(pdfBytes);
    var pages = doc.getPages();
    var tile = opts.tile || 110;   // px-afstand tussen tegels

    for (var i = 0; i < pages.length; i++) {
      var col = opts.color || colors[i] || { r: 255, g: 255, b: 255 };
      var recolored = recolorSvg(svgString, hex(col));
      var png = await svgToRecoloredPng(recolored);     // visuele (onzichtbare) tegel
      var img = await doc.embedPng(png.bytes);
      var page = pages[i]; var sz = page.getSize();
      var w = opts.size || 64, h = w * (png.height / png.width || 1);
      var count = 0, MAX = 600;
      for (var y = 0; y < sz.height && count < MAX; y += tile) {
        for (var x = 0; x < sz.width && count < MAX; x += tile) {
          page.drawImage(img, { x: x, y: y, width: w, height: h, opacity: 1 });
          count++;
        }
      }
    }
    // canonieke SVG-payload → altijd terug te lezen als vector-object
    _setPayload(doc, { type: 'svg', svg: svgString });
    return await doc.save();
  }

  // SVG-string → herkleurde PNG-bytes (via canvas).
  function svgToRecoloredPng(svgString) {
    return new Promise(function (res, rej) {
      var blob = new Blob([svgString], { type: 'image/svg+xml' });
      var url = URL.createObjectURL(blob);
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth || 256, h = im.naturalHeight || 256;
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        var dataUrl = c.toDataURL('image/png');
        var bin = atob(dataUrl.split(',', 2)[1]); var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        res({ bytes: arr, width: w, height: h });
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('SVG rasteriseren mislukt')); };
      im.src = url;
    });
  }

  // ---- Read ----
  async function _extractTextLayer(pdfBytes) {
    var pdfjs = await ensurePdfjs();
    var pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
    var freq = {};
    for (var i = 1; i <= pdf.numPages; i++) {
      var tc = await (await pdf.getPage(i)).getTextContent();
      tc.items.forEach(function (it) { var s = (it.str || '').trim(); if (s) freq[s] = (freq[s] || 0) + 1; });
    }
    return Object.keys(freq).map(function (k) { return { text: k, count: freq[k] }; }).sort(function (a, b) { return b.count - a.count; });
  }

  async function read(pdfBytes) {
    var L = window.PDFLib;
    var doc = await L.PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: false });
    var kw = ''; try { kw = doc.getKeywords() || ''; } catch (e) {}
    var payloads = [];
    (kw.match(/PDFHORSE-WM:[A-Za-z0-9+/=]+/g) || []).forEach(function (m) {
      try { payloads.push(JSON.parse(b64decode(m.slice(WM_TAG.length)))); } catch (e) {}
    });
    var textLayer = [];
    try { textLayer = await _extractTextLayer(pdfBytes); } catch (e) {}
    // Heuristiek: tekst die vaak herhaald wordt = vermoedelijk watermerk (als geen payload)
    var repeated = textLayer.filter(function (t) { return t.count >= 5; }).slice(0, 5);
    return { payloads: payloads, textLayer: textLayer, repeatedText: repeated };
  }

  window.PDFHorseWatermark = {
    detectBgColors: detectBgColors,
    injectText: injectText,
    injectImage: injectImage,
    pngToSvg: pngToSvg,
    read: read,
    VERSION: '0.1.0'
  };
})();
