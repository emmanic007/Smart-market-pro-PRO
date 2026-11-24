/* ═══════════════ ICONS — remplace les emojis par des icônes vectorielles sobres ═══════════════ */
(function () {
  'use strict';
  var P = {
    check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12',
    alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    chart: 'M3 3v18h18M7 16v-5M12 16V7M17 16v-8', trend: 'M3 17l6-6 4 4 8-8M15 7h6v6', trenddown: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
    box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
    card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20',
    spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
    printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
    pencil: 'M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z',
    bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z',
    cart: 'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
    cash: 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01',
    bank: 'M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M12 3 3 8h18z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    palette: 'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.7 4.7 0 0 0 22 11c0-5-4.5-9-10-9zM7.5 11h.01M10 7h.01M15 7h.01',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
    chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    store: 'M3 9l1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 21V12M19 21V12M3 21h18',
    home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
    key: 'M7.5 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    award: 'M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM15.5 13.5 17 22l-5-3-5 3 1.5-8.5',
    phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
    undo: 'M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
    truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
    star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z',
    swap: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
    cloud: 'M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
    pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2'
  };
  var M = {};
  function m(chars, icon, cls) { chars.split(' ').forEach(function (c) { M[c] = [icon, cls || '']; }); }
  m('✅ ✓ ✔', 'check'); m('❌ ✕', 'x'); m('⚠ 🚨', 'alert'); m('❓', 'help'); m('📊', 'chart'); m('📈', 'trend'); m('📉', 'trenddown');
  m('📦', 'box'); m('💾', 'save'); m('💳', 'card'); m('🤖 🔮 ✨', 'spark'); m('🧾 📋 📒 📖 📄', 'file'); m('📂 📁', 'folder');
  m('🔍', 'search'); m('🖨', 'printer'); m('✏', 'pencil'); m('💡', 'bulb'); m('🛒', 'cart'); m('💸 💰 💵 💱', 'cash'); m('🏦', 'bank');
  m('👥', 'users'); m('👤', 'user'); m('🎨', 'palette'); m('🕐 ⏳', 'clock'); m('📥', 'download'); m('📤', 'upload');
  m('📅 📆 🗓', 'calendar'); m('💬 📣', 'chat'); m('🔧', 'wrench'); m('⚙', 'sliders'); m('🏪 🏭', 'store'); m('🏠', 'home');
  m('🔐 🔒', 'lock'); m('🔑', 'key'); m('🎯', 'target'); m('🏆 🏅 👑', 'award'); m('🥇', 'award', 'ic-gold'); m('🥈', 'award', 'ic-silver');
  m('🥉', 'award', 'ic-bronze'); m('📱 📲 📞', 'phone'); m('🌙', 'moon'); m('☀', 'sun'); m('⚡ 🔥 🔌', 'bolt'); m('🗑 🧹', 'trash');
  m('🌍', 'globe'); m('🔄', 'refresh'); m('🏷', 'tag'); m('↩', 'undo'); m('🚚 🚗', 'truck'); m('🔔', 'bell'); m('⏏', 'logout');
  m('📜', 'history'); m('🔀', 'swap'); m('☁', 'cloud'); m('⏸', 'pause'); m('🔢', 'hash'); m('⭐', 'star');
  m('🔴', 'dot', 'dot-red'); m('🟡', 'dot', 'dot-yellow'); m('🟢', 'dot', 'dot-green');
  m('🚀 🎉 👋 📌 🎁', '');   // purement décoratifs : supprimés
  var keys = Object.keys(M).sort(function (a, b) { return b.length - a.length; });
  var RX = new RegExp('(' + keys.join('|') + ')\\uFE0F?', 'g'), TEST = new RegExp(keys.join('|'));
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, svg: 1, CANVAS: 1 }, STRIP = { OPTION: 1, TEXTAREA: 1, TITLE: 1, INPUT: 1 };

  // Sprite
  var sp = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' +
    Object.keys(P).map(function (k) { return '<symbol id="ic-' + k + '" viewBox="0 0 24 24"><path d="' + P[k] + '"/></symbol>'; }).join('') + '</svg>';
  function mount() { if (!document.getElementById('ic-sprite')) { var d = document.createElement('div'); d.id = 'ic-sprite'; d.style.display = 'none'; d.innerHTML = sp; document.body.insertBefore(d, document.body.firstChild); } }

  function stripText(s) { return s.replace(RX, '').replace(/^ +| +$/g, function (x, o) { return o === 0 ? '' : x; }).replace(/ {2,}/g, ' '); }
  function make(ent) {
    if (ent[0] === 'dot') { var s = document.createElement('span'); s.className = 'ic-dot ' + ent[1]; return s; }
    var ns = 'http://www.w3.org/2000/svg', v = document.createElementNS(ns, 'svg');
    v.setAttribute('class', 'ic ' + ent[1]); v.setAttribute('viewBox', '0 0 24 24'); v.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use'); u.setAttribute('href', '#ic-' + ent[0]); v.appendChild(u); return v;
  }
  function convertText(n) {
    var s = n.nodeValue; if (!s || !TEST.test(s)) return;
    var p = n.parentNode; if (!p || SKIP[p.nodeName]) return;
    if (STRIP[p.nodeName]) { n.nodeValue = stripText(s); return; }
    var f = document.createDocumentFragment(), last = 0, mt; RX.lastIndex = 0;
    while ((mt = RX.exec(s))) {
      if (mt.index > last) f.appendChild(document.createTextNode(s.slice(last, mt.index)));
      var ent = M[mt[1]];
      if (ent[0]) f.appendChild(make(ent)); else if (s[RX.lastIndex] === ' ') RX.lastIndex++;
      last = RX.lastIndex;
    }
    if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
    p.replaceChild(f, n);
  }
  var ATTR = ['placeholder', 'title', 'aria-label'];
  function fixAttrs(el) { ATTR.forEach(function (a) { var v = el.getAttribute && el.getAttribute(a); if (v && TEST.test(v)) el.setAttribute(a, stripText(v)); }); }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) return convertText(root);
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, 4), a = [], n; while ((n = w.nextNode())) { if (TEST.test(n.nodeValue)) a.push(n); }
    a.forEach(convertText);
    fixAttrs(root); root.querySelectorAll && root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(fixAttrs);
  }
  function start() {
    mount(); scan(document.body);
    if (TEST.test(document.title)) document.title = stripText(document.title);
    new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        if (r.type === 'childList') r.addedNodes.forEach(scan);
        else if (r.type === 'characterData') convertText(r.target);
        else if (r.type === 'attributes') fixAttrs(r.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
