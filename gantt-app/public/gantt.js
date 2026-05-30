/* ══════════════════════════════════════════════════════
   Planning Collaboratif — Gantt Engine
══════════════════════════════════════════════════════ */

/* ── État global ── */
var W = 14, WMIN = 6, WMAX = 36;
var ANNEE = new Date().getFullYear();
var jours = [];
var todayStr = '', todayIdx = -1;
var pseudo    = '';
var projectId = 'default';
var saveTimer = null;

var dragPid = null, dragMode = null, dragX0 = 0, dragIdxD0 = 0, dragIdxF0 = 0;
var colResizing = null, colResX0 = 0, colResW0 = 0;
var sortCol = null, sortDir = 1;
var collapsed = {};
var filtres = {};

var PALETTES = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
                '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16',
                '#e11d48','#0ea5e9','#d946ef','#78716c','#64748b'];

var ETAT_META = {
  'À venir'   : { cls: 'etat-aVenir',  color: '#64748b' },
  'En cours'  : { cls: 'etat-enCours', color: '#2563eb' },
  'Terminé'   : { cls: 'etat-termine', color: '#16a34a' },
  'En attente': { cls: 'etat-attente', color: '#f59e0b' },
  'Annulé'    : { cls: 'etat-annule',  color: '#dc2626' },
};
var ETATS = Object.keys(ETAT_META);

var techniciens = [
  { nom: 'Aseptic',          couleur: '#ec4899' },
  { nom: 'Mise en service',  couleur: '#10b981' },
  { nom: 'Prélèvement',      couleur: '#0ea5e9' },
  { nom: 'Livraison osmoseur', couleur: '#8b5cf6' },
  { nom: 'Résultat',         couleur: '#ef4444' },
];

var colonnes = [
  { key: 'client', label: 'Association', width: 110 },
  { key: 'nom',    label: 'Opération',   width: 360 },
  { key: 'debut',  label: 'Début',       width: 92  },
  { key: 'fin',    label: 'Fin',         width: 92  },
  { key: 'tech',   label: 'Attribution', width: 130 },
  { key: 'etat',   label: 'État',        width: 90  },
];

var projets = [];

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
var ganttApp = {
  init(data, userPseudo, pid) {
    pseudo    = userPseudo;
    projectId = pid || 'default';
    filtres   = {};
    sortCol   = null;
    collapsed = {};

    if (data.techniciens) techniciens = data.techniciens;
    if (data.colonnes)    colonnes    = data.colonnes;
    if (data.ANNEE)       ANNEE       = data.ANNEE;
    if (data.W)           W           = data.W;
    if (data.collapsed)   collapsed   = data.collapsed;

    projets = (data.tasks || []).map(normalizeTask);

    initAnneeSelect();
    initJours();
    renderAll();
    if (!ganttApp._bound) { bindEvents(); ganttApp._bound = true; }
  },

  applyFullUpdate(data) {
    if (data.tasks)       projets     = data.tasks.map(normalizeTask);
    if (data.techniciens) techniciens = data.techniciens;
    if (data.colonnes)    colonnes    = data.colonnes;
    renderAll();
  }
};

function normalizeTask(t) {
  if (!t.etat)      t.etat      = 'À venir';
  if (!t.soustaches) t.soustaches = [];
  if (!t.client)    t.client    = '';
  if (!t.tech)      t.tech      = techniciens[0]?.nom || '';
  if (!t.nom && t.name) { t.nom = t.name; delete t.name; }
  /* Ancien format → nouveau */
  if (!t.debut && t.start) {
    t.debut = t.start;
    const d = new Date(t.start);
    d.setDate(d.getDate() + (t.duration || 1) - 1);
    t.fin = d.toISOString().slice(0, 10);
    delete t.start; delete t.duration;
  }
  if (!t.debut) t.debut = new Date().toISOString().slice(0, 10);
  if (!t.fin)   t.fin   = t.debut;
  return t;
}

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const isMobile = () => window.innerWidth <= 768;
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const getTechColor = n => techniciens.find(t => t.nom === n)?.couleur ?? '#64748b';
const getColor     = p => p.couleur || getTechColor(p.tech);
const etatColor    = e => ETAT_META[e]?.color ?? '#64748b';

function idxDate(d)    { return jours.findIndex(j => j.clef === d); }
function dateFromIdx(i){ i = Math.max(0, Math.min(jours.length - 1, i)); return jours[i].clef; }
function frozenW()     { return colonnes.reduce((s, c) => s + c.width, 0); }

function getById(id) {
  for (const p of projets) {
    if (p.id === id) return p;
    const s = p.soustaches?.find(s => s.id === id);
    if (s) return s;
  }
  return null;
}

function valeursUniques(key) {
  const v = new Set();
  for (const p of projets) {
    v.add(String(p[key] ?? ''));
    p.soustaches?.forEach(s => v.add(String(s[key] ?? '')));
  }
  return [...v].sort();
}

function matchFiltres(item) {
  for (const k in filtres) {
    if (!filtres[k]) continue;
    if (!filtres[k].includes(String(item[k] ?? ''))) return false;
  }
  return true;
}

function projFiltresTries() {
  let res = projets.filter(p => matchFiltres(p) || p.soustaches?.some(s => matchFiltres(s)));
  if (sortCol) res.sort((a, b) => {
    const va = String(a[sortCol] ?? '').toLowerCase();
    const vb = String(b[sortCol] ?? '').toLowerCase();
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });
  return res;
}

function calcLefts() {
  let acc = 0, lefts = [];
  for (const c of colonnes) { lefts.push(acc); acc += c.width; }
  return lefts;
}

function hexRgba(h, a) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ══════════════════════════════════════════════════════
   CALENDRIER
══════════════════════════════════════════════════════ */
function initJours() {
  jours = [];
  const bissex = y => (y%4===0&&y%100!==0)||(y%400===0);
  const mNoms  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const nbJ    = [31, bissex(ANNEE)?29:28, 31,30,31,30,31,31,30,31,30,31];

  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= nbJ[m]; d++) {
      const ms = String(m+1).padStart(2,'0'), ds = String(d).padStart(2,'0');
      const clef = `${ANNEE}-${ms}-${ds}`;
      const dt   = new Date(ANNEE, m, d), dw = dt.getDay();
      const tmp  = new Date(ANNEE, m, d);
      tmp.setDate(tmp.getDate() + 4 - (tmp.getDay()||7));
      const jan1 = new Date(tmp.getFullYear(), 0, 1);
      const sem  = Math.ceil((((tmp - jan1)/86400000)+1)/7);
      jours.push({ clef, num: d, mois: mNoms[m], moisIdx: m, wk: dw===0||dw===6, sem, dw });
    }
  }
  todayStr = new Date().toISOString().slice(0,10);
  todayIdx = idxDate(todayStr);
}

