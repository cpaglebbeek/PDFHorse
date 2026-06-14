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
    ],
    health: { status: '…', version: '…', codename: '…' },
    limits: {},

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

    init() {
      this.fetchHealth();
      this.fetchLimits();
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

        // Render alle pages
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
        }
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
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this.fill.fields.push({
        id: ++this.fill.seq,
        page: pageIdx,
        x, y,
        text: '',
        fontSize: this.fill.fontSize,
      });
    },

    removeFillField(id) {
      this.fill.fields = this.fill.fields.filter(f => f.id !== id);
    },

    fillReset() {
      this.fill.file = null;
      this.fill.pdfBytes = null;
      this.fill.pageCount = 0;
      this.fill.pages = [];
      this.fill.fields = [];
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
      this.sign.loading = true;
      this.sign.file = f;
      try {
        this.sign.pdfBytes = new Uint8Array(await f.arrayBuffer());
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
          this.sign.error = `"${f.name}" is versleuteld en kan niet worden ondertekend.`;
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
        this.fill.notice = `Ingevuld: ${this.fill.fields.length} veld(en) → ${fn} gedownload.`;
      } catch (e) {
        this.fill.error = e.message || String(e);
      } finally {
        this.fill.busy = false;
      }
    },
  };
}

window.pdfHorseApp = pdfHorseApp;
