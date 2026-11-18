'use strict';
/* Platform — réglages modifiables depuis la console d'administration (tarifs, numéros de paiement, WhatsApp, essai, annonce).
   Les dernières valeurs reçues sont gardées sur l'appareil : elles fonctionnent aussi hors ligne. */
const Platform = {
  KEY: 'SMP_PLATFORM', trialDays: 14, announcement: null,
  apply(s) {
    if (!s) return;
    if (Array.isArray(s.prices) && s.prices.length)
      BILLING.options = s.prices.map(o => ({ months: +o.months, price: +o.price, label: String(o.label || (o.months + ' mois')) }));
    if (Array.isArray(s.methods))
      BILLING.methods = s.methods.map(m => ({ name: String(m.name || ''), number: String(m.number || ''), holder: String(m.holder || '') }));
    if (s.support_whatsapp) BILLING.whatsapp = String(s.support_whatsapp);
    if (s.trial_days) this.trialDays = +s.trial_days;
    this.announcement = s.announcement || null;
  },
  load() { try { this.apply(JSON.parse(localStorage.getItem(this.KEY) || 'null')); } catch (e) {} },
  async refresh(client) {
    try {
      const { data, error } = await client.rpc('get_public_settings');
      if (error || !data) return;
      localStorage.setItem(this.KEY, JSON.stringify(data));
      this.apply(data);
      if (typeof Billing !== 'undefined' && Billing.render) Billing.render();
      this.showAnnouncement();
    } catch (e) {}
  },
  showAnnouncement() {      // bandeau fermable ; une fois fermé, une même annonce ne revient pas
    const a = this.announcement, old = document.getElementById('cloud-banner');
    const hide = !a || !a.message || (a.until && Date.now() > a.until) || localStorage.getItem('SMP_ANN_SEEN') === String(a.id);
    if (hide) { if (old) old.remove(); return; }
    if (!document.body) return;
    const b = old || document.createElement('div');
    b.id = 'cloud-banner'; b.className = 'cloud-banner' + (a.level === 'warn' ? ' warn' : '');
    b.innerHTML = '<span></span><button aria-label="Fermer">✕</button>';
    b.firstChild.textContent = a.message;
    b.lastChild.onclick = () => { try { localStorage.setItem('SMP_ANN_SEEN', String(a.id)); } catch (e) {} b.remove(); };
    if (!old) document.body.appendChild(b);
  }
};
Platform.load();
