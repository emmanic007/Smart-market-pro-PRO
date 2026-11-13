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
    setInterval(() => { if (document.visibilityState === 'visible') this.schedule(0); }, 120000);
    try {                                            // temps réel : un autre appareil a modifié quelque chose
      this.c.channel('rec-' + this.shop)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: 'shop_id=eq.' + this.shop }, () => this.schedule(800))
        .subscribe();
    } catch (e) {}
    this.now();
  },
  _rawSave() { try { localStorage.setItem(DB.KEY, JSON.stringify(DB.data)); } catch (e) {} },
  ready() { return !!(this._started && this.c && this.shop); },
  schedule(ms) { clearTimeout(this._timer); this._timer = setTimeout(() => this.now(), ms === undefined ? 2500 : ms); },

  /* ---------- Outils ---------- */
  _load() { try { this.store = JSON.parse(localStorage.getItem('SMP_SYNC_' + this.shop) || 'null'); } catch (e) {} if (!this.store) this.store = { pull: null, h: {} }; },
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
  _snapshot() {
    const out = {};
    this.ARR.forEach(k => (DB.data[k] || []).forEach(r => { if (r && r.id != null) out[k + ':' + r.id] = { kind: k, id: String(r.id), data: r }; }));
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
    if (!seller) for (const k in h) if (!(k in snap) && k.indexOf('meta:') !== 0 && rej[k] !== 'del') {
      const p = k.indexOf(':');
      dels.push({ k, del: true, row: { shop_id: this.shop, kind: k.slice(0, p), id: k.slice(p + 1), data: {}, deleted: true } });
    }
    return { up, dels };
  },
  pendingCount() { if (!this.store) return 0; const d = this._diff(); return d.up.length + d.dels.length; },

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
    if (changed) { this._applying = true; this._orig(); this._applying = false; }
    return changed;
  },
  _apply(rec, first, idx, del) {
    const isMeta = rec.kind === 'meta', key = (isMeta ? 'meta:' : rec.kind + ':') + rec.id, h = this.store.h;
    if (!isMeta && this.ARR.indexOf(rec.kind) < 0) return false;
    if (isMeta && this.META.indexOf(rec.id) < 0) return false;
    if (!isMeta) {
      if (!idx[rec.kind]) { idx[rec.kind] = new Map(); (DB.data[rec.kind] || (DB.data[rec.kind] = [])).forEach((r, i) => idx[rec.kind].set(String(r.id), i)); del[rec.kind] = new Set(); }
    }
    const pos = isMeta ? undefined : idx[rec.kind].get(rec.id);
    const exists = isMeta ? DB.data[rec.id] !== undefined : pos !== undefined && !del[rec.kind].has(rec.id);
    const hr = rec.deleted ? 'del' : this._h(this._canon(rec.data));
    if (h[key] === hr) return false;                                  // déjà à jour
    if (rec.deleted && !exists) { delete h[key]; return false; }
    if (exists && !first) {                                           // modification locale en attente ? elle gagne
      const cur = isMeta ? { v: DB.data[rec.id] } : DB.data[rec.kind][pos];
      if (this._h(this._canon(cur)) !== h[key]) return false;
    }
    if (rec.deleted) { del[rec.kind].add(rec.id); delete h[key]; return true; }
    if (isMeta) DB.data[rec.id] = rec.data.v;
    else if (pos !== undefined) { DB.data[rec.kind][pos] = rec.data; del[rec.kind].delete(rec.id); }
    else { DB.data[rec.kind].push(rec.data); idx[rec.kind].set(rec.id, DB.data[rec.kind].length - 1); }
    h[key] = hr;
    return true;
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
    const { up, dels } = this._diff();
    if (dels.length > 20 && dels.length > Object.keys(h).length * 0.5) {   // garde-fou : disparition massive
      if (!confirm(dels.length + ' éléments ont disparu de cet appareil.\nLes supprimer aussi du cloud ?\n\nOK = supprimer partout\nAnnuler = les récupérer depuis le cloud')) {
        dels.forEach(d => delete h[d.k]); this.store.pull = null; dels.length = 0; this.schedule(500);
      }
    }
    const rows = up.concat(dels);
    for (let i = 0; i < rows.length; i += 200) {
      const part = rows.slice(i, i + 200);
      const refused = new Set((await this._upsertRows(part)).map(x => x.k));
      part.forEach(x => {
        if (refused.has(x.k)) rejStore[x.k] = x.del ? 'del' : x.hh;
        else { delete rejStore[x.k]; if (x.del) delete h[x.k]; else h[x.k] = x.hh; }
      });
      this._save();
    }
  },

  /* ---------- Affichage ---------- */
  _refreshUI() {
    try {
      const a = document.activeElement;
      if ((a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || !Auth.currentUser || UI._currentTab === 'sales') return;
      UI.switchTab(UI._currentTab, true);
    } catch (e) {}
  },
  _set(st) {
    this.state = st;
    const el = document.getElementById('sync-indicator'); if (!el) return;
    clearTimeout(this._hideT);
    let t = '', spin = false;
    if (st === 'syncing') { t = 'Synchronisation…'; spin = true; }
    else if (st === 'idle') {
      t = '☁ Synchronisé';
      const nr = Object.keys((this.store && this.store.rej) || {}).length;
      if (nr) t = '⚠ ' + nr + ' modification(s) refusée(s) : droits insuffisants';
      else if (this.sub && this.sub.status === 'trialing') t += ' · essai ' + Math.max(0, Math.ceil((new Date(this.sub.trial_ends_at) - Date.now()) / 864e5)) + ' j';
    }
    else if (st === 'offline') { const n = this.pendingCount(); t = '⏸ Hors ligne' + (n ? ' · ' + n + ' en attente' : ''); }
    else if (st === 'blocked') t = '⚠ Abonnement expiré — données gardées sur l\'appareil';
    else if (st === 'auth') t = '⚠ Reconnexion requise (touchez ici)';
    else if (st === 'foreign') t = '⚠ Cet appareil contient les données d\'une autre boutique';
    else t = '⚠ Erreur de synchro · toucher pour réessayer';
    el.innerHTML = (spin ? '<div class="spin-dot"></div>' : '') + '<span></span>';
    el.lastChild.textContent = t;
    el.style.display = 'flex';
    if (st === 'auth') el.onclick = () => CloudAuth.signOut();
    else el.onclick = () => this.now();
    if (st === 'idle' && t.indexOf('⚠') !== 0) this._hideT = setTimeout(() => { el.style.display = 'none'; }, 3500);
  }
};