window.changerAnnee = y => { ANNEE = +y; initJours(); renderAll(); scheduleSave(); };
window.setZoom = d => { W = Math.max(WMIN, Math.min(WMAX, W+d)); document.getElementById('zoomLbl').textContent = W+'px'; renderAll(); };

function initAnneeSelect() {
  const sel = document.getElementById('anneeSelect');
  sel.innerHTML = '';
  for (let y = 2024; y <= 2032; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === ANNEE) o.selected = true;
    sel.appendChild(o);
  }
}

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function renderAll() {
  if (isMobile()) { renderMobile(); return; }
  renderGantt();
}

/* ─ Gantt table ─────────────────────────────────────── */
function renderGantt() {
  const total   = jours.length;
  const DWLET   = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
  const ordered = projFiltresTries();
  const lefts   = calcLefts();

  /* Groupes mois */
  let mG = [], curM = '', cnt = 0;
  for (const j of jours) { if (j.mois !== curM) { if (cnt) mG.push({nom:curM,count:cnt}); curM=j.mois; cnt=1; } else cnt++; }
  if (cnt) mG.push({nom:curM,count:cnt});

  /* Groupes semaines */
  let sG = [], curS = -1; cnt = 0;
  for (const j of jours) { if (j.sem !== curS) { if (cnt) sG.push({sem:curS,count:cnt}); curS=j.sem; cnt=1; } else cnt++; }
  if (cnt) sG.push({sem:curS,count:cnt});

  let h = `<table style="border-collapse:collapse;table-layout:fixed"><colgroup>`;
  for (const c of colonnes)  h += `<col style="width:${c.width}px;min-width:${c.width}px;max-width:${c.width}px">`;
  for (let i = 0; i < total; i++) h += `<col style="width:${W}px;min-width:${W}px">`;
  h += `</colgroup><thead>`;

  /* Ligne mois */
  h += `<tr style="height:20px">`;
  for (let ci = 0; ci < colonnes.length; ci++) {
    const c = colonnes[ci];
    const arrow = sortCol===c.key ? (sortDir===1?' ▲':' ▼') : '';
    h += `<td rowspan="3" class="th-col sortable"
      style="position:sticky;top:0;left:${lefts[ci]}px;z-index:40;width:${c.width}px"
      onclick="doSort('${c.key}')">
      ${esc(c.label)}<span style="font-size:7px;margin-left:2px;opacity:${sortCol===c.key?1:.25}">${arrow}</span>
      <div style="position:absolute;right:0;top:0;bottom:0;width:5px;cursor:col-resize;z-index:5" onmousedown="startColResize(event,${ci})"></div>
    </td>`;
  }
  for (const mg of mG)
    h += `<td colspan="${mg.count}" class="th-month">${mg.nom.toUpperCase()}</td>`;
  h += `</tr>`;

  /* Ligne semaines */
  h += `<tr style="height:14px">`;
  for (const sg of sG)
    h += `<td colspan="${sg.count}" class="th-week">${sg.count*W>=14 ? 'S'+sg.sem : ''}</td>`;
  h += `</tr>`;

  /* Ligne jours */
  h += `<tr style="height:22px">`;
  for (const j of jours) {
    const cls = j.clef===todayStr ? 'today' : j.wk ? 'weekend' : '';
    h += `<td class="th-day ${cls}">
      ${W>=10 ? `<div style="font-size:7px">${DWLET[j.dw]}</div>` : ''}
      <div style="font-weight:700">${j.num}</div>
    </td>`;
  }
  h += `</tr>`;

  /* Ligne filtres */
  h += `<tr class="frow">`;
  for (let ci = 0; ci < colonnes.length; ci++) {
    const c = colonnes[ci], vals = valeursUniques(c.key);
    const active = filtres[c.key] && filtres[c.key].length < vals.length;
    h += `<td style="position:sticky;top:56px;left:${lefts[ci]}px;z-index:40;width:${c.width}px;min-width:${c.width}px;max-width:${c.width}px;padding:2px;background:var(--gray-100);border:1px solid var(--gray-200)">
      <button data-fbtn class="frow-btn ${active?'active':''}" onclick="ouvrirFiltre('${c.key}',this)">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left">${esc(c.label)}</span>
        <span>${active ? `<b>${filtres[c.key].length}/${vals.length}</b>` : '&#9663;'}</span>
      </button>
    </td>`;
  }
  h += `<td colspan="${total}" style="position:sticky;top:56px;z-index:20;background:var(--gray-100);border:1px solid var(--gray-200);font-size:9px;color:var(--gray-500);padding:0 8px;vertical-align:middle">
    ${Object.values(filtres).some(Boolean) ? '🔍 Filtres actifs' : 'Cliquez sur une colonne pour filtrer'}
  </td></tr>`;

  h += `</thead><tbody>`;
  for (const p of ordered) {
    h += buildRow(p, total, false, null, lefts);
    if (p.soustaches?.length && !collapsed[p.id])
      for (const s of p.soustaches) if (matchFiltres(s)) h += buildRow(s, total, true, p.id, lefts);
  }
  h += `</tbody></table>`;

  document.getElementById('gantt-inner').innerHTML = h;
  document.getElementById('zoomLbl').textContent = W + 'px';
  attachDrag();
}

