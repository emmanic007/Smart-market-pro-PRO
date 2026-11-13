'use strict';
const Analytics = {
  _chart: null,
  _customStart: null,
  _customEnd: null,
  updateCash() {
    const v=Utils.num(document.getElementById('cash-init')?.value);
    if (!isNaN(v)&&v>=0) { DB.data.cashInit=v; DB.save(); this.refresh(); }
  },
  onPeriodChange() {
    const period = document.getElementById('timePeriod')?.value || 'day';
    const box = document.getElementById('analytics-custom-range');
    if (period === 'custom') {
      if (box) box.style.display = 'flex';
      const fromEl = document.getElementById('analytics-custom-from');
      const toEl   = document.getElementById('analytics-custom-to');
      if (!this._customStart || !this._customEnd) {
        const today = new Date();
        const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
        this._customStart = weekAgo;
        this._customEnd   = today;
      }
      if (fromEl) fromEl.value = this._customStart.toISOString().slice(0,10);
      if (toEl)   toEl.value   = this._customEnd.toISOString().slice(0,10);
      if (toEl)   toEl.max     = new Date().toISOString().slice(0,10);
    } else {
      if (box) box.style.display = 'none';
    }
    this.refresh();
  },
  applyCustomRange() {
    const fromEl = document.getElementById('analytics-custom-from');
    const toEl   = document.getElementById('analytics-custom-to');
    const fromV  = fromEl?.value, toV = toEl?.value;
    if (!fromV || !toV) { UI.toast(I18n.t('toast_err_dates_required'), 'warning'); return; }
    const start = new Date(fromV + 'T00:00:00');
    const end   = new Date(toV + 'T23:59:59');
    if (start > end) { UI.toast(I18n.t('toast_err_date_range_invalid'), 'warning'); return; }
    this._customStart = start;
    this._customEnd   = end;
    this.refresh();
  },
  refresh() {
    const period = document.getElementById('timePeriod')?.value || 'day';
    const sales  = period === 'custom'
      ? DB.activeSales().filter(s => {
          const t = new Date(s.date).getTime();
          return t >= this._customStart.getTime() && t <= this._customEnd.getTime();
        })
      : DB.salesInPeriod(period);
    const ca   = sales.reduce((s,v)=>s+v.total,0);
    const pft  = sales.reduce((s,v)=>s+v.profit,0);
    const debt = sales.reduce((s,v)=>s+v.debt,0);
    const margin   = ca>0?((pft/ca)*100).toFixed(1):'0';
    const debtCnt  = sales.filter(s=>s.debt>0).length;
    const se = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };

    // Dépenses du jour (heure locale)
    const todayStr = new Date().toDateString();
    const todayExp = (DB.data.expenses||[]).filter(e => new Date(e.date||0).toDateString()===todayStr);
    const totalExp = todayExp.reduce((t,e)=>t+e.amount,0);

    se('st-ca',   Utils.currency(ca));
    se('st-pft',  Utils.currency(pft));
    se('st-debt', Utils.currency(debt));
    se('st-cash', Utils.currency(DB.data.cashInit+(ca-debt)));
    se('st-margin-sub', `Marge nette : ${margin}%`);

    // Cartes dashboard home
    se('dash-ca-today',       Utils.currency(ca));
    se('dash-ca-sub',         `${sales.length} vente${sales.length!==1?'s':''}`);
    se('dash-pft-today',      Utils.currency(pft));
    se('dash-margin-sub',     `Marge : ${margin}%`);
    se('dash-debt',           Utils.currency(debt));
    se('dash-debt-clients',   `${debtCnt} client${debtCnt!==1?'s':''}`);
    se('dash-expenses-today', Utils.currency(totalExp));
    se('dash-expenses-sub',   `${todayExp.length} dépense${todayExp.length!==1?'s':''}`);

    // Retours sur la période
    const periodReturns = period === 'custom'
      ? (DB.data.returns||[]).filter(r => {
          const t = new Date(r.date).getTime();
          return t >= this._customStart.getTime() && t <= this._customEnd.getTime();
        })
      : (DB.data.returns||[]).filter(r => new Date(r.date).getTime() >= Utils.periodStart(period));
    const retAmt = periodReturns.reduce((t,r)=>t+r.amount,0);
    if (retAmt > 0) {
      const retEl = document.getElementById('st-returns-info');
      if (retEl) { retEl.textContent = 'Retours : -' + Utils.currency(retAmt); retEl.style.display=''; }
    } else {
      const retEl = document.getElementById('st-returns-info');
      if (retEl) retEl.style.display = 'none';
    }
    se('st-debt-sub',   `${debtCnt} transaction(s) à crédit`);
    const cEl=document.getElementById('cash-init'); if(cEl&&!cEl.value) cEl.value=DB.data.cashInit||'';
    this._renderChart(period);
    this._renderTopProds(sales);
    this._renderSellers(sales);
    Alerts.generate();
  },
  _renderChart(period) {
    const canvas = document.getElementById('mainChart'); if(!canvas) return;
    if (typeof Chart === 'undefined' || !Chart) {
      canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--fm);font-size:.8rem">Graphique indisponible — connexion internet requise</div>';
      return;
    }
    if (this._chart) { this._chart.destroy(); this._chart=null; }
    const { labels, caData, pftData } = this._buildData(period);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e87a';
    this._chart = new Chart(canvas, {
      type:'line',
      data:{labels, datasets:[
        {label:'CA',    data:caData,  borderColor:accent,    backgroundColor:accent+'18',   fill:true, tension:.4, pointRadius:3, pointBackgroundColor:accent},
        {label:'Profit',data:pftData, borderColor:'#3b9eff', backgroundColor:'#3b9eff10', fill:true, tension:.4, pointRadius:3, pointBackgroundColor:'#3b9eff'}
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{labels:{color:'#6b8099',font:{family:'DM Mono',size:10}}},
          tooltip:{backgroundColor:'#0e1318',borderColor:'#1e2a36',borderWidth:1,titleColor:'#e8f0f8',bodyColor:'#6b8099',
            callbacks:{label:ctx=>` ${ctx.dataset.label}: ${Utils.currency(ctx.parsed.y)}`}}
        },
        scales:{
          x:{ticks:{color:'#3d5166',font:{family:'DM Mono',size:9},maxRotation:45},grid:{color:'#1e2a3640'}},
          y:{ticks:{color:'#3d5166',font:{family:'DM Mono',size:9},callback:v=>Utils.currency(v)},grid:{color:'#1e2a3640'}}
        }
      }
    });
  },
  _buildData(period) {
    const now=new Date(), sales=DB.activeSales();
    const labels=[], caData=[], pftData=[];
    const push = arr => { caData.push(arr.reduce((t,v)=>t+v.total,0)); pftData.push(arr.reduce((t,v)=>t+v.profit,0)); };
    if (period==='custom') {
      const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
      const start = new Date(this._customStart); start.setHours(0,0,0,0);
      const end   = new Date(this._customEnd);   end.setHours(0,0,0,0);
      const dayMs = 86400000;
      const nbDays = Math.round((end - start) / dayMs) + 1;
      if (nbDays <= 62) {
        // Un point par jour
        for (let i=0;i<nbDays;i++) {
          const d = new Date(start.getTime() + i*dayMs);
          labels.push(d.toLocaleDateString(locale,{day:'numeric',month:'short'}));
          push(sales.filter(v=>new Date(v.date).toDateString()===d.toDateString()));
        }
      } else {
        // Plage trop longue : un point par mois pour rester lisible
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cursor <= end) {
          const y = cursor.getFullYear(), m = cursor.getMonth();
          labels.push(cursor.toLocaleDateString(locale,{month:'short',year:'2-digit'}));
          push(sales.filter(v=>{const vd=new Date(v.date);return vd.getFullYear()===y&&vd.getMonth()===m;}));
          cursor.setMonth(cursor.getMonth()+1);
        }
      }
    } else if (period==='day') {
      for (let h=0;h<24;h++) { labels.push(String(h).padStart(2,'0')+'h'); push(sales.filter(v=>{const d=new Date(v.date);return d.toDateString()===now.toDateString()&&d.getHours()===h;})); }
    } else if (period==='week') {
      for (let i=6;i>=0;i--) { const d=new Date(now); d.setDate(d.getDate()-i); d.setHours(0,0,0,0); labels.push(d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'})); push(sales.filter(v=>new Date(v.date).toDateString()===d.toDateString())); }
    } else if (period==='month') {
      const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
      for (let d=1;d<=days;d++) { labels.push(String(d)); push(sales.filter(v=>{const vd=new Date(v.date);return vd.getFullYear()===now.getFullYear()&&vd.getMonth()===now.getMonth()&&vd.getDate()===d;})); }
    } else {
      ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'].forEach((m,idx)=>{ labels.push(m); push(sales.filter(v=>{const vd=new Date(v.date);return vd.getFullYear()===now.getFullYear()&&vd.getMonth()===idx;})); });
    }
    return {labels, caData, pftData};
  },
  _renderTopProds(sales) {
    const c = document.getElementById('top-products-list'); if(!c) return;
    const map={};
    sales.forEach(s=>{ if(!map[s.itemName]) map[s.itemName]={ca:0,qty:0}; map[s.itemName].ca+=s.total; map[s.itemName].qty+=s.qty; });
    const top5=Object.entries(map).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5);
    if (!top5.length) { c.innerHTML='<div class="empty-state"><p>Aucune donnée</p></div>'; return; }
    const maxCA=top5[0][1].ca; const ranks=['gold','silver','bronze'];
    c.innerHTML=top5.map(([name,d],i)=>`
      <div class="top-row"><div class="top-rank ${ranks[i]||''}">${i+1}</div>
      <div class="top-bar-wrap"><div class="top-bar-label">${Utils.esc(name)}</div>
      <div class="top-bar-bg"><div class="top-bar-fill" style="width:${maxCA>0?(d.ca/maxCA*100).toFixed(1):0}%"></div></div></div>
      <div class="top-bar-val">${Utils.currency(d.ca)}<br><span style="font-size:.62rem;color:var(--text3)">${d.qty} vendus</span></div></div>`).join('');
  },
  _renderSellers(sales) {
    const c = document.getElementById('sellers-perf-list'); if(!c) return;
    const map={};
    sales.forEach(s=>{ if(!map[s.userName]) map[s.userName]={ca:0,count:0}; map[s.userName].ca+=s.total; map[s.userName].count++; });
    const sorted=Object.entries(map).sort((a,b)=>b[1].ca-a[1].ca);
    if (!sorted.length) { c.innerHTML='<div class="empty-state"><p>Aucune donnée</p></div>'; return; }
    const maxCA=sorted[0][1].ca;
    c.innerHTML=sorted.map(([name,d],i)=>`
      <div class="top-row"><div class="top-rank ${i===0?'gold':''}">${i+1}</div>
      <div class="top-bar-wrap"><div class="top-bar-label">${Utils.esc(name)}</div>
      <div class="top-bar-bg"><div class="top-bar-fill" style="width:${maxCA>0?(d.ca/maxCA*100).toFixed(1):0}%;background:var(--info)"></div></div></div>
      <div class="top-bar-val">${Utils.currency(d.ca)}<br><span style="font-size:.62rem;color:var(--text3)">${d.count} vente(s)</span></div></div>`).join('');
  }
};

/* ═══════════════ ALERTS ═══════════════ */
