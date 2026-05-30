const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const db      = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── Projet par défaut ── */
function defaultData() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    tasks: [
      {
        id: uuidv4(), nom: 'Opération exemple', client: 'Association',
        debut: today, fin: today, tech: 'Aseptic',
        etat: 'À venir', couleur: null, soustaches: []
      }
    ],
    techniciens: [
      { nom: 'Aseptic',           couleur: '#ec4899' },
      { nom: 'Mise en service',   couleur: '#10b981' },
      { nom: 'Prélèvement',       couleur: '#0ea5e9' },
      { nom: 'Livraison osmoseur',couleur: '#8b5cf6' },
      { nom: 'Résultat',          couleur: '#ef4444' },
    ],
    colonnes: [
      { key: 'client', label: 'Association', width: 110 },
      { key: 'nom',    label: 'Opération',   width: 360 },
      { key: 'debut',  label: 'Début',       width: 92  },
      { key: 'fin',    label: 'Fin',         width: 92  },
      { key: 'tech',   label: 'Attribution', width: 130 },
      { key: 'etat',   label: 'État',        width: 90  },
    ]
  };
}

async function ensureDefaultProject() {
  const projects = await db.listProjects();
  if (projects.length === 0) {
    const id = 'default';
    await db.createProject(id, 'Mon Planning');
    await db.saveProject(id, 'Mon Planning', defaultData(), 'système');
  } else {
    for (const p of projects) {
      if (!await db.getProjectData(p.id)) {
        await db.saveProject(p.id, p.name, defaultData(), 'système');
      }
    }
  }
}

/* ══════════════════════════════════════════
   API — liste des plannings
══════════════════════════════════════════ */
app.get('/api/projects', async (req, res) => {
  res.json(await db.listProjects());
});

app.post('/api/projects', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = 'proj_' + Date.now();
  await db.createProject(id, name);
  await db.saveProject(id, name, defaultData(), req.body.user || 'système');
  res.json({ id, name });
});

app.post('/api/projects/:id/duplicate', async (req, res) => {
  const { name, user } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const srcMeta = await db.getProjectMeta(req.params.id);
  if (!srcMeta) return res.status(404).json({ error: 'Not found' });
  const srcData = (await db.getProjectData(req.params.id)) || defaultData();
  const copy = JSON.parse(JSON.stringify(srcData));
  copy.tasks = (copy.tasks || []).map(t => ({
    ...t,
    id: 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    soustaches: (t.soustaches || []).map(s => ({
      ...s,
      id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    }))
  }));
  const newId = 'proj_' + Date.now();
  await db.createProject(newId, name);
  await db.saveProject(newId, name, copy, user || 'système');
  res.json({ id: newId, name });
});

app.delete('/api/projects/:id', async (req, res) => {
  const projects = await db.listProjects();
  if (projects.length <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier planning' });
  await db.deleteProject(req.params.id);
  res.json({ ok: true });
});

app.post('/api/projects/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  const projects = await db.listProjects();
  const reordered = ids.map(id => projects.find(p => p.id === id)).filter(Boolean);
  projects.forEach(p => { if (!ids.includes(p.id)) reordered.push(p); });
  await db.saveMeta(reordered);
  res.json({ ok: true });
});

app.patch('/api/projects/:id/rename', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  await db.renameProject(req.params.id, name);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════
   API — données d'un planning
══════════════════════════════════════════ */
app.get('/api/projects/:id', async (req, res) => {
  const meta = await db.getProjectMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Not found' });
  const data = (await db.getProjectData(req.params.id)) || defaultData();
  res.json({ ...meta, data });
});

app.post('/api/projects/:id/save', async (req, res) => {
  const { data, user } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data' });
  const meta = await db.getProjectMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Not found' });
  await db.saveProject(req.params.id, meta.name, data, user || 'anonyme');
  res.json({ ok: true });
});

app.get('/api/projects/:id/history', async (req, res) => {
  res.json(await db.getHistory(req.params.id));
});

app.get('/api/projects/:id/history/:hid', async (req, res) => {
  const v = await db.getHistoryVersion(req.params.id, req.params.hid);
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json(v);
});

app.get('/api/projects/:id/export', async (req, res) => {
  const meta = await db.getProjectMeta(req.params.id);
  const data = await db.getProjectData(req.params.id);
  res.setHeader('Content-Disposition', `attachment; filename="planning-${req.params.id}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ name: meta?.name, data, exported_at: new Date().toISOString() }, null, 2));
});

/* ══════════════════════════════════════════
   SOCKET.IO
══════════════════════════════════════════ */
const connectedUsers = new Map();

io.on('connection', socket => {
  socket.on('join', ({ pseudo, projectId }) => {
    socket.data.pseudo    = pseudo    || 'Anonyme';
    socket.data.projectId = projectId || 'default';
    connectedUsers.set(socket.id, { pseudo: socket.data.pseudo, projectId: socket.data.projectId });
    broadcastUsers(socket.data.projectId);
    socket.broadcast.emit('user_joined', { pseudo: socket.data.pseudo, projectId: socket.data.projectId });
  });

  socket.on('full_update', async payload => {
    const pid = socket.data.projectId;
    const meta = await db.getProjectMeta(pid);
    if (meta) await db.saveProject(pid, meta.name, payload.data, socket.data.pseudo);
    socket.to(pid).emit('full_update', { ...payload, by: socket.data.pseudo });
  });

  socket.on('join_room', projectId => {
    socket.leave(socket.data.projectId);
    socket.data.projectId = projectId;
    connectedUsers.set(socket.id, { pseudo: socket.data.pseudo, projectId });
    socket.join(projectId);
    broadcastUsers(projectId);
  });

  socket.on('disconnect', () => {
    const info = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    if (info) {
      broadcastUsers(info.projectId);
      io.emit('user_left', { pseudo: info.pseudo });
    }
  });
});

function broadcastUsers(projectId) {
  const users = [...connectedUsers.values()]
    .filter(u => u.projectId === projectId)
    .map(u => u.pseudo);
  io.to(projectId).emit('users', users);
  io.emit('users_' + projectId, users);
}

/* ── Diagnostic ── */
app.get('/api/status', async (req, res) => {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_KEY;
  let testResult = 'non testé';
  let testError  = null;

  if (SB_URL && SB_KEY) {
    try {
      /* Test lecture directe */
      const r = await fetch(`${SB_URL}/rest/v1/kv_store?select=key&limit=1`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
      });
      const body = await r.text();
      testResult = `HTTP ${r.status} → ${body.slice(0, 200)}`;
    } catch(e) {
      testError = e.message;
    }
  }

  const projects = await db.listProjects();
  res.json({
    storage: 'supabase',
    supabase_url: SB_URL || 'NON CONFIGURÉ',
    supabase_key_prefix: SB_KEY ? SB_KEY.slice(0, 20) + '...' : 'NON CONFIGURÉ',
    supabase_test: testResult,
    supabase_test_error: testError,
    projects: projects.map(p => ({ id: p.id, name: p.name })),
    node_env: process.env.NODE_ENV,
    uptime_s: Math.floor(process.uptime())
  });
});

/* ── Démarrage ── */
const PORT = process.env.PORT || 3000;
(async () => {
  console.log('Connexion Supabase:', process.env.SUPABASE_URL ? 'configurée' : 'MANQUANTE');
  await ensureDefaultProject();
  server.listen(PORT, () => console.log(`Planning server → http://localhost:${PORT}`));
})();
