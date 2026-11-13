'use strict';
const CashReport = {
  calculate() {
    const fond    = Utils.num(document.getElementById('cr-fond')?.value);
    const counted = Utils.num(document.getElementById('cr-counted')?.value);
    if (isNaN(fond))    return UI.toast(I18n.t('toast_err_cash_required'),'danger');
    if (isNaN(counted)) return UI.toast(I18n.t('toast_err_cash_amount_required'),'danger');
    const today   = new Date().toDateString();
    const todayS  = DB.activeSales().filter(s => new Date(s.date).toDateString()===today);
    const caToday = todayS.reduce((t,s) => t+s.total, 0);
    const debtT   = todayS.reduce((t,s) => t+s.debt, 0);
    const cashIn  = caToday - debtT;
    const theo    = fond + cashIn;
    const ecart   = counted - theo;
    const card    = document.getElementById('cr-result-card');
    const content = document.getElementById('cr-result-content');
    if (!card||!content) return;
    const eC = Math.abs(ecart)<100 ? 'var(--accent)' : ecart<0 ? 'var(--danger)' : 'var(--warning)';
    const eL = Math.abs(ecart)<100 ? I18n.t('cr_ok') : ecart<0 ? I18n.t('cr_missing') : I18n.t('cr_surplus');
    const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px">
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.58rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${I18n.t('cr_opening_fund_short')}</div>
          <div style="font-weight:700">${Utils.currency(fond)}</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.58rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${I18n.t('cr_ca_collected')}</div>
          <div style="font-weight:700;color:var(--accent)">${Utils.currency(cashIn)}</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.58rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${I18n.t('cr_theoretical_cash')}</div>
          <div style="font-weight:700">${Utils.currency(theo)}</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.58rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${I18n.t('cr_counted_cash')}</div>
          <div style="font-weight:700">${Utils.currency(counted)}</div>
        </div>
      </div>
      <div style="background:${eC}18;border:2px solid ${eC};border-radius:var(--rmd);padding:16px;text-align:center;margin-bottom:12px">
        <div style="font-family:var(--fd);font-size:1.1rem;font-weight:800;color:${eC}">${eL}</div>
        <div style="font-size:.9rem;color:var(--text2);margin-top:8px">
          ${I18n.t('cr_gap')} : <strong style="color:${eC};font-size:1.2rem">${ecart>=0?'+':''}${Utils.currency(ecart)}</strong>
        </div>
        ${Math.abs(ecart)>=100 ? `<div style="font-size:.75rem;color:var(--text3);margin-top:6px">
          ${ecart<0 ? I18n.t('cr_check_missing') : I18n.t('cr_check_surplus')}
        </div>` : ''}
      </div>
      <div style="font-size:.8rem;color:var(--text2);line-height:1.8;background:var(--sur2);padding:12px;border-radius:var(--rsm)">
        <strong>${I18n.t('cr_day_detail')} :</strong><br>
        • ${I18n.t('nav_sales')} : ${todayS.length} | ${I18n.t('cr_total_ca')} : ${Utils.currency(caToday)}<br>
        • ${I18n.t('cr_uncollected_credits')} : −${Utils.currency(debtT)}<br>
        • <strong>${I18n.t('cr_actually_collected')} : ${Utils.currency(cashIn)}</strong><br>
        • ${I18n.t('lbl_date')} : ${new Date().toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
      </div>`;
    card.style.display = '';
    card.scrollIntoView({behavior:'smooth'});
  }
};

/* ═══════════════ COMMISSIONS ═══════════════ */
