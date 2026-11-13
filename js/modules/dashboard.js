'use strict';
const Dashboard = {
  refresh() {
    const now      = new Date();
    const today    = now.toDateString();
    const todayS   = DB.activeSales().filter(s => new Date(s.date).toDateString() === today);
    const ca       = todayS.reduce((s,v)=>s+v.total, 0);
    const pft      = todayS.reduce((s,v)=>s+v.profit, 0);
    const margin   = ca > 0 ? ((pft/ca)*100).toFixed(1) : 0;
    const allDebt  = DB.activeSales().reduce((s,v)=>s+v.debt, 0);
    const debtClients = new Set(DB.activeSales().filter(s=>s.debt>0).map(s=>s.clientName||s.id)).size;
    const alerts   = DB.data.items.filter(i=>i.qty<=(i.min||5)).length;

    // Date & greeting
    const hours = now.getHours();
    const greet = hours < 12 ? I18n.t('dash_greet_morning') : hours < 18 ? I18n.t('dash_greet_afternoon') : I18n.t('dash_greet_evening');
    const user  = Auth.currentUser?.name || '';
    const locale  = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
    const dateStr = now.toLocaleDateString(locale, {weekday:'long', day:'numeric', month:'long', year:'numeric'});

    // Retours du jour
    const todayReturns = (DB.data.returns||[]).filter(r => new Date(r.date).toDateString() === today);
    const returnedAmt  = todayReturns.reduce((t,r) => t + r.amount, 0);

    // Dépenses du jour
    const todayExp = (DB.data.expenses||[]).filter(e => new Date(e.date||0).toDateString() === today);
    const totalExp = todayExp.reduce((t,e) => t + e.amount, 0);

    const se = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    se('dash-greeting',     greet + (user ? ', ' + user : '') + ' 👋');
    se('dash-date',         dateStr);
    se('dash-ca-today',     Utils.currency(ca));
    se('dash-ca-sub',       todayS.length + ' ' + I18n.t('dash_sales_count') + (returnedAmt>0 ? ' — ' + I18n.t('dash_returns_prefix') + Utils.currency(returnedAmt) : ''));
    se('dash-pft-today',    Utils.currency(pft));
    se('dash-expenses-today', Utils.currency(totalExp));
    se('dash-expenses-sub',   todayExp.length + ' ' + I18n.t('lbl_expenses_word'));
    if (typeof Expenses !== 'undefined') {
      const _nr  = Expenses.getRealNetProfit();
      const _del = document.getElementById('dash-margin-sub');
      if (_del) _del.textContent = I18n.t('dash_real_net_profit') + ' : ' + Utils.currency(_nr);
    }
    se('dash-margin-sub',   I18n.t('dash_margin_prefix') + margin + '%');
    se('dash-debt',         Utils.currency(allDebt));
    se('dash-debt-clients', debtClients + ' ' + I18n.t('dash_debtor_clients'));
    se('dash-alerts',       alerts);
    // Badge stock mobile (onglet bas)
    const stockBadge = document.getElementById('stock-alert-badge');
    if (stockBadge) {
      stockBadge.style.display = alerts > 0 ? '' : 'none';
      stockBadge.textContent   = alerts > 9 ? '9+' : String(alerts);
    }
    // Badge "Plus" desktop
    const moreBadge = document.getElementById('nav-more-badge');
    if (moreBadge) {
      moreBadge.style.display = alerts > 0 ? '' : 'none';
      moreBadge.textContent   = alerts > 9 ? '9+' : String(alerts);
    }

    // Recent sales (last 5)
    const recent = DB.activeSales().filter(s => new Date(s.date).toDateString() === today).reverse().slice(0,5);
    const recentEl = document.getElementById('dash-recent-sales');
    if (recentEl) {
      if (!recent.length) {
        recentEl.innerHTML = `<div style="text-align:center;color:var(--text3);padding:20px;font-size:.82rem">${I18n.t('sd_no_sales_today')}</div>`;
      } else {
        recentEl.innerHTML = recent.map(s => `
          <div class="dash-sale-row">
            <div>
              <div style="font-weight:700;font-size:.82rem">${Utils.esc(s.itemName)}</div>
              <div style="font-size:.7rem;color:var(--text3);font-family:var(--fm)">${new Date(s.date).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})} — ${Utils.esc(s.userName)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;color:var(--accent);font-family:var(--fm)">${Utils.currency(s.total)}</div>
              ${s.debt>0 ? '<div style="font-size:.68rem;color:var(--danger)">' + I18n.t('lbl_debt') + ': '+Utils.currency(s.debt)+'</div>' : ''}
            </div>
          </div>`).join('');
      }
    }

    // Top products today
    const pm = {};
    todayS.forEach(s => { if(!pm[s.itemName]) pm[s.itemName]={ca:0,qty:0}; pm[s.itemName].ca+=s.total; pm[s.itemName].qty+=s.qty; });
    const top3 = Object.entries(pm).sort((a,b)=>b[1].ca-a[1].ca).slice(0,3);
    const topEl = document.getElementById('dash-top-products');
    if (topEl) {
      if (!top3.length) {
        topEl.innerHTML = `<div style="text-align:center;color:var(--text3);padding:16px;font-size:.82rem">${I18n.t('sd_no_sales_today')}</div>`;
      } else {
        const maxCA = top3[0][1].ca;
        const medals = ['🥇','🥈','🥉'];
        topEl.innerHTML = top3.map(([name,d],i) => `
          <div class="top-row">
            <div class="top-rank">${medals[i]}</div>
            <div class="top-bar-wrap">
              <div class="top-bar-label">${Utils.esc(name)}</div>
              <div class="top-bar-bg"><div class="top-bar-fill" style="width:${maxCA>0?(d.ca/maxCA*100).toFixed(0):0}%"></div></div>
            </div>
            <div class="top-bar-val">${Utils.currency(d.ca)}</div>
          </div>`).join('');
      }
    }

    // AI daily tip
    this._generateAITip(todayS, ca, pft, alerts, allDebt);
    // Objectives progress
    if (typeof Objectives !== 'undefined') Objectives.renderProgress();
  },

  _generateAITip(todayS, ca, pft, alerts, allDebt) {
    const el   = document.getElementById('dash-ai-tip');
    if (!el) return;
    const curr = Settings.getCurrency();
    const margin = ca > 0 ? ((pft/ca)*100).toFixed(1) : 0;

    const tips = [];

    if (alerts > 0) {
      const names = DB.data.items.filter(i=>i.qty<=(i.min||5)).slice(0,2).map(i=>i.name).join(', ');
      tips.push(`⚠️ <strong>${alerts} produit(s)</strong> en alerte stock : <em>${names}</em>. Pensez à réapprovisionner.`);
    }

    if (allDebt > 0) {
      const topDebtor = (() => {
        const dm={};
        DB.activeSales().filter(s=>s.debt>0).forEach(s=>{const cl=s.clientName||'Inconnu';if(!dm[cl])dm[cl]=0;dm[cl]+=s.debt;});
        const sorted = Object.entries(dm).sort((a,b)=>b[1]-a[1]);
        return sorted[0] ? sorted[0][0] + ' (' + sorted[0][1] + ' ' + curr + ')' : null;
      })();
      if (topDebtor) tips.push(`💳 Principal débiteur : <strong>${Utils.esc(topDebtor)}</strong>. Pensez à le contacter.`);
    }

    const negMargin = DB.data.items.filter(i=>i.sell<i.buy);
    if (negMargin.length) {
      tips.push(`📉 <strong>${negMargin[0].name}</strong> est vendu à perte. Révisez son prix de vente.`);
    }

    if (todayS.length === 0) {
      const hour = new Date().getHours();
      if (hour >= 10) tips.push(`🔔 Aucune vente enregistrée aujourd'hui. Vérifiez que des produits sont disponibles en stock.`);
    } else if (parseFloat(margin) < 10 && ca > 0) {
      tips.push(`📊 Marge du jour : <strong>${margin}%</strong>. Objectif recommandé : >15%. Envisagez d'optimiser vos prix.`);
    } else if (ca > 0) {
      tips.push(`✅ Bonne journée ! CA : <strong>${Utils.currency(ca)}</strong>, Profit : <strong>${Utils.currency(pft)}</strong> (${margin}% de marge).`);
    }

    // Prediction: stock exhaustion
    const allSales = DB.activeSales();
    DB.data.items.forEach(i => {
      if (i.qty <= 0) return;
      const last7 = allSales.filter(s => {
        const d = new Date(s.date); const now = new Date();
        return s.itemId===i.id && (now-d)/(1000*3600*24) <= 7;
      });
      const dailyAvg = last7.reduce((s,v)=>s+v.qty,0) / 7;
      if (dailyAvg > 0) {
        const daysLeft = Math.floor(i.qty / dailyAvg);
        if (daysLeft <= 3 && daysLeft > 0) {
          tips.push(`🔮 <strong>${i.name}</strong> : à ce rythme, il sera épuisé dans <strong>${daysLeft} jour(s)</strong>.`);
        }
      }
    });

    if (!tips.length) tips.push(`💡 Tout semble en ordre ! Consultez l'onglet <strong>Analyses</strong> pour plus de détails sur vos performances.`);

    el.innerHTML = tips[0];
  }
};

/* ═══════════════ INIT ═══════════════ */