/* ─ Build one row ────────────────────────────────────── */
function buildRow(p, total, isSub, parentId, lefts) {
  const idxD = idxDate(p.debut), idxF = idxDate(p.fin);
  const yearStart = ANNEE+'-01-01', yearEnd = ANNEE+'-12-31';
  const showBar = !(p.fin < yearStart || p.debut > yearEnd);
  let bD = idxD < 0 ? 0 : idxD, bF = idxF;
  if (showBar) { if (bD < 0) bD = 0; if (bF < 0 || bF >= jours.length) bF = jours.length-1; if (bF < bD) bF = bD; }
  const barLeft = bD * W, barW = (bF - bD + 1) * W;
  const col = getColor(p), colL = hexRgba(col, .12);
  const parts = p.debut.split('-'), lblDate = parts[2]+'/'+parts[1];
  const rowH  = isSub ? 34 : 42, barH = isSub ? 19 : 24, barTop = isSub ? 7 : 9;
  const rowBg = isSub ? '#f0f9ff' : 'white';
  const bL    = isSub ? 'border-left:3px solid #38bdf8;' : '';
  const techOpts = techniciens.map(t => `<option value="${esc(t.nom)}" ${p.tech===t.nom?'selected':''}>${esc(t.nom)}</option>`).join('');
  const etatOpts = ETATS.map(v => `<option value="${v}" ${p.etat===v?'selected':''}>${v}</option>`).join('');
  const ec = etatColor(p.etat);

  let h = `<tr data-rowid="${p.id}">`;

  for (let ci = 0; ci < colonnes.length; ci++) {
    const c = colonnes[ci], ck = c.key;
    h += `<td class="cell ${isSub?'cell-sub':''}"
      style="position:sticky;left:${lefts[ci]}px;z-index:10;background:${rowBg};${bL}width:${c.width}px;min-width:${c.width}px;max-width:${c.width}px">`;

    if (ck === 'nom') {
      h += `<div style="display:flex;align-items:center;gap:2px;height:100%">
        <span style="cursor:grab;color:#cbd5e1;font-size:13px;flex-shrink:0;user-select:none;padding:0 1px"
          onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#cbd5e1'">⠿</span>`;
      if (!isSub) {
        const hasSub = p.soustaches?.length > 0;
        h += hasSub
          ? `<button onclick="toggleCollapse('${p.id}')" style="width:14px;height:14px;padding:0;font-size:8px;flex-shrink:0;border:1px solid var(--gray-300);border-radius:3px;background:white;cursor:pointer">${collapsed[p.id]?'▶':'▼'}</button>`
          : `<span style="width:14px;flex-shrink:0"></span>`;
        h += `<input type="text" value="${esc(p.nom)}" style="flex:1;min-width:0" onchange="upd('${p.id}','nom',this.value)">`;
        h += `<div class="row-actions">
          <button class="row-btn row-btn-add" onclick="ajouterSoustache('${p.id}')" title="Sous-tâche">+</button>
          <button class="row-btn row-btn-dup" onclick="dupliquer('${p.id}')" title="Dupliquer">⧉</button>
          <button class="row-btn row-btn-del" onclick="supprimer('${p.id}')" title="Supprimer">✕</button>
        </div>`;
      } else {
        h += `<span style="color:#38bdf8;font-size:11px;flex-shrink:0;margin-right:1px">↳</span>`;
        h += `<input type="text" value="${esc(p.nom)}" style="flex:1;min-width:0" onchange="upd('${p.id}','nom',this.value)">`;
        h += `<button class="row-btn row-btn-del" onclick="supprimerSoustache('${parentId}','${p.id}')" title="Supprimer" style="opacity:0">✕</button>`;
      }
      h += `</div>`;
    }
    else if (ck === 'client') h += `<input type="text"  value="${esc(p.client)}" onchange="upd('${p.id}','client',this.value)">`;
    else if (ck === 'debut')  h += `<input type="date"  value="${p.debut}"       onchange="upd('${p.id}','debut',this.value)">`;
    else if (ck === 'fin')    h += `<input type="date"  value="${p.fin}"         onchange="upd('${p.id}','fin',this.value)">`;
    else if (ck === 'tech')   h += `<select onchange="upd('${p.id}','tech',this.value)" style="background:${colL};color:${col};font-weight:600">${techOpts}</select>`;
    else if (ck === 'etat')   h += `<select class="${ETAT_META[p.etat]?.cls??''}" onchange="upd('${p.id}','etat',this.value)">${etatOpts}</select>`;
    h += `</td>`;
  }

  /* Cellule Gantt */
  h += `<td colspan="${total}" class="bar-cell ${isSub?'bar-cell-sub':''}" style="height:${rowH}px;overflow:hidden">`;
  /* fond weekends + today */
  for (let g = 0; g < total; g++) {
    if (jours[g].wk) h += `<div style="position:absolute;top:0;bottom:0;left:${g*W}px;width:${W}px;background:#eef2ff;pointer-events:none"></div>`;
  }
  if (todayIdx >= 0 && todayIdx < total)
    h += `<div style="position:absolute;top:0;bottom:0;left:${todayIdx*W}px;width:${W}px;background:rgba(254,240,138,.5);border-left:1.5px solid #fbbf24;border-right:1.5px solid #fbbf24;pointer-events:none;z-index:1"></div>`;

  if (showBar) {
    /* Date avant la barre */
    if (barLeft > 4)
      h += `<div style="position:absolute;top:50%;transform:translateY(-50%);right:calc(100% - ${barLeft}px + 3px);font-size:9px;font-weight:600;color:var(--gray-500);white-space:nowrap;pointer-events:none;z-index:4">${lblDate}</div>`;

    h += `<div id="bw_${p.id}" style="position:absolute;top:${barTop}px;left:${barLeft}px;height:${barH}px;display:flex;align-items:center;pointer-events:none;z-index:5">
      <div id="bc_${p.id}" data-pid="${p.id}" data-mode="move"
        style="height:100%;width:${barW}px;border-radius:5px;cursor:grab;pointer-events:auto;position:relative;flex-shrink:0;background:${col};${isSub?'opacity:.85;border-radius:3px;':''};box-shadow:0 2px 6px ${hexRgba(col,.35)}">
        <div class="bar-shine"></div>
        <div id="rz_${p.id}" data-pid="${p.id}" data-mode="resize" class="resize-handle"></div>
      </div>
      <span class="bar-label">${esc(p.nom)}</span>
    </div>`;
  } else {
    h += `<div id="bw_${p.id}" style="display:none"></div><div id="bc_${p.id}" data-pid="${p.id}" data-mode="move" style="display:none"></div>`;
  }
  h += `</td></tr>`;
  return h;
}

/* ─ Mobile — vue Gantt mois sélectionnables, lecture seule ─── */
var _moisSelectionnes = null; // null = trimestre courant par défaut

function _initMoisDefaut() {
  if (_moisSelectionnes) return;
  const t = Math.floor(new Date().getMonth() / 3) * 3;
  _moisSelectionnes = [t, t+1, t+2];
}

window._toggleMoisMobile = idx => {
  _initMoisDefaut();
  const i = _moisSelectionnes.indexOf(idx);
  if (i >= 0) {
    if (_moisSelectionnes.length === 1) return; // garder au moins 1
    _moisSelectionnes.splice(i, 1);
  } else {
    _moisSelectionnes.push(idx);
    _moisSelectionnes.sort((a,b) => a-b);
  }
  renderMobile();
};

