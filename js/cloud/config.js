'use strict';
/* Configuration Supabase — ces deux valeurs sont PUBLIQUES (clé "publishable").
   Ne jamais mettre ici la clé "secret" ou "service_role". */
const CLOUD_CONFIG = {
  url: 'https://okaqvbsuibpchgbettna.supabase.co',
  key: 'sb_publishable_TRWw9Wk8GGiVVaSX3koAXA_QqASXYLa',
  projectRef: 'okaqvbsuibpchgbettna',
  lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
};

/* ---- Abonnement ---- */
const BILLING = {
  currency: 'F',
  options: [                                   // durées proposées (prix modifiables ici)
    { months: 1,  price: 2500,  label: '1 mois' },
    { months: 3,  price: 7500,  label: '3 mois' },
    { months: 12, price: 25000, label: '12 mois (2 mois offerts)' }
  ],
  /* Numéro WhatsApp qui reçoit les preuves de paiement : format international sans « + » (ex : 22997000000) */
  whatsapp: '2290161156106',
  /* Numéros qui reçoivent les paiements (laisser number vide = méthode masquée) */
  methods: [
    { name: 'MTN MoMo',     number: '0161156106', holder: 'EZE Jean Emmanuel' },
    { name: 'Moov Money',   number: '0195305903', holder: 'EZE Jean Emmanuel' },
    { name: 'Celtiis Cash', number: '0141163941', holder: 'EZE Jean Emmanuel' }
  ]
};

/* ---- Informations légales (affichées dans les Conditions et la Politique de confidentialité) ----
   Un champ laissé vide apparaît en jaune « [à compléter] » dans les pages : remplis-les avant le lancement. */
const LEGAL = {
  publisher: 'EZE Jean Emmanuel',
  status: '',          // ex : « entrepreneur individuel » ou nom de l'entreprise, avec IFU / RCCM si tu en as
  address: '',         // ville et pays, ex : « Cotonou, Bénin »
  email: '',           // email de contact pour les clients
  whatsapp: '+229 01 61 15 61 06',
  region: '',          // lieu des serveurs Supabase, ex : « Europe (Francfort) » — visible dans Supabase > Project Settings
  courts: '',          // tribunaux compétents, ex : « tribunaux de Cotonou »
  apdp: '',            // n° de déclaration auprès de l'APDP (laisser vide tant que non obtenu : la ligne est alors masquée)
  retentionDays: 90,   // jours de conservation des données en ligne après la fin d'un abonnement
  updated: '17 novembre 2026',
  version: '2026-11-17'
};
