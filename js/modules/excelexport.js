'use strict';
const ExcelExport = {

  /* ── Télécharger un fichier Excel (.xlsx) via SheetJS ── */
  _download(filename, sheets) {
    // sheets = [{name, data, headers}]
    try {
      if (typeof XLSX === 'undefined') {
        // Fallback CSV si SheetJS non chargé
        this._downloadCSV(filename.replace('.xlsx','.csv'), sheets[0].data);
        return;
      }
      const wb = XLSX.utils.book_new();
      sheets.forEach(({name, data, headers, colWidths}) => {
        // Créer la feuille
        const ws = XLSX.utils.aoa_to_sheet(data);
        // Largeurs de colonnes
        if (colWidths) ws['!cols'] = colWidths.map(w=>({wch:w}));
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
      });
      XLSX.writeFile(wb, filename);
      UI.toast(I18n.t('toast_export_excel'),'success');
    } catch(e) {
      console.error('[Excel]', e);
      UI.toast('Erreur export: ' + e.message, 'danger');
    }
  },

  /* Fallback CSV si SheetJS absent */
  _downloadCSV(filename, rows) {
    const BOM = '\uFEFF';
    const csv = BOM + rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')
    ).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    UI.toast(I18n.t('toast_export_excel'),'success');
  },

  /* ── Rapport Journalier ── */
  daily() {
    const today  = new Date().toDateString();
    const sales  = DB.activeSales().filter(s => new Date(s.date).toDateString() === today);
    const shop   = Settings.data.shopName || 'Smart Market Pro';
    const curr   = Settings.getCurrency();
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const ca     = sales.reduce((s,v)=>s+v.total,0);
    const profit = sales.reduce((s,v)=>s+(v.profit||0),0);
    const dettes = sales.reduce((s,v)=>s+v.debt,0);

    const data = [
      [shop + ' — Rapport Journalier', dateStr],
      [],
      ['RÉSUMÉ DU JOUR'],
      ['CA Total', ca + ' ' + curr],
      ['Profit Net', profit + ' ' + curr],
      ['Dettes', dettes + ' ' + curr],
      ['Nombre de ventes', sales.length],
      [],
      ['DÉTAIL DES VENTES'],
      ['Heure','Vendeur','Article','Qté','Prix Unit.','Total','Dette','Client'],
      ...sales.map(s => [
        new Date(s.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        s.userName||'', s.itemName||'', s.qty,
        s.price+' '+curr, s.total+' '+curr,
        s.debt+' '+curr, s.clientName||''
      ])
    ];

    this._download('Rapport_Journalier_'+dateStr.split('/').join('-')+'.xlsx', [
      {name:'Rapport Journalier', data, colWidths:[12,15,20,6,12,12,12,15]}
    ]);
  },

  /* ── Rapport Mensuel ── */
  monthly() {
    const now   = new Date();
    const sales = DB.activeSales().filter(s => {
      const d = new Date(s.date);
      return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    });
    const shop  = Settings.data.shopName || 'Smart Market Pro';
    const curr  = Settings.getCurrency();
    const mois  = now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    const ca    = sales.reduce((s,v)=>s+v.total,0);
    const profit= sales.reduce((s,v)=>s+(v.profit||0),0);
    const dettes= sales.reduce((s,v)=>s+v.debt,0);

    // Feuille 1 : Résumé
    const resume = [
      [shop + ' — Rapport Mensuel', mois],
      [],
      ['RÉSUMÉ DU MOIS'],
      ['CA Total', ca+' '+curr],
      ['Profit Net', profit+' '+curr],
      ['Dettes', dettes+' '+curr],
      ['Nombre de ventes', sales.length],
      ['Panier moyen', sales.length ? Math.round(ca/sales.length)+' '+curr : '0'],
    ];

    // Feuille 2 : Détail ventes
    const detail = [
      ['Date','Heure','Vendeur','Article','Qté','Prix Unit.','Total','Dette','Client'],
      ...sales.map(s => [
        new Date(s.date).toLocaleDateString('fr-FR'),
        new Date(s.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        s.userName||'', s.itemName||'', s.qty,
        s.price+' '+curr, s.total+' '+curr,
        s.debt+' '+curr, s.clientName||''
      ])
    ];

    // Feuille 3 : Top produits
    const byItem = {};
    sales.forEach(s => {
      if (!byItem[s.itemName]) byItem[s.itemName]={name:s.itemName,qty:0,ca:0};
      byItem[s.itemName].qty += s.qty;
      byItem[s.itemName].ca  += s.total;
    });
    const topItems = Object.values(byItem).sort((a,b)=>b.ca-a.ca);
    const topSheet = [
      ['Article','Quantité vendue','CA Généré'],
      ...topItems.map(i=>[i.name, i.qty, i.ca+' '+curr])
    ];

    this._download('Rapport_Mensuel_'+mois.replace(' ','_')+'.xlsx', [
      {name:'Résumé', data:resume, colWidths:[25,15]},
      {name:'Détail Ventes', data:detail, colWidths:[12,8,15,20,6,12,12,12,15]},
      {name:'Top Produits', data:topSheet, colWidths:[25,18,15]}
    ]);
  },

  /* ── Export Stock ── */
  stock() {
    const items = [...DB.data.items].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    const curr  = Settings.getCurrency();
    const date  = new Date().toLocaleDateString('fr-FR');

    const data = [
      [Settings.data.shopName+' — État du Stock', date],
      [],
      ['Article','Catégorie','Stock','Prix Achat','Prix Vente','Marge','Marge %','Alerte'],
      ...items.map(i => {
        const marge   = i.sell - i.buy;
        const margePct= i.buy > 0 ? Math.round(marge/i.buy*100) : 0;
        const alerte  = i.qty <= 0 ? 'RUPTURE' : i.qty <= (i.min||0) ? 'FAIBLE' : 'OK';
        return [
          i.name, i.category||'', i.qty,
          i.buy+' '+curr, i.sell+' '+curr,
          marge+' '+curr, margePct+'%', alerte
        ];
      })
    ];

    this._download('Export_Stock_'+date.split('/').join('-')+'.xlsx', [
      {name:'Stock', data, colWidths:[25,15,8,12,12,12,10,10]}
    ]);
  },

  /* ── Export Dettes ── */
  debts() {
    const curr     = Settings.getCurrency();
    const date     = new Date().toLocaleDateString('fr-FR');
    const debtSales= DB.activeSales().filter(s=>s.debt>0);
    const total    = debtSales.reduce((t,s)=>t+s.debt,0);

    const data = [
      [Settings.data.shopName+' — Rapport Dettes', date],
      [],
      ['Total Impayés', total+' '+curr],
      ['Nombre de créances', debtSales.length],
      [],
      ['Date','Client','Article','Total Vente','Montant Impayé'],
      ...debtSales.map(s=>[
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.clientName||'—', s.itemName,
        s.total+' '+curr, s.debt+' '+curr
      ])
    ];

    this._download('Rapport_Dettes_'+date.split('/').join('-')+'.xlsx', [
      {name:'Dettes', data, colWidths:[12,18,20,14,14]}
    ]);
  },

  /* ── Alias pour compatibilité boutons existants ── */
  stockReport()    { this.stock(); },
  debtsReport()    { this.debts(); },

  /* ── Export Dépenses ── */
  expensesReport() {
    const curr  = Settings.getCurrency();
    const date  = new Date().toLocaleDateString('fr-FR');
    const exps  = [...(DB.data.expenses||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const total = exps.reduce((t,e)=>t+e.amount,0);
    const data  = [
      [Settings.data.shopName+' — Rapport Dépenses', date],
      [],
      ['Total Dépenses', total+' '+curr],
      ['Nombre d\'entrées', exps.length],
      [],
      ['Date','Description','Catégorie','Montant'],
      ...exps.map(e=>[
        new Date(e.date||0).toLocaleDateString('fr-FR'),
        e.desc||'', e.category||'', e.amount+' '+curr
      ])
    ];
    this._download('Rapport_Depenses_'+date.split('/').join('-')+'.xlsx',[
      {name:'Dépenses', data, colWidths:[12,25,18,12]}
    ]);
  },

  /* ── Export Historique complet ── */
  historyReport() {
    const curr  = Settings.getCurrency();
    const date  = new Date().toLocaleDateString('fr-FR');
    const sales = [...DB.activeSales()].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const ca    = sales.reduce((t,s)=>t+s.total,0);
    const data  = [
      [Settings.data.shopName+' — Historique Complet', date],
      [],
      ['CA Total', ca+' '+curr],
      ['Nombre de ventes', sales.length],
      [],
      ['Date','Heure','Vendeur','Article','Qté','Prix Unit.','Total','Payé','Dette','Client'],
      ...sales.map(s=>[
        new Date(s.date).toLocaleDateString('fr-FR'),
        new Date(s.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        s.userName||'', s.itemName||'', s.qty,
        s.price+' '+curr, s.total+' '+curr,
        (s.paid||0)+' '+curr, s.debt+' '+curr, s.clientName||''
      ])
    ];
    this._download('Historique_'+date.split('/').join('-')+'.xlsx',[
      {name:'Historique', data, colWidths:[12,8,15,20,6,12,12,12,12,15]}
    ]);
  },

  /* ── Export Annuel ── */
  annual() {
    const curr  = Settings.getCurrency();
    const year  = new Date().getFullYear();
    const sales = DB.activeSales().filter(s=>new Date(s.date).getFullYear()===year);
    const ca    = sales.reduce((t,s)=>t+s.total,0);
    const byMonth = {};
    for (let m=0;m<12;m++) byMonth[m]={mois:new Date(year,m).toLocaleDateString('fr-FR',{month:'long'}),ca:0,ventes:0};
    sales.forEach(s=>{const m=new Date(s.date).getMonth();byMonth[m].ca+=s.total;byMonth[m].ventes++;});
    const resume = [
      [Settings.data.shopName+' — Rapport Annuel '+year],
      [],
      ['CA Total Annuel', ca+' '+curr],
      ['Total Ventes', sales.length],
      [],
      ['Mois','Ventes','CA'],
      ...Object.values(byMonth).map(m=>[m.mois, m.ventes, m.ca+' '+curr])
    ];
    const detail = [
      ['Date','Vendeur','Article','Qté','Total','Client'],
      ...sales.map(s=>[
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.userName||'', s.itemName||'', s.qty,
        s.total+' '+curr, s.clientName||''
      ])
    ];
    this._download('Rapport_Annuel_'+year+'.xlsx',[
      {name:'Résumé '+year, data:resume, colWidths:[18,10,15]},
      {name:'Détail '+year, data:detail, colWidths:[12,15,20,6,12,15]}
    ]);
  }
};
