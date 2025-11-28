// script.js — robust parser, improved fuzzy (token + Levenshtein), quantity detection,
// dimension parsing, aggregation, and crew/vehicle recommendation.

// ---- Config ----
const BOX_SIZES = { small: 3, medium: 4, large: 6, wardrobe: 12 };
const FALLBACK_MISC = 5; // cu ft for unknown small item
const MAX_LEV_THRESHOLD = 0.35; // fraction of key length allowed for Levenshtein

// ---- Helpers ----
function safeString(s){ return (s||'').toString(); }
function normalise(s){
  return safeString(s).toLowerCase()
    .replace(/["“”]/g,'')
    .replace(/[\u2012\u2013\u2014]/g,'-')
    .replace(/[^\w\s\-x×\/"]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function avgRange(text){
  const m = text.match(/(\d+(?:\.\d+)?)\s*[-\/]\s*(\d+(?:\.\d+)?)/);
  if(!m) return null;
  return Math.round((parseFloat(m[1]) + parseFloat(m[2]))/2);
}
function extractQty(text){
  if(!text) return 1;
  const t = text.toLowerCase();
  // range like 50/60
  const ar = avgRange(t);
  if(ar) return ar;
  // explicit patterns: "2x", "2 x", "2 "
  let m = t.match(/\b(\d{1,5})\s*(?:x|pcs|pieces)?\b/);
  if(m) return parseInt(m[1],10);
  // trailing x: "guitar x3" or "x3"
  m = t.match(/x\s*(\d{1,4})$/i) || t.match(/x(\d{1,4})/i);
  if(m) return parseInt(m[1],10);
  // words
  const words = { a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, couple:2, few:3 };
  for(const w in words) if(new RegExp('\\b'+w+'\\b').test(t)) return words[w];
  return 1;
}

// Levenshtein
function lev(a,b){
  a = (a||'').toLowerCase(); b = (b||'').toLowerCase();
  if(!a) return b.length; if(!b) return a.length;
  const m = Array.from({length:b.length+1}, ()=>Array(a.length+1).fill(0));
  for(let i=0;i<=b.length;i++) m[i][0]=i;
  for(let j=0;j<=a.length;j++) m[0][j]=j;
  for(let i=1;i<=b.length;i++){
    for(let j=1;j<=a.length;j++){
      m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1]+(b[i-1]===a[j-1]?0:1));
    }
  }
  return m[b.length][a.length];
}

// fuzzy match: token overlap + Levenshtein fallback
function fuzzyFindKey(query){
  if(!window.volumeDict) return null;
  query = normalise(query);
  if(!query) return null;
  const qTokens = query.split(/\s+/).filter(Boolean);
  let best = null, bestScore = -1, bestLev = Infinity;
  for(const key of Object.keys(window.volumeDict)){
    const kn = normalise(key);
    const kTokens = kn.split(/\s+/).filter(Boolean);
    // token overlap score
    let overlap = 0;
    qTokens.forEach(t=> { if(kTokens.includes(t)) overlap++; });
    // substring bonus
    if(kn.includes(query) || query.includes(kn)) overlap += 1;
    // prefer more token overlap
    if(overlap > bestScore){
      bestScore = overlap; best = key; bestLev = lev(query, kn);
    } else if(overlap === bestScore){
      // tie-breaker: Levenshtein lower is better
      const l = lev(query, kn);
      if(l < bestLev){ best = key; bestLev = l; bestLev = l; }
    }
  }
  // apply a litmus: require some overlap OR reasonable Levenshtein
  if(bestScore > 0) return best;
  // allow pure Levenshtein if near
  const levCandidates = Object.keys(window.volumeDict).map(k=>({k, d:lev(query, normalise(k))}));
  levCandidates.sort((a,b)=>a.d-b.d);
  const top = levCandidates[0];
  if(top){
    const allowed = Math.max(1, Math.floor(normalise(top.k).length * MAX_LEV_THRESHOLD));
    if(top.d <= allowed) return top.k;
  }
  return null;
}

// parse dimension strings e.g. 160x60x50 cm or 48x24x72 in or 4x2x2 ft
function parseDimensions(text){
  if(!text) return null;
  // try cm explicitly
  let m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)[\s]*(cm)\b/i);
  if(m){ const a=parseFloat(m[1])/30.48, b=parseFloat(m[2])/30.48, c=parseFloat(m[3])/30.48; return a*b*c; }
  // inches
  m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)[\s]*(in|inch|inches)\b/i);
  if(m){ const a=parseFloat(m[1])/12, b=parseFloat(m[2])/12, c=parseFloat(m[3])/12; return a*b*c; }
  // feet
  m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)[\s]*(ft)\b/i);
  if(m){ const a=parseFloat(m[1]), b=parseFloat(m[2]), c=parseFloat(m[3]); return a*b*c; }
  // loose pattern with unit after
  m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)[^\d\n]*(cm|in|ft)?/i);
  if(m && m[4]){
    const unit = m[4].toLowerCase(), a=parseFloat(m[1]), b=parseFloat(m[2]), c=parseFloat(m[3]);
    if(unit==='cm') return (a/30.48)*(b/30.48)*(c/30.48);
    if(unit==='in'||unit==='inch'||unit==='inches') return (a/12)*(b/12)*(c/12);
    if(unit==='ft') return a*b*c;
  }
  return null;
}

// split input into entries safely (commas/newlines; collapse empty tokens)
function splitInput(text){
  if(!text) return [];
  // replace multiple commas with single, then split on commas or newlines
  const cleaned = text.replace(/,+/g,',');
  return cleaned.split(/\s*,\s*|\n+/).map(s=>s.trim()).filter(Boolean);
}

