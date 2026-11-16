'use strict';
/* Sync — synchronisation hors ligne d'abord.
   - L'app écrit toujours sur l'appareil (DB.save). Sync détecte ce qui a changé et l'envoie au cloud dès que possible.
   - Elle récupère aussi les changements faits ailleurs (autre téléphone, autre vendeur).
   - Conflit sur un même enregistrement : la modification la plus récente envoyée gagne.
   Données synchronisées : produits, ventes, dépenses, retours, fournisseurs + réglages (catégories,
   fidélité, commissions payées, fond de caisse, objectifs). Les comptes PIN restent locaux pour l'instant. */
const Sync = {
  ARR: ['items', 'sales', 'expenses', 'returns', 'suppliers'],
  META: ['categories', 'loyalty', 'commissionsPaid', 'cashInit', 'dailyObjective', 'monthlyObjective'],
  c: null, shop: null, store: null, sub: null,
  state: 'off', _started: false, _running: false, _again: false, _applying: false,
  _timer: null, _blocked: false, _hideT: null,

  /* ---------- Démarrage ---------- */
  start() {
    const C = CloudAuth;
    if (this._started || !C.client || !C.ctx || !C.ctx.shopId) return;
    this.c = C.client; this.shop = C.ctx.shopId;
    if (DB.data.shopId && DB.data.shopId !== this.shop) { this._set('foreign'); return; }  // données d'une autre boutique sur l'appareil
    if (!DB.data.shopId) { DB.data.shopId = this.shop; this._rawSave(); }
    this._started = true;
    this._load();
    const o = DB.save.bind(DB);                      // chaque DB.save() programme une synchro
    this._orig = o;
    DB.save = () => { o(); if (!this._applying) this.schedule(); };
    const el = document.getElementById('sync-indicator');
    if (el) el.onclick = () => this.now();
    window.addEventListener('online', () => this.schedule(500));
    window.addEventListener('offline', () => this._set('offline'));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.schedule(500); });
    let tick = 0;                                    // vérification de secours : toutes les 30 s si le direct ne marche pas, sinon 90 s
    setInterval(() => {
      tick++;
      if (document.visibilityState === 'visible' && tick % (this.rt === 'SUBSCRIBED' ? 6 : 2) === 0) this.schedule(0);
    }, 15000);
    this.c.auth.getSession().then(() => this._listen(), () => this._listen());   // le direct démarre quand la session est prête
    this.now();
  },
  _listen() {
    try {
      this.c.channel('rec-' + this.shop)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'shop_id=eq.' + this.shop }, () => this.schedule(500))
        .subscribe(st => { this.rt = st; });
    } catch (e) { this.rt = 'ERROR'; }
  },
  _rawSave() { try { localStorage.setItem(DB.KEY, JSON.stringify(DB.data)); } catch (e) {} },
  ready() { return !!(this._started && this.c && this.shop); },
  schedule(ms) { clearTimeout(this._timer); this._timer = setTimeout(() => this.now(), ms === undefined ? 1200 : ms); },

  /* ---------- Outils ---------- */
  _load() { try { this.store = JSON.parse(localStorage.getItem('SMP_SYNC_' + this.shop) || 'null'); } catch (e) {} if (!this.store) this.store = { pull: null, h: {} };
    const st = this.store; st.q = st.q || {}; st.pend = st.pend || []; st.orph = st.orph || {}; },
  _save() { try { localStorage.setItem('SMP_SYNC_' + this.shop, JSON.stringify(this.store)); } catch (e) {} },
  _canon(v) {          // écriture stable (ordre des clés indifférent) pour comparer deux enregistrements
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(x => this._canon(x)).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + this._canon(v[k])).join(',') + '}';
  },
  _h(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  },
  _r(n) { return Math.round(n * 1e6) / 1e6; },
  _proj(kind, r) {      // la quantité en stock voyage sous forme de mouvements, jamais comme un champ du produit
    if (kind !== 'items' || !r) return r;
    const o = {}; for (const k in r) if (k !== 'qty') o[k] = r[k];
    return o;
  },
  _snapshot() {
    const out = {};
    this.ARR.forEach(k => (DB.data[k] || []).forEach(r => { if (r && r.id != null) out[k + ':' + r.id] = { kind: k, id: String(r.id), data: this._proj(k, r) }; }));
    this.META.forEach(k => { if (DB.data[k] !== undefined) out['meta:' + k] = { kind: 'meta', id: k, data: { v: DB.data[k] } }; });
    return out;
  },
  _canPush(kind, id) {   // le vendeur n'écrit que produits, ses ventes et la fidélité (le serveur le vérifie aussi)
    const r = CloudAuth.ctx && CloudAuth.ctx.role;
    return r !== 'seller' || kind === 'items' || kind === 'sales' || (kind === 'meta' && id === 'loyalty');
  },
  _diff() {
    const snap = this._snapshot(), h = this.store.h, rej = this.store.rej || (this.store.rej = {}), up = [], dels = [];
    const seller = CloudAuth.ctx && CloudAuth.ctx.role === 'seller';
    for (const k in snap) {
      const e = snap[k];
      if (!this._canPush(e.kind, e.id)) continue;
      const hh = this._h(this._canon(e.data));
      if (h[k] !== hh && rej[k] !== hh) up.push({ k, hh, row: { shop_id: this.shop, kind: e.kind, id: e.id, data: e.data, deleted: false } });
    }
    if (!seller) for (const k in h) if (!(k in snap) && k.indexOf('meta:') !== 0 && k.indexOf('stock:') !== 0 && rej[k] !== 'del') {
      const p = k.indexOf(':');
      dels.push({ k, del: true, row: { shop_id: this.shop, kind: k.slice(0, p), id: k.slice(p + 1), data: {}, deleted: true } });
    }
    return { up, dels };
  },
  pendingCount() {
    if (!this.store) return 0;
    this._account();
    const d = this._diff(), rej = this.store.rej || {};
    return d.up.length + d.dels.length + this.store.pend.filter(m => !rej['stock:' + m.id]).length;
  },

  /* ---------- Cycle de synchronisation ---------- */
  async now() {
    if (!this.ready()) return;
    if (this._running) { this._again = true; return; }
    if (!navigator.onLine) return this._set('offline');
    this._running = true; this._set('syncing');
    try {
      const changed = await this._pull();
      await this._fetchSub();
      if (!this._blocked) await this._push();
      this._save();
      this._set(this._blocked ? 'blocked' : 'idle');
      if (typeof Billing !== 'undefined') Billing.onStatus();
      if (changed) this._refreshUI();
      if (!this._teamDone && (typeof CloudTeam !== 'undefined') && CloudAuth.ctx && CloudAuth.ctx.role !== 'seller') { this._teamDone = true; CloudTeam.fetch().catch(() => {}); }
    } catch (e) { this._onErr(e); }
    this._running = false;
    if (this._again) { this._again = false; this.schedule(1500); }
  },
  _onErr(e) {
    const m = String((e && (e.message || e.details)) || e), code = e && e.code;
    console.warn('[Sync]', e);
    if (code === '42501' || /row-level security|permission denied/i.test(m)) { this._blocked = true; return this._set('blocked'); }
    if ((e && e.status === 401) || /jwt|not authenticated|refresh token/i.test(m)) { CloudAuth.needsRelogin = true; return this._set('auth'); }
    if (!navigator.onLine || /fetch|network/i.test(m)) return this._set('offline');
    this._set('error'); this.schedule(30000);
  },
  async _fetchSub() {
    const { data } = await this.c.from('subscriptions').select('plan,status,trial_ends_at,current_period_end').eq('shop_id', this.shop).maybeSingle();
    if (!data) return;
    this.sub = data;
    const now = Date.now();
    this._blocked = !((data.status === 'trialing' && new Date(data.trial_ends_at) > now) ||
                      (data.status === 'active' && (!data.current_period_end || new Date(data.current_period_end) > now)));
  },

  /* ---------- Réception ---------- */
  async _pull() {
    const first = !this.store.pull, PAGE = 1000, idx = {}, del = {};
    let from = 0, maxTs = this.store.pull, changed = false;
    for (;;) {
      let q = this.c.from('records').select('kind,id,data,deleted,updated_at').eq('shop_id', this.shop)
        .order('updated_at', { ascending: true }).order('kind').order('id').range(from, from + PAGE - 1);
      if (this.store.pull) q = q.gte('updated_at', this.store.pull);
      const { data, error } = await q;
      if (error) throw error;
      this._applying = true;
      for (const r of data) {
        if (this._apply(r, first, idx, del)) changed = true;
        if (!maxTs || r.updated_at > maxTs) maxTs = r.updated_at;
      }
      this._applying = false;
      if (data.length < PAGE) break;
      from += PAGE;
    }
    for (const k in del) { const ids = del[k]; if (ids.size) DB.data[k] = DB.data[k].filter(r => !ids.has(String(r.id))); }
    this.store.pull = maxTs;
    if (this._drainAll()) changed = true;
    if (changed) { this._applying = true; this._orig(); this._applying = false; }
    return changed;
  },
  _ensureIdx(kind, idx, del) {
    if (!idx[kind]) { idx[kind] = new Map(); (DB.data[kind] || (DB.data[kind] = [])).forEach((r, i) => idx[kind].set(String(r.id), i)); del[kind] = new Set(); }
  },
  _apply(rec, first, idx, del) {
    if (rec.kind === 'stock') return this._applyMove(rec, idx, del);
    const isMeta = rec.kind === 'meta', key = (isMeta ? 'meta:' : rec.kind + ':') + rec.id, h = this.store.h;
    if (!isMeta && this.ARR.indexOf(rec.kind) < 0) return false;
    if (isMeta && this.META.indexOf(rec.id) < 0) return false;
    if (!isMeta) this._ensureIdx(rec.kind, idx, del);
    const pos = isMeta ? undefined : idx[rec.kind].get(rec.id);
    const exists = isMeta ? DB.data[rec.id] !== undefined : pos !== undefined && !del[rec.kind].has(rec.id);
    const data = rec.deleted ? null : this._proj(rec.kind, rec.data);
    const hr = rec.deleted ? 'del' : this._h(this._canon(data));
    if (h[key] === hr) return false;                                  // déjà à jour
    if (rec.deleted && !exists) { delete h[key]; return false; }
    if (exists && !first) {                                           // modification locale en attente ? elle gagne
      const cur = isMeta ? { v: DB.data[rec.id] } : this._proj(rec.kind, DB.data[rec.kind][pos]);
      if (this._h(this._canon(cur)) !== h[key]) return false;
    }
    if (rec.deleted) {
      del[rec.kind].add(rec.id); delete h[key];
      if (rec.kind === 'items') { delete this.store.q[rec.id]; delete this.store.orph[rec.id]; }
      return true;
    }
    if (isMeta) DB.data[rec.id] = rec.data.v;
    else if (pos !== undefined) {
      DB.data[rec.kind][pos] = Object.assign({}, data, rec.kind === 'items' ? { qty: DB.data.items[pos].qty } : {});
      del[rec.kind].delete(rec.id);
    } else {
      DB.data[rec.kind].push(rec.kind === 'items' ? Object.assign({}, data, { qty: 0 }) : data);
      idx[rec.kind].set(rec.id, DB.data[rec.kind].length - 1);
      if (rec.kind === 'items') this.store.q[rec.id] = 0;             // produit reçu : son stock viendra des mouvements
    }
    h[key] = hr;
    return true;
  },

  /* ---------- Stock : mouvements (+/-) au lieu d'une quantité écrasée ---------- */
  _applyMove(rec, idx, del) {
    const h = this.store.h, key = 'stock:' + rec.id;
    if (h[key]) return false;                                         // déjà compté (créé ici, ou déjà reçu)
    const d = rec.data || {}, id = String(d.i), delta = Number(d.d) || 0, init = String(rec.id).indexOf('init_') === 0;
    h[key] = '1';
    this._ensureIdx('items', idx, del);
    const pos = idx.items.get(id);
    if (pos === undefined || del.items.has(id)) {
      if (h['items:' + id]) return false;                             // produit supprimé sur cet appareil : on ignore
      this._hold(id, delta); return false;                            // produit pas encore reçu : on garde le mouvement
    }
    return this._add(id, pos, delta, init);
  },
  _hold(id, d) { (this.store.orph[id] = this.store.orph[id] || []).push({ d }); },
  _add(id, pos, delta, init) {
    const q = this.store.q, it = DB.data.items[pos];
    if (q[id] === undefined) {
      if (init) { it.qty = this._r(delta); q[id] = it.qty; return true; }   // produit déjà ici avant la mise à jour : on adopte le stock du cloud
      this._hold(id, delta); return false;                                 // on attend d'avoir enregistré notre propre stock
    }
    it.qty = this._r((Number(it.qty) || 0) + delta); q[id] = this._r(q[id] + delta);
    return true;
  },
  _drainAll() {
    const orph = this.store.orph, q = this.store.q; let ch = false;
    for (const id of Object.keys(orph)) {
      const pos = DB.data.items.findIndex(r => String(r.id) === id);
      if (pos < 0 || q[id] === undefined) continue;
      orph[id].forEach(m => { const it = DB.data.items[pos]; it.qty = this._r((Number(it.qty) || 0) + m.d); q[id] = this._r(q[id] + m.d); });
      delete orph[id]; ch = true;
    }
    return ch;
  },
  _account() {          // compare le stock de chaque produit à ce qui est déjà enregistré : l'écart devient un mouvement
    const q = this.store.q, pend = this.store.pend, uid = (CloudAuth.ctx && CloudAuth.ctx.userId) || null, now = Date.now(), present = new Set();
    let n = 0;
    for (const it of DB.data.items || []) {
      if (it.id == null) continue;
      const id = String(it.id), cur = this._r(Number(it.qty) || 0);
      present.add(id);
      if (q[id] === undefined) { pend.push({ id: 'init_' + id, i: id, d: cur, t: now, u: uid }); q[id] = cur; n++; }
      else if (Math.abs(cur - q[id]) > 1e-9) { pend.push({ id: 'm' + Utils.uid(), i: id, d: this._r(cur - q[id]), t: now, u: uid }); q[id] = cur; n++; }
    }
    for (const id of Object.keys(q)) if (!present.has(id)) delete q[id];
    return n;
  },

  /* ---------- Envoi ---------- */
  async _upsertRows(part) {     // renvoie les lignes refusées par le serveur (droits), sans bloquer les autres
    const { error } = await this.c.from('records').upsert(part.map(x => x.row), { onConflict: 'shop_id,kind,id' });
    if (!error) return [];
    if (error.code === '42501') {
      await this._fetchSub();
      if (this._blocked) throw error;                       // abonnement expiré : on arrête tout
      if (part.length === 1) return part;
      let rej = [];
      for (const x of part) rej = rej.concat(await this._upsertRows([x]));
      return rej;
    }
    throw error;
  },
  async _push() {
    const h = this.store.h, rejStore = this.store.rej || (this.store.rej = {});
    this._account();
    if (this._drainAll()) { this._applying = true; this._orig(); this._applying = false; }
    const { up, dels } = this._diff();
    const base = Object.keys(h).filter(k => k.indexOf('stock:') !== 0).length;
    if (dels.length > 20 && dels.length > base * 0.5) {   // garde-fou : disparition massive
      if (!confirm(dels.length + ' éléments ont disparu de cet appareil.\nLes supprimer aussi du cloud ?\n\nOK = supprimer partout\nAnnuler = les récupérer depuis le cloud')) {
        dels.forEach(d => delete h[d.k]); this.store.pull = null; dels.length = 0; this.schedule(500);
      }
    }
    const mv = this.store.pend.filter(m => !rejStore['stock:' + m.id]).map(m => ({ k: 'stock:' + m.id, hh: '1', mv: m.id,
      row: { shop_id: this.shop, kind: 'stock', id: m.id, data: { i: m.i, d: m.d, t: m.t, u: m.u }, deleted: false } }));
    const rows = up.concat(dels, mv);
    for (let i = 0; i < rows.length; i += 200) {
      const part = rows.slice(i, i + 200);
      const refused = new Set((await this._upsertRows(part)).map(x => x.k));
      part.forEach(x => {
        if (refused.has(x.k)) rejStore[x.k] = x.del ? 'del' : x.hh;
        else {
          delete rejStore[x.k];
          if (x.mv) { h[x.k] = '1'; this.store.pend = this.store.pend.filter(p => p.id !== x.mv); }
          else if (x.del) delete h[x.k]; else h[x.k] = x.hh;
        }
      });
      this._save();
    }
  },

  /* ---------- Affichage ---------- */
  _shown(id) { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; },
  _refreshUI() {        // remet l'écran à jour sans effacer ce que la personne est en train de saisir
    try {
      let overlay = false;
      if (this._shown('seller-mode-overlay') && typeof SellerMode !== 'undefined') {          // caisse vendeur : produits et stock
        const g = document.getElementById('sm-products-grid'), sc = g ? g.scrollTop : 0;
        SellerMode.renderProducts(); if (g) g.scrollTop = sc; overlay = true;
      }
      if (this._shown('seller-dash-overlay') && typeof SellerDash !== 'undefined') { SellerDash.refresh(); overlay = true; }
      if (overlay || !Auth.currentUser || this._shown('deferred-overlay')) return;
      const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
      if (UI._currentTab === 'sales') return this._refreshSales();
      if (!typing) UI.switchTab(UI._currentTab, true);
    } catch (e) {}
  },
  _refreshSales() {     // écran de vente : met à jour les stocks affichés sans toucher à la saisie en cours
    const sec = document.getElementById('sales');
    const keep = sec ? [...sec.querySelectorAll('input,textarea,select')].filter(e => e.id).map(e => [e.id, e.type === 'checkbox' ? e.checked : e.value]) : [];
    UI.updateItemSelect(); UI.renderSales();
    keep.forEach(([id, v]) => { const e = document.getElementById(id); if (e) { if (e.type === 'checkbox') e.checked = v; else e.value = v; } });
    const q = (document.getElementById('s-item-search') || {}).value;
    if (q) UI._filterItemSelect(q);
    if (typeof Sales !== 'undefined' && Sales.validate) Sales.validate();
  },
  _set(st) {
    this.state = st;
    const el = document.getElementById('sync-indicator'); if (!el) return;
    clearTimeout(this._hideT);
    let t = '', spin = false;
    if (st === 'syncing') { t = 'Synchronisation…'; spin = true; }
    else if (st === 'idle') {
      t = '☁ Synchronisé' + (this.rt === 'SUBSCRIBED' ? ' · direct' : '');
      const nr = Object.keys((this.store && this.store.rej) || {}).length;
      if (nr) t = '⚠ ' + nr + ' modification(s) refusée(s) : droits insuffisants';
      else if (this.sub && this.sub.status === 'active' && this.sub.current_period_end && (new Date(this.sub.current_period_end) - Date.now()) < 7 * 864e5)
        t += ' · abonnement : ' + Math.max(0, Math.ceil((new Date(this.sub.current_period_end) - Date.now()) / 864e5)) + ' j';
      else if (this.sub && this.sub.status === 'trialing') t += ' · essai ' + Math.max(0, Math.ceil((new Date(this.sub.trial_ends_at) - Date.now()) / 864e5)) + ' j';
    }
    else if (st === 'offline') { const n = this.pendingCount(); t = '⏸ Hors ligne' + (n ? ' · ' + n + ' en attente' : ''); }
    else if (st === 'blocked') t = (CloudAuth.ctx && CloudAuth.ctx.role === 'owner') ? '⚠ Abonnement expiré : touchez pour renouveler' : '⚠ Abonnement expiré : contactez le propriétaire';
    else if (st === 'auth') t = '⚠ Reconnexion requise (touchez ici)';
    else if (st === 'foreign') t = '⚠ Cet appareil contient les données d\'une autre boutique';
    else t = '⚠ Erreur de synchro · toucher pour réessayer';
    el.innerHTML = (spin ? '<div class="spin-dot"></div>' : '') + '<span></span>';
    el.lastChild.textContent = t;
    el.style.display = 'flex';
    if (st === 'auth') el.onclick = () => CloudAuth.signOut();
    else if (st === 'blocked' && typeof Billing !== 'undefined') el.onclick = () => Billing.open();
    else el.onclick = () => this.now();
    if (st === 'idle' && t.indexOf('⚠') !== 0) this._hideT = setTimeout(() => { el.style.display = 'none'; }, 3500);
  }
};
