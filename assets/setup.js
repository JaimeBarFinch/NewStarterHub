/* setup.js - the company's page for creating a new starter's link. */
(function () {
  'use strict';
  var BF = window.BF, UI = BF.UI, esc = BF.esc;
  var app = document.getElementById('app');
  var F = BF.fonts();
  var SET_KEY = 'bf-setup-settings', LOG_KEY = 'bf-setup-log', KEY_KEY = 'bf-setup-key';

  function read(key, fallback) { try { var t = localStorage.getItem(key); return t ? JSON.parse(t) : fallback; } catch (e) { return fallback; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var D = { fn: '', sn: '', job: '', start: '', rate: '', type: '', _d: {} };              // this starter's offer
  var C = read(SET_KEY, null) || { name: '', pos: '', sig: '', hr: '', post: '' };          // saved on this device
  var LOG = read(LOG_KEY, []);
  var K = BF.parseSetupKey(read(KEY_KEY, ''));          // the setup key, once entered in this browser
  var keyError = '', fresh = null;                     // fresh = a replacement key pair just created
  var errs = {}, result = null;
  var strokes = null;          // pen strokes drawn in this visit (canvas pixels); null = showing the saved signature

  /* ---------- signature pad ---------- */
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length).fill(false), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = true;
    while (stack.length) {
      var seg = stack.pop(), a = pts[seg[0]], b = pts[seg[1]], far = -1, max = 0;
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      for (var i = seg[0] + 1; i < seg[1]; i++) {
        var d = Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / len;
        if (d > max) { max = d; far = i; }
      }
      if (max > eps && far > 0) { keep[far] = true; stack.push([seg[0], far], [far, seg[1]]); }
    }
    return pts.filter(function (p, i) { return keep[i]; });
  }
  function packStrokes(list) {
    var eps = 0.7, simp;
    do {
      simp = list.map(function (st) { return simplify(st, eps); });
      eps *= 1.5;
    } while (simp.reduce(function (n, st) { return n + st.length; }, 0) > 350 && eps < 12);
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    simp.forEach(function (st) { st.forEach(function (p) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }); });
    if (!isFinite(minx)) return '';
    var w = Math.max(maxx - minx, 8), h = Math.max(maxy - miny, 8);
    if (w / h > 12) { var nh = w / 12; miny -= (nh - h) / 2; h = nh; }
    return BF.packSig({ a: w / h, s: simp.map(function (st) { return st.map(function (p) { return [(p[0] - minx) / w, (p[1] - miny) / h]; }); }) });
  }
  function drawPad() {
    var cv = document.getElementById('pad');
    if (!cv) return;
    var dpr = window.devicePixelRatio || 1, cw = cv.clientWidth, ch = cv.clientHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.strokeStyle = '#c9d2cb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(16, ch * 0.78); ctx.lineTo(cw - 16, ch * 0.78); ctx.stroke();
    ctx.strokeStyle = '#0f174d'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var list = strokes;
    if (!list) {
      var sig = BF.unpackSig(C.sig);
      if (!sig) return;
      var bw = cw * 0.8, bh = bw / sig.a;
      if (bh > ch * 0.7) { bh = ch * 0.7; bw = bh * sig.a; }
      var ox = (cw - bw) / 2, oy = (ch - bh) / 2;
      list = sig.s.map(function (st) { return st.map(function (p) { return [ox + p[0] * bw, oy + p[1] * bh]; }); });
    }
    list.forEach(function (st) {
      if (!st.length) return;
      ctx.beginPath(); ctx.moveTo(st[0][0], st[0][1]);
      if (st.length === 1) ctx.lineTo(st[0][0] + 0.5, st[0][1]);
      for (var i = 1; i < st.length; i++) ctx.lineTo(st[i][0], st[i][1]);
      ctx.stroke();
    });
  }
  function wirePad() {
    var cv = document.getElementById('pad');
    if (!cv) return;
    var cur = null;
    function pt(ev) { var r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    cv.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (!strokes) strokes = [];
      cur = [pt(ev)]; strokes.push(cur);
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
      drawPad();
    });
    cv.addEventListener('pointermove', function (ev) {
      if (!cur) return;
      var p = pt(ev), last = cur[cur.length - 1];
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 1) return;
      cur.push(p); drawPad();
    });
    function end() {
      if (!cur) return;
      cur = null;
      C.sig = packStrokes(strokes); write(SET_KEY, C);
      if (errs['c.sig']) { delete errs['c.sig']; var m = document.getElementById('sig-err'); if (m) m.remove(); }
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  /* ---------- page ---------- */
  function linkBase() { return new URL('index.html', location.href).href.split('#')[0] + '#'; }
  function head() {
    return '<div class="masthead">' + BF.LOGO.svg + '</div><h1 id="top" tabindex="-1">Create a new starter link</h1>';
  }
  function renderGate() {
    var h = head();
    if (!BF.canSign() || !BF.PUBKEY) {
      app.innerHTML = h + '<div class="sheet"><p>This page cannot run in this browser. Open it in an up-to-date version of Chrome, Edge or Safari.</p></div>';
      return;
    }
    app.innerHTML = h + '<p class="lead">This page is for Bar Finch managers.</p><div class="sheet"><h2 style="margin-top:0">Enter your setup key</h2>' +
      '<p>The setup key is the long line beginning BFKEY1 in your SETUP-KEY file. It is kept in this browser, so you only enter it once here.</p>' +
      '<div class="field' + (keyError ? ' bad' : '') + '"><label for="f-key">Setup key</label><textarea id="f-key" autocomplete="off" spellcheck="false"></textarea>' +
      (keyError ? '<span class="err">' + esc(keyError) + '</span>' : '') + '</div>' +
      '<div class="actions"><button type="button" class="btn-primary" data-act="savekey">Save key</button></div></div>';
  }
  function messageFor(offer, link) {
    return 'Hi ' + offer.fn.split(' ')[0] + ', welcome to Bar Finch. Please complete your new starter forms before your first shift using this link:\n\n' + link +
      '\n\nIt takes about ten minutes. Have your National Insurance number, bank details and passport (or share code) to hand.';
  }
  function render() {
    if (!BF.keyMatchesSite(K)) { renderGate(); return; }
    var V = { d: D, c: C };       // field paths are d.* and c.*
    var h = head() +
      '<p class="lead">Fill in the offer, then send the link to your new starter. They complete and sign their forms on their own phone or computer.</p>' +
      UI.errorSummary(errs);

    h += '<div class="sheet"><h2 style="margin-top:0">The offer</h2><div class="grid2">' +
      UI.text(V, errs, 'd.fn', 'First name(s)') + UI.text(V, errs, 'd.sn', 'Surname') +
      UI.text(V, errs, 'd.job', 'Job title', { hint: 'As it should read in “You are employed as …”' }) +
      UI.date(V, errs, 'd.start', 'Start date', { hint: 'For example 26 10 2026' }) +
      UI.text(V, errs, 'd.rate', 'Hourly rate (£)', { cls: 'w-s', hint: 'For example 13.50', attrs: { inputmode: 'decimal' } }) +
      '</div>' + UI.radios(V, errs, 'd.type', 'Employment type on the New Starter Form', [['', 'Leave blank'], ['full', 'Full time'], ['part', 'Part time'], ['temp', 'Temporary']],
        { inline: true, re: false, hint: 'The contract is zero hours, so no weekly hours are set. Tick a box only if you want one ticked on the form.' }) + '</div>';

    h += '<div class="sheet"><h2 style="margin-top:0">Signing for the company</h2><p class="small">Saved in this browser, so you only set it up once. It is added to the contract when you create a link.</p><div class="grid2">' +
      UI.text(V, errs, 'c.name', 'Name of the person signing') + UI.text(V, errs, 'c.pos', 'Their position') + '</div>' +
      '<div class="field' + (errs['c.sig'] ? ' bad' : '') + '" id="f-c-sig"><span class="label">Signature</span><span class="hint">Draw it with a mouse, trackpad or finger.</span>' +
      '<canvas class="pad" id="pad" aria-label="Signature drawing area"></canvas>' +
      (errs['c.sig'] ? '<span class="err" id="sig-err">' + esc(errs['c.sig']) + '</span>' : '') +
      '<div class="actions" style="margin-top:8px"><button type="button" class="btn-plain" data-act="clearsig">Clear signature</button></div></div></div>';

    h += '<div class="sheet"><h2 style="margin-top:0">Where completed forms go</h2><p class="small">Saved in this browser.</p>' +
      UI.text(V, errs, 'c.hr', 'Email address for completed forms', { type: 'email', hint: 'The starter is shown this address and asked to send their forms to it.' }) +
      UI.text(V, errs, 'c.post', 'Automatic delivery address (optional)', { type: 'url', hint: 'Leave empty until you have set up a receiving service. When filled in, each starter’s forms are also sent here automatically. See the README.' }) +
      '</div><div class="actions"><button type="button" class="btn-primary" data-act="create">Create link</button></div>';

    if (result) {
      h += '<div class="sheet" id="result" style="margin-top:20px"><h2 style="margin-top:0">Link for ' + esc(BF.fullName(result.offer)) + '</h2>' +
        '<p>Reference <strong>' + esc(result.ref) + '</strong>. This reference is printed on every document the starter sends back.</p>' +
        '<textarea class="linkbox" id="linkbox" readonly aria-label="Starter link">' + esc(result.link) + '</textarea>' +
        '<div class="actions"><button type="button" class="btn-primary" data-act="copylink">Copy link</button>' +
        '<button type="button" class="btn-plain" data-act="copymsg">Copy a message with the link</button>' +
        '<a class="btn btn-plain" href="' + esc(result.link) + '" target="_blank" rel="noopener">Open it as the starter</a>' +
        '<button type="button" class="btn-plain" data-act="issued">Download the contract as issued</button></div>' +
        '<p class="small" style="margin-top:14px">Anyone who has this link can open it and see the offer, so send it only to ' + esc(result.offer.fn.split(' ')[0]) + '.</p></div>';
    }

    h += '<div class="sheet" style="margin-top:20px"><h2 style="margin-top:0">Links you have created</h2>';
    if (!LOG.length) h += '<p class="small">Nothing yet. Links you create in this browser are listed here so you can copy them again and check returned forms against their reference.</p>';
    else {
      h += '<div class="log-wrap"><table class="log"><thead><tr><th>Created</th><th>Starter</th><th>Role</th><th>Start</th><th>Hourly rate</th><th>Reference</th><th></th></tr></thead><tbody>';
      LOG.forEach(function (r, i) {
        h += '<tr><td>' + esc(BF.dateShort(r.at)) + '</td><td>' + esc(r.fn + ' ' + r.sn) + '</td><td>' + esc(r.job) + '</td><td>' + esc(BF.dateShort(r.start)) +
          '</td><td>£' + esc(BF.money(r.rate)) + '</td><td>' + esc(r.ref) + '</td>' +
          '<td><button type="button" class="btn-link" data-act="logcopy" data-i="' + i + '">Copy link</button> <button type="button" class="btn-link" data-act="logdel" data-i="' + i + '">Remove</button></td></tr>';
      });
      h += '</tbody></table></div><div class="actions"><button type="button" class="btn-plain" data-act="csv">Download this list</button></div>';
    }
    h += '</div>';
    h += '<details class="sheet" style="margin-top:20px"><summary><strong>Replace the setup key</strong></summary>' +
      '<p style="margin-top:12px">Do this if the setup key may have been seen by someone who should not have it. Links created with the old key stop working once the site is updated.</p>';
    if (fresh) {
      h += '<p><strong>1.</strong> Save the new setup key somewhere private:</p><textarea class="linkbox" readonly style="min-height:70px" id="newkey">' + esc(fresh.setupKey) + '</textarea>' +
        '<div class="actions"><button type="button" class="btn-plain" data-act="copykey">Copy new setup key</button></div>' +
        '<p style="margin-top:14px"><strong>2.</strong> Download the new key file and upload it to the <code>assets</code> folder of the site on GitHub, replacing the existing <code>key.js</code>.</p>' +
        '<div class="actions"><button type="button" class="btn-plain" data-act="keyfile">Download key.js</button></div>' +
        '<p style="margin-top:14px"><strong>3.</strong> A couple of minutes after uploading, reload this page and enter the new setup key.</p>';
    } else h += '<div class="actions"><button type="button" class="btn-plain" data-act="newkey">Create a new setup key</button></div>';
    h += '<p class="small" style="margin-top:14px"><button type="button" class="btn-link" data-act="forgetkey">Remove the setup key from this browser</button></p></details>';
    app.innerHTML = h;
    if (fresh) app.querySelector('details').open = true;
    drawPad(); wirePad();
  }

  function validate() {
    var e = {};
    function v(o, k) { return String(o[k] == null ? '' : o[k]).trim(); }
    function need(o, k, path, msg) { if (!v(o, k)) e[path] = msg; else if (!F.R.covers(v(o, k))) e[path] = 'Use Latin letters, numbers and ordinary punctuation only'; }
    need(D, 'fn', 'd.fn', 'Enter the starter’s first name'); need(D, 'sn', 'd.sn', 'Enter the starter’s surname'); need(D, 'job', 'd.job', 'Enter the job title');
    if (!D.start) e['d.start'] = 'Enter the start date using numbers, for example 26 10 2026';
    var rate = parseFloat(v(D, 'rate').replace(/[£,\s]/g, ''));
    if (!(rate > 0 && rate < 1000)) e['d.rate'] = 'Enter the hourly rate in pounds, for example 13.50'; else D.rate = rate.toFixed(2);
    need(C, 'name', 'c.name', 'Enter the name of the person signing for the company'); need(C, 'pos', 'c.pos', 'Enter their position');
    if (!BF.unpackSig(C.sig)) e['c.sig'] = 'Draw the signature';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(C, 'hr'))) e['c.hr'] = 'Enter the email address completed forms should be sent to';
    if (v(C, 'post') && !/^https:\/\/\S+$/.test(v(C, 'post'))) e['c.post'] = 'The automatic delivery address must start with https://';
    return e;
  }
  function create() {
    errs = validate();
    write(SET_KEY, C);
    if (Object.keys(errs).length) {
      result = null; render();
      var box = app.querySelector('.errors');
      if (box) { box.scrollIntoView({ block: 'start' }); var a = box.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
      return;
    }
    var offer = {
      fn: D.fn.trim(), sn: D.sn.trim(), job: D.job.trim(), start: D.start, rate: D.rate, type: D.type || '',
      co: { name: C.name.trim(), pos: C.pos.trim(), sig: C.sig, date: BF.today() }, hr: C.hr.trim()
    };
    if (C.post && C.post.trim()) offer.post = C.post.trim();
    var ref = BF.refCode(offer), payload = BF.encodeOffer(offer);
    BF.signPayload(payload, K).then(function (sig) {
      var link = linkBase() + payload + '.' + sig;
      offer.ref = ref;
      result = { offer: offer, ref: ref, link: link };
      LOG.unshift({ ref: ref, at: BF.nowLocal(), fn: offer.fn, sn: offer.sn, job: offer.job, start: offer.start, rate: offer.rate, type: offer.type, link: link });
      if (!write(LOG_KEY, LOG)) UI.toast('This browser would not save the list. Keep a note of the reference.');
      render();
      var r = document.getElementById('result');
      if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, function () {
      errs = { 'd.fn': 'The link could not be signed with your setup key. Remove the key at the bottom of this page and enter it again.' };
      render();
    });
  }

  app.addEventListener('input', function (ev) { UI.handle(ev, { d: D, c: C }); UI.clearError(errs, ev.target); if (ev.target.getAttribute('data-k') && ev.target.getAttribute('data-k').indexOf('c.') === 0) write(SET_KEY, C); });
  app.addEventListener('change', function (ev) { UI.handle(ev, { d: D, c: C }); });
  app.addEventListener('click', function (ev) {
    var jump = ev.target.closest('[data-jump]');
    if (jump) { ev.preventDefault(); UI.jump(jump.getAttribute('data-jump')); return; }
    var b = ev.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), i = +b.getAttribute('data-i');
    if (act === 'create') create();
    else if (act === 'savekey') {
      var k = BF.parseSetupKey(document.getElementById('f-key').value);
      if (!k) keyError = 'That does not look like a setup key. Paste the whole line beginning BFKEY1.';
      else if (!BF.keyMatchesSite(k)) keyError = 'That key does not belong to this site. If the key was replaced recently, wait a few minutes and reload the page.';
      else { K = k; keyError = ''; if (!write(KEY_KEY, 'BFKEY1.' + k.d + '.' + k.x + '.' + k.y)) UI.toast('This browser will not remember the key'); }
      render();
    }
    else if (act === 'forgetkey') { K = null; fresh = null; try { localStorage.removeItem(KEY_KEY); } catch (e) { /* nothing stored */ } render(); }
    else if (act === 'newkey') BF.newKeyPair().then(function (pair) { fresh = pair; render(); });
    else if (act === 'copykey') UI.copy(fresh.setupKey, 'Setup key copied');
    else if (act === 'keyfile') UI.download('key.js', BF.utf8(BF.keyFile(fresh.pub)), 'text/javascript');
    else if (act === 'clearsig') { strokes = []; C.sig = ''; write(SET_KEY, C); drawPad(); }
    else if (act === 'copylink') UI.copy(result.link, 'Link copied');
    else if (act === 'copymsg') UI.copy(messageFor(result.offer, result.link), 'Message copied');
    else if (act === 'issued') UI.download(BF.fileSlug(result.offer.sn) + '-' + BF.fileSlug(result.offer.fn) + '_Contract-as-issued_' + result.ref + '.pdf', BF.buildContract(result.offer, null));
    else if (act === 'logcopy') UI.copy(LOG[i].link, 'Link copied');
    else if (act === 'logdel') { LOG.splice(i, 1); write(LOG_KEY, LOG); render(); }
    else if (act === 'csv') {
      var rows = [['Created', 'First name(s)', 'Surname', 'Job title', 'Start date', 'Hourly rate', 'Employment type', 'Reference']];
      LOG.forEach(function (r) { rows.push([r.at.replace('T', ' '), r.fn, r.sn, r.job, r.start, r.rate, BF.typeLabel(r.type), r.ref]); });
      var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      UI.download('Bar-Finch-starter-links.csv', BF.utf8('﻿' + csv), 'text/csv');
    }
  });
  window.addEventListener('resize', drawPad);
  render();
})();
