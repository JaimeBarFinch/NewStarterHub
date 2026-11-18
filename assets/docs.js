/* docs.js - lays out the five documents as PDFs, following the original Bar Finch forms.
   o = the offer details set up by the company (name, role, pay, company signature)
   s = what the new starter entered (may be null to produce a document "as issued") */
(function (g) {
  'use strict';
  var BF = g.BF = g.BF || {};

  var M = { L: 72, R: 523.28, TOP: 152, BOTTOM: 770, W: 595.28 };
  var IND1 = 35.45, IND2 = 70.9, SIZE = 11, LEAD = 14.4;
  var GREY = [0.36, 0.36, 0.36], INK = [0.06, 0.09, 0.3];
  var CO = {
    name: 'Rabbit’s Foot Restaurants Ltd',
    addr: '31 Cork Street, London W1S 3NQ',
    phones: 'Office: +44 207 062 7880   Restaurant: +44 203 848 8808',
    reg: 'Registered No: 15700902   Registered Office: 47/48 Piccadilly, London, W1J 0DT'
  };

  function base(y, size, lead) { return y + (lead - size) / 2 + size * 0.8; }

  function wrap(text, font, size, width) {
    var words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    var lines = [], cur = [], curW = 0, sp = font.width(' ', size);
    words.forEach(function (wd) {
      var ww = font.width(wd, size);
      if (ww > width) {                       // a single word wider than the column: break it
        if (cur.length) { lines.push(cur); cur = []; curW = 0; }
        var piece = '';
        Array.from(wd).forEach(function (ch) {
          if (piece && font.width(piece + ch, size) > width) { lines.push([piece]); piece = ''; }
          piece += ch;
        });
        cur = [piece]; curW = font.width(piece, size);
        return;
      }
      if (cur.length && curW + sp + ww > width) { lines.push(cur); cur = [wd]; curW = ww; }
      else { curW += (cur.length ? sp : 0) + ww; cur.push(wd); }
    });
    if (cur.length) lines.push(cur);
    return lines;
  }

  /* shrink text to fit a width; if it is still too long at the smallest size, trim it */
  function fit(str, font, size, width, min) {
    str = String(str == null ? '' : str);
    while (size > min && font.width(str, size) > width) size -= 0.5;
    if (font.width(str, size) > width) {
      var chars = Array.from(str);
      while (chars.length > 1 && font.width(chars.join('') + '…', size) > width) chars.pop();
      str = chars.join('') + '…';
    }
    return { str: str, size: size };
  }

  function fill(t, vars) {
    return t.replace(/\{\{(\w+)\}\}/g, function (m, k) {
      if (vars[k] === undefined) throw new Error('Missing value for ' + k);
      return vars[k];
    });
  }

  /* ---------- page flow with the Bar Finch letterhead ---------- */
  function Flow(title, ref) {
    this.doc = new BF.Doc({ title: title });
    this.F = BF.fonts();
    this.ref = ref || '';
    this.newPage();
  }
  Flow.prototype.newPage = function () {
    this.pg = this.doc.addPage();
    this.pg.logo((M.W - 138) / 2, 49, 138);
    this.y = M.TOP;
    this.fresh = true;
  };
  Flow.prototype.need = function (h) { if (this.y + h > M.BOTTOM) this.newPage(); };
  Flow.prototype.gap = function (h) { if (!this.fresh) this.y += h; };
  Flow.prototype.title = function (t, sub) {
    this.pg.text(t, M.L, base(this.y, 14, 18), this.F.B, 14);
    this.y += 18;
    if (sub) { this.y += 3; this.pg.text(sub, M.L, base(this.y, 14, 18), this.F.B, 14); this.y += 18; }
    this.y += 10; this.fresh = false;
  };
  Flow.prototype.para = function (text, o) {
    o = o || {};
    var f = o.font || this.F.R, size = o.size || SIZE, lead = o.lead || LEAD;
    var x = o.x === undefined ? M.L : o.x, w = o.w || (M.R - x);
    var lines = wrap(text, f, size, w);
    if (o.keep !== false) this.need(lines.length * lead);
    for (var i = 0; i < lines.length; i++) {
      if (o.keep === false) this.need(lead);
      var by = base(this.y, size, lead);
      if (o.align === 'justify' && i < lines.length - 1) this.pg.justified(lines[i], x, by, f, size, w, o.color);
      else this.pg.text(lines[i].join(' '), x, by, f, size, { color: o.color });
      this.y += lead;
    }
    this.y += o.after === undefined ? 6 : o.after;
    this.fresh = false;
  };
  Flow.prototype.heading = function (n, text, nextH) {
    this.need(LEAD + 10 + (nextH || LEAD));
    this.gap(7);
    var by = base(this.y, SIZE, LEAD);
    this.pg.text(n + '.', M.L, by, this.F.B, SIZE);
    this.pg.text(text, M.L + IND1, by, this.F.B, SIZE);
    this.y += LEAD + 5; this.fresh = false;
  };
  Flow.prototype.itemHeight = function (text, level) {
    var x = M.L + (level === 2 ? IND2 : IND1);
    return wrap(text, this.F.R, SIZE, M.R - x).length * LEAD + 6;
  };
  Flow.prototype.item = function (label, text, level) {
    var x = M.L + (level === 2 ? IND2 : IND1), lx = M.L + (level === 2 ? IND1 : 0);
    this.need(this.itemHeight(text, level) - 6);
    this.pg.text(label, lx, base(this.y, SIZE, LEAD), this.F.R, SIZE);
    this.para(text, { x: x, align: 'justify', keep: false });
  };
  Flow.prototype.clauses = function (list, vars) {
    var self = this;
    list.forEach(function (cl, ci) {
      var n = ci + 1;
      var first = cl.items.length ? fill(cl.items[0].t, vars) : '';
      self.heading(n, cl.h, self.itemHeight(first, 1));
      cl.items.forEach(function (it, ii) {
        self.item(n + '.' + (ii + 1), fill(it.t, vars), 1);
        it.sub.forEach(function (st, si) { self.item('(' + String.fromCharCode(97 + si) + ')', fill(st, vars), 2); });
      });
    });
  };
  /* "Signed (...): ________  Date: ________" with a typed or drawn signature on the line */
  Flow.prototype.signRow = function (label, sig, date, o) {
    o = o || {};
    var F = this.F, pg, x = o.x || M.L, H = 50;
    this.need(H);
    pg = this.pg;
    var ly = this.y + 32;
    var lw = F.R.width(label, SIZE);
    pg.text(label, x, ly, F.R, SIZE);
    var sx = x + lw + 4, sigW = o.sigW || 150;
    if (sig && sig.typed) sigW = Math.min(Math.max(sigW, F.I.width(sig.typed, 12) + 12), M.R - sx - 112);
    var sEnd = sx + sigW;
    pg.line(sx, ly + 1.5, sEnd, ly + 1.5, 0.5);
    var dx = sEnd + 10;
    pg.text('Date:', dx, ly, F.R, SIZE);
    var dlx = dx + F.R.width('Date:', SIZE) + 4;
    pg.line(dlx, ly + 1.5, M.R, ly + 1.5, 0.5);
    if (date) pg.text(date, dlx + 5, ly - 1.5, F.R, SIZE);
    if (sig && sig.typed) {
      var ft = fit(sig.typed, F.I, 14, sEnd - sx - 8, 6);
      pg.text(ft.str, sx + 4, ly - 2, F.I, ft.size, { color: INK });
      if (sig.note) pg.text(sig.note, sx, ly + 10.5, F.R, 6.5, { color: GREY });
    } else if (sig && sig.strokes) {
      pg.signature(sig.strokes, sx + 4, ly - 31, sEnd - sx - 8, 32, INK);
      if (sig.name) pg.text(sig.name, sx, ly + 10.5, F.R, 7.5, { color: GREY });
    }
    this.y += H; this.fresh = false;
  };
  /* "Label: ________" with an optional value on the line */
  Flow.prototype.fieldRow = function (label, value, o) {
    o = o || {};
    var F = this.F, x = o.x || M.L, H = o.h || 24;
    this.need(H);
    var ly = this.y + H - 8, lw = F.R.width(label, SIZE);
    this.pg.text(label, x, ly, F.R, SIZE);
    var sx = x + lw + 4, sEnd = o.end || (sx + 190);
    this.pg.line(sx, ly + 1.5, sEnd, ly + 1.5, 0.5);
    if (value) {
      var f = o.italic ? F.I : F.R;
      var ft = fit(value, f, o.italic ? 13 : SIZE, sEnd - sx - 8, 6);
      this.pg.text(ft.str, sx + 4, ly - 1.5, f, ft.size, { color: o.italic ? INK : undefined });
    }
    if (o.below) this.pg.text(o.below, sx, ly + 10.5, F.R, 6.5, { color: GREY });
    this.y += H; this.fresh = false;
  };

  /* ---------- tables (for the New Starter Form) ---------- */
  var CELL = { padX: 5.5, padY: 5, size: 11, lead: 13.6, minH: 23.5 };
  function layoutCell(cell, F) {
    var w = cell.w - 2 * CELL.padX, items = [], h = 0;
    (cell.blocks || []).forEach(function (b) {
      if (b.segs) { items.push({ segs: b.segs, y: h }); h += CELL.lead; }
      else if (b.gap) { h += b.gap; }
      else {
        var f = F[b.f || 'R'];
        var lines = wrap(b.t, f, CELL.size, w);
        lines.forEach(function (l) { items.push({ line: l.join(' '), f: f, y: h }); h += CELL.lead; });
      }
    });
    return { h: h + 2 * CELL.padY, items: items };
  }
  function drawSegs(pg, segs, x, by, F) {
    segs.forEach(function (sg) {
      if (sg.cb !== undefined) {
        pg.rect(x, by - 8, 8.5, 8.5, { lw: 0.6 });
        if (sg.cb) pg.mark(x, by - 8, 8.5, 8.5, 'tick');
        x += 8.5 + 4;
      } else if (sg.gap) { x += sg.gap; }
      else { x += pg.text(sg.t, x, by, F[sg.f || 'R'], CELL.size); }
    });
  }
  Flow.prototype.table = function (rows) {
    var self = this, F = this.F;
    rows.forEach(function (row) {
      var lay = row.map(function (c) { return layoutCell(c, F); });
      var h = Math.max(CELL.minH, Math.max.apply(null, lay.map(function (l) { return l.h; })));
      self.need(h);
      var x = M.L;
      row.forEach(function (c, i) {
        self.pg.rect(x, self.y, c.w, h, { lw: 0.5 });
        var inner = lay[i].h - 2 * CELL.padY;
        var oy = (h - inner) / 2;
        lay[i].items.forEach(function (it) {
          var by = self.y + oy + it.y + base(0, CELL.size, CELL.lead);
          if (it.line !== undefined) self.pg.text(it.line, x + CELL.padX, by, it.f, CELL.size);
          else drawSegs(self.pg, it.segs, x + CELL.padX, by, F);
        });
        x += c.w;
      });
      self.y += h;
    });
    this.y += 4; this.fresh = false;
  };
  Flow.prototype.finish = function () {
    var F = this.F, n = this.doc.pages.length, ref = this.ref, mid = M.W / 2;
    this.doc.pages.forEach(function (pg, i) {
      pg.text('Page ' + (i + 1) + ' of ' + n, M.R, 792, F.R, 8, { align: 'right' });
      if (ref) pg.text('Ref ' + ref, M.L, 792, F.R, 7, { color: GREY });
      pg.text(CO.name, mid, 804, F.B, 9, { align: 'center' });
      pg.text(CO.addr, mid, 813, F.R, 7.5, { align: 'center' });
      pg.text(CO.phones, mid, 821, F.R, 7.5, { align: 'center' });
      pg.text(CO.reg, mid, 829, F.R, 7.5, { align: 'center' });
    });
    return this.doc.build();
  };

  function typedSig(sg) {
    if (!sg || !sg.name) return null;
    return { typed: sg.name, note: 'Signed electronically by typing this name on ' + BF.dateTime(sg.at) };
  }
  function addressLine(s) {
    return [s.a1, s.a2, s.town, s.pc, s.country].map(function (v) { return String(v || '').trim(); }).filter(Boolean).join(', ');
  }
  BF.addressLine = addressLine;

  /* ---------- 1. Statement of terms and conditions of employment ---------- */
  BF.contractVars = function (o) {
    var v = { name: BF.fullName(o), job: o.job, start: BF.dateLong(o.start), rate: BF.money(o.rate) };
    if (BF.hasSetHours(o)) v.hours = String(o.hrs);
    return v;
  };
  /* which statement of terms an offer uses */
  BF.contractFor = function (o) { return BF.hasSetHours(o) ? BF.CONTRACT_HOURS : BF.CONTRACT; };
  BF.buildContract = function (o, s) {
    var T = BF.contractFor(o), vars = BF.contractVars(o), fl = new Flow('Statement of terms and conditions of employment', o.ref);
    fl.title(T.title, T.subtitle);
    fl.para(fill(T.intro, vars), { align: 'justify', after: 8 });
    fl.clauses(T.clauses, vars);
    fl.need(150);
    var sg = s && s.sig && s.sig.contract;
    fl.signRow('Signed (employee):', typedSig(sg), sg && sg.at ? BF.dateShort(sg.at) : '');
    var co = o.co || {};
    fl.signRow('Signed (for the Company):', co.sig ? { strokes: BF.unpackSig(co.sig), name: co.name } : null, co.date ? BF.dateShort(co.date) : '');
    fl.fieldRow('Position:', co.pos || '');
    return fl.finish();
  };

  /* ---------- 2. New Starter Form ---------- */
  BF.buildStarterForm = function (o, s) {
    var fl = new Flow('New Starter Form', o.ref), W = M.R - M.L;
    var rt = s.rtw || {}, tax = s.tax || {}, ec = s.ec || {}, bk = s.bank || {};
    function lab(t, w) { return { w: w, blocks: [{ t: t, f: 'B' }] }; }
    function val(t, w) { return { w: w, blocks: t ? [{ t: t }] : [] }; }
    function row2(l, v) { return [lab(l, 150), val(v, W - 150)]; }
    function yesNo(v) { return [{ cb: v === true }, { t: 'Yes' }, { gap: 10 }, { cb: v === false }, { t: 'No' }]; }

    fl.title('NEW STARTER FORM');
    fl.para('Please complete in block capitals and return this form to the HR Department before your first shift.', { after: 4 });

    fl.heading(1, 'PERSONAL DETAILS', 60);
    var titles = ['Miss', 'Mrs', 'Ms', 'Mr'], tsegs = [];
    titles.forEach(function (t) { tsegs.push({ cb: s.title === t }, { t: t }, { gap: 9 }); });
    var other = titles.indexOf(s.title) < 0 && s.title ? (s.title === 'Other' ? (s.titleOther || '') : s.title) : '';
    tsegs.push({ cb: !!other || s.title === 'Other' }, { t: 'Other: ' + other });
    var addr = [];
    [[s.a1, s.a2].filter(Boolean).join(', '), [s.town, s.pc].filter(Boolean).join(', '), s.country].forEach(function (l) { if (l) addr.push({ t: l }); });
    fl.table([
      [lab('Title', 150), { w: W - 150, blocks: [{ segs: tsegs }] }],
      row2('Forename(s)', s.fn), row2('Surname', s.sn),
      [lab('Full address', 150), { w: W - 150, blocks: addr }],
      row2('National Insurance number', s.ni || (s.noNi ? 'Not yet issued' : '')),
      row2('Mobile number', s.mob), row2('Date of birth', BF.dateShort(s.dob)),
      row2('Nationality', s.nat), row2('Email', s.email)
    ]);

    fl.heading(2, 'EMERGENCY CONTACT', 60);
    var cw = [86, 144, 128, W - 358];
    fl.table([
      [lab('Forename', cw[0]), val(ec.fn, cw[1]), lab('Relationship to you', cw[2]), val(ec.rel, cw[3])],
      [lab('Surname', cw[0]), val(ec.sn, cw[1]), lab('Contact number (UK only)', cw[2]), val(ec.tel, cw[3])]
    ]);

    fl.heading(3, 'BANK DETAILS (UK ONLY)', 60);
    fl.table([row2('Bank name', bk.name), row2('Account name', bk.acc), row2('Account number', bk.no), row2('Sort code', bk.sort)]);

    fl.heading(4, 'RIGHT TO WORK', 40);
    fl.para('Please tick one status and complete the matching details. You must show the HR Department your original documents, or provide a share code, before your first shift.');

    fl.newPage();
    var k = rt.kind, lw = 228, rw = W - lw;
    function exp(on) { return { w: rw, blocks: [{ t: 'Expiry date: ' + (on ? BF.dateShort(rt.exp) : '') }] }; }
    function share(on) {
      return { w: rw, blocks: [{ t: 'Share code: ' + (on ? (rt.share || '') : '') }, { t: 'Share code expiry date: ' + (on ? BF.dateShort(rt.shareExp) : '') }] };
    }
    function opt(on, t) { return { segs: [{ cb: on }, { t: t, f: 'B' }] }; }
    fl.table([
      [{ w: lw, blocks: [opt(k === 'british', 'British passport')] }, exp(k === 'british')],
      [{ w: lw, blocks: [opt(k === 'irish', 'Irish passport')] }, exp(k === 'irish')],
      [{ w: lw, blocks: [opt(k === 'cert', 'UK birth or adoption certificate'), { t: 'together with official evidence of your National Insurance number' }] }, { w: rw, blocks: [] }],
      [{ w: lw, blocks: [opt(k === 'evisa', 'eVisa or other digital immigration status'),
        { t: 'Type of visa (for example student or skilled worker): ' + (k === 'evisa' ? (rt.visaType || '') : '') },
        { t: 'Restrictions (for example term time hours limit): ' + (k === 'evisa' ? (rt.restr || 'None') : '') }] }, share(k === 'evisa')],
      [{ w: lw, blocks: [opt(k === 'euss', 'EU Settlement Scheme'),
        { segs: [{ cb: k === 'euss' && rt.euss === 'settled' }, { t: 'Settled' }, { gap: 10 }, { cb: k === 'euss' && rt.euss === 'pre' }, { t: 'Pre-settled' }] }] }, share(k === 'euss')],
      [{ w: lw, blocks: [opt(k === 'other', 'Other passport or visa'), { t: 'Country: ' + (k === 'other' ? (rt.country || '') : '') }] }, exp(k === 'other')],
      [{ w: W, blocks: [{ t: 'Any other document provided (for example ID card or driving licence):', f: 'B' }].concat(rt.otherDoc ? [{ t: rt.otherDoc }] : []) }]
    ]);

    fl.heading(5, 'TAX INFORMATION', 50);
    fl.table([
      [lab('P45 provided', 150), { w: W - 150, blocks: [{ segs: yesNo(tax.p45 === 'yes') }] }],
      [lab('HMRC starter checklist completed', 150), { w: W - 150, blocks: [{ segs: yesNo(BF.checklistNeeded(s)) }] }]
    ]);

    fl.heading(6, 'DECLARATION', 60);
    fl.para('I confirm that the information given on this form is correct and complete, and I will tell the HR Department of any change to it. The Company will use this information for payroll, HR administration, and right to work checks, and will hold it in accordance with its privacy notice.', { after: 0 });
    var sg = s.sig && s.sig.decl;
    fl.signRow('Signed (employee):', typedSig(sg), sg && sg.at ? BF.dateShort(sg.at) : '', { sigW: 170 });

    fl.newPage();
    fl.heading(7, 'FOR HR DEPARTMENT USE ONLY', 60);
    function pick(list, cur) {
      var segs = [];
      list.forEach(function (it, i) { if (i) segs.push({ gap: 10 }); segs.push({ cb: it[0] === cur }, { t: it[1] }); });
      return { w: W - 150, blocks: [{ segs: segs }] };
    }
    fl.table([
      row2('Job title', o.job), row2('Rate of pay (£ per hour)', '£' + BF.money(o.rate)),
      row2('Start date', BF.dateShort(o.start)), row2('Contract hours (per week)', BF.hasSetHours(o) ? String(o.hrs) : 'Zero hours'),
      [lab('Employment type', 150), pick([['full', 'Full time'], ['part', 'Part time'], ['temp', 'Temporary']], o.type)],
      [lab('Location', 150), pick([['bar', 'Bar Finch'], ['hq', 'Office HQ']], 'bar')],
      row2('Right to work documents checked by', ''), row2('Date of right to work check', '')
    ]);
    return fl.finish();
  };

  /* ---------- 3. HMRC starter checklist (the official form, filled in) ---------- */
  BF.checklistNeeded = function (s) {
    var t = (s && s.tax) || {};
    return t.p45 === 'no' || t.loan === 'yes';
  };
  BF.statement = function (t) {
    if (!t || !t.q8) return '';
    if (t.q8 === 'yes') return 'C';
    if (!t.q9) return '';
    if (t.q9 === 'yes') return 'C';
    if (!t.q10) return '';
    return t.q10 === 'yes' ? 'B' : 'A';
  };
  BF.buildHmrc = function (o, s) {
    var t = s.tax || {};
    return BF.fillTemplate(BF.HMRC, function (pg, F) {
      var p1 = pg[0], p2 = pg[1], p3 = pg[2], BW = 13.7, BH = 16.5;
      function boxText(c, str, x, top, w, h, f, size, color) {
        f = f || F.R;
        var ft = fit(str, f, size || 10.5, w - 8, 6.5);
        c.text(ft.str, x + 4, top + h / 2 + ft.size * 0.34, f, ft.size, { color: color });
      }
      function comb(c, chars, xs, top) {
        Array.from(chars).slice(0, xs.length).forEach(function (ch, i) {
          c.text(ch, xs[i] + BW / 2, top + 12.2, F.R, 11, { align: 'center' });
        });
      }
      function X(c, x, top) { c.mark(x, top, BW, BH, 'x'); }
      function yn(c, v, yes, no) { if (v === 'yes') X(c, yes[0], yes[1]); else if (v === 'no') X(c, no[0], no[1]); }

      // page 1: personal details
      boxText(p1, s.sn, 62.6, 356.0, 216.4, 16.5);
      var fn = wrap(s.fn, F.R, 10.5, 208);
      if (fn.length <= 1) boxText(p1, s.fn, 62.6, 431.0, 216.4, 16.75);
      else {
        boxText(p1, fn[0].join(' '), 62.6, 431.0, 216.4, 16.75);
        boxText(p1, fn.slice(1).map(function (l) { return l.join(' '); }).join(' '), 62.6, 447.75, 216.4, 16.75);
      }
      if (t.sex === 'M') X(p1, 89.8, 523.0); else if (t.sex === 'F') X(p1, 157.2, 523.0);
      comb(p1, BF.dateDigits(s.dob), [62.6, 78.2, 100.9, 116.5, 139.1, 154.7, 170.3, 185.9], 573.0);
      var rowH = 16.9;
      var addr = [s.a1, s.a2, s.town].map(function (l) { return String(l || '').trim(); });
      if (addr.some(function (l) { return F.R.width(l, 8.5) > 208; })) {       // a line is too long for its row: re-flow the address over the three rows
        var joined = addr.filter(Boolean).join(', '), asz = 9.5, al;
        do { al = wrap(joined, F.R, asz, 208); asz -= 0.5; } while (al.length > 3 && asz >= 6.5);
        addr = al.slice(0, 2).map(function (l) { return l.join(' '); });
        if (al.length > 2) addr.push(al.slice(2).map(function (l) { return l.join(' '); }).join(' '));
      }
      addr.forEach(function (l, i) { if (l) boxText(p1, l, 330.5, 356.0 + rowH * i, 216.4, rowH); });
      if (s.pc) boxText(p1, s.pc, 330.5 + 48, 356.0 + rowH * 3, 216.4 - 48, rowH);
      if (s.country) boxText(p1, s.country, 330.5 + 48, 356.0 + rowH * 4, 216.4 - 48, rowH);
      comb(p1, String(s.ni || '').replace(/\s+/g, '').toUpperCase(), [330.5, 346.1, 368.8, 384.3, 407.0, 422.6, 445.3, 460.9, 483.6], 474.0);
      comb(p1, BF.dateDigits(o.start), [330.5, 346.1, 368.8, 384.3, 407.0, 422.6, 438.2, 453.8], 524.0);

      // page 2: employee statement
      yn(p2, t.q8, [83.9, 128.8], [83.9, 153.8]);
      if (t.q8 === 'no') yn(p2, t.q9, [83.9, 216.3], [83.9, 241.3]);
      if (t.q8 === 'no' && t.q9 === 'no') yn(p2, t.q10, [351.7, 191.3], [351.7, 216.3]);
      var st = BF.statement(t);
      if (st) X(p2, { A: 137.7, B: 298.6, C: 461.6 }[st], 294.9);

      // page 3: student loans and declaration
      yn(p3, t.loan, [83.9, 92.4], [83.9, 119.3]);
      if (t.loan === 'yes') {
        yn(p3, t.q12, [83.9, 281.8], [83.9, 308.7]);
        if (t.q12 === 'no') {
          var tops = { '1': 399.0, '2': 424.0, '4': 449.0, '5': 474.0 };
          if (tops[t.plan]) X(p3, 158.1, tops[t.plan]);
          if (t.pg) X(p3, 158.1, 499.0);
        }
      }
      var sg = s.sig && s.sig.decl;
      boxText(p3, (s.fn + ' ' + s.sn).toUpperCase(), 37.1, 604.4, 216.4, 16.5);
      if (sg && sg.name) {
        boxText(p3, sg.name, 305.0, 603.5, 216.3, 22, F.I, 14, INK);
        p3.text('Signed electronically by typing this name on ' + BF.dateTime(sg.at), 309, 632.5, F.R, 6, { color: GREY });
        comb(p3, BF.dateDigits(sg.at), [37.1, 52.7, 75.4, 91.0, 113.6, 129.2, 144.8, 160.4], 652.4);
      }
    });
  };

  /* ---------- 4. Working time opt-out agreement ---------- */
  BF.buildOptOut = function (o, s) {
    var T = BF.OPTOUT, fl = new Flow('Working time opt-out agreement', o.ref);
    fl.title(T.title);
    fl.fieldRow('Employee name:', BF.fullName(o), { end: M.R - 90, h: 22 });
    fl.fieldRow('Job title:', o.job, { end: M.R - 90, h: 22 });
    fl.y += 8;
    fl.clauses(T.clauses, {});
    var sg = s && s.sig && s.sig.optout;
    fl.need(110);
    fl.signRow('Signed (employee):', typedSig(sg), sg && sg.at ? BF.dateShort(sg.at) : '', { x: M.L + IND1, sigW: 130 });
    fl.signRow('Received for the Company:', null, '', { x: M.L + IND1, sigW: 96 });
    return fl.finish();
  };

  /* ---------- 5. Confidentiality agreement (NDA) ---------- */
  BF.buildNda = function (o, s) {
    var T = BF.NDA, fl = new Flow('Confidentiality agreement', o.ref), F = fl.F;
    var name = s && s.fn ? (s.fn + ' ' + s.sn) : BF.fullName(o);
    var vars = { name: name, address: s ? addressLine(s) : '' };
    var nd = (s && s.sig && s.sig.nda) || {};
    var signed = nd.mode === 'witness' && nd.name;
    fl.title(T.title);
    fl.para('Dated:', { after: 6 });
    fl.para('PARTIES', { font: F.B, after: 6 });
    fl.item('(1)', T.party1, 1);
    fl.item('(2)', fill(T.party2, vars), 1);
    fl.clauses(T.clauses, vars);

    fl.newPage();
    fl.para(T.exec1, { font: F.B, align: 'justify', after: 0 });
    fl.signRow('Signed (director):', null, '', { sigW: 150 });
    ['Witness signature:', 'Witness name:', 'Witness address:', 'Witness occupation:'].forEach(function (l) { fl.fieldRow(l, '', { end: M.R - 90 }); });
    fl.y += 16;
    fl.para(T.exec2, { font: F.B, align: 'justify', after: 0 });
    var w = nd.w || {};
    fl.signRow('Signed (Recipient):', signed ? typedSig(nd) : null, signed ? BF.dateShort(nd.at) : '', { sigW: 150 });
    fl.fieldRow('Witness signature:', signed ? w.name : '', { end: M.R - 90, italic: true,
      below: signed ? 'Signed electronically by the witness, present in person, on ' + BF.dateTime(w.at || nd.at) : '' });
    fl.fieldRow('Witness name:', signed ? w.name : '', { end: M.R - 90, h: signed ? 32 : 24 });
    fl.fieldRow('Witness address:', signed ? String(w.addr || '').trim().replace(/\s*[\r\n]+\s*/g, ', ') : '', { end: M.R - 90 });
    fl.fieldRow('Witness occupation:', signed ? w.occ : '', { end: M.R - 90 });
    return fl.finish();
  };

  /* ---------- the whole pack ---------- */
  BF.buildPack = function (o, s) {
    var stem = BF.fileSlug(s.sn || o.sn) + '-' + BF.fileSlug(s.fn || o.fn);
    var files = [];
    function add(label, slug, bytes, note) { files.push({ label: label, name: stem + '_' + slug + '.pdf', bytes: bytes, note: note || '' }); }
    add('Statement of terms and conditions of employment', 'Contract', BF.buildContract(o, s));
    add('New Starter Form', 'New-Starter-Form', BF.buildStarterForm(o, s));
    if (BF.checklistNeeded(s)) add('HMRC starter checklist', 'HMRC-Starter-Checklist', BF.buildHmrc(o, s));
    var oo = s.sig && s.sig.optout;
    if (oo && oo.choice === 'yes') add('Working time opt-out agreement', 'Working-Time-Opt-Out', BF.buildOptOut(o, s));
    var nd = (s.sig && s.sig.nda) || {};
    add('Confidentiality agreement', 'Confidentiality-Agreement', BF.buildNda(o, s),
      nd.mode === 'witness' ? '' : 'Filled in but not signed. You will sign this in person with a witness.');
    return files;
  };
  BF.packName = function (o, s) {
    return 'Bar-Finch-new-starter-pack_' + BF.fileSlug((s && s.sn) || o.sn) + '-' + BF.fileSlug((s && s.fn) || o.fn);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
