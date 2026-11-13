'use strict';
/* CloudAuth — compte cloud (email + mot de passe) et boutique.
   Le PIN local (Auth) reste inchangé : il identifie les vendeurs sur l'appareil.
   Démarrage rapide : si l'appareil est déjà connecté, l'app s'ouvre sans attendre le réseau. */
const CloudAuth = {
  client: null, user: null, ctx: null, needsRelogin: false,
  _mode: 'login', _entered: false, CTX_KEY: 'SMP_CLOUD_CTX',

  /* ---------- Démarrage ---------- */
  async start() {
    this._buildDom();
    this.ctx = this._loadCtx();
    const stored = this._storedUser();
    if (this.ctx && stored && this.ctx.userId === stored.id) {   // appareil déjà configuré : ouverture immédiate
      this.user = stored;
      this._enterApp();
      this._initClient().then(ok => { if (ok) this._checkSession(); });
      return;
    }
    const ok = await this._initClient();
    if (ok && navigator.onLine) {
      let r = null;
      try { r = await Promise.race([this.client.auth.getSession(), new Promise(res => setTimeout(() => res(null), 4000))]); } catch (e) {}
      const s = r && r.data && r.data.session;
      if (s) { this.user = s.user; return this._afterAuth(); }
    }
    this._show('login', ok || !navigator.onLine ? '' : 'Connexion au service impossible. Vérifiez internet.');
  },

  _loadLib() {
    return new Promise(res => {
      if (window.supabase && window.supabase.createClient) return res(true);
      const s = document.createElement('script');
      const t = setTimeout(() => res(false), 8000);
      s.src = CLOUD_CONFIG.lib;
      s.onload = () => { clearTimeout(t); res(!!(window.supabase && window.supabase.createClient)); };
      s.onerror = () => { clearTimeout(t); res(false); };
      document.head.appendChild(s);
    });
  },
  _initClient() {
    if (this.client) return Promise.resolve(true);
    if (!this._initP) this._initP = this._loadLib().then(ok => {
      if (ok) this.client = window.supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.key,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      else this._initP = null;           // nouvelle tentative possible plus tard
      return ok;
    });
    return this._initP;
  },
  async _checkSession() {      // en arrière-plan : la session cloud est-elle encore valide ?
    if (!navigator.onLine) return;
    try {
      const r = await this.client.auth.getSession();
      if (r && r.data && r.data.session) { this.needsRelogin = false; this._loadShop(); }
      else { this.needsRelogin = true; console.warn('[Cloud] session expirée : reconnexion nécessaire'); }
    } catch (e) {}
  },

  /* ---------- Stockage local ---------- */
  _loadCtx() { try { return JSON.parse(localStorage.getItem(this.CTX_KEY) || 'null'); } catch (e) { return null; } },
  _saveCtx(c) { this.ctx = c; try { localStorage.setItem(this.CTX_KEY, JSON.stringify(c)); } catch (e) {} },
  _storedUser() {
    try {
      const raw = localStorage.getItem('sb-' + CLOUD_CONFIG.projectRef + '-auth-token');
      const s = raw && JSON.parse(raw);
      return s && s.user ? s.user : null;
    } catch (e) { return null; }
  },

  /* ---------- Connexion / inscription ---------- */
  setMode(m) {
    this._mode = m;
    document.getElementById('cloud-tab-login').classList.toggle('on', m === 'login');
    document.getElementById('cloud-tab-signup').classList.toggle('on', m === 'signup');
    document.getElementById('cloud-submit').textContent = m === 'signup' ? 'Créer mon compte' : 'Se connecter';
    document.getElementById('cloud-pass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    this._msg('');
  },
  async submit() {
    const email = document.getElementById('cloud-email').value.trim().toLowerCase();
    const pw = document.getElementById('cloud-pass').value;
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 6) return this._msg('Email valide et mot de passe de 6 caractères minimum.');
    if (!this.client && !(await this._initClient())) return this._msg('Connexion internet requise pour se connecter.');
    this._busy(true);
    try {
      const res = this._mode === 'signup'
        ? await this.client.auth.signUp({ email, password: pw })
        : await this.client.auth.signInWithPassword({ email, password: pw });
      if (res.error) throw res.error;
      const s = res.data && res.data.session;
      if (!s) { this._busy(false); return this._msg('Compte créé. Confirmez votre email, puis connectez-vous.', true); }
      this.user = s.user;
      await this._afterAuth();
    } catch (e) { this._msg(this._err(e)); }
    this._busy(false);
  },
  async _afterAuth() {
    const r = await this._loadShop();
    if (r === false) return this._show('shop');
    if (r === null) return this._show('login', 'Impossible de charger votre boutique. Réessayez.');
    this._enterApp();
  },
  async _loadShop() {
    try {
      // Une seule boutique pour l'instant (le multi-boutiques viendra plus tard)
      const { data, error } = await this.client.from('shop_members')
        .select('role, shop_id, shops(id, name, currency)').eq('user_id', this.user.id).limit(1);
      if (error) throw error;
      if (!data || !data.length) return false;
      const m = data[0], sh = m.shops || {};
      this._saveCtx({ userId: this.user.id, email: this.user.email, shopId: m.shop_id,
        shopName: sh.name || '', currency: sh.currency || 'F', role: m.role });
      return true;
    } catch (e) {
      console.warn('[Cloud] loadShop', e);
      return (this.ctx && this.ctx.userId === this.user.id && this.ctx.shopId) ? true : null;
    }
  },
  async createShop() {
    const name = document.getElementById('cloud-shop').value.trim();
    if (name.length < 2) return this._msg('Donnez un nom à votre boutique.');
    this._busy(true);
    try {
      const { error } = await this.client.rpc('create_shop', { p_name: name, p_currency: 'F' });
      if (error) throw error;
      await this._afterAuth();
    } catch (e) { this._msg(this._err(e)); }
    this._busy(false);
  },

  /* ---------- Entrée dans l'app / déconnexion ---------- */
  skip() { this._enterApp(); },    // usage local sans compte (première ouverture hors ligne)
  _enterApp() {
    if (this._entered) return;
    this._entered = true;
    this._hide();
    this._badge();
    if (this.ctx && this.ctx.shopId) this._initClient().then(ok => { if (ok) Sync.start(); });
    Auth.ensureDefaultAdmin().then(() => {
      Auth.renderAccountsList();
      const ov = document.getElementById('auth-overlay');
      if (ov) ov.style.display = 'flex';
    });
  },
  async signOut() {
    if (navigator.onLine && window.Sync && Sync.ready()) { try { await Sync.now(); } catch (e) {} }
    const n = window.Sync && Sync.ready() ? Sync.pendingCount() : 0;
    if (!confirm('Se déconnecter du compte cloud ?\n' + (n ? n + ' modification(s) pas encore envoyée(s) restent sur cet appareil.\n' : '') + 'Les données restent sur cet appareil.')) return;
    try { if (this.client) await this.client.auth.signOut({ scope: 'local' }); } catch (e) {}
    try { localStorage.removeItem(this.CTX_KEY); } catch (e) {}
    location.reload();
  },

  /* ---------- Interface ---------- */
  _err(e) {
    const m = String((e && e.message) || e || '');
    if (/invalid login/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/already registered/i.test(m)) return 'Cet email a déjà un compte. Utilisez « Connexion ».';
    if (/fetch|network|failed/i.test(m)) return 'Pas de connexion internet.';
    if (/rate limit/i.test(m)) return 'Trop de tentatives. Patientez un instant.';
    return m || 'Erreur inconnue.';
  },
  _msg(t, ok) { const el = document.getElementById('cloud-msg'); el.textContent = t || ''; el.className = 'cloud-msg' + (ok ? ' ok' : ''); },
  _busy(b) { document.querySelectorAll('#cloud-overlay button').forEach(x => x.disabled = !!b); },
  _show(step, msg) {
    const o = document.getElementById('cloud-overlay');
    o.style.display = 'flex';
    document.getElementById('cloud-step-login').style.display = step === 'login' ? 'block' : 'none';
    document.getElementById('cloud-step-shop').style.display = step === 'shop' ? 'block' : 'none';
    document.getElementById('cloud-skip').style.display = (!navigator.onLine || !this.client) && step === 'login' ? 'block' : 'none';
    this._msg(msg || '');
  },
  _hide() { const o = document.getElementById('cloud-overlay'); if (o) o.style.display = 'none'; },
  _badge() {
    const card = document.querySelector('#auth-overlay .auth-card');
    if (!card || document.getElementById('cloud-badge')) return;
    const d = document.createElement('div');
    d.id = 'cloud-badge';
    d.innerHTML = this.ctx
      ? '☁ ' + Utils.esc(this.ctx.shopName) + ' · <a href="#" onclick="CloudAuth.signOut();return false">Changer de compte</a>'
      : '☁ Mode local (non connecté)';
    card.appendChild(d);
  },
  _buildDom() {
    if (document.getElementById('cloud-overlay')) return;
    const o = document.createElement('div');
    o.id = 'cloud-overlay';
    o.innerHTML =
      '<div class="auth-card"><div class="auth-logo">Smart Market Pro</div><div class="auth-sub">Version PRO · Cloud</div>' +
      '<div id="cloud-step-login">' +
        '<div class="cloud-tabs"><button id="cloud-tab-login" class="on" onclick="CloudAuth.setMode(\'login\')">Connexion</button>' +
        '<button id="cloud-tab-signup" onclick="CloudAuth.setMode(\'signup\')">Créer un compte</button></div>' +
        '<input id="cloud-email" type="email" placeholder="Email" autocomplete="email">' +
        '<input id="cloud-pass" type="password" placeholder="Mot de passe (6 caractères min.)" autocomplete="current-password">' +
        '<button id="cloud-submit" class="btn btn-primary" onclick="CloudAuth.submit()">Se connecter</button>' +
        '<button id="cloud-skip" class="cloud-link" onclick="CloudAuth.skip()" style="display:none">Continuer sans compte (hors ligne)</button>' +
      '</div>' +
      '<div id="cloud-step-shop" style="display:none">' +
        '<div class="cloud-hint">Dernière étape : nommez votre boutique. 14 jours d\'essai gratuit.</div>' +
        '<input id="cloud-shop" type="text" placeholder="Nom de la boutique" maxlength="60">' +
        '<button class="btn btn-primary" onclick="CloudAuth.createShop()">Créer ma boutique</button>' +
        '<button class="cloud-link" onclick="CloudAuth.signOut()">Se déconnecter</button>' +
      '</div>' +
      '<div id="cloud-msg" class="cloud-msg"></div></div>';
    document.body.appendChild(o);
    o.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      if (document.getElementById('cloud-step-shop').style.display !== 'none') this.createShop(); else this.submit();
    });
  }
};
