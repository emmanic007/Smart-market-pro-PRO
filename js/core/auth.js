'use strict';
const Auth = {
  currentUser: null,
  _buf: '',

  pinInput(key) {
    const errEl = document.getElementById('auth-pin-error');
    if (errEl) errEl.textContent = '';
    if (key === '⌫')      { this._buf = this._buf.slice(0,-1); }
    else if (key === '✓') { this._tryLogin(); return; }
    else if (this._buf.length < 4 && /^\d$/.test(key)) { this._buf += key; }
    this._dots();
    if (this._buf.length === 4) setTimeout(() => this._tryLogin(), 200);
  },
  _dots() {
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById('dot-' + i);
      if (d) d.classList.toggle('filled', i < this._buf.length);
    }
  },
  async _tryLogin() {
    const pin = this._buf; this._buf = ''; this._dots();
    if (!pin || pin.length !== 4) return;
    // Vérification verrouillage
    try {
      const ld = JSON.parse(localStorage.getItem('SMP_PIN_LOCK') || '{"a":0,"u":0}');
      if (ld.u > Date.now()) {
        const secs = Math.ceil((ld.u - Date.now()) / 1000);
        const errEl = document.getElementById('auth-pin-error');
        if (errEl) errEl.textContent = I18n.t('toast_err_account_locked').replace('{s}', secs);
        return;
      }
    } catch(_) {}
    const hash  = await Utils.sha256(pin);
    // Vérifier le PIN UNIQUEMENT contre l'utilisateur sélectionné (_pendingUser)
    // Ne jamais chercher dans tous les users — chaque compte a son propre PIN
    const candidate = this._pendingUser;
    if (!candidate) {
      const errEl = document.getElementById('auth-pin-error');
      if (errEl) errEl.textContent = I18n.t('toast_err_no_account_selected');
      return;
    }
    const found = candidate.pinHash === hash ? candidate : null;
    if (found) {
      try { localStorage.setItem('SMP_PIN_LOCK', JSON.stringify({a:0,u:0})); } catch(_) {}
      try { localStorage.setItem('SMP_LAST_USER', found.id); } catch(_) {}
      // Entrer dans l'app directement
      this.currentUser = found;
      const ov = document.getElementById('auth-overlay');
      if (ov) ov.style.display = 'none';
      if (found.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('admin-visible'));
      } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('admin-visible'));
      }
      const navU = document.getElementById('nav-username'); if(navU) navU.textContent = found.name;
      const mobU = document.getElementById('mob-username'); if(mobU) mobU.textContent = found.name;
      UI.renderAll(); Dashboard.refresh();
      UI.toast(`${I18n.t('toast_welcome_back')}, ${found.name} 👋`, 'success');
      if (found.role === 'admin' && typeof EODSummary !== 'undefined') EODSummary.schedule();
      if (found.role !== 'admin') {
        setTimeout(() => {
          if (typeof SellerDash !== 'undefined') SellerDash.show();
          else if (typeof SellerMode !== 'undefined') {
            const _sn = document.getElementById('sm-shop-name');
            const _sl = document.getElementById('sm-seller-name');
            if (_sn) _sn.textContent = Settings.data.shopName || 'Smart Market Pro';
            if (_sl) _sl.textContent = found.name;
            SellerMode.activate();
          }
        }, 300);
      }
    } else {
      try {
        const ld = JSON.parse(localStorage.getItem('SMP_PIN_LOCK') || '{"a":0,"u":0}');
        ld.a = (ld.a || 0) + 1;
        if (ld.a >= 5) { ld.u = Date.now() + 30000; ld.a = 0; }
        localStorage.setItem('SMP_PIN_LOCK', JSON.stringify(ld));
        const rem = ld.u > Date.now() ? 0 : 5 - ld.a;
        const errEl = document.getElementById('auth-pin-error');
        if (errEl) errEl.textContent = ld.u > Date.now()
          ? 'Compte verrouillé 30 secondes'
          : 'PIN incorrect' + (rem > 0 ? ' (' + rem + ' essai' + (rem > 1 ? 's' : '') + ' restant)' : '');
        UI.toast(I18n.t('toast_err_pin_wrong'),'danger');
      } catch(_) {
        const errEl = document.getElementById('auth-pin-error');
        if (errEl) errEl.textContent = I18n.t('toast_err_pin_wrong');
        UI.toast(I18n.t('toast_err_pin_wrong'),'danger');
      }
    }
  },
  /* Affiche la liste des comptes disponibles */
  renderAccountsList() {
    const list = document.getElementById('accounts-list');
    if (!list) return;
    // S'assurer que l'écran local est visible
    const stepLocal = document.getElementById('auth-step-local');
    const stepPin   = document.getElementById('auth-step-pin');
    if (stepLocal) stepLocal.style.display = 'block';
    if (stepPin)   stepPin.style.display   = 'none';
    const users = DB.data.users || [];

    if (!users.length) {
      // Ne devrait jamais arriver après ensureDefaultAdmin — cas de sécurité
      list.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:.8rem;padding:16px">${I18n.t('auth_init')}<br><span style="font-size:.7rem">${I18n.t('auth_init_reload')}</span></div>`;
      // Tenter de créer l'admin et recharger la liste
      Auth.ensureDefaultAdmin().then(() => {
        const freshUsers = DB.data.users || [];
        if (freshUsers.length > 0) Auth.renderAccountsList();
      });
      return;
    }

    // ≤ 3 comptes → boutons directs ; ≥ 4 comptes → menu déroulant
    if (users.length <= 3) {
      list.innerHTML = users.map(u => `
        <button class="acc-dropdown-trigger" onclick="Auth.selectAccount('${u.id}')">
          <div class="acc-avatar" style="background:${u.role==='admin'?'var(--accent)':'var(--info)'}">
            ${u.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="acc-info-name">${this._esc(u.name)}</div>
            <div class="acc-info-role" style="color:${u.role==='admin'?'var(--accent)':'var(--text3)'}">
              ${u.role==='admin'?(I18n.t('role_admin_full')):(I18n.t('role_seller_full'))}
            </div>
          </div>
        </button>`).join('');
    } else {
      // Trouver le "dernier connecté" pour pré-sélectionner dans le trigger
      const lastId  = localStorage.getItem('SMP_LAST_USER');
      const defUser = users.find(u => u.id === lastId) || users[0];
      list.innerHTML = `
        <!-- Trigger -->
        <button class="acc-dropdown-trigger" id="acc-trigger" onclick="Auth._toggleAccDropdown()">
          <div class="acc-avatar" id="acc-trigger-avatar"
            style="background:${defUser.role==='admin'?'var(--accent)':'var(--info)'}">
            ${defUser.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex:1">
            <div class="acc-info-name" id="acc-trigger-name">${this._esc(defUser.name)}</div>
            <div class="acc-info-role" id="acc-trigger-role"
              style="color:${defUser.role==='admin'?'var(--accent)':'var(--text3)'}">
              ${defUser.role==='admin'?(I18n.t('role_admin_full')):(I18n.t('role_seller_full'))}
            </div>
          </div>
          <span class="acc-chevron">▼</span>
        </button>
        <!-- Menu déroulant -->
        <div class="acc-dropdown-menu" id="acc-dropdown-menu">
          ${users.map(u => `
            <button class="acc-dropdown-item" onclick="Auth._pickFromDropdown('${u.id}')">
              <div class="acc-avatar" style="background:${u.role==='admin'?'var(--accent)':'var(--info)'}">
                ${u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="acc-info-name">${this._esc(u.name)}</div>
                <div class="acc-info-role"
                  style="color:${u.role==='admin'?'var(--accent)':'var(--text3)'}">
                  ${u.role==='admin'?(I18n.t('role_admin_full')):(I18n.t('role_seller_full'))}
                </div>
              </div>
            </button>`).join('')}
        </div>
        <!-- Bouton connexion rapide -->
        <button class="btn btn-primary btn-full mt-14"
          id="acc-quick-login"
          onclick="Auth.selectAccount('${defUser.id}')"
          style="padding:14px">
          Connexion → ${this._esc(defUser.name)}
        </button>`;
    }
  },

  _toggleAccDropdown() {
    const trigger = document.getElementById('acc-trigger');
    const menu    = document.getElementById('acc-dropdown-menu');
    if (!trigger || !menu) return;
    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    trigger.classList.toggle('open', !isOpen);
  },

  _pickFromDropdown(userId) {
    // Fermer le menu
    document.getElementById('acc-dropdown-menu')?.classList.remove('open');
    document.getElementById('acc-trigger')?.classList.remove('open');

    const user = DB.data.users.find(u => u.id === userId);
    if (!user) return;

    // Mettre à jour le trigger visuel
    const av   = document.getElementById('acc-trigger-avatar');
    const nm   = document.getElementById('acc-trigger-name');
    const rl   = document.getElementById('acc-trigger-role');
    const btn  = document.getElementById('acc-quick-login');
    const col  = user.role === 'admin' ? 'var(--accent)' : 'var(--info)';
    if (av)  { av.textContent = user.name.charAt(0).toUpperCase(); av.style.background = col; }
    if (nm)  nm.textContent   = user.name;
    if (rl)  { rl.textContent = user.role === 'admin' ? (I18n.t('role_admin_full')) : (I18n.t('role_seller_full')); rl.style.color = col; }
    if (btn) { btn.textContent = 'Connexion → ' + user.name; btn.onclick = () => Auth.selectAccount(userId); }

    // Mémoriser le dernier choix
    localStorage.setItem('SMP_LAST_USER', userId);
  },

  _esc(s) { return Utils.esc(s); },

  selectAccount(userId) {
    const user = DB.data.users.find(u => u.id === userId);
    if (!user) {
      UI.toast(I18n.t('toast_err_not_found_account'),'danger');
      this.renderAccountsList();
      return;
    }
    this._pendingUser = user;
    this._showPinStep(user);
  },

  _showPinStep(user) {
    const stepLocal = document.getElementById('auth-step-local');
    const stepPin   = document.getElementById('auth-step-pin');
    if (stepLocal) stepLocal.style.display = 'none';
    if (stepPin)   stepPin.style.display   = 'block';
    const nameEl = document.getElementById('auth-selected-name');
    const roleEl = document.getElementById('auth-selected-role');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role === 'admin' ? (I18n.t('role_admin_full')) : (I18n.t('role_seller_full'));
    this._buf = ''; this._dots();
    const pe = document.getElementById('auth-pin-error'); if(pe) pe.textContent = '';
  },

  backToAccounts() {
    this._pendingUser = null;
    this._buf = ''; this._dots();
    this.renderAccountsList();
  },

  showDemoMode() {
    // Charge des données fictives pour démo
    const demoData = {
      items: [
        {id:'d1',name:'Café 200g',code:'CF001',buy:500,sell:750,qty:45,min:10,category:'Alimentation',createdAt:new Date().toISOString()},
        {id:'d2',name:'Sucre 1kg',code:'SU001',buy:300,sell:450,qty:30,min:5,category:'Alimentation',createdAt:new Date().toISOString()},
        {id:'d3',name:'Savon Palmolive',code:'SA001',buy:200,sell:350,qty:8,min:10,category:'Hygiène',createdAt:new Date().toISOString()},
        {id:'d4',name:'Lait Concentré',code:'LA001',buy:400,sell:600,qty:0,min:5,category:'Alimentation',createdAt:new Date().toISOString()},
        {id:'d5',name:'Huile 1L',code:'HU001',buy:800,sell:1100,qty:20,min:8,category:'Alimentation',createdAt:new Date().toISOString()},
      ],
      sales: [],
      users: DB.data.users,
      cashInit: 25000,
      dailyObjective: 150000,
      monthlyObjective: 3000000,
    };
    // Add demo sales
    const now = new Date();
    const demoSales = [
      {itemId:'d1',itemName:'Café 200g',qty:3,price:750,total:2250,profit:750,debt:0,clientName:'Kofi Mensah'},
      {itemId:'d2',itemName:'Sucre 1kg',qty:2,price:450,total:900,profit:300,debt:450,clientName:'Ama Sika'},
      {itemId:'d5',itemName:'Huile 1L',qty:1,price:1100,total:1100,profit:300,debt:0,clientName:'Jean Pierre'},
      {itemId:'d1',itemName:'Café 200g',qty:5,price:750,total:3750,profit:1250,debt:0,clientName:''},
      {itemId:'d3',itemName:'Savon Palmolive',qty:4,price:350,total:1400,profit:600,debt:0,clientName:'Marie Dupont'},
    ];
    demoSales.forEach((s,i) => {
      const d = new Date(now); d.setHours(8+i*2);
      demoData.sales.push({id:'demo'+i,...s,date:d.toISOString(),userId:'demo',userName:'Demo Admin',deleted:false});
    });

    // Apply demo data without saving to localStorage
    const backup = JSON.stringify(DB.data);
    DB.data = {...DB.defaultSchema(),...demoData};
    this._isDemo = true;
    this._demoBackup = backup;

    // Login as admin demo
    this.currentUser = {id:'demo',name:'ADMIN (Démo)',role:'admin'};
    document.getElementById('auth-overlay').style.display = 'none';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('admin-visible'));
    const navU = document.getElementById('nav-username'); if(navU) navU.textContent = 'Admin (Démo)';
    const mobU = document.getElementById('mob-username'); if(mobU) mobU.textContent = 'Démo';
    UI.renderAll(); Dashboard.refresh();
    UI.toast(I18n.t('toast_demo_mode'),'warning');
  },

  exitDemoMode() {
    if (!this._isDemo) return;
    try { DB.data = JSON.parse(this._demoBackup); } catch(_) { DB.data = DB.defaultSchema(); }
    this._isDemo = false; this._demoBackup = null;
    this.logout();
  },

  /* Auto-logout après 30 min d'inactivité */
  _inactivityTimer: null,
  resetInactivityTimer() {
    clearTimeout(this._inactivityTimer);
    this._inactivityTimer = setTimeout(() => {
      if (this.currentUser && !this._isDemo) {
        this.logout();
        UI.toast(I18n.t('toast_err_timeout'),'warning');
      }
    }, 30 * 60 * 1000);
  },

  logout() {
    this.currentUser = null; this._buf = ''; this._pendingUser = null;
    clearTimeout(this._inactivityTimer);

    // Fermer tous les overlays
    ['seller-dash-overlay','seller-mode-overlay','seller-prefs-overlay',
     'deferred-overlay','eod-overlay','smp-confirm-overlay',
     'smp-partial-overlay','cloud-config-overlay','restock-overlay'
    ].forEach(id => {
      const ov = document.getElementById(id);
      if (ov) { ov.style.display='none'; ov.classList.remove('open','active'); }
    });

    // Restaurer l'interface principale
    ['top-nav','bot-nav','mob-header'].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.removeProperty('display');
    });
    const cont = document.querySelector('.container'); if(cont) cont.style.removeProperty('display');
    const foot = document.querySelector('footer');    if(foot) foot.style.removeProperty('display');

    // Retirer les classes admin
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('admin-visible'));

    // Réinitialiser modules
    if (typeof SellerDash !== 'undefined') SellerDash._active = false;
    if (typeof SellerMode !== 'undefined') { SellerMode._active=false; SellerMode._cart=[]; }

    // Déconnexion — retour direct à la liste des comptes locaux
    this.currentUser = null;
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('admin-visible'));
    this.renderAccountsList();
    const ov = document.getElementById('auth-overlay');
    if (ov) ov.style.display = 'flex';
  },
  isAdmin() { return this.currentUser?.role === 'admin'; },
  async ensureDefaultAdmin() {
    if (DB.data.users.length === 0) {
      DB.data.users.push({ id:Utils.uid(), name:'ADMIN', pinHash:await Utils.sha256('0000'), role:'admin', createdAt:new Date().toISOString() });
      DB.save();
    }
  }
};

/* ═══════════════ UI ═══════════════ */
