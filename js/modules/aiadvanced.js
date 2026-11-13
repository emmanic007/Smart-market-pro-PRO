'use strict';
const AIAdvanced = {
  MEM_KEY:   'SMP_AI_MEMORY_V76',
  STATS_KEY: 'SMP_AI_STATS_V76',
  _history:  [],
  _generated: false,

  /* ── Mémoire persistante ── */
  loadMemory() {
    try {
      return JSON.parse(localStorage.getItem(this.MEM_KEY) || '{}');
    } catch(_) { return {}; }
  },

  saveMemory(mem) {
    try { localStorage.setItem(this.MEM_KEY, JSON.stringify(mem)); } catch(_) {}
  },

  /* ── Statistiques d'utilisation pour auto-amélioration ── */
  loadStats() {
    try { return JSON.parse(localStorage.getItem(this.STATS_KEY) || '{"queries":{},"totalQueries":0,"lastAnalysis":null}'); }
    catch(_) { return { queries:{}, totalQueries:0, lastAnalysis:null }; }
  },

  trackQuery(topic) {
    const stats = this.loadStats();
    stats.totalQueries++;
    stats.queries[topic] = (stats.queries[topic] || 0) + 1;
    stats.lastAnalysis = new Date().toISOString();
    try { localStorage.setItem(this.STATS_KEY, JSON.stringify(stats)); } catch(_) {}
  },

  /* ── Détecte le sujet d'une question ── */
  detectTopic(q) {
    const low = q.toLowerCase();
    if (low.match(/bilan|jour|today|journée/))           return 'bilan_jour';
    if (low.match(/stock|rupture|réappro|produit|manqu/)) return 'stock';
    if (low.match(/vendeur|équipe|performance|qui vend/)) return 'vendeurs';
    if (low.match(/top|meilleur|rentable|populaire/))     return 'top_produits';
    if (low.match(/dette|client|impayé|crédit/))          return 'dettes';
    if (low.match(/conseil|recommand|améliorer|augment/)) return 'conseils';
    if (low.match(/marge|profit|bénéfice/))               return 'marges';
    if (low.match(/prévision|prédiction|futur|tendance/)) return 'predictions';
    if (low.match(/objectif|cible|target|goal/))          return 'objectifs';
    if (low.match(/fournisseur|achat|approvisionnement/)) return 'fournisseurs';
    if (low.match(/dépense|charge|loyer|transport|salaire/)) return 'depenses';
    if (low.match(/retour|remboursement|rendu/))             return 'retours';
    if (low.match(/fidélité|point|client fidèle/))        return 'fidelite';
    if (low.match(/catégorie|famille|rayon/))             return 'categories';
    return 'general';
  },

  /* ── Construit un contexte complet et riche ── */
  buildContext() {
    const sales    = DB.activeSales();
    const today    = new Date().toDateString();
    const todayS   = sales.filter(s => new Date(s.date).toDateString() === today);
    const ca       = sales.reduce((s,v)=>s+v.total,0);
    const caT      = todayS.reduce((s,v)=>s+v.total,0);
    const pft      = sales.reduce((s,v)=>s+v.profit,0);
    const debt     = sales.reduce((s,v)=>s+v.debt,0);
    const curr     = Settings.getCurrency();
    const margin   = ca>0?((pft/ca)*100).toFixed(1):0;
    const mem      = this.loadMemory();
    const stats    = this.loadStats();

    // Weekly trend
    const week1 = DB.salesInPeriod('week').reduce((t,s)=>t+s.total,0);
    const prevWeekStart = Utils.periodStart('week') - 7*86400000;
    const week2 = sales.filter(s=>new Date(s.date).getTime()>=prevWeekStart&&new Date(s.date).getTime()<Utils.periodStart('week')).reduce((t,s)=>t+s.total,0);
    const weekTrend = week2>0?((week1-week2)/week2*100).toFixed(1):0;

    // Product analysis
    const pm={};
    sales.forEach(s=>{if(!pm[s.itemName])pm[s.itemName]={ca:0,qty:0,profit:0,count:0};pm[s.itemName].ca+=s.total;pm[s.itemName].qty+=s.qty;pm[s.itemName].profit+=s.profit;pm[s.itemName].count++;});
    const topProds = Object.entries(pm).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5).map(([n,d])=>`"${n}": ${d.ca}${curr} CA, marge ${d.ca>0?((d.profit/d.ca)*100).toFixed(0):0}%`).join('; ');
    const leastSold = Object.entries(pm).sort((a,b)=>a[1].qty-b[1].qty).slice(0,3).map(([n,d])=>`"${n}": ${d.qty} vendus`).join('; ');

    // Seller performance
    const sm={};
    sales.forEach(s=>{if(!sm[s.userName])sm[s.userName]={ca:0,count:0};sm[s.userName].ca+=s.total;sm[s.userName].count++;});
    const sellers=Object.entries(sm).sort((a,b)=>b[1].ca-a[1].ca).map(([n,d])=>`${n}: ${d.ca}${curr} (${d.count} ventes)`).join('; ');

    // Stock status
    const critical = DB.data.items.filter(i=>i.qty<=(i.min||5));
    const outOfStock= DB.data.items.filter(i=>i.qty===0);
    const negMargin = DB.data.items.filter(i=>i.sell<i.buy);

    // Debt by client
    const dm={};
    sales.filter(s=>s.debt>0).forEach(s=>{const cl=s.clientName||'Inconnu';if(!dm[cl])dm[cl]=0;dm[cl]+=s.debt;});
    const topDebtors=Object.entries(dm).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,d])=>`${n}: ${d}${curr}`).join('; ');

    // Predictions
    const dailyAvgCA = sales.length>0 && ca>0 ? (ca / Math.max(1, Math.ceil((Date.now()-new Date(sales[sales.length-1]?.date||Date.now()))/86400000))) : 0;

    // Top AI questions (auto-amélioration)
    const topQuestions = Object.entries(stats.queries).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,c])=>`${t}(${c}x)`).join(', ');

    return `Tu es l'IA intégrée de Smart Market Pro, une application de gestion commerciale.
Tu dois répondre comme une IA avancée (style GPT-4 ou Claude Opus) : analytique, précis, avec des insights actionnables.

=== IDENTITÉ DU COMMERCE ===
Nom: "${Settings.data.shopName || 'Non défini'}" | Devise: ${curr} | Date: ${new Date().toLocaleDateString('fr-FR')} | Heure: ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}

=== MÉTRIQUES FINANCIÈRES ===
CA total: ${ca}${curr} | CA aujourd'hui: ${caT}${curr}
Profit total: ${pft}${curr} | Marge globale: ${margin}%
Dettes cumulées: ${debt}${curr} | Liquidités: ${Utils.currency(DB.data.cashInit+(ca-debt))}
CA semaine actuelle: ${week1}${curr} (${weekTrend>0?'+':''}${weekTrend}% vs semaine précédente)
Objectif journalier: ${DB.data.dailyObjective||'non défini'}${curr}

=== STOCK (${DB.data.items.length} produits) ===
Valeur achat: ${DB.data.items.reduce((s,i)=>s+i.buy*i.qty,0)}${curr}
Produits en alerte (${critical.length}): ${critical.slice(0,3).map(i=>`${i.name}(${i.qty})`).join(', ')||'aucun'}
Produits épuisés (${outOfStock.length}): ${outOfStock.slice(0,3).map(i=>i.name).join(', ')||'aucun'}
Produits à marge négative (${negMargin.length}): ${negMargin.slice(0,3).map(i=>i.name).join(', ')||'aucun'}

=== TOP PRODUITS ===
${topProds || I18n.t('no_sales')}

=== PRODUITS LES MOINS VENDUS ===
${leastSold || 'Aucune donnée'}

=== VENDEURS ===
${sellers || I18n.t('no_sales')}

=== DETTES PAR CLIENT ===
${topDebtors || I18n.t('no_debts')}

=== FOURNISSEURS ===
${(DB.data.suppliers||[]).length} fournisseur(s) enregistré(s)

=== OBJECTIFS ===
Journalier: ${DB.data.dailyObjective||0}${curr} | Mensuel: ${DB.data.monthlyObjective||0}${curr}

=== DÉPENSES ===
Dépenses ce mois : ${(DB.data.expenses||[]).filter(e=>{const d=new Date(e.date);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).reduce((t,e)=>t+e.amount,0)}${curr}
Dépenses totales : ${(DB.data.expenses||[]).reduce((t,e)=>t+e.amount,0)}${curr}
Bénéfice net réel : ${(()=>{const s=DB.activeSales();const ca=s.reduce((t,x)=>t+x.total,0);const cout=s.reduce((t,x)=>t+(x.total-x.profit),0);const dep=(DB.data.expenses||[]).reduce((t,e)=>t+e.amount,0);return ca-cout-dep;})()}${curr}

=== RETOURS CLIENTS ===
Montant retourné total : ${(DB.data.returns||[]).reduce((t,r)=>t+(r.amount||0),0)}${curr}
Nombre de retours : ${(DB.data.returns||[]).length}

=== MÉMOIRE IA (interactions précédentes) ===
${mem.lastInsight || 'Première utilisation'}

=== AUTO-AMÉLIORATION ===
Questions les plus posées: ${topQuestions || 'aucune encore'}
Total interactions: ${stats.totalQueries}

INSTRUCTIONS DE COMPORTEMENT:
- Réponds en français, de manière structurée et professionnelle
- Donne des chiffres précis tirés des données ci-dessus
- Propose toujours une action concrète après ton analyse
- Utilise ** pour les éléments importants
- Sois proactif : signale les problèmes même si non demandés
- Adapte ton niveau de détail à la complexité de la question
- Si tu détectes une anomalie, mentionne-la clairement`;
  },

  /* ── Réponse locale ultra-détaillée ── */
  localReply(q) {
    const topic  = this.detectTopic(q);
    this.trackQuery(topic);

    const sales   = DB.activeSales();
    const today   = new Date().toDateString();
    const todayS  = sales.filter(s=>new Date(s.date).toDateString()===today);
    const ca      = sales.reduce((s,v)=>s+v.total,0);
    const caT     = todayS.reduce((s,v)=>s+v.total,0);
    const pft     = sales.reduce((s,v)=>s+v.profit,0);
    const pftT    = todayS.reduce((s,v)=>s+v.profit,0);
    const debt    = sales.reduce((s,v)=>s+v.debt,0);
    const curr    = Settings.getCurrency();
    const margin  = ca>0?((pft/ca)*100).toFixed(1):0;
    const marginT = caT>0?((pftT/caT)*100).toFixed(1):0;

    const pm={};
    sales.forEach(s=>{if(!pm[s.itemName])pm[s.itemName]={ca:0,qty:0,profit:0};pm[s.itemName].ca+=s.total;pm[s.itemName].qty+=s.qty;pm[s.itemName].profit+=s.profit;});
    const topProd=Object.entries(pm).sort((a,b)=>b[1].ca-a[1].ca)[0];

    const sm={};
    sales.forEach(s=>{if(!sm[s.userName])sm[s.userName]={ca:0,count:0};sm[s.userName].ca+=s.total;sm[s.userName].count++;});
    const topSeller=Object.entries(sm).sort((a,b)=>b[1].ca-a[1].ca)[0];

    const critical  =DB.data.items.filter(i=>i.qty<=(i.min||5)&&i.qty>0);
    const outOfStock=DB.data.items.filter(i=>i.qty===0);
    const negMargin =DB.data.items.filter(i=>i.sell<i.buy);

    const dm={};
    sales.filter(s=>s.debt>0).forEach(s=>{const cl=s.clientName||'Inconnu';if(!dm[cl])dm[cl]=0;dm[cl]+=s.debt;});
    const topDebtors=Object.entries(dm).sort((a,b)=>b[1]-a[1]);

    // Predictions
    const allSales=DB.activeSales();
    const predictions=DB.data.items.map(i=>{
      if(i.qty<=0) return null;
      const recent=allSales.filter(s=>{const d=new Date(s.date);const now=new Date();return s.itemId===i.id&&(now-d)/(1000*3600*24)<=7;});
      const dailyAvg=recent.reduce((t,s)=>t+s.qty,0)/7;
      if(dailyAvg>0){const days=Math.floor(i.qty/dailyAvg);return{name:i.name,days,qty:i.qty};}
      return null;
    }).filter(p=>p&&p.days<=7&&p.days>0);

    const weekCA=DB.salesInPeriod('week').reduce((t,s)=>t+s.total,0);
    const monthCA=DB.salesInPeriod('month').reduce((t,s)=>t+s.total,0);

    // Save insight to memory
    const mem=this.loadMemory();
    mem.lastInsight=`Dernière analyse: CA=${caT}${curr} aujourd'hui, ${todayS.length} ventes, ${outOfStock.length} épuisements`;
    this.saveMemory(mem);

    switch(topic) {
      case 'bilan_jour':
        return `## 📊 Bilan Complet du ${new Date().toLocaleDateString('fr-FR')}

**Chiffre d'affaires du jour :** ${caT} ${curr}
**Profit net du jour :** ${pftT} ${curr} (marge **${marginT}%**)
**Nombre de ventes :** ${todayS.length}

---
**Performance globale (historique)**
- CA total : ${ca} ${curr}
- Profit total : ${pft} ${curr} (marge ${margin}%)
- Dettes en cours : ${debt} ${curr}
- Semaine en cours : ${weekCA} ${curr}
- Mois en cours : ${monthCA} ${curr}

---
${todayS.length===0?'⚠️ **Aucune vente enregistrée aujourd\'hui.** Vérifiez que vos produits sont disponibles en stock et que vos prix sont compétitifs.':
  pftT===0?'⚠️ Vous avez des ventes mais **aucun profit**. Vérifiez vos prix de vente vs prix d\'achat.':
  `✅ Journée ${parseFloat(marginT)>=15?'**excellente**':'correcte'}. ${predictions.length>0?`\n\n**⚠️ Attention :** ${predictions[0].name} sera épuisé dans **${predictions[0].days} jour(s)** si le rythme actuel continue.`:''}`}

---
**Action recommandée :** ${outOfStock.length>0?`Réapprovisionnez **${outOfStock[0].name}** en urgence.`:debt>0?`Relancez **${topDebtors[0]?.[0]}** pour le recouvrement de **${topDebtors[0]?.[1]}${curr}**.`:'Continuez sur cette lancée !'}`;

      case 'stock':
        return `## 📦 Analyse Complète du Stock

**Résumé :**
- Total produits : **${DB.data.items.length}** références
- Valeur achat : ${DB.data.items.reduce((s,i)=>s+i.buy*i.qty,0)} ${curr}
- Valeur vente potentielle : ${DB.data.items.reduce((s,i)=>s+i.sell*i.qty,0)} ${curr}

---
${outOfStock.length>0?`**🔴 Épuisés (${outOfStock.length}) — Action immédiate requise :**\n${outOfStock.map(i=>`- **${i.name}** : 0 unité`).join('\n')}\n\n`:''}
${critical.filter(i=>i.qty>0).length>0?`**🟡 Alerte stock (${critical.filter(i=>i.qty>0).length}) :**\n${critical.filter(i=>i.qty>0).map(i=>`- ${i.name} : **${i.qty}** unité(s) restante(s) (seuil: ${i.min||5})`).join('\n')}\n\n`:''}
${negMargin.length>0?`**⚠️ Vendus à perte (${negMargin.length}) :**\n${negMargin.map(i=>`- ${i.name} : achat **${i.buy}${curr}** → vente **${i.sell}${curr}** (perte ${(i.buy-i.sell)}${curr}/unité)`).join('\n')}\n\n`:''}
${predictions.length>0?`**🔮 Prédictions d'épuisement (7 jours) :**\n${predictions.map(p=>`- ${p.name} : épuisé dans **${p.days}j** (${p.qty} restant(s))`).join('\n')}\n\n`:''}
${outOfStock.length===0&&critical.length===0?'✅ **Votre stock est en excellent état.** Tous les produits ont un niveau satisfaisant.':''}

**Recommandation :** ${outOfStock.length>0?`Commandez immédiatement **${outOfStock.map(i=>i.name).join(', ')}**.`:critical.length>0?`Planifiez un réapprovisionnement pour **${critical[0].name}** cette semaine.`:'Passez en revue vos prix pour optimiser les marges.'}`;

      case 'vendeurs':
        if (!Object.keys(sm).length) return '📊 **Aucune vente enregistrée.** Ajoutez des produits et effectuez des ventes pour voir les performances par vendeur.';
        const sorted=Object.entries(sm).sort((a,b)=>b[1].ca-a[1].ca);
        const totalVentes=sorted.reduce((t,[,d])=>t+d.count,0);
        return `## 👥 Analyse Performance Vendeurs

**Équipe :** ${sorted.length} vendeur(s) actif(s) | ${totalVentes} ventes totales

${sorted.map(([name,d],i)=>{
  const share=(ca>0?(d.ca/ca*100).toFixed(1):0);
  const avg=d.count>0?(d.ca/d.count).toFixed(0):0;
  return `**${i===0?'🥇':i===1?'🥈':'🥉'} ${name}**\n- CA généré : **${d.ca} ${curr}** (${share}% du total)\n- Ventes : ${d.count} | Panier moyen : ${avg} ${curr}`;
}).join('\n\n')}

---
**Insight :** ${topSeller?`**${topSeller[0]}** est votre meilleur vendeur avec **${topSeller[1].ca}${curr}** de CA. ${sorted.length>1?`L'écart avec le 2ème est de **${(topSeller[1].ca-sorted[1][1].ca)}${curr}**.`:''}`:''}`

      case 'top_produits':
        if (!Object.keys(pm).length) return '📊 **Aucune vente enregistrée.** Effectuez des ventes pour voir vos top produits.';
        const top10=Object.entries(pm).sort((a,b)=>b[1].ca-a[1].ca).slice(0,10);
        const maxCA=top10[0][1].ca;
        return `## 🏆 Top Produits par Chiffre d'Affaires

${top10.map(([name,d],i)=>{
  const bar='█'.repeat(Math.round(d.ca/maxCA*10))+'░'.repeat(10-Math.round(d.ca/maxCA*10));
  const marg=d.ca>0?((d.profit/d.ca)*100).toFixed(1):0;
  return `**${i+1}. ${name}**\n${bar} ${d.ca}${curr} | ${d.qty} vendus | Marge **${marg}%**`;
}).join('\n\n')}

---
**Analyse :** ${topProd?`**${topProd[0]}** domine avec **${topProd[1].ca}${curr}** soit **${(topProd[1].ca/ca*100).toFixed(1)}%** du CA total. Assurez-vous d'avoir toujours du stock de ce produit.`:'Diversifiez votre gamme de produits.'}`;

      case 'dettes':
        if(debt===0) return '## ✅ Aucune Dette Client\n\nTous vos clients sont à jour dans leurs paiements. Excellente gestion !';
        return `## 💳 Analyse des Dettes Clients

**Total impayé : ${debt} ${curr}** | ${sales.filter(s=>s.debt>0).length} transactions à crédit

**Top débiteurs :**
${topDebtors.slice(0,5).map(([n,d],i)=>`${i+1}. **${n}** : ${d}${curr} (${(d/debt*100).toFixed(1)}% du total)`).join('\n')}

---
**Stratégie de recouvrement recommandée :**
1. **Priorité 1 :** Contactez **${topDebtors[0]?.[0]||'votre client principal'}** pour ${topDebtors[0]?.[1]||0}${curr}
2. Proposez un **plan de paiement échelonné** pour les gros montants
3. Fixez un **seuil crédit maximum** par client dans vos paramètres
4. Utilisez l'onglet Dettes pour **marquer les paiements** au fur et à mesure

**Ratio dettes/CA :** ${ca>0?((debt/ca)*100).toFixed(1):0}% ${ca>0&&debt/ca>0.2?'⚠️ Élevé (>20%) — action urgente':'✅ Acceptable'}`;

      case 'predictions':
        return `## 🔮 Prédictions & Tendances

**Basées sur vos ${sales.length} ventes historiques**

${predictions.length>0?`**⚠️ Épuisements prévus dans les 7 prochains jours :**\n${predictions.map(p=>`- **${p.name}** : dans ${p.days} jour(s) (${p.qty} restant(s) | consommation ~${(p.qty/p.days).toFixed(1)}/jour)`).join('\n')}\n\n`:'✅ Aucune rupture de stock prévue dans les 7 prochains jours.\n\n'}
**Estimation CA semaine prochaine :** ${weekCA>0?`~${Math.round(weekCA*1.05)}${curr} (basé sur +5% de croissance)`:'Insuffisamment de données'}

**Vos meilleures performances :** ${topSeller?`${topSeller[0]} génère en moyenne ${topSeller[1].count>0?Math.round(topSeller[1].ca/topSeller[1].count):0}${curr} par vente`:I18n.t('no_sales')}

**Recommandations pour la semaine :**
${outOfStock.length>0?`1. 🔴 Réapprovisionnez **${outOfStock.slice(0,2).map(i=>i.name).join(', ')}** en urgence`:'1. ✅ Stock OK'}
${predictions.length>0?`2. 📦 Commandez **${predictions[0].name}** avant ${predictions[0].days} jours`:'2. ✅ Pas de rupture imminente'}
3. 💰 Objectif CA suggéré : **${Math.round((weekCA/7)*1.1*7)}${curr}** (10% de croissance)`;

      case 'conseils': {
        const issues=[];
        if(negMargin.length>0) issues.push(`**Corrigez les prix de ${negMargin[0].name}** — vendu à perte de ${negMargin[0].buy-negMargin[0].sell}${curr}/unité`);
        if(debt>ca*0.2&&ca>0) issues.push(`**Réduisez les ventes à crédit** — dettes = ${(debt/ca*100).toFixed(0)}% du CA`);
        if(outOfStock.length>0) issues.push(`**Réapprovisionnez immédiatement** : ${outOfStock.slice(0,2).map(i=>i.name).join(', ')}`);
        if(parseFloat(margin)<15&&ca>0) issues.push(`**Optimisez vos marges** — ${margin}% en dessous du seuil recommandé de 15-20%`);

        return `## 📈 Recommandations Personnalisées

**Analyse de votre situation actuelle :**
- CA : ${ca}${curr} | Marge : ${margin}% | Dettes : ${debt}${curr}
- Santé globale : ${parseFloat(margin)>=15&&debt<ca*0.2&&outOfStock.length===0?'🟢 Excellente':parseFloat(margin)>=10?'🟡 Correcte':'🔴 À améliorer'}

---
**Actions prioritaires :**
${issues.length>0?issues.map((issue,i)=>`${i+1}. ${issue}`).join('\n'):`✅ Votre commerce est bien géré ! Voici comment aller encore plus loin :`}

**Pour augmenter votre CA :**
1. Identifiez vos **3 meilleurs produits** et assurez un stock permanent
2. Créez un **programme de fidélité** pour vos clients réguliers
3. Fixez un **objectif journalier** visible dans votre tableau de bord
4. Analysez les **heures de pointe** pour optimiser votre personnel

**Pour améliorer votre rentabilité :**
1. Visez une marge minimum de **15-20%** par produit
2. Renégociez avec vos **fournisseurs** au-delà de 3 mois de relation
3. Réduisez les pertes de stock avec des **alertes personnalisées**`;
      }

      case 'depenses': {
        const exps  = DB.data.expenses || [];
        const expT  = exps.reduce((t,e)=>t+e.amount,0);
        const n     = new Date();
        const mExps = exps.filter(e=>{const d=new Date(e.date);return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();});
        const mExpT = mExps.reduce((t,e)=>t+e.amount,0);
        const byCat = {};
        exps.forEach(e=>{if(!byCat[e.cat])byCat[e.cat]=0;byCat[e.cat]+=e.amount;});
        const topCat = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,3);
        const sales  = DB.activeSales();
        const ca     = sales.reduce((t,s)=>t+s.total,0);
        const cout   = sales.reduce((t,s)=>t+(s.total-s.profit),0);
        const netProfit = ca - cout - expT;
        return `## 💸 Analyse des Dépenses

**Résumé :**
- Total dépenses : **${Utils.currency(expT)}** (${exps.length} opération(s))
- Ce mois-ci : **${Utils.currency(mExpT)}** (${mExps.length} opération(s))
- Bénéfice net réel : **${Utils.currency(netProfit)}**${netProfit<0?' ⚠️ DÉFICIT':''}

---
**Top catégories de dépenses :**
${topCat.length?topCat.map(([cat,amt])=>`- ${cat} : **${Utils.currency(amt)}**`).join('\n'):I18n.t('no_expenses')}

---
**Action recommandée :** ${expT>ca*0.3&&ca>0?'⚠️ Vos dépenses représentent '+Math.round(expT/ca*100)+'% de votre CA — réduisez les charges non essentielles.':netProfit>0?'✅ Vos dépenses sont maîtrisées. Continuez à les surveiller mensuellement.':'Commencez par enregistrer vos dépenses régulières pour un suivi précis.'}`;
      }

      case 'retours': {
        const rets  = DB.data.returns || [];
        const retAmt = rets.reduce((t,r)=>t+r.amount,0);
        const byItem = {};
        rets.forEach(r=>{if(!byItem[r.itemName])byItem[r.itemName]=0;byItem[r.itemName]++;});
        const topRet = Object.entries(byItem).sort((a,b)=>b[1]-a[1]).slice(0,3);
        return `## ↩️ Analyse des Retours Clients

**Résumé :**
- Nombre de retours : **${rets.length}**
- Montant total retourné : **${Utils.currency(retAmt)}**

${topRet.length?`**Produits les plus retournés :**
${topRet.map(([name,cnt])=>`- ${Utils.esc(name)} : **${cnt}** retour(s)`).join('\n')}

`:''}
**Action recommandée :** ${rets.length>5?'⚠️ Taux de retours élevé — vérifiez la qualité des produits les plus retournés.':rets.length>0?'Surveillez les retours pour identifier des problèmes de qualité.':(I18n._lang==='en'?'✅ No returns — excellent quality sign!':'✅ Aucun retour — excellent signe de qualité !')}`;
      }

      default:
        return `## 🤖 Assistant IA — Smart Market Pro

Bonjour ! Je suis votre assistant IA avancé. Je connais **toutes vos données en temps réel**.

**Votre commerce en un coup d'œil :**
- 💰 CA total : **${ca}${curr}** | Aujourd'hui : **${caT}${curr}**
- 📈 Profit : ${pft}${curr} (${margin}% de marge)
- 📦 Stock : ${DB.data.items.length} produits (${outOfStock.length} épuisé(s))
- 💳 Dettes : ${debt}${curr}
- 🛒 Ventes : ${sales.length} au total

**Je peux analyser :**
- 📊 Bilan du jour / semaine / mois
- 📦 Stock urgent et prédictions d'épuisement
- 👥 Performance de vos vendeurs
- 🏆 Vos meilleurs produits
- 💳 Dettes et recouvrement
- 🔮 Prédictions et tendances
- 📈 Recommandations personnalisées

Que souhaitez-vous analyser ?`;
    }
  },

  addMessage(text, role) {
    const c=document.getElementById('ai-chat'); if(!c) return;
    const div=document.createElement('div'); div.className=`ai-msg ai-msg-${role}`;
    // Format markdown: **bold**, ## headers, - lists
    const formatted=Utils.esc(text)
      .replace(/## ([^\n]+)/g,'<div style="font-family:var(--fd);font-weight:800;font-size:.9rem;color:var(--accent);margin:8px 0 4px">$1</div>')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/^- (.+)$/gm,'<div style="padding-left:12px">• $1</div>')
      .replace(/^(\d+)\. (.+)$/gm,'<div style="padding-left:12px"><strong>$1.</strong> $2</div>')
      .replace(/---/g,'<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">')
      .replace(/\n/g,'<br>');
    div.innerHTML=`<div class="ai-msg-content">${formatted}</div>`;
    c.appendChild(div); c.scrollTop=c.scrollHeight;
  },

  showTyping() {
    const c=document.getElementById('ai-chat'); if(!c) return;
    const d=document.createElement('div'); d.className='ai-msg ai-msg-bot'; d.id='ai-typing';
    d.innerHTML='<div class="ai-msg-content ai-typing"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';
    c.appendChild(d); c.scrollTop=c.scrollHeight;
  },

  removeTyping() { document.getElementById('ai-typing')?.remove(); },

  async send() {
    const input = document.getElementById('ai-input');
    const msg   = input?.value.trim(); if (!msg) return;
    input.value = '';
    this.addMessage(msg, 'user');
    this.showTyping();
    const btn = document.getElementById('btn-ai-send'); if(btn) btn.disabled=true;
    this._history.push({role:'user', content:msg});

    let reply = null;

    // Try real API first if configured
    try {
      const apiCfg = AIConfig.load();
      if (apiCfg && apiCfg.provider !== 'local' && apiCfg.apiKey) {
        const systemPrompt = this.buildContext();
        reply = await AIConfig.callAPI(msg, apiCfg.provider, apiCfg.apiKey, systemPrompt, this._history.slice(0,-1));
      }
    } catch(e) {
      console.warn('[AI] API call failed, falling back to local:', e.message);
      // Informer l'utilisateur de l'erreur API (pas juste silencieux)
      if (e.message && !e.message.includes('fetch')) {
        this.addMessage('⚠️ Erreur API : ' + e.message + '\n\nJe réponds en mode local.', 'bot');
      }
    }

    // Fallback to local intelligent analysis
    if (!reply) {
      await new Promise(r => setTimeout(r, 500 + Math.random()*300));
      reply = this.localReply(msg);
    }

    this._history.push({role:'assistant', content:reply});
    this.removeTyping();
    this.addMessage(reply, 'bot');
    if(btn) btn.disabled=false;
  },

  quick(q) { const i=document.getElementById('ai-input'); if(i) i.value=q; this.send(); },

  async generateSummary() {
    if(this._generated) return;
    const btn=document.getElementById('btn-ai-summary');
    const content=document.getElementById('ai-summary-content');
    const anomalies=document.getElementById('ai-anomalies');
    if(!content) return;
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Analyse avancée...';}
    await new Promise(r=>setTimeout(r,800));

    const sales=DB.activeSales(); const today=new Date().toDateString();
    const todayS=sales.filter(s=>new Date(s.date).toDateString()===today);
    const ca=sales.reduce((s,v)=>s+v.total,0); const caT=todayS.reduce((s,v)=>s+v.total,0);
    const pft=sales.reduce((s,v)=>s+v.profit,0); const debt=sales.reduce((s,v)=>s+v.debt,0);
    const margin=ca>0?((pft/ca)*100).toFixed(1):'0'; const curr=Settings.getCurrency();
    const pm={}; sales.forEach(s=>{if(!pm[s.itemName])pm[s.itemName]={ca:0,qty:0};pm[s.itemName].ca+=s.total;pm[s.itemName].qty+=s.qty;});
    const topP=Object.entries(pm).sort((a,b)=>b[1].ca-a[1].ca)[0];
    const critical=DB.data.items.filter(i=>i.qty<=(i.min||5)&&i.qty>0);
    const outOfStk=DB.data.items.filter(i=>i.qty===0);
    const negMrg=DB.data.items.filter(i=>i.sell<i.buy);
    const weekCA=DB.salesInPeriod('week').reduce((t,s)=>t+s.total,0);
    const stats=this.loadStats();

    let score=70;
    if(parseFloat(margin)>20)score+=15;else if(parseFloat(margin)>15)score+=8;else if(parseFloat(margin)<5)score-=25;
    if(debt>ca*0.3&&ca>0)score-=20;else if(debt<ca*0.1)score+=5;
    outOfStk.forEach(()=>score-=6); negMrg.forEach(()=>score-=10);
    if(caT>0)score+=5; if(weekCA>0)score+=5;
    score=Math.max(0,Math.min(100,score));
    const sc=score>=70?'var(--accent)':score>=40?'var(--warning)':'var(--danger)';
    const sl=score>=80?'Excellent':score>=70?'Bonne santé':score>=50?'Score moyen':'Attention requise';

    content.innerHTML=`
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <div style="text-align:center;background:var(--sur2);border-radius:50%;width:80px;height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px solid ${sc}">
          <div style="font-family:var(--fd);font-size:1.6rem;font-weight:800;color:${sc}">${score}</div>
          <div style="font-size:.55rem;color:var(--text3);font-family:var(--fm)">/100</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-weight:800;font-size:1rem;color:${sc};margin-bottom:6px">${sl}</div>
          <div style="font-size:.8rem;color:var(--text2);line-height:1.6">
            CA total : <strong>${ca}${curr}</strong> | Marge : <strong>${margin}%</strong><br>
            Aujourd'hui : <strong>${caT}${curr}</strong> | Semaine : <strong>${weekCA}${curr}</strong><br>
            ${stats.totalQueries>0?`IA utilisée <strong>${stats.totalQueries}x</strong> — auto-amélioration active`:'Première session IA'}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.6rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Meilleur produit</div>
          <div style="font-weight:700">${topP?Utils.esc(topP[0]):I18n.t('no_sales')}</div>
          ${topP?`<div style="font-size:.72rem;color:var(--accent)">${topP[1].ca}${curr}</div>`:''}
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.6rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Dettes clients</div>
          <div style="font-weight:700;color:${debt>0?'var(--danger)':'var(--accent)'}">${Utils.currency(debt)}</div>
          <div style="font-size:.72rem;color:var(--text3)">${sales.filter(s=>s.debt>0).length} impayé(s)</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.6rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Alertes stock</div>
          <div style="font-weight:700;color:${(critical.length+outOfStk.length)>0?'var(--warning)':'var(--accent)'}">${critical.length+outOfStk.length}</div>
          <div style="font-size:.72rem;color:var(--text3)">${outOfStk.length} épuisé(s)</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px">
          <div style="font-family:var(--fm);font-size:.6rem;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Liquidités</div>
          <div style="font-weight:700;color:var(--accent)">${Utils.currency(DB.data.cashInit+(ca-debt))}</div>
          <div style="font-size:.72rem;color:var(--text3)">Disponible</div>
        </div>
      </div>`;

    const anoms=[];
    outOfStk.forEach(i=>anoms.push({type:'danger',msg:`<strong>${Utils.esc(i.name)}</strong> épuisé — ventes bloquées, commandez immédiatement`}));
    negMrg.forEach(i=>anoms.push({type:'danger',msg:`<strong>${Utils.esc(i.name)}</strong> vendu à perte (${i.buy-i.sell}${curr}/unité) — ajustez le prix`}));
    if(debt>ca*0.3&&ca>0)anoms.push({type:'danger',msg:`Dettes = ${(debt/ca*100).toFixed(0)}% du CA — risque financier élevé`});
    critical.forEach(i=>anoms.push({type:'warn',msg:`Stock faible : <strong>${Utils.esc(i.name)}</strong> (${i.qty} restant${i.qty>1?'s':', planifiez le réappro'})`}));
    if(parseFloat(margin)<10&&ca>0)anoms.push({type:'warn',msg:`Marge globale faible : ${margin}% (recommandé : >15%)`});

    if(anomalies) anomalies.innerHTML=anoms.length?anoms.map(a=>`<div class="alert-item alert-${a.type}" style="margin-bottom:6px">${a.type==='danger'?'🔴':'🟡'} ${a.msg}</div>`).join(''):`<div style="color:var(--accent);font-weight:600;padding:12px;background:rgba(0,232,122,.08);border-radius:var(--rsm)">✅ <strong>Aucune anomalie détectée</strong> — votre commerce fonctionne parfaitement !</div>`;

    this._generated=true;
    if(btn){btn.disabled=false;btn.innerHTML='🔄 Actualiser l\'analyse';}
    setTimeout(()=>this._generated=false,500);
  }
};


/* ═══════════════════════════════════════════════════════
   MODULE: CATEGORIES — Catégories de produits
   ═══════════════════════════════════════════════════════ */
