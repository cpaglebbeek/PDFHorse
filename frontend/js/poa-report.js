/*!
 * PDFHorse — Proof of Authenticity rapport (window.PDFHorsePoaReport)
 *
 * v0.24.0-Rivest: twee rapport-typen
 *   - build(meta)              → poa-v1 legacy claim (backwards-compat).
 *   - buildClaimV2(meta)       → 2-pagina sign-time claim-rapport (poa-v2):
 *                                p1 identity & claim, p2 hash evidence.
 *   - buildMatchReport(meta, verifyResult, currentFileInfo)
 *                              → 2-pagina verify-time match-rapport met verdict-%.
 *
 * Gebruikt alleen pdf-lib (al geladen). WinAnsi-safe via _ascii().
 */
(function () {
  var LINE = 14;
  var MARGIN = 48;
  var TITLE_SIZE = 20;
  var H_SIZE = 12;
  var BODY_SIZE = 10;
  var MONO_SIZE = 9;

  // ----- Helpers ---------------------------------------------------------
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
      .replace(/[ ]/g, ' ')
      .replace(/[✓]/g, 'OK')
      .replace(/[✗]/g, 'X')
      .replace(/[⚠]/g, '!')
      // emoji + overig non-WinAnsi → vervangen door [.]
      .replace(/[^\x00-\xFF]/g, '');
  }

  function _trunc(s, n) {
    s = String(s || '');
    if (s.length <= n) return s;
    return s.substr(0, n) + '...';
  }

  // RFC 4122 v4 UUID — random op crypto.getRandomValues, anders Math.random fallback.
  function _uuid() {
    var b = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(b);
    } else {
      for (var i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
    }
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    function h(x) { var s = x.toString(16); return s.length < 2 ? '0' + s : s; }
    var s = '';
    for (var j = 0; j < 16; j++) s += h(b[j]);
    return s.substr(0,8) + '-' + s.substr(8,4) + '-' + s.substr(12,4) + '-' + s.substr(16,4) + '-' + s.substr(20,12);
  }

  // Eenvoudige flow-renderer met automatische page-break.
  function _renderer(doc, font, bold, mono, pageW, pageH) {
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
      var f = opts.mono ? mono : (opts.bold ? bold : font);
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
      var lines = mono ? _chunk(String(value || ''), 78) : [String(value || '')];
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
    // Plaats expliciet een nieuwe pagina.
    function newPage() {
      page = doc.addPage([pageW, pageH]);
      y = pageH - MARGIN;
    }
    // Sectie-kop: lijntje + bold label.
    function section(title) {
      ensure(28);
      y -= 6;
      page.drawLine({
        start: { x: MARGIN, y: y },
        end: { x: pageW - MARGIN, y: y },
        thickness: 1.0,
        color: window.PDFLib.rgb(0.2, 0.3, 0.45),
      });
      y -= 4;
      text(title, { size: H_SIZE + 1, bold: true, color: [0.1, 0.2, 0.4], gap: 6 });
    }
    // Verdict-box: gekleurd rechthoek met grote tekst + score.
    function verdictBox(verdict, scorePct, title, subtitle) {
      var map = {
        IDENTICAL: { fill: [0.85, 0.96, 0.88], border: [0.16, 0.55, 0.30], text: [0.05, 0.38, 0.20] },
        LAYOUT_MATCH: { fill: [0.88, 0.97, 0.90], border: [0.22, 0.66, 0.40], text: [0.10, 0.42, 0.22] },
        PROBABLE: { fill: [1.00, 0.94, 0.78], border: [0.85, 0.55, 0.10], text: [0.55, 0.32, 0.05] },
        NO_MATCH: { fill: [1.00, 0.88, 0.88], border: [0.75, 0.18, 0.18], text: [0.55, 0.10, 0.10] },
        CLAIM_OK: { fill: [0.85, 0.96, 0.88], border: [0.16, 0.55, 0.30], text: [0.05, 0.38, 0.20] },
      };
      var c = map[verdict] || map.NO_MATCH;
      var boxH = 70;
      ensure(boxH + 8);
      page.drawRectangle({
        x: MARGIN, y: y - boxH,
        width: pageW - 2 * MARGIN, height: boxH,
        color: window.PDFLib.rgb(c.fill[0], c.fill[1], c.fill[2]),
        borderColor: window.PDFLib.rgb(c.border[0], c.border[1], c.border[2]),
        borderWidth: 1.5,
      });
      page.drawText(_ascii(title), {
        x: MARGIN + 14, y: y - 28, size: 18, font: bold,
        color: window.PDFLib.rgb(c.text[0], c.text[1], c.text[2]),
      });
      if (subtitle) {
        page.drawText(_ascii(subtitle), {
          x: MARGIN + 14, y: y - 50, size: 11, font: font,
          color: window.PDFLib.rgb(c.text[0], c.text[1], c.text[2]),
        });
      }
      if (typeof scorePct === 'string' && scorePct.length) {
        // Score rechtsboven groot.
        page.drawText(_ascii(scorePct), {
          x: pageW - MARGIN - 110, y: y - 36, size: 26, font: bold,
          color: window.PDFLib.rgb(c.text[0], c.text[1], c.text[2]),
        });
      }
      y -= (boxH + 10);
    }
    // Eenvoudige tabel: cols = [{label, width}], rows = array van array-strings.
    // Layout: label-rij (bold, lichte achtergrond) + body rijen, gewone lijntjes.
    function table(cols, rows) {
      var totalW = pageW - 2 * MARGIN;
      var widths = cols.map(function (c) { return c.width || (totalW / cols.length); });
      var rowH = 16;
      ensure(rowH + 4);
      // Header bg
      page.drawRectangle({
        x: MARGIN, y: y - rowH,
        width: totalW, height: rowH,
        color: window.PDFLib.rgb(0.93, 0.94, 0.97),
      });
      var x = MARGIN;
      for (var i = 0; i < cols.length; i++) {
        page.drawText(_ascii(cols[i].label || ''), {
          x: x + 4, y: y - rowH + 5, size: BODY_SIZE, font: bold,
          color: window.PDFLib.rgb(0.15, 0.20, 0.35),
        });
        x += widths[i];
      }
      y -= rowH;
      // Body
      for (var r = 0; r < rows.length; r++) {
        ensure(rowH + 2);
        var cells = rows[r];
        var rx = MARGIN;
        for (var ci = 0; ci < cells.length; ci++) {
          var cell = cells[ci];
          var celStr = (cell && typeof cell === 'object' && 'text' in cell) ? cell.text : cell;
          var col = (cell && typeof cell === 'object' && cell.color) ? cell.color : [0.15, 0.15, 0.15];
          var useMono = (cell && typeof cell === 'object' && cell.mono) || false;
          page.drawText(_ascii(celStr || ''), {
            x: rx + 4, y: y - rowH + 5, size: useMono ? MONO_SIZE : BODY_SIZE,
            font: useMono ? mono : font,
            color: window.PDFLib.rgb(col[0], col[1], col[2]),
          });
          rx += widths[ci];
        }
        // Onderlijntje
        page.drawLine({
          start: { x: MARGIN, y: y - rowH },
          end: { x: MARGIN + totalW, y: y - rowH },
          thickness: 0.3,
          color: window.PDFLib.rgb(0.82, 0.83, 0.88),
        });
        y -= rowH;
      }
      y -= 6;
    }
    function header(reportTitle, reportId, schema) {
      // Linksboven: PDFHorse-mark; rechtsboven: ID + schema.
      page.drawText(_ascii('PDFHorse'), {
        x: MARGIN, y: pageH - MARGIN + 10, size: 11, font: bold,
        color: window.PDFLib.rgb(0.1, 0.3, 0.55),
      });
      page.drawText(_ascii(reportTitle), {
        x: MARGIN + 60, y: pageH - MARGIN + 10, size: 11, font: font,
        color: window.PDFLib.rgb(0.35, 0.35, 0.40),
      });
      if (reportId) {
        page.drawText(_ascii('Report ID: ' + reportId), {
          x: pageW - MARGIN - 230, y: pageH - MARGIN + 10, size: 8, font: mono,
          color: window.PDFLib.rgb(0.45, 0.45, 0.50),
        });
      }
      if (schema) {
        page.drawText(_ascii('Schema: ' + schema), {
          x: pageW - MARGIN - 230, y: pageH - MARGIN + 0, size: 8, font: mono,
          color: window.PDFLib.rgb(0.45, 0.45, 0.50),
        });
      }
    }
    return {
      text: text, block: block, rule: rule,
      newPage: newPage, section: section,
      verdictBox: verdictBox, table: table, header: header,
      getY: function () { return y; },
      getPageW: function () { return pageW; },
      getPageH: function () { return pageH; },
    };
  }

  // ----- Legacy build (poa-v1 backwards-compat) --------------------------
  async function build(meta) {
    var L = window.PDFLib;
    if (!L) throw new Error('pdf-lib niet geladen.');
    var doc = await L.PDFDocument.create();
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    var bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
    var mono = await doc.embedFont(L.StandardFonts.Courier);

    var pageW = 595, pageH = 842; // A4 portrait
    var r = _renderer(doc, font, bold, mono, pageW, pageH);

    r.text('Proof of Authenticity', { size: TITLE_SIZE, gap: 6 });
    r.text('PDFHorse * iCt Horse * ' + (meta.ts || new Date().toISOString()), { size: BODY_SIZE, color: [0.4, 0.4, 0.4], gap: 8 });
    r.rule();

    r.block('First owner', (meta.owner && meta.owner.name) ? meta.owner.name : '(niet opgegeven)');
    if (meta.owner && meta.owner.email) r.block('E-mail', meta.owner.email);
    if (meta.owner && meta.owner.statement) r.block('Verklaring', meta.owner.statement);
    if (meta.source && meta.source.filename) r.block('Origineel bestand', meta.source.filename);
    if (meta.source && meta.source.bytes) r.block('Grootte', meta.source.bytes + ' bytes');
    r.rule();

    if (meta.file) {
      r.block('SHA-256 (file)', meta.file.sha256 || '-', true);
      if (meta.file.sha512) r.block('SHA-512 (file)', meta.file.sha512, true);
    }
    if (meta.conceptual) {
      r.block('SHA-256 (conceptueel - genormaliseerde tekstlaag)', meta.conceptual.sha256 || '-', true);
      if (typeof meta.conceptual.chars === 'number') {
        r.text('Genormaliseerde tekenlengte: ' + meta.conceptual.chars + '; paginas met tekst: ' + (meta.conceptual.pages_with_text || '?'), { size: BODY_SIZE });
      }
      r.text('', { gap: 4 });
    }
    if (meta.perceptual && meta.perceptual.length) {
      r.block('Perceptueel per pagina (8x8 avg-hash, 64-bit)', '', true);
      meta.perceptual.forEach(function (h, i) {
        r.text('  pagina ' + (i + 1) + ': ' + h, { size: MONO_SIZE, mono: true });
      });
      r.text('', { gap: 4 });
    }
    if (meta.anchor) {
      r.block('Blockchain anchor (OpenTimestamps)', '');
      r.text('Calendar: ' + (meta.anchor.calendar || '-'), { size: BODY_SIZE });
      r.text('Modus:    ' + (meta.anchor.mode || '-'), { size: BODY_SIZE });
      r.text('Digest:   ' + (meta.anchor.sha256 || '-'), { size: MONO_SIZE, mono: true });
      r.text('OTS-bewijs (base64, eerste 240 tekens):', { size: BODY_SIZE });
      var preview = (meta.anchor.ots_b64 || '').substr(0, 240);
      _chunk(preview, 78).forEach(function (line) { r.text('  ' + line, { size: MONO_SIZE, mono: true }); });
      r.text('', { gap: 4 });
    }
    r.rule();
    r.block('Verifieren', '');
    r.text('1. Open de geleverde PDF in PDFHorse -> tab "Hashing" -> modus "Verifieren".', { size: BODY_SIZE });
    r.text('2. De tool berekent SHA-256 + conceptuele hash + pagina-pHashes en vergelijkt ze met de', { size: BODY_SIZE });
    r.text('   embedded payload (pdfhorse-payload.json). Groen = match, rood = afwijking.', { size: BODY_SIZE });
    r.text('3. Het OTS-bewijs is upgradebaar naar Bitcoin-anchor via ots upgrade <bestand>.ots', { size: BODY_SIZE });
    r.text('   (OpenTimestamps CLI, gratis, los van iCt Horse).', { size: BODY_SIZE });
    r.text('', { gap: 4 });
    r.text('Dit rapport is automatisch gegenereerd door PDFHorse - geen extern archief, geen account.', { size: BODY_SIZE, color: [0.4, 0.4, 0.4] });
    return await doc.save();
  }

  // ----- Sign-time Claim-rapport (poa-v2) --------------------------------
  async function buildClaimV2(meta) {
    var L = window.PDFLib;
    if (!L) throw new Error('pdf-lib niet geladen.');
    var doc = await L.PDFDocument.create();
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    var bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
    var mono = await doc.embedFont(L.StandardFonts.Courier);

    var pageW = 595, pageH = 842;
    var r = _renderer(doc, font, bold, mono, pageW, pageH);
    var reportId = _uuid();
    var schema = (meta && meta.poa_schema) || 'poa-v2';

    // ===== Pagina 1 — Identity & Claim =====
    r.header('Proof of Authenticity - Claim', reportId, schema);

    r.text('PDFHorse Proof of Authenticity', { size: TITLE_SIZE, bold: true, gap: 4, color: [0.10, 0.20, 0.40] });
    r.text('Claim van eerste eigendom', { size: H_SIZE, color: [0.35, 0.35, 0.40], gap: 8 });

    // Verdict-box (groen, claim ok)
    var anchorMode = (meta.anchor && meta.anchor.mode) || 'geen';
    var anchorSub = 'Aangemaakt op ' + (meta.ts || new Date().toISOString());
    if (meta.anchor && meta.anchor.mode === 'stub') {
      anchorSub += ' - OTS-anchor: STUB MODE';
    } else if (meta.anchor && meta.anchor.calendar) {
      anchorSub += ' - OTS-anchor: ' + meta.anchor.calendar;
    } else {
      anchorSub += ' - OTS-anchor: geen';
    }
    r.verdictBox('CLAIM_OK', '', 'OK CLAIM OF FIRST OWNERSHIP', anchorSub);

    // STUB-marker prominent in rood als anchor.stub
    if (meta.anchor && meta.anchor.mode === 'stub') {
      r.text('LET OP: anchor draait in STUB MODE - geen echte calendar-call uitgevoerd.', {
        size: BODY_SIZE, color: [0.75, 0.10, 0.10], gap: 6,
      });
    }

    // Owner-blok
    r.section('Eigenaar');
    r.text('Naam:        ' + ((meta.owner && meta.owner.name) || '(niet opgegeven)'), { size: BODY_SIZE });
    r.text('E-mail:      ' + ((meta.owner && meta.owner.email) || '-'), { size: BODY_SIZE });
    var statement = (meta.owner && meta.owner.statement) || '';
    if (statement) {
      r.text('Verklaring:', { size: BODY_SIZE });
      // wrap op ~80 chars
      var lines = statement.split(/\r?\n/);
      lines.forEach(function (ln) {
        _chunk(ln, 80).forEach(function (sub) {
          r.text('  ' + sub, { size: BODY_SIZE });
        });
      });
    }

    // Source-blok
    r.section('Bron-bestand');
    var src = meta.source || {};
    var conceptPrefix = (meta.conceptual && meta.conceptual.sha256) ? meta.conceptual.sha256.substr(0, 16) : '-';
    r.text('Bestandsnaam: ' + (src.filename || '-'), { size: BODY_SIZE });
    r.text('Grootte:      ' + (src.bytes ? (src.bytes + ' bytes') : '-'), { size: BODY_SIZE });
    var pageCount = (meta.perceptual && meta.perceptual.length) || (meta.perceptual_dct && meta.perceptual_dct.length) || '?';
    r.text('Paginas:      ' + pageCount, { size: BODY_SIZE });
    r.text('Conceptueel:  ' + conceptPrefix + '...', { size: MONO_SIZE, mono: true });

    // Timestamps-tabel
    r.section('Tijdstempels');
    var anchorTs = (meta.anchor && meta.anchor.ts) || meta.ts || '(claim-tijd)';
    var calendar = (meta.anchor && meta.anchor.calendar) || '(geen)';
    var calendarMode = (meta.anchor && meta.anchor.mode) || 'geen';
    var stubColor = (calendarMode === 'stub') ? [0.75, 0.10, 0.10] : [0.15, 0.15, 0.15];
    r.table(
      [
        { label: 'Wat', width: 160 },
        { label: 'Wanneer / waar', width: pageW - 2 * MARGIN - 160 },
      ],
      [
        ['PoA-create', meta.ts || '-'],
        ['OTS-anchor', anchorTs],
        ['Calendar',  { text: calendar, mono: true }],
        ['Modus',     { text: calendarMode, color: stubColor, mono: true }],
      ]
    );

    // v0.25-Shamir: Identity binding (optioneel)
    r.section('Identity binding');
    if (!meta.signature) {
      r.text('Geen identity-binding - owner-info is self-rapportage.', {
        size: BODY_SIZE, color: [0.45, 0.30, 0.05],
      });
    } else {
      var sig = meta.signature;
      var fpFmt = '-';
      if (sig.fingerprint) {
        var clean = String(sig.fingerprint).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
        fpFmt = clean.substr(0, 16).match(/.{1,4}/g).join(' ');
      }
      r.text('OK Identity verified', { size: BODY_SIZE, bold: true, color: [0.05, 0.45, 0.20] });
      r.text('Fingerprint: ' + fpFmt, { size: MONO_SIZE, mono: true });
      r.text('Algo:        ' + (sig.algo || '-'), { size: BODY_SIZE });
      r.text('Signed at:   ' + (sig.signed_at || '-'), { size: BODY_SIZE });
      var pubArm = sig.public_key_armored || '';
      var pubPreview = pubArm.replace(/\s+/g, ' ').substr(0, 80);
      r.text('Publieke sleutel (preview, ' + pubArm.length + ' tekens):', { size: BODY_SIZE });
      r.text(pubPreview + '...', { size: MONO_SIZE, mono: true });
    }

    // Footer-tekst onderaan p1
    r.text('', { gap: 6 });
    r.text('Verifieer dit rapport door de begeleidende PDF in PDFHorse > tab "Hashing" > modus', { size: BODY_SIZE, color: [0.4, 0.4, 0.4] });
    r.text('"Verifieren" te openen. Broncode: github.com/cpaglebbeek/PDFHorse (PUBLIC AGPL-3.0).', { size: BODY_SIZE, color: [0.4, 0.4, 0.4] });

    // ===== Pagina 2 — Hash Evidence =====
    r.newPage();
    r.header('Proof of Authenticity - Hash Evidence', reportId, schema);

    r.text('Hash Evidence', { size: TITLE_SIZE, bold: true, gap: 4, color: [0.10, 0.20, 0.40] });
    r.text('De cryptografische vingerafdrukken die de claim ondersteunen.', { size: BODY_SIZE, color: [0.35, 0.35, 0.40], gap: 8 });

    // File-level
    r.section('File-level');
    if (meta.file && meta.file.sha256) {
      r.text('SHA-256:', { size: BODY_SIZE, bold: true });
      _chunk(meta.file.sha256, 64).forEach(function (ln) { r.text(ln, { size: MONO_SIZE, mono: true }); });
    }
    if (meta.file && meta.file.sha512) {
      r.text('SHA-512:', { size: BODY_SIZE, bold: true });
      _chunk(meta.file.sha512, 64).forEach(function (ln) { r.text(ln, { size: MONO_SIZE, mono: true }); });
    }

    // Conceptueel
    if (meta.conceptual) {
      r.section('Conceptueel (tekstlaag)');
      r.text('Normalisatie: NFC + lowercase + whitespace-collapse + watermerk-strip.', { size: BODY_SIZE });
      r.text('SHA-256:', { size: BODY_SIZE, bold: true });
      _chunk(meta.conceptual.sha256 || '-', 64).forEach(function (ln) { r.text(ln, { size: MONO_SIZE, mono: true }); });
      if (typeof meta.conceptual.chars === 'number') {
        r.text('Tekenlengte: ' + meta.conceptual.chars + ' tekens; paginas met tekst: ' + (meta.conceptual.pages_with_text || '?'), { size: BODY_SIZE });
      }
    }

    // Perceptueel per pagina
    if (meta.perceptual || meta.perceptual_dct || meta.perceptual_dhash) {
      r.section('Perceptueel per pagina');
      var n = Math.max(
        (meta.perceptual || []).length,
        (meta.perceptual_dct || []).length,
        (meta.perceptual_dhash || []).length
      );
      var rows = [];
      for (var i = 0; i < n; i++) {
        var avg = (meta.perceptual && meta.perceptual[i]) || '-';
        var dct = (meta.perceptual_dct && meta.perceptual_dct[i]) || '-';
        var dh  = (meta.perceptual_dhash && meta.perceptual_dhash[i]) || '-';
        rows.push([
          { text: 'p' + (i + 1) },
          { text: avg, mono: true },
          { text: _trunc(dct, 24), mono: true },
          { text: _trunc(dh, 24), mono: true },
        ]);
      }
      var avail = pageW - 2 * MARGIN;
      r.table(
        [
          { label: 'Pag', width: 36 },
          { label: 'Avg 8x8 (16-hex)', width: 130 },
          { label: 'dCT 16x16 (preview)', width: (avail - 36 - 130) / 2 },
          { label: 'dHash 16x16 (preview)', width: (avail - 36 - 130) / 2 },
        ],
        rows
      );
    }

    // Anchor
    if (meta.anchor) {
      r.section('Anchor (OpenTimestamps)');
      r.text('Calendar:  ' + (meta.anchor.calendar || '-'), { size: BODY_SIZE });
      r.text('Modus:     ' + (meta.anchor.mode || '-'), {
        size: BODY_SIZE, color: (meta.anchor.mode === 'stub') ? [0.75, 0.10, 0.10] : [0.15, 0.15, 0.15],
      });
      var ots = meta.anchor.ots_b64 || '';
      r.text('OTS bewijs (base64, ' + ots.length + ' tekens; eerste 64):', { size: BODY_SIZE });
      r.text(_trunc(ots, 64), { size: MONO_SIZE, mono: true });
      r.text('Verifieer manueel met OpenTimestamps CLI:', { size: BODY_SIZE, gap: 2 });
      var sha = (meta.anchor.sha256 || (meta.file && meta.file.sha256) || '<sha256>').substr(0, 64);
      r.text('  $ echo -n "' + sha + '" | xxd -r -p > digest.bin', { size: MONO_SIZE, mono: true });
      r.text('  $ base64 -d <<<"<ots_b64_full>" > proof.ots', { size: MONO_SIZE, mono: true });
      r.text('  $ ots verify proof.ots -d ' + sha, { size: MONO_SIZE, mono: true });
    }

    return await doc.save();
  }

  // ----- Verify-time Match-rapport ---------------------------------------
  async function buildMatchReport(meta, verifyResult, currentFileInfo) {
    var L = window.PDFLib;
    if (!L) throw new Error('pdf-lib niet geladen.');
    var doc = await L.PDFDocument.create();
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    var bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
    var mono = await doc.embedFont(L.StandardFonts.Courier);

    var pageW = 595, pageH = 842;
    var r = _renderer(doc, font, bold, mono, pageW, pageH);
    var reportId = _uuid();
    var schema = (verifyResult && verifyResult.schema) || (meta && meta.poa_schema) || 'poa-v2';
    var verdict = (verifyResult && verifyResult.verdict) || 'NO_MATCH';
    var score = (verifyResult && typeof verifyResult.score === 'number') ? verifyResult.score : 0;
    var scorePct = (Math.round(score * 1000) / 10).toFixed(1) + '%';

    // ===== Pagina 1 — Verdict =====
    r.header('PDFHorse Match Report', reportId, schema);

    r.text('PDFHorse Match Report', { size: TITLE_SIZE, bold: true, gap: 4, color: [0.10, 0.20, 0.40] });
    r.text('Vergelijking van ingeleverde PDF met embedded claim.', { size: H_SIZE, color: [0.35, 0.35, 0.40], gap: 8 });

    // Verdict-box
    var titles = {
      IDENTICAL:    'OK ORIGINAL - 100% match',
      LAYOUT_MATCH: 'OK LAYOUT-EQUIVALENT - ' + scorePct + ' match',
      PROBABLE:    '! MOGELIJKE MATCH - ' + scorePct,
      NO_MATCH:    'X GEEN MATCH - ' + scorePct,
    };
    var explains = {
      IDENTICAL:    'Volledige match - de huidige PDF is visueel identiek aan het origineel.',
      LAYOUT_MATCH: 'Layout-match - kleine edits, recompressie of watermerk; de inhoud is equivalent aan het origineel.',
      PROBABLE:    'Mogelijke match - zwaar gerecomprimeerd, gecropped, of partiele match. Handmatige check aanbevolen.',
      NO_MATCH:    'Geen overeenkomst - deze PDF is geen variant van het origineel waar de claim aan refereert.',
    };
    r.verdictBox(verdict, scorePct, titles[verdict] || titles.NO_MATCH, '');

    // Uitleg-zin
    r.text(explains[verdict] || explains.NO_MATCH, { size: BODY_SIZE, color: [0.2, 0.2, 0.2], gap: 6 });

    // Claim-info uit envelope
    r.section('Claim van eerste eigendom');
    var anchorTs = (meta && meta.anchor && meta.anchor.ts) || (meta && meta.ts) || '(onbekend)';
    r.text('De claim van eerste eigendom is gedateerd op ' + anchorTs, { size: BODY_SIZE, bold: true });
    r.text('Eigenaar:    ' + ((meta && meta.owner && meta.owner.name) || '(niet opgegeven)'), { size: BODY_SIZE });
    r.text('E-mail:      ' + ((meta && meta.owner && meta.owner.email) || '-'), { size: BODY_SIZE });
    r.text('Aangemaakt:  ' + ((meta && meta.ts) || '-'), { size: BODY_SIZE });
    r.text('Calendar:    ' + ((meta && meta.anchor && meta.anchor.calendar) || '(geen)'), { size: BODY_SIZE });
    var amode = (meta && meta.anchor && meta.anchor.mode) || 'geen';
    r.text('Anchor-modus: ' + amode, {
      size: BODY_SIZE, color: (amode === 'stub') ? [0.75, 0.10, 0.10] : [0.15, 0.15, 0.15],
    });

    // Current-info
    r.section('Ingeleverde PDF (huidige)');
    var cur = currentFileInfo || {};
    var curHashPrefix = (cur.sha256 || (verifyResult && verifyResult.file && verifyResult.file.actual) || '-').substr(0, 16);
    r.text('Bestandsnaam: ' + (cur.filename || '-'), { size: BODY_SIZE });
    r.text('Grootte:      ' + (cur.bytes ? (cur.bytes + ' bytes') : '-'), { size: BODY_SIZE });
    r.text('SHA-256:      ' + curHashPrefix + '...', { size: MONO_SIZE, mono: true });

    // v0.25-Shamir: Identity-sectie in match-rapport.
    r.section('Identity');
    var idr = verifyResult && verifyResult.identity;
    var fpExpected = (meta && meta.signature && meta.signature.fingerprint) || (idr && idr.fingerprint) || '-';
    function _fmtFp(fp) {
      if (!fp || fp === '-') return '-';
      var c = String(fp).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      return c.substr(0, 16).match(/.{1,4}/g).join(' ');
    }
    var sigStatus = idr ? (idr.present ? (idr.valid ? 'OK' : 'X') : '-') : '-';
    var sigTime = (meta && meta.signature && meta.signature.signed_at) || (idr && idr.signed_at) || '-';
    r.table(
      [
        { label: 'Veld',            width: 140 },
        { label: 'Waarde',          width: pageW - 2 * MARGIN - 140 - 80 },
        { label: 'Verify',          width: 80 },
      ],
      [
        [{ text: 'Fingerprint (claim)' }, { text: _fmtFp(fpExpected), mono: true }, { text: sigStatus,
            color: (sigStatus === 'OK') ? [0.10, 0.45, 0.20] : (sigStatus === 'X') ? [0.75, 0.18, 0.18] : [0.40, 0.40, 0.40] }],
        [{ text: 'Signing-time' }, { text: sigTime, mono: true }, { text: '' }],
      ]
    );
    r.text('De handtekening bewijst dat de eigenaar met fingerprint X de PoA-claim heeft', { size: BODY_SIZE });
    r.text('geautoriseerd. Anchor-tijd + sig = sluitend first-owner bewijs.', { size: BODY_SIZE });
    if (idr && idr.present && !idr.valid) {
      r.text('LET OP: signature aanwezig maar NIET geldig - verdict downgrade naar NO_MATCH.', {
        size: BODY_SIZE, color: [0.75, 0.10, 0.10],
      });
    } else if (!idr || !idr.present) {
      r.text('Let op: deze claim heeft GEEN identity-binding - owner-info is self-rapportage.', {
        size: BODY_SIZE, color: [0.55, 0.32, 0.05],
      });
    }

    // ===== Pagina 2 — Evidence Comparison =====
    r.newPage();
    r.header('PDFHorse Match Report - Evidence', reportId, schema);

    r.text('Evidence Comparison', { size: TITLE_SIZE, bold: true, gap: 4, color: [0.10, 0.20, 0.40] });
    r.text('Per-laag vergelijking van verwachte (uit claim) en gemeten (huidige PDF) waarden.', { size: BODY_SIZE, color: [0.35, 0.35, 0.40], gap: 8 });

    // File-level table
    r.section('File-level');
    var fileRows = [];
    var f = verifyResult && verifyResult.file;
    if (f) {
      fileRows.push([
        { text: 'SHA-256' },
        { text: _trunc(f.expected || '-', 24), mono: true },
        { text: _trunc(f.actual || '-', 24), mono: true },
        { text: f.ok ? 'match' : 'mismatch', color: f.ok ? [0.10, 0.45, 0.20] : [0.75, 0.30, 0.10] },
      ]);
    }
    if (meta && meta.file && meta.file.sha512) {
      var curSha512 = cur.sha512 || '-';
      var sha512Ok = (curSha512 !== '-' && curSha512 === meta.file.sha512);
      fileRows.push([
        { text: 'SHA-512' },
        { text: _trunc(meta.file.sha512, 24), mono: true },
        { text: _trunc(curSha512, 24), mono: true },
        { text: sha512Ok ? 'match' : (curSha512 === '-' ? '-' : 'mismatch'),
          color: sha512Ok ? [0.10, 0.45, 0.20] : [0.55, 0.40, 0.10] },
      ]);
    }
    var colW = (pageW - 2 * MARGIN);
    r.table(
      [
        { label: 'Veld',     width: 80 },
        { label: 'Verwacht', width: (colW - 80 - 80) / 2 },
        { label: 'Gemeten',  width: (colW - 80 - 80) / 2 },
        { label: 'Match?',   width: 80 },
      ],
      fileRows
    );

    // Conceptueel
    if (verifyResult && verifyResult.conceptual) {
      r.section('Conceptueel (tekstlaag)');
      var c = verifyResult.conceptual;
      r.table(
        [
          { label: 'Veld',     width: 80 },
          { label: 'Verwacht', width: (colW - 80 - 80) / 2 },
          { label: 'Gemeten',  width: (colW - 80 - 80) / 2 },
          { label: 'Match?',   width: 80 },
        ],
        [[
          { text: 'SHA-256' },
          { text: _trunc(c.expected || '-', 24), mono: true },
          { text: _trunc(c.actual || '-', 24), mono: true },
          { text: c.ok ? 'match' : 'mismatch', color: c.ok ? [0.10, 0.45, 0.20] : [0.75, 0.30, 0.10] },
        ]]
      );
    }

    // Perceptueel per pagina
    if (verifyResult && verifyResult.pages && verifyResult.pages.length) {
      r.section('Perceptueel per pagina');
      var pRows = verifyResult.pages.map(function (p) {
        var avgS = p.avg ? ((Math.round(p.avg.score * 1000) / 10) + '%') : '-';
        var dctS = p.dct ? ((Math.round(p.dct.score * 1000) / 10) + '%') : '-';
        var dhS  = p.dhash ? ((Math.round(p.dhash.score * 1000) / 10) + '%') : '-';
        var maxS = (Math.round((p.score || 0) * 1000) / 10) + '%';
        // Welke laag wint?
        var winner = '-';
        var best = -1;
        if (p.avg && p.avg.score > best) { best = p.avg.score; winner = 'avg'; }
        if (p.dct && p.dct.score > best) { best = p.dct.score; winner = 'dCT'; }
        if (p.dhash && p.dhash.score > best) { best = p.dhash.score; winner = 'dHash'; }
        function mark(label, isWin) { return isWin ? (label + ' *') : label; }
        var thr = (p.score >= 0.98) ? '0.98 (IDENTICAL)'
                : (p.score >= 0.85) ? '0.85 (LAYOUT)'
                : (p.score >= 0.75) ? '0.75 (PROBABLE)'
                : '< 0.75 (NO MATCH)';
        return [
          { text: 'p' + p.page },
          { text: mark(avgS, winner === 'avg') },
          { text: mark(dctS, winner === 'dCT') },
          { text: mark(dhS, winner === 'dHash') },
          { text: maxS, color: (p.score >= 0.85) ? [0.10, 0.45, 0.20] : (p.score >= 0.75) ? [0.55, 0.40, 0.10] : [0.75, 0.18, 0.18] },
          { text: thr },
        ];
      });
      var aw = pageW - 2 * MARGIN;
      r.table(
        [
          { label: 'Pag',   width: 32 },
          { label: 'Avg',   width: 60 },
          { label: 'dCT',   width: 60 },
          { label: 'dHash', width: 60 },
          { label: 'Max',   width: 60 },
          { label: 'Drempel', width: aw - 32 - 60 - 60 - 60 - 60 },
        ],
        pRows
      );
      r.text('* = winnende laag (hoogste score) per pagina.', { size: MONO_SIZE, color: [0.40, 0.40, 0.40], gap: 6 });
    }

    // Eindscore + drempel-uitleg
    r.section('Eindscore');
    r.text('Gemiddelde over paginas: ' + scorePct, { size: H_SIZE, bold: true });
    r.text('Drempels (PhotoVerify v8.3): 0.98 IDENTICAL, 0.85 LAYOUT_MATCH, 0.75 PROBABLE, <0.75 NO_MATCH.', { size: BODY_SIZE });

    // Anchor-verificatie
    if (meta && meta.anchor) {
      r.section('Anchor-verificatie');
      var anchorSha = (meta.anchor.sha256 || '<sha256>').substr(0, 16);
      var anchorTime = (meta.anchor.ts || meta.ts || '<OTS_TIME>');
      r.text('Het OTS-bewijs hoort bij de hash van het ORIGINELE bestand, niet bij de huidige PDF.', { size: BODY_SIZE });
      r.text('Anchor bewijst dat hash ' + anchorSha + '... bestond op ' + anchorTime + '.', { size: BODY_SIZE });
      r.text('Match impliceert dat de huidige PDF visueel/conceptueel-equivalent is aan die hash.', { size: BODY_SIZE });
    }

    return await doc.save();
  }

  window.PDFHorsePoaReport = {
    build: build,
    buildClaimV2: buildClaimV2,
    buildMatchReport: buildMatchReport,
    VERSION: '0.3.0',
  };
})();