function renderMobile() {
  _initMoisDefaut();
  const MNOMS3 = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  /* Jours des mois sélectionnés (dans l'ordre) */
  const moisTriés = [..._moisSelectionnes].sort((a,b) => a-b);

  const joursM = jours.filter(j => moisTriés.includes(j.moisIdx));
  if (!joursM.length) {
    document.getElementById('mobile-view').innerHTML = '<div style="padding:30px;text-align:center">Aucun jour</div>';
    return;
  }
  const total  = joursM.length;
  const idxDeb = idxDate(joursM[0].clef);

  const COL_W  = 130;
  const WM     = 6;
  const tableW = COL_W + total * WM;

  /* Groupes mois pour l'en-tête */
  let mG = [], curM = -1, cnt = 0;
  for (const j of joursM) {
    if (j.moisIdx !== curM) { if (cnt) mG.push({ nom: MNOMS3[curM], count: cnt }); curM = j.moisIdx; cnt = 1; }
    else cnt++;
  }
  if (cnt) mG.push({ nom: MNOMS3[curM], count: cnt });

  const ordered = projFiltresTries();
  const rowH = 32, barH = 18, barTop = 7;

  /* Sélecteur de mois */
  let h = `<div style="background:#0f1b3d;flex-shrink:0;padding:8px 10px 6px">
    <div style="font-size:.65rem;color:rgba(255,255,255,.45);font-weight:700;letter-spacing:.08em;margin-bottom:5px;text-transform:uppercase">Mois affichés — ${ANNEE}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">`;
  for (let m = 0; m < 12; m++) {
    const sel = _moisSelectionnes.includes(m);
    h += `<button onclick="_toggleMoisMobile(${m})"
      style="border:none;border-radius:5px;padding:4px 7px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .1s;
             background:${sel ? 'var(--blue)' : 'rgba(255,255,255,.1)'};
             color:${sel ? 'white' : 'rgba(255,255,255,.5)'}">
      ${MNOMS3[m]}
    </button>`;
  }
  h += `</div>
    <div style="font-size:.63rem;color:rgba(255,255,255,.3);margin-top:5px">Appuyer sur une ligne pour voir les détails</div>
  </div>`;

  /* Tableau scrollable horizontalement */
  h += `<div style="overflow-x:auto;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1">
  <table style="border-collapse:collapse;table-layout:fixed;width:${tableW}px"><colgroup>
    <col style="width:${COL_W}px;min-width:${COL_W}px;max-width:${COL_W}px">`;
  for (let i = 0; i < total; i++) h += `<col style="width:${WM}px;min-width:${WM}px">`;
  h += `</colgroup><thead>`;

  /* Ligne mois */
  h += `<tr style="height:15px">
    <td rowspan="2" style="position:sticky;top:0;left:0;z-index:40;background:#1e3a8a;color:white;font-size:9px;font-weight:700;text-align:center;border:1px solid rgba(255,255,255,.15);vertical-align:middle;padding:2px">Opération</td>`;
  for (const mg of mG)
    h += `<td colspan="${mg.count}" style="position:sticky;top:0;z-index:20;background:#1e3a8a;color:white;font-size:8px;font-weight:700;text-align:center;border:0.5px solid rgba(255,255,255,.12);letter-spacing:.05em">${mg.nom}</td>`;
  h += `</tr>`;

  /* Ligne jours */
  h += `<tr style="height:13px">`;
  for (const j of joursM) {
    const isTod = j.clef === todayStr;
    const bg = isTod ? '#fef9c3' : j.wk ? '#c7d2fe' : '#2d4fa0';
    const fc = isTod ? '#92400e' : j.wk ? '#3730a3' : 'rgba(255,255,255,.8)';
    h += `<td style="position:sticky;top:15px;z-index:20;background:${bg};color:${fc};font-size:6.5px;text-align:center;border:0.5px solid rgba(255,255,255,.1);padding:0;font-weight:${isTod?700:400}">${j.num}</td>`;
  }
  h += `</tr></thead><tbody>`;

  for (const p of ordered) {
    h += _buildMobileRow(p, joursM, total, WM, idxDeb, rowH, barH, barTop, false, COL_W);
    if (p.soustaches?.length && !collapsed[p.id]) {
      for (const s of p.soustaches) {
        if (matchFiltres(s))
          h += _buildMobileRow(s, joursM, total, WM, idxDeb, 25, 13, 6, true, COL_W);
      }
    }
  }

  h += `</tbody></table></div>`;

  document.getElementById('mobile-view').innerHTML = h;
}

