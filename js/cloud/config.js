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
