/* Script à exécuter UNE FOIS pour créer le planning TTE */
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const tasks = [
  { nom: "ECHO LE MANS", client: "ECHO", etat: "En cours", debut: "2026-04-22", fin: "2026-04-22", tech: "ASEPTIC" },
  { nom: "AURA PC PRE-MEDARD", client: "AURA PC", etat: "En cours", debut: "2026-04-25", fin: "2026-04-25", tech: "ECO" },
  { nom: "CLINIQUE YVETOT", client: "CLINIQUE", etat: "En cours", debut: "2026-04-27", fin: "2026-04-27", tech: "ECO" },
  { nom: "SANTELYS CAUDRY", client: "SANTELYS", etat: "En cours", debut: "2026-05-04", fin: "2026-05-04", tech: "ECO" },
  { nom: "SANTELYS CAUDRY - Osmoseur", client: "SANTELYS", etat: "En cours", debut: "2026-05-04", fin: "2026-05-04", tech: "ECO" },
  { nom: "CH Le Havre - TTE", client: "CH", etat: "À venir", debut: "2026-05-19", fin: "2026-05-19", tech: "ECO" },
  { nom: "CH Le Havre - Salle 1", client: "CH", etat: "À venir", debut: "2026-05-21", fin: "2026-05-21", tech: "ECO" },
  { nom: "CHU LIMOGES - Phase 1", client: "CH", etat: "À venir", debut: "2026-05-25", fin: "2026-05-25", tech: "ASEPTIC" },
  { nom: "CH Le Havre - Salle 2", client: "CH", etat: "À venir", debut: "2026-05-28", fin: "2026-05-28", tech: "ECO" },
  { nom: "ADH BEAURAINS", client: "ADH", etat: "À venir", debut: "2026-06-01", fin: "2026-06-01", tech: "ASEPTIC" },
  { nom: "CH Le Havre - Salle 3", client: "CH", etat: "À venir", debut: "2026-06-05", fin: "2026-06-05", tech: "ECO" },
  { nom: "SANTELYS LA LOUVIERE", client: "SANTELYS", etat: "À venir", debut: "2026-06-08", fin: "2026-06-08", tech: "ECO" },
  { nom: "ALMAVIVA - Saint Maximin - RESEAUX", client: "ALMAVIVA", etat: "À venir", debut: "2026-06-11", fin: "2026-06-11", tech: "ECO" },
  { nom: "NCHPG Monaco", client: "CH", etat: "À venir", debut: "2026-06-15", fin: "2026-06-15", tech: "ECO" },
  { nom: "AURA SANTE CHAMALIERE Phase 1", client: "AURA SANTE", etat: "À venir", debut: "2026-06-15", fin: "2026-06-15", tech: "ASEPTIC" },
  { nom: "SANTELYS GRAVELINE", client: "SANTELYS", etat: "À venir", debut: "2026-06-22", fin: "2026-06-22", tech: "ECO" },
  { nom: "ALMAVIVA - Saint Maximin - TTE", client: "ALMAVIVA", etat: "À venir", debut: "2026-06-29", fin: "2026-06-29", tech: "ECO" },
  { nom: "CH Le Havre - Bascule", client: "CH", etat: "À venir", debut: "2026-07-04", fin: "2026-07-04", tech: "ECO" },
  { nom: "MAYOTTE MRADOUDOU", client: "MAYDIA", etat: "À venir", debut: "2026-07-06", fin: "2026-07-06", tech: "ECO" },
  { nom: "AURA SANTE Vichy Phase 1", client: "AURA SANTE", etat: "À venir", debut: "2026-07-06", fin: "2026-07-06", tech: "ASEPTIC" },
  { nom: "CH LA ROCHELLE - EXTENSION", client: "CH", etat: "À venir", debut: "2026-07-06", fin: "2026-07-06", tech: "ECO" },
  { nom: "CHU LIMOGES - Phase 2", client: "CH", etat: "À venir", debut: "2026-07-06", fin: "2026-07-06", tech: "ASEPTIC" },
  { nom: "Skid Prétraitement Yvetot", client: "HEMOTECH", etat: "À venir", debut: "2026-07-07", fin: "2026-07-07", tech: "Matériel" },
  { nom: "Provisoire 3 chimique + 0,2µm / TOSMPROV03 / 1350 P / VICHY", client: "HEMOTECH", etat: "À venir", debut: "2026-07-08", fin: "2026-07-08", tech: "Matériel" },
  { nom: "STEER Hibiscus", client: "STEER", etat: "À venir", debut: "2026-07-13", fin: "2026-07-13", tech: "ECO" },
  { nom: "AURAL AIX LES BAINS - Réseaux", client: "AURAL", etat: "À venir", debut: "2026-07-13", fin: "2026-07-13", tech: "ECO" },
  { nom: "ARPDD Saint Dizier", client: "ARPDD", etat: "À venir", debut: "2026-07-20", fin: "2026-07-20", tech: "Non attribué" },
  { nom: "ECHO LE MANS - Dépose de la boucle", client: "ECHO", etat: "À venir", debut: "2026-07-20", fin: "2026-07-20", tech: "ASEPTIC" },
  { nom: "AURA SANTE CHAMALIERE Phase 2", client: "AURA SANTE", etat: "À venir", debut: "2026-07-25", fin: "2026-07-25", tech: "ASEPTIC" },
  { nom: "DIAVERUM Saint Victoret", client: "DIAVERUM", etat: "À venir", debut: "2026-08-03", fin: "2026-08-03", tech: "Non attribué" },
  { nom: "AURA SANTE Vichy Phase 2", client: "AURA SANTE", etat: "À venir", debut: "2026-08-17", fin: "2026-08-17", tech: "ASEPTIC" },
  { nom: "ARPDD Saint Dizier - Bascule", client: "ARPDD", etat: "À venir", debut: "2026-08-29", fin: "2026-08-29", tech: "Non attribué" },
  { nom: "Clinique Saint Martin", client: "Clinique", etat: "À venir", debut: "2026-08-31", fin: "2026-08-31", tech: "Non attribué" },
  { nom: "AAIR TARASCON", client: "AAIR", etat: "À venir", debut: "2026-09-07", fin: "2026-09-07", tech: "ASEPTIC" },
  { nom: "SANTELYS Iwuy", client: "SANTELYS", etat: "À venir", debut: "2026-09-07", fin: "2026-09-07", tech: "Non attribué" },
  { nom: "AURAL AIX LES BAINS - TTE", client: "AURAL", etat: "À venir", debut: "2026-09-07", fin: "2026-09-07", tech: "ECO" },
  { nom: "ADH LOISON SOUS LENS", client: "ADH", etat: "À venir", debut: "2026-09-21", fin: "2026-09-21", tech: "ASEPTIC" },
  { nom: "SANTELYS Faches-Thumesnil", client: "SANTELYS", etat: "À venir", debut: "2026-09-21", fin: "2026-09-21", tech: "Non attribué" },
  { nom: "AURA SANTE Vichy Phase 3", client: "AURA SANTE", etat: "À venir", debut: "2026-09-25", fin: "2026-09-25", tech: "ASEPTIC" },
  { nom: "AURA SANTE MONT-DORE Phase 1", client: "AURA SANTE", etat: "À venir", debut: "2026-10-10", fin: "2026-10-10", tech: "ASEPTIC" },
  { nom: "CH VALENCIENNE - Phase 1", client: "CH", etat: "À venir", debut: "2026-10-12", fin: "2026-10-12", tech: "Non attribué" },
  { nom: "CHU LIMOGES - Phase 3", client: "CH", etat: "À venir", debut: "2026-10-19", fin: "2026-10-19", tech: "ASEPTIC" },
  { nom: "CH CHOLET", client: "CH", etat: "À venir", debut: "2026-10-26", fin: "2026-10-26", tech: "Non attribué" },
  { nom: "CH VALENCIENNE - Bascule 1", client: "CH", etat: "À venir", debut: "2026-10-31", fin: "2026-10-31", tech: "Non attribué" },
  { nom: "SANTELYS Loos (Standby)", client: "SANTELYS", etat: "À venir", debut: "2026-11-02", fin: "2026-11-02", tech: "Non attribué" },
  { nom: "CH VALENCIENNE - Bascule 2", client: "CH", etat: "À venir", debut: "2026-11-07", fin: "2026-11-07", tech: "Non attribué" },
  { nom: "AAIR PAMIERS", client: "AAIR", etat: "À venir", debut: "2026-11-09", fin: "2026-11-09", tech: "ASEPTIC" },
  { nom: "CH VALENCIENNE - Bascule 3", client: "CH", etat: "À venir", debut: "2026-11-14", fin: "2026-11-14", tech: "Non attribué" },
  { nom: "AURA SANTE MONT-DORE Phase 2", client: "AURA SANTE", etat: "À venir", debut: "2026-11-16", fin: "2026-11-16", tech: "ASEPTIC" },
  { nom: "SANTELYS La Basse", client: "SANTELYS", etat: "À venir", debut: "2026-11-23", fin: "2026-11-23", tech: "Non attribué" },
  { nom: "AURA SANTE Monluçon Phase 1", client: "AURA SANTE", etat: "À venir", debut: "2026-11-30", fin: "2026-11-30", tech: "ASEPTIC" },
  { nom: "CHU LIMOGES - Phase 4", client: "CH", etat: "À venir", debut: "2027-02-01", fin: "2027-02-01", tech: "ASEPTIC" },
].map(t => ({ ...t, id: 'tte_' + uuidv4().slice(0,8), couleur: null, soustaches: [] }));

const data = {
  tasks,
  techniciens: [
    { nom: 'ECO',           couleur: '#10b981' },
    { nom: 'ASEPTIC',       couleur: '#3b82f6' },
    { nom: 'Matériel',      couleur: '#f59e0b' },
    { nom: 'Non attribué',  couleur: '#94a3b8' },
  ],
  colonnes: [
    { key: 'client', label: 'Association', width: 110 },
    { key: 'nom',    label: 'Opération',   width: 360 },
    { key: 'debut',  label: 'Début',       width: 92  },
    { key: 'fin',    label: 'Fin',         width: 92  },
    { key: 'tech',   label: 'Attribution', width: 130 },
    { key: 'etat',   label: 'État',        width: 90  },
  ],
  ANNEE: 2026,
  W: 14,
  collapsed: {}
};

const id = 'proj_tte';

// Ne créer que si le planning n'existe pas encore
const existing = db.getProjectMeta(id);
if (existing) {
  console.log('ℹ️  Planning TTE déjà présent — aucune modification.');
} else {
  db.createProject(id, 'TTE');
  db.saveProject(id, 'TTE', data, 'import');
  console.log('✅ Planning TTE créé avec', tasks.length, 'tâches.');
}
