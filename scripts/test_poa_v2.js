#!/usr/bin/env node
/*!
 * Node snapshot-test voor PDFHorse v0.24.0-Rivest PoA-rapporten.
 *
 * Test of buildClaimV2() en buildMatchReport() PDF-bytes produceren die met
 * %PDF- starten. Werkt op twee manieren:
 *   1. Als `pdf-lib` als npm-module beschikbaar is (require('pdf-lib')) — volledige
 *      runtime, echte pdf-output.
 *   2. Als pdf-lib niet bereikbaar is — fallback regex-only check op de bron, met
 *      duidelijke meldingen. Exit-code 0 in beide gevallen mits structuur klopt.
 *
 * Geen gebruik van canvas/PDF.js/WebCrypto — de rapport-helpers raken die niet aan.
 * Run: `node scripts/test_poa_v2.js`
 * Exit-code: 0 = OK, 1 = mismatch / structuurprobleem.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..');
const POA_JS = path.join(REPO_ROOT, 'frontend', 'js', 'poa-report.js');
const src = fs.readFileSync(POA_JS, 'utf-8');

let pass = 0, fail = 0;
function t(name, fn) {
  try {
    const p = fn();
    if (p && typeof p.then === 'function') {
      return p.then(
        () => { console.log('  ok  ' + name); pass++; },
        (e) => { console.log('  FAIL ' + name + ': ' + (e && e.message || e)); fail++; }
      );
    }
    console.log('  ok  ' + name); pass++;
  } catch (e) {
    console.log('  FAIL ' + name + ': ' + (e && e.message || e)); fail++;
  }
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function assertTrue(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

console.log('PDFHorse v0.24.0-Rivest — poa-report.js node snapshot-tests');
console.log('');

// Eerste laag — structuur-tests die geen pdf-lib runtime nodig hebben.
console.log('Structuur (regex-only):');
t('buildClaimV2 functie aanwezig', () => {
  assertTrue(/function\s+buildClaimV2\s*\(\s*meta\s*\)/.test(src), 'buildClaimV2 ontbreekt');
});
t('buildMatchReport functie aanwezig', () => {
  assertTrue(/function\s+buildMatchReport\s*\(\s*meta\s*,\s*verifyResult\s*,\s*currentFileInfo\s*\)/.test(src),
    'buildMatchReport ontbreekt');
});
t('verdictBox helper aanwezig', () => {
  assertTrue(/verdictBox\s*\(/.test(src), 'verdictBox ontbreekt');
});
t('IDENTICAL kleur groen-dominant (G > R en G > B)', () => {
  const m = src.match(/IDENTICAL\s*:\s*\{\s*fill\s*:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/);
  assertTrue(m, 'IDENTICAL kleur-fill niet gevonden');
  const r = +m[1], g = +m[2], b = +m[3];
  assertTrue(g >= r && g >= b, 'IDENTICAL niet groen-dominant: ' + [r,g,b]);
});
t('NO_MATCH kleur rood-dominant (R > G en R > B)', () => {
  const m = src.match(/NO_MATCH\s*:\s*\{\s*fill\s*:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/);
  assertTrue(m, 'NO_MATCH kleur-fill niet gevonden');
  const r = +m[1], g = +m[2], b = +m[3];
  assertTrue(r > g && r > b, 'NO_MATCH niet rood-dominant: ' + [r,g,b]);
});

// Tweede laag — pdf-lib runtime test.
let pdfLib = null;
try {
  pdfLib = require('pdf-lib');
} catch (e) {
  // ignore
}

(async () => {
  if (!pdfLib) {
    console.log('');
    console.log('pdf-lib niet beschikbaar als npm-module — runtime snapshot overgeslagen.');
    console.log('(Dit is OK: CDN-only project, geen package.json. Structuur-tests dekken het API-contract.)');
    console.log('');
    console.log('Resultaat: ' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail === 0 ? 0 : 1);
    return;
  }

  console.log('');
  console.log('Runtime (pdf-lib aanwezig):');

  // Run de bron-IIFE in dezelfde realm (eval) zodat Array.isArray van pdf-lib
  // de Array's uit poa-report.js herkent. vm.runInContext geeft cross-realm
  // arrays die pdf-lib's validator afwijst ("type NaN"-fout) — een vm-context
  // artefact, niet een bug in de browser-flow.
  // eslint-disable-next-line no-unused-vars
  const window = {
    PDFLib: pdfLib,
    crypto: {
      getRandomValues: (buf) => {
        const c = require('crypto');
        const r = c.randomBytes(buf.length);
        for (let i = 0; i < buf.length; i++) buf[i] = r[i];
        return buf;
      },
    },
  };
  // eslint-disable-next-line no-eval
  eval(src);
  const Poa = window.PDFHorsePoaReport;
  assertTrue(Poa, 'window.PDFHorsePoaReport niet geladen');

  const mockMeta = {
    poa_schema: 'poa-v2',
    file: { sha256: 'a'.repeat(64), sha512: 'b'.repeat(128), bytes: 12345 },
    conceptual: { sha256: 'c'.repeat(64), chars: 1023, pages_with_text: 3 },
    perceptual: ['1234567812345678', 'abcdef1234567890', '0000111122223333'],
    perceptual_dct: ['d'.repeat(64), 'e'.repeat(64), 'f'.repeat(64)],
    perceptual_dhash: ['9'.repeat(64), '8'.repeat(64), '7'.repeat(64)],
    anchor: {
      ots_b64: 'AAAAAAAAQk9CSU5BUllPVFNQRUFLT05MWUNBTEVOREFSRkFLRURBVEFMSU5FU09GUEFE'.repeat(4),
      calendar: 'https://alice.btc.calendar.opentimestamps.org',
      mode: 'live',
      sha256: 'a'.repeat(64),
      ts: '2026-06-20T14:00:00Z',
    },
    ts: '2026-06-20T14:00:00Z',
    owner: { name: 'Christian Glebbeek', email: 'c@example.com', statement: 'Ik claim eerste eigendom van dit document.' },
    source: { filename: 'contract.pdf', bytes: 12345 },
  };

  await t('buildClaimV2(mockMeta) → bytes beginnen met %PDF-', async () => {
    const bytes = await Poa.buildClaimV2(mockMeta);
    assertTrue(bytes && bytes.length > 0, 'geen bytes');
    const head = String.fromCharCode.apply(null, bytes.slice(0, 5));
    assertEq(head, '%PDF-', 'PDF-header');
    console.log('       size=' + bytes.length + ' bytes');
  });

  const mockVerifyIdentical = {
    ok: true, schema: 'poa-v2', score: 1.0, verdict: 'IDENTICAL',
    file: { ok: true, expected: 'a'.repeat(64), actual: 'a'.repeat(64) },
    conceptual: { ok: true, expected: 'c'.repeat(64), actual: 'c'.repeat(64) },
    pages: [
      { page: 1, avg: { expected: '1234567812345678', actual: '1234567812345678', hamming: 0, score: 1.0 },
        dct: { expected: 'd'.repeat(64), actual: 'd'.repeat(64), hamming: 0, score: 1.0 },
        dhash: { expected: '9'.repeat(64), actual: '9'.repeat(64), hamming: 0, score: 1.0 },
        score: 1.0 },
    ],
  };

  await t('buildMatchReport(mockMeta, IDENTICAL) → %PDF-', async () => {
    const bytes = await Poa.buildMatchReport(mockMeta, mockVerifyIdentical, {
      filename: 'contract-resaved.pdf', bytes: 12500, sha256: 'a'.repeat(64),
    });
    assertTrue(bytes && bytes.length > 0, 'geen bytes');
    const head = String.fromCharCode.apply(null, bytes.slice(0, 5));
    assertEq(head, '%PDF-', 'PDF-header');
    console.log('       size=' + bytes.length + ' bytes');
  });

  const mockVerifyNoMatch = {
    ok: false, schema: 'poa-v2', score: 0.34, verdict: 'NO_MATCH',
    file: { ok: false, expected: 'a'.repeat(64), actual: 'z'.repeat(64) },
    conceptual: { ok: false, expected: 'c'.repeat(64), actual: 'y'.repeat(64) },
    pages: [
      { page: 1, avg: { expected: '1234567812345678', actual: '0000000000000000', hamming: 30, score: 0.40 },
        dct: { expected: 'd'.repeat(64), actual: '0'.repeat(64), hamming: 200, score: 0.22 },
        dhash: { expected: '9'.repeat(64), actual: '0'.repeat(64), hamming: 180, score: 0.30 },
        score: 0.40 },
    ],
  };

  await t('buildMatchReport(mockMeta, NO_MATCH) → %PDF-', async () => {
    const bytes = await Poa.buildMatchReport(mockMeta, mockVerifyNoMatch, {
      filename: 'andere.pdf', bytes: 5000, sha256: 'z'.repeat(64),
    });
    assertTrue(bytes && bytes.length > 0, 'geen bytes');
    const head = String.fromCharCode.apply(null, bytes.slice(0, 5));
    assertEq(head, '%PDF-', 'PDF-header');
    console.log('       size=' + bytes.length + ' bytes');
  });

  console.log('');
  console.log('Resultaat: ' + pass + ' ok, ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
})();
