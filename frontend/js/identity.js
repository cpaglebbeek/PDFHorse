/*!
 * PDFHorse — Identity binding via OpenPGP (window.PDFHorseIdentity)
 *
 * v0.25.0-Shamir: detached OpenPGP-signature over canonical envelope-JSON,
 * met publieke sleutel embedded in de envelope. Curve25519/Ed25519
 * (sneller dan RSA, kleinere keys + sigs).
 *
 * Security:
 *  - Passphrase + private key alleen in memory; nooit naar localStorage,
 *    nooit naar payload-envelope.
 *  - Alleen public key + detached sig + fingerprint komen in de envelope.
 *  - canonicalize() is pure functie: sorted-keys JSON-serialisatie zonder
 *    het signature-veld, UTF-8 bytes → reproduceerbaar op verifier-zijde.
 *
 * Afhankelijkheid: window.openpgp (CDN openpgp@5.11.2, SRI-pinned in index.html).
 */
(function () {
  'use strict';

  function _openpgp() {
    if (typeof window.openpgp === 'undefined') {
      throw new Error('OpenPGP.js niet geladen (window.openpgp ontbreekt).');
    }
    return window.openpgp;
  }

  // ----- canonicalize ----------------------------------------------------
  // Pure functie. Sorted-keys recursive serialisatie van envelope-meta
  // EXCLUSIEF het `signature`-veld. Output = Uint8Array (UTF-8 bytes).
  // RFC8785-light: we doen geen number-normalisatie maar:
  //   - sorted keys op elk object-niveau
  //   - arrays behouden volgorde (significant in pHash-lijsten)
  //   - signature-key wordt op top-niveau weggesneden
  //   - JSON.stringify zonder spaces → deterministische output
  // Twee calls met identieke input geven identieke bytes.
  function canonicalize(envelopeMeta) {
    function strip(obj) {
      // Top-niveau alleen: signature eruit
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        var copy = {};
        Object.keys(obj).forEach(function (k) {
          if (k !== 'signature') copy[k] = obj[k];
        });
        return copy;
      }
      return obj;
    }
    function replacer(key, value) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        var sorted = {};
        Object.keys(value).sort().forEach(function (k) {
          sorted[k] = value[k];
        });
        return sorted;
      }
      return value;
    }
    var safe = strip(envelopeMeta);
    var json = JSON.stringify(safe, replacer);
    return new TextEncoder().encode(json);
  }

  // ----- generateKey -----------------------------------------------------
  // Ed25519 / Curve25519 keypair. Sneller dan RSA, kleinere armor (~600 chars
  // ipv 3k+). Userid = "name <email>".
  async function generateKey(opts) {
    var openpgp = _openpgp();
    opts = opts || {};
    if (!opts.passphrase || String(opts.passphrase).length < 8) {
      throw new Error('Passphrase minimaal 8 tekens vereist.');
    }
    var userId = {
      name: String(opts.name || 'PDFHorse PoA user'),
      email: String(opts.email || 'noreply@example.invalid'),
    };
    // OpenPGP.js 5.x: curve='ed25519' geeft Ed25519 sign + Curve25519 encrypt subkey.
    var keyOpts = {
      type: 'ecc',
      curve: 'ed25519',
      userIDs: [userId],
      passphrase: opts.passphrase,
      format: 'armored',
    };
    var result = await openpgp.generateKey(keyOpts);
    // OpenPGP.js 5.x returneert { privateKey: armored, publicKey: armored, revocationCertificate }
    var privArm = result.privateKey;
    var pubArm = result.publicKey;
    // Fingerprint via read
    var pubObj = await openpgp.readKey({ armoredKey: pubArm });
    var fp = pubObj.getFingerprint().toUpperCase();
    return {
      privateKeyArmored: privArm,
      publicKeyArmored: pubArm,
      fingerprint: fp,
    };
  }

  // ----- importKey -------------------------------------------------------
  // Parse ASCII-armored private key + (optioneel) decrypt met passphrase.
  // Returnt refs + fingerprint + public armored.
  async function importKey(asciiArmored, passphrase) {
    var openpgp = _openpgp();
    if (!asciiArmored) throw new Error('Geen private key meegegeven.');
    var privObj;
    try {
      privObj = await openpgp.readPrivateKey({ armoredKey: asciiArmored });
    } catch (e) {
      throw new Error('Kon private key niet parsen: ' + (e && e.message || e));
    }
    if (privObj.isDecrypted && privObj.isDecrypted()) {
      // ongeëncrypteerde sleutel — toegestaan maar warning niet hier
    } else {
      if (!passphrase) throw new Error('Passphrase vereist voor versleutelde private key.');
      try {
        privObj = await openpgp.decryptKey({ privateKey: privObj, passphrase: passphrase });
      } catch (e) {
        throw new Error('Passphrase onjuist of decrypt-fout: ' + (e && e.message || e));
      }
    }
    var pubObj = privObj.toPublic();
    var pubArm = pubObj.armor();
    var fp = pubObj.getFingerprint().toUpperCase();
    return {
      privateKey: privObj,
      publicKeyArmored: pubArm,
      fingerprint: fp,
    };
  }

  // ----- signEnvelope ----------------------------------------------------
  // Detached signature over canonicalize(envelopeMeta).
  // Returnt structuur die in envelopeMeta.signature gestoken wordt.
  async function signEnvelope(envelopeMeta, privateKey, passphrase) {
    var openpgp = _openpgp();
    var pk = privateKey;
    // Als pk een armored string is → parse + (optioneel) decrypt
    if (typeof pk === 'string') {
      pk = await openpgp.readPrivateKey({ armoredKey: pk });
    }
    if (pk.isDecrypted && !pk.isDecrypted()) {
      if (!passphrase) throw new Error('Passphrase vereist voor signing.');
      pk = await openpgp.decryptKey({ privateKey: pk, passphrase: passphrase });
    }
    var canon = canonicalize(envelopeMeta);
    var msg = await openpgp.createMessage({ binary: canon });
    var sigArm = await openpgp.sign({
      message: msg,
      signingKeys: pk,
      detached: true,
      format: 'armored',
    });
    var pubObj = pk.toPublic();
    return {
      sig_armored: String(sigArm),
      fingerprint: pubObj.getFingerprint().toUpperCase(),
      public_key_armored: pubObj.armor(),
      algo: 'openpgp-ed25519',
      signed_at: new Date().toISOString(),
    };
  }

  // ----- verifyEnvelope --------------------------------------------------
  // Leest envelopeMeta.signature + signature.public_key_armored, herberekent
  // canonical bytes en verifieert detached sig.
  async function verifyEnvelope(envelopeMeta) {
    var openpgp = _openpgp();
    var sig = envelopeMeta && envelopeMeta.signature;
    if (!sig) return { valid: false, error: 'Geen signature-veld in envelope.' };
    if (!sig.sig_armored || !sig.public_key_armored) {
      return { valid: false, error: 'Signature incompleet (mist sig_armored of public_key_armored).' };
    }
    try {
      var pubObj = await openpgp.readKey({ armoredKey: sig.public_key_armored });
      var sigObj = await openpgp.readSignature({ armoredSignature: sig.sig_armored });
      var canon = canonicalize(envelopeMeta);
      var msg = await openpgp.createMessage({ binary: canon });
      var verifyRes = await openpgp.verify({
        message: msg,
        signature: sigObj,
        verificationKeys: pubObj,
      });
      // OpenPGP.js 5.x: verifyRes.signatures = [{ verified: Promise<bool>, keyID, ... }]
      var sigs = verifyRes.signatures || [];
      if (!sigs.length) return { valid: false, error: 'Geen signature-records gevonden.' };
      try {
        await sigs[0].verified;
        // ↑ throwt als ongeldig
        return {
          valid: true,
          fingerprint: pubObj.getFingerprint().toUpperCase(),
          signed_at: sig.signed_at || null,
        };
      } catch (e) {
        return {
          valid: false,
          fingerprint: pubObj.getFingerprint().toUpperCase(),
          signed_at: sig.signed_at || null,
          error: 'Signature ongeldig: ' + (e && e.message || e),
        };
      }
    } catch (e) {
      return { valid: false, error: 'Verify-fout: ' + (e && e.message || e) };
    }
  }

  // ----- formatFingerprint ----------------------------------------------
  // Maakt fingerprint leesbaar: eerste 16 hex chars in groepen van 4.
  function formatFingerprint(fp) {
    if (!fp) return '';
    var clean = String(fp).replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    var short = clean.substr(0, 16);
    return short.match(/.{1,4}/g).join(' ');
  }

  window.PDFHorseIdentity = {
    canonicalize: canonicalize,
    generateKey: generateKey,
    importKey: importKey,
    signEnvelope: signEnvelope,
    verifyEnvelope: verifyEnvelope,
    formatFingerprint: formatFingerprint,
    VERSION: '0.1.0',
  };
})();
