'use strict';
/* Billing — écran d'abonnement du propriétaire (essai, paiement mobile money, activation manuelle). */
const Billing = {
  _months: 1, _autoShown: false, _i: false,
  _isOwner() { const c = CloudAuth.ctx; return !!(c && c.role === 'owner'); },
  _el(id) { return document.getElementById(id); },
  _fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
  _code() { return String((CloudAuth.ctx && CloudAuth.ctx.shopId) || '').slice(0, 8).toUpperCase(); },

  status() {      // { state: 'trial' | 'active' | 'expired' | 'unknown', days, end }
    const s = (typeof Sync !== 'undefined') && Sync.sub;
    if (!s) return { state: 'unknown' };
    const end = new Date(s.status === 'active' ? s.current_period_end : s.trial_ends_at);
    const days = Math.ceil((end - Date.now()) / 864e5);
    if (s.status === 'active' && (!s.current_period_end || days > 0)) return { state: 'active', days, end: s.current_period_end ? end : null };
    if (s.status === 'trialing' && days > 0) return { state: 'trial', days, end };
    return { state: 'expired', days: 0, end };
  },
  statusText() {
    const st = this.status();
    if (st.state === 'active') return st.end ? '✅ Abonnement actif jusqu\'au ' + st.end.toLocaleDateString('fr-FR') + ' (' + st.days + ' j)' : '✅ Abonnement actif';
    if (st.state === 'trial') return '🎁 Essai gratuit : ' + st.days + ' jour(s) restant(s)';
    if (st.state === 'expired') return '⚠ Abonnement expiré : la synchronisation est suspendue (vos données restent sur l\'appareil)';
    return 'Abonnement : vérification…';
  },

  init() {        // carte « Abonnement » en haut des Réglages (propriétaire seulement)
    if (this._i) return;
    const sec = this._el('settings'); if (!sec) return;
    this._i = true;
    const d = document.createElement('div'); d.id = 'billing-card';
    sec.insertBefore(d, sec.firstChild);
    this.render();
  },
  render() {
    const d = this._el('billing-card'); if (!d) return;
    const c = CloudAuth.ctx;
    if (!c) {         // appareil non connecté : on le dit clairement
      d.innerHTML = '<div class="ct-title">☁ Mode local (non connecté)</div>' +
        '<div class="ct-hint">Vos données restent sur cet appareil : elles ne sont ni sauvegardées en ligne, ni partagées avec votre équipe. Connectez-vous pour activer la synchronisation.</div>' +
        '<button class="btn btn-primary" onclick="location.reload()">Se connecter / créer un compte</button>';
      return;
    }
    const who = '<div class="ct-hint">☁ ' + Utils.esc(c.email || '') + ' · ' + ({ owner: 'Propriétaire', manager: 'Gérant', seller: 'Vendeur' }[c.role] || c.role) + ' · « ' + Utils.esc(c.shopName || '') + ' »</div>';
    if (c.role !== 'owner') {
      d.innerHTML = '<div class="ct-title">☁ Compte cloud</div>' + who + '<div class="ct-hint">L\'abonnement est géré par le propriétaire de la boutique.</div>';
      return;
    }
    const wa = c.whatsapp || '';
    d.innerHTML = '<div class="ct-title">💳 Abonnement</div>' + who + '<div class="ct-hint" id="bill-status"></div>' +
      '<div class="ct-hint">💬 ' + (wa
        ? 'WhatsApp : <b>' + Utils.esc(CloudAuth.fmtPhone(wa)) + '</b> · <a href="#" onclick="Billing.editWa();return false">Modifier</a>'
        : '<b>Ajoutez votre WhatsApp</b> : nous vous aidons en quelques minutes en cas de souci et nous vous prévenons avant la fin de votre abonnement. Pas de spam, jamais partagé. <a href="#" onclick="Billing.editWa();return false">Ajouter mon numéro</a>') + '</div>' +
      '<button class="btn btn-primary" onclick="Billing.open()">Payer / Renouveler</button>';
    this._el('bill-status').textContent = this.statusText();
  },
  offerWa(phone) {    // le téléphone des « Identité du Commerce » peut devenir le WhatsApp du compte (une seule fois par session)
    const c = CloudAuth.ctx;
    if (!c || c.role !== 'owner' || c.whatsapp || this._offered || !navigator.onLine) return;
    const d = CloudAuth.normPhone(phone);
    if (d.length < 8 || d.length > 15) return;
    this._offered = true;
    if (confirm('Utiliser ' + CloudAuth.fmtPhone(d) + ' comme numéro WhatsApp de votre compte ?\nNous vous aidons en cas de souci et vous prévenons avant la fin de votre abonnement. Jamais de spam.')) this.setWa(d);
  },
  async setWa(d) {
    try {
      const { error } = await CloudAuth.client.rpc('set_shop_whatsapp', { p_shop: CloudAuth.ctx.shopId, p_whatsapp: d || null });
      if (error) throw error;
      CloudAuth._saveCtx(Object.assign({}, CloudAuth.ctx, { whatsapp: d }));
      this.render(); UI.toast('Numéro WhatsApp enregistré ✔', 'success');
    } catch (e) { UI.toast(CloudAuth._err(e), 'danger'); }
  },
  editWa() {
    const cur = (CloudAuth.ctx && CloudAuth.ctx.whatsapp) || '';
    const v = prompt('Votre numéro WhatsApp (exemple : 01 61 15 61 06).\nNous vous aidons en cas de souci et nous vous prévenons avant la fin de votre abonnement. Jamais de spam.', cur ? CloudAuth.fmtPhone(cur) : '');
    if (v === null) return;
    const d = CloudAuth.normPhone(v);
    if (d && (d.length < 8 || d.length > 15)) return UI.toast('Numéro invalide', 'danger');
    return this.setWa(d);
  },
  onStatus() {    // appelé après chaque synchronisation
    this.render();
    if (this._el('billing-overlay') && this._el('billing-overlay').style.display === 'flex') this._fillStatus();
    if (this._isOwner() && this.status().state === 'expired' && !this._autoShown) { this._autoShown = true; setTimeout(() => this.open(), 1200); }
  },

  open() {
    if (!this._isOwner()) return;
    if (!this._el('billing-overlay')) this._build();
    this._months = BILLING.options[0].months;
    this._drawOptions(); this._fillStatus();
    this._el('billing-overlay').style.display = 'flex';
  },
  close() { const o = this._el('billing-overlay'); if (o) o.style.display = 'none'; },
  _fillStatus() { this._el('bill-st').textContent = this.statusText(); },
  _opt() { return BILLING.options.find(o => o.months === this._months) || BILLING.options[0]; },
  pick(m) { this._months = m; this._drawOptions(); },
  _drawOptions() {
    this._el('bill-opts').innerHTML = BILLING.options.map(o =>
      '<button class="bill-opt' + (o.months === this._months ? ' on' : '') + '" onclick="Billing.pick(' + o.months + ')">' +
      '<b>' + o.label + '</b><span>' + this._fmt(o.price) + ' ' + BILLING.currency + '</span></button>').join('');
    const ms = BILLING.methods.filter(m => m.number);
    this._el('bill-pay').innerHTML = ms.length
      ? '<div class="ct-hint">Envoyez <b>' + this._fmt(this._opt().price) + ' ' + BILLING.currency + '</b> à l\'un de ces numéros :</div>' + ms.map((m, i) =>
          '<div class="ct-row"><div><b>' + Utils.esc(m.name) + '</b><div class="ct-sub">' + Utils.esc(m.number) + (m.holder ? ' · ' + Utils.esc(m.holder) : '') + '</div></div>' +
          '<button class="ct-x ct-share" onclick="Billing.copy(' + BILLING.methods.indexOf(m) + ')">Copier</button></div>').join('')
      : '<div class="ct-hint">Contactez-nous sur WhatsApp pour connaître les numéros de paiement.</div>';
  },
  copy(i) {
    const n = BILLING.methods[i].number;
    (navigator.clipboard ? navigator.clipboard.writeText(n) : Promise.reject()).then(() => UI.toast('Numéro copié', 'success'), () => UI.toast(n, 'info'));
  },
  whatsapp() {
    const o = this._opt(), c = CloudAuth.ctx;
    const text = 'Bonjour, je souhaite activer l\'abonnement Smart Market Pro.\n\nBoutique : ' + c.shopName + '\nCode : ' + this._code() +
      '\nEmail : ' + c.email + '\nDurée : ' + o.label + '\nMontant : ' + this._fmt(o.price) + ' ' + BILLING.currency +
      '\n\nMoyen de paiement : ____\nRéférence de la transaction : ____';
    window.open('https://wa.me/' + String(BILLING.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank');
  },
  async check() {
    const b = this._el('bill-check'); b.disabled = true;
    try { await Sync.now(); } catch (e) {}
    b.disabled = false; this.onStatus(); this._fillStatus();
    if (this.status().state === 'active') { UI.toast('Abonnement actif ✔ Merci !', 'success'); this.close(); }
    else UI.toast('Paiement pas encore enregistré. Réessayez dans quelques minutes.', 'info');
  },
  _build() {
    const o = document.createElement('div'); o.id = 'billing-overlay';
    o.innerHTML = '<div class="auth-card" style="max-height:92vh;overflow-y:auto"><div class="auth-logo">Abonnement</div><div class="auth-sub">Smart Market Pro · PRO</div>' +
      '<div class="ct-hint" id="bill-st"></div><div id="bill-opts" class="bill-opts"></div><div id="bill-pay"></div>' +
      '<div class="ct-hint" style="margin-top:12px">Après le paiement, envoyez la preuve par WhatsApp : votre boutique est activée rapidement.</div>' +
      '<button class="btn btn-primary" onclick="Billing.whatsapp()">J\'ai payé : envoyer la preuve sur WhatsApp</button>' +
      '<button class="btn btn-ghost" id="bill-check" style="margin-top:8px" onclick="Billing.check()">Vérifier mon abonnement</button>' +
      '<button class="cloud-link" onclick="Billing.close()">Plus tard</button></div>';
    document.body.appendChild(o);
  }
};
