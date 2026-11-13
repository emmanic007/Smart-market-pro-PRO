'use strict';
const Share = {

  ticket(saleId) {
    const sale = DB.data.sales.find(s => s.id === saleId);
    if (!sale) return;
    const shop    = Settings.data.shopName || 'Smart Market Pro';
    const phone   = Settings.data.shopPhone || '';
    const curr    = Settings.getCurrency();
    const date    = new Date(sale.date).toLocaleString('fr-FR');

    const text = `🧾 *REÇU — ${shop}*\n` +
      (phone ? `📞 ${phone}\n` : '') +
      `📅 ${date}\n` +
      `👤 Vendeur: ${sale.userName}\n\n` +
      `*${sale.itemName}*\n` +
      `${sale.qty} × ${sale.price} ${curr} = *${sale.total} ${curr}*\n` +
      (sale.debt > 0 ? `⚠️ Reste à payer: ${sale.debt} ${curr}\n` : `✅ Soldé\n`) +
      (sale.clientName ? `👤 Client: ${sale.clientName}\n` : '') +
      `\n_Merci de votre confiance !_\n_Smart Market Pro v7.5_`;

    // Try Web Share API (mobile native)
    if (navigator.share) {
      navigator.share({ title: `Reçu ${shop}`, text }).catch(() => this._fallback(text));
    } else {
      this._fallback(text);
    }
  },

  dayReport() {
    const today   = new Date().toDateString();
    const sales   = DB.activeSales().filter(s => new Date(s.date).toDateString() === today);
    const ca      = sales.reduce((t,s)=>t+s.total,0);
    const profit  = sales.reduce((t,s)=>t+s.profit,0);
    const shop    = Settings.data.shopName || 'Smart Market Pro';
    const curr    = Settings.getCurrency();

    const text = `📊 *RAPPORT JOURNALIER — ${shop}*\n` +
      `📅 ${new Date().toLocaleDateString('fr-FR')}\n\n` +
      `💰 CA: *${ca} ${curr}*\n` +
      `📈 Profit: ${profit} ${curr}\n` +
      `🛒 Ventes: ${sales.length}\n\n` +
      `_Smart Market Pro v7.5_`;

    if (navigator.share) {
      navigator.share({ title: `Rapport ${shop}`, text }).catch(() => this._fallback(text));
    } else {
      this._fallback(text);
    }
  },

  _fallback(text) {
    // WhatsApp Web
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
};

/* ═══════════════ RESTOCK REPORT ═══════════════ */
