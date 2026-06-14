/* ══════════════════════════════════════════════════════
   Planning Collaboratif — Gantt Engine
══════════════════════════════════════════════════════ */

/* ── Rôles utilisateurs ── */
var ROLES = {
  'Cedric'  : 'admin',
  'Thomas'  : 'admin',
  'Damien'  : 'admin',
  'Denis'   : 'viewer',
  'Alexis'  : 'viewer',
  'Stephane': 'viewer',
  'William' : 'viewer',
  'ECO'     : 'eco',
  'ASEPTIC' : 'aseptic',
};

/* ── Codes d'accès — MODIFIER ICI ── */
window.PASSWORDS = {
  'Cedric'  : '1702',
  'Thomas'  : '1702',
  'Damien'  : '1702',
  'Denis'   : 'REFERENTS',
  'Alexis'  : 'REFERENTS',
  'Stephane': 'REFERENTS',
  'William' : 'REFERENTS',
  'ECO'     : 'ECO26',
  'ASEPTIC' : 'ASEP26',
};

var userRole = 'viewer';

window.applyRole = function(p) {
  userRole = ROLES[p] || 'viewer';
  window._userRole = userRole;
  if (userRole !== 'admin')   document.body.classList.add('read-only');
  if (userRole === 'eco' || userRole === 'aseptic') document.body.classList.add('role-eco');
};

/* ── Undo ── */
var _undoStack = [];
const _UNDO_MAX = 30;
function pushUndo() {
  _undoStack.push(JSON.stringify(projets));
  if (_undoStack.length > _UNDO_MAX) _undoStack.shift();
}
window.undo = () => {
  if (!_undoStack.length) { toast('Rien à annuler', ''); return; }
  projets = JSON.parse(_undoStack.pop()).map(normalizeTask);
  renderAll(); scheduleSave();
  toast('↩ Action annulée', 'ok');
};

/* ── État global ── */
var W = 14, WMIN = 6, WMAX = 36;
var ROW_H = 42, ROW_HMIN = 24, ROW_HMAX = 80;
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

var PALETTES = [
  /* Bleus   */ '#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#0ea5e9','#38bdf8','#7dd3fc',
  /* Verts   */ '#15803d','#16a34a','#22c55e','#4ade80','#10b981','#14b8a6','#2dd4bf','#84cc16',
  /* Jaunes  */ '#92400e','#b45309','#d97706','#f59e0b','#fbbf24','#fde047','#ca8a04','#a16207',
  /* Rouges  */ '#991b1b','#dc2626','#ef4444','#f87171','#e11d48','#be123c','#fb7185','#f43f5e',
  /* Violets */ '#4c1d95','#7c3aed','#8b5cf6','#a78bfa','#6d28d9','#9333ea','#a855f7','#d946ef',
  /* Roses   */ '#831843','#be185d','#db2777','#ec4899','#f472b6','#f9a8d4','#e879f9','#c026d3',
  /* Oranges */ '#9a3412','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#d97706','#f59e0b',
  /* Neutres */ '#1e293b','#334155','#475569','#64748b','#78716c','#a8a29e','#57534e','#292524',
];

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
  { key: 'client',    label: 'Association', width: 110, visible: true },
  { key: 'nom',       label: 'Tâche',       width: 360, visible: true },
  { key: 'operation', label: 'Opérations',  width: 130, visible: true },
  { key: 'debut',     label: 'Début',       width: 92,  visible: true },
  { key: 'fin',       label: 'Fin',         width: 92,  visible: true },
  { key: 'tech',      label: 'Attribution', width: 130, visible: true },
  { key: 'etat',      label: 'État',        width: 90,  visible: true },
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
    sortCol   = 'debut'; // tri par défaut : date de début
    sortDir   = 1;
    collapsed = {};

    /* Restaurer les filtres et le tri sauvegardés pour ce planning */
    try {
      const sf = localStorage.getItem('filtres_' + (pid || 'default'));
      if (sf) filtres = JSON.parse(sf);
      const ss = localStorage.getItem('sort_' + (pid || 'default'));
      if (ss) { const o = JSON.parse(ss); sortCol = o.col; sortDir = o.dir; }
    } catch(e) {}

    if (data.techniciens) techniciens = data.techniciens;
    if (data.colonnes)    colonnes    = data.colonnes.map(c => ({ visible: true, ...c }));
    if (data.ANNEE)       ANNEE       = data.ANNEE;
    if (data.W)           W           = data.W;
    if (data.ROW_H)       ROW_H       = data.ROW_H;
    if (data.collapsed)   collapsed   = data.collapsed;

    projets = (data.tasks || []).map(normalizeTask);

    /* ── Migration : ancienne colonne perso → clé native "operation" ── */
    const migrated = _migrateOperationCol();

    /* ── Garantie : la colonne native "operation" est toujours présente dans colonnes ── */
    if (!colonnes.find(c => c.key === 'operation')) {
      const idxEtat = colonnes.findIndex(c => c.key === 'etat');
      colonnes.splice(idxEtat >= 0 ? idxEtat : colonnes.length, 0,
        { key: 'operation', label: 'Opérations', width: 130, visible: true });
    }

    /* ── Propagation : operation de la tâche parente vers ses sous-tâches ── */
    let propagated = false;
    for (const p of projets) {
      if (!p.soustaches?.length) continue;
      for (const s of p.soustaches) {
        if (!s.operation && p.operation) { s.operation = p.operation; propagated = true; }
      }
    }

    if (migrated || propagated) saveNow();

    initAnneeSelect();
    initJours();
    applyRowH();
    /* Appliquer le filtre rôle AVANT le premier rendu pour éviter le flash */
    if (userRole === 'eco' || userRole === 'aseptic') window._applyRoleFilter?.();
    renderAll();
    if (!ganttApp._bound) { bindEvents(); ganttApp._bound = true; }
    setTimeout(scrollAujourdhui, 50);
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
  if (!t.predecesseurs) t.predecesseurs = [];
  if (t.notes === undefined) t.notes = '';
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
function frozenW()     { return visibleCols().reduce((s, c) => s + c.width, 0); }

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

/* Pour ECO/ASEPTIC : uniquement les valeurs issues de leurs tâches attribuées.
   Pour les autres rôles : identique à valeursUniques. */
