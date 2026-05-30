const fs   = require('fs');
const path = require('path');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const PROJECTS_FILE = path.join(DB_DIR, 'projects.json');
const HISTORY_DIR   = path.join(DB_DIR, 'history');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

/* ── Liste des projets (métadonnées) ── */
function listProjects() {
  return readJSON(PROJECTS_FILE, []);
}

function getProjectMeta(id) {
  return listProjects().find(p => p.id === id) || null;
}

function saveMeta(projects) {
  writeJSON(PROJECTS_FILE, projects);
}

/* ── Données d'un projet ── */
function getProjectData(id) {
  const file = path.join(DB_DIR, `project_${id}.json`);
  return readJSON(file, null);
}

function saveProjectData(id, data) {
  const file = path.join(DB_DIR, `project_${id}.json`);
  writeJSON(file, data);
}

/* ── CRUD projets ── */
function createProject(id, name) {
  const projects = listProjects();
  const now = Date.now();
  projects.push({ id, name, created_at: now, updated_at: now });
  saveMeta(projects);
}

function renameProject(id, name) {
  const projects = listProjects();
  const p = projects.find(x => x.id === id);
  if (p) { p.name = name; p.updated_at = Date.now(); }
  saveMeta(projects);
}

function deleteProject(id) {
  let projects = listProjects();
  projects = projects.filter(p => p.id !== id);
  saveMeta(projects);
  const file = path.join(DB_DIR, `project_${id}.json`);
  const hfile = path.join(HISTORY_DIR, `history_${id}.json`);
  if (fs.existsSync(file))  fs.unlinkSync(file);
  if (fs.existsSync(hfile)) fs.unlinkSync(hfile);
}

/* ── Sauvegarde + historique ── */
function saveProject(id, name, data, user) {
  const now = Date.now();

  /* Métadonnées */
  const projects = listProjects();
  const meta = projects.find(p => p.id === id);
  if (meta) { meta.name = name; meta.updated_at = now; saveMeta(projects); }

  /* Données */
  saveProjectData(id, data);

  /* Historique (10 dernières versions) */
  const hfile = path.join(HISTORY_DIR, `history_${id}.json`);
  const history = readJSON(hfile, []);
  history.unshift({ id: now, saved_by: user || 'système', saved_at: now, data });
  writeJSON(hfile, history.slice(0, 10));
}

function getHistory(id) {
  const hfile = path.join(HISTORY_DIR, `history_${id}.json`);
  return readJSON(hfile, []).map(({ id, saved_by, saved_at }) => ({ id, saved_by, saved_at }));
}

function getHistoryVersion(projectId, historyId) {
  const hfile = path.join(HISTORY_DIR, `history_${projectId}.json`);
  return readJSON(hfile, []).find(h => String(h.id) === String(historyId)) || null;
}

module.exports = {
  listProjects, getProjectMeta, getProjectData,
  createProject, renameProject, deleteProject,
  saveProject, getHistory, getHistoryVersion,
  saveMeta
};
