'use strict';
const Printer = {
  printTicket(saleId) {
    const sale=DB.data.sales.find(s=>s.id===saleId); if(!sale) return;
    const shop=Settings.data.shopName||'Smart Market Pro';
    const phone=Settings.data.shopPhone||'';
    const area=document.getElementById('print-area');
    area.innerHTML=`
      <div class="t-center t-bold" style="font-size:14px">${Utils.esc(shop)}</div>
      ${phone?`<div class="t-center">${Utils.esc(phone)}</div>`:''}
      <div class="t-line"></div>
      <div class="t-center">${new Date(sale.date).toLocaleString('fr-FR')}</div>
      <div class="t-center">Vendeur: ${Utils.esc(sale.userName)}</div>
      <div class="t-line"></div>
      <div class="t-row"><span>${Utils.esc(sale.itemName)}</span></div>
      <div class="t-row"><span>${sale.qty} × ${Utils.currency(sale.price)}</span><span class="t-bold">${Utils.currency(sale.total)}</span></div>
      ${sale.debt>0?`<div class="t-row"><span style="color:red">Dette</span><span style="color:red">${Utils.currency(sale.debt)}</span></div>`:''}
      <div class="t-line"></div>
      <div class="t-row t-bold"><span>TOTAL</span><span>${Utils.currency(sale.total)}</span></div>
      ${sale.clientName?`<div class="t-center">Client: ${Utils.esc(sale.clientName)}</div>`:''}
      <div class="t-line"></div>
      <div class="t-center" style="font-size:10px">Merci de votre visite !</div>`;
    window.print();
  },
  printDayReport() {
    const today=new Date().toDateString();
    const sales=DB.activeSales().filter(s=>new Date(s.date).toDateString()===today);
    const ca=sales.reduce((s,v)=>s+v.total,0);
    const pft=sales.reduce((s,v)=>s+v.profit,0);
    const debt=sales.reduce((s,v)=>s+v.debt,0);
    const shop=Settings.data.shopName||'Smart Market Pro';
    const area=document.getElementById('print-area');
    area.innerHTML=`
      <div class="t-center t-bold" style="font-size:14px">${Utils.esc(shop)}</div>
      <div class="t-center t-bold">RAPPORT JOURNALIER</div>
      <div class="t-center">${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      <div class="t-line"></div>
      <div class="t-row"><span>CA</span><span class="t-bold">${Utils.currency(ca)}</span></div>
      <div class="t-row"><span>Profit Net</span><span>${Utils.currency(pft)}</span></div>
      <div class="t-row"><span>Dettes</span><span>${Utils.currency(debt)}</span></div>
      <div class="t-row"><span>Transactions</span><span>${sales.length}</span></div>
      <div class="t-line"></div>
      <div class="t-bold" style="margin-bottom:4px">Détail des ventes</div>
      ${sales.map(s=>`<div class="t-row"><span>${Utils.esc(s.itemName)}</span><span>${Utils.currency(s.total)}</span></div>`).join('')}
      <div class="t-line"></div>`;
    window.print();
  },
  printCashReport() {
    const fond    = Utils.num(document.getElementById('cr-fond')?.value)    || 0;
    const counted = Utils.num(document.getElementById('cr-counted')?.value) || 0;
    const shop    = Settings.data.shopName || 'Smart Market Pro';
    const today   = new Date().toDateString();
    const todayS  = DB.activeSales().filter(s => new Date(s.date).toDateString()===today);
    const caT     = todayS.reduce((t,s) => t+s.total, 0);
    const dT      = todayS.reduce((t,s) => t+s.debt,  0);
    const cashIn  = caT - dT;
    const theo    = fond + cashIn;
    const ecart   = counted - theo;
    const area    = document.getElementById('print-area');
    area.innerHTML =
      '<div class="t-center t-bold" style="font-size:14px">' + Utils.esc(shop) + '</div>'
      + '<div class="t-center t-bold">CLOTURE DE CAISSE</div>'
      + '<div class="t-center">' + new Date().toLocaleString('fr-FR') + '</div>'
      + '<div class="t-line"></div>'
      + '<div class="t-row"><span>Fond ouverture</span><span>' + Utils.currency(fond)    + '</span></div>'
      + '<div class="t-row"><span>CA encaisse</span><span>'    + Utils.currency(cashIn)  + '</span></div>'
      + '<div class="t-row"><span>Credits</span><span>-'       + Utils.currency(dT)      + '</span></div>'
      + '<div class="t-line"></div>'
      + '<div class="t-row t-bold"><span>Theorique</span><span>'   + Utils.currency(theo)    + '</span></div>'
      + '<div class="t-row t-bold"><span>Compte</span><span>'      + Utils.currency(counted) + '</span></div>'
      + '<div class="t-line"></div>'
      + '<div class="t-row t-bold"><span>ECART</span><span>'  + (ecart>=0?'+':'') + Utils.currency(ecart) + '</span></div>'
      + '<div class="t-center" style="font-size:10px;margin-top:6px">'
      + (Math.abs(ecart)<100 ? 'Conforme' : ecart<0 ? 'MANQUE' : 'EXCEDENT') + '</div>';
    window.print();
  },
  exportDebtsPDF() {
    const map=Debts._byClient();
    const clients=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    const shop=Settings.data.shopName||'Smart Market Pro';
    const area=document.getElementById('print-area');
    area.innerHTML=`
      <div class="t-center t-bold" style="font-size:14px">${Utils.esc(shop)}</div>
      <div class="t-center t-bold">REGISTRE DES DETTES</div>
      <div class="t-center">${new Date().toLocaleDateString('fr-FR')}</div>
      <div class="t-line"></div>
      ${clients.map(([name,d])=>`<div class="t-row"><span>${Utils.esc(name)}</span><span class="t-bold">${Utils.currency(d.total)}</span></div>`).join('')}
      <div class="t-line"></div>
      <div class="t-row t-bold"><span>TOTAL</span><span>${Utils.currency(clients.reduce((s,[,d])=>s+d.total,0))}</span></div>`;
    window.print();
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: AI ADVANCED — IA avec mémoire évolutive
   - Mémoire de session et long-terme (localStorage)
   - Auto-amélioration basée sur les interactions
   - Réponses détaillées style GPT avec analyse poussée
   - Conseil proactif quotidien
   - Prédictions basées sur l'historique
   ═══════════════════════════════════════════════════════ */