function valeursFiltrables(key) {
  const v = new Set();
  for (const p of projets) {
    /* Vérifier les autres filtres actifs (tous sauf celui qu'on est en train d'ouvrir) */
    const autresFiltresMatch = Object.entries(filtres).every(([k, vals]) => {
      if (k === key || !vals?.length) return true;
      return vals.includes(String(p[k] ?? ''));
    });
    if (!autresFiltresMatch) continue;

    /* ECO/ASEPTIC : limiter aux tâches qui leur sont attribuées */
    if (userRole === 'eco' || userRole === 'aseptic') {
      const techFilter = filtres['tech'] || [];
      if (techFilter.includes(p.tech ?? '')) v.add(String(p[key] ?? ''));
      p.soustaches?.forEach(s => {
        if (techFilter.includes(s.tech ?? '')) v.add(String(s[key] ?? ''));
      });
    } else {
      v.add(String(p[key] ?? ''));
      p.soustaches?.forEach(s => v.add(String(s[key] ?? '')));
    }
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

/* Les sous-tâches sont toujours affichées si leur parent est visible.
   Le filtre s'applique uniquement aux tâches parentes. */
function matchFiltresSousTache(s) {
  return true;
}

function cmpSort(a, b) {
  if (!sortCol) return 0;
  const va = String(a[sortCol] ?? '').toLowerCase();
  const vb = String(b[sortCol] ?? '').toLowerCase();
  return va < vb ? -sortDir : va > vb ? sortDir : 0;
}

function projFiltresTries() {
  let res = projets.filter(p => matchFiltres(p) || p.soustaches?.some(s => matchFiltres(s)));
  if (sortCol) res.sort(cmpSort);
  return res;
}

/* Retourne une liste plate de lignes à afficher dans le Gantt.
   type 'parent' : tâche principale visible
   type 'sub'    : sous-tâche dont le parent est visible
   type 'orphan' : sous-tâche dont le parent ne correspond pas au filtre */
function rowsForRender() {
  const hasFilter = Object.values(filtres).some(v => v && v.length > 0);
  const rows = [];
  const sorted = sortCol ? [...projets].sort(cmpSort) : projets;

  for (const p of sorted) {
    const parentMatch = matchFiltres(p);
    if (!hasFilter || parentMatch) {
      rows.push({ type: 'parent', task: p });
      if (p.soustaches?.length && !collapsed[p.id]) {
        const subs = sortCol ? [...p.soustaches].sort(cmpSort) : p.soustaches;
        for (const s of subs) rows.push({ type: 'sub', task: s, parentId: p.id });
      }
    } else {
      /* Parent hors filtre : afficher uniquement les sous-tâches qui matchent */
      const subs = sortCol ? [...(p.soustaches||[])].sort(cmpSort) : (p.soustaches||[]);
      for (const s of subs) {
        if (matchFiltres(s)) rows.push({ type: 'orphan', task: s, parentId: p.id, parentName: p.nom });
      }
    }
  }
  return rows;
}

function soustachesTries(p) {
  if (!p.soustaches?.length) return [];
  return sortCol ? [...p.soustaches].sort(cmpSort) : p.soustaches;
}

const visibleCols = () => colonnes.filter(c => c.visible !== false);

function calcLefts() {
  let acc = 0, lefts = [];
  for (const c of visibleCols()) { lefts.push(acc); acc += c.width; }
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

window.changerAnnee = y => { ANNEE = +y; initJours(); renderAll(); saveNow(); };
window.setZoom    = d => { W     = Math.max(WMIN,   Math.min(WMAX,   W+d));     document.getElementById('zoomLbl').textContent   = W+'px';     renderAll(); saveNow(); };
window.setRowH    = d => { ROW_H = Math.max(ROW_HMIN, Math.min(ROW_HMAX, ROW_H+d)); applyRowH(); renderAll(); saveNow(); };
function applyRowH() {
  document.documentElement.style.setProperty('--row-h', ROW_H + 'px');
  const lbl = document.getElementById('rowHLbl');
  if (lbl) lbl.textContent = ROW_H + 'px';
}

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
  const lefts   = calcLefts();

  /* Groupes mois */
  let mG = [], curM = '', cnt = 0;
  for (const j of jours) { if (j.mois !== curM) { if (cnt) mG.push({nom:curM,count:cnt}); curM=j.mois; cnt=1; } else cnt++; }
  if (cnt) mG.push({nom:curM,count:cnt});

  /* Groupes semaines */
  let sG = [], curS = -1; cnt = 0;
  for (const j of jours) { if (j.sem !== curS) { if (cnt) sG.push({sem:curS,count:cnt}); curS=j.sem; cnt=1; } else cnt++; }
  if (cnt) sG.push({sem:curS,count:cnt});

  const vcols = visibleCols();

  let h = `<table style="border-collapse:collapse;table-layout:fixed"><colgroup>`;
  for (const c of vcols)  h += `<col style="width:${c.width}px;min-width:${c.width}px;max-width:${c.width}px">`;
  for (let i = 0; i < total; i++) h += `<col style="width:${W}px;min-width:${W}px">`;
  h += `</colgroup><thead>`;

  /* Ligne mois */
  h += `<tr style="height:20px">`;
  for (let ci = 0; ci < vcols.length; ci++) {
    const c = vcols[ci];
    const arrow = sortCol===c.key ? (sortDir===1?' ▲':' ▼') : '';
    const globalCi = colonnes.indexOf(c);
    h += `<td rowspan="3" class="th-col sortable" data-ci="${globalCi}" data-key="${c.key}"
      style="position:sticky;top:0;left:${lefts[ci]}px;z-index:40;width:${c.width}px;user-select:none"
      onmousedown="colDragStart(event,${globalCi})" onclick="doSort('${c.key}')">
      ${esc(c.label)}<span style="font-size:7px;margin-left:2px;opacity:${sortCol===c.key?1:.25}">${arrow}</span>
      <div class="col-resizer" style="position:absolute;right:0;top:0;bottom:0;width:6px;cursor:col-resize;z-index:50" onmousedown="startColResize(event,${globalCi})"></div>
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
  for (let ci = 0; ci < vcols.length; ci++) {
    const c = vcols[ci], vals = valeursUniques(c.key);
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
  for (const row of rowsForRender()) {
    if (row.type === 'parent')      h += buildRow(row.task, total, false, null,        lefts);
    else if (row.type === 'sub')    h += buildRow(row.task, total, true,  row.parentId, lefts);
    else /* orphan */               h += buildRow(row.task, total, true,  row.parentId, lefts, row.parentName);
  }
  h += `</tbody></table>`;

  document.getElementById('gantt-inner').innerHTML = h;
  document.getElementById('zoomLbl').textContent  = W + 'px';
  document.getElementById('rowHLbl').textContent  = ROW_H + 'px';
  attachDrag();
  drawDependencyArrows();
}

/* ─ Build one row ────────────────────────────────────── */
function buildRow(p, total, isSub, parentId, lefts, orphanParentName = null) {
  const idxD = idxDate(p.debut), idxF = idxDate(p.fin);
  const yearStart = ANNEE+'-01-01', yearEnd = ANNEE+'-12-31';
  const showBar = !(p.fin < yearStart || p.debut > yearEnd);
  let bD = idxD < 0 ? 0 : idxD, bF = idxF;
  if (showBar) { if (bD < 0) bD = 0; if (bF < 0 || bF >= jours.length) bF = jours.length-1; if (bF < bD) bF = bD; }
  const barLeft = bD * W, barW = (bF - bD + 1) * W;
  const col = getColor(p), colL = hexRgba(col, .12);
  const parts = p.debut.split('-'), lblDate = parts[2]+'/'+parts[1];
  const rowH  = isSub ? Math.round(ROW_H * 0.8) : ROW_H;
  const barH  = Math.max(10, Math.round(rowH * 0.55));
  const barTop = Math.round((rowH - barH) / 2);
  const rowBg = isSub ? '#f0f9ff' : 'white';
  const bL    = isSub ? 'border-left:3px solid #38bdf8;' : '';
  const techOpts = techniciens.map(t => `<option value="${esc(t.nom)}" ${p.tech===t.nom?'selected':''}>${esc(t.nom)}</option>`).join('');
  const etatOpts = ETATS.map(v => `<option value="${v}" ${p.etat===v?'selected':''}>${v}</option>`).join('');
  const ec = etatColor(p.etat);

  const vcols = visibleCols();
  const pid   = parentId || '';
  let h = `<tr data-rowid="${p.id}">`;

  for (let ci = 0; ci < vcols.length; ci++) {
    const c = vcols[ci], ck = c.key;
    h += `<td class="cell ${isSub?'cell-sub':''}"
      style="position:sticky;left:${lefts[ci]}px;z-index:10;background:${rowBg};${bL}width:${c.width}px;min-width:${c.width}px;max-width:${c.width}px">`;

    if (ck === 'nom') {
      h += `<div style="display:flex;align-items:center;gap:2px;height:100%">
        <span data-rowdrag="1"
          onmousedown="startRowDragMouse(event,'${p.id}','${pid}')"
          style="cursor:${userRole==='admin'?'grab':'default'};color:#cbd5e1;font-size:13px;flex-shrink:0;user-select:none;padding:0 1px"
          onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#cbd5e1'">⠿</span>`;
      if (!isSub) {
        const hasSub = p.soustaches?.some(s => matchFiltresSousTache(s));
        h += hasSub
          ? `<button onclick="toggleCollapse('${p.id}')" style="width:14px;height:14px;padding:0;font-size:8px;flex-shrink:0;border:1px solid var(--gray-300);border-radius:3px;background:white;cursor:pointer">${collapsed[p.id]?'▶':'▼'}</button>`
          : `<span style="width:14px;flex-shrink:0"></span>`;
        h += `<input type="text" value="${esc(p.nom)}" style="flex:1;min-width:0" onchange="upd('${p.id}','nom',this.value)">`;
        h += `<div class="row-actions">
          ${p.notes?`<button class="row-btn row-btn-notes has-note" onclick="ouvrirNotes('${p.id}')" title="Voir la note">💬</button>`:''}
          <button class="row-btn row-btn-menu${p.predecesseurs?.length?' has-pred':''}" onclick="toggleRowMenu(event,'${p.id}',false,'')" title="Actions">⋮</button>
        </div>`;
      } else {
        if (orphanParentName) {
          const pLabel = orphanParentName.length > 14 ? orphanParentName.slice(0, 14) + '…' : orphanParentName;
          h += `<span class="orphan-badge" title="Tâche parente : ${esc(orphanParentName)}">↳ ${esc(pLabel)}</span>`;
        } else {
          h += `<span style="color:#38bdf8;font-size:11px;flex-shrink:0;margin-right:1px">↳</span>`;
        }
        h += `<input type="text" value="${esc(p.nom)}" style="flex:1;min-width:0" onchange="upd('${p.id}','nom',this.value)">`;
        h += `<div class="row-actions">
          ${p.notes?`<button class="row-btn row-btn-notes has-note" onclick="ouvrirNotes('${p.id}')" title="Voir la note">💬</button>`:''}
          <button class="row-btn row-btn-menu${p.predecesseurs?.length?' has-pred':''}" onclick="toggleRowMenu(event,'${p.id}',true,'${parentId}')" title="Actions">⋮</button>
        </div>`;
      }
      h += `</div>`;
    }
    else if (ck === 'client')    h += `<input type="text" value="${esc(p.client)}"         onchange="upd('${p.id}','client',this.value)">`;
    else if (ck === 'operation') h += `<input type="text" value="${esc(p.operation||'')}"   onchange="upd('${p.id}','operation',this.value)">`;
    else if (ck === 'debut')     h += `<input type="date" value="${p.debut}"                onchange="upd('${p.id}','debut',this.value)">`;
    else if (ck === 'fin')       h += `<input type="date" value="${p.fin}"                  onchange="upd('${p.id}','fin',this.value)">`;
    else if (ck === 'tech')      h += `<select onchange="upd('${p.id}','tech',this.value)" style="background:${colL};color:${col};font-weight:600">${techOpts}</select>`;
    else if (ck === 'etat')      h += `<select class="${ETAT_META[p.etat]?.cls??''}" onchange="upd('${p.id}','etat',this.value)">${etatOpts}</select>`;
    else h += `<input type="text" value="${esc(p[ck]||'')}" onchange="upd('${p.id}','${ck}',this.value)">`;
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

window._toggleMobilePanel = () => {
  window._mobilePanelVisible = window._mobilePanelVisible === false ? true : false;
  renderMobile();
};

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

  const panelVisible = window._mobilePanelVisible !== false;
  const selLabel = moisTriés.map(m => MNOMS3[m]).join(' · ');

  /* Bandeau repliable */
  let h = `<div style="background:#0f1b3d;flex-shrink:0">`;

  /* Barre titre toujours visible */
  h += `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;cursor:pointer" onclick="_toggleMobilePanel()">
    <div>
      <span style="font-size:.7rem;color:rgba(255,255,255,.45);font-weight:700;letter-spacing:.08em;text-transform:uppercase">Mois : </span>
      <span style="font-size:.75rem;color:rgba(255,255,255,.75);font-weight:600">${selLabel}</span>
    </div>
    <span style="font-size:11px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.1);border-radius:4px;padding:2px 7px;flex-shrink:0">
      ${panelVisible ? '▲ Masquer' : '▼ Mois'}
    </span>
  </div>`;

  /* Panneau dépliable */
  if (panelVisible) {
    h += `<div style="padding:0 10px 8px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">`;
    for (let m = 0; m < 12; m++) {
      const sel = _moisSelectionnes.includes(m);
      h += `<button onclick="_toggleMoisMobile(${m})"
        style="border:none;border-radius:5px;padding:4px 8px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:inherit;
               background:${sel ? 'var(--blue)' : 'rgba(255,255,255,.1)'};
               color:${sel ? 'white' : 'rgba(255,255,255,.45)'}">
        ${MNOMS3[m]}
      </button>`;
    }
    h += `</div>
      <div style="font-size:.62rem;color:rgba(255,255,255,.25);margin-top:6px">Appuyez sur une ligne pour les détails complets</div>
    </div>`;
  }

  h += `</div>`;

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
      for (const s of soustachesTries(p)) {
        if (matchFiltresSousTache(s))
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
      if (userRole !== 'admin') return;
      e.stopPropagation(); e.preventDefault();
      const p = getById(el.dataset.pid); if (!p) return;
      dragMode = el.dataset.mode; dragPid = el.dataset.pid;
      dragX0 = e.clientX; dragIdxD0 = idxDate(p.debut); dragIdxF0 = idxDate(p.fin);
    });
  });
}

function bindEvents() {
  /* ── Drag barres ── */
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
    /* ── Drag lignes ── */
    if (rowDragActive) {
      e.preventDefault();
      document.querySelectorAll('.row-drag-over').forEach(el => el.classList.remove('row-drag-over'));
      const tr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr[data-rowid]');
      if (tr && tr.dataset.rowid !== rowDragId) {
        const tParent = _getParentId(tr.dataset.rowid);
        const sameLevel = (!rowDragParentId && !tParent) ||
                          (rowDragParentId && tParent && rowDragParentId === tParent);
        if (sameLevel) tr.classList.add('row-drag-over');
      }
    }
  });

  document.addEventListener('mouseup', e => {
    if (dragPid) {
      const p = getById(dragPid);
      if (p) {
        const dC = Math.round((e.clientX - dragX0) / W);
        if (dragMode === 'move') {
          const dur   = dragIdxF0 - dragIdxD0;
          const newD  = Math.max(0, Math.min(jours.length-1-dur, dragIdxD0+dC));
          const delta = newD - dragIdxD0;
          p.debut = dateFromIdx(newD); p.fin = dateFromIdx(newD+dur);
          if (delta !== 0) deplacerSuccesseurs(dragPid, delta);
        } else {
          p.fin = dateFromIdx(Math.max(dragIdxD0, Math.min(jours.length-1, dragIdxF0+dC)));
          propagerDates(dragPid);
        }
      }
      dragPid = null; dragMode = null; renderAll(); scheduleSave();
    }
    if (colResizing !== null) { colResizing = null; saveNow(); }
    /* ── Fin drag lignes ── */
    if (rowDragActive) {
      const tr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr[data-rowid]');
      if (tr && tr.dataset.rowid !== rowDragId) {
        const targetId     = tr.dataset.rowid;
        const targetParent = _getParentId(targetId);
        const sameLevel    = (!rowDragParentId && !targetParent) ||
                             (rowDragParentId && targetParent && rowDragParentId === targetParent);
        if (sameLevel) {
          pushUndo();
          if (!rowDragParentId) {
            const fi = projets.findIndex(p => p.id === rowDragId);
            const ti = projets.findIndex(p => p.id === targetId);
            if (fi >= 0 && ti >= 0) { const [it] = projets.splice(fi,1); projets.splice(ti,0,it); }
          } else {
            const par = projets.find(p => p.id === rowDragParentId);
            if (par) {
              const fi = par.soustaches.findIndex(s => s.id === rowDragId);
              const ti = par.soustaches.findIndex(s => s.id === targetId);
              if (fi >= 0 && ti >= 0) { const [it] = par.soustaches.splice(fi,1); par.soustaches.splice(ti,0,it); }
            }
          }
          /* Effacer le tri actif — le drag manuel prime sur le tri colonne */
          sortCol = null; sortDir = 1;
          localStorage.removeItem('sort_' + projectId);
          renderAll(); scheduleSave();
        }
      }
      rowDragActive = false;
      rowDragId = null; rowDragParentId = null;
      document.body.style.cursor = '';
      document.querySelectorAll('.row-drag-over,.row-dragging').forEach(el =>
        el.classList.remove('row-drag-over','row-dragging'));
    }
  });

  /* ── Pan ── */
  const wrap = document.getElementById('gantt-wrap');
  let isPanning = false, panX = 0, panY = 0, panSL = 0, panST = 0;

  wrap.addEventListener('mousedown', e => {
    if (e.target.closest('[data-pid],[data-fbtn],input,select,button,.proj-actions,.row-actions,[data-rowdrag],.col-resizer')) return;
    if (dragPid || colResizing !== null || rowDragActive) return;
    isPanning = true;
    panX  = e.clientX; panY  = e.clientY;
    panSL = wrap.scrollLeft; panST = wrap.scrollTop;
    wrap.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    wrap.scrollLeft = panSL - (e.clientX - panX);
    wrap.scrollTop  = panST - (e.clientY - panY);
  });

  document.addEventListener('mouseup', () => {
    if (!isPanning) return;
    isPanning = false;
    wrap.style.cursor = '';
  });

  /* Touch support */
  document.addEventListener('touchstart', e => {}, { passive: true });
  window.addEventListener('resize', () => renderAll());
}

window.startColResize = (e, idx) => {
  e.stopPropagation(); e.preventDefault();
  colResizing = idx; colResX0 = e.clientX; colResW0 = colonnes[idx].width;
};

/* ── Drag & drop des colonnes dans l'en-tête du tableau ── */
let _colDragIdx = null, _colDragMoved = false, _colDragGhost = null, _colDragIndicator = null;

