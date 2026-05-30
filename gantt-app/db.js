/* ══════════════════════════════════════════
   db.js — Stockage via Supabase (gratuit, persistant)
   Table: kv_store (key TEXT PRIMARY KEY, value TEXT, updated_at BIGINT)
══════════════════════════════════════════ */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

/* ── Helpers REST Supabase ── */
async function kvGet(key) {
  if (!SUPABASE_URL) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return JSON.parse(rows[0].value);
  } catch(e) {
    console.error('kvGet error', key, e.message);
    return null;
  }
}

async function kvSet(key, value) {
  if (!SUPABASE_URL) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key, value: JSON.stringify(value), updated_at: Date.now() })
    });
  } catch(e) {
    console.error('kvSet error', key, e.message);
  }
}

async function kvDel(key) {
  if (!SUPABASE_URL) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }
    );
  } catch(e) {
    console.error('kvDel error', key, e.message);
  }
}

/* ── Liste des projets ── */
async function listProjects()         { return (await kvGet('projects')) || []; }
async function saveMeta(projects)     { await kvSet('projects', projects); }

async function getProjectMeta(id) {
  const projects = await listProjects();
  return projects.find(p => p.id === id) || null;
}

/* ── Données d'un projet ── */
async function getProjectData(id)     { return kvGet('project:' + id); }
async function saveProjectData(id, d) { await kvSet('project:' + id, d); }

/* ── CRUD projets ── */
async function createProject(id, name) {
  const projects = await listProjects();
  const now = Date.now();
  projects.push({ id, name, created_at: now, updated_at: now });
  await saveMeta(projects);
}

async function renameProject(id, name) {
  const projects = await listProjects();
  const p = projects.find(x => x.id === id);
  if (p) { p.name = name; p.updated_at = Date.now(); }
  await saveMeta(projects);
}

async function deleteProject(id) {
  let projects = await listProjects();
  projects = projects.filter(p => p.id !== id);
  await saveMeta(projects);
  await kvDel('project:' + id);
  await kvDel('history:' + id);
}

/* ── Sauvegarde + historique ── */
async function saveProject(id, name, data, user) {
  const now = Date.now();

  /* Métadonnées */
  const projects = await listProjects();
  const meta = projects.find(p => p.id === id);
  if (meta) { meta.name = name; meta.updated_at = now; await saveMeta(projects); }

  /* Données */
  await saveProjectData(id, data);

  /* Historique (10 dernières versions) */
  const history = (await kvGet('history:' + id)) || [];
  history.unshift({ id: now, saved_by: user || 'système', saved_at: now, data });
  await kvSet('history:' + id, history.slice(0, 10));
}

async function getHistory(id) {
  const h = (await kvGet('history:' + id)) || [];
  return h.map(({ id, saved_by, saved_at }) => ({ id, saved_by, saved_at }));
}

async function getHistoryVersion(projectId, historyId) {
  const h = (await kvGet('history:' + projectId)) || [];
  return h.find(x => String(x.id) === String(historyId)) || null;
}

module.exports = {
  listProjects, getProjectMeta, getProjectData,
  createProject, renameProject, deleteProject,
  saveProject, getHistory, getHistoryVersion,
  saveMeta
};
