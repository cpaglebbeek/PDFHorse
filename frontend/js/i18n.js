/*!
 * PDFHorse i18n — live overlay-vertaling vanuit i18n.json (SSOT).
 * NL is de default in de HTML; bij ?lang=en (of opgeslagen keuze) wordt de DOM
 * overlay-vertaald: tekstknopen + attributen + dynamische (Alpine) teksten via
 * een MutationObserver, plus regex-sjablonen voor meldingen met variabelen.
 * Eén bron, geen tweede HTML/JS-kopie.
 */
(function () {
  var params = new URLSearchParams(location.search);
  var qlang = params.get('lang');
  if (qlang) { try { localStorage.setItem('pdfh_lang', qlang); } catch (e) {} }
  var lang = qlang || (function () { try { return localStorage.getItem('pdfh_lang'); } catch (e) { return null; } })() || 'nl';
  window.PDFH_LANG = lang;

  // Taal-toggle in de header (altijd, ongeacht taal).
  function injectToggle() {
    var host = document.querySelector('header .max-w-5xl') || document.querySelector('header');
    if (!host || document.getElementById('pdfh-lang-toggle')) return;
    var base = location.pathname + '?';
    var el = document.createElement('span');
    el.id = 'pdfh-lang-toggle';
    el.style.cssText = 'font-size:.75rem;margin-left:12px;white-space:nowrap';
    el.innerHTML =
      '<a href="' + base + 'lang=nl" style="text-decoration:none;opacity:' + (lang === 'en' ? '.6' : '1') + '">NL</a>' +
      ' <span style="opacity:.4">·</span> ' +
      '<a href="' + base + 'lang=en" style="text-decoration:none;opacity:' + (lang === 'en' ? '1' : '.6') + '">EN</a>';
    host.appendChild(el);
  }
  if (document.readyState !== 'loading') injectToggle();
  else document.addEventListener('DOMContentLoaded', injectToggle);

  if (lang !== 'en') return;   // NL = bron, niets te vertalen

  var TEXT = {}, ATTR = {}, TITLE = {}, REGEX = [];
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var observer = null, scheduled = false;

  function translate(root) {
    if (!root) return;
    // tekstknopen
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var raw = node.nodeValue, key = raw.trim();
      if (TEXT[key]) { node.nodeValue = raw.replace(key, TEXT[key]); return; }
      for (var i = 0; i < REGEX.length; i++) {
        if (REGEX[i][0].test(key)) { node.nodeValue = raw.replace(key, key.replace(REGEX[i][0], REGEX[i][1])); return; }
      }
    });
    // attributen
    var els = root.querySelectorAll ? root.querySelectorAll('[' + ATTRS.join('],[') + ']') : [];
    Array.prototype.forEach.call(els, function (el) {
      ATTRS.forEach(function (a) {
        if (el.hasAttribute(a)) { var v = (el.getAttribute(a) || '').trim(); if (ATTR[v]) el.setAttribute(a, ATTR[v]); }
      });
    });
  }

  function retranslate() {
    if (!observer) { translate(document.body); return; }
    observer.disconnect();
    translate(document.body);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function start() {
    document.documentElement.lang = 'en';
    if (TITLE[document.title.trim()]) document.title = TITLE[document.title.trim()];
    translate(document.body);
    observer = new MutationObserver(function () {
      if (scheduled) return; scheduled = true;
      requestAnimationFrame(function () { scheduled = false; retranslate(); });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  fetch('i18n.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    TEXT = j.text || {}; ATTR = j.attr || {}; TITLE = j.title || {};
    REGEX = (j.regex || []).map(function (p) { return [new RegExp(p[0]), p[1]]; });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }).catch(function () { /* i18n niet beschikbaar → NL tonen */ });
})();