window.colDragStart = (e, idx) => {
  if (e.target.classList.contains('col-resizer')) return; // laisser le resize gérer
  _colDragIdx   = idx;
  _colDragMoved = false;

  /* Fantôme visuel qui suit la souris */
  _colDragGhost = document.createElement('div');
  _colDragGhost.textContent = colonnes[idx].label;
  _colDragGhost.style.cssText = `position:fixed;z-index:99999;pointer-events:none;padding:5px 12px;
    background:var(--blue);color:white;border-radius:6px;font-size:.78rem;font-weight:700;
    font-family:inherit;box-shadow:0 4px 12px rgba(0,0,0,.25);opacity:.92;white-space:nowrap;
    left:${e.clientX+10}px;top:${e.clientY-16}px`;
  document.body.appendChild(_colDragGhost);

  /* Indicateur de position (trait bleu vertical) */
  _colDragIndicator = document.createElement('div');
  _colDragIndicator.style.cssText = `position:fixed;z-index:99998;pointer-events:none;
    width:3px;background:var(--blue);top:0;bottom:0;display:none;border-radius:2px`;
  document.body.appendChild(_colDragIndicator);
};

document.addEventListener('mousemove', e => {
  if (_colDragIdx === null) return;
  _colDragMoved = true;
  _colDragGhost.style.left = (e.clientX + 10) + 'px';
  _colDragGhost.style.top  = (e.clientY - 16) + 'px';

  /* Trouver l'en-tête cible sous le curseur */
  const th = _colThUnder(e.clientX, e.clientY);
  if (th) {
    const rect = th.getBoundingClientRect();
    const insertBefore = e.clientX < rect.left + rect.width / 2;
    _colDragIndicator.style.display = '';
    _colDragIndicator.style.left = (insertBefore ? rect.left : rect.right) - 1 + 'px';
    document.querySelectorAll('.th-col').forEach(t => t.classList.remove('col-drag-over-left','col-drag-over-right'));
    th.classList.add(insertBefore ? 'col-drag-over-left' : 'col-drag-over-right');
  } else {
    _colDragIndicator.style.display = 'none';
    document.querySelectorAll('.th-col').forEach(t => t.classList.remove('col-drag-over-left','col-drag-over-right'));
  }
}, true);

document.addEventListener('mouseup', e => {
  if (_colDragIdx === null) return;
  _colDragGhost?.remove(); _colDragGhost = null;
  _colDragIndicator?.remove(); _colDragIndicator = null;
  document.querySelectorAll('.th-col').forEach(t => t.classList.remove('col-drag-over-left','col-drag-over-right'));

  if (_colDragMoved) {
    const th = _colThUnder(e.clientX, e.clientY);
    if (th) {
      const toIdx   = +th.dataset.ci;
      if (toIdx !== _colDragIdx) {
        const rect       = th.getBoundingClientRect();
        const insertBefore = e.clientX < rect.left + rect.width / 2;
        const [moved]    = colonnes.splice(_colDragIdx, 1);
        const newTo      = colonnes.indexOf(colonnes.find((_, i) => {
          /* recalcule l'index après suppression */
          const origIdx = _colDragIdx <= toIdx ? toIdx - 1 : toIdx;
          return i === (insertBefore ? origIdx : origIdx + 1) - (_colDragIdx < toIdx ? 0 : 0);
        }));
        /* Calcul simple : reconstruire l'index cible après splice */
        let dest = toIdx > _colDragIdx ? toIdx - 1 : toIdx;
        if (!insertBefore) dest++;
        colonnes.splice(Math.max(0, dest), 0, moved);
        renderAll(); saveNow();
      }
    }
    e.stopPropagation(); // empêche le onclick/doSort de se déclencher
  }
  _colDragIdx = null; _colDragMoved = false;
}, true);

function _colThUnder(x, y) {
  const els = document.elementsFromPoint(x, y);
  return els.find(el => el.classList?.contains('th-col') && el.dataset.ci !== undefined) || null;
}
window.doSort = k => {
  if (sortCol===k) sortDir*=-1; else { sortCol=k; sortDir=1; }
  /* Trier les données directement (réordonne projets et sous-tâches) */
  projets.sort(cmpSort);
  for (const p of projets) {
    if (p.soustaches?.length > 1) p.soustaches.sort(cmpSort);
  }
  localStorage.setItem('sort_' + projectId, JSON.stringify({ col: sortCol, dir: sortDir }));
  renderAll(); saveNow();
};
window.toggleCollapse = pid => { collapsed[pid] = !collapsed[pid]; renderAll(); saveNow(); };

/* ══════════════════════════════════════════════════════
   CRUD
══════════════════════════════════════════════════════ */
window.ajouterProjet = () => {
  pushUndo();
  const today = new Date().toISOString().slice(0,10);
  projets.push({
    id: 'id_'+Date.now(), nom: 'Nouvelle opération',
    client: 'Association', debut: today, fin: today,
    tech: techniciens[0]?.nom || '', etat: 'À venir', couleur: null, soustaches: []
  });
  renderAll(); scheduleSave();
};

window.ajouterSoustache = parentId => {
  pushUndo();
  const p = projets.find(x => x.id === parentId); if (!p) return;
  if (!p.soustaches) p.soustaches = [];
  const customVals = {};
  colonnes.filter(c => !COLS_BUILTIN.has(c.key)).forEach(c => { customVals[c.key] = p[c.key] ?? ''; });
  p.soustaches.push({
    id: 'st_'+Date.now(), nom: 'Nouvelle sous-tâche',
    client: p.client, debut: p.debut, fin: p.fin,
    operation: p.operation || '',
    tech: p.tech, etat: 'À venir', ...customVals
  });
  collapsed[parentId] = false;
  renderAll(); scheduleSave();
};

window.supprimerSoustache = (parentId, stId) => {
  pushUndo();
  const p = projets.find(x => x.id === parentId); if (!p) return;
  p.soustaches = p.soustaches.filter(s => s.id !== stId);
  _nettoyerPredecesseurs(stId);
  renderAll(); scheduleSave();
};

window.dupliquerSoustache = (parentId, stId) => {
  pushUndo();
  const p = projets.find(x => x.id === parentId); if (!p) return;
  const src = p.soustaches.find(s => s.id === stId); if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id  = 'st_' + Date.now() + Math.random().toString(36).slice(2);
  copy.nom = src.nom + ' (copie)';
  copy.predecesseurs = [];
  const idx = p.soustaches.findIndex(s => s.id === stId);
  p.soustaches.splice(idx + 1, 0, copy);
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
  pushUndo();
  projets = projets.filter(p => p.id !== id);
  _nettoyerPredecesseurs(id);
  fermerModal(); renderAll(); scheduleSave();
};

function _nettoyerPredecesseurs(deletedId) {
  for (const p of projets) {
    if (p.predecesseurs?.length) p.predecesseurs = p.predecesseurs.filter(x => x !== deletedId);
    for (const s of (p.soustaches || [])) {
      if (s.predecesseurs?.length) s.predecesseurs = s.predecesseurs.filter(x => x !== deletedId);
    }
  }
}

/* ── Helpers date ── */
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(d1, d2) {
  return Math.max(0, Math.round((new Date(d2) - new Date(d1)) / 86400000));
}

/* ── Auto-scheduling : pousse les successeurs en cascade ── */
function propagerDates(taskId, visited = new Set()) {
  if (visited.has(taskId)) return;
  visited.add(taskId);
  const task = getById(taskId); if (!task) return;

  const tousLesItems = [];
  for (const p of projets) {
    tousLesItems.push(p);
    for (const s of (p.soustaches || [])) tousLesItems.push(s);
  }

  for (const succ of tousLesItems) {
    if (!succ.predecesseurs?.includes(taskId)) continue;
    const minDebut = addDays(task.fin, 1);
    if (succ.debut < minDebut) {
      const duree = daysBetween(succ.debut, succ.fin);
      succ.debut = minDebut;
      succ.fin   = addDays(minDebut, duree);
      propagerDates(succ.id, visited);
    }
  }
}

/* ── Déplace les successeurs du même delta (lors d'un drag) ── */
function deplacerSuccesseurs(taskId, deltaIdx, visited = new Set()) {
  if (visited.has(taskId)) return;
  visited.add(taskId);

  const tousLesItems = [];
  for (const p of projets) {
    tousLesItems.push(p);
    for (const s of (p.soustaches || [])) tousLesItems.push(s);
  }

  for (const succ of tousLesItems) {
    if (!succ.predecesseurs?.includes(taskId)) continue;
    const idxD = idxDate(succ.debut), idxF = idxDate(succ.fin);
    const newD = Math.max(0, Math.min(jours.length-1, idxD + deltaIdx));
    const newF = Math.max(0, Math.min(jours.length-1, idxF + deltaIdx));
    succ.debut = dateFromIdx(newD);
    succ.fin   = dateFromIdx(newF);
    deplacerSuccesseurs(succ.id, deltaIdx, visited);
  }
}

/* ── Détection de cycle : peut-on atteindre targetId depuis fromId ? ── */
function peutAtteindre(fromId, targetId, visited = new Set()) {
  if (fromId === targetId) return true;
  if (visited.has(fromId)) return false;
  visited.add(fromId);

  const tousLesItems = [];
  for (const p of projets) {
    tousLesItems.push(p);
    for (const s of (p.soustaches || [])) tousLesItems.push(s);
  }

  for (const t of tousLesItems) {
    if (t.predecesseurs?.includes(fromId)) {
      if (peutAtteindre(t.id, targetId, visited)) return true;
    }
  }
  return false;
}

window.dupliquer = id => {
  pushUndo();
  const src = getById(id); if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = 'id_'+Date.now(); copy.nom = src.nom+' (copie)';
  copy.soustaches = (copy.soustaches||[]).map(s => ({...s, id:'st_'+Date.now()+Math.random().toString(36).slice(2)}));
  const idx = projets.findIndex(x => x.id === id);
  projets.splice(idx+1, 0, copy);
  renderAll(); scheduleSave();
};

/* ── Menu contextuel ligne (bouton ⋮) ── */
window.toggleRowMenu = (e, id, isSub, parentId) => {
  e.stopPropagation();
  const existing = document.querySelector('.row-menu-drop');
  if (existing) { existing.remove(); return; }

  const task    = getById(id);
  const hasPred = task?.predecesseurs?.length > 0;
  const menu    = document.createElement('div');
  menu.className = 'row-menu-drop';

  const _c = `document.querySelector('.row-menu-drop')?.remove()`;
  const items = [];
  if (!isSub) {
    items.push(`<button class="rmenu-item radd" onclick="ajouterSoustache('${id}');${_c}">
      <span class="rmenu-ico">＋</span>Ajouter une sous-tâche</button>`);
  }
  items.push(`<button class="rmenu-item rnote" onclick="ouvrirNotes('${id}');${_c}">
    <span class="rmenu-ico">💬</span>Notes${task?.notes ? ' <span style="width:6px;height:6px;border-radius:50%;background:#0369a1;display:inline-block;margin-left:4px;vertical-align:middle"></span>' : ''}</button>`);
  items.push(`<button class="rmenu-item rdup" onclick="${isSub ? `dupliquerSoustache('${parentId}','${id}')` : `dupliquer('${id}')`};${_c}">
    <span class="rmenu-ico">⧉</span>Dupliquer</button>`);
  items.push(`<button class="rmenu-item rlink${hasPred ? ' active' : ''}" onclick="ouvrirPredecesseurs('${id}');${_c}">
    <span class="rmenu-ico">🔗</span>Prédécesseurs${hasPred ? '&nbsp;<span style="color:#ea580c;font-size:8px;font-weight:700">●</span>' : ''}</button>`);
  items.push(`<div class="rmenu-sep"></div>`);
  items.push(`<button class="rmenu-item rdel" onclick="${isSub ? `supprimerSoustache('${parentId}','${id}')` : `supprimer('${id}')`};${_c}">
    <span class="rmenu-ico">🗑</span>Supprimer</button>`);

  menu.innerHTML = items.join('');
  document.body.appendChild(menu);

  /* Positionnement : à droite du bouton, retombe vers le haut si trop bas */
  const rect = e.currentTarget.getBoundingClientRect();
  const mW   = 185, mH = isSub ? 125 : 160;
  let left   = rect.right - mW;
  let top    = rect.bottom + 3;
  if (left < 4)                          left = rect.left;
  if (top + mH > window.innerHeight - 8) top  = rect.top - mH;
  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';

  setTimeout(() => {
    document.addEventListener('mousedown', function _cm(ev) {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', _cm); }
    });
  }, 10);
};

