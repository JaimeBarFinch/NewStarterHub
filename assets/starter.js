/* starter.js - the page a new starter opens from their link. */
(function () {
  'use strict';
  var BF = window.BF, UI = BF.UI, esc = BF.esc;
  var app = document.getElementById('app');
  var logo = '<div class="masthead">' + BF.LOGO.svg + '</div>';

  function stop(title, html) {
    document.title = title + ' | Bar Finch new starter forms';
    app.innerHTML = logo + '<div class="sheet"><h1>' + title + '</h1>' + html + '</div>';
  }
  var parsed = BF.parseLink(location.hash);
  if (!parsed) {
    stop('This link is not complete', '<p>Your new starter forms open from the full link Bar Finch sent you. Part of it seems to be missing.</p>' +
      '<p>Open the link again from the original message, or ask your manager to send it again.</p>');
    return;
  }
  if (!BF.canSign()) {
    stop('This browser cannot open your forms', '<p>Open your link in an up-to-date version of Safari or Chrome.</p>');
    return;
  }
  BF.verifyPayload(parsed.payload, parsed.sig).then(function (ok) {
    if (ok) start(parsed.offer);
    else stop('This link is not valid', '<p>It was not created by Bar Finch, or it has been changed since it was sent. Please do not enter any details.</p>' +
      '<p>Ask your manager at Bar Finch to send your link again.</p>');
  });

  function start(offer) {
  offer.ref = BF.refCode(offer);           // worked out here from the terms, never read from the link
  var F = BF.fonts();
  var HR = offer.hr || '';
  var hrLink = HR ? '<a href="mailto:' + esc(HR) + '">' + esc(HR) + '</a>' : 'your manager';
  var KEY = 'bf-starter-' + offer.ref;

  /* ---------- state (kept in this browser tab only) ---------- */
  function blank() {
    return {
      title: '', titleOther: '', fn: offer.fn, sn: offer.sn, a1: '', a2: '', town: '', pc: '', country: 'United Kingdom',
      ni: '', noNi: false, mob: '', dob: '', nat: '', email: '',
      ec: { fn: '', sn: '', rel: '', tel: '' }, bank: { name: '', acc: '', no: '', sort: '' },
      rtw: { kind: '', exp: '', visaType: '', restr: '', share: '', shareExp: '', euss: '', country: '', otherDoc: '' },
      tax: { p45: '', loan: '', sex: '', q8: '', q9: '', q10: '', q12: '', plan: '', pg: false },
      sig: { contract: {}, optout: {}, nda: { w: {} }, decl: {} }, _d: {}, _step: 0
    };
  }
  function load() {
    try { var t = sessionStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: carry on without a draft */ } }
  var S = load() || blank();
  var ix = S._step || 0, errs = {}, pack = null, packError = '', sendState = '';

  /* ---------- validation helpers ---------- */
  function val(k) { var v = UI.get(S, k); return v == null ? '' : String(v).trim(); }
  function need(e, k, msg) { if (!val(k)) e[k] = msg; }
  function latin(e, keys) {
    keys.forEach(function (k) { if (val(k) && !e[k] && !F.R.covers(val(k))) e[k] = 'Use Latin letters, numbers and ordinary punctuation only, as on your passport'; });
  }
  function digits(k) { return val(k).replace(/\D/g, ''); }
  function dateErr(e, k, msg) { if (!val(k)) e[k] = msg + ' Use numbers, for example 27 3 1998.'; }
  function signErr(e, base, tickMsg) {
    if (!UI.get(S, base + '.agree')) e[base + '.agree'] = tickMsg;
    need(e, base + '.name', 'Type your full name to sign');
    latin(e, [base + '.name']);
  }
  function stamp(base) { UI.set(S, base + '.at', BF.nowLocal()); }

  var vars = BF.contractVars(offer);
  function termsHtml() {
    return '<dl class="terms"><dt>Role</dt><dd>' + esc(offer.job) + '</dd><dt>Start date</dt><dd>' + esc(BF.dateLong(offer.start)) +
      '</dd><dt>Hours</dt><dd>' + esc(String(offer.hrs)) + ' a week</dd><dt>Pay</dt><dd>£' + esc(BF.money(offer.rate)) + ' an hour</dd></dl>';
  }
  function signBox(base, tickLabel, heading, nameLabel) {
    var name = val(base + '.name');
    return '<div class="signbox">' + (heading ? '<h2 style="margin-top:0">' + heading + '</h2>' : '') +
      UI.check(S, errs, base + '.agree', tickLabel) +
      UI.text(S, errs, base + '.name', nameLabel || 'Type your full name to sign', { attrs: { autocomplete: 'name', 'data-sig': base } }) +
      '<div class="sig-preview" data-sigview="' + base + '" aria-hidden="true">' + esc(name) + '</div>' +
      '<p class="small">Ticking the box and typing your name is your signature. The date and time are added to the document.</p></div>';
  }
  function needChecklist() { return BF.checklistNeeded(S); }

  /* ---------- the steps ---------- */
  var STEPS = [
    {
      id: 'welcome', title: function () { return 'Welcome to Bar Finch, ' + offer.fn.split(' ')[0]; }, next: 'Start',
      body: function () {
        return '<p class="lead">Before your first shift we need a few details from you and your signature on your paperwork. It takes about ten minutes.</p>' +
          termsHtml() +
          '<h2>Have these to hand</h2><ul>' +
          '<li>Your National Insurance number</li><li>Your bank account number and sort code</li>' +
          '<li>Your passport, or your share code if you have a visa or settled status</li>' +
          '<li>Your P45 from your last job, if you have one</li>' +
          '<li>Someone who can watch you sign the confidentiality agreement. If nobody is with you, you can sign that one at Bar Finch instead.</li></ul>' +
          '<div class="note"><p>Your answers stay on this device while you fill the forms in. At the end your signed forms are created here for you to download' +
          (offer.post ? ', and a copy is sent to Bar Finch.' : ' and send to Bar Finch.') + ' Use Safari or Chrome so that the downloads work.</p></div>';
      },
      validate: function () { return {}; }
    },
    {
      id: 'you', title: 'Your details',
      body: function () {
        return UI.select(S, errs, 'title', 'Title', ['Miss', 'Mrs', 'Ms', 'Mr', 'Other'], { re: true, cls: 'w-m' }) +
          (S.title === 'Other' ? UI.text(S, errs, 'titleOther', 'Your title', { cls: 'w-m' }) : '') +
          UI.text(S, errs, 'fn', 'Forename(s)', { hint: 'Your full first names, as on your passport. No initials or shortened names.', attrs: { autocomplete: 'given-name' } }) +
          UI.text(S, errs, 'sn', 'Surname', { attrs: { autocomplete: 'family-name' } }) +
          '<h2>Home address</h2>' +
          UI.text(S, errs, 'a1', 'Address line 1', { attrs: { autocomplete: 'address-line1' } }) +
          UI.text(S, errs, 'a2', 'Address line 2 (optional)', { attrs: { autocomplete: 'address-line2' } }) +
          UI.text(S, errs, 'town', 'Town or city', { attrs: { autocomplete: 'address-level2' } }) +
          UI.text(S, errs, 'pc', 'Postcode', { cls: 'w-s', attrs: { autocomplete: 'postal-code', autocapitalize: 'characters' } }) +
          UI.text(S, errs, 'country', 'Country', { cls: 'w-m', attrs: { autocomplete: 'country-name' } }) +
          '<h2>About you</h2>' +
          UI.date(S, errs, 'dob', 'Date of birth', { hint: 'For example 27 3 1998' }) +
          UI.text(S, errs, 'nat', 'Nationality', { cls: 'w-m' }) +
          (S.noNi ? '' : UI.text(S, errs, 'ni', 'National Insurance number', { hint: 'It is on your payslip, P60 or in the HMRC app. For example QQ 12 34 56 C.', cls: 'w-m', attrs: { autocapitalize: 'characters', autocomplete: 'off' } })) +
          UI.check(S, errs, 'noNi', 'I do not have a National Insurance number yet', { re: true }) +
          '<h2>How to reach you</h2>' +
          UI.text(S, errs, 'mob', 'Mobile number', { type: 'tel', cls: 'w-m', attrs: { autocomplete: 'tel' } }) +
          UI.text(S, errs, 'email', 'Email', { type: 'email', attrs: { autocomplete: 'email' } });
      },
      validate: function () {
        var e = {};
        need(e, 'title', 'Choose your title');
        if (S.title === 'Other') need(e, 'titleOther', 'Enter your title');
        need(e, 'fn', 'Enter your forename(s)'); need(e, 'sn', 'Enter your surname');
        need(e, 'a1', 'Enter the first line of your address'); need(e, 'town', 'Enter your town or city');
        need(e, 'pc', 'Enter your postcode'); need(e, 'country', 'Enter your country');
        dateErr(e, 'dob', 'Enter your date of birth.');
        if (!e.dob) {
          var age = BF.ageOn(S.dob, BF.today());
          if (age < 0 || age > 100) e.dob = 'Check the year of your date of birth';
          else if (age < 18) e.dob = 'Bar Finch uses a different statement of terms for under-18s. Please contact ' + (HR || 'your manager') + ' instead of filling in this form.';
        }
        need(e, 'nat', 'Enter your nationality');
        if (!S.noNi) {
          var ni = val('ni').replace(/\s+/g, '').toUpperCase();
          if (!ni) e.ni = 'Enter your National Insurance number, or tick the box below if you do not have one yet';
          else if (!/^[A-Z]{2}\d{6}[A-D]$/.test(ni)) e.ni = 'A National Insurance number is 2 letters, 6 numbers, then A, B, C or D';
          else S.ni = ni;
        } else S.ni = '';
        if (digits('mob').length < 10) e.mob = 'Enter your mobile number';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val('email'))) e.email = 'Enter your email address';
        latin(e, ['titleOther', 'fn', 'sn', 'a1', 'a2', 'town', 'pc', 'country', 'nat', 'mob', 'email']);
        return e;
      }
    },
    {
      id: 'emergency', title: 'Emergency contact',
      body: function () {
        return '<p class="lead">Who should we call if something happens to you at work?</p>' +
          UI.text(S, errs, 'ec.fn', 'Their forename') + UI.text(S, errs, 'ec.sn', 'Their surname') +
          UI.text(S, errs, 'ec.rel', 'Relationship to you', { hint: 'For example partner, parent or friend', cls: 'w-m' }) +
          UI.text(S, errs, 'ec.tel', 'Their contact number', { hint: 'UK numbers only', type: 'tel', cls: 'w-m' });
      },
      validate: function () {
        var e = {};
        need(e, 'ec.fn', 'Enter their forename'); need(e, 'ec.sn', 'Enter their surname'); need(e, 'ec.rel', 'Enter their relationship to you');
        if (digits('ec.tel').length < 10) e['ec.tel'] = 'Enter their contact number';
        latin(e, ['ec.fn', 'ec.sn', 'ec.rel', 'ec.tel']);
        return e;
      }
    },
    {
      id: 'bank', title: 'Bank details',
      body: function () {
        return '<p class="lead">This is the account your wages are paid into. It must be a UK account.</p>' +
          UI.text(S, errs, 'bank.name', 'Bank name') +
          UI.text(S, errs, 'bank.acc', 'Account name', { hint: 'The name on the account' }) +
          UI.text(S, errs, 'bank.sort', 'Sort code', { hint: '6 numbers, for example 12-34-56', cls: 'w-s', attrs: { inputmode: 'numeric', autocomplete: 'off' } }) +
          UI.text(S, errs, 'bank.no', 'Account number', { hint: '8 numbers. If yours has 7, put a 0 in front.', cls: 'w-s', attrs: { inputmode: 'numeric', autocomplete: 'off' } });
      },
      validate: function () {
        var e = {};
        need(e, 'bank.name', 'Enter the name of your bank'); need(e, 'bank.acc', 'Enter the name on the account');
        var sc = digits('bank.sort'), no = digits('bank.no');
        if (sc.length !== 6) e['bank.sort'] = 'A sort code has 6 numbers'; else S.bank.sort = sc.slice(0, 2) + '-' + sc.slice(2, 4) + '-' + sc.slice(4);
        if (no.length !== 8) e['bank.no'] = 'An account number has 8 numbers'; else S.bank.no = no;
        latin(e, ['bank.name', 'bank.acc']);
        return e;
      }
    },
    {
      id: 'rtw', title: 'Right to work',
      body: function () {
        var k = S.rtw.kind, more = '';
        var shareFields = UI.text(S, errs, 'rtw.share', 'Share code', { hint: '9 characters from gov.uk, for example W12 345 678', cls: 'w-m', attrs: { autocapitalize: 'characters', autocomplete: 'off' } }) +
          UI.date(S, errs, 'rtw.shareExp', 'Share code expiry date');
        if (k === 'british' || k === 'irish') more = UI.date(S, errs, 'rtw.exp', 'Passport expiry date');
        else if (k === 'cert') more = '<div class="note"><p>Bring the certificate together with official evidence of your National Insurance number.</p></div>';
        else if (k === 'evisa') more = UI.text(S, errs, 'rtw.visaType', 'Type of visa', { hint: 'For example student or skilled worker' }) +
          UI.text(S, errs, 'rtw.restr', 'Restrictions (optional)', { hint: 'For example a term time hours limit' }) + shareFields;
        else if (k === 'euss') more = UI.radios(S, errs, 'rtw.euss', 'Your status', [['settled', 'Settled'], ['pre', 'Pre-settled']], { inline: true, re: false }) + shareFields;
        else if (k === 'other') more = UI.text(S, errs, 'rtw.country', 'Country of the passport or visa', { cls: 'w-m' }) + UI.date(S, errs, 'rtw.exp', 'Expiry date');
        return '<p class="lead">Choose the one that shows your right to work in the UK.</p>' +
          UI.radios(S, errs, 'rtw.kind', 'Which will you show us?', [
            ['british', 'British passport'], ['irish', 'Irish passport'],
            ['cert', 'UK birth or adoption certificate', 'Together with official evidence of your National Insurance number'],
            ['evisa', 'eVisa or other digital immigration status'], ['euss', 'EU Settlement Scheme'], ['other', 'Other passport or visa']
          ]) +
          (more ? '<div class="nested">' + more + '</div>' : '') +
          UI.text(S, errs, 'rtw.otherDoc', 'Any other document you will bring (optional)', { hint: 'For example an ID card or driving licence' }) +
          '<div class="note"><p>You must show Bar Finch your original documents, or give your share code, before your first shift.</p></div>';
      },
      validate: function () {
        var e = {}, k = S.rtw.kind;
        need(e, 'rtw.kind', 'Choose how you will show your right to work');
        if (k === 'british' || k === 'irish' || k === 'other') dateErr(e, 'rtw.exp', 'Enter the expiry date.');
        if (k === 'other') need(e, 'rtw.country', 'Enter the country');
        if (k === 'evisa') need(e, 'rtw.visaType', 'Enter your type of visa');
        if (k === 'euss') need(e, 'rtw.euss', 'Choose settled or pre-settled');
        if (k === 'evisa' || k === 'euss') {
          var sc = val('rtw.share').replace(/[\s-]+/g, '').toUpperCase();
          if (!/^[A-Z0-9]{9}$/.test(sc)) e['rtw.share'] = 'A share code has 9 letters and numbers';
          else S.rtw.share = sc.slice(0, 3) + ' ' + sc.slice(3, 6) + ' ' + sc.slice(6);
          dateErr(e, 'rtw.shareExp', 'Enter the date your share code expires.');
        }
        latin(e, ['rtw.visaType', 'rtw.restr', 'rtw.country', 'rtw.otherDoc']);
        return e;
      }
    },
    {
      id: 'tax', title: 'Tax',
      body: function () {
        var t = S.tax, h = '';
        h += UI.radios(S, errs, 'tax.p45', 'Do you have a P45 from a previous job to give us?', [['yes', 'Yes'], ['no', 'No']], { inline: true, hint: 'A P45 is the form an employer gives you when you stop working for them.' });
        h += UI.radios(S, errs, 'tax.loan', 'Do you have a student or postgraduate loan?', [['yes', 'Yes'], ['no', 'No']], { inline: true });
        if (t.p45 === 'yes' && t.loan === 'no') h += '<div class="note"><p>Please bring parts 2 and 3 of your P45 to Bar Finch before your first shift. You do not need to answer anything else on this page.</p></div>';
        if (!needChecklist()) return h;
        h += '<h2>HMRC starter checklist</h2><p class="small">' + (t.p45 === 'no' ? 'Because you do not have a P45' : 'Because you have a student loan') +
          ', HMRC asks for these answers so that you pay the right amount of tax. They are put onto the official starter checklist for you.</p>';
        h += UI.radios(S, errs, 'tax.sex', 'What is your sex?', [['M', 'Male'], ['F', 'Female']], { inline: true, re: false, hint: 'As shown on your birth certificate or gender recognition certificate' });
        h += UI.radios(S, errs, 'tax.q8', 'Do you have another job?', [['yes', 'Yes'], ['no', 'No']], { inline: true });
        if (t.q8 === 'no') h += UI.radios(S, errs, 'tax.q9', 'Do you receive payments from a State, workplace or private pension?', [['yes', 'Yes'], ['no', 'No']], { inline: true });
        if (t.q8 === 'no' && t.q9 === 'no') h += UI.radios(S, errs, 'tax.q10', 'Since 6 April have you received payments from another job which has ended, or any of these taxable benefits?',
          [['yes', 'Yes'], ['no', 'No']], { inline: true, hint: 'Jobseeker’s Allowance (JSA), Employment and Support Allowance (ESA) or Incapacity Benefit' });
        var st = BF.statement(t);
        if (st) {
          var keyText = {
            A: 'This is my first job since 6 April and since the 6 April I have not received payments from any of the following: Jobseeker’s Allowance, Employment and Support Allowance, Incapacity Benefit.',
            B: 'Since 6 April I have had another job but I do not have a P45. And/or since the 6 April I have received payments from any of the following: Jobseeker’s Allowance, Employment and Support Allowance, Incapacity Benefit.',
            C: 'I have another job and/or I am in receipt of a State, workplace or private pension.'
          }[st];
          h += '<div class="note"><p><strong>Your answers match Statement ' + st + '.</strong> ' + esc(keyText) + '</p></div>';
        }
        if (t.loan === 'yes') {
          h += '<h2>Student loans</h2>' + UI.radios(S, errs, 'tax.q12', 'Do any of these apply to you?', [['yes', 'Yes'], ['no', 'No']], {
            inline: true,
            hint: '<ul style="margin:4px 0 0;padding-left:20px"><li>you’re still studying on a course that your student loan relates to</li>' +
              '<li>you completed or left your course after the start of the current tax year, which started on 6 April</li>' +
              '<li>you’ve already repaid your loan in full</li>' +
              '<li>you’re paying the Student Loans Company by Direct Debit from your bank to manage your end of loan repayments</li></ul>'
          });
          if (t.q12 === 'no') {
            h += UI.radios(S, errs, 'tax.plan', 'Which student loan plan are you repaying?', [
              ['1', 'Plan 1'], ['2', 'Plan 2'], ['4', 'Plan 4'], ['5', 'Plan 5'], ['none', 'None of these', 'I only have a postgraduate loan']
            ], { re: false, hint: 'Choose the one plan you are due to repay.' }) +
              UI.check(S, errs, 'tax.pg', 'I also have a postgraduate loan') +
              '<details class="small" style="margin-bottom:18px"><summary>Not sure which plan?</summary>' +
              '<p style="margin-top:8px">Check at <a href="https://www.gov.uk/sign-in-to-manage-your-student-loan-balance" target="_blank" rel="noopener">gov.uk/sign-in-to-manage-your-student-loan-balance</a>, or use this guide.</p>' +
              '<p><strong>Student Finance England:</strong> Plan 5 if your course started on or after 1 August 2023. Plan 2 if it started between 1 September 2012 and 31 July 2023. Plan 1 if it started before 1 September 2012. Postgraduate loan if studying a postgraduate masters or doctoral course.</p>' +
              '<p><strong>Student Finance Wales:</strong> Plan 2 if your course started on or after 1 September 2012. Plan 1 if it started before 1 September 2012. Postgraduate loan if studying a postgraduate masters or doctoral course.</p>' +
              '<p><strong>Student Awards Agency Scotland:</strong> Plan 4.</p><p><strong>Student Finance Northern Ireland:</strong> Plan 1.</p></details>';
          }
        }
        return h;
      },
      validate: function () {
        var e = {}, t = S.tax;
        need(e, 'tax.p45', 'Tell us whether you have a P45'); need(e, 'tax.loan', 'Tell us whether you have a student or postgraduate loan');
        if (e['tax.p45'] || e['tax.loan'] || !needChecklist()) return e;
        need(e, 'tax.sex', 'Choose male or female');
        need(e, 'tax.q8', 'Answer whether you have another job');
        if (t.q8 === 'no') need(e, 'tax.q9', 'Answer the pension question');
        if (t.q8 === 'no' && t.q9 === 'no') need(e, 'tax.q10', 'Answer the question about payments since 6 April');
        if (t.loan === 'yes') {
          need(e, 'tax.q12', 'Answer whether any of the statements apply');
          if (t.q12 === 'no') {
            need(e, 'tax.plan', 'Choose your student loan plan');
            if (t.plan === 'none' && !t.pg) e['tax.plan'] = 'Choose a plan, or tick that you have a postgraduate loan';
          }
        }
        return e;
      }
    },
    {
      id: 'contract', title: 'Your contract', next: 'Sign and continue',
      body: function () {
        var T = BF.CONTRACT;
        return '<p class="lead">Read your statement of terms, then sign at the bottom.</p>' + termsHtml() +
          '<div class="doc" style="margin-top:20px"><h2 class="doc-title">' + esc(T.title) + '</h2><p>' + UI.fillHtml(T.intro, vars) + '</p>' +
          UI.clausesHtml(T.clauses, vars) + '</div>' +
          signBox('sig.contract', 'I acknowledge receipt of this statement and confirm my agreement to the terms and conditions set out above and in the Employee Handbook.') +
          '<p class="small">If anything in the contract is wrong, do not sign. Contact ' + hrLink + ' and we will send you a corrected link.</p>';
      },
      validate: function () { var e = {}; signErr(e, 'sig.contract', 'Tick the box to confirm your agreement'); return e; },
      after: function () { stamp('sig.contract'); }
    },
    {
      id: 'optout', title: 'Working time opt-out',
      body: function () {
        var T = BF.OPTOUT, c = S.sig.optout.choice;
        return '<div class="note"><p><strong>This one is your choice.</strong> Signing is voluntary and is not a condition of your employment. You can cancel it later by giving four weeks’ notice in writing.</p></div>' +
          '<div class="doc"><h2 class="doc-title">' + esc(T.title) + '</h2>' + UI.clausesHtml(T.clauses, {}) + '</div>' +
          '<div class="signbox">' + UI.radios(S, errs, 'sig.optout.choice', 'What would you like to do?', [
            ['yes', 'I agree to opt out of the 48 hour limit'], ['no', 'I do not want to opt out', 'The 48 hour average limit will apply to you.']
          ]) + '</div>' +
          (c === 'yes' ? signBox('sig.optout', esc(T.clauses[4].items[0].t)) : '');
      },
      validate: function () {
        var e = {};
        need(e, 'sig.optout.choice', 'Choose whether to opt out');
        if (S.sig.optout.choice === 'yes') signErr(e, 'sig.optout', 'Tick the box to agree');
        return e;
      },
      after: function () { if (S.sig.optout.choice === 'yes') stamp('sig.optout'); }
    },
    {
      id: 'nda', title: 'Confidentiality agreement',
      body: function () {
        var T = BF.NDA, m = S.sig.nda.mode, name = (val('fn') + ' ' + val('sn')).trim();
        var nv = { name: name, address: BF.addressLine(S) };
        var h = '<p class="lead">This agreement is a deed, so your signature has to be witnessed by someone who is with you in person.</p>' +
          '<div class="doc"><h2 class="doc-title">' + esc(T.title) + '</h2><p><strong>PARTIES</strong></p>' +
          '<div class="cl"><span>(1)</span><p>' + esc(T.party1) + '</p></div><div class="cl"><span>(2)</span><p>' + UI.fillHtml(T.party2, nv) + '</p></div>' +
          UI.clausesHtml(T.clauses, nv) + '</div>' +
          '<div class="signbox">' + UI.radios(S, errs, 'sig.nda.mode', 'How would you like to sign?', [
            ['witness', 'My witness is with me now', 'An adult who is physically with you and can watch you sign. Not the person signing for Bar Finch.'],
            ['later', 'I will sign it in person at Bar Finch', 'Your details are filled in and you sign with a witness before your first shift.']
          ]) + '</div>';
        if (m === 'witness') {
          h += signBox('sig.nda', 'I am signing this agreement as a deed, in the presence of my witness.', 'Your signature') +
            '<div class="signbox"><h2 style="margin-top:0">Your witness</h2><p class="small">Pass this device to your witness to fill in this part.</p>' +
            UI.text(S, errs, 'sig.nda.w.addr', 'Witness address', { multiline: true }) +
            UI.text(S, errs, 'sig.nda.w.occ', 'Witness occupation', { cls: 'w-m' }) +
            UI.check(S, errs, 'sig.nda.w.agree', 'I confirm that I am with ' + esc(name) + ' in person and watched them sign this agreement.') +
            UI.text(S, errs, 'sig.nda.w.name', 'Witness: type your full name to sign', { attrs: { 'data-sig': 'sig.nda.w', autocomplete: 'off' } }) +
            '<div class="sig-preview" data-sigview="sig.nda.w" aria-hidden="true">' + esc(val('sig.nda.w.name')) + '</div></div>';
        }
        return h;
      },
      validate: function () {
        var e = {};
        need(e, 'sig.nda.mode', 'Choose how you would like to sign');
        if (S.sig.nda.mode === 'witness') {
          signErr(e, 'sig.nda', 'Tick the box to sign');
          need(e, 'sig.nda.w.addr', 'Enter the witness’s address'); need(e, 'sig.nda.w.occ', 'Enter the witness’s occupation');
          if (!UI.get(S, 'sig.nda.w.agree')) e['sig.nda.w.agree'] = 'The witness must tick the box';
          need(e, 'sig.nda.w.name', 'The witness must type their full name');
          if (!e['sig.nda.w.name'] && val('sig.nda.w.name').toLowerCase() === val('sig.nda.name').toLowerCase()) e['sig.nda.w.name'] = 'The witness must be a different person from you';
          latin(e, ['sig.nda.w.addr', 'sig.nda.w.occ', 'sig.nda.w.name']);
        }
        return e;
      },
      after: function () { if (S.sig.nda.mode === 'witness') { stamp('sig.nda'); stamp('sig.nda.w'); } }
    },
    {
      id: 'declare', title: 'Check and confirm', next: 'Create my forms',
      body: function () {
        var rt = S.rtw, kinds = { british: 'British passport', irish: 'Irish passport', cert: 'UK birth or adoption certificate', evisa: 'eVisa or other digital immigration status', euss: 'EU Settlement Scheme', other: 'Other passport or visa' };
        function sec(title, step, rows) {
          return '<div class="review-head"><h2>' + title + '</h2><button type="button" class="btn-link" data-act="goto" data-step="' + step + '">Change</button></div><dl class="review">' +
            rows.filter(function (r) { return r[1]; }).map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
        }
        var tax = [['P45', S.tax.p45 === 'yes' ? 'Yes, I will bring it' : 'No'], ['Student or postgraduate loan', S.tax.loan === 'yes' ? 'Yes' : 'No']];
        if (needChecklist()) tax.push(['Starter checklist', 'Statement ' + BF.statement(S.tax)]);
        var declare = '<div class="signbox"><h2 style="margin-top:0">Declaration</h2>' +
          UI.check(S, errs, 'sig.decl.agree', 'I confirm that the information given on this form is correct and complete, and I will tell the HR Department of any change to it. The Company will use this information for payroll, HR administration, and right to work checks, and will hold it in accordance with its privacy notice.' +
            (needChecklist() ? ' I also confirm that the information I’ve given on the HMRC starter checklist is correct.' : '')) +
          UI.text(S, errs, 'sig.decl.name', 'Type your full name to sign', { attrs: { autocomplete: 'name', 'data-sig': 'sig.decl' } }) +
          '<div class="sig-preview" data-sigview="sig.decl" aria-hidden="true">' + esc(val('sig.decl.name')) + '</div></div>';
        return '<p class="lead">Check your answers before your forms are created.</p>' +
          sec('Your details', 1, [['Name', [S.title === 'Other' ? S.titleOther : S.title, S.fn, S.sn].join(' ')], ['Address', BF.addressLine(S)], ['Date of birth', BF.dateLong(S.dob)],
            ['Nationality', S.nat], ['National Insurance number', S.ni || 'Not yet issued'], ['Mobile', S.mob], ['Email', S.email]]) +
          sec('Emergency contact', 2, [['Name', S.ec.fn + ' ' + S.ec.sn], ['Relationship', S.ec.rel], ['Contact number', S.ec.tel]]) +
          sec('Bank details', 3, [['Bank', S.bank.name], ['Account name', S.bank.acc], ['Sort code', S.bank.sort], ['Account number', S.bank.no]]) +
          sec('Right to work', 4, [['Shown by', kinds[rt.kind]], ['Expiry date', (rt.kind === 'british' || rt.kind === 'irish' || rt.kind === 'other') ? BF.dateLong(rt.exp) : ''],
            ['Share code', (rt.kind === 'evisa' || rt.kind === 'euss') ? rt.share : ''], ['Other document', rt.otherDoc]]) +
          sec('Tax', 5, tax) +
          sec('Signed so far', 6, [['Contract', 'Signed ' + BF.dateTime(S.sig.contract.at)],
            ['Working time opt-out', S.sig.optout.choice === 'yes' ? 'Signed ' + BF.dateTime(S.sig.optout.at) : 'Not opted out'],
            ['Confidentiality agreement', S.sig.nda.mode === 'witness' ? 'Signed and witnessed ' + BF.dateTime(S.sig.nda.at) : 'To sign in person at Bar Finch']]) +
          declare;
      },
      validate: function () { var e = {}; signErr(e, 'sig.decl', 'Tick the box to confirm'); return e; },
      after: function () { stamp('sig.decl'); }
    },
    { id: 'done', title: 'Your forms are ready', body: doneBody, validate: function () { return {}; } }
  ];
  var LAST = STEPS.length - 1;

  /* a draft can only resume as far as the steps that are still valid */
  function firstInvalid(upTo) {
    for (var i = 1; i < upTo; i++) if (Object.keys(STEPS[i].validate()).length) return i;
    return -1;
  }

  /* ---------- finished pack ---------- */
  function buildPack() {
    packError = '';
    try { pack = BF.buildPack(offer, S); }
    catch (e) { pack = null; packError = String(e && e.message || e); }
  }
  function payload() {
    return {
      app: 'bar-finch-new-starter', version: 1, ref: offer.ref, submittedAt: BF.nowLocal(),
      employee: { forenames: S.fn, surname: S.sn, email: S.email, mobile: S.mob },
      jobTitle: offer.job, startDate: offer.start,
      files: pack.map(function (f) { return { name: f.name, type: 'application/pdf', base64: BF.bytesToB64(f.bytes) }; })
    };
  }
  function send() {
    if (!offer.post || !pack) return;
    sendState = 'sending'; render();
    fetch(offer.post, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(payload()) })
      .then(function (res) { sendState = res.ok ? 'ok' : 'failed'; }, function () { sendState = 'unknown'; })
      .then(function () { S._sent = sendState; save(); render(); });
  }
  function shareFiles() {
    return pack.map(function (f) { return new File([f.bytes], f.name, { type: 'application/pdf' }); });
  }
  function canShare() {
    try { return !!(navigator.canShare && pack && navigator.canShare({ files: shareFiles() })); } catch (e) { return false; }
  }
  function doneBody() {
    if (packError) return '<div class="note bad"><p><strong>Your forms could not be created on this device.</strong> Nothing has been lost. Try again, or open your link in a different browser.</p><p class="small">' + esc(packError) + '</p></div>' +
      '<div class="actions"><button type="button" class="btn-primary" data-act="retry">Try again</button></div>';
    var name = (S.fn + ' ' + S.sn).trim(), h = '';
    var subject = 'New starter forms: ' + name + ' (ref ' + offer.ref + ')';
    if (offer.post) {
      if (sendState === 'sending') h += '<div class="note"><p>Sending your forms to Bar Finch…</p></div>';
      else if (sendState === 'ok') h += '<div class="note"><p><strong>Your forms have been sent to Bar Finch.</strong> Download a copy for yourself below.</p></div>';
      else if (sendState) h += '<div class="note warn"><p><strong>We could not confirm that your forms reached Bar Finch.</strong> Please also send them yourself using the steps below.</p>' +
        '<p><button type="button" class="btn-link" data-act="resend">Try sending again</button></p></div>';
    }
    h += '<p class="lead">' + (sendState === 'ok' ? 'Keep these for your records.' : 'Download your forms, then send them to Bar Finch.') + '</p><ul class="files">';
    pack.forEach(function (f, i) {
      h += '<li><span class="fname">' + esc(f.label) + (f.note ? '<span class="fnote">' + esc(f.note) + '</span>' : '') + '</span>' +
        '<button type="button" class="btn-plain" data-act="file" data-i="' + i + '">Download</button></li>';
    });
    h += '</ul><div class="actions"><button type="button" class="btn-primary" data-act="zip">Download all my forms</button></div>';
    if (sendState !== 'ok') {
      h += '<h2>Send them to Bar Finch</h2>';
      if (canShare()) h += '<p>Send all your forms in one go from this device' + (HR ? ' to <strong>' + esc(HR) + '</strong>' : '') + '.</p>' +
        '<div class="actions"><button type="button" class="btn-primary" data-act="share">Send my forms</button></div><p class="small" style="margin-top:10px">Choose your email app, then check the address before you send.</p>';
      else h += '<p>Download all your forms, then email the downloaded file to ' + (HR ? '<strong>' + esc(HR) + '</strong>' : 'your manager') + '.</p>' +
        (HR ? '<div class="actions"><a class="btn btn-plain" href="mailto:' + esc(HR) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent('My new starter forms are attached.\n\n' + name) + '">Start an email to Bar Finch</a></div><p class="small" style="margin-top:10px">Remember to attach the downloaded file.</p>' : '');
    }
    var todo = ['Bring your original right to work document' + ((S.rtw.kind === 'evisa' || S.rtw.kind === 'euss') ? ', or have your share code ready' : '') + ', before your first shift.'];
    if (S.tax.p45 === 'yes') todo.push('Bring parts 2 and 3 of your P45.');
    if (S.sig.nda.mode !== 'witness') todo.push('You will sign the confidentiality agreement in person with a witness.');
    h += '<h2>Before your first shift</h2><ul>' + todo.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="small">Reference ' + esc(offer.ref) + '. Your answers are still held in this browser tab. Closing the tab removes them, or you can remove them now.</p>' +
      '<div class="actions"><button type="button" class="btn-plain" data-act="back">Go back and change something</button><button type="button" class="btn-plain" data-act="clear">Remove my details from this device</button></div>';
    return h;
  }

  /* ---------- drawing the page ---------- */
  function render(focus) {
    var st = STEPS[ix], title = typeof st.title === 'function' ? st.title() : st.title;
    var h = logo;
    if (ix > 0 && ix < LAST) h += '<div class="progress"><div class="progress-text">Step ' + ix + ' of ' + (LAST - 1) + '</div><div class="progress-bar"><span style="width:' + Math.round(ix / (LAST - 1) * 100) + '%"></span></div></div>';
    h += '<div class="sheet"><h1 tabindex="-1" id="top">' + esc(title) + '</h1>' + UI.errorSummary(errs) + st.body() + '</div>';
    if (ix < LAST) h += '<div class="navbar"><div class="navbar-in">' + (ix > 0 ? '<button type="button" class="btn-plain" data-act="back">Back</button>' : '') +
      '<button type="button" class="btn-primary" data-act="next">' + esc(st.next || 'Continue') + '</button></div></div>';
    app.innerHTML = h;
    document.title = title + ' | Bar Finch new starter forms';
    if (focus) { window.scrollTo(0, 0); var top = document.getElementById('top'); if (top) top.focus({ preventScroll: true }); }
  }
  function go(n) {
    ix = n; errs = {}; S._step = n; save();
    if (ix === LAST) {
      buildPack(); sendState = S._sent || ''; render(true);
      if (pack && offer.post && S._sent !== 'ok') send();
    } else render(true);
  }
  function next() {
    var st = STEPS[ix];
    errs = st.validate();
    if (Object.keys(errs).length) {
      save(); render();
      var box = app.querySelector('.errors');
      if (box) { box.scrollIntoView({ block: 'start' }); var a = box.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
      return;
    }
    if (st.after) st.after();
    go(ix + 1);
  }

  app.addEventListener('input', function (ev) {
    UI.handle(ev, S); save();
    UI.clearError(errs, ev.target);
    var sig = ev.target.getAttribute && ev.target.getAttribute('data-sig');
    if (sig) { var v = app.querySelector('[data-sigview="' + sig + '"]'); if (v) v.textContent = ev.target.value; }
  });
  app.addEventListener('change', function (ev) {
    var el = ev.target, redraw = UI.handle(ev, S);
    save();
    UI.clearError(errs, el);
    if (!redraw) return;
    var idNow = el.id, y = window.scrollY;
    render();
    window.scrollTo(0, y);
    var again = document.getElementById(idNow);
    if (again) again.focus({ preventScroll: true });
  });
  app.addEventListener('click', function (ev) {
    var jump = ev.target.closest && ev.target.closest('[data-jump]');
    if (jump) { ev.preventDefault(); UI.jump(jump.getAttribute('data-jump')); return; }
    var b = ev.target.closest && ev.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'next') next();
    else if (act === 'back') {
      if (ix === LAST) { S._sent = ''; sendState = ''; }   // anything changed after this point is sent again
      go(Math.max(0, ix - 1));
    }
    else if (act === 'goto') go(+b.getAttribute('data-step'));
    else if (act === 'retry') go(LAST);
    else if (act === 'file') { var f = pack[+b.getAttribute('data-i')]; UI.download(f.name, f.bytes); }
    else if (act === 'zip') UI.download(BF.packName(offer, S) + '.zip', BF.zip(pack), 'application/zip');
    else if (act === 'resend') send();
    else if (act === 'share') {
      navigator.share({ files: shareFiles(), title: 'New starter forms: ' + S.fn + ' ' + S.sn, text: 'New starter forms for ' + S.fn + ' ' + S.sn + ' (ref ' + offer.ref + ').' + (HR ? ' Send to ' + HR : '') })
        .catch(function () { /* closed without sending */ });
    } else if (act === 'clear') {
      try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing stored */ }
      pack = null;
      app.innerHTML = logo + '<div class="sheet"><h1>Your details have been removed from this device</h1><p>You can close this page. If you still need to send your forms, open your link again.</p></div>';
    }
  });

  /* resume a draft, but never past a step that is no longer complete */
  if (ix > 0) { var bad = firstInvalid(Math.min(ix, LAST)); if (bad > 0) ix = bad; }
  if (ix === LAST) go(LAST); else render();
  }
})();
