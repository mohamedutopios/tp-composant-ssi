// RH Backend — Ressources Humaines
// Phase 1 : IDOR sur GET /api/employes/:id et GET /api/paie/:id
// F1 — tout employé authentifié peut lire la fiche de n'importe qui
// F2 — export CSV sans vérification de rôle
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa  = require('jwks-rsa');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 4000;

const KEYCLOAK_URL   = process.env.KEYCLOAK_URL   || 'http://keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'hopital';
const JWKS_URI = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const ISSUER   = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;

const db = new Pool({
  host:     process.env.DB_HOST     || 'postgres-rh',
  database: process.env.DB_NAME     || 'rh_hopital',
  user:     process.env.DB_USER     || 'rh_user',
  password: process.env.DB_PASSWORD || 'rh_pass_2024',
  port:     5432,
});
db.query('SELECT 1').then(() => console.log('✅ PostgreSQL RH connecté')).catch(e => console.error('❌', e.message));

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('combined'));

const checkJWT = jwt({
  secret: jwksRsa.expressJwtSecret({ cache:true, rateLimit:true, jwksRequestsPerMinute:10, jwksUri:JWKS_URI }),
  audience: 'rh-api', issuer: ISSUER, algorithms: ['RS256'],
});

const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.auth?.roles || [];
  if (!roles.some(r => userRoles.includes(r))) return res.status(403).json({ error:'Accès refusé', required:roles });
  next();
};

app.get('/health', (req, res) => res.json({ status:'ok', service:'RH' }));

// GET /api/employes — liste (manager/admin)
app.get('/api/employes', checkJWT, requireRole('manager','admin'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT e.id, e.matricule, e.nom, e.prenom, e.service, e.poste, e.type_contrat, e.statut,
              c.salaire_brut
       FROM employes e LEFT JOIN contrats c ON c.employe_id=e.id AND c.statut='actif'
       ORDER BY e.nom`
    );
    res.json({ employes: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/employes/:id — fiche complète
// ⚠ F1 IDOR : tout utilisateur authentifié peut voir la fiche de n'importe qui
app.get('/api/employes/:id', checkJWT, async (req, res) => {
  try {
    const [emp, contrat, conges, planning] = await Promise.all([
      db.query(`SELECT e.*, c.salaire_brut, c.type as type_contrat_detail
                FROM employes e LEFT JOIN contrats c ON c.employe_id=e.id AND c.statut='actif'
                WHERE e.id=$1`, [req.params.id]),
      db.query('SELECT * FROM contrats WHERE employe_id=$1 ORDER BY date_debut DESC', [req.params.id]),
      db.query('SELECT * FROM conges WHERE employe_id=$1 ORDER BY date_debut DESC LIMIT 10', [req.params.id]),
      db.query('SELECT * FROM planning_shifts WHERE employe_id=$1 ORDER BY date_shift DESC LIMIT 10', [req.params.id]),
    ]);
    if (!emp.rows.length) return res.status(404).json({ error:'Employé non trouvé' });
    res.json({ employe: emp.rows[0], contrats: contrat.rows, conges: conges.rows, planning: planning.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/paie/:id — fiches de paie avec IBAN
// ⚠ F1 IDOR + F2 : IBAN en clair, accessible sans vérification de rôle
app.get('/api/paie/:id', checkJWT, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM fiches_paie WHERE employe_id=$1 ORDER BY annee DESC, mois DESC LIMIT 12',
      [req.params.id]
    );
    res.json({ fiches: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/paie/export/csv — export CSV sans vérification de rôle (F2)
app.get('/api/paie/export/csv', checkJWT, async (req, res) => {
  try {
    // ⚠ F2 : accessible par n'importe quel rôle — devrait être admin/manager uniquement
    const r = await db.query(`
      SELECT e.matricule, e.nom, e.prenom, f.mois, f.annee,
             f.salaire_brut, f.salaire_net, f.iban
      FROM fiches_paie f JOIN employes e ON e.id=f.employe_id
      ORDER BY f.annee DESC, f.mois DESC, e.nom
    `);
    const lines = ['Matricule,Nom,Prénom,Mois,Année,Salaire brut,Salaire net,IBAN'];
    r.rows.forEach(row => lines.push(
      `${row.matricule},"${row.nom}","${row.prenom}",${row.mois},${row.annee},${row.salaire_brut},${row.salaire_net},"${row.iban}"`
    ));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="paie-export.csv"');
    res.send(lines.join('\n'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/conges — demande de congé
app.post('/api/conges', checkJWT, async (req, res) => {
  const { employe_id, type, date_debut, date_fin, motif } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO conges (employe_id, type, date_debut, date_fin, motif, statut)
       VALUES ($1,$2,$3,$4,$5,'en_attente') RETURNING *`,
      [employe_id || req.auth.sub, type, date_debut, date_fin, motif]
    );
    res.status(201).json({ conge: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/conges/:id — approuver/refuser
app.patch('/api/conges/:id', checkJWT, requireRole('manager','admin'), async (req, res) => {
  const { statut } = req.body;
  try {
    const r = await db.query(
      'UPDATE conges SET statut=$1, approuve_par=$2 WHERE id=$3 RETURNING *',
      [statut, req.auth.preferred_username, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error:'Congé non trouvé' });
    res.json({ conge: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/me
app.get('/api/me', checkJWT, (req, res) => res.json({ user: req.auth }));

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') return res.status(401).json({ error:'Non authentifié' });
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`👥 RH backend :${PORT}`));