window.upd = (id, champ, val) => {
  const p = getById(id); if (!p) return;
  p[champ] = val;
  if (p.debut > p.fin) p.fin = p.debut;
  if (champ === 'fin' || champ === 'debut') propagerDates(id);

  /* Propagation aux sous-tâches si c'est une tâche parente */
  const parent = projets.find(x => x.id === id);
  if (parent?.soustaches?.length) {
    /* État "Terminé" → toutes les sous-tâches passent à Terminé */
    if (champ === 'etat' && val === 'Terminé')
      parent.soustaches.forEach(s => { s.etat = 'Terminé'; });
    /* Colonne Opérations → toutes les sous-tâches héritent */
    if (champ === 'operation')
      parent.soustaches.forEach(s => { s.operation = val; });
  }

  renderAll(); scheduleSave();
};

window.scrollAujourdhui = () => {
  const s = document.getElementById('gantt-wrap');
  if (s && todayIdx >= 0) s.scrollLeft = Math.max(0, todayIdx*W - 200);
};

window.scrollMoisEnCours = () => {
  const s = document.getElementById('gantt-wrap');
  if (!s) return;
  const now = new Date();
  const clef = `${ANNEE}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const idx  = idxDate(clef);
  if (idx >= 0) s.scrollLeft = Math.max(0, idx*W - 20);
  else s.scrollLeft = 0;
};

/* ── Notes ── */
window.ouvrirNotes = (id) => {
  const task = getById(id); if (!task) return;
  const ro = userRole !== 'admin';
  ouvrirModal(`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:1.2rem">💬</span>
      <h3 style="margin:0">Notes</h3>
    </div>
    <p style="font-size:.8rem;color:var(--gray-500);margin-bottom:12px;padding-left:2px">${esc(task.nom)}</p>
    <textarea id="notes-ta" rows="6" ${ro?'readonly':''}
      style="width:100%;padding:10px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:.88rem;font-family:inherit;resize:vertical;outline:none;transition:border-color .2s;${ro?'background:var(--gray-50);color:var(--gray-600)':''}"
      onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--gray-200)'"
      placeholder="Saisissez vos notes ici…">${esc(task.notes||'')}</textarea>
    <div class="m-actions">
      <button class="btn" onclick="fermerModal()">${ro?'Fermer':'Annuler'}</button>
      ${ro?'':'<button class="btn btn-primary" onclick="sauverNotes(\''+id+'\')">Enregistrer</button>'}
    </div>`);
  if (!ro) setTimeout(() => { const ta = document.getElementById('notes-ta'); ta?.focus(); ta?.setSelectionRange(ta.value.length, ta.value.length); }, 50);
};

window.sauverNotes = (id) => {
  const task = getById(id); if (!task) return;
  task.notes = document.getElementById('notes-ta')?.value || '';
  fermerModal(); renderAll(); scheduleSave();
  toast(task.notes ? '💬 Note enregistrée' : 'Note supprimée', 'ok');
};

/* ── Dérouler / Replier toutes les sous-tâches ── */
window.toggleCollapseAll = () => {
  const hasSubs = projets.some(p => p.soustaches?.length > 0);
  if (!hasSubs) return;
  const allCollapsed = projets.filter(p => p.soustaches?.length).every(p => collapsed[p.id]);
  projets.forEach(p => { if (p.soustaches?.length) collapsed[p.id] = !allCollapsed; });
  renderAll(); saveNow();
  toast(allCollapsed ? 'Sous-tâches déroulées' : 'Sous-tâches repliées', 'ok');
};

/* ── Statistiques ── */

function _statsColsDisponibles() {
  return [
    { key: 'operation', label: colonnes.find(c=>c.key==='operation')?.label || 'Opérations', color: 'var(--navy)', fixed: true },
    { key: 'etat',      label: 'État',        color: '#64748b', fixed: true },
    { key: 'client',    label: colonnes.find(c=>c.key==='client')?.label || 'Association',   color: '#0ea5e9', fixed: true },
    { key: 'tech',      label: colonnes.find(c=>c.key==='tech')?.label   || 'Attribution',   color: null,     fixed: true },
    ...colonnes.filter(c => !COLS_BUILTIN.has(c.key) && c.visible !== false)
               .map(c => ({ key: c.key, label: c.label, color: '#7c3aed', fixed: false })),
  ];
}

function _statsLoadConfig() {
  try {
    const raw = localStorage.getItem('stats_cols_' + projectId);
    if (raw) return new Set(JSON.parse(raw));
  } catch(e) {}
  /* Par défaut : toutes les colonnes cochées */
  return new Set(_statsColsDisponibles().map(c => c.key));
}

function _statsSaveConfig(keys) {
  try { localStorage.setItem('stats_cols_' + projectId, JSON.stringify([...keys])); } catch(e) {}
}

window.ouvrirStats = () => { _renderStats(_statsLoadConfig()); };

function _renderStats(selectedKeys) {
  const allCols  = _statsColsDisponibles();
  const active   = allCols.filter(c => selectedKeys.has(c.key));

  /* Tâches parentes visibles */
  const allRows = projets.filter(p => matchFiltres(p) || p.soustaches?.some(s => matchFiltres(s)));
  const nbSubs  = allRows.reduce((s, p) => s + (p.soustaches?.length || 0), 0);

  /* Colonne Opérations = colonne native principale pour les stats */
  const primaryCustom = colonnes.find(c => c.key === 'operation');
  const primKey = 'operation';

  /* On ne retient que les tâches ayant une valeur dans la colonne principale */
  const rows = primKey ? allRows.filter(p => p[primKey]) : allRows;

  /* Comptage :
     - Pour la colonne principale elle-même  → nb de tâches par valeur distincte d'opération
     - Pour toutes les autres colonnes       → nb d'opérations DISTINCTES par valeur de groupe
     - Total affiché                         → nb d'opérations distinctes au total
  */
  const counts = {};
  active.forEach(c => counts[c.key] = {});

  if (primKey) {
    /* Pour chaque groupe (association, attribution, état…) on accumule un Set d'opérations */
    const sets = {};
    active.forEach(c => { if (c.key !== primKey) sets[c.key] = {}; });

    rows.forEach(p => {
      const opVal = p[primKey]; // valeur dans la colonne Opérations

      /* Colonne principale : compte le nb de tâches par opération */
      if (counts[primKey] !== undefined)
        counts[primKey][opVal] = (counts[primKey][opVal]||0) + 1;

      /* Autres colonnes : accumule les opérations distinctes par groupe */
      active.forEach(c => {
        if (c.key === primKey) return;
        const grpVal = c.key === 'etat' ? (p.etat || 'À venir') : p[c.key];
        if (!grpVal) return;
        if (!sets[c.key][grpVal]) sets[c.key][grpVal] = new Set();
        sets[c.key][grpVal].add(opVal);
      });
    });

    /* Convertir les Sets en nombre d'opérations distinctes */
    active.forEach(c => {
      if (c.key === primKey) return;
      Object.entries(sets[c.key]).forEach(([grpVal, s]) => {
        counts[c.key][grpVal] = s.size;
      });
    });

  } else {
    /* Pas de colonne perso → comptage simple de tâches */
    rows.forEach(p => {
      active.forEach(c => {
        const val = c.key === 'etat' ? (p.etat || 'À venir') : p[c.key];
        if (!val) return;
        counts[c.key][val] = (counts[c.key][val]||0) + 1;
      });
    });
  }

  /* Total = nb d'opérations distinctes */
  const total = primKey ? new Set(rows.map(p => p[primKey])).size : rows.length;

  const bar = (cnt, col, ref) => {
    const pct = ref ? Math.round(cnt/ref*100) : 0;
    return `<div style="flex:1;height:7px;background:var(--gray-100);border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;transition:width .4s"></div></div>`;
  };
  const statRow = (label, cnt, col, ref) =>
    `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
      <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></span>
      <span style="width:130px;font-size:.8rem;color:var(--gray-700);flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</span>
      ${bar(cnt, col, ref)}
      <span style="font-size:.82rem;font-weight:700;color:var(--gray-700);min-width:24px;text-align:right">${cnt}</span>
      <span style="font-size:.72rem;color:var(--gray-400);min-width:34px;text-align:right">${ref?Math.round(cnt/ref*100):0}%</span>
    </div>`;

  /* ── Configurateur colonnes ── */
  let h = `<h3 style="margin-bottom:10px">📈 Statistiques</h3>`;

  /* Sélecteur de colonnes */
  h += `<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:10px 12px;margin-bottom:12px">
    <div style="font-size:.72rem;font-weight:700;color:var(--gray-400);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Colonnes à analyser</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px" id="stats-col-sel">`;
  allCols.forEach(c => {
    const checked = selectedKeys.has(c.key);
    h += `<label style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1.5px solid ${checked?'var(--blue)':'var(--gray-200)'};background:${checked?'#eff6ff':'white'};cursor:pointer;font-size:.78rem;font-weight:600;color:${checked?'var(--blue)':'var(--gray-500)'};transition:all .15s;user-select:none">
      <input type="checkbox" ${checked?'checked':''} data-key="${c.key}" onchange="statsToggleCol('${c.key}',this.checked)" style="display:none">
      ${esc(c.label)}
    </label>`;
  });
  h += `</div>
    <div style="display:flex;justify-content:flex-end;margin-top:8px;gap:6px">
      <button class="btn" style="font-size:.75rem;padding:4px 10px" onclick="statsToutCocher(true)">Tout</button>
      <button class="btn" style="font-size:.75rem;padding:4px 10px" onclick="statsToutCocher(false)">Aucun</button>
      <button class="btn btn-success" style="font-size:.75rem;padding:4px 10px" onclick="statsSauver()">💾 Sauvegarder</button>
    </div>
  </div>`;

  /* ── Résumé ── */
  h += `<div style="display:flex;gap:8px;margin-bottom:12px">
    <div style="flex:1;background:var(--gray-50);border-radius:8px;padding:8px 12px;text-align:center;border:1px solid var(--gray-200)">
      <div style="font-size:1.3rem;font-weight:700;color:var(--navy)">${total}</div>
      <div style="font-size:.7rem;color:var(--gray-500);margin-top:1px">${primaryCustom ? esc(primaryCustom.label)+' distinctes' : 'Tâches'}</div>
    </div>
    <div style="flex:1;background:var(--gray-50);border-radius:8px;padding:8px 12px;text-align:center;border:1px solid var(--gray-200)">
      <div style="font-size:1.3rem;font-weight:700;color:#0ea5e9">${nbSubs}</div>
      <div style="font-size:.7rem;color:var(--gray-500);margin-top:1px">Sous-tâches</div>
    </div>
    <div style="flex:1;background:var(--gray-50);border-radius:8px;padding:8px 12px;text-align:center;border:1px solid var(--gray-200)">
      <div style="font-size:1.3rem;font-weight:700;color:var(--gray-700)">${total+nbSubs}</div>
      <div style="font-size:.7rem;color:var(--gray-500);margin-top:1px">Total</div>
    </div>
  </div>`;

  /* ── Onglets ── */
  if (active.length === 0) {
    h += `<p style="color:var(--gray-400);font-size:.85rem;text-align:center;padding:16px 0">Sélectionnez au moins une colonne ci-dessus.</p>`;
  } else {
    const firstId = active[0].key;
    h += `<div id="stats-tabs" style="display:flex;gap:0;flex-wrap:wrap;border-bottom:2px solid var(--gray-200);margin-bottom:12px">
      ${active.map(c =>
        `<button onclick="statsTab('${c.key}')" id="stab-${c.key}" style="padding:5px 11px;font-size:.76rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid ${c.key===firstId?'var(--blue)':'transparent'};margin-bottom:-2px;color:${c.key===firstId?'var(--blue)':'var(--gray-500)'};font-family:inherit;white-space:nowrap">${esc(c.label)}</button>`
      ).join('')}
    </div>
    <div id="stats-content">`;

    active.forEach((c, idx) => {
      const entries = Object.entries(counts[c.key]).sort((a,b) => b[1]-a[1]);
      const max = entries[0]?.[1] || 1;
      h += `<div id="sp-${c.key}" style="display:${idx===0?'':'none'}">`;
      if (entries.length) {
        entries.forEach(([val, cnt]) => {
          let col = c.color || 'var(--navy)';
          if (c.key === 'tech') col = getTechColor(val);
          if (c.key === 'etat') col = etatColor(val);
          h += statRow(val, cnt, col, max);
        });
      } else {
        h += `<p style="color:var(--gray-400);font-size:.82rem">Aucune donnée</p>`;
      }
      h += `</div>`;
    });
    h += `</div>`;
  }

  h += `<div class="m-actions"><button class="btn btn-primary" onclick="fermerModal()">Fermer</button></div>`;
  ouvrirModal(h);
}

window.statsTab = (key) => {
  document.querySelectorAll('#stats-tabs button').forEach(btn => {
    const active = btn.id === 'stab-' + key;
    btn.style.borderBottomColor = active ? 'var(--blue)' : 'transparent';
    btn.style.color = active ? 'var(--blue)' : 'var(--gray-500)';
  });
  document.querySelectorAll('#stats-content > div').forEach(pane => {
    pane.style.display = pane.id === 'sp-' + key ? '' : 'none';
  });
};

window.statsToggleCol = (key, checked) => {
  const sel = _statsLoadConfig();
  checked ? sel.add(key) : sel.delete(key);
  _renderStats(sel);
};

window.statsToutCocher = (all) => {
  const sel = all ? new Set(_statsColsDisponibles().map(c => c.key)) : new Set();
  _renderStats(sel);
};

window.statsSauver = () => {
  const sel = new Set();
  document.querySelectorAll('#stats-col-sel input[type=checkbox]').forEach(cb => {
    if (cb.checked) sel.add(cb.dataset.key);
  });
  _statsSaveConfig(sel);
  toast('✓ Configuration des stats sauvegardée', 'ok');
};

/* ══════════════════════════════════════════════════════
   FILTRES
══════════════════════════════════════════════════════ */
let filtreActif = null;

window.ouvrirFiltre = (key, btn) => {
  if (filtreActif === key) { fermerFiltrePanel(); return; }
  fermerFiltrePanel();
  const vals = valeursFiltrables(key);
  const sel  = filtres[key] ? new Set(filtres[key]) : new Set(vals);
  const rect = btn.getBoundingClientRect();
  const allChecked = !filtres[key] || sel.size === vals.length;

  const panel = document.createElement('div');
  panel.id = 'filtre-panel';
  panel.style.cssText = `position:fixed;z-index:99999;background:white;border:1px solid var(--gray-200);border-radius:10px;box-shadow:0 4px 6px -1px rgba(0,0,0,.07),0 10px 32px -4px rgba(0,0,0,.14);padding:10px;min-width:220px;max-height:360px;display:flex;flex-direction:column;font-family:inherit;font-size:11px;top:${rect.bottom+4}px;left:${Math.min(rect.left, window.innerWidth-240)}px`;

  let h = `<input type="text" class="filtre-search" id="f-search" placeholder="🔍 Rechercher…" autocomplete="off">
  <div style="padding-bottom:7px;margin-bottom:5px;border-bottom:1px solid var(--gray-100)">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--gray-900);padding:2px 0">
      <input type="checkbox" id="f-all" ${allChecked?'checked':''} style="cursor:pointer"> Tout sélectionner
    </label></div>
  <div id="f-list" style="overflow-y:auto;max-height:190px;margin-bottom:8px;display:flex;flex-direction:column;gap:1px">`;
  for (const v of vals) {
    const chk = allChecked || sel.has(v);
    let dot = '';
    if (key==='tech') dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getTechColor(v)};flex-shrink:0"></span>`;
    if (key==='etat') dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${etatColor(v)};flex-shrink:0"></span>`;
    h += `<label data-label="${esc(v).toLowerCase()}" style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:3px 2px;border-radius:4px" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
      <input type="checkbox" data-val="${esc(v)}" ${chk?'checked':''} style="cursor:pointer"> ${dot}<span>${esc(v)||'<i style="color:var(--gray-300)">(vide)</i>'}</span>
    </label>`;
  }
  h += `</div>
  <div id="f-noresult" style="display:none;padding:10px 4px;color:var(--gray-400);font-style:italic;text-align:center;font-size:11px">Aucun résultat</div>
  <div style="display:flex;gap:6px;border-top:1px solid var(--gray-100);padding-top:8px">
    <button onclick="appliquerFiltre('${key}')" style="flex:1;padding:6px;background:var(--blue);color:white;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit">Appliquer</button>
    <button onclick="reinitFiltre('${key}')" style="flex:1;padding:6px;background:white;border:1px solid var(--gray-200);border-radius:6px;cursor:pointer;font-size:11px;color:var(--gray-500);font-family:inherit">Effacer</button>
  </div>`;
  panel.innerHTML = h;
  document.body.appendChild(panel);
  filtreActif = key;

  /* Recherche en temps réel */
  const searchEl   = panel.querySelector('#f-search');
  const listEl     = panel.querySelector('#f-list');
  const noResultEl = panel.querySelector('#f-noresult');
  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase().trim();
    let visible = 0;
    listEl.querySelectorAll('label[data-label]').forEach(lbl => {
      const match = !q || lbl.dataset.label.includes(q);
      lbl.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    noResultEl.style.display = visible === 0 ? '' : 'none';
    /* Mettre à jour "Tout sélectionner" selon les items visibles */
    const visibleCbs = [...listEl.querySelectorAll('label[data-label]:not([style*="none"]) [data-val]')];
    panel.querySelector('#f-all').checked = visibleCbs.length > 0 && visibleCbs.every(c => c.checked);
  });
  searchEl.focus();

  panel.querySelector('#f-all').addEventListener('change', function() {
    /* Coche/décoche uniquement les items visibles */
    listEl.querySelectorAll('label[data-label]:not([style*="none"]) [data-val]').forEach(cb => cb.checked = this.checked);
  });
  panel.querySelectorAll('[data-val]').forEach(cb => {
    cb.addEventListener('change', () => {
      const visibleCbs = [...listEl.querySelectorAll('label[data-label]:not([style*="none"]) [data-val]')];
      panel.querySelector('#f-all').checked = visibleCbs.every(c => c.checked);
    });
  });
  setTimeout(() => document.addEventListener('mousedown', fermerFiltreOutside), 50);
};