function _buildMobileRow(p, joursM, total, WM, idxDeb, rowH, barH, barTop, isSub, COL_W) {
  const col   = getColor(p), ec = etatColor(p.etat);
  const rowBg = isSub ? '#f0f9ff' : 'white';
  const bord  = isSub ? 'border-left:3px solid #38bdf8;' : '';
  const parts = p.debut.split('-');
  const lblDate = parts[2] + '/' + parts[1]; // JJ/MM

  /* Colonne nom — tap ouvre la fiche */
  let h = `<tr onclick="_mobileDetail('${p.id}')" style="cursor:pointer">
    <td style="position:sticky;left:0;z-index:10;background:${rowBg};${bord}width:${COL_W}px;max-width:${COL_W}px;height:${rowH}px;border:0.5px solid #e2e8f0;padding:3px 5px;vertical-align:middle;overflow:hidden">
      <div style="display:flex;align-items:center;gap:4px;overflow:hidden">
        ${isSub
          ? `<span style="color:#38bdf8;font-size:11px;flex-shrink:0">↳</span>`
          : `<span style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0"></span>`}
        <span style="font-size:${isSub?8:9}px;font-weight:${isSub?400:600};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b;flex:1">${esc(p.nom)}</span>
        <span style="font-size:7px;color:${ec};font-weight:600;flex-shrink:0">${esc(p.etat||'').slice(0,2)}</span>
      </div>
    </td>`;

  /* Cellule barre */
  h += `<td colspan="${total}" style="position:relative;padding:0;height:${rowH}px;border-bottom:0.5px solid #e2e8f0;overflow:hidden;background:${rowBg}">`;

  /* Fond weekends + aujourd'hui */
  let off = 0;
  for (const j of joursM) {
    if (j.wk)              h += `<div style="position:absolute;top:0;bottom:0;left:${off*WM}px;width:${WM}px;background:#eef2ff;pointer-events:none"></div>`;
    if (j.clef===todayStr) h += `<div style="position:absolute;top:0;bottom:0;left:${off*WM}px;width:${WM}px;background:rgba(254,240,138,.55);border-left:1.5px solid #fbbf24;pointer-events:none;z-index:1"></div>`;
    off++;
  }

  /* Barre */
  const pD  = idxDate(p.debut);
  const pF  = idxDate(p.fin);
  const bSR = Math.max(0, pD - idxDeb);
  const bER = Math.min(total - 1, pF - idxDeb);

  if (bSR <= bER && p.fin >= joursM[0].clef && p.debut <= joursM[joursM.length-1].clef) {
    const bLeft  = bSR * WM;
    const bWidth = (bER - bSR + 1) * WM;

    /* Date de début à gauche de la barre */
    if (bLeft > 2)
      h += `<div style="position:absolute;top:50%;transform:translateY(-50%);right:calc(100% - ${bLeft}px + 2px);font-size:7px;font-weight:700;color:var(--gray-500);white-space:nowrap;pointer-events:none;z-index:4">${lblDate}</div>`;

    /* Barre colorée */
    h += `<div style="position:absolute;top:${barTop}px;left:${bLeft}px;height:${barH}px;width:${bWidth}px;background:${col};border-radius:${isSub?2:4}px;z-index:3;box-shadow:0 1px 4px ${hexRgba(col,.35)}">
      <div style="position:absolute;top:0;left:0;right:0;height:45%;background:rgba(255,255,255,.22);border-radius:inherit;pointer-events:none"></div>
    </div>`;

    /* Nom à droite de la barre */
    if (bLeft + bWidth + 3 < total * WM)
      h += `<div style="position:absolute;top:0;bottom:0;left:${bLeft+bWidth+3}px;display:flex;align-items:center;z-index:4;pointer-events:none">
        <span style="font-size:7.5px;color:#374151;white-space:nowrap;font-weight:500">${esc(p.nom)}</span>
      </div>`;
  }

  h += `</td></tr>`;
  return h;
}

/* Fiche détail — tap sur une ligne */
window._mobileDetail = id => {
  const p = getById(id); if (!p) return;
  const col = getColor(p), ec = etatColor(p.etat);
  const dD = p.debut.split('-').reverse().join('/');
  const dF = p.fin  .split('-').reverse().join('/');
  ouvrirModal(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="width:14px;height:14px;border-radius:50%;background:${col};flex-shrink:0;display:inline-block"></span>
      <h3 style="margin:0;font-size:1rem;flex:1">${esc(p.nom)}</h3>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.85rem">
      <div><span style="color:var(--gray-500);font-size:.75rem;display:block">Association</span><strong>${esc(p.client)||'—'}</strong></div>
      <div><span style="color:var(--gray-500);font-size:.75rem;display:block">Attribution</span><strong style="color:${col}">${esc(p.tech)}</strong></div>
      <div><span style="color:var(--gray-500);font-size:.75rem;display:block">Début</span><strong>${dD}</strong></div>
      <div><span style="color:var(--gray-500);font-size:.75rem;display:block">Fin</span><strong>${dF}</strong></div>
      <div style="grid-column:1/-1"><span style="color:var(--gray-500);font-size:.75rem;display:block">État</span>
        <strong style="color:${ec}">${esc(p.etat||'À venir')}</strong></div>
    </div>
    ${p.soustaches?.length ? `<div style="margin-top:12px;border-top:1px solid var(--gray-200);padding-top:10px">
      <div style="font-size:.75rem;color:var(--gray-500);margin-bottom:6px;font-weight:600">SOUS-TÂCHES</div>
      ${p.soustaches.map(s => {
        const sc = etatColor(s.etat);
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--gray-100);font-size:.82rem">
          <span style="color:#38bdf8">↳</span>
          <span style="flex:1;font-weight:500">${esc(s.nom)}</span>
          <span style="color:${sc};font-weight:600;font-size:.75rem">${esc(s.etat||'À venir')}</span>
        </div>`;
      }).join('')}
    </div>` : ''}
    <div class="m-actions"><button class="btn btn-primary" onclick="fermerModal()">Fermer</button></div>`);
};


/* ══════════════════════════════════════════════════════
   DRAG — barres
══════════════════════════════════════════════════════ */
function attachDrag() {
  document.querySelectorAll('[data-pid]').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      const p = getById(el.dataset.pid); if (!p) return;
      dragMode = el.dataset.mode; dragPid = el.dataset.pid;
      dragX0 = e.clientX; dragIdxD0 = idxDate(p.debut); dragIdxF0 = idxDate(p.fin);
    });
  });
}

function bindEvents() {
  document.addEventListener('mousemove', e => {
    if (dragPid) {
      const dC = Math.round((e.clientX - dragX0) / W);
      const bw = document.getElementById('bw_'+dragPid);
      const bc = document.getElementById('bc_'+dragPid);
      if (!bw || !bc) return;
      if (dragMode === 'move') bw.style.left = (Math.max(0, dragIdxD0+dC)*W) + 'px';
      else bc.style.width = ((Math.max(dragIdxD0, dragIdxF0+dC) - dragIdxD0 + 1)*W) + 'px';
    }
    if (colResizing !== null) {
      colonnes[colResizing].width = Math.max(40, colResW0 + (e.clientX - colResX0));
      renderAll();
    }
  });

  document.addEventListener('mouseup', e => {
    if (dragPid) {
      const p = getById(dragPid);
      if (p) {
        const dC = Math.round((e.clientX - dragX0) / W);
        if (dragMode === 'move') {
          const dur = dragIdxF0 - dragIdxD0;
          const newD = Math.max(0, Math.min(jours.length-1-dur, dragIdxD0+dC));
          p.debut = dateFromIdx(newD); p.fin = dateFromIdx(newD+dur);
        } else {
          p.fin = dateFromIdx(Math.max(dragIdxD0, Math.min(jours.length-1, dragIdxF0+dC)));
        }
      }
      dragPid = null; dragMode = null; renderAll(); scheduleSave();
    }
    if (colResizing !== null) colResizing = null;
  });

  /* Touch support */
  document.addEventListener('touchstart', e => {}, { passive: true });
  window.addEventListener('resize', () => renderAll());
}

window.startColResize = (e, idx) => {
  e.stopPropagation(); e.preventDefault();
  colResizing = idx; colResX0 = e.clientX; colResW0 = colonnes[idx].width;
};
window.doSort = k => { if (sortCol===k) sortDir*=-1; else { sortCol=k; sortDir=1; } renderAll(); };
window.toggleCollapse = pid => { collapsed[pid] = !collapsed[pid]; renderAll(); };

/* ══════════════════════════════════════════════════════
   CRUD
══════════════════════════════════════════════════════ */
window.ajouterProjet = () => {
  const today = new Date().toISOString().slice(0,10);
  projets.push({
    id: 'id_'+Date.now(), nom: 'Nouvelle opération',
    client: 'Association', debut: today, fin: today,
    tech: techniciens[0]?.nom || '', etat: 'À venir', couleur: null, soustaches: []
  });
  renderAll(); scheduleSave();
};

window.ajouterSoustache = parentId => {
  const p = projets.find(x => x.id === parentId); if (!p) return;
  if (!p.soustaches) p.soustaches = [];
  p.soustaches.push({
    id: 'st_'+Date.now(), nom: 'Nouvelle sous-tâche',
    client: p.client, debut: p.debut, fin: p.fin,
    tech: p.tech, etat: 'À venir'
  });
  collapsed[parentId] = false;
  renderAll(); scheduleSave();
};

window.supprimerSoustache = (parentId, stId) => {
  const p = projets.find(x => x.id === parentId); if (!p) return;
  p.soustaches = p.soustaches.filter(s => s.id !== stId);
  renderAll(); scheduleSave();
};

window.supprimer = id => {
  const p = getById(id); if (!p) return;
  ouvrirModal(`
    <h3>Supprimer l'opération ?</h3>
    <p style="font-size:.85rem;color:var(--gray-500);margin:8px 0">"${esc(p.nom)}"</p>
    <p style="font-size:.8rem;color:var(--red)">Cette action est irréversible.</p>
    <div class="m-actions">
      <button class="btn" onclick="fermerModal()">Annuler</button>
      <button class="btn btn-danger" onclick="confirmerSupprimer('${id}')">Supprimer</button>
    </div>`);
};

window.confirmerSupprimer = id => {
  projets = projets.filter(p => p.id !== id);
  fermerModal(); renderAll(); scheduleSave();
};

window.dupliquer = id => {
  const src = getById(id); if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = 'id_'+Date.now(); copy.nom = src.nom+' (copie)';
  copy.soustaches = (copy.soustaches||[]).map(s => ({...s, id:'st_'+Date.now()+Math.random().toString(36).slice(2)}));
  const idx = projets.findIndex(x => x.id === id);
  projets.splice(idx+1, 0, copy);
  renderAll(); scheduleSave();
};

window.upd = (id, champ, val) => {
  const p = getById(id); if (!p) return;
  p[champ] = val;
  if (p.debut > p.fin) p.fin = p.debut;
  renderAll(); scheduleSave();
};

window.scrollAujourdhui = () => {
  const s = document.getElementById('gantt-wrap');
  if (s && todayIdx >= 0) s.scrollLeft = Math.max(0, todayIdx*W - 200);
};

/* ══════════════════════════════════════════════════════
   FILTRES
══════════════════════════════════════════════════════ */
let filtreActif = null;

window.ouvrirFiltre = (key, btn) => {
  if (filtreActif === key) { fermerFiltrePanel(); return; }
  fermerFiltrePanel();
  const vals = valeursUniques(key);
  const sel  = filtres[key] ? new Set(filtres[key]) : new Set(vals);
  const rect = btn.getBoundingClientRect();
  const allChecked = !filtres[key] || sel.size === vals.length;

  const panel = document.createElement('div');
  panel.id = 'filtre-panel';
  panel.style.cssText = `position:fixed;z-index:99999;background:white;border:1px solid var(--gray-200);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:10px;min-width:200px;max-height:320px;display:flex;flex-direction:column;font-family:inherit;font-size:11px;top:${rect.bottom+4}px;left:${Math.min(rect.left, window.innerWidth-220)}px`;

  let h = `<div style="padding-bottom:7px;margin-bottom:5px;border-bottom:1px solid var(--gray-100)">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--gray-900);padding:2px 0">
      <input type="checkbox" id="f-all" ${allChecked?'checked':''} style="cursor:pointer"> Tout sélectionner
    </label></div>
  <div style="overflow-y:auto;max-height:190px;margin-bottom:8px">`;
  for (const v of vals) {
    const chk = allChecked || sel.has(v);
    let dot = '';
    if (key==='tech') dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getTechColor(v)};flex-shrink:0"></span>`;
    if (key==='etat') dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${etatColor(v)};flex-shrink:0"></span>`;
    h += `<label style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:3px 2px;border-radius:4px" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
      <input type="checkbox" data-val="${esc(v)}" ${chk?'checked':''} style="cursor:pointer"> ${dot}<span>${esc(v)||'<i style="color:var(--gray-300)">(vide)</i>'}</span>
    </label>`;
  }
  h += `</div>
  <div style="display:flex;gap:6px;border-top:1px solid var(--gray-100);padding-top:8px">
    <button onclick="appliquerFiltre('${key}')" style="flex:1;padding:6px;background:var(--blue);color:white;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;font-family:inherit">OK</button>
    <button onclick="reinitFiltre('${key}')" style="flex:1;padding:6px;background:white;border:1px solid var(--gray-200);border-radius:6px;cursor:pointer;font-size:11px;color:var(--gray-500);font-family:inherit">Effacer</button>
  </div>`;
  panel.innerHTML = h;
  document.body.appendChild(panel);
  filtreActif = key;

  panel.querySelector('#f-all').addEventListener('change', function() {
    panel.querySelectorAll('[data-val]').forEach(cb => cb.checked = this.checked);
  });
  panel.querySelectorAll('[data-val]').forEach(cb => {
    cb.addEventListener('change', () => {
      panel.querySelector('#f-all').checked = [...panel.querySelectorAll('[data-val]')].every(c => c.checked);
    });
  });
  setTimeout(() => document.addEventListener('mousedown', fermerFiltreOutside), 50);
};

