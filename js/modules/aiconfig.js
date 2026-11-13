'use strict';
const AIConfig = {
  KEY: 'SMP_AI_CFG_V76',

  load() {
    try {
      const legacyKeys = ['SMP_AI_CFG_V73', 'SMP_AI_CFG_V72'];
      for (const lk of legacyKeys) {
        const lr = localStorage.getItem(lk);
        if (lr && !localStorage.getItem(this.KEY)) { localStorage.setItem(this.KEY, lr); break; }
      }
      return JSON.parse(localStorage.getItem(this.KEY) || 'null');
    } catch(_) { return null; }
  },

  save() {
    const provider = document.getElementById('ai-provider')?.value || 'local';
    const apiKey   = document.getElementById('ai-api-key')?.value.trim() || '';
    if (provider !== 'local' && !apiKey) return UI.toast(I18n.t('toast_err_api_key_required'),'danger');
    const cfg = { provider, apiKey, savedAt: new Date().toISOString() };
    localStorage.setItem(this.KEY, JSON.stringify(cfg));
    this.updateStatus();
    UI.toast(I18n.t('toast_ai_key_saved'),'success');
  },

  clear() {
    localStorage.removeItem(this.KEY);
    const el = document.getElementById('ai-api-key'); if(el) el.value='';
    const sel = document.getElementById('ai-provider'); if(sel) sel.value='local';
    this.updateStatus();
    UI.toast(I18n.t('toast_ai_key_deleted'),'warning');
  },

  async test() {
    const provider = document.getElementById('ai-provider')?.value || 'local';
    const apiKey   = document.getElementById('ai-api-key')?.value.trim();
    const status   = document.getElementById('ai-key-status');
    if (provider === 'local') { if(status) status.innerHTML='<span style="color:var(--accent)">✅ IA locale — aucune clé requise</span>'; return; }
    if (!apiKey) { if(status) status.innerHTML='<span style="color:var(--danger)">❌ Entrez une clé API</span>'; return; }
    if(status) status.innerHTML='<span class="spinner"></span> Test en cours...';
    try {
      const result = await this.callAPI("Réponds uniquement avec le mot OK, rien d'autre.", provider, apiKey, "", []);
      if(status) status.innerHTML = result
        ? '<span style="color:var(--accent)">✅ Connexion réussie ! IA prête.</span>'
        : '<span style="color:var(--danger)">❌ Réponse invalide</span>';
    } catch(e) {
      if(status) status.innerHTML='<span style="color:var(--danger)">❌ Erreur: '+Utils.esc(e.message)+'</span>';
    }
  },

  async callAPI(prompt, provider, apiKey, systemPrompt='', history=[]) {
    const cfg = this.load();
    const p   = provider || cfg?.provider || 'local';
    const k   = apiKey   || cfg?.apiKey   || '';
    if (p === 'local' || !k) return null;

    const MODELS = {
      gemini:  'gemini-2.0-flash-exp',
      groq:    'llama-3.3-70b-versatile',
      mistral: 'mistral-small-latest',
    };

    const ENDPOINTS = {
      gemini:  `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${k}`,
      groq:    'https://api.groq.com/openai/v1/chat/completions',
      mistral: 'https://api.mistral.ai/v1/chat/completions',
    };

    const url = ENDPOINTS[p];
    if (!url) throw new Error('Fournisseur IA non reconnu : ' + p);

    let body;
    const headers = { 'Content-Type': 'application/json' };

    if (p === 'gemini') {
      // Gemini v1beta : system_instruction séparé + multi-turn contents
      const contents = [];
      // Ajouter l'historique (max 10 derniers échanges)
      const hist = history.slice(-10);
      for (const h of hist) {
        contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] });
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      body = {
        ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: 2000, temperature: 0.7, topP: 0.9 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
      };
    } else {
      headers['Authorization'] = `Bearer ${k}`;
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      // Historique (max 10 derniers échanges)
      const hist = history.slice(-10);
      for (const h of hist) messages.push({ role: h.role, content: h.content });
      messages.push({ role: 'user', content: prompt });

      body = {
        model:       MODELS[p],
        messages,
        max_tokens:  2000,
        temperature: 0.7,
      };
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!res.ok) {
      let errMsg = `Erreur HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData.error?.message) errMsg = errData.error.message;
        else if (errData.message)   errMsg = errData.message;
      } catch(_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    if (p === 'gemini') {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text && data.promptFeedback?.blockReason) {
        throw new Error('Réponse bloquée par Gemini : ' + data.promptFeedback.blockReason);
      }
      return text || null;
    }
    return data.choices?.[0]?.message?.content || null;
  },

  updateStatus() {
    const cfg = this.load();
    const sel = document.getElementById('ai-provider');
    const inp = document.getElementById('ai-api-key');
    const status = document.getElementById('ai-key-status');
    if (cfg && cfg.provider !== 'local') {
      if(sel) sel.value = cfg.provider;
      if(inp) inp.value = cfg.apiKey ? '••••••••' : '';
      if(status) status.innerHTML = `<span style="color:var(--accent)">✅ ${cfg.provider} configuré</span>`;
    } else {
      if(status) status.innerHTML='<span style="color:var(--text3)">IA locale active</span>';
    }
  }
};

/* ═══════════════ DEFERRED SALES (Saisie Différée) ═══════════════ */
