'use strict';
const Loyalty = {
  POINTS_PER_UNIT: 1,  // 1 point par unité de devise dépensée (configurable)

  getClientPoints(clientName) {
    if (!DB.data.loyalty) DB.data.loyalty = {};
    return DB.data.loyalty[clientName] || 0;
  },

  addPoints(clientName, amount) {
    if (!clientName || !amount) return;
    if (!DB.data.loyalty) DB.data.loyalty = {};
    const points = Math.floor(amount * this.POINTS_PER_UNIT / 100); // 1 point / 100 FCFA
    DB.data.loyalty[clientName] = (DB.data.loyalty[clientName] || 0) + points;
  },

  redeemPoints(clientName, pointsToRedeem) {
    const current = this.getClientPoints(clientName);
    if (pointsToRedeem > current) return UI.toast(I18n.t('toast_err_points_low'),'danger');
    DB.data.loyalty[clientName] -= pointsToRedeem;
    DB.save();
    UI.toast(`${pointsToRedeem} ${I18n.t('toast_points_used')} ${clientName}`,'success');
    this.render();
  },

  render() {
    const tbody = document.querySelector('#tableLoyalty tbody');
    if (!tbody) return;
    const loyalty = DB.data.loyalty || {};
    const clients = Object.entries(loyalty).filter(([,p])=>p>0).sort((a,b)=>b[1]-a[1]);

    if (!clients.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:32px">Aucun client fidèle enregistré</td></tr>`;
      return;
    }

    tbody.innerHTML = clients.map(([name,points]) => {
      const level = points >= 500 ? '🥇 Gold' : points >= 200 ? '🥈 Silver' : '🥉 Bronze';
      const discount = points >= 500 ? '10%' : points >= 200 ? '5%' : '2%';
      return `<tr>
        <td class="fw-700">${Utils.esc(name)}</td>
        <td class="td-mono" style="color:var(--accent)">${points} pts</td>
        <td><span class="badge badge-yellow">${level}</span></td>
        <td class="td-mono">${discount} remise</td>
        <td><button class="btn btn-warning btn-sm" onclick="Loyalty.redeemPoints('${Utils.esc(name)}',100)" ${points<100?'disabled':''}>Utiliser 100pts</button></td>
      </tr>`;
    }).join('');

    // Stats
    const totalPoints = clients.reduce((t,[,p])=>t+p,0);
    const el = document.getElementById('loyalty-total-points');
    if (el) el.textContent = totalPoints;
    const el2 = document.getElementById('loyalty-clients');
    if (el2) el2.textContent = clients.length;
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: OBJECTIVES — Objectifs de vente
   ═══════════════════════════════════════════════════════ */
