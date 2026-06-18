/*!
 * PDFHorse — payload-engine (window.PDFHorsePayload)
 * Bed een willekeurig bestand als base64-payload in een PDF in (echte PDF
 * embedded-file attachment), optioneel hybride versleuteld:
 *   - AES-GCM (256) versleutelt het bestand met een random sessiesleutel + IV.
 *   - RSA-OAEP (2048) "wrapt" die AES-sleutel met de PUBLIC key van de ontvanger.
 *   - Ontsleutelen kan alleen met de bijbehorende PRIVATE key.
 * Keypair-beheer via WebCrypto, geëxporteerd als JWK (JSON).
 *
 * Vereist: window.PDFLib (pdf-lib) voor attach, window.pdfjsLib (PDF.js) voor extract.
 * WebCrypto (window.crypto.subtle) vereist een secure context (HTTPS).
 */
(function () {
  var ATTACH_NAME = 'pdfhorse-payload.json';
  var subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;

  function u8FromB64(b64) {
    var bin = atob(b64), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function b64FromU8(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function strToU8(s) { return new TextEncoder().encode(s); }
  function u8ToStr(u8) { return new TextDecoder().decode(u8); }
  function needSubtle() { if (!subtle) throw new Error('Versleuteling vereist HTTPS (WebCrypto niet beschikbaar).'); }

  // ---- Keypair (RSA-OAEP 2048, SHA-256) ----
  async function generateKeypair() {
    needSubtle();
    var kp = await subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['encrypt', 'decrypt']
    );
    return {
      publicJwk: await subtle.exportKey('jwk', kp.publicKey),
      privateJwk: await subtle.exportKey('jwk', kp.privateKey),
    };
  }
  function importPublic(jwk) {
    return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  }
  function importPrivate(jwk) {
    return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  }

  // ---- Hybride encrypt/decrypt ----
  async function encrypt(fileBytes, peerPublicJwk) {
    needSubtle();
    var aesKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    var ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, aesKey, fileBytes);
    var rawAes = await subtle.exportKey('raw', aesKey);                  // 32 bytes, past in RSA-2048 OAEP
    var pubKey = await importPublic(peerPublicJwk);
    var wrapped = await subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, rawAes);
    return {
      enc: true,
      alg: 'RSA-OAEP-2048+AES-GCM-256',
      key: b64FromU8(new Uint8Array(wrapped)),
      iv: b64FromU8(iv),
      data: b64FromU8(new Uint8Array(ct)),
    };
  }
  async function decrypt(env, privateJwk) {
    needSubtle();
    var prv = await importPrivate(privateJwk);
    var rawAes = await subtle.decrypt({ name: 'RSA-OAEP' }, prv, u8FromB64(env.key));
    var aesKey = await subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
    var pt = await subtle.decrypt({ name: 'AES-GCM', iv: u8FromB64(env.iv) }, aesKey, u8FromB64(env.data));
    return new Uint8Array(pt);
  }

  // ---- Envelope ----
  function buildPlain(name, fileBytes) {
    return { enc: false, name: name, data: b64FromU8(fileBytes) };
  }
  function buildEncrypted(name, encObj) {
    return Object.assign({ name: name }, encObj);
  }
  // Geef de oorspronkelijke bytes terug uit een envelope (decrypt indien nodig).
  async function open(env, privateJwk) {
    if (env.enc) {
      if (!privateJwk) throw new Error('Payload is versleuteld — laad je private key om te ontsleutelen.');
      return await decrypt(env, privateJwk);
    }
    return u8FromB64(env.data);
  }

  // ---- PDF embed/extract ----
  async function attach(pdfBytes, envelope) {
    var L = window.PDFLib;
    if (!L) throw new Error('pdf-lib niet geladen.');
    var doc = await L.PDFDocument.load(pdfBytes.slice(), { ignoreEncryption: false });
    var json = strToU8(JSON.stringify({ pdfhorse: 'payload-v1', envelope: envelope }));
    await doc.attach(json, ATTACH_NAME, {
      mimeType: 'application/json',
      description: 'PDFHorse payload (' + (envelope.enc ? 'encrypted' : 'plain') + '): ' + (envelope.name || 'bestand'),
      creationDate: new Date(0),
      modificationDate: new Date(0),
    });
    return await doc.save();
  }
  async function extract(pdfBytes) {
    var pdfjs = window.pdfjsLib;
    if (!pdfjs) throw new Error('PDF.js niet geladen.');
    var pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
    var att = await pdf.getAttachments();
    if (!att) throw new Error('Geen bijlagen in deze PDF.');
    var key = att[ATTACH_NAME] ? ATTACH_NAME : Object.keys(att).find(function (k) { return /pdfhorse-payload/.test(k); });
    if (!key) throw new Error('Geen PDFHorse-payload gevonden in deze PDF.');
    var content = att[key].content || att[key];
    var obj = JSON.parse(u8ToStr(content instanceof Uint8Array ? content : new Uint8Array(content)));
    if (!obj || !obj.envelope) throw new Error('Payload-formaat onbekend.');
    return obj.envelope;
  }

  window.PDFHorsePayload = {
    generateKeypair: generateKeypair,
    encrypt: encrypt,
    decrypt: decrypt,
    open: open,
    buildPlain: buildPlain,
    buildEncrypted: buildEncrypted,
    attach: attach,
    extract: extract,
    _b64FromU8: b64FromU8,
    _u8FromB64: u8FromB64,
    VERSION: '0.1.0',
  };
})();
