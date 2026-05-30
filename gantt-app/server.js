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

function ensureDefaultProject() {
  const projects = db.listProjects();
  if (projects.length === 0) {
    const id = 'default';
    db.createProject(id, 'Mon Planning');
    db.saveProject(id, 'Mon Planning', defaultData(), 'système');
  } else {
    /* Vérifier que chaque projet a bien un fichier de données */
    for (const p of projects) {
      if (!db.getProjectData(p.id)) {
        db.saveProject(p.id, p.name, defaultData(), 'système');
      }
    }
  }
}
ensureDefaultProject();

/* ══════════════════════════════════════════
   API — liste des plannings
══════════════════════════════════════════ */
app.get('/api/projects', (req, res) => {
  res.json(db.listProjects());
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = 'proj_' + Date.now();
  db.createProject(id, name);
  db.saveProject(id, name, defaultData(), req.body.user || 'système');
  res.json({ id, name });
});

app.delete('/api/projects/:id', (req, res) => {
  const projects = db.listProjects();
  if (projects.length <= 1) return res.status(400).json({ error: 'Impossible de supprimer le dernier planning' });
  db.deleteProject(req.params.id);
  res.json({ ok: true });
});

app.post('/api/projects/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  const projects = db.listProjects();
  const reordered = ids.map(id => projects.find(p => p.id === id)).filter(Boolean);
  // Conserver les projets non mentionnés à la fin
  projects.forEach(p => { if (!ids.includes(p.id)) reordered.push(p); });
  db.saveMeta(reordered);
  res.json({ ok: true });
});

app.patch('/api/projects/:id/rename', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.renameProject(req.params.id, name);
  res.json({ ok: true });
});

/* ══════════════════════════════════════════
   API — données d'un planning
══════════════════════════════════════════ */
app.get('/api/projects/:id', (req, res) => {
  const meta = db.getProjectMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Not found' });
  const data = db.getProjectData(req.params.id) || defaultData();
  res.json({ ...meta, data });
});

app.post('/api/projects/:id/save', (req, res) => {
  const { data, user } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data' });
  const meta = db.getProjectMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Not found' });
  db.saveProject(req.params.id, meta.name, data, user || 'anonyme');
  res.json({ ok: true });
});

app.get('/api/projects/:id/history', (req, res) => {
  res.json(db.getHistory(req.params.id));
});

app.get('/api/projects/:id/history/:hid', (req, res) => {
  const v = db.getHistoryVersion(req.params.id, req.params.hid);
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json(v);
});

app.get('/api/projects/:id/export', (req, res) => {
  const meta = db.getProjectMeta(req.params.id);
  const data = db.getProjectData(req.params.id);
  res.setHeader('Content-Disposition', `attachment; filename="planning-${req.params.id}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ name: meta?.name, data, exported_at: new Date().toISOString() }, null, 2));
});

/* ══════════════════════════════════════════
   SOCKET.IO
══════════════════════════════════════════ */
const connectedUsers = new Map(); // socketId → { pseudo, projectId }

io.on('connection', socket => {
  socket.on('join', ({ pseudo, projectId }) => {
    socket.data.pseudo    = pseudo    || 'Anonyme';
    socket.data.projectId = projectId || 'default';
    connectedUsers.set(socket.id, { pseudo: socket.data.pseudo, projectId: socket.data.projectId });
    broadcastUsers(socket.data.projectId);
    socket.broadcast.emit('user_joined', { pseudo: socket.data.pseudo, projectId: socket.data.projectId });
  });

  socket.on('full_update', payload => {
    const pid = socket.data.projectId;
    const meta = db.getProjectMeta(pid);
    if (meta) db.saveProject(pid, meta.name, payload.data, socket.data.pseudo);
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
  /* also send to sockets not yet in a room */
  io.emit('users_' + projectId, users);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Planning server → http://localhost:${PORT}`));