function _saveFiltres() {
  if (userRole === 'eco') return; // filtre forcé, pas de sauvegarde
  localStorage.setItem('filtres_' + projectId, JSON.stringify(filtres));
}

window._applyRoleFilter = function() {
  filtres = {};
  const techVals = valeursUniques('tech');
  const nonAttrib = v => !v || v.toLowerCase().includes('non') || v.toLowerCase().includes('attrib');

  if (userRole === 'eco') {
    const vals = techVals.filter(v => v.toUpperCase().includes('ECO') || nonAttrib(v));
    if (vals.length) filtres['tech'] = vals;
  } else if (userRole === 'aseptic') {
    const vals = techVals.filter(v => v.toUpperCase().includes('ASEPTIC') || nonAttrib(v));
    if (vals.length) filtres['tech'] = vals;
  }

  /* Forcer la colonne "Début" visible et masquer "Attribution" pour ECO et ASEPTIC */
  const colDebut = colonnes.find(c => c.key === 'debut');
  if (colDebut) colDebut.visible = true;
  const colTech = colonnes.find(c => c.key === 'tech');
  if (colTech) colTech.visible = false;

  renderAll();
};
/* Alias pour compatibilité */
window._applyEcoFilter = window._applyRoleFilter;

window.appliquerFiltre = key => {
  const panel = document.getElementById('filtre-panel'); if (!panel) return;
  const vals      = valeursFiltrables(key);
  const hasSearch = (panel.querySelector('#f-search')?.value.trim().length ?? 0) > 0;

  /* Avec recherche active : seuls les items visibles et cochés comptent.
     Sans recherche : tous les cochés (comportement habituel). */
  const sel = hasSearch
    ? [...panel.querySelectorAll('label[data-label]:not([style*="none"]) [data-val]:checked')].map(cb => cb.dataset.val)
    : [...panel.querySelectorAll('[data-val]:checked')].map(cb => cb.dataset.val);

  filtres[key] = sel.length === vals.length ? null : sel;
  _saveFiltres();
  fermerFiltrePanel(); renderAll();
};
window.reinitFiltre = key => { filtres[key] = null; _saveFiltres(); fermerFiltrePanel(); renderAll(); };
function fermerFiltrePanel() { document.getElementById('filtre-panel')?.remove(); filtreActif = null; document.removeEventListener('mousedown', fermerFiltreOutside); }
function fermerFiltreOutside(e) { const p = document.getElementById('filtre-panel'); if (p && !p.contains(e.target) && !e.target.closest('[data-fbtn]')) fermerFiltrePanel(); }

/* ══════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════ */
window.ouvrirConfigTech = () => {
  let h = `<h3>Attributions &amp; couleurs</h3>`;
  techniciens.forEach((t, i) => {
    h += `<div class="cfg-row" style="flex-wrap:wrap;gap:6px">
      <div id="dot${i}" style="width:11px;height:11px;border-radius:50%;background:${t.couleur};flex-shrink:0;margin-top:2px"></div>
      <input type="text" value="${esc(t.nom)}" style="flex:1;min-width:120px" onchange="updateTechNom(${i},this.value)">
      <button onclick="supprimerTech(${i})" title="Supprimer" style="background:none;border:1px solid #fca5a5;color:#ef4444;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:13px;flex-shrink:0">🗑</button>
      <div style="width:100%;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <div class="color-grid" id="cg${i}" style="flex:1">`;
    for (const c of PALETTES)
      h += `<div class="swatch ${c===t.couleur?'sel':''}" style="background:${c}" data-hex="${c}" onclick="updateTechCoul(${i},'${c}')"></div>`;
    h += `</div>
        <label style="display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--gray-500);flex-shrink:0;cursor:pointer" title="Couleur personnalisée">
          <input type="color" value="${t.couleur}" style="width:26px;height:26px;padding:1px;border:1px solid var(--gray-300);border-radius:5px;cursor:pointer" oninput="updateTechCoul(${i},this.value)">
          Perso
        </label>
      </div>
    </div>`;
  });
  h += `<button class="btn btn-success" style="margin-top:12px" onclick="ajouterTech()">+ Ajouter</button>
    <div class="m-actions"><button class="btn" onclick="fermerModal()">Fermer</button></div>`;
  ouvrirModal(h);
};
window.ajouterTech = () => { techniciens.push({nom:'Nouvelle attribution',couleur:PALETTES[techniciens.length%PALETTES.length]}); ouvrirConfigTech(); saveNow(); };
window.supprimerTech = (i) => {
  const nom = techniciens[i].nom;
  const enUsage = projets.some(p => p.tech===nom || p.soustaches?.some(s=>s.tech===nom));
  if (enUsage && !confirm(`"${nom}" est utilisée dans le planning. Supprimer quand même ?`)) return;
  techniciens.splice(i,1);
  ouvrirConfigTech(); renderAll(); saveNow();
};
window.updateTechNom = (i, val) => { const old = techniciens[i].nom; techniciens[i].nom = val; for (const p of projets) { if(p.tech===old)p.tech=val; p.soustaches?.forEach(s=>{if(s.tech===old)s.tech=val;}); } saveNow(); };
window.updateTechCoul = (i, hex) => { techniciens[i].couleur=hex; document.querySelectorAll(`#cg${i} .swatch`).forEach(s=>s.classList.toggle('sel',s.dataset.hex===hex)); document.getElementById('dot'+i).style.background=hex; renderAll(); saveNow(); };

const COLS_BUILTIN = new Set(['client','nom','operation','debut','fin','tech','etat']);

