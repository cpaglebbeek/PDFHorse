// PDFHorse frontend root (Alpine.js root component). v0.6.0-Paxton.
// Merge, Split, Fill en Sign zijn client-side; Merge accepteert ook .docx
// die server-side via LibreOffice naar PDF geconverteerd wordt. Output-bar
// onderaan houdt de laatste uitvoer vast voor re-download, print en mail.
//   - Merge + Split: pdf-lib (window.PDFLib)
//   - Fill: PDF.js render preview (window.pdfjsLib) + pdf-lib drawText
//   - Sign: 3 modi (A bitmap upload / B SVG upload / C live signature_pad)
//           + PDF.js preview + pdf-lib embedPng + drawImage
//   - Output: lastOutput state + Download / Print / Mail (POST /api/mail)

const MAX_FILE_BYTES    = 50  * 1024 * 1024;
const MAX_SESSION_BYTES = 100 * 1024 * 1024;
const MAX_DOCX_BYTES    = 20  * 1024 * 1024;
const MAX_XLSX_BYTES    = 20  * 1024 * 1024;
const MAX_IMAGE_BYTES   = 50  * 1024 * 1024;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ODT_MIME  = 'application/vnd.oasis.opendocument.text';
const RTF_MIME  = 'application/rtf';

function pdfHorseApp() {
  return {
    active: 'merge',
    tabs: [
      { id: 'merge',   label: 'Merge' },
      { id: 'split',   label: 'Split' },
      { id: 'fill',    label: 'Invullen' },
      { id: 'sign',    label: 'Ondertekenen' },
      { id: 'convert', label: 'Converteren' },
      { id: 'ocr',     label: 'OCR' },
      { id: 'watermerk', label: '💧 Watermerk' },
      { id: 'delen',   label: '🔗 Delen & meekijken' },
      { id: 'geavanceerd', label: '🔐 Geavanceerd' },
    ],
    health: { status: '…', version: '…', codename: '…' },
    limits: {},

    // Overdracht tussen tabs: een ingevulde PDF doorgeven aan Ondertekenen
    // zodat je na "Invullen" verder kunt met "Ondertekenen" op dezelfde PDF.
    signHandoff: null,            // { bytes: Uint8Array, name: string } of null

    merge: {
      files: [],
      dragOver: false,
      busy: false,
      progress: '',           // bv. "Converteert docx 1/2…"
      error: '',
      notice: '',
      seq: 0,
    },

    split: {
      file: null,
      pageCount: 0,
      rangeInput: '',
      parsedRanges: [],
      rangeError: '',
      dragOver: false,
      busy: false,
      error: '',
      notice: '',
    },

    fill: {
      file: null,
      pdfBytes: null,
      pageCount: 0,
      pages: [],
      fields: [],
      detected: [],            // [{page, x, y, width, fontSize, kind}] canvas-coords, y = baseline
      fontSize: 12,
      dragOver: false,
      loading: false,
      busy: false,
      error: '',
      notice: '',
      seq: 0,
    },

    sign: {
      file: null,
      pdfBytes: null,
      pageCount: 0,
      pages: [],
      mode: 'C',                 // A bitmap / B SVG / C live
      dataUrl: '',               // PNG dataURL van handtekening
      sigError: '',
      placements: [],
      width: 180,                // preview-px breedte van handtekening
      dragOver: false,
      loading: false,
      busy: false,
      error: '',
      notice: '',
      seq: 0,
      _pad: null,                // signature_pad instance
    },

    output: {
      bytes: null,               // Uint8Array
      filename: '',
      feature: '',
      mime: 'application/pdf',
      mailOpen: false,
      mailTo: '',
      mailSubject: 'PDFHorse-uitvoer',
      mailBusy: false,
      mailStatus: '',
      error: '',
    },

    convert: {
      files: [],
      combine: false,
      dragOver: false,
      busy: false,
      progress: '',
      error: '',
      notice: '',
      seq: 0,
    },

    ocr: {
      file: null,
      dragOver: false,
      busy: false,
      error: '',
      notice: '',
    },

    watermark: {
      file: null,
      pdfBytes: null,
      mode: 'text',            // 'text' | 'image' | 'doc' | 'read'
      text: '',
      imageName: '',
      imageSrc: null,          // { svg } of { pngDataUrl }
      docBytes: null,          // document-payload (willekeurig bestand)
      docName: '',
      readResult: null,        // { payloads, repeatedText } na lezen
      readDoc: null,           // { name, bytes, enc } embedded document-payload na lezen
      dragOver: false,
      busy: false,
      error: '',
      notice: '',
    },

    advanced: {
      mode: 'embed',           // 'embed' | 'extract' | 'keys'
      pdfFile: null,
      pdfBytes: null,
      payloadBytes: null,
      payloadName: '',
      useEncryption: false,
      keypair: null,           // { publicJwk, privateJwk }
      peerPublicJwk: null,
      peerPublicName: '',
      privateJwk: null,        // eigen private key (decrypt)
      privateName: '',
      dragOver: false,
      busy: false,
      error: '',
      notice: '',
    },

    init() {
      this.fetchHealth();
      this.fetchLimits();
      // Meekijk-link geopend (?watch=CODE) → toon direct de Delen-tab zodat de
      // kijker het gedeelde scherm ziet (het clipboard-artefact koppelt zelf).
      try {
        if (new URLSearchParams(location.search).get('watch')) this.active = 'delen';
      } catch (e) { /* no-op */ }
    },

    async fetchHealth() {
      try {
        const r = await fetch(this._apiUrl('/api/health'));
        if (r.ok) this.health = await r.json();
        else this.health = { status: 'down', version: '?', codename: '?' };
      } catch {
        this.health = { status: 'offline', version: '?', codename: '?' };
      }
    },

    async fetchLimits() {
      try {
        const r = await fetch(this._apiUrl('/api/limits'));
        if (r.ok) this.limits = await r.json();
      } catch { /* skeleton — niet kritiek */ }
    },

    _apiUrl(p) {
      const base = (window.PDFHORSE_API_BASE || '').replace(/\/$/, '');
      return base + p;
    },

    // ---------- Tab-navigatie + fill→sign-overdracht ----------

    goTab(id) {
      this.active = id;
      // Wissel je naar Ondertekenen terwijl er net een PDF is ingevuld en er
      // nog geen sign-bestand geladen is? Dan automatisch de ingevulde PDF
      // overnemen zodat je naadloos verder kunt met ondertekenen.
      if (id === 'sign' && this.signHandoff && !this.sign.file) {
        this.continueToSign();
      }
    },

    async continueToSign() {
      if (!this.signHandoff) return;
      const { bytes, name } = this.signHandoff;
      this.signHandoff = null;          // verbruik de overdracht
      this.active = 'sign';
      // Wacht tot de Ondertekenen-tab zichtbaar is (canvases in DOM) en laad.
      await this.$nextTick();
      await this._signLoadBytes(bytes, name);
      this.sign.notice = `Overgenomen uit "Invullen": ${name}. Plaats je handtekening, of klik Wissen voor een ander bestand.`;
    },

    // ---------- Merge ----------

    onMergeFileInput(ev) {
      this._mergeAddFiles(ev.target.files);
      ev.target.value = '';
    },

    onMergeDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files) this._mergeAddFiles(dt.files);
    },

    _mergeAddFiles(fileList) {
      this.merge.error = '';
      this.merge.notice = '';
      const incoming = Array.from(fileList || []);
      const accepted = [];
      let total = this.mergeTotal();

      for (const f of incoming) {
        const kind = this._detectKind(f);
        if (!kind) {
          this.merge.error = `"${f.name}" is geen PDF of .docx.`;
          continue;
        }
        if (kind === 'docx' && f.size > MAX_DOCX_BYTES) {
          this.merge.error = `"${f.name}" overschrijdt 20 MB (limiet voor docx-conversie).`;
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          this.merge.error = `"${f.name}" overschrijdt 50 MB.`;
          continue;
        }
        if (total + f.size > MAX_SESSION_BYTES) {
          this.merge.error = `Sessie-limiet 100 MB overschreden bij "${f.name}".`;
          continue;
        }
        accepted.push({
          id: ++this.merge.seq,
          name: f.name,
          size: f.size,
          blob: f,
          kind,                 // 'pdf' | 'docx'
        });
        total += f.size;
      }
      this.merge.files.push(...accepted);
    },

    _detectKind(f) {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf';
      if (f.type === DOCX_MIME || /\.docx$/i.test(f.name)) return 'docx';
      return null;
    },

    async _convertDocxToPdf(f) {
      // POST naar /api/convert/docx-to-pdf, response = PDF-bytes
      const fd = new FormData();
      fd.append('file', f, f.name);
      const r = await fetch(this._apiUrl('/api/convert/docx-to-pdf'), {
        method: 'POST',
        body: fd,
      });
      if (!r.ok) {
        let detail = '';
        try { detail = (await r.json()).detail || ''; } catch {}
        throw new Error(`docx-conversie mislukt voor "${f.name}" (${r.status}). ${detail}`);
      }
      const buf = await r.arrayBuffer();
      return new Uint8Array(buf);
    },

    mergeMove(i, delta) {
      const j = i + delta;
      if (j < 0 || j >= this.merge.files.length) return;
      const arr = this.merge.files;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    },

    mergeRemove(i) {
      this.merge.files.splice(i, 1);
    },

    mergeReset() {
      this.merge.files = [];
      this.merge.error = '';
      this.merge.notice = '';
    },

    mergeTotal() {
      return this.merge.files.reduce((s, f) => s + f.size, 0);
    },

    async runMerge() {
      if (this.merge.busy) return;
      if (this.merge.files.length < 2) {
        this.merge.error = 'Minstens 2 bestanden nodig om samen te voegen.';
        return;
      }
      if (!window.PDFLib) {
        this.merge.error = 'pdf-lib is niet geladen — controleer je internetverbinding.';
        return;
      }

      this.merge.busy = true;
      this.merge.progress = '';
      this.merge.error = '';
      this.merge.notice = '';

      try {
        const { PDFDocument } = window.PDFLib;
        const merged = await PDFDocument.create();

        const docxCount = this.merge.files.filter(f => f.kind === 'docx').length;
        let docxDone = 0;
        let pdfCount = 0;

        for (let i = 0; i < this.merge.files.length; i++) {
          const f = this.merge.files[i];
          let pdfBytes;

          if (f.kind === 'docx') {
            docxDone += 1;
            this.merge.progress = `Converteert docx ${docxDone}/${docxCount}…`;
            // Yield aan UI zodat progress-tekst rendert vóór de POST.
            await this._sleep(20);
            pdfBytes = await this._convertDocxToPdf(f.blob);
          } else {
            pdfCount += 1;
            this.merge.progress = `Verwerkt PDF ${pdfCount}…`;
            pdfBytes = new Uint8Array(await f.blob.arrayBuffer());
          }

          let src;
          try {
            src = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
          } catch (e) {
            if (String(e).toLowerCase().includes('encrypt')) {
              throw new Error(`"${f.name}" is versleuteld en kan niet worden samengevoegd.`);
            }
            throw new Error(`"${f.name}" leverde geen geldige PDF op.`);
          }
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        }

        this.merge.progress = 'Samenvoegen…';
        const bytes = await merged.save();
        this._downloadBlob(bytes, 'merged.pdf', 'application/pdf');
        const feature = docxCount > 0
          ? `merge (${this.merge.files.length} bestanden, ${docxCount}× docx geconverteerd)`
          : `merge (${this.merge.files.length} PDF's)`;
        this._setOutput(bytes, 'merged.pdf', feature);
        this.merge.notice = `Samengevoegd: ${this.merge.files.length} bestanden → merged.pdf gedownload.`;
      } catch (e) {
        this.merge.error = e.message || String(e);
      } finally {
        this.merge.busy = false;
        this.merge.progress = '';
      }
    },

    _downloadBlob(bytes, filename, mime) {
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    _setOutput(bytes, filename, feature, mime = 'application/pdf') {
      // Bewaar de laatste uitvoer voor re-download, print en mail.
      // `bytes` is typisch Uint8Array (pdf-lib save) — kloon naar nieuwe
      // Uint8Array zodat we niet afhankelijk zijn van de bron-buffer.
      this.output.bytes = new Uint8Array(bytes);
      this.output.filename = filename;
      this.output.feature = feature;
      this.output.mime = mime;
      this.output.error = '';
      this.output.mailStatus = '';
    },

    downloadLast() {
      if (!this.output.bytes) return;
      this._downloadBlob(this.output.bytes, this.output.filename, this.output.mime);
    },

    printLast() {
      this.output.error = '';
      if (!this.output.bytes) return;
      const blob = new Blob([this.output.bytes], { type: this.output.mime });
      const url = URL.createObjectURL(blob);
      // Hidden iframe + contentWindow.print() — werkt in Chrome/Firefox/Safari.
      let iframe = document.getElementById('pdfhorse-print-iframe');
      if (iframe) iframe.remove();
      iframe = document.createElement('iframe');
      iframe.id = 'pdfhorse-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            this.output.error = 'Printen niet mogelijk in deze browser. Gebruik Download.';
          }
        }, 250);
      };
      document.body.appendChild(iframe);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },

    async mailLast() {
      this.output.mailStatus = '';
      this.output.error = '';
      if (!this.output.bytes || !this.output.mailTo) return;
      // Eenvoudige e-mail-validatie (browser doet `type=email` ook al)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.output.mailTo)) {
        this.output.error = 'Geef een geldig e-mailadres op.';
        return;
      }
      this.output.mailBusy = true;
      try {
        const fd = new FormData();
        fd.append('to', this.output.mailTo);
        fd.append('subject', this.output.mailSubject || 'PDFHorse-uitvoer');
        const blob = new Blob([this.output.bytes], { type: this.output.mime });
        fd.append('pdf', blob, this.output.filename);
        const r = await fetch(this._apiUrl('/api/mail'), { method: 'POST', body: fd });
        if (r.ok) {
          this.output.mailStatus = `Verstuurd naar ${this.output.mailTo}.`;
          this.output.mailOpen = false;
        } else if (r.status === 429) {
          this.output.error = 'Mail-limiet bereikt (max 5/uur per IP). Probeer later opnieuw.';
        } else {
          let detail = '';
          try { detail = (await r.json()).detail || ''; } catch {}
          this.output.error = `Mail-verzending mislukt (${r.status}). ${detail}`;
        }
      } catch (e) {
        this.output.error = e.message || String(e);
      } finally {
        this.output.mailBusy = false;
      }
    },

    formatBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1024 / 1024).toFixed(1) + ' MB';
    },

    // ---------- Split ----------

    onSplitFileInput(ev) {
      this._splitSetFile(ev.target.files && ev.target.files[0]);
      ev.target.value = '';
    },

    onSplitDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files && dt.files[0]) this._splitSetFile(dt.files[0]);
    },

    async _splitSetFile(f) {
      this.split.error = '';
      this.split.notice = '';
      this.split.rangeError = '';
      this.split.parsedRanges = [];
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) {
        this.split.error = `"${f.name}" is geen PDF.`;
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        this.split.error = `"${f.name}" overschrijdt 50 MB.`;
        return;
      }
      if (!window.PDFLib) {
        this.split.error = 'pdf-lib is niet geladen — controleer je internetverbinding.';
        return;
      }
      try {
        const buf = await f.arrayBuffer();
        const src = await window.PDFLib.PDFDocument.load(buf, { ignoreEncryption: false });
        this.split.file = f;
        this.split.pageCount = src.getPageCount();
        if (this.split.rangeInput) this.parseSplitRanges();
      } catch (e) {
        if (String(e).toLowerCase().includes('encrypt')) {
          this.split.error = `"${f.name}" is versleuteld en kan niet worden gesplitst.`;
        } else {
          this.split.error = `"${f.name}" is geen geldige PDF.`;
        }
      }
    },

    parseSplitRanges() {
      this.split.rangeError = '';
      this.split.parsedRanges = [];
      const raw = (this.split.rangeInput || '').trim();
      if (!raw) return;
      if (!this.split.pageCount) {
        this.split.rangeError = 'Selecteer eerst een PDF.';
        return;
      }
      if (!/^[\d,\s-]+$/.test(raw)) {
        this.split.rangeError = 'Alleen cijfers, komma\'s, spaties en streepjes toegestaan.';
        return;
      }
      const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
      const ranges = [];
      for (const part of parts) {
        const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) {
          this.split.rangeError = `Onbegrepen bereik: "${part}".`;
          return;
        }
        const from = parseInt(m[1], 10);
        const to = m[2] !== undefined ? parseInt(m[2], 10) : from;
        if (from < 1 || to < 1 || from > this.split.pageCount || to > this.split.pageCount) {
          this.split.rangeError = `Bereik "${part}" buiten 1..${this.split.pageCount}.`;
          return;
        }
        if (from > to) {
          this.split.rangeError = `Bereik "${part}" loopt achteruit.`;
          return;
        }
        const pages = [];
        for (let i = from; i <= to; i++) pages.push(i);
        ranges.push({
          label: from === to ? `pagina ${from}` : `pagina's ${from}-${to}`,
          from, to, pages,
        });
      }
      this.split.parsedRanges = ranges;
    },

    splitReset() {
      this.split.file = null;
      this.split.pageCount = 0;
      this.split.rangeInput = '';
      this.split.parsedRanges = [];
      this.split.rangeError = '';
      this.split.error = '';
      this.split.notice = '';
    },

    async runSplit() {
      if (this.split.busy) return;
      if (!this.split.file || !this.split.parsedRanges.length) return;
      if (this.split.rangeError) return;
      if (!window.PDFLib) {
        this.split.error = 'pdf-lib is niet geladen.';
        return;
      }
      this.split.busy = true;
      this.split.error = '';
      this.split.notice = '';
      try {
        const { PDFDocument } = window.PDFLib;
        const buf = await this.split.file.arrayBuffer();
        const src = await PDFDocument.load(buf, { ignoreEncryption: false });
        const baseName = this.split.file.name.replace(/\.pdf$/i, '');

        for (let i = 0; i < this.split.parsedRanges.length; i++) {
          const r = this.split.parsedRanges[i];
          const out = await PDFDocument.create();
          const pageIdx = r.pages.map(p => p - 1);
          const copied = await out.copyPages(src, pageIdx);
          copied.forEach(p => out.addPage(p));
          const bytes = await out.save();
          const suffix = r.from === r.to ? `page_${r.from}` : `pages_${r.from}-${r.to}`;
          const fn = `${baseName}_${suffix}.pdf`;
          this._downloadBlob(bytes, fn, 'application/pdf');
          // Laatste split-PDF wordt de "output" voor de output-bar.
          if (i === this.split.parsedRanges.length - 1) {
            this._setOutput(bytes, fn, `split (${this.split.parsedRanges.length} ranges, laatste getoond)`);
          }
          if (i < this.split.parsedRanges.length - 1) await this._sleep(200);
        }
        this.split.notice = `Gesplitst: ${this.split.parsedRanges.length} PDF${this.split.parsedRanges.length === 1 ? '' : '\'s'} gedownload.`;
      } catch (e) {
        this.split.error = e.message || String(e);
      } finally {
        this.split.busy = false;
      }
    },

    _sleep(ms) {
      return new Promise(r => setTimeout(r, ms));
    },

    // ---------- Fill ----------

    onFillFileInput(ev) {
      this._fillLoad(ev.target.files && ev.target.files[0]);
      ev.target.value = '';
    },

    onFillDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files && dt.files[0]) this._fillLoad(dt.files[0]);
    },

    async _fillLoad(f) {
      this.fill.error = '';
      this.fill.notice = '';
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) {
        this.fill.error = `"${f.name}" is geen PDF.`;
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        this.fill.error = `"${f.name}" overschrijdt 50 MB.`;
        return;
      }
      if (!window.PDFLib) {
        this.fill.error = 'pdf-lib is niet geladen.';
        return;
      }
      this.fill.loading = true;
      this.fill.file = f;
      this.fill.fields = [];
      this.fill.pages = [];
      this.fill.detected = [];
      try {
        this.fill.pdfBytes = new Uint8Array(await f.arrayBuffer());
        const srcCheck = await window.PDFLib.PDFDocument.load(this.fill.pdfBytes, { ignoreEncryption: false });
        this.fill.pageCount = srcCheck.getPageCount();
        this.fill.pages = Array.from({ length: this.fill.pageCount }, (_, i) => ({ index: i }));

        // Wacht op pdfjsLib (kan async geladen worden)
        await this._waitForPdfJs();
        if (!window.pdfjsLib) {
          this.fill.error = 'PDF.js is niet geladen — preview niet mogelijk. Probeer opnieuw of refresh de pagina.';
          this.fill.loading = false;
          return;
        }

        // Render alle pages + scan voor platte (visuele) invul-velden
        await this.$nextTick();
        const loadingTask = window.pdfjsLib.getDocument({ data: this.fill.pdfBytes.slice() });
        const pdf = await loadingTask.promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.getElementById('fill-canvas-' + (i - 1));
          if (!canvas) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          this.fill.pages[i - 1].width = viewport.width;
          this.fill.pages[i - 1].height = viewport.height;
          // Detecteer visuele invul-velden (dot-runs / underscore-runs) op deze pagina
          try {
            const tc = await page.getTextContent();
            this._collectFlatFields(tc.items, i - 1, viewport.height);
          } catch (e) { /* getTextContent kan falen op image-only PDFs — geen blocker */ }
        }
        // Merge naast elkaar liggende dot-runs op dezelfde baseline (binnen 1 line)
        this._mergeAdjacentDetected();
      } catch (e) {
        if (String(e).toLowerCase().includes('encrypt')) {
          this.fill.error = `"${f.name}" is versleuteld en kan niet worden ingevuld.`;
        } else {
          this.fill.error = e.message || String(e);
        }
        this.fill.file = null;
      } finally {
        this.fill.loading = false;
      }
    },

    async _waitForPdfJs() {
      const maxWait = 3000, step = 50;
      let waited = 0;
      while (!window.pdfjsLib && waited < maxWait) {
        await this._sleep(step);
        waited += step;
      }
    },

    addFillField(ev, pageIdx) {
      // Voorkom dat klik in een bestaand input-veld nieuwe field aanmaakt
      if (ev.target && ev.target.tagName === 'INPUT') return;
      const canvas = ev.currentTarget;
      const rect = canvas.getBoundingClientRect();
      // CSS-pixels → canvas-pixels (canvas kan via CSS gerescaled zijn op kleine viewports)
      const sx = canvas.width  / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);
      const rawX = (ev.clientX - rect.left) * sx;
      const rawY = (ev.clientY - rect.top)  * sy;
      // Snap-to-line: zoek dichtstbijzijnde gedetecteerde dot/underscore-run op deze pagina
      const snap = this._findSnapCandidate(pageIdx, rawX, rawY);
      const fs = snap
        ? Math.max(8, Math.min(this.fill.fontSize, Math.round(snap.fontSize * 0.85)))
        : this.fill.fontSize;
      this.fill.fields.push({
        id: ++this.fill.seq,
        page: pageIdx,
        x: snap ? snap.x : rawX,
        // Bij snap: lift baseline ~0.55× font-hoogte boven de dot-lijn zodat de
        // tekst BOVEN de lijn staat (handgeschreven-stijl op papier), i.p.v. de
        // dots door de tekst heen te laten lopen.
        y: snap ? (snap.y - snap.fontSize * 0.55) : rawY,
        text: '',
        fontSize: fs,
        snapped: !!snap,
      });
    },

    // Zoekt de dichtstbijzijnde gedetecteerde dot/underscore-run binnen Y-tolerantie
    // en geeft {x, y (baseline), fontSize, width} terug — of null als niets in de buurt.
    _findSnapCandidate(pageIdx, x, y) {
      if (!this.fill.detected || !this.fill.detected.length) return null;
      const SNAP_Y = 18;   // verticale tolerantie in px (canvas-coords ≈ pt op scale=1.0)
      const SLOP_X = 24;   // horizontaal mag user erbuiten klikken
      let best = null, bestDist = Infinity;
      for (const d of this.fill.detected) {
        if (d.page !== pageIdx) continue;
        const dy = Math.abs(d.y - y);
        if (dy > SNAP_Y) continue;
        if (x < d.x - SLOP_X || x > d.x + d.width + SLOP_X) continue;
        // dichter bij baseline → beter; bij gelijke Y dichter bij start-X → beter
        const dist = dy * 10 + Math.max(0, d.x - x) + Math.max(0, x - (d.x + d.width));
        if (dist < bestDist) { best = d; bestDist = dist; }
      }
      return best;
    },

    // Verzamelt dot-runs/underscore-runs uit PDF.js text-items voor pagina pageIdx.
    // text-item.transform = [a, b, c, d, e, f]  (translate = e,f; fontSize ≈ |d| of |a|).
    // PDF-coords → canvas-coords: x_canvas = e ; y_canvas_baseline = viewportH - f.
    _collectFlatFields(items, pageIdx, viewportH) {
      const DOT_RUN = /^[\s]*[.·…_](?:[\s]*[.·…_]){2,}[\s]*$/;  // ≥3 dots/middots/underscores
      for (const it of items) {
        if (!it || typeof it.str !== 'string') continue;
        if (!DOT_RUN.test(it.str)) continue;
        const tr = it.transform;
        if (!tr || tr.length < 6) continue;
        const fontSize = Math.abs(tr[3]) || Math.abs(tr[0]) || 12;
        const pdfX = tr[4];
        const pdfYBaseline = tr[5];
        const width = it.width || (pdfX > 0 ? Math.max(50, it.str.length * fontSize * 0.28) : 60);
        this.fill.detected.push({
          page: pageIdx,
          x: pdfX,                              // canvas-X (scale = 1.0)
          y: viewportH - pdfYBaseline,          // canvas-Y baseline
          width,
          fontSize,
          kind: it.str.includes('_') ? 'underscore' : 'dot',
        });
      }
    },

    // Sommige PDF's renderen 1 visueel veld als meerdere text-items met spaties ertussen.
    // Merge ze als ze (1) zelfde pagina, (2) baseline ≤ 2px verschilt, (3) X-gap ≤ 20px.
    _mergeAdjacentDetected() {
      const det = this.fill.detected;
      if (det.length < 2) return;
      det.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
      const merged = [det[0]];
      for (let i = 1; i < det.length; i++) {
        const prev = merged[merged.length - 1];
        const cur  = det[i];
        if (cur.page === prev.page
            && Math.abs(cur.y - prev.y) <= 2
            && cur.x - (prev.x + prev.width) <= 20) {
          prev.width = (cur.x + cur.width) - prev.x;
          if (cur.kind === 'underscore') prev.kind = 'underscore';
        } else {
          merged.push(cur);
        }
      }
      this.fill.detected = merged;
    },

    removeFillField(id) {
      this.fill.fields = this.fill.fields.filter(f => f.id !== id);
    },

    // AUTO — herken invulbare formuliervelden (AcroForm) en plaats er automatisch
    // tekstvelden op. Logica: lees de PDF-form, neem tekst-achtige velden + hun
    // widget-rechthoek per pagina, en map naar canvas-coords (zelfde transform als runFill).
    async autoDetectFields() {
      if (this.fill.busy) return;
      if (!this.fill.pdfBytes) { this.fill.error = 'Laad eerst een PDF.'; return; }
      this.fill.busy = true; this.fill.error = ''; this.fill.notice = '';
      try {
        const { PDFDocument } = window.PDFLib;
        const doc = await PDFDocument.load(this.fill.pdfBytes.slice(), { ignoreEncryption: false });
        let form = null;
        try { form = doc.getForm(); } catch (e) { form = null; }
        const fields = form ? form.getFields() : [];
        const pages = doc.getPages();
        const pageRefs = pages.map(p => p.ref);
        let added = 0;
        for (const field of fields) {
          // Alleen tekstvelden — minify-bestendig via de publieke setText-methode
          // (constructor.name is onbruikbaar omdat pdf-lib geminified van CDN komt).
          if (typeof field.setText !== 'function') continue;
          let widgets = [];
          try { widgets = field.acroField.getWidgets(); } catch (e) { continue; }
          for (const w of widgets) {
            let r; try { r = w.getRectangle(); } catch (e) { continue; }
            if (!r || r.width <= 1 || r.height <= 1) continue;
            let pIdx = 0;
            try { const pref = w.P && w.P(); if (pref) { const idx = pageRefs.findIndex(x => x === pref); if (idx >= 0) pIdx = idx; } } catch (e) { /* fallback pagina 0 */ }
            const prev = this.fill.pages[pIdx], pdfPage = pages[pIdx];
            if (!prev || !pdfPage) continue;
            const { width: pdfW, height: pdfH } = pdfPage.getSize();
            const sx = prev.width / pdfW, sy = prev.height / pdfH;
            const fontSize = Math.max(8, Math.min(20, Math.round(r.height * 0.62)));
            this.fill.fields.push({
              id: ++this.fill.seq,
              page: pIdx,
              x: (r.x + 2) * sx,
              y: (pdfH - (r.y + r.height * 0.28)) * sy,
              text: '',
              fontSize,
            });
            added++;
          }
        }
        if (added > 0) {
          this.fill.notice = `${added} AcroForm-veld(en) automatisch herkend en geplaatst — typ je tekst. Klik handmatig op de pagina voor extra velden.`;
        } else {
          // Fallback: platte PDF — gebruik visueel gedetecteerde dot/underscore-runs
          let visualAdded = 0;
          for (const d of this.fill.detected) {
            this.fill.fields.push({
              id: ++this.fill.seq,
              page: d.page,
              x: d.x,
              y: d.y - d.fontSize * 0.55,         // tekst boven de dot-lijn (handgeschreven-stijl)
              text: '',
              fontSize: Math.max(8, Math.min(this.fill.fontSize, Math.round(d.fontSize * 0.85))),
              snapped: true,
            });
            visualAdded++;
          }
          if (visualAdded > 0) {
            this.fill.notice = `${visualAdded} invulveld(en) visueel herkend (platte PDF, op basis van dotted/underscore-lijnen) — typ je tekst. Klik handmatig op de pagina voor extra velden.`;
          } else {
            this.fill.error = 'Geen invulbare formuliervelden gevonden — noch AcroForm, noch visuele dotted/underscore-lijnen. Plaats velden handmatig door op de pagina te klikken.';
          }
        }
      } catch (e) {
        this.fill.error = 'Auto-herkennen mislukt: ' + (e.message || String(e));
      } finally {
        this.fill.busy = false;
      }
    },

    fillReset() {
      this.fill.file = null;
      this.fill.pdfBytes = null;
      this.fill.pageCount = 0;
      this.fill.pages = [];
      this.fill.fields = [];
      this.fill.detected = [];
      this.fill.error = '';
      this.fill.notice = '';
    },

    // ---------- OCR ----------

    onOcrFileInput(ev) {
      this._ocrSet(ev.target.files && ev.target.files[0]);
      ev.target.value = '';
    },
    onOcrDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files && dt.files[0]) this._ocrSet(dt.files[0]);
    },
    _ocrSet(f) {
      this.ocr.error = '';
      this.ocr.notice = '';
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) { this.ocr.error = `"${f.name}" is geen PDF.`; return; }
      if (f.size > MAX_FILE_BYTES) { this.ocr.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      this.ocr.file = f;
    },
    ocrReset() {
      this.ocr.file = null;
      this.ocr.error = '';
      this.ocr.notice = '';
    },
    async runOcr() {
      if (this.ocr.busy || !this.ocr.file) return;
      this.ocr.busy = true;
      this.ocr.error = '';
      this.ocr.notice = '';
      try {
        const fd = new FormData();
        fd.append('file', this.ocr.file, this.ocr.file.name);
        const r = await fetch(this._apiUrl('/api/ocr'), { method: 'POST', body: fd });
        if (!r.ok) {
          let detail = '';
          try { detail = (await r.json()).detail || ''; } catch {}
          if (r.status === 501) {
            throw new Error('OCR-endpoint nog niet actief op deze deploy.');
          }
          throw new Error(`OCR mislukt (${r.status}). ${detail}`);
        }
        const bytes = new Uint8Array(await r.arrayBuffer());
        const base = this.ocr.file.name.replace(/\.pdf$/i, '');
        const fn = `${base}_ocr.pdf`;
        this._downloadBlob(bytes, fn, 'application/pdf');
        this._setOutput(bytes, fn, 'ocr (Tesseract nld+eng)');
        this.ocr.notice = `Doorzoekbaar gemaakt → ${fn} gedownload.`;
      } catch (e) {
        this.ocr.error = e.message || String(e);
      } finally {
        this.ocr.busy = false;
      }
    },

    // ---------- Watermerk ----------

    onWatermarkFileInput(ev) {
      this._watermarkLoad(ev.target.files && ev.target.files[0]);
      ev.target.value = '';
    },
    onWatermarkDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files && dt.files[0]) this._watermarkLoad(dt.files[0]);
    },
    async _watermarkLoad(f) {
      this.watermark.error = '';
      this.watermark.notice = '';
      this.watermark.readResult = null;
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) { this.watermark.error = `"${f.name}" is geen PDF.`; return; }
      if (f.size > MAX_FILE_BYTES) { this.watermark.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      try {
        this.watermark.pdfBytes = new Uint8Array(await f.arrayBuffer());
        this.watermark.file = f;
      } catch (e) {
        this.watermark.error = 'Kon bestand niet lezen.';
      }
    },
    async onWatermarkImage(ev) {
      this.watermark.error = '';
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      const isSvg = /svg/i.test(f.type) || /\.svg$/i.test(f.name);
      const isPng = f.type === 'image/png' || /\.png$/i.test(f.name);
      if (!isSvg && !isPng) { this.watermark.error = 'Alleen SVG of PNG voor beeld-watermerk.'; return; }
      if (f.size > MAX_IMAGE_BYTES) { this.watermark.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      try {
        if (isSvg) {
          const svg = (await f.text()).replace(/<script[\s\S]*?<\/script>/gi, '');
          this.watermark.imageSrc = { svg };
        } else {
          this.watermark.imageSrc = { pngDataUrl: await this._fileToDataUrl(f) };
        }
        this.watermark.imageName = f.name;
      } catch (e) {
        this.watermark.error = 'Kon afbeelding niet lezen.';
      }
    },
    _watermarkEngine() {
      return window.PDFHorseWatermark || null;
    },
    async runWatermarkText() {
      if (this.watermark.busy) return;
      if (!this.watermark.pdfBytes) { this.watermark.error = 'Laad eerst een PDF.'; return; }
      const text = (this.watermark.text || '').trim();
      if (!text) { this.watermark.error = 'Geef watermerk-tekst op.'; return; }
      const eng = this._watermarkEngine();
      if (!eng) { this.watermark.error = 'Watermerk-engine niet geladen — refresh de pagina.'; return; }
      this.watermark.busy = true; this.watermark.error = ''; this.watermark.notice = '';
      try {
        const out = await eng.injectText(this.watermark.pdfBytes.slice(), text);
        const fn = this.watermark.file.name.replace(/\.pdf$/i, '') + '_watermark.pdf';
        this._downloadBlob(out, fn, 'application/pdf');
        this._setOutput(out, fn, 'watermerk (tekst, (vrijwel) onzichtbaar)');
        this.watermark.notice = `Watermerk toegevoegd → ${fn} gedownload.`;
      } catch (e) {
        this.watermark.error = e.message || String(e);
      } finally {
        this.watermark.busy = false;
      }
    },
    async runWatermarkImage() {
      if (this.watermark.busy) return;
      if (!this.watermark.pdfBytes) { this.watermark.error = 'Laad eerst een PDF.'; return; }
      if (!this.watermark.imageSrc) { this.watermark.error = 'Kies eerst een SVG- of PNG-afbeelding.'; return; }
      const eng = this._watermarkEngine();
      if (!eng) { this.watermark.error = 'Watermerk-engine niet geladen — refresh de pagina.'; return; }
      this.watermark.busy = true; this.watermark.error = ''; this.watermark.notice = '';
      try {
        const out = await eng.injectImage(this.watermark.pdfBytes.slice(), this.watermark.imageSrc);
        const fn = this.watermark.file.name.replace(/\.pdf$/i, '') + '_watermark.pdf';
        this._downloadBlob(out, fn, 'application/pdf');
        this._setOutput(out, fn, 'watermerk (beeld, vector-payload)');
        this.watermark.notice = `Beeld-watermerk toegevoegd → ${fn} gedownload.`;
      } catch (e) {
        this.watermark.error = e.message || String(e);
      } finally {
        this.watermark.busy = false;
      }
    },
    async runWatermarkRead() {
      if (this.watermark.busy) return;
      if (!this.watermark.pdfBytes) { this.watermark.error = 'Laad eerst een PDF.'; return; }
      const eng = this._watermarkEngine();
      if (!eng) { this.watermark.error = 'Watermerk-engine niet geladen — refresh de pagina.'; return; }
      this.watermark.busy = true; this.watermark.error = ''; this.watermark.notice = '';
      this.watermark.readResult = null; this.watermark.readDoc = null;
      try {
        const res = await eng.read(this.watermark.pdfBytes.slice());
        this.watermark.readResult = {
          payloads: res.payloads || [],
          repeatedText: res.repeatedText || [],
        };
        // Ook een embedded document-payload (modus Document / Geavanceerd-tab) proberen te lezen.
        const pe = this._payloadEngine();
        if (pe) {
          try {
            const env = await pe.extract(this.watermark.pdfBytes.slice());
            if (env) {
              if (env.enc) {
                this.watermark.readDoc = { name: env.name || 'payload.bin', bytes: null, enc: true };
              } else {
                this.watermark.readDoc = { name: env.name || 'payload.bin', bytes: await pe.open(env, null), enc: false };
              }
            }
          } catch (e) { /* geen document-payload in deze PDF — geen probleem */ }
        }
        const n = this.watermark.readResult.payloads.length;
        const parts = [];
        if (n) parts.push(`${n} watermerk-payload(s)`);
        if (this.watermark.readDoc) parts.push(`document-payload "${this.watermark.readDoc.name}"`);
        this.watermark.notice = parts.length
          ? parts.join(' + ') + ' gevonden.'
          : 'Geen PDFHorse-payload gevonden; mogelijk herhaalde tekst hieronder.';
      } catch (e) {
        this.watermark.error = e.message || String(e);
      } finally {
        this.watermark.busy = false;
      }
    },
    // ---- Document-payload als watermerk (hergebruikt PDFHorsePayload-engine) ----
    _payloadEngine() { return window.PDFHorsePayload || null; },
    async onWatermarkDoc(ev) {
      this.watermark.error = '';
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (f.size > MAX_FILE_BYTES) { this.watermark.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      try { this.watermark.docBytes = new Uint8Array(await f.arrayBuffer()); this.watermark.docName = f.name; }
      catch (e) { this.watermark.error = 'Kon document niet lezen.'; }
    },
    async runWatermarkDoc() {
      if (this.watermark.busy) return;
      if (!this.watermark.pdfBytes) { this.watermark.error = 'Laad eerst een PDF.'; return; }
      if (!this.watermark.docBytes) { this.watermark.error = 'Kies eerst een document om in te bedden.'; return; }
      const pe = this._payloadEngine();
      if (!pe) { this.watermark.error = 'Payload-engine niet geladen — refresh de pagina.'; return; }
      this.watermark.busy = true; this.watermark.error = ''; this.watermark.notice = '';
      try {
        const envelope = pe.buildPlain(this.watermark.docName, this.watermark.docBytes);
        const out = await pe.attach(this.watermark.pdfBytes, envelope);
        const fn = this.watermark.file.name.replace(/\.pdf$/i, '') + '_watermark.pdf';
        this._downloadBlob(out, fn, 'application/pdf');
        this._setOutput(out, fn, `watermerk (document-payload: ${this.watermark.docName})`);
        this.watermark.notice = `Document "${this.watermark.docName}" als watermerk-payload ingebed → ${fn} gedownload. Lees het terug via modus "Lezen".`;
      } catch (e) { this.watermark.error = e.message || String(e); }
      finally { this.watermark.busy = false; }
    },
    downloadWatermarkDoc() {
      if (!this.watermark.readDoc || !this.watermark.readDoc.bytes) return;
      this._downloadBlob(this.watermark.readDoc.bytes, this.watermark.readDoc.name || 'payload.bin', 'application/octet-stream');
    },
    watermarkReset() {
      this.watermark.file = null;
      this.watermark.pdfBytes = null;
      this.watermark.text = '';
      this.watermark.imageName = '';
      this.watermark.imageSrc = null;
      this.watermark.docBytes = null;
      this.watermark.docName = '';
      this.watermark.readResult = null;
      this.watermark.readDoc = null;
      this.watermark.error = '';
      this.watermark.notice = '';
    },

    // ---------- Geavanceerd (payload-bestand + keypair encrypt/decrypt) ----------

    _advEngine() { return window.PDFHorsePayload || null; },

    _downloadJson(obj, filename) {
      const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 2));
      this._downloadBlob(bytes, filename, 'application/json');
    },

    async _advReadJsonFile(f) {
      return JSON.parse(await f.text());
    },

    // PDF: doel-PDF (embed) of bron-PDF (extract)
    onAdvPdfInput(ev) { this._advPdfLoad(ev.target.files && ev.target.files[0]); ev.target.value = ''; },
    onAdvPdfDrop(ev) { const dt = ev.dataTransfer; if (dt && dt.files && dt.files[0]) this._advPdfLoad(dt.files[0]); },
    async _advPdfLoad(f) {
      this.advanced.error = ''; this.advanced.notice = '';
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) { this.advanced.error = `"${f.name}" is geen PDF.`; return; }
      if (f.size > MAX_FILE_BYTES) { this.advanced.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      try { this.advanced.pdfBytes = new Uint8Array(await f.arrayBuffer()); this.advanced.pdfFile = f; }
      catch (e) { this.advanced.error = 'Kon PDF niet lezen.'; }
    },

    // Payload-bestand (willekeurig binair)
    async onPayloadInput(ev) {
      this.advanced.error = '';
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (f.size > MAX_FILE_BYTES) { this.advanced.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      try { this.advanced.payloadBytes = new Uint8Array(await f.arrayBuffer()); this.advanced.payloadName = f.name; }
      catch (e) { this.advanced.error = 'Kon payload-bestand niet lezen.'; }
    },

    // ---- Keypair-beheer ----
    async genKeypair() {
      const eng = this._advEngine(); if (!eng) { this.advanced.error = 'Payload-engine niet geladen.'; return; }
      this.advanced.busy = true; this.advanced.error = ''; this.advanced.notice = '';
      try {
        const kp = await eng.generateKeypair();
        this.advanced.keypair = kp;
        this.advanced.privateJwk = kp.privateJwk;     // eigen private key, klaar om te ontsleutelen
        this.advanced.privateName = '(net aangemaakt)';
        this.advanced.notice = 'Keypair aangemaakt (RSA-OAEP 2048). Download je keypair en bewaar het veilig — sleutels verlaten je browser niet vanzelf.';
      } catch (e) { this.advanced.error = e.message || String(e); }
      finally { this.advanced.busy = false; }
    },
    downloadKeypair() {
      if (!this.advanced.keypair) { this.advanced.error = 'Maak eerst een keypair aan.'; return; }
      this._downloadJson({ pdfhorse: 'keypair-v1', publicJwk: this.advanced.keypair.publicJwk, privateJwk: this.advanced.keypair.privateJwk }, 'pdfhorse-keypair.json');
    },
    downloadPublicKey() {
      const pub = this.advanced.keypair && this.advanced.keypair.publicJwk;
      if (!pub) { this.advanced.error = 'Maak eerst een keypair aan.'; return; }
      this._downloadJson({ pdfhorse: 'publickey-v1', publicJwk: pub }, 'pdfhorse-publickey.json');
    },
    async onPeerPublicUpload(ev) {
      this.advanced.error = '';
      const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      try {
        const j = await this._advReadJsonFile(f);
        const jwk = j.publicJwk || (j.kty ? j : null);
        if (!jwk || jwk.kty !== 'RSA') throw new Error('Geen geldige RSA public key (JWK).');
        this.advanced.peerPublicJwk = jwk; this.advanced.peerPublicName = f.name;
        this.advanced.notice = `Peer public key geladen (${f.name}) — je kunt nu voor deze ontvanger versleutelen.`;
      } catch (e) { this.advanced.error = 'Public key lezen mislukt: ' + (e.message || e); }
    },
    async onPrivateUpload(ev) {
      this.advanced.error = '';
      const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      try {
        const j = await this._advReadJsonFile(f);
        const jwk = j.privateJwk || (j.kty && j.d ? j : null);
        if (!jwk || jwk.kty !== 'RSA' || !jwk.d) throw new Error('Geen geldige RSA private key (JWK).');
        this.advanced.privateJwk = jwk; this.advanced.privateName = f.name;
        this.advanced.notice = `Private key geladen (${f.name}) — klaar om te ontsleutelen.`;
      } catch (e) { this.advanced.error = 'Private key lezen mislukt: ' + (e.message || e); }
    },

    // ---- Embed payload in PDF ----
    async runEmbed() {
      if (this.advanced.busy) return;
      const eng = this._advEngine(); if (!eng) { this.advanced.error = 'Payload-engine niet geladen.'; return; }
      if (!this.advanced.pdfBytes) { this.advanced.error = 'Kies eerst een doel-PDF.'; return; }
      if (!this.advanced.payloadBytes) { this.advanced.error = 'Kies eerst een payload-bestand.'; return; }
      if (this.advanced.useEncryption && !this.advanced.peerPublicJwk) { this.advanced.error = 'Encryptie staat aan, maar er is geen peer public key geladen.'; return; }
      this.advanced.busy = true; this.advanced.error = ''; this.advanced.notice = '';
      try {
        let envelope;
        if (this.advanced.useEncryption) {
          const encObj = await eng.encrypt(this.advanced.payloadBytes, this.advanced.peerPublicJwk);
          envelope = eng.buildEncrypted(this.advanced.payloadName, encObj);
        } else {
          envelope = eng.buildPlain(this.advanced.payloadName, this.advanced.payloadBytes);
        }
        const out = await eng.attach(this.advanced.pdfBytes, envelope);
        const fn = this.advanced.pdfFile.name.replace(/\.pdf$/i, '') + '_payload.pdf';
        this._downloadBlob(out, fn, 'application/pdf');
        this._setOutput(out, fn, `payload (${this.advanced.useEncryption ? 'versleuteld' : 'plain'}: ${this.advanced.payloadName})`);
        this.advanced.notice = `Payload "${this.advanced.payloadName}" ${this.advanced.useEncryption ? 'versleuteld ' : ''}ingebed → ${fn} gedownload.`;
      } catch (e) { this.advanced.error = e.message || String(e); }
      finally { this.advanced.busy = false; }
    },

    // ---- Extract payload uit PDF ----
    async runExtract() {
      if (this.advanced.busy) return;
      const eng = this._advEngine(); if (!eng) { this.advanced.error = 'Payload-engine niet geladen.'; return; }
      if (!this.advanced.pdfBytes) { this.advanced.error = 'Kies eerst een PDF met payload.'; return; }
      this.advanced.busy = true; this.advanced.error = ''; this.advanced.notice = '';
      try {
        const env = await eng.extract(this.advanced.pdfBytes);
        const bytes = await eng.open(env, this.advanced.privateJwk);
        const name = env.name || 'payload.bin';
        this._downloadBlob(bytes, name, 'application/octet-stream');
        this.advanced.notice = `Payload "${name}" (${env.enc ? 'ontsleuteld' : 'plain'}) uit PDF gehaald en gedownload.`;
      } catch (e) { this.advanced.error = e.message || String(e); }
      finally { this.advanced.busy = false; }
    },

    advancedReset() {
      this.advanced.pdfFile = null; this.advanced.pdfBytes = null;
      this.advanced.payloadBytes = null; this.advanced.payloadName = '';
      this.advanced.error = ''; this.advanced.notice = '';
    },

    // ---------- Convert ----------

    onConvertFileInput(ev) {
      this._convertAddFiles(ev.target.files);
      ev.target.value = '';
    },

    onConvertDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files) this._convertAddFiles(dt.files);
    },

    _convertDetectKind(f) {
      const n = f.name.toLowerCase();
      if (f.type === DOCX_MIME || n.endsWith('.docx')) return 'docx';
      if (f.type === XLSX_MIME || n.endsWith('.xlsx')) return 'xlsx';
      if (f.type === ODT_MIME || n.endsWith('.odt')) return 'odt';
      if (f.type === RTF_MIME || f.type === 'text/rtf' || n.endsWith('.rtf')) return 'rtf';
      if (f.type === 'image/png' || n.endsWith('.png')) return 'png';
      if (f.type === 'image/jpeg' || /\.jpe?g$/i.test(n)) return 'jpg';
      return null;
    },

    _convertAddFiles(fileList) {
      this.convert.error = '';
      this.convert.notice = '';
      const incoming = Array.from(fileList || []);
      const accepted = [];
      for (const f of incoming) {
        const kind = this._convertDetectKind(f);
        if (!kind) { this.convert.error = `"${f.name}" niet ondersteund.`; continue; }
        const limit = ['docx', 'xlsx', 'odt', 'rtf'].includes(kind) ? MAX_DOCX_BYTES : MAX_IMAGE_BYTES;
        if (f.size > limit) {
          this.convert.error = `"${f.name}" overschrijdt ${limit / (1024*1024)} MB.`;
          continue;
        }
        accepted.push({
          id: ++this.convert.seq,
          name: f.name,
          size: f.size,
          blob: f,
          kind,
        });
      }
      this.convert.files.push(...accepted);
    },

    convertMove(i, delta) {
      const j = i + delta;
      if (j < 0 || j >= this.convert.files.length) return;
      const a = this.convert.files;
      [a[i], a[j]] = [a[j], a[i]];
    },

    convertRemove(i) {
      this.convert.files.splice(i, 1);
    },

    convertReset() {
      this.convert.files = [];
      this.convert.error = '';
      this.convert.notice = '';
    },

    async _imageToPdf(file, kind) {
      // Client-side: maak A4-PDF met image fit-to-page (margin 36pt).
      const { PDFDocument } = window.PDFLib;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfDoc = await PDFDocument.create();
      const img = kind === 'png'
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes);
      const A4_W = 595, A4_H = 842, MARGIN = 36;
      const availW = A4_W - 2 * MARGIN;
      const availH = A4_H - 2 * MARGIN;
      const scale = Math.min(availW / img.width, availH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const page = pdfDoc.addPage([A4_W, A4_H]);
      page.drawImage(img, {
        x: (A4_W - w) / 2,
        y: (A4_H - h) / 2,
        width: w, height: h,
      });
      return await pdfDoc.save();
    },

    async _officeToPdf(file, kind) {
      // Server-side via LibreOffice
      const fd = new FormData();
      fd.append('file', file, file.name);
      const route = `/api/convert/${kind}-to-pdf`;
      const r = await fetch(this._apiUrl(route), { method: 'POST', body: fd });
      if (!r.ok) {
        let detail = '';
        try { detail = (await r.json()).detail || ''; } catch {}
        throw new Error(`Conversie mislukt voor "${file.name}" (${r.status}). ${detail}`);
      }
      return new Uint8Array(await r.arrayBuffer());
    },

    async runConvert() {
      if (this.convert.busy || !this.convert.files.length) return;
      if (!window.PDFLib) { this.convert.error = 'pdf-lib niet geladen.'; return; }
      this.convert.busy = true;
      this.convert.progress = '';
      this.convert.error = '';
      this.convert.notice = '';

      try {
        const { PDFDocument } = window.PDFLib;
        const combined = this.convert.combine ? await PDFDocument.create() : null;
        const total = this.convert.files.length;
        let lastBytes = null;
        let lastFilename = '';

        for (let i = 0; i < total; i++) {
          const f = this.convert.files[i];
          this.convert.progress = `Converteert ${i + 1}/${total}: ${f.name}`;
          await this._sleep(20);  // UI yield

          let pdfBytes;
          if (['docx', 'xlsx', 'odt', 'rtf'].includes(f.kind)) {
            pdfBytes = await this._officeToPdf(f.blob, f.kind);
          } else {
            pdfBytes = await this._imageToPdf(f.blob, f.kind);
          }

          if (combined) {
            const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
            const pages = await combined.copyPages(src, src.getPageIndices());
            pages.forEach(p => combined.addPage(p));
            lastFilename = 'converted.pdf';
          } else {
            const base = f.name.replace(/\.(docx|xlsx|odt|rtf|png|jpe?g)$/i, '');
            const fn = `${base}.pdf`;
            this._downloadBlob(pdfBytes, fn, 'application/pdf');
            lastBytes = pdfBytes;
            lastFilename = fn;
            if (i < total - 1) await this._sleep(200);  // popup-blocker mitigation
          }
        }

        if (combined) {
          const out = await combined.save();
          this._downloadBlob(out, 'converted.pdf', 'application/pdf');
          this._setOutput(out, 'converted.pdf', `convert (${total} bestanden gecombineerd)`);
          this.convert.notice = `Gecombineerd: ${total} bestanden → converted.pdf gedownload.`;
        } else {
          this._setOutput(lastBytes, lastFilename, `convert (${total} bestanden, laatste getoond)`);
          this.convert.notice = `Geconverteerd: ${total} PDF${total === 1 ? '' : '\'s'} gedownload.`;
        }
      } catch (e) {
        this.convert.error = e.message || String(e);
      } finally {
        this.convert.busy = false;
        this.convert.progress = '';
      }
    },

    // ---------- Sign ----------

    onSignFileInput(ev) {
      this._signLoad(ev.target.files && ev.target.files[0]);
      ev.target.value = '';
    },

    onSignDrop(ev) {
      const dt = ev.dataTransfer;
      if (dt && dt.files && dt.files[0]) this._signLoad(dt.files[0]);
    },

    async _signLoad(f) {
      this.sign.error = '';
      this.sign.notice = '';
      this.sign.placements = [];
      this.sign.pages = [];
      if (!f) return;
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (!isPdf) { this.sign.error = `"${f.name}" is geen PDF.`; return; }
      if (f.size > MAX_FILE_BYTES) { this.sign.error = `"${f.name}" overschrijdt 50 MB.`; return; }
      if (!window.PDFLib) { this.sign.error = 'pdf-lib is niet geladen.'; return; }
      this.sign.file = f;
      let bytes;
      try {
        bytes = new Uint8Array(await f.arrayBuffer());
      } catch (e) {
        this.sign.error = 'Kon bestand niet lezen.';
        this.sign.file = null;
        return;
      }
      await this._signLoadBytes(bytes, f.name);
    },

    // Laadt PDF-bytes (uit upload óf overdracht uit "Invullen") in de
    // Ondertekenen-tab en rendert de pagina-previews. Zet sign.file naar een
    // pseudo-bestand {name} als er nog geen echt File-object geladen is.
    async _signLoadBytes(bytes, name) {
      this.sign.placements = [];
      this.sign.pages = [];
      if (!window.PDFLib) { this.sign.error = 'pdf-lib is niet geladen.'; return; }
      this.sign.loading = true;
      if (!this.sign.file) this.sign.file = { name };
      try {
        this.sign.pdfBytes = new Uint8Array(bytes);
        const srcCheck = await window.PDFLib.PDFDocument.load(this.sign.pdfBytes, { ignoreEncryption: false });
        this.sign.pageCount = srcCheck.getPageCount();
        this.sign.pages = Array.from({ length: this.sign.pageCount }, (_, i) => ({ index: i }));

        await this._waitForPdfJs();
        if (!window.pdfjsLib) {
          this.sign.error = 'PDF.js is niet geladen — preview niet mogelijk.';
          this.sign.loading = false;
          return;
        }
        await this.$nextTick();
        const loadingTask = window.pdfjsLib.getDocument({ data: this.sign.pdfBytes.slice() });
        const pdf = await loadingTask.promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.getElementById('sign-canvas-' + (i - 1));
          if (!canvas) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          this.sign.pages[i - 1].width = viewport.width;
          this.sign.pages[i - 1].height = viewport.height;
        }
      } catch (e) {
        if (String(e).toLowerCase().includes('encrypt')) {
          this.sign.error = `"${name}" is versleuteld en kan niet worden ondertekend.`;
        } else {
          this.sign.error = e.message || String(e);
        }
        this.sign.file = null;
      } finally {
        this.sign.loading = false;
      }
    },

    setSignMode(m) {
      this.sign.mode = m;
      if (m === 'C') {
        // Init signature_pad zodra DOM klaar is
        this.$nextTick(() => this._signPadInit());
      }
    },

    _signPadInit() {
      const canvas = document.getElementById('sign-pad');
      if (!canvas || !window.SignaturePad) return;
      if (this.sign._pad) return;          // al actief
      this.sign._pad = new window.SignaturePad(canvas, {
        backgroundColor: 'rgba(255,255,255,1)',
        penColor: 'rgb(0,0,0)',
      });
    },

    signPadClear() {
      if (this.sign._pad) this.sign._pad.clear();
    },

    signPadCommit() {
      this.sign.sigError = '';
      if (!this.sign._pad || this.sign._pad.isEmpty()) {
        this.sign.sigError = 'Teken eerst een handtekening.';
        return;
      }
      // toDataURL geeft PNG met witte achtergrond — converteer naar transparant
      const canvas = document.getElementById('sign-pad');
      this._whiteToTransparentDataUrl(canvas)
        .then(url => { this.sign.dataUrl = url; })
        .catch(() => { this.sign.dataUrl = canvas.toDataURL('image/png'); });
    },

    async _whiteToTransparentDataUrl(srcCanvas) {
      // Maak werkkopie + zet bijna-witte pixels op alpha=0
      const w = srcCanvas.width, h = srcCanvas.height;
      const work = document.createElement('canvas');
      work.width = w; work.height = h;
      const ctx = work.getContext('2d');
      ctx.drawImage(srcCanvas, 0, 0);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        // Als pixel bijna wit is → transparant
        if (d[i] > 240 && d[i+1] > 240 && d[i+2] > 240) {
          d[i+3] = 0;
        }
      }
      ctx.putImageData(img, 0, 0);
      return work.toDataURL('image/png');
    },

    // Exporteer de zojuist getekende handtekening (modus C) als bestand zodat
    // je hem kunt bewaren/hergebruiken. SVG = echte vector (signature_pad), PNG
    // = transparante achtergrond (bijna-witte pixels → alpha 0).
    exportSignPng() {
      this.sign.sigError = '';
      if (!this.sign._pad || this.sign._pad.isEmpty()) {
        this.sign.sigError = 'Teken eerst een handtekening.';
        return;
      }
      const canvas = document.getElementById('sign-pad');
      this._whiteToTransparentDataUrl(canvas)
        .then(url => this._downloadDataUrl(url, 'handtekening.png', 'image/png'))
        .catch(() => this._downloadDataUrl(canvas.toDataURL('image/png'), 'handtekening.png', 'image/png'));
    },

    exportSignSvg() {
      this.sign.sigError = '';
      if (!this.sign._pad || this.sign._pad.isEmpty()) {
        this.sign.sigError = 'Teken eerst een handtekening.';
        return;
      }
      // signature_pad geeft een base64 SVG-dataURL; decodeer naar exacte bytes.
      const dataUrl = this.sign._pad.toDataURL('image/svg+xml');
      this._downloadDataUrl(dataUrl, 'handtekening.svg', 'image/svg+xml');
    },

    _downloadDataUrl(dataUrl, filename, mime) {
      const b64 = dataUrl.split(',', 2)[1] || '';
      const bytes = this._base64ToUint8(b64);
      this._downloadBlob(bytes, filename, mime);
    },

    async onSignBitmap(ev) {
      this.sign.sigError = '';
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (!/^image\/(png|jpeg)$/.test(f.type) && !/\.(png|jpe?g)$/i.test(f.name)) {
        this.sign.sigError = 'Alleen PNG of JPG.';
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        this.sign.sigError = 'Bitmap mag max 10 MB zijn.';
        return;
      }
      try {
        this.sign.dataUrl = await this._fileToDataUrl(f);
      } catch (e) {
        this.sign.sigError = 'Kon bitmap niet lezen.';
      }
    },

    async onSignSvg(ev) {
      this.sign.sigError = '';
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      if (!/svg/i.test(f.type) && !/\.svg$/i.test(f.name)) {
        this.sign.sigError = 'Alleen SVG.';
        return;
      }
      if (f.size > 2 * 1024 * 1024) {
        this.sign.sigError = 'SVG mag max 2 MB zijn.';
        return;
      }
      try {
        const svgText = await f.text();
        // Strip <script>-tags voor de zekerheid (XSS-defense bij in-DOM gebruik)
        const safe = svgText.replace(/<script[\s\S]*?<\/script>/gi, '');
        const blob = new Blob([safe], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error('SVG laden mislukt'));
          img.src = url;
        });
        // Rasterize naar canvas (PNG met transparantie)
        const w = img.naturalWidth || 400;
        const h = img.naturalHeight || 120;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        this.sign.dataUrl = c.toDataURL('image/png');
        URL.revokeObjectURL(url);
      } catch (e) {
        this.sign.sigError = e.message || 'SVG-fout';
      }
    },

    _fileToDataUrl(f) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
    },

    addSignPlacement(ev, pageIdx) {
      if (!this.sign.dataUrl) {
        this.sign.error = 'Kies eerst een handtekening (A/B/C).';
        return;
      }
      if (ev.target && ev.target.tagName !== 'CANVAS') return;
      const canvas = ev.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this.sign.placements.push({
        id: ++this.sign.seq,
        page: pageIdx,
        x, y,
        width: this.sign.width,
      });
    },

    // Versleep een geplaatste handtekening met muis/touch/pen. Werkt met
    // pointer-events; klemt de positie binnen de pagina-canvas. De rect wordt
    // per move opnieuw gemeten zodat scrollen tijdens slepen niet verschuift.
    startSignDrag(ev, p) {
      ev.preventDefault();
      ev.stopPropagation();
      const canvas = document.getElementById('sign-canvas-' + p.page);
      if (!canvas) return;
      const startRect = canvas.getBoundingClientRect();
      const grabDX = ev.clientX - (startRect.left + p.x);
      const grabDY = ev.clientY - (startRect.top + p.y);
      try { ev.target.setPointerCapture && ev.target.setPointerCapture(ev.pointerId); } catch {}
      const move = (e) => {
        const r = canvas.getBoundingClientRect();
        let nx = e.clientX - r.left - grabDX;
        let ny = e.clientY - r.top - grabDY;
        nx = Math.max(0, Math.min(nx, r.width - 8));
        ny = Math.max(0, Math.min(ny, r.height - 8));
        p.x = nx;
        p.y = ny;
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    },

    removeSignPlacement(id) {
      this.sign.placements = this.sign.placements.filter(p => p.id !== id);
    },

    signReset() {
      this.sign.file = null;
      this.sign.pdfBytes = null;
      this.sign.pageCount = 0;
      this.sign.pages = [];
      this.sign.placements = [];
      this.sign.dataUrl = '';
      this.sign.error = '';
      this.sign.notice = '';
      this.sign.sigError = '';
    },

    async runSign() {
      if (this.sign.busy || !this.sign.placements.length || !this.sign.pdfBytes || !this.sign.dataUrl) return;
      this.sign.busy = true;
      this.sign.error = '';
      this.sign.notice = '';
      try {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(this.sign.pdfBytes.slice(), { ignoreEncryption: false });

        // dataUrl → bytes
        const head = this.sign.dataUrl.split(',', 2);
        const isPng = /image\/png/i.test(head[0]);
        const isJpg = /image\/jpe?g/i.test(head[0]);
        const sigBytes = this._base64ToUint8(head[1]);
        const sigImg = isPng
          ? await pdfDoc.embedPng(sigBytes)
          : isJpg
            ? await pdfDoc.embedJpg(sigBytes)
            : await pdfDoc.embedPng(sigBytes);  // default
        const sigAspect = sigImg.height / sigImg.width;

        const pages = pdfDoc.getPages();
        for (const p of this.sign.placements) {
          const pdfPage = pages[p.page];
          const previewPage = this.sign.pages[p.page];
          if (!pdfPage || !previewPage) continue;
          const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
          const scaleX = pdfWidth / previewPage.width;
          const scaleY = pdfHeight / previewPage.height;
          const pdfW = p.width * scaleX;
          const pdfH = (p.width * sigAspect) * scaleY;
          const pdfX = p.x * scaleX;
          const pdfY = pdfHeight - (p.y * scaleY) - pdfH;
          pdfPage.drawImage(sigImg, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
        }

        const out = await pdfDoc.save();
        const baseName = this.sign.file.name.replace(/\.pdf$/i, '');
        const fn = `${baseName}_signed.pdf`;
        this._downloadBlob(out, fn, 'application/pdf');
        this._setOutput(out, fn, `sign (${this.sign.placements.length} handtekening(en), modus ${this.sign.mode})`);
        this.sign.notice = `Ondertekend: ${this.sign.placements.length} handtekening(en) → ${fn} gedownload.`;
      } catch (e) {
        this.sign.error = e.message || String(e);
      } finally {
        this.sign.busy = false;
      }
    },

    _base64ToUint8(b64) {
      const bin = atob(b64);
      const len = bin.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    },

    async runFill() {
      if (this.fill.busy || !this.fill.fields.length || !this.fill.pdfBytes) return;
      this.fill.busy = true;
      this.fill.error = '';
      this.fill.notice = '';
      try {
        const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(this.fill.pdfBytes.slice(), { ignoreEncryption: false });
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        // Groepeer fields per page
        const byPage = {};
        for (const f of this.fill.fields) {
          if (!f.text) continue;
          (byPage[f.page] = byPage[f.page] || []).push(f);
        }

        for (const [pageIdx, fields] of Object.entries(byPage)) {
          const pIdx = parseInt(pageIdx, 10);
          const pdfPage = pages[pIdx];
          const previewPage = this.fill.pages[pIdx];
          if (!pdfPage || !previewPage) continue;
          const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
          const scaleX = pdfWidth / previewPage.width;
          const scaleY = pdfHeight / previewPage.height;
          for (const f of fields) {
            // Canvas-coords (top-left origin) → PDF-coords (bottom-left origin)
            const pdfX = f.x * scaleX;
            const pdfY = pdfHeight - (f.y * scaleY);
            pdfPage.drawText(f.text, {
              x: pdfX,
              y: pdfY,
              size: f.fontSize,
              font,
              color: rgb(0, 0, 0),
            });
          }
        }
        const out = await pdfDoc.save();
        const baseName = this.fill.file.name.replace(/\.pdf$/i, '');
        const fn = `${baseName}_filled.pdf`;
        this._downloadBlob(out, fn, 'application/pdf');
        this._setOutput(out, fn, `fill (${this.fill.fields.length} veld(en))`);
        // Maak de ingevulde PDF beschikbaar voor de Ondertekenen-tab, zodat je
        // er direct een handtekening op kunt zetten (auto bij tab-wissel of knop).
        this.signHandoff = { bytes: new Uint8Array(out), name: fn };
        this.fill.notice = `Ingevuld: ${this.fill.fields.length} veld(en) → ${fn} gedownload. Je kunt nu doorgaan naar Ondertekenen.`;
      } catch (e) {
        this.fill.error = e.message || String(e);
      } finally {
        this.fill.busy = false;
      }
    },
  };
}

window.pdfHorseApp = pdfHorseApp;
