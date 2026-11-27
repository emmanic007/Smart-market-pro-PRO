'use strict';
/* ═══════════════ AIENGINE — moteur local de l'assistant (hors ligne, gratuit, instantané) ═══════════════
   Comprend les questions courantes d'un commerçant et répond avec les VRAIES données (calculs faits par le code).
   answer(q) renvoie un texte, ou null si la question n'est pas reconnue (l'IA en ligne / l'ancien mode local prend alors le relais). */
const AIEngine = {
  MISS_KEY: 'SMP_AI_MISSES',

  /* ───────── Outils ───────── */
  norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['’`]/g, ' ').replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();
  },
  $(n) { return Utils.currency(Math.round((Number(n) || 0) * 100) / 100); },
  pct(a, b) { return b > 0 ? (Math.round(a / b * 1000) / 10).toString().replace('.', ',') + ' %' : '—'; },
  num(n) { return typeof Formats !== 'undefined' ? Formats.qtyText(n) : String(Math.round(n * 1000) / 1000); },
  ceil25(x) { return Math.ceil(x / 25 - 1e-9) * 25; },
  sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); },
  add(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },

  // Période : {s, e (exclu), label, days}
  range(p, now) {
    const t = this.sod(now), tom = this.add(t, 1);
    if (p === 'yesterday') return { s: this.add(t, -1), e: t, label: 'hier', days: 1 };
    if (p === 'week')  return { s: this.add(t, -6), e: tom, label: 'ces 7 derniers jours', days: 7 };
    if (p === 'month') return { s: new Date(now.getFullYear(), now.getMonth(), 1), e: tom, label: 'ce mois-ci', days: now.getDate() };
    if (p === 'year')  return { s: new Date(now.getFullYear(), 0, 1), e: tom, label: 'cette année', days: Math.max(1, Math.round((tom - new Date(now.getFullYear(), 0, 1)) / 864e5)) };
    return { s: t, e: tom, label: "aujourd'hui", days: 1 };
  },
  inR(dateStr, r) { const t = new Date(dateStr).getTime(); return t >= r.s.getTime() && t < r.e.getTime(); },
  sales(r) { return DB.activeSales().filter(s => this.inR(s.date, r)); },
  exps(r) { return (DB.data.expenses || []).filter(x => this.inR(x.date, r)); },
  sum(a, f) { return a.reduce((t, x) => t + (Number(f(x)) || 0), 0); },
  top(map, n, key) { return Object.entries(map).sort((a, b) => b[1][key] - a[1][key]).slice(0, n); },
  byProduct(sales) {
    const m = {};
    sales.forEach(s => { const k = s.itemName || '?'; const o = m[k] || (m[k] = { id: s.itemId, ca: 0, qty: 0, profit: 0 }); o.ca += s.total || 0; o.qty += s.qty || 0; o.profit += s.profit || 0; });
    return m;
  },
  cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },

  /* ───────── Détection ───────── */
  INTENTS: [
    ['price',      /combien (je |il )?(dois|devrais|peux|puis|faut)\b.*vend|a combien (je )?(dois |devrais |peux |puis )?(je )?vend|combien vendre|quel prix|prix (de vente|ideal|conseille|propose|rentable)|propose.* prix|fixer (le |un |mon )?prix|prix.*rentable|rentable.*prix|vendre.*(rentable|rentabilite)/],
    ['bestMonth',  /\bmois\b.*(rentable|meilleur|plus (de )?(benef|profit|vente|vendu|gagne))|(rentable|meilleur).*\bmois\b|quel mois/],
    ['bestWeekday',/jour (de la |d une )?semaine|quel jour.*(rentable|meilleur|plus|vend|gagne)|\bjour\b.*(le plus|meilleur|plus).*(rentable|benef|vend|gagne)|(meilleur|rentable|plus rentable).*\bjour\b/],
    ['capital',    /capital|argent (immobilise|bloque|investi|dans (le|mon) stock)|valeur (du |de mon |de la )?(stock|marchandise)|stock.*(vaut|valeur)|vaut (mon|le|ma|la) (stock|marchandise)|investi|en jeu|marchandise.*(vaut|valeur)/],
    ['losses',     /perte|perdu|a perte|deficit|je perds|perds de l argent/],
    ['expTop',     /depens.*(plus|principal|gros|souvent)|(plus|souvent|gros).*depens|consomme|ronge|mange.*argent|ou (part|va|passe) (mon |l )?argent|gouffre/],
    ['slow',       /(ne |pas |jamais |peu )(se )?(vend|ecoul|part|bouge|tourne|sort)|invendu|dormant|stagne|bloque.*stock|\blents?\b|reste.*stock|\bmort|dorm|se (vend|vendent|ecoule|ecoulent|bouge|tourne) (pas|plus|peu|mal|difficilement|lentement)/],
    ['fast',       /ecoul|se vend (vite|bien|rapidement)|part (le plus )?(vite|bien|rapidement)|rotation|tourne (vite|bien)|bouge (vite|bien)|sort (vite|bien)/],
    ['topProfit',  /(produit|article|marchandise).*(plus|meilleur).*(benef|profit|marge|rentable|rapporte|gagne)|plus rentable|rapporte le plus|(benef|profit|marge).*(plus|meilleur).*(produit|article)|plus de benef/],
    ['topSold',    /vend.* le plus|plus vendu|meilleur(e)?s? vente|produit (star|phare)|le plus (demande|achete|vendu)|vente.*le plus/],
    ['qty',        /combien (de |d )?(marchandise|produit|article|piece|unite|bouteille|carton|sac|kilo|quantite)s?.*vend|quantite.*vend|nombre (de |d )?(article|produit|marchandise)|marchandise.*vend/],
    ['margin',     /\bmarge\b/],
    ['improve',    /ameliorer|amelioration|que faire|comment (faire|augmenter|gagner|developper|booster|progresser)|optimis|augmenter (mes |les )?(benef|vente|gain)|conseil/],
    ['profit',     /benef|profit|gain|gagne|rentabilite|resultat/],
    ['revenue',    /combien.*(vend|encaisse|rentre|fait)|chiffre d affaires|\bca\b|recette|vente.*(jour|aujourd|semaine|mois|hier)|vendu|encaisse/],
    ['expAll',     /depens|charge|frais/]
  ],
  periods(q) {
    const p = [];
    if (/aujourd|ce jour|journee|du jour|ce soir|today|maintenant/.test(q)) p.push('day');
    if (/\bhier\b/.test(q)) p.push('yesterday');
    if (/semaine/.test(q)) p.push('week');
    if (/\bmois\b/.test(q)) p.push('month');
    if (/\bannee\b|\ban\b|annuel/.test(q)) p.push('year');
    return p;
  },
  detect(text) {
    const q = this.norm(text);
    if (!q) return null;
    for (const [name, rx] of this.INTENTS) if (rx.test(q)) return { intent: name, periods: this.periods(q), q };
    return null;
  },
  STOP: new Set('a au aux ce cet cette ces combien comment dois devrais doit peux puis faut je j tu me mon ma mes le la les un une des du de d en et est que qu quel quelle quels pour par sur avec dans il elle on nous vous soit etre vendre vend vente prix produit produits article rentable rentabilite marge propose proposes proposer conseille conseilles quoi quand ou si ne pas plus tres bien vraiment aujourd hui fixer meilleur ideal'.split(' ')),
  findItem(q) {
    const toks = q.split(' ').filter(t => t.length >= 3 && !this.STOP.has(t));
    let best = null, bs = 0;
    (DB.data.items || []).forEach(it => {
      const nt = this.norm(it.name).split(' ').filter(t => t.length >= 2);
      let sc = 0;
      nt.forEach(w => { if (toks.some(t => t === w || (t.length >= 4 && w.length >= 4 && (t.startsWith(w) || w.startsWith(t))))) sc += w.length; });
      if (sc > bs) { bs = sc; best = it; }
    });
    return best;
  },

  /* ───────── Réponse principale ───────── */
  answer(text, nowOverride) {
    const d = this.detect(text);
    if (!d) return null;
    const now = nowOverride || new Date();
    const fn = this['h_' + d.intent];
    if (!fn) return null;
    try { return fn.call(this, d, now); } catch (e) { console.warn('[AIEngine]', e); return null; }
  },
  logMiss(text) {
    try {
      const a = JSON.parse(localStorage.getItem(this.MISS_KEY) || '[]');
      a.push({ q: String(text).slice(0, 200), t: new Date().toISOString() });
      localStorage.setItem(this.MISS_KEY, JSON.stringify(a.slice(-100)));
    } catch (_) {}
  },
  misses() { try { return JSON.parse(localStorage.getItem(this.MISS_KEY) || '[]'); } catch (_) { return []; } },

  // Périodes demandées (ou défaut)
  P(d, def) { return d.periods.length ? d.periods : [def]; },
  noData(d, def, now) { return null; },

  /* ───────── Chiffres : ventes, bénéfice, marge, quantité ───────── */
  h_revenue(d, now) {
    const L = this.P(d, 'day').map(p => {
      const r = this.range(p, now), s = this.sales(r), ca = this.sum(s, x => x.total);
      return s.length ? `- **${this.cap(r.label)}** : ${this.$(ca)} (${s.length} vente${s.length > 1 ? 's' : ''}, panier moyen ${this.$(ca / s.length)})` : `- **${this.cap(r.label)}** : aucune vente enregistrée`;
    });
    return '## Chiffre d\'affaires\n' + L.join('\n');
  },
  h_profit(d, now) {
    const L = this.P(d, 'day').map(p => {
      const r = this.range(p, now), s = this.sales(r), ca = this.sum(s, x => x.total), pf = this.sum(s, x => x.profit), ex = this.sum(this.exps(r), x => x.amount);
      if (!s.length && !ex) return `- **${this.cap(r.label)}** : aucune vente ni dépense enregistrée`;
      return `- **${this.cap(r.label)}** : bénéfice sur ventes **${this.$(pf)}** (marge ${this.pct(pf, ca)}), dépenses ${this.$(ex)}, **bénéfice net ${this.$(pf - ex)}**`;
    });
    return '## Bénéfice\n' + L.join('\n') + '\n\nLe bénéfice sur ventes = prix de vente moins prix d\'achat. Le net enlève aussi tes dépenses.';
  },
  h_margin(d, now) {
    const L = this.P(d, 'day').map(p => {
      const r = this.range(p, now), s = this.sales(r), ca = this.sum(s, x => x.total), pf = this.sum(s, x => x.profit);
      return s.length ? `- **${this.cap(r.label)}** : marge **${this.pct(pf, ca)}** (${this.$(pf)} de bénéfice sur ${this.$(ca)} vendus)` : `- **${this.cap(r.label)}** : aucune vente enregistrée`;
    });
    return '## Marge\n' + L.join('\n');
  },
  h_qty(d, now) {
    const L = this.P(d, 'day').map(p => {
      const r = this.range(p, now), s = this.sales(r), q = this.sum(s, x => x.qty);
      return s.length ? `- **${this.cap(r.label)}** : **${this.num(q)}** article(s) vendus en ${s.length} vente(s)` : `- **${this.cap(r.label)}** : aucune vente enregistrée`;
    });
    return '## Marchandises vendues\n' + L.join('\n');
  },

  /* ───────── Produits ───────── */
  _rankPeriod(d) { const p = d.periods[0]; return !p || p === 'day' || p === 'yesterday' ? (p === 'day' ? 'week' : 'month') : p; },
  h_topSold(d, now) {
    const r = this.range(this._rankPeriod(d), now), m = this.byProduct(this.sales(r));
    const t = this.top(m, 5, 'qty');
    if (!t.length) return `Aucune vente enregistrée ${r.label}.`;
    return `## Produits les plus vendus (${r.label})\n` + t.map(([n, o], i) => `${i + 1}. **${n}** : ${this.num(o.qty)} vendus, ${this.$(o.ca)} encaissés`).join('\n');
  },
  h_topProfit(d, now) {
    const r = this.range(this._rankPeriod(d), now), m = this.byProduct(this.sales(r));
    const t = this.top(m, 5, 'profit');
    if (!t.length) return `Aucune vente enregistrée ${r.label}.`;
    return `## Produits qui rapportent le plus (${r.label})\n` + t.map(([n, o], i) => `${i + 1}. **${n}** : ${this.$(o.profit)} de bénéfice (marge ${this.pct(o.profit, o.ca)})`).join('\n');
  },
  h_fast(d, now) {
    const r = this.range(this._rankPeriod(d), now), m = this.byProduct(this.sales(r));
    const t = this.top(m, 5, 'qty');
    if (!t.length) return `Aucune vente enregistrée ${r.label}, impossible de dire ce qui s'écoule vite.`;
    return `## Ce qui s'écoule le plus vite (${r.label})\n` + t.map(([n, o], i) => {
      const it = (DB.data.items || []).find(x => x.id === o.id), perDay = o.qty / r.days;
      const left = it && perDay > 0 ? Math.floor(it.qty / perDay) : null;
      return `${i + 1}. **${n}** : ${this.num(o.qty)} vendus (≈ ${this.num(Math.round(perDay * 10) / 10)}/jour)` + (left !== null ? (left <= 7 ? `. ⚠ Stock pour ~${left} jour(s) seulement, pense à réapprovisionner` : `, stock pour ~${left} jours`) : '');
    }).join('\n');
  },
  _slowList(now) {
    const r = this.range('month', now), r30 = { s: this.add(this.sod(now), -29), e: this.add(this.sod(now), 1) };
    const sold = new Set(this.sales(r30).map(s => s.itemId));
    const recent = this.add(this.sod(now), -7).getTime();
    return (DB.data.items || []).filter(i => i.qty > 0 && !sold.has(i.id) && !(i.createdAt && new Date(i.createdAt).getTime() > recent))
      .map(i => ({ i, tied: i.qty * (i.buy || 0) })).sort((a, b) => b.tied - a.tied);
  },
  h_slow(d, now) {
    const l = this._slowList(now);
    if (!l.length) return 'Bonne nouvelle : tous tes produits en stock ont eu au moins une vente ces 30 derniers jours.';
    const tied = this.sum(l, x => x.tied);
    return `## Produits qui ne se vendent pas (30 jours)\n` + l.slice(0, 6).map((x, i) => `${i + 1}. **${x.i.name}** : ${this.num(x.i.qty)} en stock, ${this.$(x.tied)} immobilisés`).join('\n') +
      `\n\nAu total **${this.$(tied)}** dorment dans ces ${l.length} produit(s). Idées : promotion, lot "2 pour le prix de..." ou ne pas racheter.`;
  },

  /* ───────── Pertes, capital, dépenses ───────── */
  h_losses(d, now) {
    const L = this.P(d, 'day').map(p => {
      const r = this.range(p, now), s = this.sales(r), neg = s.filter(x => (x.profit || 0) < 0);
      const ret = (DB.data.sales || []).filter(x => x.returned && !x.deleted && x.returnDate && this.inR(x.returnDate, r));
      const pf = this.sum(s, x => x.profit), ex = this.sum(this.exps(r), x => x.amount), net = pf - ex;
      const out = [`**${this.cap(r.label)}**`];
      out.push(neg.length ? `- ${neg.length} vente(s) à perte : ${this.$(-this.sum(neg, x => x.profit))} perdus (${[...new Set(neg.map(x => x.itemName))].slice(0, 3).join(', ')})` : '- Aucune vente en dessous du prix d\'achat');
      if (ret.length) out.push(`- ${ret.length} retour(s) client pour ${this.$(this.sum(ret, x => x.total))}`);
      if (s.length || ex) out.push(net < 0 ? `- Résultat net **négatif : ${this.$(net)}** (bénéfice ${this.$(pf)} < dépenses ${this.$(ex)})` : `- Résultat net positif : ${this.$(net)}`);
      else out.push('- Aucune activité enregistrée');
      return out.join('\n');
    });
    return '## Pertes\n' + L.join('\n\n');
  },
  h_capital(d, now) {
    const it = DB.data.items || [], cost = this.sum(it, i => i.qty * (i.buy || 0)), sell = this.sum(it, i => i.qty * (i.sell || 0));
    const debt = this.sum(DB.activeSales(), s => s.debt);
    const top = it.map(i => [i.name, i.qty * (i.buy || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return `## Capital en jeu\n- Marchandises en stock (prix d'achat) : **${this.$(cost)}**\n- Dettes des clients à récupérer : **${this.$(debt)}**\n- **Total engagé : ${this.$(cost + debt)}**\n\nSi tout le stock est vendu, tu encaisses ${this.$(sell)}, soit un bénéfice potentiel de ${this.$(sell - cost)}.` +
      (top.length && cost > 0 ? `\n\nGros postes : ` + top.map(x => `${x[0]} (${this.$(x[1])})`).join(', ') : '');
  },
  _expCats(r) { const m = {}; this.exps(r).forEach(x => { const k = x.cat || 'Autre'; m[k] = (m[k] || 0) + (x.amount || 0); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); },
  h_expTop(d, now) {
    const r = this.range(d.periods[0] === 'day' || !d.periods.length ? 'month' : d.periods[0], now), c = this._expCats(r), tot = this.sum(c, x => x[1]);
    if (!c.length) return `Aucune dépense enregistrée ${r.label}.`;
    return `## Où part ton argent (${r.label})\nTotal : **${this.$(tot)}**\n` + c.slice(0, 5).map((x, i) => `${i + 1}. **${x[0]}** : ${this.$(x[1])} (${this.pct(x[1], tot)})`).join('\n');
  },
  h_expAll(d, now) {
    const L = this.P(d, 'month').map(p => {
      const r = this.range(p, now), ex = this.sum(this.exps(r), x => x.amount), pf = this.sum(this.sales(r), x => x.profit);
      if (!ex) return `- **${this.cap(r.label)}** : aucune dépense enregistrée`;
      const ratio = pf > 0 ? ex / pf : null;
      const j = ratio === null ? '' : ratio > 0.5 ? ' : c\'est **très élevé**, ça mange plus de la moitié de tes bénéfices' : ratio > 0.25 ? ' : c\'est **élevé**, à surveiller' : ' : c\'est **raisonnable**';
      return `- **${this.cap(r.label)}** : ${this.$(ex)} de dépenses` + (ratio !== null ? `, soit ${this.pct(ex, pf)} de ton bénéfice sur ventes${j}` : '');
    });
    return '## Dépenses\n' + L.join('\n');
  },

  /* ───────── Meilleur mois / jour ───────── */
  h_bestMonth(d, now) {
    const m = {};
    DB.activeSales().forEach(s => { const dt = new Date(s.date), k = dt.getFullYear() * 100 + dt.getMonth(); const o = m[k] || (m[k] = { ca: 0, profit: 0, label: dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }); o.ca += s.total || 0; o.profit += s.profit || 0; });
    const t = this.top(m, 3, 'profit');
    if (!t.length) return 'Je n\'ai pas encore de ventes pour comparer les mois.';
    return `## Mois les plus rentables\n` + t.map(([k, o], i) => `${i + 1}. **${this.cap(o.label)}** : ${this.$(o.profit)} de bénéfice (${this.$(o.ca)} vendus)`).join('\n') + (Object.keys(m).length < 2 ? '\n\n(Un seul mois de données pour l\'instant, la comparaison viendra avec le temps.)' : '');
  },
  h_bestWeekday(d, now) {
    const J = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], m = {}, days = {};
    DB.activeSales().forEach(s => { const dt = new Date(s.date), w = dt.getDay(); const o = m[w] || (m[w] = { ca: 0, profit: 0, name: J[w] }); o.ca += s.total || 0; o.profit += s.profit || 0; (days[w] = days[w] || new Set()).add(dt.toDateString()); });
    const t = this.top(m, 3, 'profit');
    if (!t.length) return 'Je n\'ai pas encore de ventes pour comparer les jours.';
    return `## Jours de la semaine les plus rentables\n` + t.map(([w, o], i) => `${i + 1}. **${this.cap(o.name)}** : ${this.$(o.profit)} au total, ≈ ${this.$(o.profit / days[w].size)} par ${o.name}`).join('\n');
  },

  /* ───────── Conseil de prix ───────── */
  h_price(d, now) {
    const it = this.findItem(d.q);
    if (!it) {
      const ex = (DB.data.items || []).slice(0, 3).map(i => i.name).join(', ');
      return 'Dis-moi pour quel produit, par exemple : « à combien vendre ' + (ex.split(',')[0] || 'Coca') + ' ? »' + (ex ? `\n\nTes produits : ${ex}…` : '');
    }
    const cost = it.buy || 0, cur = it.sell || 0, unit = it.unit ? ' / ' + it.unit : '';
    const out = [`## Prix pour ${it.name}`, `- Prix d'achat : ${this.$(cost)}${unit}`, `- Prix actuel : ${this.$(cur)}${unit}` + (cur > 0 ? ` (marge ${this.pct(cur - cost, cur)}, bénéfice ${this.$(cur - cost)} par unité)` : '')];
    out.push(`- **Prix plancher** (aucune perte) : ${this.$(cost)}`);
    out.push('Propositions :');
    [[20, 'prudent'], [30, 'équilibré'], [40, 'ambitieux']].forEach(([m, lab]) => {
      const p = this.ceil25(cost / (1 - m / 100));
      out.push(`- ${this.$(p)} → ${lab} : bénéfice ${this.$(p - cost)} par unité (marge ${this.pct(p - cost, p)})`);
    });
    const r = this.range('month', now), m = this.byProduct(this.sales(r))[it.name];
    if (m) { const left = m.qty / r.days > 0 ? Math.floor(it.qty / (m.qty / r.days)) : null; out.push(m.qty / r.days > 0 && left !== null && left <= 7 ? `\nCe produit part vite (stock pour ~${left} jours) : tu peux viser le prix **ambitieux**.` : '\nCe produit se vend régulièrement : le prix **équilibré** est un bon choix.'); }
    else if (it.qty > 0) out.push('\nCe produit s\'est peu vendu ce mois-ci : mieux vaut le prix **prudent** pour le faire tourner.');
    if (typeof Formats !== 'undefined' && Formats.has(it)) out.push('\nFormats : ' + it.formats.map(f => `${f.name} à ${this.$(f.price)} (marge ${this.pct(f.price - cost * f.n, f.price)})`).join(' ; '));
    return out.join('\n');
  },

  /* ───────── Améliorer ───────── */
  h_improve(d, now) {
    const r = this.range('month', now), s = this.sales(r), ca = this.sum(s, x => x.total), pf = this.sum(s, x => x.profit), ex = this.sum(this.exps(r), x => x.amount);
    if (!s.length) return '## Pour bien démarrer\n1. Enregistre **chaque vente** : c\'est la base de tous mes conseils.\n2. Renseigne le **prix d\'achat exact** de chaque produit.\n3. Note tes **dépenses** (loyer, transport, électricité).\nAprès quelques jours, je pourrai te dire précisément quoi améliorer.';
    const tips = [], m = this.byProduct(s);
    const low = Object.entries(m).filter(([, o]) => o.ca > 0 && o.profit / o.ca < 0.15).sort((a, b) => b[1].ca - a[1].ca).slice(0, 3);
    if (low.length) tips.push(`**Marges faibles** : ${low.map(([n, o]) => `${n} (${this.pct(o.profit, o.ca)})`).join(', ')}. Augmente légèrement leur prix ou négocie le prix d'achat.`);
    const slow = this._slowList(now);
    if (slow.length) tips.push(`**Stock qui dort** : ${this.$(this.sum(slow, x => x.tied))} immobilisés (${slow.slice(0, 2).map(x => x.i.name).join(', ')}). Fais une promotion et ne les rachète pas.`);
    if (pf > 0 && ex / pf > 0.3) { const c = this._expCats(r)[0]; tips.push(`**Dépenses élevées** : ${this.pct(ex, pf)} de ton bénéfice.` + (c ? ` Premier poste : ${c[0]} (${this.$(c[1])}).` : '')); }
    const debt = this.sum(s, x => x.debt);
    if (ca > 0 && debt / ca > 0.1) tips.push(`**Dettes clients** : ${this.$(debt)} (${this.pct(debt, ca)} de tes ventes). Relance les plus anciens et limite le crédit.`);
    const al = (DB.data.items || []).filter(i => i.qty <= (i.min || 0));
    if (al.length) tips.push(`**Stock bas** : ${al.slice(0, 3).map(i => i.name).join(', ')}. Réapprovisionne avant la rupture.`);
    const best = this.top(m, 1, 'profit')[0];
    if (best) tips.push(`**Ton produit vedette** : ${best[0]} (${this.$(best[1].profit)} de bénéfice ce mois). Garde-le toujours en stock et mets-le en avant.`);
    return `## Comment améliorer (${r.label})\nBénéfice net : ${this.$(pf - ex)} sur ${this.$(ca)} vendus.\n\n` + tips.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n');
  }
};
