/* util.js - shared helpers (no page-specific code). Works in browsers and in Node for tests. */
(function (g) {
  'use strict';
  var BF = g.BF = g.BF || {};

  /* ---------- bytes and base64 ---------- */
  BF.b64ToBytes = function (b64) {
    if (typeof atob === 'function') {
      var s = atob(b64), u = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return u;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  };
  BF.bytesToB64 = function (u) {
    if (typeof btoa === 'function') {
      var s = '', CH = 0x8000;
      for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
      return btoa(s);
    }
    return Buffer.from(u).toString('base64');
  };
  BF.utf8 = function (s) { return new TextEncoder().encode(s); };
  BF.fromUtf8 = function (u) { return new TextDecoder().decode(u); };
  function b64url(u) { return BF.bytesToB64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return BF.b64ToBytes(s);
  }

  /* ---------- the starter link ----------
     Everything a starter's page needs travels in the part of the link after the "#".
     Browsers never send that part to the web server, so the details are not logged by the host.
     The link is signed with the company's setup key. The starter page checks the signature against
     the public half of that key (assets/key.js) and refuses links that were not made with it, or
     that were changed afterwards. */
  BF.encodeOffer = function (offer) { return 'v1.' + b64url(BF.utf8(JSON.stringify(offer))); };
  BF.parseLink = function (hash) {
    hash = String(hash || '').replace(/^#/, '').trim();
    var bits = hash.split('.');
    if (bits[0] !== 'v1' || !bits[1]) return null;
    try {
      var o = JSON.parse(BF.fromUtf8(unb64url(bits[1])));
      if (!o || typeof o !== 'object' || !o.fn || !o.sn || !o.job || !o.start || !o.rate) return null;
      return { offer: o, payload: 'v1.' + bits[1], sig: bits[2] || '' };
    } catch (e) { return null; }
  };
  BF.decodeOffer = function (hash) { var p = BF.parseLink(hash); return p ? p.offer : null; };

  var ALG = { name: 'ECDSA', namedCurve: 'P-256' }, SIGN = { name: 'ECDSA', hash: 'SHA-256' };
  function subtle() {
    var c = (typeof crypto !== 'undefined' && crypto) || null;
    return c && c.subtle ? c.subtle : null;
  }
  BF.canSign = function () { return !!subtle(); };
  BF.parseSetupKey = function (txt) {
    var m = /BFKEY1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})/.exec(String(txt || ''));
    return m ? { d: m[1], x: m[2], y: m[3] } : null;
  };
  BF.keyMatchesSite = function (k) { return !!(k && BF.PUBKEY && k.x === BF.PUBKEY.x && k.y === BF.PUBKEY.y); };
  BF.signPayload = function (payload, k) {
    return subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', d: k.d, x: k.x, y: k.y, ext: true }, ALG, false, ['sign'])
      .then(function (key) { return subtle().sign(SIGN, key, BF.utf8(payload)); })
      .then(function (sig) { return b64url(new Uint8Array(sig)); });
  };
  BF.verifyPayload = function (payload, sig) {
    if (!subtle() || !BF.PUBKEY || !sig) return Promise.resolve(false);
    return subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', x: BF.PUBKEY.x, y: BF.PUBKEY.y, ext: true }, ALG, false, ['verify'])
      .then(function (key) { return subtle().verify(SIGN, key, unb64url(sig), BF.utf8(payload)); })
      .catch(function () { return false; });
  };
  BF.newKeyPair = function () {
    return subtle().generateKey(ALG, true, ['sign', 'verify'])
      .then(function (pair) { return subtle().exportKey('jwk', pair.privateKey); })
      .then(function (jwk) { return { setupKey: 'BFKEY1.' + jwk.d + '.' + jwk.x + '.' + jwk.y, pub: { x: jwk.x, y: jwk.y } }; });
  };
  BF.keyFile = function (pub) {
    return "/* The public half of the Bar Finch setup key. Starter links are checked against it. */\n" +
      "(function (g) { var BF = g.BF = g.BF || {};\nBF.PUBKEY = " + JSON.stringify(pub) + ";\n" +
      "})(typeof globalThis !== 'undefined' ? globalThis : this);\n";
  };

  /* ---------- reference code ----------
     A short fingerprint of the terms that were issued. It is printed on every document, so a
     returned pack can be matched against the setup page's list of issued links. */
  function cyrb53(str, seed) {
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return [h2 >>> 0, h1 >>> 0];
  }
  BF.refCode = function (o) {
    var co = o.co || {};
    var basis = [o.fn, o.sn, o.job, o.start, o.rate, o.type || '', co.name, co.pos, co.date].join('|');
    if (BF.hasSetHours(o)) basis += '|hours|' + o.hrs;
    var h = cyrb53(basis, 7);
    var A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', out = '';
    for (var p = 0; p < 2; p++) {
      var v = h[p];
      for (var k = 0; k < 4; k++) { out += A[v & 31]; v = v >>> 5; }
    }
    return out.slice(0, 4) + '-' + out.slice(4);
  };

  /* ---------- dates ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function parts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3], hh: m[4], mm: m[5] } : null;
  }
  BF.dateLong = function (iso) { var p = parts(iso); return p ? p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y : ''; };
  BF.dateShort = function (iso) { var p = parts(iso); return p ? pad(p.d) + '/' + pad(p.m) + '/' + p.y : ''; };
  BF.dateDigits = function (iso) { var p = parts(iso); return p ? pad(p.d) + pad(p.m) + p.y : ''; };
  BF.dateTime = function (iso) { var p = parts(iso); return p ? BF.dateShort(iso) + (p.hh ? ' at ' + p.hh + ':' + p.mm : '') : ''; };
  BF.nowLocal = function () {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  BF.today = function () { return BF.nowLocal().slice(0, 10); };
  BF.ageOn = function (dobIso, onIso) {
    var a = parts(dobIso), b = parts(onIso);
    if (!a || !b) return null;
    var age = b.y - a.y;
    if (b.m < a.m || (b.m === a.m && b.d < a.d)) age--;
    return age;
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  BF.money = function (v) {
    var n = parseFloat(String(v).replace(/[£,\s]/g, ''));
    return isFinite(n) ? n.toFixed(2) : String(v);
  };
  /* An offer is either zero hours (the default) or has set weekly hours typed in on the setup page. */
  BF.hasSetHours = function (o) { return !!o && o.ct === 'hours' && !!o.hrs; };
  BF.fullName = function (o) { return (String(o.fn || '').trim() + ' ' + String(o.sn || '').trim()).trim(); };
  BF.typeLabel = function (t) { return { full: 'Full time', part: 'Part time', temp: 'Temporary' }[t] || ''; };

  /* ---------- drawn signature <-> compact text ----------
     A signature is a list of pen strokes. Points are stored as 12-bit x and y (3 bytes per point). */
  BF.packSig = function (sig) {
    if (!sig || !sig.s || !sig.s.length) return '';
    var n = 3;
    sig.s.forEach(function (st) { n += 2 + st.length * 3; });
    var u = new Uint8Array(n), o = 0;
    var asp = Math.max(1, Math.min(65535, Math.round(sig.a * 1000)));
    u[o++] = asp >> 8; u[o++] = asp & 255; u[o++] = sig.s.length;
    sig.s.forEach(function (st) {
      u[o++] = st.length >> 8; u[o++] = st.length & 255;
      st.forEach(function (p) {
        var x = Math.max(0, Math.min(4095, Math.round(p[0] * 4095)));
        var y = Math.max(0, Math.min(4095, Math.round(p[1] * 4095)));
        u[o++] = x >> 4; u[o++] = ((x & 15) << 4) | (y >> 8); u[o++] = y & 255;
      });
    });
    return b64url(u);
  };
  BF.unpackSig = function (txt) {
    if (!txt) return null;
    try {
      var u = unb64url(txt), o = 0;
      var a = ((u[o++] << 8) | u[o++]) / 1000, count = u[o++], s = [];
      for (var i = 0; i < count; i++) {
        var len = (u[o++] << 8) | u[o++], st = [];
        for (var k = 0; k < len; k++) {
          var b0 = u[o++], b1 = u[o++], b2 = u[o++];
          st.push([((b0 << 4) | (b1 >> 4)) / 4095, (((b1 & 15) << 8) | b2) / 4095]);
        }
        s.push(st);
      }
      if (!s.length || !(a > 0)) return null;
      return { a: a, s: s };
    } catch (e) { return null; }
  };

  /* ---------- zip (stored, no compression: PDFs are already compact) ---------- */
  var CRC = null;
  function crc32(u) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRC[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < u.length; i++) crc = CRC[(crc ^ u[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  BF.zip = function (files) {
    var chunks = [], central = [], offset = 0;
    var d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    function header(sig, extra) {
      var b = new Uint8Array(extra), v = new DataView(b.buffer);
      v.setUint32(0, sig, true);
      return { b: b, v: v };
    }
    files.forEach(function (f) {
      var name = BF.utf8(f.name), crc = crc32(f.bytes), len = f.bytes.length;
      var lh = header(0x04034b50, 30);
      lh.v.setUint16(4, 20, true); lh.v.setUint16(6, 0x0800, true); lh.v.setUint16(8, 0, true);
      lh.v.setUint16(10, time, true); lh.v.setUint16(12, date, true);
      lh.v.setUint32(14, crc, true); lh.v.setUint32(18, len, true); lh.v.setUint32(22, len, true);
      lh.v.setUint16(26, name.length, true); lh.v.setUint16(28, 0, true);
      chunks.push(lh.b, name, f.bytes);
      var ch = header(0x02014b50, 46);
      ch.v.setUint16(4, 20, true); ch.v.setUint16(6, 20, true); ch.v.setUint16(8, 0x0800, true); ch.v.setUint16(10, 0, true);
      ch.v.setUint16(12, time, true); ch.v.setUint16(14, date, true);
      ch.v.setUint32(16, crc, true); ch.v.setUint32(20, len, true); ch.v.setUint32(24, len, true);
      ch.v.setUint16(28, name.length, true);
      ch.v.setUint32(42, offset, true);
      central.push(ch.b, name);
      offset += 30 + name.length + len;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = header(0x06054b50, 22);
    end.v.setUint16(8, files.length, true); end.v.setUint16(10, files.length, true);
    end.v.setUint32(12, cdSize, true); end.v.setUint32(16, offset, true);
    var all = chunks.concat(central, [end.b]);
    var total = all.reduce(function (a, b) { return a + b.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  };

  /* ---------- small text helpers ---------- */
  BF.fileSlug = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'starter';
  };
  BF.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
