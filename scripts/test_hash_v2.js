#!/usr/bin/env node
/*!
 * Node-test voor PDFHorse v0.23.0-Diffie pure-functie compareHashesElastic.
 *
 * compareHashesElastic, _hexToBitArray en hammingHex zijn pure functies (geen DOM,
 * geen Canvas, geen PDF.js). We laden hash.js in een geïsoleerde vm-context met een
 * minimal `window`-stub en testen:
 *   1. identieke hex → score = 1.0
 *   2. 1-bit verschil → hamming=1 (na elastische shift)
 *   3. 16x16-grid horizontaal 1-pixel shift → score ≥ 0.95
 *   4. compleet random → score < 0.7
 *   5. Backwards compat: 64-bit avg-hash met maxShift=1 werkt
 *
 * Run: `node scripts/test_hash_v2.js`
 * Exit-code: 0 = alle tests groen, 1 = >=1 faal.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HASH_JS = path.join(__dirname, '..', 'frontend', 'js', 'hash.js');
const src = fs.readFileSync(HASH_JS, 'utf-8');

// Minimal stub: window + window.crypto stub (we hebben subtle niet nodig voor
// compareHashesElastic, maar `var subtle = ...` mag niet throwen).
const ctx = {
  window: { crypto: { subtle: null } },
  document: { createElement: () => ({ getContext: () => null }) },
  setTimeout: setTimeout,
  Promise: Promise,
  TextEncoder: TextEncoder,
  TextDecoder: TextDecoder,
  BigInt: BigInt,
  Math: Math,
  Array: Array,
  Uint8Array: Uint8Array,
  Float64Array: Float64Array,
  Number: Number,
  String: String,
  Object: Object,
  parseInt: parseInt,
  isNaN: isNaN,
  btoa: typeof btoa === 'function' ? btoa : (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: typeof atob === 'function' ? atob : (s) => Buffer.from(s, 'base64').toString('binary'),
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

const PH = ctx.window.PDFHorseHash;
if (!PH) {
  console.error('FAIL: window.PDFHorseHash niet gedefinieerd na load.');
  process.exit(1);
}

let pass = 0, fail = 0;
function t(name, fn) {
  try {
    fn();
    console.log('  ok  ' + name);
    pass++;
  } catch (e) {
    console.log('  FAIL ' + name + ': ' + (e.message || e));
    fail++;
  }
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function assertGte(a, b, msg) {
  if (!(a >= b)) throw new Error((msg || '') + ' expected ' + a + ' >= ' + b);
}
function assertLt(a, b, msg) {
  if (!(a < b)) throw new Error((msg || '') + ' expected ' + a + ' < ' + b);
}

console.log('PDFHorse v0.23.0-Diffie — hash.js node-unit-tests');
console.log('Engine version: ' + PH.VERSION);
console.log('');

console.log('compareHashesElastic — pure-function:');

// 1. Identieke hex → score = 1
t('identieke 256-bit hex geeft score 1.0', () => {
  const h = '0123456789abcdef'.repeat(4); // 64 hex = 256 bit
  const r = PH.compareHashesElastic(h, h, 256, 2);
  assertEq(r.hamming, 0, 'hamming');
  assertEq(r.score, 1, 'score');
});

// 2. 1-bit verschil zonder shift kan elastic-search opheffen of niet, maar hamming ≤ 1
t('1-bit verschil → score ≥ 1 - 1/256', () => {
  const a = '0'.repeat(64);
  const b = '0'.repeat(63) + '1'; // laatste nibble = 0001 → 1 bit set
  const r = PH.compareHashesElastic(a, b, 256, 2);
  // Elastic kan de set-bit naar buiten "schuiven" → hamming kan zelfs 1 worden
  // bij rand-bits. We accepteren hamming ∈ {0, 1}.
  if (!(r.hamming === 0 || r.hamming === 1)) {
    throw new Error('hamming verwacht 0 of 1, kreeg ' + r.hamming);
  }
  assertGte(r.score, 1 - 1 / 256 - 1e-9, 'score');
});

// 3. 16x16-grid: maak een patroon, shift met 1 pixel naar rechts, verifieer
// dat compareHashesElastic met maxShift=2 dit terugvindt → score ≥ 0.95.
t('1-pixel horizontale shift in 16x16 grid → score ≥ 0.95', () => {
  // Maak 16x16 patroon waar elke cel een deterministische bit krijgt
  // (zodat shift detecteerbaar is, geen uniform veld).
  function patternBits(seed) {
    const bits = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      bits[i] = ((seed * (i + 1)) >>> 0) % 7 < 3 ? 1 : 0;
    }
    return bits;
  }
  function bitsToHex(bits) {
    let s = '';
    for (let nib = 0; nib < 64; nib++) {
      let v = 0;
      for (let b = 0; b < 4; b++) if (bits[nib * 4 + b]) v |= (1 << (3 - b));
      s += v.toString(16);
    }
    return s;
  }
  const orig = patternBits(17);
  const hexOrig = bitsToHex(orig);
  // Shift 1 px naar rechts (out-of-range left-column wordt 0).
  const shifted = new Uint8Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const sx = x - 1;
      shifted[y * 16 + x] = sx >= 0 ? orig[y * 16 + sx] : 0;
    }
  }
  const hexShift = bitsToHex(shifted);
  // Zonder shift-compensatie: veel mismatches op de rand.
  // Met elastic (maxShift=2) zou de optimal offsetX=+1 vrijwel alles uitlijnen.
  // De out-of-range-pixels worden 0 → kunnen mismatchen waar orig=1, maar bij
  // seed=17 patroon-dichtheid 3/7 ≈ 43% → ~7-8 bits in de rand-kolom kunnen
  // afwijken. Score moet ≥ 0.95 zijn.
  const r = PH.compareHashesElastic(hexOrig, hexShift, 256, 2);
  assertGte(r.score, 0.95, 'shift-score');
});

// 4. Random hex → score < 0.7 (zelfs elastic kan random niet uitlijnen)
t('random hex → score < 0.75', () => {
  let a = '', b = '';
  // Deterministisch "random" zodat test reproduceerbaar is.
  for (let i = 0; i < 64; i++) {
    a += ((i * 2654435761) >>> 28).toString(16);
    b += ((i * 1597334677) >>> 28).toString(16);
  }
  const r = PH.compareHashesElastic(a, b, 256, 2);
  assertLt(r.score, 0.75, 'random-score (' + r.score + ')');
});

// 5. Backwards compat: 64-bit avg-hash met maxShift=1 werkt op 8x8 grid
t('64-bit (8x8) avg-hash maxShift=1 — identiek geeft score 1', () => {
  const h = 'a5'.repeat(8); // 16 hex = 64 bit
  const r = PH.compareHashesElastic(h, h, 64, 1);
  assertEq(r.hamming, 0, 'hamming');
  assertEq(r.score, 1, 'score');
});

// 6. _hexToBitArray sanity
t('_hexToBitArray decodeert 1 hex char naar 4 bits MSB-first', () => {
  const bits = PH._hexToBitArray('a', 4); // 1010
  assertEq(bits[0], 1, 'bit0');
  assertEq(bits[1], 0, 'bit1');
  assertEq(bits[2], 1, 'bit2');
  assertEq(bits[3], 0, 'bit3');
});

console.log('');
console.log('Resultaat: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
