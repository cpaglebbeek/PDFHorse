/*!
 * PDFHorse — Proof of Authenticity rapport (window.PDFHorsePoaReport)
 *
 * Genereert een nette PDF met alle bewijs-elementen die nodig zijn om
 * eigenaarschap + integriteit van een PDF aan te tonen. Gebruikt alleen
 * pdf-lib (al geladen) — geen extra dependencies.
 */
(function () {
  var LINE = 14;
  var MARGIN = 48;
  var TITLE_SIZE = 20;
  var H_SIZE = 12;
  var BODY_SIZE = 10;
  var MONO_SIZE = 9;

  function _chunk(s, n) {
    var out = [];
    for (var i = 0; i < s.length; i += n) out.push(s.substr(i, n));
    return out;
  }
  // pdf-lib StandardFonts (Helvetica/Courier) coderen WinAnsi — strip emoji/unicode-tekens
  // die anders een DrawText-throw geven. We vervangen veelvoorkomende met ASCII-equivalent.
  function _ascii(s) {
    if (s == null) return '';
    return String(s)
      .replace(/[→➜➡]/g, '->')   // pijlen
      .replace(/[←]/g, '<-')
      .replace(/[•·]/g, '*')
      .replace(/[…]/g, '...')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/[ ]/g, ' ')
      // emoji + overig non-WinAnsi → vervangen door [.]
      .replace(/[^\x00-\xFF]/g, '');
  }

  // Eenvoudige flow-renderer met automatische page-break.
  function _renderer(doc, font, mono, pageW, pageH) {
    var page = doc.addPage([pageW, pageH]);
    var y = pageH - MARGIN;

    function ensure(h) {
      if (y - h < MARGIN) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - MARGIN;
      }
    }
    function text(s, opts) {
      opts = opts || {};
      var size = opts.size || BODY_SIZE;
      var f = opts.mono ? mono : font;
      var color = opts.color || [0.15, 0.15, 0.15];
      ensure(size + 4);
      page.drawText(_ascii(s), {
        x: opts.x || MARGIN,
        y: y - size,
        size: size,
        font: f,
        color: window.PDFLib.rgb(color[0], color[1], color[2]),
      });
      y -= (size + (opts.gap || 4));
    }
    function block(label, value, mono) {
      text(label, { size: H_SIZE, color: [0.0, 0.3, 0.55] });
      var lines = mono ? _chunk(value, 78) : [value];
      lines.forEach(function (line) {
        text(line, { size: mono ? MONO_SIZE : BODY_SIZE, mono: !!mono });
      });
      y -= 6;
    }
    function rule() {
      ensure(8);
      page.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end: { x: pageW - MARGIN, y: y - 2 },
        thickness: 0.5,
        color: window.PDFLib.rgb(0.7, 0.7, 0.7),
      });
      y -= 10;
    }
    return { text: text, block: block, rule: rule };
  }

  async function build(meta) {
    var L = window.PDFLib;
    if (!L) throw new Error('pdf-lib niet geladen.');
    var doc = await L.PDFDocument.create();
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    var bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
    var mono = await doc.embedFont(L.StandardFonts.Courier);

    var pageW = 595, pageH = 842; // A4 portrait
    var r = _renderer(doc, font, mono, pageW, pageH);

    // Titel
    r.text('Proof of Authenticity', { size: TITLE_SIZE, gap: 6 });
    r.text('PDFHorse · iCt Horse · ' + (meta.ts || new Date().toISOString()), { size: BODY_SIZE, color: [0.4, 0.4, 0.4], gap: 8 });
    r.rule();

    // First owner
    r.block('First owner', (meta.owner && meta.owner.name) ? meta.owner.name : '(niet opgegeven)');
    if (meta.owner && meta.owner.email) r.block('E-mail', meta.owner.email);
    if (meta.owner && meta.owner.statement) r.block('Verklaring', meta.owner.statement);
    if (meta.source && meta.source.filename) r.block('Origineel bestand', meta.source.filename);
    if (meta.source && meta.source.bytes) r.block('Grootte', meta.source.bytes + ' bytes');
    r.rule();

    // File hashes
    if (meta.file) {
      r.block('SHA-256 (file)', meta.file.sha256 || '—', true);
      if (meta.file.sha512) r.block('SHA-512 (file)', meta.file.sha512, true);
    }

    // Conceptual
    if (meta.conceptual) {
      r.block('SHA-256 (conceptueel — genormaliseerde tekstlaag)', meta.conceptual.sha256 || '—', true);
      if (typeof meta.conceptual.chars === 'number') {
        r.text('Genormaliseerde tekenlengte: ' + meta.conceptual.chars + '; pagina\'s met tekst: ' + (meta.conceptual.pages_with_text || '?'), { size: BODY_SIZE });
      }
      r.text('', { gap: 4 });
    }

    // Perceptual per page
    if (meta.perceptual && meta.perceptual.length) {
      r.block('Perceptueel per pagina (8x8 avg-hash, 64-bit)', '', true);
      meta.perceptual.forEach(function (h, i) {
        r.text('  pagina ' + (i + 1) + ': ' + h, { size: MONO_SIZE, mono: true });
      });
      r.text('', { gap: 4 });
    }

    // Anchor
    if (meta.anchor) {
      r.block('Blockchain anchor (OpenTimestamps)', '');
      r.text('Calendar: ' + (meta.anchor.calendar || '—'), { size: BODY_SIZE });
      r.text('Modus:    ' + (meta.anchor.mode || '—'), { size: BODY_SIZE });
      r.text('Digest:   ' + (meta.anchor.sha256 || '—'), { size: MONO_SIZE, mono: true });
      r.text('OTS-bewijs (base64, eerste 240 tekens):', { size: BODY_SIZE });
      var preview = (meta.anchor.ots_b64 || '').substr(0, 240);
      _chunk(preview, 78).forEach(function (line) { r.text('  ' + line, { size: MONO_SIZE, mono: true }); });
      r.text('', { gap: 4 });
    }

    r.rule();

    // Verify-instructies
    r.block('Verifiëren', '');
    r.text('1. Open de geleverde PDF in PDFHorse → tab "🔒 Hashing" → modus "Verifiëren".', { size: BODY_SIZE });
    r.text('2. De tool berekent SHA-256 + conceptuele hash + pagina-pHashes en vergelijkt ze met de', { size: BODY_SIZE });
    r.text('   embedded payload (pdfhorse-payload.json). Groen = match, rood = afwijking.', { size: BODY_SIZE });
    r.text('3. Het OTS-bewijs is upgradebaar naar Bitcoin-anchor via `ots upgrade <bestand>.ots`', { size: BODY_SIZE });
    r.text('   (OpenTimestamps CLI, gratis, los van iCt Horse).', { size: BODY_SIZE });
    r.text('', { gap: 4 });
    r.text('Dit rapport is automatisch gegenereerd door PDFHorse — geen extern archief, geen account.', { size: BODY_SIZE, color: [0.4, 0.4, 0.4] });

    return await doc.save();
  }

  window.PDFHorsePoaReport = {
    build: build,
    VERSION: '0.1.0',
  };
})();