// parse a single entry to one or more items
function parseEntry(entry){
  const out = [];
  if(!entry) return out;
  // expand "and" / "&" compounds carefully
  const compounds = entry.split(/\s+and\s+|\s*&\s+/i).map(s=>s.trim()).filter(Boolean);
  for(const part of compounds){
    const qty = extractQty(part);
    const dim = parseDimensions(part);
    const cleaned = normalise(part).replace(/\b\d+\b/g,'').replace(/\bx\d+\b/,'').trim();
    // special: if boxes/bag keywords present
    if(/\b(box|boxes|bag|bags|sack|sacks)\b/.test(cleaned)){
      // determine box size word if present
      let volPer = BOX_SIZES.medium || 4; // default medium
      if(/\bsmall box\b|\bsmall\b/.test(cleaned)) volPer = BOX_SIZES.small;
      else if(/\blarge box\b|\blarge\b/.test(cleaned)) volPer = BOX_SIZES.large;
      else if(/\bwardrobe box\b|\bwardrobe\b/.test(cleaned)) volPer = BOX_SIZES.wardrobe;
      else {
        // attempt to detect explicit words
        if(window.volumeDict && (window.volumeDict['box small'] || window.volumeDict['small box'])) volPer = window.volumeDict['small box'] || window.volumeDict['box small'];
      }
      out.push({ name: 'box', qty: qty, vol_each: volPer, vol_total: qty * volPer, reason:'box' });
      continue;
    }
    // dimensions override
    if(dim && dim>0){
      const volPer = Math.max(1, Math.round(dim));
      out.push({ name: cleaned || part, qty: qty, vol_each: volPer, vol_total: volPer * qty, reason:'dimension' });
      continue;
    }
    // try fuzzy find
    const fk = fuzzyFindKey(cleaned);
    if(fk){
      const volEach = window.volumeDict[fk];
      out.push({ name: fk, qty: qty, vol_each: volEach, vol_total: volEach * qty, reason:'dict' });
      continue;
    }
    // fallback: try token-level matching for common nouns
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    let best = null, bestVol=0;
    for(const t of tokens){
      const fk2 = fuzzyFindKey(t);
      if(fk2 && window.volumeDict[fk2] > bestVol){
        best = fk2; bestVol = window.volumeDict[fk2];
      }
    }
    if(best){
      out.push({ name: best, qty: qty, vol_each: bestVol, vol_total: bestVol * qty, reason:'token-fallback' });
      continue;
    }
    // ultimate fallback: small misc
    out.push({ name: cleaned || part, qty: qty, vol_each: FALLBACK_MISC, vol_total: FALLBACK_MISC * qty, reason:'unknown' });
  }
  return out;
}

// aggregate items by name
function aggregate(items){
  const map = Object.create(null);
  items.forEach(it=>{
    const k = it.name;
    if(!map[k]) map[k] = { name:k, qty:0, vol_each: it.vol_each||0, vol_total:0, reasons:[] };
    map[k].qty += it.qty;
    map[k].vol_total += it.vol_total;
    if(it.reason) map[k].reasons.push(it.reason);
  });
  return Object.values(map).sort((a,b)=>b.vol_total - a.vol_total);
}

// main processing
function processInput(text){
  const parts = splitInput(text);
  const all = [];
  for(const p of parts){
    const parsed = parseEntry(p);
    parsed.forEach(x => all.push(x));
  }
  const total = Math.round(all.reduce((s,i)=>s + (i.vol_total||0), 0));
  const agg = aggregate(all);
  return { total, items: agg, rawItems: all };
}

// vehicle & crew (your earlier rules)
function recommend(total){
  if(total <= 200) return { vehicle:'Transit Van', men:2 };
  if(total <= 500) return { vehicle:'Luton Van', men:2 };
  if(total <= 750) return { vehicle:'Large Luton Van', men:3 };
  if(total <= 1000) return { vehicle:'2× Luton Vans', men:3 };
  if(total <= 1400) return { vehicle:'2× Large Luton Vans', men:4 };
  return { vehicle:'Mixed Fleet', men:4 };
}

// run and output
function runFullCalc(){
  try{
    const ta = document.getElementById('items');
    const outEl = document.getElementById('output');
    if(!ta || !outEl) {
      console.error('Missing #items or #output element.');
      return;
    }
    const raw = ta.value || '';
    const res = processInput(raw);
    const rec = recommend(res.total);

    let out = `Total estimated volume: ${res.total} cu ft\nRecommended crew: ${rec.men} men\nVehicle: ${rec.vehicle}\n\nBreakdown:\n`;
    res.items.forEach(it=>{
      out += `- ${it.name} — qty ${it.qty} — ${Math.round(it.vol_total)} cu ft (${Math.round(it.vol_each)} each)\n`;
    });
    out += `\nNotes: estimated volumes (UK industry averages).`;
    outEl.innerText = out;
  }catch(err){
    console.error('Calculation error', err);
    const outEl = document.getElementById('output');
    if(outEl) outEl.innerText = 'Error during calculation — see console.';
  }
}

// wire up safely
document.addEventListener('DOMContentLoaded', ()=>{
  window.runFullCalc = runFullCalc;
  const btn = document.getElementById('btnCalc');
  if(btn) btn.addEventListener('click', runFullCalc);
  const ta = document.getElementById('items');
  if(ta) ta.addEventListener('keydown', e=>{ if(e.ctrlKey && (e.key==='Enter' || e.key==='Return')){ e.preventDefault(); runFullCalc(); }});
});
