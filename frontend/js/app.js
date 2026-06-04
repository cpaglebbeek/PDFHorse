// PDFHorse frontend root (Alpine.js root component). v0.2.0-Wozencraft.
// Merge en Split zijn volledig client-side via pdf-lib (window.PDFLib).

const MAX_FILE_BYTES    = 50  * 1024 * 1024;
const MAX_SESSION_BYTES = 100 * 1024 * 1024;

function pdfHorseApp() {
  return {
    active: 'merge',
    tabs: [
      { id: 'merge', label: 'Merge' },
      { id: 'split', label: 'Split' },
      { id: 'fill',  label: 'Invullen' },
      { id: 'sign',  label: 'Ondertekenen' },
      { id: 'ocr',   label: 'OCR' },
    ],
    health: { status: '…', version: '…', codename: '…' },
    limits: {},

    merge: {
      files: [],
      dragOver: false,
      busy: false,
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
        const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        if (!isPdf) {
          this.merge.error = `"${f.name}" is geen PDF.`;
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
        });
        total += f.size;
      }
      this.merge.files.push(...accepted);
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
        this.merge.error = 'Minstens 2 PDF\'s nodig om samen te voegen.';
        return;
      }
      if (!window.PDFLib) {
        this.merge.error = 'pdf-lib is niet geladen — controleer je internetverbinding.';
        return;
      }

      this.merge.busy = true;
      this.merge.error = '';
      this.merge.notice = '';

      try {
        const { PDFDocument } = window.PDFLib;
        const merged = await PDFDocument.create();

        for (const f of this.merge.files) {
          const buf = await f.blob.arrayBuffer();
          let src;
          try {
            src = await PDFDocument.load(buf, { ignoreEncryption: false });
          } catch (e) {
            if (String(e).toLowerCase().includes('encrypt')) {
              throw new Error(`"${f.name}" is versleuteld en kan niet worden samengevoegd.`);
            }
            throw new Error(`"${f.name}" is geen geldige PDF.`);
          }
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        }

        const bytes = await merged.save();
        this._downloadBlob(bytes, 'merged.pdf', 'application/pdf');
        this.merge.notice = `Samengevoegd: ${this.merge.files.length} PDF's → merged.pdf gedownload.`;
      } catch (e) {
        this.merge.error = e.message || String(e);
      } finally {
        this.merge.busy = false;
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
          this._downloadBlob(bytes, `${baseName}_${suffix}.pdf`, 'application/pdf');
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
  };
}

window.pdfHorseApp = pdfHorseApp;