function _migrateOperationCol() {
  /* Trouve toutes les colonnes personnalisées (clé non native) */
  const customCols = colonnes.filter(c => !['client','nom','operation','debut','fin','tech','etat'].includes(c.key));
  if (!customCols.length) return false;

  let migrated = false;

  for (const oldCol of customCols) {
    const oldKey = oldCol.key;

    /* Copier les valeurs vers "operation" si vide, puis supprimer l'ancienne clé */
    for (const p of projets) {
      if (p[oldKey] !== undefined) {
        if (!p.operation && p[oldKey]) p.operation = p[oldKey];
        delete p[oldKey];
      }
      for (const s of (p.soustaches || [])) {
        if (s[oldKey] !== undefined) {
          if (!s.operation && s[oldKey]) s.operation = s[oldKey];
          delete s[oldKey];
        }
      }
    }

    /* Supprimer l'ancienne colonne de la liste */
    colonnes = colonnes.filter(c => c.key !== oldKey);

    /* Récupérer le label/largeur pour la colonne native si pas encore définie */
    if (!colonnes.find(c => c.key === 'operation')) {
      const idxEtat = colonnes.findIndex(c => c.key === 'etat');
      const pos = idxEtat >= 0 ? idxEtat : colonnes.length;
      colonnes.splice(pos, 0, { key: 'operation', label: oldCol.label, width: oldCol.width || 130, visible: oldCol.visible !== false });
    }

    migrated = true;
  }

  return migrated;
}
window.ouvrirConfigCols = () => {
  let h = `<h3>Colonnes — visibilité &amp; largeur</h3>
    <p style="font-size:.75rem;color:var(--gray-500);margin:-4px 0 8px">Faites glisser ⠿ pour réordonner les colonnes.</p>
    <div id="cols-drag-list">`;
  colonnes.forEach((c, i) => {
    const vis      = c.visible !== false;
    const isNom    = c.key === 'nom';
    const isLocked = isNom || ((userRole === 'eco' || userRole === 'aseptic') && c.key === 'tech');
    const isCustom = !COLS_BUILTIN.has(c.key);
    const lockTitle = isNom ? 'Colonne obligatoire' : isLocked ? 'Non disponible pour ce profil' : '';
    h += `<div class="cfg-row col-drag-row" draggable="true" data-ci="${i}" style="opacity:${vis?1:.45};cursor:default">
      <span class="col-drag-handle" title="Déplacer" style="cursor:grab;color:#cbd5e1;font-size:14px;flex-shrink:0;user-select:none;padding:0 2px">⠿</span>
      <label style="display:flex;align-items:center;gap:6px;cursor:${isLocked?'default':'pointer'};flex-shrink:0" title="${lockTitle}">
        <input type="checkbox" ${vis?'checked':''} ${isLocked?'disabled':''} onchange="toggleColVisible(${i},this.checked)" style="cursor:${isLocked?'default':'pointer'}">
      </label>
      <input type="text" value="${esc(c.label)}" style="flex:1;${!vis?'color:var(--gray-400)':''}" onchange="updateColLabel(${i},this.value)" ${!vis?'disabled':''}>
      <input type="number" value="${c.width}" min="40" max="400" style="width:64px;margin-left:6px" onchange="updateColWidth(${i},this.value)" ${!vis?'disabled':''}>
      <span style="font-size:.75rem;color:var(--gray-500)">px</span>
      ${isLocked && c.key==='tech' ? `<span style="font-size:.7rem;color:#f97316;margin-left:4px">🔒</span>` : ''}
      ${isCustom ? `<button onclick="supprimerCol(${i})" title="Supprimer cette colonne" style="background:none;border:1px solid #fca5a5;color:#ef4444;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:13px;flex-shrink:0;margin-left:4px">🗑</button>` : ''}
    </div>`;
  });
  h += `</div>
    <button class="btn btn-success" style="margin-top:12px" onclick="ajouterColonne()">+ Ajouter une colonne</button>
    <div class="m-actions"><button class="btn" onclick="fermerModal()">Fermer</button></div>`;
  ouvrirModal(h);
  _initColsDrag();
};

function _initColsDrag() {
  const list = document.getElementById('cols-drag-list');
  if (!list) return;
  let dragSrc = null;

  list.querySelectorAll('.col-drag-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.ci);
      setTimeout(() => row.classList.add('col-drag-ghost'), 0);
    });
    row.addEventListener('dragend', () => {
      list.querySelectorAll('.col-drag-row').forEach(r => {
        r.classList.remove('col-drag-ghost', 'col-drag-over');
      });
      dragSrc = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.col-drag-row').forEach(r => r.classList.remove('col-drag-over'));
      if (row !== dragSrc) row.classList.add('col-drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('col-drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const from = +dragSrc.dataset.ci;
      const to   = +row.dataset.ci;
      const moved = colonnes.splice(from, 1)[0];
      colonnes.splice(to, 0, moved);
      renderAll(); saveNow(); ouvrirConfigCols();
    });
  });
}
window.toggleColVisible = (i, val) => {
  if ((userRole === 'eco' || userRole === 'aseptic') && colonnes[i].key === 'tech' && val) {
    toast('La colonne Attribution n\'est pas disponible pour ce profil', 'err');
    ouvrirConfigCols();
    return;
  }
  colonnes[i].visible = val;
  renderAll(); saveNow(); ouvrirConfigCols();
};
window.updateColLabel = (i, val) => { colonnes[i].label = val; saveNow(); };
window.updateColWidth = (i, val) => { colonnes[i].width = Math.max(40, +val||40); renderAll(); saveNow(); };
window.ajouterColonne = () => {
  const key = 'custom_' + Date.now();
  colonnes.push({ key, label: 'Nouvelle colonne', width: 120, visible: true });
  renderAll(); saveNow(); ouvrirConfigCols();
};
window.supprimerCol = (i) => {
  if (!confirm(`Supprimer la colonne "${colonnes[i].label}" ? Les données saisies dans cette colonne seront perdues.`)) return;
  const key = colonnes[i].key;
  colonnes.splice(i, 1);
  for (const p of projets) { delete p[key]; p.soustaches?.forEach(s => delete s[key]); }
  renderAll(); saveNow(); ouvrirConfigCols();
};

/* ══════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════ */
function ouvrirModal(h) { document.getElementById('modal-body').innerHTML = h; document.getElementById('modal').classList.add('show'); }
window.fermerModal = () => { document.getElementById('modal').classList.remove('show'); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { fermerModal(); fermerFiltrePanel(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (userRole === 'admin') { e.preventDefault(); undo(); }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    if (userRole === 'admin') { e.preventDefault(); saveNow(); toast('✓ Sauvegardé', 'ok'); }
  }
});

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
   DRAG LIGNES — réordonnancement souris
══════════════════════════════════════════════════════ */
var rowDragActive = false, rowDragId = null, rowDragParentId = null;

function _getParentId(taskId) {
  for (const p of projets)
    if (p.soustaches?.some(s => s.id === taskId)) return p.id;
  return null;
}

window.startRowDragMouse = (e, id, parentId) => {
  if (userRole !== 'admin') return;
  e.stopPropagation(); e.preventDefault();
  rowDragActive   = true;
  rowDragId       = id;
  rowDragParentId = parentId || null;
  document.body.style.cursor = 'grabbing';
  document.querySelector(`tr[data-rowid="${id}"]`)?.classList.add('row-dragging');
};

/* ══════════════════════════════════════════════════════
   SAVE
══════════════════════════════════════════════════════ */
function getProjectData() {
  return { tasks: projets, techniciens, colonnes, ANNEE, W, ROW_H, collapsed };
}

