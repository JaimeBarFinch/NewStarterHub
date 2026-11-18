/* pdf.js - a small PDF writer: embedded fonts, text, lines, the logo and drawn signatures.
   It can write a new PDF, or add a filled-in layer to a prepared PDF (used for the HMRC form). */
(function (g) {
  'use strict';
  var BF = g.BF = g.BF || {};

  function latin1(s) {
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
    return u;
  }
  function num(v) {
    var s = (Math.round(v * 100) / 100).toFixed(2);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }
  function pad10(n) { var s = String(n); while (s.length < 10) s = '0' + s; return s; }
  function hex4(n) { var s = n.toString(16).toUpperCase(); while (s.length < 4) s = '0' + s; return s; }
  function pdfString(s) {
    var out = 'FEFF';
    for (var i = 0; i < s.length; i++) out += hex4(s.charCodeAt(i));
    return '<' + out + '>';
  }

  /* ---------- fonts ---------- */
  function Font(key, d) {
    this.key = key; this.d = d; this.map = {};
    for (var i = 0; i < d.cps.length; i++) this.map[d.cps[i]] = d.gids[i];
    this._file = null; this._tu = null;
  }
  var SWAPS = { 0x2010: 45, 0x2011: 45, 0x2212: 45, 0x00AD: 45, 0x2002: 32, 0x2003: 32, 0x2009: 32, 0x202F: 32, 0x0131: 105 };
  Font.prototype.gid = function (cp) {
    var gd = this.map[cp];
    if (gd !== undefined) return gd;
    if (cp === 9 || cp === 10 || cp === 13) return this.map[32];
    if (SWAPS[cp] !== undefined && this.map[SWAPS[cp]] !== undefined) return this.map[SWAPS[cp]];
    try {
      var base = String.fromCodePoint(cp).normalize('NFD').codePointAt(0);
      if (base !== cp && this.map[base] !== undefined) return this.map[base];
    } catch (e) { /* fall through */ }
    return this.map[63]; // "?"
  };
  /* true when every character can be printed exactly as typed */
  Font.prototype.covers = function (str) {
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (cp > 0xFFFF) i++;
      if (this.map[cp] === undefined && cp !== 9 && cp !== 10 && cp !== 13) return false;
    }
    return true;
  };
  Font.prototype.enc = function (str) {
    var hex = '', w = 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (cp > 0xFFFF) i++;
      var gd = this.gid(cp);
      hex += hex4(gd);
      w += this.d.w[gd];
    }
    return { hex: hex, w: w };
  };
  Font.prototype.width = function (str, size) { return this.enc(str).w * size / 1000; };
  Font.prototype.embed = function (w, id) {
    var d = this.d;
    if (!this._file) { this._file = BF.b64ToBytes(d.file); this._tu = BF.b64ToBytes(d.tu); }
    var fFile = w.alloc(), fDesc = w.alloc(), fCid = w.alloc(), fTu = w.alloc();
    var fTop = id || w.alloc();
    w.stream(fFile, '/Filter /FlateDecode /Length1 ' + d.len1, this._file);
    w.obj(fDesc, '<< /Type /FontDescriptor /FontName /' + d.name + ' /Flags ' + d.flags + ' /FontBBox [' + d.bbox + ']' +
      ' /ItalicAngle ' + num(d.ia) + ' /Ascent ' + d.asc + ' /Descent ' + d.desc + ' /CapHeight ' + d.cap + ' /StemV ' + d.stemv +
      ' /FontFile2 ' + fFile + ' 0 R >>');
    w.obj(fCid, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /' + d.name +
      ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' + fDesc + ' 0 R' +
      ' /DW 500 /W ' + d.W + ' /CIDToGIDMap /Identity >>');
    w.stream(fTu, '/Filter /FlateDecode', this._tu);
    w.obj(fTop, '<< /Type /Font /Subtype /Type0 /BaseFont /' + d.name + ' /Encoding /Identity-H /DescendantFonts [' + fCid + ' 0 R]' +
      ' /ToUnicode ' + fTu + ' 0 R >>');
    return fTop;
  };
  var fontCache = null;
  BF.fonts = function () {
    if (!fontCache) {
      fontCache = {};
      Object.keys(BF.FONTS).forEach(function (k) { fontCache[k] = new Font(k, BF.FONTS[k]); });
    }
    return fontCache;
  };

  /* ---------- low-level file writer ---------- */
  function Writer(base) {
    this.parts = []; this.len = 0; this.offsets = {}; this.base = base || null;
    if (base) {
      this.push(base.bytes);
      if (base.bytes[base.bytes.length - 1] !== 10) this.push('\n');
      this.next = base.size;
    } else {
      this.push('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
      this.next = 1;
    }
  }
  Writer.prototype.push = function (x) {
    var b = typeof x === 'string' ? latin1(x) : x;
    this.parts.push(b); this.len += b.length;
  };
  Writer.prototype.alloc = function () { return this.next++; };
  Writer.prototype.obj = function (id, body) {
    this.offsets[id] = this.len;
    this.push(id + ' 0 obj\n' + body + '\nendobj\n');
    return id;
  };
  Writer.prototype.stream = function (id, dict, data) {
    var b = typeof data === 'string' ? latin1(data) : data;
    this.offsets[id] = this.len;
    this.push(id + ' 0 obj\n<< ' + (dict ? dict + ' ' : '') + '/Length ' + b.length + ' >>\nstream\n');
    this.push(b);
    this.push('\nendstream\nendobj\n');
    return id;
  };
  Writer.prototype.finish = function (rootRef, extra) {
    var xrefPos = this.len, s = 'xref\n', self = this;
    if (!this.base) {
      s += '0 ' + this.next + '\n0000000000 65535 f \n';
      for (var i = 1; i < this.next; i++) {
        if (this.offsets[i] === undefined) throw new Error('PDF object ' + i + ' was never written');
        s += pad10(this.offsets[i]) + ' 00000 n \n';
      }
    } else {
      Object.keys(this.offsets).map(Number).sort(function (a, b) { return a - b; }).forEach(function (id) {
        s += id + ' 1\n' + pad10(self.offsets[id]) + ' 00000 n \n';
      });
    }
    s += 'trailer\n<< /Size ' + this.next + ' /Root ' + rootRef + (extra ? ' ' + extra : '') +
      (this.base ? ' /Prev ' + this.base.startxref : '') + ' >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
    this.push(s);
    var out = new Uint8Array(this.len), pos = 0;
    this.parts.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  };

  /* ---------- drawing surface ----------
     All coordinates are in points measured from the top-left corner of the page. */
  function Canvas(H, names, used) { this.H = H; this.names = names; this.used = used || {}; this.ops = []; }
  function rgb(c) { return num(c[0]) + ' ' + num(c[1]) + ' ' + num(c[2]); }
  var BLACK = [0, 0, 0];
  Canvas.prototype.text = function (str, x, y, font, size, opt) {
    opt = opt || {};
    str = String(str == null ? '' : str);
    if (!str) return 0;
    var e = font.enc(str), w = e.w * size / 1000;
    if (opt.align === 'right') x -= w; else if (opt.align === 'center') x -= w / 2;
    this.used[font.key] = true;
    this.ops.push('BT ' + rgb(opt.color || BLACK) + ' rg /' + this.names[font.key] + ' ' + num(size) + ' Tf ' +
      num(x) + ' ' + num(this.H - y) + ' Td <' + e.hex + '> Tj ET');
    return w;
  };
  /* one line of words spread to fill exactly `width` */
  Canvas.prototype.justified = function (words, x, y, font, size, width, color) {
    if (words.length < 2) return this.text(words.join(' '), x, y, font, size, { color: color });
    var natural = font.width(words.join(' '), size);
    var extra = (width - natural) / (words.length - 1);
    var adj = num(-extra * 1000 / size), sp = hex4(font.gid(32)), arr = '';
    for (var i = 0; i < words.length; i++) {
      arr += '<' + font.enc(words[i]).hex + (i < words.length - 1 ? sp + '> ' + adj + ' ' : '>');
    }
    this.used[font.key] = true;
    this.ops.push('BT ' + rgb(color || BLACK) + ' rg /' + this.names[font.key] + ' ' + num(size) + ' Tf ' +
      num(x) + ' ' + num(this.H - y) + ' Td [' + arr + '] TJ ET');
    return width;
  };
  Canvas.prototype.line = function (x1, y1, x2, y2, lw, color) {
    this.ops.push('q ' + rgb(color || BLACK) + ' RG ' + num(lw || 0.5) + ' w ' + num(x1) + ' ' + num(this.H - y1) + ' m ' +
      num(x2) + ' ' + num(this.H - y2) + ' l S Q');
  };
  Canvas.prototype.rect = function (x, y, w, h, opt) {
    opt = opt || {};
    var s = 'q ';
    if (opt.fill) s += rgb(opt.fill) + ' rg ';
    if (opt.stroke !== null) s += rgb(opt.stroke || BLACK) + ' RG ' + num(opt.lw || 0.5) + ' w ';
    s += num(x) + ' ' + num(this.H - y - h) + ' ' + num(w) + ' ' + num(h) + ' re ';
    s += opt.fill ? (opt.stroke !== null ? 'B' : 'f') : 'S';
    this.ops.push(s + ' Q');
  };
  /* a tick or a cross inside a box whose top-left corner is (x, y) */
  Canvas.prototype.mark = function (x, y, w, h, kind) {
    var H = this.H, s = 'q 0 0 0 RG 1 J 1 j ';
    if (kind === 'x') {
      var ix = w * 0.24, iy = h * 0.24;
      s += '1.3 w ' + num(x + ix) + ' ' + num(H - y - iy) + ' m ' + num(x + w - ix) + ' ' + num(H - y - h + iy) + ' l S ' +
        num(x + w - ix) + ' ' + num(H - y - iy) + ' m ' + num(x + ix) + ' ' + num(H - y - h + iy) + ' l S';
    } else {
      s += '1.2 w ' + num(x + w * 0.18) + ' ' + num(H - y - h * 0.55) + ' m ' + num(x + w * 0.42) + ' ' + num(H - y - h * 0.8) + ' l ' +
        num(x + w * 0.85) + ' ' + num(H - y - h * 0.18) + ' l S';
    }
    this.ops.push(s + ' Q');
  };
  Canvas.prototype.logo = function (x, y, width) {
    var L = BF.LOGO, s = width / L.w;
    this.usesLogo = true;
    this.ops.push('q ' + num(s) + ' 0 0 ' + num(-s) + ' ' + num(x) + ' ' + num(this.H - y) + ' cm /Lg Do Q');
    return width * L.h / L.w;
  };
  /* a drawn signature, scaled to fit inside the box and resting on its bottom-left corner */
  Canvas.prototype.signature = function (sig, x, y, w, h, color) {
    if (!sig || !sig.s) return;
    var sw = w, sh = w / sig.a;
    if (sh > h) { sh = h; sw = h * sig.a; }
    var top = y + h - sh, H = this.H;
    function P(p) { return [x + p[0] * sw, H - (top + p[1] * sh)]; }
    var s = 'q ' + rgb(color || [0.06, 0.09, 0.3]) + ' RG 1 w 1 J 1 j\n';
    sig.s.forEach(function (st) {
      if (!st.length) return;
      var a = P(st[0]);
      s += num(a[0]) + ' ' + num(a[1]) + ' m ';
      if (st.length === 1) { s += num(a[0] + 0.3) + ' ' + num(a[1]) + ' l S\n'; return; }
      var cur = a;
      for (var i = 1; i < st.length - 1; i++) {
        var c = P(st[i]), n = P(st[i + 1]), e = [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2];
        s += num(cur[0] + (c[0] - cur[0]) * 2 / 3) + ' ' + num(cur[1] + (c[1] - cur[1]) * 2 / 3) + ' ' +
          num(e[0] + (c[0] - e[0]) * 2 / 3) + ' ' + num(e[1] + (c[1] - e[1]) * 2 / 3) + ' ' + num(e[0]) + ' ' + num(e[1]) + ' c ';
        cur = e;
      }
      var last = P(st[st.length - 1]);
      s += num(last[0]) + ' ' + num(last[1]) + ' l S\n';
    });
    this.ops.push(s + 'Q');
    return sw;
  };

  /* ---------- a new document ---------- */
  function Doc(opt) {
    opt = opt || {};
    this.W = 595.28; this.H = 841.89;
    this.title = opt.title || ''; this.pages = []; this.used = {};
    this.names = { R: 'R', B: 'B', I: 'I' };
  }
  Doc.prototype.addPage = function () {
    var c = new Canvas(this.H, this.names, this.used);
    this.pages.push(c);
    return c;
  };
  Doc.prototype.build = function () {
    var w = new Writer(), self = this, F = BF.fonts();
    var catalog = w.alloc(), pagesId = w.alloc(), info = w.alloc();
    var fontRes = '';
    Object.keys(this.used).forEach(function (k) { fontRes += '/' + k + ' ' + F[k].embed(w) + ' 0 R '; });
    var kids = [], L = BF.LOGO, logoRes = '';
    if (this.pages.some(function (pg) { return pg.usesLogo; })) {
      var lg = w.alloc();
      w.stream(lg, '/Type /XObject /Subtype /Form /BBox [0 0 ' + num(L.w) + ' ' + num(L.h) + ']',
        L.fill + ' rg\n' + L.paths + '\nf\n' + L.stroke + ' RG 1 w ' + L.frame + ' S\n');
      logoRes = ' /XObject << /Lg ' + lg + ' 0 R >>';
    }
    this.pages.forEach(function (pg) {
      var cid = w.alloc(), pid = w.alloc();
      w.stream(cid, '', pg.ops.join('\n') + '\n');
      w.obj(pid, '<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + num(self.W) + ' ' + num(self.H) + ']' +
        ' /Resources << /Font << ' + fontRes + '>>' + logoRes + ' >> /Contents ' + cid + ' 0 R >>');
      kids.push(pid + ' 0 R');
    });
    w.obj(pagesId, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>');
    w.obj(catalog, '<< /Type /Catalog /Pages ' + pagesId + ' 0 R /Lang (en-GB) >>');
    w.obj(info, '<< /Title ' + pdfString(this.title) + ' /Producer ' + pdfString('Bar Finch new starter forms') + ' >>');
    return w.finish(catalog + ' 0 R', '/Info ' + info + ' 0 R');
  };

  /* ---------- add a filled-in layer to a prepared PDF ----------
     tpl: BF.HMRC. draw(page canvases, fonts) puts the answers on each page. */
  BF.fillTemplate = function (tpl, draw) {
    var F = BF.fonts();
    var names = { R: 'FOV', I: 'FOVI' };
    var canvases = tpl.overlay.map(function () { return new Canvas(tpl.pageH, names, {}); });
    draw(canvases, F);
    var w = new Writer({ bytes: BF.b64ToBytes(tpl.pdf), size: tpl.size, startxref: tpl.startxref });
    F.R.embed(w, tpl.fonts.FOV);
    F.I.embed(w, tpl.fonts.FOVI);
    tpl.overlay.forEach(function (id, i) { w.stream(id, '', canvases[i].ops.join('\n') + '\n'); });
    return w.finish(tpl.root, (tpl.info ? '/Info ' + tpl.info + ' ' : '') + (tpl.id ? '/ID ' + tpl.id : ''));
  };

  BF.Doc = Doc;
  BF.pdfNum = num;
})(typeof globalThis !== 'undefined' ? globalThis : this);
