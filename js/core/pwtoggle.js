'use strict';
/* Œil « afficher / masquer » sur tous les champs mot de passe et PIN (y compris ceux créés plus tard). */
(function () {
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const css = '.pw-wrap{position:relative;display:flex;align-items:center;width:100%;flex:1 1 auto}' +
    '.pw-wrap>input{flex:1;min-width:0;width:100%;padding-right:42px!important}' +
    '.pw-eye{position:absolute;right:4px;top:0;width:38px;display:flex;align-items:center;justify-content:center;background:none;border:0;padding:0;margin:0;color:var(--text3,#8a94a8);cursor:pointer}' +
    '.pw-eye:hover,.pw-eye.on{color:var(--accent,#2ee6a6)}.pw-eye svg{width:18px;height:18px;pointer-events:none}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function enhance(inp) {
    if (inp.dataset.pw) return;
    inp.dataset.pw = '1';
    const mb = getComputedStyle(inp).marginBottom;          // garde l'œil aligné sur le champ, pas sur sa marge
    const wrap = document.createElement('div'); wrap.className = 'pw-wrap';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pw-eye'; btn.tabIndex = -1;
    btn.setAttribute('aria-label', 'Afficher ou masquer'); btn.innerHTML = EYE; btn.style.bottom = mb;
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp); wrap.appendChild(btn);
    const set = show => { inp.type = show ? 'text' : 'password'; btn.innerHTML = show ? OFF : EYE; btn.classList.toggle('on', show); };
    btn.addEventListener('pointerdown', e => e.preventDefault());     // le champ garde le focus (le clavier reste ouvert)
    btn.addEventListener('click', () => set(inp.type === 'password'));
    inp.addEventListener('blur', () => set(false));                    // se recache dès qu'on quitte le champ
  }
  function scan() { document.querySelectorAll('input[type="password"]').forEach(enhance); }
  function init() {
    scan();
    let t = 0;
    new MutationObserver(() => { cancelAnimationFrame(t); t = requestAnimationFrame(scan); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
