'use strict';
const Objectives = {

  getDaily() { return DB.data.dailyObjective || 0; },
  getMonthly() { return DB.data.monthlyObjective || 0; },

  setDaily() {
    const val = Utils.num(document.getElementById('obj-daily')?.value);
    if (isNaN(val) || val <= 0) return UI.toast(I18n.t('toast_err_objective_invalid'),'danger');
    DB.data.dailyObjective = val;
    DB.save();
    this.renderProgress();
    UI.toast(`${I18n.t('toast_objective_day')} : ${Utils.currency(val)}`,'success');
  },

  setMonthly() {
    const val = Utils.num(document.getElementById('obj-monthly')?.value);
    if (isNaN(val) || val <= 0) return UI.toast(I18n.t('toast_err_objective_invalid'),'danger');
    DB.data.monthlyObjective = val;
    DB.save();
    this.renderProgress();
    UI.toast(`${I18n.t('toast_objective_month')} : ${Utils.currency(val)}`,'success');
  },

  renderProgress() {
    const today = new Date().toDateString();
    const todayCA = DB.activeSales().filter(s=>new Date(s.date).toDateString()===today).reduce((t,s)=>t+s.total,0);
    const monthCA = DB.salesInPeriod('month').reduce((t,s)=>t+s.total,0);

    const dailyObj = this.getDaily();
    const monthObj = this.getMonthly();

    const dailyPct  = dailyObj  > 0 ? Math.min(100, (todayCA/dailyObj*100)).toFixed(1)  : 0;
    const monthPct  = monthObj  > 0 ? Math.min(100, (monthCA/monthObj*100)).toFixed(1)  : 0;

    const setProgress = (barId, pctId, valId, pct, val, obj) => {
      const bar = document.getElementById(barId);
      const pctEl = document.getElementById(pctId);
      const valEl = document.getElementById(valId);
      if (bar)   bar.style.width = pct + '%';
      if (bar)   bar.style.background = pct >= 100 ? 'var(--accent)' : pct >= 70 ? 'var(--warning)' : 'var(--info)';
      if (pctEl) pctEl.textContent = pct + '%';
      if (valEl) valEl.textContent = `${Utils.currency(val)} / ${Utils.currency(obj)}`;
    };

    setProgress('obj-daily-bar','obj-daily-pct','obj-daily-val', dailyPct, todayCA, dailyObj);
    setProgress('obj-monthly-bar','obj-monthly-pct','obj-monthly-val', monthPct, monthCA, monthObj);

    // Update dashboard widget
    const dashBar = document.getElementById('dash-obj-bar');
    const dashPct = document.getElementById('dash-obj-pct');
    if (dashBar) dashBar.style.width = dailyPct + '%';
    if (dashPct) dashPct.textContent = dailyPct + '%';
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: SHARE — Partage ticket WhatsApp/SMS
   ═══════════════════════════════════════════════════════ */