function scheduleSave() {
  const ind = document.getElementById('save-indicator');
  ind.textContent = 'Modification…'; ind.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

async function saveNow() {
  clearTimeout(saveTimer);
  const ind = document.getElementById('save-indicator');
  ind.textContent = 'Sauvegarde…'; ind.classList.add('show');
  try {
    const res = await fetch(`/api/projects/${projectId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: getProjectData(), user: pseudo })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => res.status);
      ind.textContent = '✗ Erreur sauvegarde'; ind.style.color = '#ef4444';
      console.error('saveNow HTTP error', res.status, txt);
      return;
    }
    ind.style.color = '';
    ind.textContent = '✓ Sauvegardé'; ind.classList.add('show');
    setTimeout(() => ind.classList.remove('show'), 2500);
    ganttSocket.sendFullUpdate(getProjectData());
  } catch(e) {
    ind.textContent = '✗ Réseau KO'; ind.style.color = '#ef4444';
    console.error('saveNow network error', e);
  }
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
    <div class="field" style="margin-top:6px">
      <label>Format papier</label>
      <div style="display:flex;gap:8px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem">
          <input type="radio" name="pdfFmt" id="pdfA4" value="A4" checked> A4 Paysage
          <span style="font-size:.72rem;color:var(--gray-400)">(297×210mm)</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem">
          <input type="radio" name="pdfFmt" id="pdfA3" value="A3"> A3 Paysage
          <span style="font-size:.72rem;color:var(--gray-400)">(420×297mm)</span>
        </label>
      </div>
    </div>
    <div style="font-size:.77rem;color:var(--gray-500);background:var(--gray-50);border-radius:7px;padding:9px 12px;margin-bottom:4px;margin-top:8px">
      Dans la fenêtre d'impression, choisissez <b>« Enregistrer en PDF »</b> et vérifiez que le format correspond.
    </div>
    <div class="m-actions">
      <button class="btn" onclick="fermerModal()">Annuler</button>
      <button class="btn btn-danger" onclick="lancerPDF()">📄 Générer</button>
    </div>`);
};

window.lancerPDF = () => {
  const d   = document.getElementById('pdfD').value;
  const f   = document.getElementById('pdfF').value;
  const fmt = document.querySelector('input[name="pdfFmt"]:checked')?.value || 'A4';
  if (!d||!f||d>f) { toast('Dates invalides', 'err'); return; }
  fermerModal();
  const joursImpr = jours.filter(j => j.clef >= d && j.clef <= f);
  if (!joursImpr.length) { toast('Aucun jour dans cette plage', 'err'); return; }
  const win = _buildPrintWindow(d, f, joursImpr, fmt);
  setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 800);
};

function _buildPrintWindow(d, f, ji, fmt = 'A4') {
  const DWLET = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
  const MNOMS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const ordered = projFiltresTries(), total = ji.length;
  const idxDeb = idxDate(d), idxFin = idxDate(f);
  const vcols  = visibleCols();
  /* A4 paysage ≈ 1070px utiles, A3 paysage ≈ 1540px utiles (après marges) */
  const pageW  = fmt === 'A3' ? 1540 : 1070;

  /* Largeurs optimisées pour l'impression :
     les colonnes ne doivent pas dépasser 38% de la page.
     On réduit proportionnellement si nécessaire, avec des minimums par colonne. */
  const PRINT_MIN = { nom:60, client:45, operation:50, tech:45, etat:28, debut:28, fin:28 };
  const maxColsW  = Math.floor(pageW * 0.38);
  const rawFW     = vcols.reduce((s, c) => s + c.width, 0);
  const colScale  = rawFW > maxColsW ? maxColsW / rawFW : 1;
  const printCols = vcols.map(c => ({
    ...c,
    printW: Math.max(PRINT_MIN[c.key] ?? 30, Math.floor(c.width * colScale))
  }));
  const fW     = printCols.reduce((s, c) => s + c.printW, 0);

  /* WP calculé pour que le Gantt occupe le reste de la page */
  const WP     = Math.max(3, Math.floor((pageW - fW) / total));
  const totalW = fW + total * WP;
  const zoom   = Math.min(1, pageW / totalW);
  /* Index de la colonne "aujourd'hui" dans la plage imprimée */
  const todayPrintIdx = ji.findIndex(j => j.clef === todayStr);

  let mG=[],curM=-1,cnt=0;
  for(const j of ji){if(j.moisIdx!==curM){if(cnt)mG.push({nom:MNOMS[curM],moisIdx:curM,count:cnt});curM=j.moisIdx;cnt=1;}else cnt++;}
  if(cnt)mG.push({nom:MNOMS[curM],moisIdx:curM,count:cnt});
  let sG=[],curS=-1;cnt=0;
  for(const j of ji){if(j.sem!==curS){if(cnt)sG.push({sem:curS,count:cnt});curS=j.sem;cnt=1;}else cnt++;}
  if(cnt)sG.push({sem:curS,count:cnt});

  const css = `*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{background:white;color:#1e293b}table{border-collapse:separate;border-spacing:0;table-layout:fixed}td{overflow:visible;vertical-align:middle;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}thead{display:table-header-group}tr{page-break-inside:avoid;break-inside:avoid}.thf{font-size:7.5px;font-weight:700;text-align:center;color:white!important;background:#1e3a8a!important;border:1px solid rgba(255,255,255,.15);padding:2px 4px;white-space:nowrap;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.cf{font-size:7.5px;color:#374151;background:white!important;border-right:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:1px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:18px}.csf{font-size:7px;color:#0369a1!important;background:#f0f9ff!important;border-left:2px solid #38bdf8;border-right:0.5px solid #e2e8f0;border-bottom:0.5px solid #e2e8f0;padding:1px 3px;height:15px}@media print{@page{size:${fmt} landscape;margin:10mm 8mm 12mm 8mm}}`;

  const win = window.open('','_print','width=1400,height=900');
  let ph = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planning — ${d} / ${f}</title><style>${css}</style></head><body>`;
  ph += `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #1e3a8a">
    <div><div style="font-size:13px;font-weight:700">Planning — Installation</div>
    <div style="font-size:8.5px;color:#64748b;margin-top:2px">Période : ${d.split('-').reverse().join('/')} → ${f.split('-').reverse().join('/')} &nbsp;|&nbsp; ${total} jours &nbsp;|&nbsp; ${ordered.length} opération${ordered.length>1?'s':''}</div></div>
    <div style="font-size:8px;color:#94a3b8">Édité le ${new Date().toLocaleDateString('fr-FR')}</div></div>`;
  ph += `<div style="zoom:${zoom};transform-origin:top left"><table style="width:${totalW}px"><colgroup>`;
  for(const c of printCols) ph+=`<col style="width:${c.printW}px;min-width:${c.printW}px;max-width:${c.printW}px">`;
  for(let i=0;i<total;i++) ph+=`<col style="width:${WP}px;min-width:${WP}px;max-width:${WP}px">`;
  ph+=`</colgroup><thead><tr style="height:13px">`;
  for(const c of printCols) ph+=`<td rowspan="3" class="thf" style="vertical-align:middle;width:${c.printW}px">${esc(c.label)}</td>`;
  for(const mg of mG) ph+=`<td colspan="${mg.count}" style="text-align:center;font-size:7pt;font-weight:700;background:#eef2ff;color:#1e3a8a;border:0.5px solid #c7d2fe;padding:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact">${mg.nom}</td>`;
  ph+=`</tr><tr style="height:9px">`;
  for(const sg of sG) ph+=`<td colspan="${sg.count}" style="text-align:center;font-size:6px;color:#64748b;border:0.5px solid #e2e8f0;background:#fafafa;padding:0">${sg.count*WP>=14?'S'+sg.sem:''}</td>`;
  ph+=`</tr><tr style="height:11px">`;
  for(const j of ji){
    const isToday = j.clef === todayStr;
    const bg = isToday ? '#fef08a' : j.wk ? '#eef2ff' : 'white';
    const fc = isToday ? '#92400e' : j.wk ? '#818cf8' : '#475569';
    const bdr = isToday ? 'border-left:1.5px solid #fbbf24;border-right:1.5px solid #fbbf24;' : '';
    ph+=`<td style="background:${bg};color:${fc};font-size:${WP>=9?6.5:5.5}px;text-align:center;border:0.5px solid #e2e8f0;border-bottom:1px solid #94a3b8;${bdr}padding:0;line-height:1.1;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact">${WP>=8?`<div style="font-size:5px">${DWLET[j.dw]}</div>`:''}<div style="font-weight:${isToday?800:700}">${j.num}</div></td>`;
  }
  ph+=`</tr></thead><tbody>`;
  /* N'imprimer que les tâches dont la période chevauche la plage sélectionnée */
  const chevauchePeriode = t => t.debut <= f && t.fin >= d;
  for(const p of ordered){
    if(!chevauchePeriode(p)) continue;
    ph+=_printRow(p,ji,total,WP,idxDeb,idxFin,false,printCols,todayPrintIdx);
    if(p.soustaches?.length&&!collapsed[p.id])
      for(const s of soustachesTries(p))
        if(chevauchePeriode(s)) ph+=_printRow(s,ji,total,WP,idxDeb,idxFin,true,printCols,todayPrintIdx);
  }
  ph+=`</tbody></table></div><div style="font-size:7px;color:#94a3b8;text-align:right;padding:3px 0;border-top:0.5px solid #e2e8f0;margin-top:3px">Planning — Édité le ${new Date().toLocaleDateString('fr-FR')}</div></body></html>`;
  win.document.write(ph); win.document.close(); return win;
}

function _printRow(p, ji, total, WP, idxDeb, idxFin, isSub, vcols, todayPrintIdx = -1) {
  const col = getTechColor(p.tech), ec = etatColor(p.etat);
  const rowH = isSub?15:19, barTop=isSub?3:4, barH=isSub?9:11;
  let h = `<tr style="height:${rowH}px">`;
  for(let ci=0;ci<vcols.length;ci++){
    const c=vcols[ci],ck=c.key,cls=isSub?'csf':'cf';
    const cw = c.printW ?? c.width;
    h+=`<td class="${cls}" style="width:${cw}px;max-width:${cw}px">`;
    if(ck==='nom'){if(isSub)h+='<span style="color:#38bdf8;margin-right:2px">↳</span>';h+=`<span style="font-weight:${isSub?400:600}">${esc(p.nom)}</span>`;}
    else if(ck==='client')h+=`<span style="color:#64748b">${esc(p.client)}</span>`;
    else if(ck==='debut')h+=`<span>${p.debut.split('-').slice(1).reverse().join('/')}</span>`;
    else if(ck==='fin')  h+=`<span>${p.fin  .split('-').slice(1).reverse().join('/')}</span>`;
    else if(ck==='tech')      h+=`<span style="color:${col};font-weight:600">${esc(p.tech)}</span>`;
    else if(ck==='etat')      h+=`<span style="color:${ec};font-weight:600">${esc(p.etat||'À venir')}</span>`;
    else if(ck==='operation') h+=`<span>${esc(p.operation||'')}</span>`;
    else                      h+=`<span>${esc(p[ck]||'')}</span>`;
    h+='</td>';
  }
  h+=`<td colspan="${total}" style="position:relative;padding:0;height:${rowH}px;border-bottom:0.5px solid #e2e8f0;overflow:visible;background:white">`;
  let gOff=0;
  for(const j of ji){
    const isToday = j.clef === todayStr;
    const bg = isToday ? 'rgba(254,240,138,.55)' : j.wk ? '#eef2ff' : 'white';
    const bdr = isToday ? 'border-left:1.5px solid #fbbf24;border-right:1.5px solid #fbbf24;' : '';
    h+=`<div style="position:absolute;top:0;bottom:0;left:${gOff*WP}px;width:${WP}px;background:${bg};${bdr}-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>`;
    gOff++;
  }
  const pD=idxDate(p.debut),pF=idxDate(p.fin);
  const bSR=Math.max(0,pD-idxDeb),bER=Math.min(total-1,pF-idxDeb);
  if(bSR<=bER&&pF>=idxDeb&&pD<=idxFin){
    const bL=bSR*WP,bW=(bER-bSR+1)*WP;
    const parts=p.debut.split('-'), lblDate=parts[2]+'/'+parts[1];
    /* Date avant la barre */
    if(bL>2) h+=`<div style="position:absolute;top:50%;transform:translateY(-50%);right:calc(100% - ${bL}px + 2px);font-size:${isSub?5:6}px;font-weight:700;color:#64748b;white-space:nowrap;z-index:4">${lblDate}</div>`;
    h+=`<div style="position:absolute;top:${barTop}px;left:${bL}px;height:${barH}px;width:${bW}px;background:${col};border-radius:${isSub?2:3}px;z-index:3;opacity:${isSub?.82:1}">
      <div style="position:absolute;top:0;left:0;right:0;height:40%;background:rgba(255,255,255,.2);border-radius:inherit"></div></div>`;
    h+=`<div style="position:absolute;top:0;left:${bL+bW+3}px;bottom:0;display:flex;align-items:center;z-index:4">
      <span style="font-size:${isSub?5.5:6.5}px;color:#374151;white-space:nowrap;font-weight:${isSub?400:500}">${isSub?'↳ ':''}${esc(p.nom)}</span></div>`;
  }
  h+=`</td></tr>`;
  return h;
}

/* ══════════════════════════════════════════════════════
   PRÉDÉCESSEURS
══════════════════════════════════════════════════════ */
window.ouvrirPredecesseurs = (id) => {
  const task = getById(id); if (!task) return;
  const current = new Set(task.predecesseurs || []);

  const options = [];
  for (const p of projets) {
    if (p.id !== id) options.push({ id: p.id, label: p.nom, indent: false });
    for (const s of (p.soustaches || [])) {
      if (s.id !== id) options.push({ id: s.id, label: s.nom, indent: true, parent: p.nom });
    }
  }

  let h = `<h3 style="margin-bottom:8px">🔗 Prédécesseurs</h3>
  <p style="font-size:.8rem;color:var(--gray-500);margin-bottom:12px">Tâche : <strong>${esc(task.nom)}</strong></p>
  <p style="font-size:.75rem;color:var(--gray-500);margin-bottom:10px">Les tâches sélectionnées doivent se terminer avant que cette tâche puisse commencer (lien Fin→Début).</p>
  <div style="max-height:300px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:8px;padding:8px">`;

  if (!options.length) {
    h += `<div style="color:var(--gray-400);font-size:.85rem;text-align:center;padding:16px">Aucune autre tâche disponible</div>`;
  } else {
    for (const opt of options) {
      const checked = current.has(opt.id);
      h += `<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:4px;cursor:pointer;font-size:.83rem" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
        <input type="checkbox" data-predid="${esc(opt.id)}" ${checked ? 'checked' : ''}>
        ${opt.indent ? `<span style="color:#38bdf8;margin-left:8px;font-size:11px">↳</span>` : `<span style="width:8px;height:8px;border-radius:50%;background:${getColor(getById(opt.id))};flex-shrink:0;display:inline-block"></span>`}
        <span style="${opt.indent ? 'color:#0369a1' : 'font-weight:500'}">${esc(opt.label)}</span>
        ${opt.parent ? `<span style="font-size:.7rem;color:var(--gray-400)">(${esc(opt.parent)})</span>` : ''}
      </label>`;
    }
  }

  h += `</div>
  <div class="m-actions">
    <button class="btn" onclick="fermerModal()">Annuler</button>
    <button class="btn btn-primary" onclick="sauverPredecesseurs('${id}')">Enregistrer</button>
  </div>`;

  ouvrirModal(h);
};

window.sauverPredecesseurs = (id) => {
  const task = getById(id); if (!task) return;
  const newPreds = [...document.querySelectorAll('[data-predid]:checked')].map(cb => cb.dataset.predid);

  const cycleNoms = newPreds
    .filter(predId => peutAtteindre(id, predId))
    .map(predId => getById(predId)?.nom || predId);

  if (cycleNoms.length) {
    toast(`Cycle détecté — impossible : "${cycleNoms.join(', ')}"`, 'err');
    return;
  }

  task.predecesseurs = newPreds;
  fermerModal();
  propagerDates(id);
  renderAll();
  scheduleSave();
};

/* ── Flèches de dépendance SVG ── */
var showArrows = true;

window.toggleArrows = () => {
  showArrows = !showArrows;
  const btn = document.getElementById('btn-toggle-arrows');
  if (btn) {
    btn.style.opacity    = showArrows ? '' : '.45';
    btn.style.textDecoration = showArrows ? '' : 'line-through';
  }
  const svg = document.querySelector('.dep-arrows-svg');
  if (svg) svg.style.display = showArrows ? '' : 'none';
  if (showArrows) drawDependencyArrows();
};

