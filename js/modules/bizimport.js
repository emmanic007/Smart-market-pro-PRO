'use strict';
const BizImport = {
  _data:      [],   // Données parsées
  _headers:   [],   // En-têtes détectées
  _mapping:   {},   // Mapping colonnes -> champs SMP
  _analyzed:  null, // Résultat analyse IA
  _chatHistory: [],

  /* ── Chargement et parsing du fichier ── */
  loadFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const ext = file.name.split('.').pop().toLowerCase();
      try {
        if (ext === 'json')     this._parseJSON(content);
        else if (ext === 'csv') this._parseCSV(content);
        else                    this._parseTXT(content);

        document.getElementById('biz-file-info').innerHTML =
          `<span style="color:var(--accent)">✅ ${Utils.esc(file.name)} chargé — ${this._data.length} lignes, ${this._headers.length} colonnes</span>`;
        this._showMapping();
      } catch(e) {
        document.getElementById('biz-file-info').innerHTML =
          `<span style="color:var(--danger)">❌ Erreur de lecture: ${Utils.esc(e.message)}</span>`;
      }
    };
    reader.readAsText(file, 'UTF-8');
  },

  _parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('Fichier CSV vide ou invalide');
    const sep = this._detectSeparator(lines[0]);
    this._headers = this._parseCSVLine(lines[0], sep).map(h => h.trim().replace(/^["']|["']$/g,''));
    this._data = lines.slice(1).map(line => {
      const vals = this._parseCSVLine(line, sep);
      const obj = {};
      this._headers.forEach((h,i) => obj[h] = (vals[i]||'').trim().replace(/^["']|["']$/g,''));
      return obj;
    }).filter(r => Object.values(r).some(v => v));
  },

  _parseCSVLine(line, sep) {
    const res = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' && !inQ) { inQ = true; }
      else if (line[i] === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; }
      else if (line[i] === '"' && inQ) { inQ = false; }
      else if (line[i] === sep && !inQ) { res.push(cur); cur = ''; }
      else { cur += line[i]; }
    }
    res.push(cur);
    return res;
  },

  _detectSeparator(line) {
    const counts = { ',':0, ';':0, '\t':0, '|':0 };
    for (const ch of line) if (ch in counts) counts[ch]++;
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  },

  _parseJSON(text) {
    const parsed = JSON.parse(text);
    // Handle SMP backup format or array
    const arr = parsed.data?.sales || parsed.sales || (Array.isArray(parsed) ? parsed : null);
    if (!arr || !arr.length) throw new Error('Format JSON non reconnu');
    this._headers = Object.keys(arr[0]);
    this._data    = arr;
  },

  _parseTXT(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('Fichier TXT vide');
    // Try tab or space separated
    const sep = lines[0].includes('\t') ? '\t' : '  ';
    this._headers = lines[0].split(sep).map(h => h.trim()).filter(h => h);
    this._data = lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.trim());
      const obj = {};
      this._headers.forEach((h,i) => obj[h] = vals[i] || '');
      return obj;
    });
  },

  /* ── Détection automatique des colonnes ── */
  _detectMapping() {
    const mapping = { date:'', product:'', quantity:'', price:'', total:'', client:'' };
    const patterns = {
      date:     /date|jour|day|time|heure/i,
      product:  /produit|article|product|item|nom|name|désignation/i,
      quantity: /qté|qty|quantité|quantity|nb|nombre/i,
      price:    /prix|price|tarif|unit|unitaire/i,
      total:    /total|montant|amount|ca|chiffre/i,
      client:   /client|customer|acheteur|buyer/i,
    };
    this._headers.forEach(h => {
      for (const [field, regex] of Object.entries(patterns)) {
        if (!mapping[field] && regex.test(h)) mapping[field] = h;
      }
    });
    return mapping;
  },

  _showMapping() {
    const mapping  = this._detectMapping();
    this._mapping  = mapping;
    const fields   = document.getElementById('biz-mapping-fields');
    const card     = document.getElementById('biz-mapping-card');
    if (!fields || !card) return;

    const fieldLabels = {
      date:'📅 Colonne Date', product:'📦 Colonne Produit', quantity:'🔢 Colonne Quantité',
      price:'💰 Colonne Prix Unitaire', total:'💵 Colonne Total', client:'👤 Colonne Client'
    };

    fields.innerHTML = Object.entries(fieldLabels).map(([field, label]) => `
      <div class="form-group">
        <label class="form-label">${label}</label>
        <select id="map-${field}" onchange="BizImport._mapping['${field}']=this.value">
          <option value="">— Non disponible —</option>
          ${this._headers.map(h => `<option value="${Utils.esc(h)}" ${mapping[field]===h?'selected':''}>${Utils.esc(h)}</option>`).join('')}
        </select>
      </div>`).join('');

    card.style.display = '';
    document.getElementById('biz-results-card').style.display = 'none';
    document.getElementById('biz-chat-card').style.display = 'none';
  },

  /* ── Analyse IA des données importées ── */
  async analyze() {
    // Read mapping from selects
    ['date','product','quantity','price','total','client'].forEach(f => {
      const el = document.getElementById(`map-${f}`);
      if (el) this._mapping[f] = el.value;
    });

    const resultsCard = document.getElementById('biz-results-card');
    const content     = document.getElementById('biz-analysis-content');
    if (!resultsCard || !content) return;

    content.innerHTML = '<div style="display:flex;align-items:center;gap:10px;color:var(--text3)"><span class="spinner"></span> Analyse IA en cours...</div>';
    resultsCard.style.display = '';
    await new Promise(r => setTimeout(r, 800));

    // Compute stats from imported data
    const rows = this._data;
    const mapp = this._mapping;
    const curr = Settings.getCurrency();

    let totalCA=0, totalQty=0, dateMin='', dateMax='';
    const productMap={}, clientMap={}, monthMap={};

    rows.forEach(row => {
      const qty   = parseFloat(row[mapp.quantity]) || 1;
      const price = parseFloat(row[mapp.price])    || 0;
      const total = parseFloat(row[mapp.total])    || price*qty;
      const prod  = row[mapp.product] || 'Inconnu';
      const client= row[mapp.client]  || '';
      const dateRaw = row[mapp.date]  || '';

      totalCA  += total;
      totalQty += qty;

      if (!productMap[prod]) productMap[prod]={ca:0,qty:0};
      productMap[prod].ca  += total;
      productMap[prod].qty += qty;

      if (client) {
        if (!clientMap[client]) clientMap[client]=0;
        clientMap[client] += total;
      }

      if (dateRaw) {
        const d = new Date(dateRaw);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (!monthMap[key]) monthMap[key]=0;
          monthMap[key] += total;
          if (!dateMin||dateRaw<dateMin) dateMin=dateRaw;
          if (!dateMax||dateRaw>dateMax) dateMax=dateRaw;
        }
      }
    });

    const top5Prods  = Object.entries(productMap).sort((a,b)=>b[1].ca-a[1].ca).slice(0,5);
    const top5Clients= Object.entries(clientMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const months     = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0]));
    const bestMonth  = months.sort((a,b)=>b[1]-a[1])[0];
    const avgTransaction = rows.length > 0 ? totalCA/rows.length : 0;
    const maxCA = top5Prods[0]?.[1]?.ca || 1;

    this._analyzed = { totalCA, totalQty, rows:rows.length, top5Prods, top5Clients, months, dateMin, dateMax };

    const formatDate = (d) => { try { return new Date(d).toLocaleDateString('fr-FR'); } catch(_){return d;} };

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px;text-align:center">
          <div style="font-size:.6rem;color:var(--text3);font-family:var(--fm);text-transform:uppercase;margin-bottom:4px">CA Total</div>
          <div style="font-family:var(--fd);font-size:1.1rem;font-weight:800;color:var(--accent)">${Math.round(totalCA).toLocaleString('fr-FR')} ${curr}</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px;text-align:center">
          <div style="font-size:.6rem;color:var(--text3);font-family:var(--fm);text-transform:uppercase;margin-bottom:4px">Transactions</div>
          <div style="font-family:var(--fd);font-size:1.1rem;font-weight:800">${rows.length}</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px;text-align:center">
          <div style="font-size:.6rem;color:var(--text3);font-family:var(--fm);text-transform:uppercase;margin-bottom:4px">Panier Moyen</div>
          <div style="font-family:var(--fd);font-size:1.1rem;font-weight:800">${Math.round(avgTransaction).toLocaleString('fr-FR')} ${curr}</div>
        </div>
        <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:12px;text-align:center">
          <div style="font-size:.6rem;color:var(--text3);font-family:var(--fm);text-transform:uppercase;margin-bottom:4px">Période</div>
          <div style="font-size:.72rem;font-weight:700">${dateMin?formatDate(dateMin)+' → '+formatDate(dateMax):'Non détectée'}</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-family:var(--fd);font-weight:700;font-size:.85rem;margin-bottom:10px;color:var(--accent)">🏆 Top Produits</div>
        ${top5Prods.map(([name,d],i)=>`
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="font-weight:700;width:18px;color:var(--text3)">${i+1}</div>
            <div style="flex:1">
              <div style="font-size:.8rem;font-weight:600;margin-bottom:3px">${Utils.esc(name)}</div>
              <div style="height:4px;background:var(--border);border-radius:2px"><div style="height:100%;width:${(d.ca/maxCA*100).toFixed(0)}%;background:var(--accent);border-radius:2px"></div></div>
            </div>
            <div style="font-family:var(--fm);font-size:.72rem;color:var(--text2);text-align:right;min-width:70px">${Math.round(d.ca).toLocaleString('fr-FR')} ${curr}</div>
          </div>`).join('')}
      </div>

      ${bestMonth?`<div style="background:rgba(0,232,122,.08);border-left:3px solid var(--accent);padding:12px;border-radius:var(--rsm);margin-bottom:12px;font-size:.82rem">
        📅 <strong>Meilleur mois :</strong> ${bestMonth[0]} avec <strong>${Math.round(bestMonth[1]).toLocaleString('fr-FR')} ${curr}</strong>
      </div>`:''}

      ${top5Clients.length?`<div style="margin-bottom:16px">
        <div style="font-family:var(--fd);font-weight:700;font-size:.85rem;margin-bottom:8px;color:var(--info)">👥 Top Clients</div>
        ${top5Clients.map(([name,ca],i)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:.8rem"><span>${i+1}. ${Utils.esc(name)}</span><strong>${Math.round(ca).toLocaleString('fr-FR')} ${curr}</strong></div>`).join('')}
      </div>`:''}

      <div style="background:var(--sur2);border:1px solid var(--border);border-radius:var(--rmd);padding:14px;margin-bottom:10px">
        <div style="font-family:var(--fd);font-weight:700;font-size:.82rem;margin-bottom:8px">🤖 Synthèse IA</div>
        <div style="font-size:.8rem;color:var(--text2);line-height:1.7">
          ${this._generateInsight(totalCA, rows.length, top5Prods, months, curr)}
        </div>
      </div>`;

    document.getElementById('biz-chat-card').style.display = '';
    this._chatHistory = [];
  },

  _generateInsight(totalCA, txCount, top5, months, curr) {
    const insights = [];
    if (txCount > 0) insights.push(`Votre historique couvre <strong>${txCount} transactions</strong> pour un CA total de <strong>${Math.round(totalCA).toLocaleString('fr-FR')} ${curr}</strong>.`);
    if (top5.length) {
      const leader = top5[0];
      const share  = totalCA > 0 ? (leader[1].ca/totalCA*100).toFixed(1) : 0;
      insights.push(`Votre produit phare est <strong>${leader[0]}</strong> avec <strong>${Math.round(leader[1].ca).toLocaleString('fr-FR')} ${curr}</strong> (${share}% du CA total).`);
    }
    const sorted = months.slice().sort((a,b)=>b[1]-a[1]);
    if (sorted.length >= 2) {
      const [best, worst] = [sorted[0], sorted[sorted.length-1]];
      insights.push(`Votre meilleur mois est <strong>${best[0]}</strong> (${Math.round(best[1]).toLocaleString('fr-FR')} ${curr}) et votre plus faible est <strong>${worst[0]}</strong> (${Math.round(worst[1]).toLocaleString('fr-FR')} ${curr}).`);
    }
    if (top5.length > 1) {
      const concentration = totalCA > 0 ? (top5.slice(0,2).reduce((t,[,d])=>t+d.ca,0)/totalCA*100).toFixed(0) : 0;
      if (parseInt(concentration) > 60) {
        insights.push(`⚠️ <strong>Risque de concentration :</strong> vos 2 meilleurs produits représentent ${concentration}% du CA. Diversifiez votre offre.`);
      } else {
        insights.push(`✅ Bonne diversification : vos ventes sont réparties sur plusieurs produits.`);
      }
    }
    return insights.join(' ');
  },

  async chat() {
    const input = document.getElementById('biz-chat-input'); if (!input) return;
    const q = input.value.trim(); if (!q) return;
    input.value = '';

    const chatEl = document.getElementById('biz-chat');
    const addMsg = (text, role) => {
      const div = document.createElement('div');
      div.className = `ai-msg ai-msg-${role}`;
      div.innerHTML = `<div class="ai-msg-content">${Utils.esc(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}</div>`;
      chatEl.appendChild(div); chatEl.scrollTop = chatEl.scrollHeight;
    };

    addMsg(q, 'user');
    // Show typing
    const typing = document.createElement('div');
    typing.id = 'biz-typing'; typing.className = 'ai-msg ai-msg-bot';
    typing.innerHTML = '<div class="ai-msg-content ai-typing"><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div></div>';
    chatEl.appendChild(typing); chatEl.scrollTop = chatEl.scrollHeight;

    await new Promise(r => setTimeout(r, 600));
    typing.remove();

    const reply = this._analyzeQuestion(q);
    addMsg(reply, 'bot');
  },

  _analyzeQuestion(q) {
    if (!this._analyzed) return 'Veuillez d\'abord analyser un fichier.';
    const { totalCA, rows, top5Prods, top5Clients, months, dateMin, dateMax } = this._analyzed;
    const curr = Settings.getCurrency();
    const low = q.toLowerCase();

    if (low.match(/total|ca|chiffre/)) {
      return `**CA total importé :** ${Math.round(totalCA).toLocaleString('fr-FR')} ${curr} sur ${rows} transactions.\nPanier moyen : ${Math.round(totalCA/Math.max(1,rows)).toLocaleString('fr-FR')} ${curr}.`;
    }
    if (low.match(/meilleur|top|produit/)) {
      if (!top5Prods.length) return 'Aucune donnée produit disponible.';
      return `**Top produits :**\n${top5Prods.map(([n,d],i)=>`${i+1}. ${n} : ${Math.round(d.ca).toLocaleString('fr-FR')} ${curr}`).join('\n')}`;
    }
    if (low.match(/mois|période|saison/)) {
      if (!months.length) return 'Aucune donnée de date détectée.';
      const sorted = months.slice().sort((a,b)=>b[1]-a[1]);
      return `**Meilleur mois :** ${sorted[0]?.[0]} (${Math.round(sorted[0]?.[1]||0).toLocaleString('fr-FR')} ${curr})\n**Plus faible mois :** ${sorted[sorted.length-1]?.[0]}`;
    }
    if (low.match(/client|acheteur/)) {
      if (!top5Clients.length) return 'Aucune donnée client détectée dans le fichier.';
      return `**Top clients :**\n${top5Clients.map(([n,ca],i)=>`${i+1}. ${n} : ${Math.round(ca).toLocaleString('fr-FR')} ${curr}`).join('\n')}`;
    }
    if (low.match(/conseil|améliorer|recommand/)) {
      const suggestions = [];
      if (top5Prods.length >= 2) {
        const [a,b] = top5Prods;
        if (a[1].ca > b[1].ca*3) suggestions.push(`Réduire la dépendance à ${a[0]} (${(a[1].ca/totalCA*100).toFixed(0)}% du CA)`);
      }
      suggestions.push('Analyser les mois les plus faibles pour identifier les causes');
      suggestions.push('Comparer avec les données actuelles dans Smart Market Pro');
      return '**Recommandations :**\n' + suggestions.map((s,i)=>`${i+1}. ${s}`).join('\n');
    }
    return `Sur ${rows} transactions analysées, votre CA est de **${Math.round(totalCA).toLocaleString('fr-FR')} ${curr}**. Posez-moi des questions sur : les produits, les clients, les mois, ou les recommandations.`;
  },

  importToApp() {
    if (!this._data.length || !this._mapping.product) {
      return UI.toast(I18n.t('toast_err_no_data'),'warning');
    }
    const mapp = this._mapping;
    let imported = 0;
    this._data.forEach(row => {
      const name  = row[mapp.product] || 'Importé';
      const qty   = Utils.int(row[mapp.quantity]) || 1;
      const price = Utils.num(row[mapp.price])    || 0;
      const total = Utils.num(row[mapp.total])    || price*qty;
      const client= row[mapp.client] || '';
      const date  = row[mapp.date]   ? new Date(row[mapp.date]).toISOString() : new Date().toISOString();
      if (!name || isNaN(total) || total <= 0) return;
      DB.data.sales.push({
        id: Utils.uid(), date, itemId:'imported', itemName:name.trim(),
        qty, price, total, debt:0, profit:0,
        userId:'imported', userName:'Import IA', clientName:client,
        deleted:false, imported:true
      });
      imported++;
    });
    DB.save();
    UI.renderAll();
    UI.toast(`${imported} ${I18n.t('toast_imported')}`,'success');
  },

  exportAnalysis() {
    if (!this._analyzed) return;
    const { totalCA, rows, top5Prods, months } = this._analyzed;
    const curr = Settings.getCurrency();
    const lines = [
      ['ANALYSE IA — Smart Market Pro'],
      ['Date', new Date().toLocaleDateString('fr-FR')],
      [],
      ['CA Total', totalCA, curr],
      ['Transactions', rows],
      [],
      ['TOP PRODUITS'],
      ['Produit','CA','Quantité'],
      ...top5Prods.map(([n,d])=>[n,d.ca,d.qty]),
      [],
      ['PAR MOIS'],
      ['Mois','CA'],
      ...months.map(([m,ca])=>[m,ca])
    ];
    const csv = '\uFEFF' + lines.map(r=>r.map(c=>String(c??'')).join(',')).join('\r\n');
    StorageConfig.downloadToLocation(csv, 'Analyse_IA_Import.csv', 'text/csv;charset=utf-8;');
  },

  reset() {
    this._data=[]; this._headers=[]; this._mapping={}; this._analyzed=null;
    document.getElementById('biz-mapping-card').style.display='none';
    document.getElementById('biz-results-card').style.display='none';
    document.getElementById('biz-chat-card').style.display='none';
    document.getElementById('biz-file-info').textContent='';
    document.getElementById('biz-import-file').value='';
  }
};



/* ═══════════════ AI CONFIG — Clé API externe ═══════════════ */
