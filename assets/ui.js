/* ui.js - form building blocks shared by the starter page and the setup page. */
(function (g) {
  'use strict';
  var BF = g.BF, esc = BF.esc, UI = BF.UI = {};

  UI.get = function (obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  };
  UI.set = function (obj, path, val) {
    var ks = path.split('.'), o = obj;
    for (var i = 0; i < ks.length - 1; i++) {
      if (typeof o[ks[i]] !== 'object' || !o[ks[i]]) o[ks[i]] = {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
  };
  function id(k) { return 'f-' + k.replace(/\./g, '-'); }
  UI.id = id;
  function errHtml(errs, k) { return errs[k] ? '<span class="err" id="' + id(k) + '-err">' + esc(errs[k]) + '</span>' : ''; }
  function attrs(o) {
    var s = '';
    Object.keys(o || {}).forEach(function (a) { if (o[a] !== undefined && o[a] !== false) s += ' ' + a + '="' + esc(o[a] === true ? a : o[a]) + '"'; });
    return s;
  }

  /* one-line (or multi-line) text box */
  UI.text = function (st, errs, k, label, o) {
    o = o || {};
    var v = UI.get(st, k), bad = errs[k] ? ' bad' : '';
    var common = ' id="' + id(k) + '" data-k="' + k + '"' + (errs[k] ? ' aria-invalid="true" aria-describedby="' + id(k) + '-err"' : '') + attrs(o.attrs);
    var input = o.multiline
      ? '<textarea' + common + '>' + esc(v || '') + '</textarea>'
      : '<input type="' + (o.type || 'text') + '"' + common + (o.cls ? ' class="' + o.cls + '"' : '') + ' value="' + esc(v || '') + '">';
    return '<div class="field' + bad + '"><label for="' + id(k) + '">' + esc(label) + '</label>' +
      (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + input + errHtml(errs, k) + '</div>';
  };

  UI.select = function (st, errs, k, label, options, o) {
    o = o || {};
    var v = UI.get(st, k) || '';
    var opts = '<option value=""></option>' + options.map(function (op) {
      return '<option' + (op === v ? ' selected' : '') + '>' + esc(op) + '</option>';
    }).join('');
    return '<div class="field' + (errs[k] ? ' bad' : '') + '"><label for="' + id(k) + '">' + esc(label) + '</label>' +
      '<select id="' + id(k) + '" data-k="' + k + '"' + (o.re ? ' data-re="1"' : '') + ' class="' + (o.cls || '') + '">' + opts + '</select>' + errHtml(errs, k) + '</div>';
  };

  /* a group of radio buttons; options are [value, label, small print] */
  UI.radios = function (st, errs, k, legend, options, o) {
    o = o || {};
    var v = UI.get(st, k);
    var html = '<fieldset' + (errs[k] ? ' class="bad"' : '') + '><legend>' + legend + '</legend>' +
      (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '<div class="' + (o.inline ? 'inline-choices' : '') + '">';
    options.forEach(function (op, i) {
      html += '<label class="choice"><input type="radio" name="' + id(k) + '" id="' + id(k) + '-' + i + '" data-k="' + k + '" value="' + esc(op[0]) + '"' +
        (o.re === false ? '' : ' data-re="1"') + (v === op[0] ? ' checked' : '') + '><span>' + op[1] +
        (op[2] ? '<small>' + op[2] + '</small>' : '') + '</span></label>';
    });
    return html + '</div>' + errHtml(errs, k) + '</fieldset>';
  };

  UI.check = function (st, errs, k, label, o) {
    o = o || {};
    return '<div class="field' + (errs[k] ? ' bad' : '') + '"><label class="choice"><input type="checkbox" id="' + id(k) + '" data-k="' + k + '"' +
      (o.re ? ' data-re="1"' : '') + (UI.get(st, k) ? ' checked' : '') + '><span>' + label + '</span></label>' + errHtml(errs, k) + '</div>';
  };

  /* day / month / year boxes. The value is kept as YYYY-MM-DD; what was typed is kept in st._d */
  UI.date = function (st, errs, k, legend, o) {
    o = o || {};
    var raw = (st._d && st._d[k]) || null, iso = UI.get(st, k);
    if (!raw) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      raw = m ? { d: String(+m[3]), m: String(+m[2]), y: m[1] } : { d: '', m: '', y: '' };
    }
    function part(p, lab, cls, len) {
      return '<div class="' + cls + '"><label for="' + id(k) + '-' + p + '">' + lab + '</label><input type="text" inputmode="numeric" autocomplete="off" maxlength="' + len +
        '" id="' + id(k) + '-' + p + '" data-date="' + k + '" data-part="' + p + '" value="' + esc(raw[p] || '') + '"></div>';
    }
    return '<fieldset class="field' + (errs[k] ? ' bad' : '') + '" id="' + id(k) + '"><legend>' + esc(legend) + '</legend>' +
      (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') +
      '<div class="date">' + part('d', 'Day', 'dy', 2) + part('m', 'Month', 'mo', 2) + part('y', 'Year', 'yr', 4) + '</div>' + errHtml(errs, k) + '</fieldset>';
  };
  function isoFrom(raw) {
    var d = parseInt(raw.d, 10), m = parseInt(raw.m, 10), y = parseInt(raw.y, 10);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) || String(raw.y).trim().length !== 4) return '';
    var t = new Date(y, m - 1, d);
    if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== d) return '';
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  /* Reads a changed control into the state. Returns true when the page should redraw. */
  UI.handle = function (ev, st) {
    var el = ev.target;
    if (!el || !el.getAttribute) return false;
    var dk = el.getAttribute('data-date');
    if (dk) {
      st._d = st._d || {};
      var raw = st._d[dk] = st._d[dk] || { d: '', m: '', y: '' };
      var root = el.closest('fieldset');
      ['d', 'm', 'y'].forEach(function (p) { raw[p] = root.querySelector('[data-part="' + p + '"]').value.replace(/\D/g, ''); });
      UI.set(st, dk, isoFrom(raw));
      return false;
    }
    var k = el.getAttribute('data-k');
    if (!k) return false;
    if (el.type === 'checkbox') UI.set(st, k, el.checked);
    else if (el.type === 'radio') { if (el.checked) UI.set(st, k, el.value); }
    else UI.set(st, k, el.value);
    return el.getAttribute('data-re') === '1' && (ev.type === 'change');
  };

  /* once a field with an error is edited, take its inline message away (the summary stays until the next try) */
  UI.clearError = function (errs, el) {
    var k = el.getAttribute && (el.getAttribute('data-k') || el.getAttribute('data-date'));
    if (!k || !errs[k]) return;
    delete errs[k];
    var msg = document.getElementById(id(k) + '-err');
    if (msg) msg.remove();
    var box = el.closest('.bad');
    if (box) box.classList.remove('bad');
    el.removeAttribute('aria-invalid');
  };

  UI.errorSummary = function (errs) {
    var ks = Object.keys(errs);
    if (!ks.length) return '';
    return '<div class="errors" role="alert"><h2>Please check ' + (ks.length === 1 ? 'this' : 'these') + '</h2><ul>' +
      ks.map(function (k) { return '<li><a href="#' + id(k) + '" data-jump="' + id(k) + '">' + esc(errs[k]) + '</a></li>'; }).join('') + '</ul></div>';
  };
  UI.jump = function (targetId) {
    var el = document.getElementById(targetId) || document.querySelector('[id^="' + targetId + '"]');
    if (!el) return;
    var focusable = el.matches('input,select,textarea') ? el : el.querySelector('input,select,textarea');
    el.scrollIntoView({ block: 'center' });
    if (focusable) focusable.focus({ preventScroll: true });
  };

  var toastTimer = null;
  UI.toast = function (msg) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  };
  UI.copy = function (text, done) {
    function ok() { UI.toast(done || 'Copied'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { UI.toast('Select the text and copy it'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  };
  UI.download = function (name, bytes, type) {
    var url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/pdf' }));
    var a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    // keep the file available for five minutes: phones ask "Download?" first, and the page may be cleared in the meantime
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 300000);
  };

  /* on-screen version of a clause document (contract, opt-out, NDA) */
  function fillHtml(t, vars) {
    return esc(t).replace(/\{\{(\w+)\}\}/g, function (m, k) { return '<span class="fill">' + esc(vars[k]) + '</span>'; });
  }
  UI.fillHtml = fillHtml;
  UI.clausesHtml = function (list, vars) {
    var h = '';
    list.forEach(function (cl, ci) {
      h += '<h3>' + (ci + 1) + '.&nbsp;&nbsp;' + esc(cl.h) + '</h3>';
      cl.items.forEach(function (it, ii) {
        h += '<div class="cl"><span>' + (ci + 1) + '.' + (ii + 1) + '</span><p>' + fillHtml(it.t, vars) + '</p></div>';
        it.sub.forEach(function (st, si) {
          h += '<div class="cl sub"><span>(' + String.fromCharCode(97 + si) + ')</span><p>' + fillHtml(st, vars) + '</p></div>';
        });
      });
    });
    return h;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
