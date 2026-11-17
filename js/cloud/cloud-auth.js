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
    const rec = this._recoveryParams();            // l'utilisateur arrive depuis le lien reçu par email
    if (rec) return this._startRecovery(rec);
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

  /* ---------- Mot de passe oublié ---------- */
  _recoveryParams() {
    const p = new URLSearchParams((window.__SMP_BOOT_HASH || '').replace(/^#/, ''));
    if (/^(recovery|signup|invite|magiclink|email_change)$/.test(p.get('type') || '') && p.get('access_token'))
      return { at: p.get('access_token'), rt: p.get('refresh_token') || '', kind: p.get('type') };
    if (p.get('error')) return { error: true };
    return null;
  },
  async _startRecovery(rec) {
    history.replaceState(null, '', location.pathname + location.search);   // efface les clés de l'adresse
    const expired = 'Lien invalide ou expiré. Demandez un nouveau lien avec « Mot de passe oublié ? ».';
    if (!(await this._initClient())) return this._show('login', 'Connexion internet requise.');
    if (rec.error) return this._show('login', expired);
    const { error } = await this.client.auth.setSession({ access_token: rec.at, refresh_token: rec.rt });
    if (error) return this._show('login', expired);
    if (rec.kind === 'recovery') return this._show('newpass');
    const { data } = await this.client.auth.getSession();       // lien de confirmation d'email : la personne est connectée
    if (!data || !data.session) return this._show('login', 'Email confirmé. Connectez-vous.');
    this.user = data.session.user;
    this._afterAuth();
  },
  showForgot() { const e = document.getElementById('cloud-email').value; this._show('forgot'); document.getElementById('cloud-email2').value = e; },
  showLogin() { this._show('login'); },
  async sendReset() {
    const email = document.getElementById('cloud-email2').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return this._msg('Entrez votre email.');
    if (!this.client && !(await this._initClient())) return this._msg('Connexion internet requise.');
    this._busy(true);
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      this._msg('Si cet email a un compte, un lien vient d\'être envoyé. Vérifiez aussi les courriers indésirables.', true);
    } catch (e) { this._msg(this._err(e)); }
    this._busy(false);
  },
  async savePassword() {
    const a = document.getElementById('cloud-np1').value, b = document.getElementById('cloud-np2').value;
    if (a.length < 6) return this._msg('6 caractères minimum.');
    if (a !== b) return this._msg('Les deux mots de passe ne correspondent pas.');
    this._busy(true);
    try {
      const { error } = await this.client.auth.updateUser({ password: a });
      if (error) throw error;
      const { data } = await this.client.auth.getSession();
      this.user = data.session.user;
      await this._afterAuth();
    } catch (e) { this._msg(this._err(e)); }
    this._busy(false);
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
    document.getElementById('cloud-agree-box').style.display = m === 'signup' ? 'flex' : 'none';
    document.getElementById('cloud-pass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    this._msg('');
  },
  async submit() {
    const email = document.getElementById('cloud-email').value.trim().toLowerCase();
    const pw = document.getElementById('cloud-pass').value;
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 6) return this._msg('Email valide et mot de passe de 6 caractères minimum.');
    if (this._mode === 'signup' && !document.getElementById('cloud-agree').checked) return this._msg('Cochez la case pour accepter les conditions et créer votre compte.');
    if (!this.client && !(await this._initClient())) return this._msg('Connexion internet requise pour se connecter.');
    this._busy(true);
    try {
      const res = this._mode === 'signup'
        ? await this.client.auth.signUp({ email, password: pw, options: { data: {
            terms_version: typeof LEGAL !== 'undefined' ? LEGAL.version : '', terms_accepted_at: new Date().toISOString() } } })
        : await this.client.auth.signInWithPassword({ email, password: pw });
      if (res.error) throw res.error;
      const s = res.data && res.data.session;
      if (!s) { this._busy(false); return this._msg('Compte créé. Un email de confirmation vient d\'être envoyé à ' + email + '. Ouvrez-le (voir aussi les courriers indésirables) : le lien vous connecte directement.', true); }
      this.user = s.user;
      await this._afterAuth();
    } catch (e) {
      if (/not confirmed/i.test(String((e && e.message) || ''))) {
        this._busy(false);
        if (confirm('Cet email n\'est pas encore confirmé.\nRenvoyer l\'email de confirmation à ' + email + ' ?')) {
          try { const r = await this.client.auth.resend({ type: 'signup', email }); if (r.error) throw r.error; this._msg('Email de confirmation renvoyé. Vérifiez aussi les courriers indésirables.', true); }
          catch (e2) { this._msg(this._err(e2)); }
        } else this._msg('Confirmez votre email avec le lien reçu, puis reconnectez-vous.');
        return;
      }
      this._msg(this._err(e));
    }
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
      const sel = cols => this.client.from('shop_members').select('role, display_name, shop_id, shops(' + cols + ')').eq('user_id', this.user.id).limit(1);
      let q = await sel('id, name, currency, whatsapp');
      if (q.error && /whatsapp/i.test(String(q.error.message))) q = await sel('id, name, currency');   // base pas encore mise à jour
      const { data, error } = q;
      if (error) throw error;
      if (!data || !data.length) return false;
      const m = data[0], sh = m.shops || {};
      this._saveCtx({ userId: this.user.id, email: this.user.email, shopId: m.shop_id,
        shopName: sh.name || '', currency: sh.currency || 'F', role: m.role, displayName: m.display_name || '', whatsapp: sh.whatsapp || '' });
      return true;
    } catch (e) {
      console.warn('[Cloud] loadShop', e);
      return (this.ctx && this.ctx.userId === this.user.id && this.ctx.shopId) ? true : null;
    }
  },
  normPhone(raw) {      // chiffres seulement ; numéros béninois (01 + 8 chiffres) complétés avec l'indicatif 229
    let d = String(raw || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 10 && d.indexOf('01') === 0) d = '229' + d;
    else if (d.length === 8) d = '22901' + d;
    return d;
  },
  fmtPhone(d) {
    d = String(d || '');
    if (d.indexOf('229') === 0 && d.length === 13) return '+229 ' + d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ');
    return d ? '+' + d : '';
  },
  shopTab(t) {
    document.getElementById('cloud-tab-new').classList.toggle('on', t === 'new');
    document.getElementById('cloud-tab-code').classList.toggle('on', t === 'code');
    document.getElementById('cloud-pane-new').style.display = t === 'new' ? 'block' : 'none';
    document.getElementById('cloud-pane-code').style.display = t === 'code' ? 'block' : 'none';
    this._msg('');
  },
  async joinWithCode() {
    const code = document.getElementById('cloud-code').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (code.length < 8) return this._msg('Saisissez le code complet.');
    this._busy(true);
    try {
      const { error } = await this.client.rpc('accept_invite_code', { p_code: code });
      if (error) throw error;
      await this._afterAuth();
    } catch (e) { this._msg(this._err(e)); }
    this._busy(false);
  },
  async createShop() {
    const name = document.getElementById('cloud-shop').value.trim();
    if (name.length < 2) return this._msg('Donnez un nom à votre boutique.');
    this._busy(true);
    try {
      const wa = this.normPhone(document.getElementById('cloud-wa').value);
      if (wa && (wa.length < 8 || wa.length > 15)) { this._busy(false); return this._msg('Numéro WhatsApp invalide (exemple : 01 61 15 61 06).'); }
      let { error } = await this.client.rpc('create_shop', { p_name: name, p_currency: 'F', p_whatsapp: wa || null });
      if (error && /p_whatsapp|Could not find the function/i.test(String(error.message)))        // base pas encore mise à jour
        ({ error } = await this.client.rpc('create_shop', { p_name: name, p_currency: 'F' }));
      if (error) throw error;
      await this._afterAuth();
    } catch (e) { this._msg(this._err(e)); }
    this._busy(false);
  },

  /* ---------- Entrée dans l'app / déconnexion ---------- */
  skip() { this._enterApp(); },    // usage local sans compte (première ouverture hors ligne)
  /* L'appareil contient les données d'une autre boutique : on les met de côté (sans les perdre), on charge
     celles de la boutique connectée (ou une base vide), puis on recharge. Un retour sur l'ancien compte les restaure. */
  _swapShopData() {
    if (!this.ctx || !this.ctx.shopId) return false;
    const have = DB.data && DB.data.shopId, want = this.ctx.shopId;
    if (!have || have === want) { sessionStorage.removeItem('smp_swap'); return false; }   // rien à changer
    if (sessionStorage.getItem('smp_swap')) { sessionStorage.removeItem('smp_swap'); return false; }   // anti-boucle
    const KEEP = /^(SMP_CLOUD_CTX|SMP_SYNC_|SMP_ARCH_|SMP_PWA_DISMISSED|SMP_STORAGE_PREF|SMP_AI_CFG)/;
    try {
      const mine = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^SMP_/.test(k) && !KEEP.test(k)) mine[k] = localStorage.getItem(k); }
      localStorage.setItem('SMP_ARCH_' + have, JSON.stringify(mine));          // si ça échoue (mémoire pleine) : on ne touche à rien
      Object.keys(mine).forEach(k => localStorage.removeItem(k));
      const prev = localStorage.getItem('SMP_ARCH_' + want);
      if (prev) { const o = JSON.parse(prev); Object.keys(o).forEach(k => localStorage.setItem(k, o[k])); localStorage.removeItem('SMP_ARCH_' + want); }
      sessionStorage.setItem('smp_swap', '1');
    } catch (e) { console.warn('[Cloud] changement de boutique impossible', e); return false; }
    location.reload();
    return true;
  },
  _enterApp() {
    if (this._entered) return;
    if (this._swapShopData()) return;
    this._entered = true;
    this._hide();
    this._badge();
    if (this.ctx && this.ctx.shopId) this._initClient().then(ok => { if (ok) Sync.start(); });
    if (this.isSeller()) { this._sellerHook(); this._sellerLogin(); return; }   // vendeur cloud : pas de PIN
    if ((typeof CloudTeam !== 'undefined')) CloudTeam.init();
    if (typeof Billing !== 'undefined') Billing.init();
    Auth.ensureDefaultAdmin().then(() => {
      Auth.renderAccountsList();
      const ov = document.getElementById('auth-overlay');
      if (ov) ov.style.display = 'flex';
    });
  },
  /* ---------- Vendeur cloud : son compte remplace le PIN ---------- */
  isSeller() { return !!(this.ctx && this.ctx.role === 'seller'); },
  _sellerLogin() {
    const ov = document.getElementById('auth-overlay'); if (ov) ov.style.display = 'none';
    const name = this.ctx.displayName || String(this.ctx.email || 'Vendeur').split('@')[0];
    Auth._enterSession({ id: 'cloud_' + this.ctx.userId, name, role: 'seller', cloud: true });
  },
  _sellerHook() {      // « Quitter » = se déconnecter du compte (jamais d'accès aux comptes PIN de l'appareil)
    if (this._sellerHooked) return;
    this._sellerHooked = true;
    const o = Auth.logout.bind(Auth);
    Auth.logout = () => {
      o();
      const ov = document.getElementById('auth-overlay'); if (ov) ov.style.display = 'none';
      if (confirm('Se déconnecter du compte ?\nOK = se déconnecter\nAnnuler = rester connecté')) this.signOut(true);
      else this._sellerLogin();
    };
  },
  async signOut(skipConfirm) {
    if (navigator.onLine && (typeof Sync !== 'undefined') && Sync.ready()) { try { await Sync.now(); } catch (e) {} }
    const n = (typeof Sync !== 'undefined') && Sync.ready() ? Sync.pendingCount() : 0;
    if (!skipConfirm && !confirm('Se déconnecter du compte cloud ?\n' + (n ? n + ' modification(s) pas encore envoyée(s) restent sur cet appareil.\n' : '') + 'Les données restent sur cet appareil.')) return;
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
    if (/rate limit|security purposes|only request this after/i.test(m)) return 'Trop de demandes. Patientez une minute puis réessayez.';
    if (/same password|different from the old/i.test(m)) return 'Choisissez un mot de passe différent de l\'ancien.';
    return m || 'Erreur inconnue.';
  },
  _msg(t, ok) { const el = document.getElementById('cloud-msg'); el.textContent = t || ''; el.className = 'cloud-msg' + (ok ? ' ok' : ''); },
  _busy(b) { document.querySelectorAll('#cloud-overlay button').forEach(x => x.disabled = !!b); },
  _show(step, msg) {
    const o = document.getElementById('cloud-overlay');
    o.style.display = 'flex';
    ['login', 'shop', 'forgot', 'newpass'].forEach(s => { document.getElementById('cloud-step-' + s).style.display = s === step ? 'block' : 'none'; });
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
        '<label id="cloud-agree-box" class="cloud-agree" style="display:none"><input type="checkbox" id="cloud-agree"><span>J\'accepte les <a href="conditions.html" target="_blank" rel="noopener">Conditions d\'utilisation</a> et la <a href="confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a>.</span></label>' +
        '<button id="cloud-submit" class="btn btn-primary" onclick="CloudAuth.submit()">Se connecter</button>' +
        '<button class="cloud-link" onclick="CloudAuth.showForgot()">Mot de passe oublié ?</button>' +
        '<div class="cloud-legal"><a href="conditions.html" target="_blank" rel="noopener">Conditions d\'utilisation</a> · <a href="confidentialite.html" target="_blank" rel="noopener">Confidentialité</a></div>' +
        '<button id="cloud-skip" class="cloud-link" onclick="CloudAuth.skip()" style="display:none">Continuer sans compte (hors ligne)</button>' +
      '</div>' +
      '<div id="cloud-step-forgot" style="display:none">' +
        '<div class="cloud-hint">Entrez votre email : nous vous envoyons un lien pour choisir un nouveau mot de passe.</div>' +
        '<input id="cloud-email2" type="email" placeholder="Email" autocomplete="email">' +
        '<button class="btn btn-primary" onclick="CloudAuth.sendReset()">Envoyer le lien</button>' +
        '<button class="cloud-link" onclick="CloudAuth.showLogin()">Retour à la connexion</button>' +
      '</div>' +
      '<div id="cloud-step-newpass" style="display:none">' +
        '<div class="cloud-hint">Choisissez votre nouveau mot de passe.</div>' +
        '<input id="cloud-np1" type="password" placeholder="Nouveau mot de passe (6 caractères min.)" autocomplete="new-password">' +
        '<input id="cloud-np2" type="password" placeholder="Confirmer le mot de passe" autocomplete="new-password">' +
        '<button class="btn btn-primary" onclick="CloudAuth.savePassword()">Enregistrer</button>' +
      '</div>' +
      '<div id="cloud-step-shop" style="display:none">' +
        '<div class="cloud-tabs"><button id="cloud-tab-new" class="on" onclick="CloudAuth.shopTab(\'new\')">Créer ma boutique</button>' +
        '<button id="cloud-tab-code" onclick="CloudAuth.shopTab(\'code\')">J\'ai un code</button></div>' +
        '<div id="cloud-pane-new"><div class="cloud-hint">Nommez votre boutique. 14 jours d\'essai gratuit.</div>' +
        '<input id="cloud-shop" type="text" placeholder="Nom de la boutique" maxlength="60">' +
        '<div class="cloud-wa">💬 <b>Ajoutez votre WhatsApp</b> : nous vous aidons en quelques minutes en cas de souci et nous vous prévenons avant la fin de votre abonnement, pour que vous ne perdiez jamais votre synchronisation. Pas de spam, jamais partagé.</div>' +
        '<input id="cloud-wa" type="tel" inputmode="tel" placeholder="Votre numéro WhatsApp (facultatif)" maxlength="20">' +
        '<button class="btn btn-primary" onclick="CloudAuth.createShop()">Créer ma boutique</button></div>' +
        '<div id="cloud-pane-code" style="display:none"><div class="cloud-hint">Saisissez le code d\'invitation reçu de votre patron (par WhatsApp).</div>' +
        '<input id="cloud-code" type="text" placeholder="CODE D\'INVITATION" maxlength="16" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.15em;text-align:center">' +
        '<button class="btn btn-primary" onclick="CloudAuth.joinWithCode()">Rejoindre la boutique</button></div>' +
        '<button class="cloud-link" onclick="CloudAuth.signOut()">Se déconnecter</button>' +
      '</div>' +
      '<div id="cloud-msg" class="cloud-msg"></div></div>';
    document.body.appendChild(o);
    o.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const vis = id => document.getElementById('cloud-step-' + id).style.display !== 'none';
      if (vis('shop')) { if (document.getElementById('cloud-pane-code').style.display !== 'none') this.joinWithCode(); else this.createShop(); } else if (vis('forgot')) this.sendReset(); else if (vis('newpass')) this.savePassword(); else this.submit();
    });
  }
};
