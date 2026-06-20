#!/usr/bin/env node
/*!
 * Node-test voor PDFHorse v0.25.0-Shamir identity-binding roundtrip.
 *
 * Werkt op twee manieren (precedent: scripts/test_poa_v2.js):
 *   1. Als `openpgp` als npm-module beschikbaar is — volledige runtime,
 *      generate→sign→verify roundtrip + tamper + canonical-determinisme.
 *   2. Als openpgp NIET beschikbaar — fallback regex-only structuur check
 *      op frontend/js/identity.js + skip-melding. Exit-code 0.
 *
 * Run: `node scripts/test_identity_roundtrip.js`
 * Exit-code: 0 = OK, 1 = mismatch / structuurprobleem.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const IDENTITY_JS = path.join(REPO_ROOT, 'frontend', 'js', 'identity.js');
const src = fs.readFileSync(IDENTITY_JS, 'utf-8');

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

console.log('PDFHorse v0.25.0-Shamir — identity-binding roundtrip');
console.log('');

// ---- Laag 1: structuur-tests die geen openpgp runtime nodig hebben ---------
console.log('Structuur (regex-only):');
t('identity.js exposeert window.PDFHorseIdentity', () => {
  assertTrue(/window\.PDFHorseIdentity\s*=\s*\{/.test(src), 'window.PDFHorseIdentity ontbreekt');
});
t('5 publieke methodes aanwezig', () => {
  ['generateKey', 'importKey', 'canonicalize', 'signEnvelope', 'verifyEnvelope'].forEach(function (n) {
    assertTrue(new RegExp('\\b(async\\s+)?function\\s+' + n + '\\s*\\(').test(src), 'mist ' + n);
  });
});
t('Ed25519 curve', () => {
  assertTrue(/curve\s*:\s*['"]ed25519['"]/.test(src), 'curve=ed25519 ontbreekt');
});
t('canonicalize sorteert keys + strippt signature', () => {
  const m = src.match(/function\s+canonicalize\b[\s\S]+?\n  \}\n/);
  assertTrue(m, 'canonicalize-body niet gevonden');
  assertTrue(/['"]signature['"]/.test(m[0]), 'signature-strip ontbreekt');
  assertTrue(/sort\s*\(/.test(m[0]), 'sort() ontbreekt');
});
t('geen localStorage / sessionStorage misbruik (comments uitgezonderd)', () => {
  // Strip block + line comments; alleen ECHTE references mogen niet voorkomen.
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assertTrue(!/localStorage|sessionStorage/.test(stripped), 'storage-API misbruik gevonden');
});

// ---- Laag 2: runtime test als openpgp beschikbaar is ----------------------
let openpgp = null;
try {
  openpgp = require('openpgp');
} catch (e) {
  // niet beschikbaar
}

(async () => {
  if (!openpgp) {
    console.log('');
    console.log('openpgp niet beschikbaar als npm-module — runtime roundtrip overgeslagen.');
    console.log('(Dit is OK: CDN-only project, geen package.json. Structuur-tests dekken het API-contract.)');
    console.log('');
    console.log('Resultaat: ' + pass + ' ok, ' + fail + ' fail (runtime: SKIP)');
    process.exit(fail === 0 ? 0 : 1);
    return;
  }

  console.log('');
  console.log('Runtime (openpgp aanwezig):');

  // Eval bron in shim-context met window-globals.
  const shimWindow = {
    openpgp: openpgp,
    crypto: {
      getRandomValues: (buf) => {
        const c = require('crypto');
        const r = c.randomBytes(buf.length);
        for (let i = 0; i < buf.length; i++) buf[i] = r[i];
        return buf;
      },
    },
  };
  // Maak globals zichtbaar voor IIFE die `window.openpgp` aanspreekt.
  // eslint-disable-next-line no-eval
  (function (window) { eval(src); }).call(shimWindow, shimWindow);
  const Id = shimWindow.PDFHorseIdentity;
  assertTrue(Id, 'PDFHorseIdentity niet geladen na eval');

  // Mock envelope.
  const mkMeta = () => ({
    poa_schema: 'poa-v3',
    file: { sha256: 'a'.repeat(64) },
    conceptual: { sha256: 'c'.repeat(64) },
    perceptual: ['1234', 'abcd'],
    ts: '2026-06-20T14:00:00Z',
    owner: { name: 'Test User', email: 'test@example.com', statement: 'first owner' },
    source: { filename: 'doc.pdf', bytes: 1000 },
  });

  let keypair = null;
  await t('1. generateKey (Ed25519) — fingerprint + armored output', async () => {
    keypair = await Id.generateKey({ name: 'Test', email: 'test@example.com', passphrase: 'testpass123' });
    assertTrue(keypair.privateKeyArmored.includes('PRIVATE KEY BLOCK'), 'private armored ontbreekt');
    assertTrue(keypair.publicKeyArmored.includes('PUBLIC KEY BLOCK'), 'public armored ontbreekt');
    assertTrue(keypair.fingerprint.length >= 40, 'fingerprint te kort');
    console.log('       fp=' + keypair.fingerprint);
  });

  let signedMeta = null;
  await t('2. signEnvelope → valid signature', async () => {
    const meta = mkMeta();
    const sig = await Id.signEnvelope(meta, keypair.privateKeyArmored, 'testpass123');
    assertTrue(sig.sig_armored.includes('SIGNATURE'), 'sig_armored ontbreekt');
    assertEq(sig.fingerprint, keypair.fingerprint, 'sig fingerprint mismatch');
    assertEq(sig.algo, 'openpgp-ed25519', 'algo-veld onjuist');
    signedMeta = Object.assign({}, meta, { signature: sig });
  });

  await t('3. verifyEnvelope(signed) → valid=true', async () => {
    const v = await Id.verifyEnvelope(signedMeta);
    assertEq(v.valid, true, 'verify niet geldig');
    assertEq(v.fingerprint, keypair.fingerprint, 'fingerprint mismatch');
  });

  await t('4. tamper meta.file.sha256 → valid=false', async () => {
    const tampered = JSON.parse(JSON.stringify(signedMeta));
    tampered.file.sha256 = 'd'.repeat(64);
    const v = await Id.verifyEnvelope(tampered);
    assertEq(v.valid, false, 'tampered verify zou false moeten zijn');
  });

  await t('5. vervang public_key_armored → valid=false', async () => {
    const k2 = await Id.generateKey({ name: 'Other', email: 'other@example.com', passphrase: 'otherpass123' });
    const swapped = JSON.parse(JSON.stringify(signedMeta));
    swapped.signature.public_key_armored = k2.publicKeyArmored;
    const v = await Id.verifyEnvelope(swapped);
    assertEq(v.valid, false, 'vervangen pubkey zou false moeten zijn');
  });

  await t('6. canonicalize deterministisch (twee calls = identieke bytes)', () => {
    const m = mkMeta();
    const a = Id.canonicalize(m);
    const b = Id.canonicalize(m);
    assertEq(a.length, b.length, 'canonical lengtes verschillen');
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) throw new Error('canonical byte mismatch op index ' + i);
    }
  });

  console.log('');
  console.log('Resultaat: ' + pass + ' ok, ' + fail + ' fail');
  process.exit(fail === 0 ? 0 : 1);
})();