window.appliquerFiltre = key => {
  const panel = document.getElementById('filtre-panel'); if (!panel) return;
  const vals = valeursUniques(key);
  const sel  = [...panel.querySelectorAll('[data-val]:checked')].map(cb => cb.dataset.val);
  filtres[key] = sel.length === vals.length ? null : sel;
  fermerFiltrePanel(); renderAll();
};
window.reinitFiltre = key => { filtres[key] = null; fermerFiltrePanel(); renderAll(); };
function fermerFiltrePanel() { document.getElementById('filtre-panel')?.remove(); filtreActif = null; document.removeEventListener('mousedown', fermerFiltreOutside); }
function fermerFiltreOutside(e) { const p = document.getElementById('filtre-panel'); if (p && !p.contains(e.target) && !e.target.closest('[data-fbtn]')) fermerFiltrePanel(); }

/* ══════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════ */
window.ouvrirConfigTech = () => {
  let h = `<h3>Attributions &amp; couleurs</h3>`;
  techniciens.forEach((t, i) => {
    h += `<div class="cfg-row">
      <div id="dot${i}" style="width:11px;height:11px;border-radius:50%;background:${t.couleur};flex-shrink:0"></div>
      <input type="text" value="${esc(t.nom)}" style="flex:1" onchange="updateTechNom(${i},this.value)">
      <div class="color-grid" id="cg${i}">`;
    for (const c of PALETTES)
      h += `<div class="swatch ${c===t.couleur?'sel':''}" style="background:${c}" data-hex="${c}" onclick="updateTechCoul(${i},'${c}')"></div>`;
    h += `</div></div>`;
  });
  h += `<button class="btn btn-success" style="margin-top:12px" onclick="ajouterTech()">+ Ajouter</button>
    <div class="m-actions"><button class="btn" onclick="fermerModal()">Fermer</button></div>`;
  ouvrirModal(h);
};
window.ajouterTech = () => { techniciens.push({nom:'Nouvelle attribution',couleur:PALETTES[techniciens.length%PALETTES.length]}); ouvrirConfigTech(); scheduleSave(); };
window.updateTechNom = (i, val) => { const old = techniciens[i].nom; techniciens[i].nom = val; for (const p of projets) { if(p.tech===old)p.tech=val; p.soustaches?.forEach(s=>{if(s.tech===old)s.tech=val;}); } scheduleSave(); };
window.updateTechCoul = (i, hex) => { techniciens[i].couleur=hex; document.querySelectorAll(`#cg${i} .swatch`).forEach(s=>s.classList.toggle('sel',s.dataset.hex===hex)); document.getElementById('dot'+i).style.background=hex; renderAll(); scheduleSave(); };

