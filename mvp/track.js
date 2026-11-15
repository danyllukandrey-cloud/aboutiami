/* AboutIAmI MVP — аналітика відвідувань.
   Пише в Google Таблицю (аркуш «Аналітика MVP»): хто зайшов, які розділи відкривав, скільки там був, що натискав.
   Імен не збирає: відвідувач — це випадковий номер у його браузері. Хто саме — видно лише з мітки в посиланні (?to=...). */
(function () {
  'use strict';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwK3n_kcmtVz4meZ-8Hw1JNX2TWKXMJi_lQ8Pqp0Q7HlGuV0cG11Cv0HiQI3QVtG9zjYw/exec';
  var MAX_EVENTS = 400;      // стеля на один візит
  var FLUSH_MS = 15000;

  function rid() { return Math.random().toString(36).slice(2, 10); }
  var visitor;
  try {
    visitor = localStorage.getItem('aia_visitor');
    if (!visitor) { visitor = rid(); localStorage.setItem('aia_visitor', visitor); }
  } catch (e) { visitor = 'x-' + rid(); }
  var session = rid();
  var tag = '';
  try { tag = (new URLSearchParams(location.search).get('to') || '').slice(0, 60); } catch (e) {}
  var device = (window.innerWidth < 700 ? 'телефон' : 'комп’ютер') + ' ' + window.innerWidth + '×' + window.innerHeight;

  var queue = [], total = 0;
  var page = location.hash || '#', since = Date.now(), visible = true;

  function add(e, d, s) {
    if (total >= MAX_EVENTS) return;
    total++;
    queue.push({ t: new Date().toISOString(), e: e, d: String(d || '').slice(0, 160), p: page, s: s == null ? '' : s });
  }
  function secs() { return Math.round((Date.now() - since) / 1000); }

  function flush(leaving) {
    if (!queue.length) return;
    var body = JSON.stringify({ type: 'events', visitor: visitor, session: session, tag: tag, device: device, events: queue });
    queue = [];
    try {
      if (leaving && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=utf-8' }));
      } else {
        fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body }).catch(function () {});
      }
    } catch (e) {}
  }

  add('відкрив', document.referrer ? 'звідки: ' + document.referrer : 'пряме посилання');

  window.addEventListener('hashchange', function () {
    add('був у розділі', '', secs());
    page = location.hash || '#';
    since = Date.now();
    add('перейшов у розділ', '');
  });

  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('a,button,[data-act],summary') : null;
    if (!el) return;
    var label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    var act = el.getAttribute('data-act');
    add('натиснув', (label || '(без підпису)') + (act ? ' [' + act + ']' : ''));
  }, true);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      visible = false;
      add('пішов або згорнув', '', secs());
      flush(true);
    } else if (!visible) {
      visible = true;
      since = Date.now();
      add('повернувся', '');
    }
  });
  window.addEventListener('pagehide', function () { flush(true); });
  setInterval(function () { if (visible) flush(false); }, FLUSH_MS);
  setTimeout(function () { flush(false); }, 3000);
})();
