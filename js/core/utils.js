'use strict';

/* ═══════════════ UTILS ═══════════════ */
/* ═══════════════ NAV DESKTOP DROPDOWN ═══════════════ */
const Utils = {
  currency(n) {
    if (!Number.isFinite(n)) return '0 ' + (Settings?.getCurrency() || 'F');
    return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + (Settings?.getCurrency() || 'F');
  },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); },
  periodStart(p) {
    const now = new Date();
    if (p==='day')   return new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    if (p==='week')  { const d=new Date(now); d.setDate(d.getDate()-6); d.setHours(0,0,0,0); return d.getTime(); }
    if (p==='month') return new Date(now.getFullYear(),now.getMonth(),1).getTime();
    if (p==='year')  return new Date(now.getFullYear(),0,1).getTime();
    return 0;
  },
  async sha256(text) {
    if (window.crypto?.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
      } catch(_) {}
    }
    return this._sha256js(text);
  },
  _sha256js(str) {
    const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const rotr=(n,x)=>(x>>>n)|(x<<(32-n));
    const bytes=new TextEncoder().encode(str); const bits=bytes.length*8;
    const padLen=(bytes.length%64<56)?56-(bytes.length%64):120-(bytes.length%64);
    const msg=new Uint8Array(bytes.length+padLen+8); msg.set(bytes); msg[bytes.length]=0x80;
    const dv=new DataView(msg.buffer); dv.setUint32(msg.length-4,bits>>>0,false); dv.setUint32(msg.length-8,Math.floor(bits/2**32),false);
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    for(let i=0;i<msg.length;i+=64){
      const w=new Uint32Array(64);
      for(let j=0;j<16;j++) w[j]=dv.getUint32(i+j*4,false);
      for(let j=16;j<64;j++){const s0=rotr(7,w[j-15])^rotr(18,w[j-15])^(w[j-15]>>>3);const s1=rotr(17,w[j-2])^rotr(19,w[j-2])^(w[j-2]>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0;}
      let[a,b,c,d,e,f,g,h]=[h0,h1,h2,h3,h4,h5,h6,h7];
      for(let j=0;j<64;j++){const S1=rotr(6,e)^rotr(11,e)^rotr(25,e);const ch=(e&f)^(~e&g);const t1=(h+S1+ch+K[j]+w[j])>>>0;const S0=rotr(2,a)^rotr(13,a)^rotr(22,a);const maj=(a&b)^(a&c)^(b&c);const t2=(S0+maj)>>>0;[h,g,f,e,d,c,b,a]=[g,f,e,(d+t1)>>>0,c,b,a,(t1+t2)>>>0];}
      h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(n=>n.toString(16).padStart(8,'0')).join('');
  },
  esc(s) {
    if (typeof s !== 'string') return String(s ?? '');
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  },
  num(v) { const n=parseFloat(v); return Number.isFinite(n)?n:NaN; },
  int(v) { const n=parseInt(v,10); return Number.isFinite(n)?n:NaN; }
};

/* ═══════════════ I18N — Français / English ═══════════════ */
/* ═══════════════ SETTINGS ═══════════════ */
