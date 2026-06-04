// PDFHorse frontend root (Alpine.js root component). v0.0.2 skeleton.

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
      // Relatief — werkt onder /PDFHorse/ achter nginx + onder localhost direct.
      const base = (window.PDFHORSE_API_BASE || '').replace(/\/$/, '');
      return base + p;
    },
  };
}

window.pdfHorseApp = pdfHorseApp;
