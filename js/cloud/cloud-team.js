'use strict';
/* CloudTeam — équipe cloud : propriétaire/gérants voient les membres ; le propriétaire invite et retire. */
const CloudTeam = {
  members: [], _i: false,
  ROLE: { owner: 'Propriétaire', manager: 'Gérant', seller: 'Vendeur' },
  _canSee() { const c = CloudAuth.ctx; return !!(c && (c.role === 'owner' || c.role === 'manager')); },
  _isOwner() { const c = CloudAuth.ctx; return !!(c && c.role === 'owner'); },
  _el(id) { return document.getElementById(id); },

  init() {      // ajoute le panneau en haut de l'onglet Équipe
    if (this._i) return;
    const sec = this._el('users'); if (!sec) return;
    this._i = true;
    const d = document.createElement('div'); d.id = 'cloud-team';
    sec.insertBefore(d, sec.firstChild);
    const o = UI.renderUsers.bind(UI);
    UI.renderUsers = () => { o(); if (UI._currentTab === 'users') this.render(); };
  },

  async fetch() {
    const C = CloudAuth;
    if (!C.client || !this._canSee()) return false;
    const { data, error } = await C.client.rpc('list_members', { p_shop: C.ctx.shopId });
    if (error) throw error;
    this.members = data || [];
    this._syncLocalUsers();
    return true;
  },
  _syncLocalUsers() {    // les vendeurs cloud apparaissent dans les rapports (commissions, historique) de cet appareil
    const sellers = this.members.filter(m => m.role === 'seller' && m.user_id && !m.pending);
    const ids = new Set(sellers.map(m => 'cloud_' + m.user_id));
    let ch = false;
    sellers.forEach(m => {
      const id = 'cloud_' + m.user_id, name = m.display_name || String(m.email).split('@')[0];
      const u = DB.data.users.find(x => x.id === id);
      if (!u) { DB.data.users.push({ id, name, pinHash: 'cloud-no-pin', role: 'seller', cloud: true, createdAt: new Date().toISOString() }); ch = true; }
      else if (u.name !== name) { u.name = name; ch = true; }
    });
    const n = DB.data.users.length;
    DB.data.users = DB.data.users.filter(u => !u.cloud || ids.has(u.id));
    if (DB.data.users.length !== n) ch = true;
    if (ch) DB.save();
  },

  render() {
    const box = this._el('cloud-team'); if (!box) return;
    if (!this._canSee()) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    if (!this._el('ct-list')) {
      box.innerHTML = '<div class="ct-title">☁ Équipe en ligne</div>' +
        '<div class="ct-hint">Chaque vendeur se connecte avec son propre email sur son téléphone. Ses ventes arrivent ici automatiquement.</div>' +
        '<div id="ct-list" class="ct-list"></div>' +
        (this._isOwner() ?
          '<div class="ct-form"><input id="ct-name" type="text" placeholder="Nom du vendeur (affiché sur les ventes)" maxlength="40">' +
          '<input id="ct-email" type="email" placeholder="Email du vendeur">' +
          '<select id="ct-role"><option value="seller">Vendeur</option><option value="manager">Gérant</option></select>' +
          '<button class="btn btn-primary" onclick="CloudTeam.invite()">Inviter</button></div>' : '');
    }
    this._list();
    if (!navigator.onLine) { this._el('ct-list').insertAdjacentHTML('afterbegin', '<div class="ct-hint">Hors ligne : liste enregistrée.</div>'); return; }
    this.fetch().then(() => this._list()).catch(e => { this._el('ct-list').textContent = CloudAuth._err(e); });
  },
  _list() {
    const L = this._el('ct-list'); if (!L) return;
    if (!this.members.length) { L.innerHTML = '<div class="ct-hint">Chargement…</div>'; return; }
    const order = { owner: 0, manager: 1, seller: 2 };
    const rows = this.members.map((m, i) => ({ m, i })).sort((a, b) => (a.m.pending - b.m.pending) || (order[a.m.role] - order[b.m.role]));
    L.innerHTML = rows.map(({ m, i }) => {
      const nm = Utils.esc(m.display_name || String(m.email).split('@')[0]);
      const act = (m.pending ? '<button class="ct-x ct-share" onclick="CloudTeam.share(' + i + ')">Partager</button>' : '') +
        (this._isOwner() && m.role !== 'owner'
          ? '<button class="ct-x" onclick="CloudTeam.' + (m.pending ? 'cancel' : 'remove') + '(' + i + ')">' + (m.pending ? 'Annuler' : 'Retirer') + '</button>' : '');
      return '<div class="ct-row"><div><b>' + nm + '</b><div class="ct-sub">' + Utils.esc(m.email) + '</div></div>' +
        '<div class="ct-badge ct-' + m.role + '">' + (m.pending ? '⏳ En attente · ' : '') + this.ROLE[m.role] + '</div>' + act + '</div>';
    }).join('');
  },

  async invite() {
    const name = this._el('ct-name').value.trim(), email = this._el('ct-email').value.trim(), role = this._el('ct-role').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return UI.toast('Email invalide', 'danger');
    if (!navigator.onLine) return UI.toast('Connexion internet requise', 'danger');
    try {
      const { data, error } = await CloudAuth.client.rpc('invite_member', { p_shop: CloudAuth.ctx.shopId, p_email: email, p_role: role, p_name: name || null });
      if (error) throw error;
      UI.toast(data === 'added' ? 'Membre ajouté ✔' : 'Invitation enregistrée : touchez « Partager » pour l\'envoyer (WhatsApp, SMS…)', 'success');
      this._el('ct-name').value = ''; this._el('ct-email').value = '';
      await this.fetch(); this._list();
    } catch (e) { UI.toast(CloudAuth._err(e), 'danger'); }
  },
  inviteText(m) {   // aucun email automatique : on partage le message par WhatsApp, SMS, etc.
    const url = location.origin + location.pathname, shop = (CloudAuth.ctx && CloudAuth.ctx.shopName) || 'ma boutique';
    return 'Bonjour' + (m.display_name ? ' ' + m.display_name : '') + ', tu es invité(e) à rejoindre la boutique « ' + shop + ' » sur Smart Market Pro.\n\n' +
      '1) Ouvre : ' + url + '\n2) Touche « Créer un compte »\n3) Utilise exactement cet email : ' + m.email + '\n\nTu entreras directement dans la boutique.';
  },
  share(i) {
    const m = this.members[i]; if (!m) return;
    const text = this.inviteText(m);
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  },
  async remove(i) {
    const m = this.members[i]; if (!m) return;
    if (!confirm('Retirer ' + (m.display_name || m.email) + ' de la boutique ?\nSes ventes déjà enregistrées sont conservées.')) return;
    try {
      const { error } = await CloudAuth.client.rpc('remove_member', { p_shop: CloudAuth.ctx.shopId, p_user: m.user_id });
      if (error) throw error;
      await this.fetch(); this._list();
    } catch (e) { UI.toast(CloudAuth._err(e), 'danger'); }
  },
  async cancel(i) {
    const m = this.members[i]; if (!m) return;
    try {
      const { error } = await CloudAuth.client.rpc('cancel_invitation', { p_shop: CloudAuth.ctx.shopId, p_email: m.email });
      if (error) throw error;
      await this.fetch(); this._list();
    } catch (e) { UI.toast(CloudAuth._err(e), 'danger'); }
  }
};