window.ouvrirConfigCols = () => {
  let h = `<h3>Colonnes — intitulé &amp; largeur</h3>`;
  colonnes.forEach((c, i) => {
    h += `<div class="cfg-row">
      <span style="font-size:.75rem;color:var(--gray-500);width:44px;flex-shrink:0">Col. ${i+1}</span>
      <input type="text" value="${esc(c.label)}" style="flex:1" onchange="updateColLabel(${i},this.value)">
      <input type="number" value="${c.width}" min="40" max="400" style="width:64px;margin-left:6px" onchange="updateColWidth(${i},this.value)">
      <span style="font-size:.75rem;color:var(--gray-500)">px</span>
    </div>`;
  });
  h += `<div class="m-actions"><button class="btn" onclick="fermerModal()">Fermer</button></div>`;
  ouvrirModal(h);
};
window.updateColLabel = (i, val) => { colonnes[i].label = val; scheduleSave(); };
window.updateColWidth = (i, val) => { colonnes[i].width = Math.max(40, +val||40); renderAll(); scheduleSave(); };

/* ══════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════ */
function ouvrirModal(h) { document.getElementById('modal-body').innerHTML = h; document.getElementById('modal').classList.add('show'); }
window.fermerModal = () => { document.getElementById('modal').classList.remove('show'); };
document.addEventListener('keydown', e => { if (e.key==='Escape') { fermerModal(); fermerFiltrePanel(); } });

/* ══════════════════════════════════════════════════════
   HISTORIQUE
══════════════════════════════════════════════════════ */
window.toggleHistory = async (force) => {
  const panel = document.getElementById('history-panel');
  const open  = force !== undefined ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  if (open) await chargerHistorique();
};

async function chargerHistorique() {
  const list = document.getElementById('history-list');
  list.innerHTML = `<div style="padding:16px;color:var(--gray-500);font-size:.85rem">Chargement…</div>`;
  const items = await fetch(`/api/projects/${projectId}/history`).then(r => r.json());
  if (!items.length) { list.innerHTML = `<div style="padding:16px;color:var(--gray-500);font-size:.85rem">Aucun historique</div>`; return; }
  list.innerHTML = '';
  items.forEach(item => {
    const d = document.createElement('div');
    d.className = 'h-item';
    d.innerHTML = `<div class="h-by">Par ${esc(item.saved_by)}</div><div class="h-date">${new Date(item.saved_at).toLocaleString('fr-FR')}</div>`;
    d.onclick = () => restaurerVersion(item.id);
    list.appendChild(d);
  });
}

async function restaurerVersion(hid) {
  if (!confirm('Restaurer cette version ? Les modifications actuelles seront perdues.')) return;
  const v = await fetch(`/api/projects/${projectId}/history/${hid}`).then(r => r.json());
  projets = (v.data.tasks || []).map(normalizeTask);
  renderAll(); scheduleSave(); toggleHistory(false);
  toast('Version restaurée', 'ok');
}

/* ══════════════════════════════════════════════════════
   SAVE
══════════════════════════════════════════════════════ */
function getProjectData() {
  return { tasks: projets, techniciens, colonnes, ANNEE, W, collapsed };
}

function scheduleSave() {
  const ind = document.getElementById('save-indicator');
  ind.textContent = 'Modification…'; ind.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 2000);
}

async function saveNow() {
  clearTimeout(saveTimer);
  await fetch(`/api/projects/${projectId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: getProjectData(), user: pseudo })
  });
  ganttSocket.sendFullUpdate(getProjectData());
  const ind = document.getElementById('save-indicator');
  ind.textContent = '✓ Sauvegardé'; ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), 2500);
}

window.sauvegarder = () => saveNow();

/* ─ Sauvegarde locale (fichier téléchargeable) ── */
window.telechargerSauvegarde = () => {
  const data = getProjectData();
  const json = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), ...data }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `planning-sauvegarde-${date}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Sauvegarde téléchargée', 'ok');
};

/* ══════════════════════════════════════════════════════
   EXPORT PDF
══════════════════════════════════════════════════════ */
window.ouvrirExportPDF = () => {
  const printDebut = ANNEE+'-01-01', printFin = ANNEE+'-12-31';
  ouvrirModal(`
    <h3>📄 Export PDF</h3>
    <p style="font-size:.83rem;color:var(--gray-500);margin-bottom:14px">Sélectionnez la plage de dates à exporter.</p>
    <div class="field"><label>Date de début</label><input type="date" id="pdfD" value="${printDebut}"></div>
    <div class="field"><label>Date de fin</label><input type="date" id="pdfF" value="${printFin}"></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
      ${[['T1','-01-01','-03-31'],['T2','-04-01','-06-30'],['T3','-07-01','-09-30'],['T4','-10-01','-12-31'],['Année','-01-01','-12-31']]
        .map(([l,d,f]) => `<button class="btn" onclick="document.getElementById('pdfD').value='${ANNEE+d}';document.getElementById('pdfF').value='${ANNEE+f}'">${l}</button>`).join('')}
    </div>
    <div style="font-size:.77rem;color:var(--gray-500);background:var(--gray-50);border-radius:7px;padding:9px 12px;margin-bottom:4px">
      Dans la fenêtre d'impression, choisissez <b>« Enregistrer en PDF »</b>. Format recommandé : <b>A4 Paysage</b>.
    </div>
    <div class="m-actions">
      <button class="btn" onclick="fermerModal()">Annuler</button>
      <button class="btn btn-danger" onclick="lancerPDF()">📄 Générer</button>
    </div>`);
};

window.lancerPDF = () => {
  const d = document.getElementById('pdfD').value, f = document.getElementById('pdfF').value;
  if (!d||!f||d>f) { toast('Dates invalides', 'err'); return; }
  fermerModal();
  const joursImpr = jours.filter(j => j.clef >= d && j.clef <= f);
  if (!joursImpr.length) { toast('Aucun jour dans cette plage', 'err'); return; }
  const win = _buildPrintWindow(d, f, joursImpr);
  setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 800);
};