function drawDependencyArrows() {
  const inner = document.getElementById('gantt-inner');
  if (!inner) return;
  inner.querySelector('.dep-arrows-svg')?.remove();
  if (!showArrows) return;

  const allRows = rowsForRender().map(r => r.task);

  const hasDeps = allRows.some(t => t.predecesseurs?.length > 0);
  if (!hasDeps) return;

  const tableEl = inner.querySelector('table');
  if (!tableEl) return;

  const fw        = frozenW();
  const svgW      = tableEl.offsetWidth - fw;
  const svgH      = tableEl.offsetHeight;
  const innerRect = inner.getBoundingClientRect();
  const arrows    = [];

  for (const succ of allRows) {
    if (!succ.predecesseurs?.length) continue;

    /* Position réelle de la barre successeur (via DOM) */
    const succBwEl  = document.getElementById('bw_' + succ.id);
    const succBarEl = document.getElementById('bc_' + succ.id);
    if (!succBwEl || succBwEl.style.display === 'none' || !succBarEl) continue;
    const succRowEl = inner.querySelector(`tr[data-rowid="${succ.id}"]`);
    if (!succRowEl) continue;

    const succRowRect = succRowEl.getBoundingClientRect();
    const succBarRect = succBarEl.getBoundingClientRect();
    const succY = succRowRect.top - innerRect.top + succRowRect.height / 2;
    const succXLeft  = succBarRect.left  - innerRect.left - fw; // bord gauche barre succ

    for (const predId of succ.predecesseurs) {
      const pred = getById(predId);
      if (!pred) continue;

      /* Position réelle de la barre prédécesseur (via DOM) */
      const predBwEl  = document.getElementById('bw_' + predId);
      const predBarEl = document.getElementById('bc_' + predId);
      if (!predBwEl || predBwEl.style.display === 'none' || !predBarEl) continue;
      const predRowEl = inner.querySelector(`tr[data-rowid="${predId}"]`);
      if (!predRowEl) continue;

      const predRowRect = predRowEl.getBoundingClientRect();
      const predBarRect = predBarEl.getBoundingClientRect();
      const predY = predRowRect.top - innerRect.top + predRowRect.height / 2;

      /* Fin→Début (par défaut) ou Début→Début (mêmes dates de début) */
      const isS2S  = pred.debut === succ.debut;
      const predX  = isS2S
        ? predBarRect.left  - innerRect.left - fw   // bord gauche pred
        : predBarRect.right - innerRect.left - fw;  // bord droit pred
      const succX  = isS2S ? predX : succXLeft;

      arrows.push({ predX, predY, succX, succY, isS2S });
    }
  }

  if (!arrows.length) return;

  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('dep-arrows-svg');
  svg.setAttribute('width',  svgW);
  svg.setAttribute('height', svgH);
  /* z-index:8 = sous les cellules sticky (z-index:10) pour ne jamais les chevaucher */
  svg.style.cssText = `position:absolute;top:0;left:${fw}px;pointer-events:none;z-index:8;overflow:hidden`;

  const defs = document.createElementNS(NS, 'defs');

  /* Tête de flèche orange (Fin→Début) */
  const mkFS = document.createElementNS(NS, 'marker');
  mkFS.setAttribute('id', 'arr-fs'); mkFS.setAttribute('markerWidth','7');
  mkFS.setAttribute('markerHeight','5'); mkFS.setAttribute('refX','6');
  mkFS.setAttribute('refY','2.5'); mkFS.setAttribute('orient','auto');
  const pFS = document.createElementNS(NS, 'polygon');
  pFS.setAttribute('points','0 0, 7 2.5, 0 5'); pFS.setAttribute('fill','#f97316');
  mkFS.appendChild(pFS); defs.appendChild(mkFS);

  /* Tête de flèche bleue (Début→Début) */
  const mkSS = document.createElementNS(NS, 'marker');
  mkSS.setAttribute('id', 'arr-ss'); mkSS.setAttribute('markerWidth','7');
  mkSS.setAttribute('markerHeight','5'); mkSS.setAttribute('refX','6');
  mkSS.setAttribute('refY','2.5'); mkSS.setAttribute('orient','auto');
  const pSS = document.createElementNS(NS, 'polygon');
  pSS.setAttribute('points','0 0, 7 2.5, 0 5'); pSS.setAttribute('fill','#3b82f6');
  mkSS.appendChild(pSS); defs.appendChild(mkSS);

  /* ClipPath — mis à jour dynamiquement au scroll pour masquer la zone des colonnes fixes */
  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', 'gantt-area-clip');
  const clipR = document.createElementNS(NS, 'rect');
  clipR.setAttribute('y',0); clipR.setAttribute('height',svgH);
  clip.appendChild(clipR); defs.appendChild(clip);
  svg.appendChild(defs);

  /* Initialise et met à jour le clip selon le scroll horizontal */
  const wrap = document.getElementById('gantt-wrap');
  function _updateClip() {
    const s = wrap ? wrap.scrollLeft : 0;
    clipR.setAttribute('x', s);
    clipR.setAttribute('width', Math.max(0, svgW - s));
  }
  _updateClip();
  if (wrap) {
    wrap.removeEventListener('scroll', wrap._arrowClipHandler || null);
    wrap._arrowClipHandler = _updateClip;
    wrap.addEventListener('scroll', _updateClip, { passive: true });
  }

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('clip-path', 'url(#gantt-area-clip)');

  for (const { predX, predY, succX, succY, isS2S } of arrows) {
    const color  = isS2S ? '#3b82f6' : '#f97316';
    const marker = isS2S ? 'url(#arr-ss)' : 'url(#arr-fs)';

    let d;
    if (isS2S) {
      /* Début→Début : agraphe à gauche des barres */
      const lx = predX - 10;
      d = `M${predX},${predY} L${lx},${predY} L${lx},${succY} L${succX},${succY}`;
    } else {
      /* Fin→Début : courbe de Bézier */
      const dx  = succX - predX;
      const cx1 = predX + Math.max(20, Math.abs(dx) * 0.45);
      const cx2 = succX - Math.max(20, Math.abs(dx) * 0.45);
      d = `M${predX},${predY} C${cx1},${predY} ${cx2},${succY} ${succX},${succY}`;
    }

    const shadow = document.createElementNS(NS, 'path');
    shadow.setAttribute('d', d);
    shadow.setAttribute('stroke', 'rgba(0,0,0,0.10)');
    shadow.setAttribute('stroke-width', '3.5');
    shadow.setAttribute('fill', 'none');
    g.appendChild(shadow);

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('fill', 'none');
    if (!isS2S) path.setAttribute('stroke-dasharray', '5,3');
    path.setAttribute('marker-end', marker);
    g.appendChild(path);
  }

  svg.appendChild(g);
  inner.style.position = 'relative';
  inner.appendChild(svg);
}

/* ══════════════════════════════════════════════════════
   EXPORT EXCEL
══════════════════════════════════════════════════════ */
window.ouvrirExportExcel = () => {
  const dDef = ANNEE+'-01-01', fDef = ANNEE+'-12-31';
  ouvrirModal(`
    <h3>📊 Export Excel</h3>
    <p style="font-size:.83rem;color:var(--gray-500);margin-bottom:14px">Sélectionnez la plage de dates à exporter.</p>
    <div class="field"><label>Date de début</label><input type="date" id="xlD" value="${dDef}"></div>
    <div class="field"><label>Date de fin</label><input type="date" id="xlF" value="${fDef}"></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
      ${[['T1','-01-01','-03-31'],['T2','-04-01','-06-30'],['T3','-07-01','-09-30'],['T4','-10-01','-12-31'],['Année','-01-01','-12-31']]
        .map(([l,d,f]) => `<button class="btn" onclick="document.getElementById('xlD').value='${ANNEE+d}';document.getElementById('xlF').value='${ANNEE+f}'">${l}</button>`).join('')}
    </div>
    <div style="font-size:.77rem;color:var(--gray-500);background:var(--gray-50);border-radius:7px;padding:9px 12px;margin-bottom:4px">
      Le fichier s'ouvre directement dans <b>Excel</b> avec les barres colorées.
    </div>
    <div class="m-actions">
      <button class="btn" onclick="fermerModal()">Annuler</button>
      <button class="btn" style="background:#16a34a;color:white" onclick="lancerExcel()">📊 Générer</button>
    </div>`);
};

window.lancerExcel = () => {
  const d = document.getElementById('xlD').value;
  const f = document.getElementById('xlF').value;
  if (!d || !f || d > f) { toast('Dates invalides', 'err'); return; }
  fermerModal();
  const ji = jours.filter(j => j.clef >= d && j.clef <= f);
  if (!ji.length) { toast('Aucun jour dans cette plage', 'err'); return; }
  _buildExcelFile(d, f, ji);
};

function _buildExcelFile(d, f, ji) {
  const DWLET = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
  const MNOMS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const ordered = projFiltresTries();
  const vcols   = visibleCols();
  const idxDeb  = idxDate(d);
  const idxFin  = idxDate(f);
  const total   = ji.length;

  /* Groupes mois */
  let mG = [], curM = -1, cnt = 0;
  for (const j of ji) {
    if (j.moisIdx !== curM) { if (cnt) mG.push({ nom: MNOMS[curM], count: cnt }); curM = j.moisIdx; cnt = 1; } else cnt++;
  }
  if (cnt) mG.push({ nom: MNOMS[curM], count: cnt });

  const css = `
    table{border-collapse:collapse;font-family:Calibri,Arial;font-size:8pt}
    td{border:0.5px solid #e2e8f0;vertical-align:middle;padding:1px 3px;white-space:nowrap}
    .thf{background:#1e3a8a;color:white;font-weight:700;text-align:center;font-size:7.5pt}
    .wk{background:#eef2ff}
    .tod{background:#fef9c3}
  `;

  let h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>${css}</style></head><body>
<div style="font-family:Calibri;margin-bottom:6px">
  <b style="font-size:13pt">Planning — Export</b><br>
  <span style="font-size:8pt;color:#64748b">Période : ${d.split('-').reverse().join('/')} → ${f.split('-').reverse().join('/')} | ${total} jours | ${ordered.length} opération${ordered.length>1?'s':''} | Édité le ${new Date().toLocaleDateString('fr-FR')}</span>
</div>
<table><colgroup>`;

  for (const c of vcols) h += `<col style="width:${Math.round(c.width*0.75)}pt">`;
  for (let i = 0; i < total; i++) h += `<col style="width:${total<=62?9:7}pt">`;
  h += `</colgroup><thead>`;

  /* Ligne mois */
  h += `<tr style="height:14pt">`;
  for (const c of vcols) h += `<td rowspan="3" class="thf" style="width:${c.width}px">${esc(c.label)}</td>`;
  for (const mg of mG) h += `<td colspan="${mg.count}" class="thf" style="background:#1e3a8a!important">${mg.nom}</td>`;
  h += `</tr>`;

  /* Ligne numéros */
  h += `<tr style="height:12pt">`;
  for (const j of ji) {
    const isTod = j.clef === todayStr;
    const bg = isTod ? '#fef9c3' : j.wk ? '#c7d2fe' : '#2d4fa0';
    const fc = isTod ? '#92400e' : 'white';
    h += `<td style="background:${bg};color:${fc};font-weight:700;text-align:center;font-size:7pt">${j.num}</td>`;
  }
  h += `</tr>`;

  /* Ligne noms jours */
  h += `<tr style="height:10pt">`;
  for (const j of ji) {
    const bg = j.clef===todayStr ? '#fef3c7' : j.wk ? '#eef2ff' : '#dbeafe';
    h += `<td style="background:${bg};text-align:center;font-size:6pt;color:#475569">${DWLET[j.dw]}</td>`;
  }
  h += `</tr></thead><tbody>`;

  for (const p of ordered) {
    h += _excelRow(p, ji, vcols, idxDeb, idxFin, false);
    if (p.soustaches?.length && !collapsed[p.id])
      for (const s of soustachesTries(p)) h += _excelRow(s, ji, vcols, idxDeb, idxFin, true);
  }

  h += `</tbody></table></body></html>`;

  const blob = new Blob(['﻿' + h], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `planning-${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Export Excel généré', 'ok');
}

function _excelRow(p, ji, vcols, idxDeb, idxFin, isSub) {
  const col   = getColor(p);
  const colL  = hexRgba(col, 0.18);
  const ec    = etatColor(p.etat);
  const rowBg = isSub ? '#f0f9ff' : 'white';
  const rowH  = isSub ? '12pt' : '15pt';
  const bL    = isSub ? 'border-left:3px solid #38bdf8;' : '';
  const pD    = idxDate(p.debut), pF = idxDate(p.fin);

  let h = `<tr style="height:${rowH}">`;

  for (const c of vcols) {
    const ck = c.key;
    let val = '', st = `background:${rowBg};${bL}`;
    if (ck === 'nom') {
      val = (isSub ? '↳ ' : '') + esc(p.nom);
      st += isSub ? 'color:#0369a1;padding-left:10px;' : 'font-weight:600;';
    }
    else if (ck === 'client') val = esc(p.client);
    else if (ck === 'debut')  val = p.debut.split('-').slice(1).reverse().join('/');
    else if (ck === 'fin')    val = p.fin.split('-').slice(1).reverse().join('/');
    else if (ck === 'tech')   { val = esc(p.tech);           st += `color:${col};font-weight:600;`; }
    else if (ck === 'etat')   { val = esc(p.etat||'À venir'); st += `color:${ec};font-weight:600;`; }
    h += `<td style="${st}">${val}</td>`;
  }

  /* Trouver l'index de la cellule juste avant et juste après la barre */
  let lastBeforeIdx = -1, firstAfterIdx = -1;
  for (let i = 0; i < ji.length; i++) {
    const gi = idxDate(ji[i].clef);
    if (gi < pD) lastBeforeIdx = i;
    if (gi > pF && firstAfterIdx === -1) firstAfterIdx = i;
  }
  const lblDate = p.debut.split('-').slice(1).reverse().join('/'); // DD/MM

  /* Cellules jours */
  for (let i = 0; i < ji.length; i++) {
    const j  = ji[i];
    const gi = idxDate(j.clef);
    const inBar = gi >= pD && gi <= pF;

    let bg, content = '', align = 'left', txtSt = '';

    if (inBar)                   bg = isSub ? hexRgba(col, 0.65) : col;
    else if (j.clef===todayStr)  bg = '#fef9c3';
    else if (j.wk)               bg = '#eef2ff';
    else                         bg = 'white';

    /* Date à gauche de la barre */
    if (i === lastBeforeIdx) {
      content = lblDate;
      align   = 'right';
      txtSt   = 'font-size:6pt;color:#64748b;font-weight:600;';
    }
    /* Nom à droite de la barre */
    if (i === firstAfterIdx) {
      content = esc(p.nom);
      align   = 'left';
      txtSt   = `font-size:6.5pt;color:#374151;font-weight:${isSub?400:500};`;
    }

    h += `<td style="background:${bg};text-align:${align};${txtSt}overflow:visible;white-space:nowrap">${content}</td>`;
  }

  h += `</tr>`;
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
