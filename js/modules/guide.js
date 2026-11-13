'use strict';
const Guide = {

  _t(fr, en) { return I18n._lang === 'en' ? en : fr; },

  _getSteps() {
    const isAdmin = Auth.isAdmin();
    const t = (fr, en) => this._t(fr, en);
    const all = [
      // ── COMMUN : Admin + Vendeur ──
      {
        role: 'all',
        icon: '🔐',
        title: t('Connexion & Sécurité', 'Login & Security'),
        desc: `<ul>
          <li>${t('Entrez votre <strong>code PIN à 4 chiffres</strong> sur le pavé numérique','Enter your <strong>4-digit PIN</strong> on the keypad')}</li>
          <li>${t('Le code par défaut est <strong>0000</strong> — changez-le dans Paramètres → Modifier mon PIN','Default PIN is <strong>0000</strong> — change it in Settings → Change PIN')}</li>
          <li>${t('Après <strong>5 tentatives incorrectes</strong>, le compte est verrouillé 30 secondes','After <strong>5 incorrect attempts</strong>, the account is locked for 30 seconds')}</li>
          <li>${t('<strong>Admin</strong> : accès complet à toutes les fonctionnalités','<strong>Admin</strong>: full access to all features')}</li>
          <li>${t('<strong>Vendeur</strong> : accès aux ventes, stock et son tableau de bord personnel','<strong>Seller</strong>: access to sales, stock and personal dashboard')}</li>
          <li>${t('Sur mobile : appuyez sur votre nom pour choisir votre compte','On mobile: tap your name to select your account')}</li>
        </ul>`
      },
      {
        role: 'all',
        icon: '🛒',
        title: t('Faire une Vente', 'Making a Sale'),
        desc: `<ul>
          <li>${t('Sélectionnez l\'article dans la liste — le prix se remplit automatiquement','Select the item from the list — the price fills in automatically')}</li>
          <li>${t('Ajustez la quantité si besoin','Adjust the quantity if needed')}</li>
          <li>${t('Si le client paye une partie : entrez le <strong>Montant Payé</strong> — le reste devient une dette','If the client pays partially: enter the <strong>Amount Paid</strong> — the rest becomes a debt')}</li>
          <li>${t('Le <strong>change</strong> s\'affiche en temps réel quand vous tapez le montant payé','The <strong>change</strong> displays in real time as you type the paid amount')}</li>
          <li>${t('Entrez le <strong>nom du client</strong> pour suivre ses dettes et lui attribuer des points fidélité','Enter the <strong>client name</strong> to track debts and assign loyalty points')}</li>
          <li>${t('🖨️ Imprimez ou 📤 partagez le ticket sur WhatsApp après la vente','🖨️ Print or 📤 share the receipt on WhatsApp after the sale')}</li>
        </ul>`
      },
      {
        role: 'all',
        icon: '🏪',
        title: t('Mode Vendeur Simplifié', 'Simplified Seller Mode'),
        desc: `<ul>
          <li>${t('Accès rapide depuis le bouton <strong>"Vendeur"</strong> dans la barre en haut','Quick access via the <strong>"Seller"</strong> button in the top bar')}</li>
          <li>${t('Interface épurée : grille de produits + panier en plein écran','Clean interface: product grid + full-screen cart')}</li>
          <li>${t('Sur mobile : deux onglets — <strong>Produits</strong> et <strong>Panier</strong>','On mobile: two tabs — <strong>Products</strong> and <strong>Cart</strong>')}</li>
          <li>${t('Touchez un produit pour l\'ajouter · Utilisez <strong>−</strong> et <strong>+</strong> pour la quantité','Tap a product to add it · Use <strong>−</strong> and <strong>+</strong> to adjust quantity')}</li>
          <li>${t('Flash vert de confirmation après chaque vente validée','Green flash confirmation after each validated sale')}</li>
          <li>${t('Le montant à rendre s\'affiche si le client paye plus que le total','Change amount displays if the client pays more than the total')}</li>
        </ul>`
      },
      {
        role: 'all',
        icon: '📦',
        title: t('Consulter le Stock', 'Viewing Stock'),
        desc: `<ul>
          <li>${t('Voir tous vos produits avec quantité, prix et état en temps réel','View all your products with quantity, price and status in real time')}</li>
          <li>${t('Les produits <strong style="color:var(--danger)">en rouge</strong> sont sous le seuil d\'alerte ou en rupture','Products <strong style="color:var(--danger)">in red</strong> are below the alert threshold or out of stock')}</li>
          <li>${t('Utilisez la barre de <strong>recherche</strong> en haut pour trouver un produit rapidement','Use the <strong>search</strong> bar at the top to find a product quickly')}</li>
          <li>${t('Sur mobile : chaque produit s\'affiche en carte — lisible sans zoomer','On mobile: each product appears as a card — readable without zooming')}</li>
          <li>${t('Le badge rouge sur l\'onglet Stock indique le nombre de produits en alerte','The red badge on the Stock tab shows the number of products on alert')}</li>
        </ul>`
      },
      {
        role: 'all',
        icon: '💳',
        title: t('Dettes Clients', 'Customer Debts'),
        desc: `<ul>
          <li>${t('Toutes les ventes partiellement payées sont regroupées par client','All partially paid sales are grouped by client')}</li>
          <li>${t('Touchez un client pour voir le détail de ses achats impayés','Tap a client to see details of their unpaid purchases')}</li>
          <li>${t('<strong>"Payé ✓"</strong> : solde une vente en entier','<strong>"Paid ✓"</strong>: clears a sale in full')}</li>
          <li>${t('<strong>"Partiel"</strong> : encaissez un montant partiel — la dette diminue en temps réel','<strong>"Partial"</strong>: collect a partial amount — the debt decreases in real time')}</li>
          <li>${t('<strong>"Tout marquer payé"</strong> : solde toutes les dettes du client en un clic','<strong>"Mark all paid"</strong>: clears all the client\'s debts in one click')}</li>
        </ul>`
      },
      // ── ADMIN UNIQUEMENT ──
      {
        role: 'admin',
        icon: '📒',
        title: t('Saisie Différée (Cahier)', 'Deferred Entry (Notebook)'),
        desc: `<ul>
          <li>${t('Accès depuis Ventes → bouton <strong>"📒 Saisie Différée"</strong> ou Actions Rapides du Dashboard','Access via Sales → <strong>"📒 Deferred Entry"</strong> button or Dashboard Quick Actions')}</li>
          <li>${t('Enregistrez plusieurs ventes <strong>d\'un jour passé</strong> en une seule session','Record multiple sales <strong>from a past day</strong> in a single session')}</li>
          <li>${t('Idéal quand les ventes sont notées dans un cahier pendant l\'affluence','Ideal when sales are noted in a notebook during busy periods')}</li>
          <li>${t('Choisissez la date, le vendeur, ajoutez autant de lignes que nécessaire','Choose the date, seller, add as many lines as needed')}</li>
          <li>${t('Le rendu monnaie est calculé sur chaque ligne','Change is calculated for each line')}</li>
          <li>${t('Les ventes saisies en différé affichent le badge <strong>"DIFFÉRÉ"</strong> dans l\'historique','Deferred sales display the <strong>"DEFERRED"</strong> badge in history')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '📋',
        title: t('Historique Complet', 'Full History'),
        desc: `<ul>
          <li>${t('Accédez à <strong>toutes les ventes</strong> de l\'application sans limite de date','Access <strong>all sales</strong> in the app with no date limit')}</li>
          <li>${t('Filtrez par : période, vendeur, ou recherche libre (produit, client)','Filter by: period, seller, or free search (product, client)')}</li>
          <li>${t('Périodes disponibles : Aujourd\'hui, 7j, Mois, Année, <strong>Dates personnalisées</strong>','Available periods: Today, 7d, Month, Year, <strong>Custom dates</strong>')}</li>
          <li>${t('Les stats (CA, profit, dettes) se recalculent automatiquement selon les filtres','Stats (revenue, profit, debts) recalculate automatically based on filters')}</li>
          <li>${t('Pagination de 50 ventes par page — exportez en CSV','Pagination of 50 sales per page — export to CSV')}</li>
          <li>${t('Les ventes retournées et annulées sont exclues des totaux','Returned and cancelled sales are excluded from totals')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '📦',
        title: t('Gérer le Stock (Admin)', 'Managing Stock (Admin)'),
        desc: `<ul>
          <li>${t('Ajoutez un produit : Nom, Code, Prix achat, Prix vente, Quantité, TVA, Description','Add a product: Name, Code, Purchase price, Sale price, Quantity, VAT, Description')}</li>
          <li>${t('Si le produit existe déjà (même nom/code) : la quantité est augmentée automatiquement','If the product already exists (same name/code): quantity is increased automatically')}</li>
          <li>${t('Le <strong>Seuil Alerte</strong> détermine quand l\'alerte stock se déclenche','The <strong>Alert Threshold</strong> determines when the stock alert triggers')}</li>
          <li>${t('Bouton ✏️ sur chaque ligne pour modifier n\'importe quel champ sans supprimer','✏️ button on each row to edit any field without deleting')}</li>
          <li>${t('La <strong>Marge%</strong> et le statut (Ok/Alerte) sont calculés automatiquement','<strong>Margin%</strong> and status (Ok/Alert) are calculated automatically')}</li>
          <li>${t('Rapport Approvisionnement : depuis le menu <strong>"Plus" → Approvisionnement</strong>','Restocking Report: via the <strong>"More" → Restocking</strong> menu')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '📦🔴',
        title: t('Rapport Approvisionnement', 'Restocking Report'),
        desc: `<ul>
          <li>${t('Accès : menu <strong>"⋯ Plus" → Approvisionnement</strong> (desktop et mobile)','Access: <strong>"⋯ More" → Restocking</strong> menu (desktop and mobile)')}</li>
          <li>${t('Liste tous les articles <strong>en rupture</strong> ou <strong>sous le seuil d\'alerte</strong>','Lists all items <strong>out of stock</strong> or <strong>below the alert threshold</strong>')}</li>
          <li>${t('Calcule la <strong>vitesse d\'écoulement</strong> de chaque article sur les 7 derniers jours','Calculates the <strong>sell-through rate</strong> of each item over the last 7 days')}</li>
          <li>${t('Recommande la <strong>quantité à commander</strong> : seuil + 2 semaines de ventes','Recommends the <strong>quantity to order</strong>: threshold + 2 weeks of sales')}</li>
          <li>${t('Affiche le <strong>coût estimé</strong> de réapprovisionnement par article et le total','Shows the <strong>estimated cost</strong> of restocking per item and total')}</li>
          <li>${t('Export CSV disponible pour partager avec votre fournisseur','CSV export available to share with your supplier')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '💸',
        title: t('Dépenses', 'Expenses'),
        desc: `<ul>
          <li>${t('Enregistrez toutes vos charges : loyer, transport, salaires, électricité...','Record all your expenses: rent, transport, salaries, electricity...')}</li>
          <li>${t('Catégorisez chaque dépense pour analyser vos charges par type','Categorise each expense to analyse costs by type')}</li>
          <li>${t('Le <strong>Bénéfice Net Réel</strong> sur le Dashboard tient compte de toutes vos dépenses','The <strong>Real Net Profit</strong> on the Dashboard accounts for all your expenses')}</li>
          <li>${t('Statistiques : dépenses du mois, total, évolution vs mois précédent','Statistics: monthly expenses, total, trend vs previous month')}</li>
          <li>${t('Visible dans le résumé EOD et dans les analyses de l\'IA','Visible in the EOD summary and in AI analyses')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🏦',
        title: t('Rapport de Caisse', 'Cash Report'),
        desc: `<ul>
          <li>${t('À la clôture de journée : entrez le <strong>fond d\'ouverture</strong> et le <strong>montant compté</strong>','At end of day: enter the <strong>opening balance</strong> and the <strong>counted amount</strong>')}</li>
          <li>${t('L\'app calcule automatiquement la caisse théorique (fond + encaissements)','The app automatically calculates the theoretical cash (balance + collections)')}</li>
          <li>${t('L\'<strong>écart</strong> est affiché en vert (conforme) ou rouge (manque/excédent)','The <strong>difference</strong> is shown in green (matching) or red (shortage/surplus)')}</li>
          <li>${t('En cas d\'écart : l\'app vous indique les causes probables','In case of discrepancy: the app indicates likely causes')}</li>
          <li>${t('Imprimez le rapport pour vos archives','Print the report for your records')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '💰',
        title: t('Commissions Vendeurs', 'Seller Commissions'),
        desc: `<ul>
          <li>${t('À activer dans <strong>Paramètres → Commissions Vendeurs</strong>','Enable in <strong>Settings → Seller Commissions</strong>')}</li>
          <li>${t('Deux bases de calcul : <strong>% du bénéfice brut</strong> (recommandé) ou % du CA','Two calculation bases: <strong>% of gross profit</strong> (recommended) or % of revenue')}</li>
          <li>${t('Définissez un taux différent pour chaque vendeur','Set a different rate for each seller')}</li>
          <li>${t('La commission est calculée sur le mois en cours automatiquement','Commission is calculated on the current month automatically')}</li>
          <li>${t('Bouton <strong>"Marquer payé"</strong> pour enregistrer le versement','<strong>"Mark paid"</strong> button to record the payment')}</li>
          <li>${t('Si désactivé, les vendeurs ne voient pas les commissions','If disabled, sellers cannot see commissions')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '📊',
        title: t('Résumé Fin de Journée (EOD)', 'End of Day Summary (EOD)'),
        desc: `<ul>
          <li>${t('Apparaît automatiquement à l\'heure configurée (défaut : 20h00)','Appears automatically at the configured time (default: 8:00 PM)')}</li>
          <li>${t('Configurez l\'heure dans <strong>Paramètres → Comportement Caisse</strong>','Configure the time in <strong>Settings → Cashier Behaviour</strong>')}</li>
          <li>${t('Affiche : CA, profit, dépenses, bénéfice net, dettes, retours, top produit, top vendeur','Shows: revenue, profit, expenses, net profit, debts, returns, top product, top seller')}</li>
          <li>${t('Accessible à tout moment depuis <strong>Paramètres → À Propos → Voir résumé du jour</strong>','Accessible at any time from <strong>Settings → About → View day summary</strong>')}</li>
          <li>${t('Imprimez le résumé pour vos archives journalières','Print the summary for your daily records')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '↩️',
        title: t('Retours Clients', 'Customer Returns'),
        desc: `<ul>
          <li>${t('Bouton ↩️ sur une vente → stock restauré automatiquement','↩️ button on a sale → stock restored automatically')}</li>
          <li>${t('La dette liée à la vente retournée est <strong>annulée</strong> automatiquement','The debt linked to the returned sale is <strong>cancelled</strong> automatically')}</li>
          <li>${t('Les points fidélité du client sont déduits proportionnellement','The client\'s loyalty points are deducted proportionally')}</li>
          <li>${t('Historique complet dans l\'onglet <strong>Retours</strong> avec 4 KPIs en haut','Full history in the <strong>Returns</strong> tab with 4 KPIs at the top')}</li>
          <li>${t('Les retours du jour apparaissent dans le résumé EOD','Today\'s returns appear in the EOD summary')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🤖',
        title: t('Assistant IA', 'AI Assistant'),
        desc: `<ul>
          <li>${t('Connexion : <strong>IA → Configuration API</strong> → entrez votre clé Gemini, Groq ou Mistral','Setup: <strong>AI → API Configuration</strong> → enter your Gemini, Groq or Mistral key')}</li>
          <li>${t('Sans clé API : mode local avec réponses basées sur vos données réelles','Without API key: local mode with responses based on your real data')}</li>
          <li>${t('Questions possibles : bilan, stock urgent, top vendeurs, dettes, marges, conseils...','Possible questions: overview, urgent stock, top sellers, debts, margins, advice...')}</li>
          <li>${t('L\'IA connaît vos dépenses, retours et bénéfice net réel','The AI knows your expenses, returns and real net profit')}</li>
          <li>${t('La conversation est multi-tour : l\'IA se souvient du contexte dans la session','Multi-turn conversation: the AI remembers context within the session')}</li>
          <li>${t('Obtenez un <strong>score de santé 0-100</strong> de votre commerce avec l\'analyse avancée','Get a <strong>health score 0-100</strong> for your business with advanced analysis')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '👥',
        title: t("Gestion de l'Équipe", 'Team Management'),
        desc: `<ul>
          <li>${t('Créez des comptes <strong>Vendeur</strong> (accès limité) ou <strong>Admin</strong> (accès total)','Create <strong>Seller</strong> accounts (limited access) or <strong>Admin</strong> (full access)')}</li>
          <li>${t('Chaque compte a un PIN unique à 4 chiffres','Each account has a unique 4-digit PIN')}</li>
          <li>${t('Bouton ✏️ pour modifier le nom ou le PIN d\'un vendeur sans le supprimer','✏️ button to edit a seller\'s name or PIN without deleting them')}</li>
          <li>${t('Les stats de ventes par vendeur sont calculées automatiquement','Sales stats per seller are calculated automatically')}</li>
          <li>${t('Vous ne pouvez pas supprimer votre propre compte ni le dernier Admin','You cannot delete your own account or the last Admin')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🏷️',
        title: t('Catégories', 'Categories'),
        desc: `<ul>
          <li>${t('Organisez vos produits par catégorie pour un stock plus clair','Organize your products by category for a clearer stock view')}</li>
          <li>${t('Créez, renommez ou supprimez des catégories à tout moment','Create, rename or delete categories at any time')}</li>
          <li>${t('Chaque produit peut être classé dans une catégorie lors de sa création','Each product can be classified into a category when created')}</li>
          <li>${t('Filtrez le stock par catégorie pour retrouver un produit plus vite','Filter stock by category to find a product faster')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🚚',
        title: t('Fournisseurs', 'Suppliers'),
        desc: `<ul>
          <li>${t("Enregistrez vos fournisseurs avec leurs coordonnées",'Save your suppliers with their contact details')}</li>
          <li>${t("Suivez l'historique de vos commandes par fournisseur",'Track your order history per supplier')}</li>
          <li>${t('Utile pour savoir rapidement qui contacter en cas de rupture de stock','Useful to quickly know who to contact when stock runs out')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🎁',
        title: t('Programme Fidélité', 'Loyalty Program'),
        desc: `<ul>
          <li>${t("Attribuez des points de fidélité à vos clients réguliers à chaque vente",'Award loyalty points to your regular customers on each sale')}</li>
          <li>${t("Les points s'accumulent par nom de client",'Points accumulate per client name')}</li>
          <li>${t('Utilisez cette fonctionnalité pour fidéliser vos meilleurs clients','Use this feature to retain your best customers')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🎯',
        title: t('Objectifs', 'Objectives'),
        desc: `<ul>
          <li>${t("Fixez-vous un objectif de chiffre d'affaires ou de ventes",'Set yourself a revenue or sales target')}</li>
          <li>${t('Suivez votre progression en temps réel','Track your progress in real time')}</li>
          <li>${t('Un bon moyen de rester motivé et de mesurer la croissance de votre commerce','A good way to stay motivated and measure your business growth')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '📥',
        title: t('Import & Analyse IA', 'AI Import & Analysis'),
        desc: `<ul>
          <li>${t("Importez un fichier Excel ou CSV pour ajouter plusieurs produits d'un coup",'Import an Excel or CSV file to add several products at once')}</li>
          <li>${t("Faites correspondre les colonnes de votre fichier aux champs de l'application",'Match your file\'s columns to the app\'s fields')}</li>
          <li>${t('Gain de temps considérable si vous avez déjà une liste de produits existante','Considerable time saver if you already have an existing product list')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '📈',
        title: t('Analyses & Performance', 'Analytics & Performance'),
        desc: `<ul>
          <li>${t('Filtrez par : Aujourd\'hui, 7 jours, Mois, Année','Filter by: Today, 7 days, Month, Year')}</li>
          <li>${t('<strong>CA</strong> = Chiffre d\'Affaires | <strong>Profit brut</strong> = CA - coûts d\'achat','<strong>Revenue</strong> = Total Sales | <strong>Gross Profit</strong> = Revenue - purchase costs')}</li>
          <li>${t('Les retours clients sont déduits du CA affiché','Customer returns are deducted from the displayed revenue')}</li>
          <li>${t('Graphique d\'évolution, Top Produits, Performance Vendeurs','Trend chart, Top Products, Seller Performance')}</li>
          <li>${t('Export CSV de l\'historique avec filtres appliqués','CSV export of history with applied filters')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '⚙️',
        title: t('Système & Sauvegardes', 'System & Backups'),
        desc: `<ul>
          <li>${t('<strong>Export CSV (Excel)</strong> : journalier, mensuel, annuel, stock, dettes, dépenses, historique','<strong>CSV (Excel) export</strong>: daily, monthly, yearly, stock, debts, expenses, history')}</li>
          <li>${t('<strong>Backup JSON</strong> : sauvegarde complète réimportable à tout moment','<strong>JSON Backup</strong>: full backup re-importable at any time')}</li>
          <li>${t('Auto-backup horaire + backup automatique à la fermeture de l\'app','Hourly auto-backup + automatic backup on app close')}</li>
          <li>${t('Import IA : analysez vos anciens fichiers Excel/CSV avec l\'intelligence artificielle','AI Import: analyse your old Excel/CSV files with artificial intelligence')}</li>
          <li>${t('Réinitialisation totale avec création automatique d\'un backup de sécurité','Full reset with automatic creation of a security backup')}</li>
        </ul>`
      },
      {
        role: 'admin',
        icon: '🎨',
        title: t('Paramètres & Personnalisation', 'Settings & Customisation'),
        desc: `<ul>
          <li>${t('<strong>Nom, Téléphone, Devise</strong> : affichés sur tous vos tickets','<strong>Name, Phone, Currency</strong>: displayed on all your receipts')}</li>
          <li>${t('<strong>8 couleurs d\'accent</strong> | Mode clair/sombre | Taille du texte ajustable','<strong>8 accent colours</strong> | Light/dark mode | Adjustable text size')}</li>
          <li>${t('<strong>Langue</strong> : Français ou English','<strong>Language</strong>: French or English')}</li>
          <li>${t('<strong>Modifier le PIN</strong> : changez votre code de connexion','<strong>Change PIN</strong>: update your login code')}</li>
          <li>${t('<strong>Commissions</strong> : activez et configurez la base de calcul ici','<strong>Commissions</strong>: enable and configure the calculation base here')}</li>
          <li>${t('<strong>Résumé EOD</strong> : configurez l\'heure de l\'alerte fin de journée','<strong>EOD Summary</strong>: configure the end-of-day alert time')}</li>
          <li>${t('Le <strong>Code Maître</strong> (SMP-XXXXXX) est visible dans À Propos — notez-le','The <strong>Master Code</strong> (SMP-XXXXXX) is visible in About — write it down')}</li>
        </ul>`
      },
    ];

    return isAdmin ? all : all.filter(s => s.role === 'all');
  },

  show() {
    const modal   = document.getElementById('guide-modal');
    const content = document.getElementById('guide-content');
    if (!modal || !content) return;

    const isAdmin = Auth.isAdmin();
    const steps   = this._getSteps();
    const t       = (fr, en) => this._t(fr, en);

    // Titre adapté au rôle et à la langue
    const titleEl = modal.querySelector('.guide-title');
    if (titleEl) titleEl.textContent = isAdmin
      ? t('📖 Guide Administrateur — Smart Market Pro v7.7', '📖 Admin Guide — Smart Market Pro v7.7')
      : t('📖 Guide Vendeur — Smart Market Pro v7.7',       '📖 Seller Guide — Smart Market Pro v7.7');

    content.innerHTML = steps.map(s => `
      <div class="guide-step">
        <div class="guide-step-title">${s.icon} ${Utils.esc(s.title)}</div>
        <div class="guide-step-desc">${s.desc}</div>
      </div>`).join('');

    modal.style.display = 'flex';
  },

  hide() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.style.display = 'none';
  }
};/* ═══════════════ DASHBOARD ═══════════════ */
