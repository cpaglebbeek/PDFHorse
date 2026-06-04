// PDFHorse frontend root (Alpine.js root component). v0.1.0-Geschke.
// Merge is volledig client-side via pdf-lib (window.PDFLib).

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
  };
}

window.pdfHorseApp = pdfHorseApp;