function _buildPrintWindow(d, f, ji) {
  const DWLET = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
  const MNOMS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const ordered = projFiltresTries(), total = ji.length;
  const WP = total<=31?11:total<=62?9:total<=93?8:total<=186?7:6;
  const idxDeb = idxDate(d), idxFin = idxDate(f);
  const fW = frozenW(), totalW = fW + total*WP;
  const zoom = Math.min(1, Math.floor((1070/totalW)*1000)/1000);

  let mG=[],curM=-1,cnt=0;
  for(const j of ji){if(j.moisIdx!==curM){if(cnt)mG.push({nom:MNOMS[curM],moisIdx:curM,count:cnt});curM=j.moisIdx;cnt=1;}else cnt++;}
  if(cnt)mG.push({nom:MNOMS[curM],moisIdx:curM,count:cnt});
  let sG=[],curS=-1;cnt=0;
  for(const j of ji){if(j.sem!==curS){if(cnt)sG.push({sem:curS,count:cnt});curS=j.sem;cnt=1;}else cnt++;}
  if(cnt)sG.push({sem:curS,count:cnt});

  const css = `*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{background:white;color:#1e293b}table{border-collapse:separate;border-spacing:0;table-layout:fixed}td{overflow:visible;vertical-align:middle;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}.thf{font-size:7.5px;font-weight:700;text-align:center;color:white!important;background:#1e3a8a!important;border:1px solid rgba(255,255,255,.15);padding:2px 4px;white-space:nowrap;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.cf{font-size:7.5px;color:#374151;background:white!important;border-right:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:18px}.csf{font-size:7px;color:#0369a1!important;background:#f0f9ff!important;border-left:2px solid #38bdf8;border-right:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:1px 3px;height:15px}@media print{@page{size:A4 landscape;margin:10mm 8mm 12mm 8mm}}`;

  const win = window.open('','_print','width=1400,height=900');
  let ph = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planning — ${d} / ${f}</title><style>${css}</style></head><body>`;
  ph += `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #1e3a8a">
    <div><div style="font-size:13px;font-weight:700">Planning — Installation</div>
    <div style="font-size:8.5px;color:#64748b;margin-top:2px">Période : ${d.split('-').reverse().join('/')} → ${f.split('-').reverse().join('/')} &nbsp;|&nbsp; ${total} jours &nbsp;|&nbsp; ${ordered.length} opération${ordered.length>1?'s':''}</div></div>
    <div style="font-size:8px;color:#94a3b8">Édité le ${new Date().toLocaleDateString('fr-FR')}</div></div>`;
  ph += `<div style="zoom:${zoom};transform-origin:top left"><table style="width:${totalW}px"><colgroup>`;
  for(const c of colonnes) ph+=`<col style="width:${c.width}px;min-width:${c.width}px;max-width:${c.width}px">`;
  for(let i=0;i<total;i++) ph+=`<col style="width:${WP}px;min-width:${WP}px;max-width:${WP}px">`;
  ph+=`</colgroup><thead><tr style="height:13px">`;
  for(const c of colonnes) ph+=`<td rowspan="3" class="thf" style="vertical-align:middle;width:${c.width}px">${esc(c.label)}</td>`;
  for(const mg of mG) ph+=`<td colspan="${mg.count}" style="text-align:center;font-size:7pt;font-weight:700;background:#eef2ff;color:#1e3a8a;border:0.5px solid #c7d2fe;padding:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact">${mg.nom}</td>`;
  ph+=`</tr><tr style="height:9px">`;
  for(const sg of sG) ph+=`<td colspan="${sg.count}" style="text-align:center;font-size:6px;color:#64748b;border:0.5px solid #e2e8f0;background:#fafafa;padding:0">${sg.count*WP>=14?'S'+sg.sem:''}</td>`;
  ph+=`</tr><tr style="height:11px">`;
  for(const j of ji){const bg=j.wk?'#eef2ff':'white',fc=j.wk?'#818cf8':'#475569';ph+=`<td style="background:${bg};color:${fc};font-size:${WP>=9?6.5:5.5}px;text-align:center;border:0.5px solid #e2e8f0;border-bottom:1px solid #94a3b8;padding:0;line-height:1.1;vertical-align:middle">${WP>=8?`<div style="font-size:5px">${DWLET[j.dw]}</div>`:''}<div style="font-weight:700">${j.num}</div></td>`;}
  ph+=`</tr></thead><tbody>`;
  for(const p of ordered){
    ph+=_printRow(p,ji,total,WP,idxDeb,idxFin,false,MNOMS);
    if(p.soustaches?.length&&!collapsed[p.id])for(const s of p.soustaches)ph+=_printRow(s,ji,total,WP,idxDeb,idxFin,true,MNOMS);
  }
  ph+=`</tbody></table></div><div style="font-size:7px;color:#94a3b8;text-align:right;padding:3px 0;border-top:0.5px solid #e2e8f0;margin-top:3px">Planning — Édité le ${new Date().toLocaleDateString('fr-FR')}</div></body></html>`;
  win.document.write(ph); win.document.close(); return win;
}

function _printRow(p, ji, total, WP, idxDeb, idxFin, isSub) {
  const col = getTechColor(p.tech), ec = etatColor(p.etat);
  const rowH = isSub?15:19, barTop=isSub?3:4, barH=isSub?9:11;
  let h = `<tr style="height:${rowH}px">`;
  for(let ci=0;ci<colonnes.length;ci++){
    const c=colonnes[ci],ck=c.key,cls=isSub?'csf':'cf';
    h+=`<td class="${cls}" style="width:${c.width}px;max-width:${c.width}px">`;
    if(ck==='nom'){if(isSub)h+='<span style="color:#38bdf8;margin-right:2px">↳</span>';h+=`<span style="font-weight:${isSub?400:600}">${esc(p.nom)}</span>`;}
    else if(ck==='client')h+=`<span style="color:#64748b">${esc(p.client)}</span>`;
    else if(ck==='debut')h+=`<span>${p.debut.split('-').slice(1).reverse().join('/')}</span>`;
    else if(ck==='fin')  h+=`<span>${p.fin  .split('-').slice(1).reverse().join('/')}</span>`;
    else if(ck==='tech') h+=`<span style="color:${col};font-weight:600">${esc(p.tech)}</span>`;
    else if(ck==='etat') h+=`<span style="color:${ec};font-weight:600">${esc(p.etat||'À venir')}</span>`;
    h+='</td>';
  }
  h+=`<td colspan="${total}" style="position:relative;padding:0;height:${rowH}px;border-bottom:0.5px solid #e2e8f0;overflow:visible;background:white">`;
  let gOff=0;
  for(const j of ji){h+=`<div style="position:absolute;top:0;bottom:0;left:${gOff*WP}px;width:${WP}px;background:${j.wk?'#eef2ff':'white'}"></div>`;gOff++;}
  const pD=idxDate(p.debut),pF=idxDate(p.fin);
  const bSR=Math.max(0,pD-idxDeb),bER=Math.min(total-1,pF-idxDeb);
  if(bSR<=bER&&pF>=idxDeb&&pD<=idxFin){
    const bL=bSR*WP,bW=(bER-bSR+1)*WP;
    h+=`<div style="position:absolute;top:${barTop}px;left:${bL}px;height:${barH}px;width:${bW}px;background:${col};border-radius:${isSub?2:3}px;z-index:3;opacity:${isSub?.82:1}">
      <div style="position:absolute;top:0;left:0;right:0;height:40%;background:rgba(255,255,255,.2);border-radius:inherit"></div></div>`;
    h+=`<div style="position:absolute;top:0;left:${bL+bW+3}px;bottom:0;display:flex;align-items:center;z-index:4">
      <span style="font-size:${isSub?5.5:6.5}px;color:#374151;white-space:nowrap;font-weight:${isSub?400:500}">${isSub?'↳ ':''}${esc(p.nom)}</span></div>`;
  }
  h+=`</td></tr>`;
  return h;
}

/* ══════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════ */
function toast(msg, type = '') {
  const c = document.getElementById('toast-box');
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
}
