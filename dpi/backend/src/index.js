// DPI Backend — Dossier Patient Informatisé
// Phase 1 : failles intentionnelles pour les tests Kali
//   F1 — SQL injection sur GET /api/patients?search=
//   F2 — IDOR sur GET /api/patients/:id (pas de vérif service)
//   F3 — Pas de rate-limiting sur /api/auth/*
//   F4 — CORS ouvert (*)
//   F5 — Stack trace exposée dans les erreurs 500
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const morgan    = require('morgan');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa   = require('jwks-rsa');
const { Pool }  = require('pg');

const app  = express();
const PORT = process.env.PORT || 4000;

const KEYCLOAK_URL   = process.env.KEYCLOAK_URL   || 'http://keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'hopital';
const JWKS_URI = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const ISSUER   = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;

// PostgreSQL
const db = new Pool({
  host:     process.env.DB_HOST     || 'postgres-dpi',
  database: process.env.DB_NAME     || 'dpi_hopital',
  user:     process.env.DB_USER     || 'dpi_user',
  password: process.env.DB_PASSWORD || 'dpi_pass_2024',
  port:     5432,
});
db.query('SELECT 1').then(() => console.log('✅ PostgreSQL DPI connecté')).catch(e => console.error('❌', e.message));

// Middleware
app.use(cors({ origin: '*' }));   // F4 : CORS ouvert
app.use(express.json());
app.use(morgan('combined'));

// Validation JWT Keycloak via JWKS (clé publique — pas de secret partagé)
const checkJWT = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true, rateLimit: true, jwksRequestsPerMinute: 10, jwksUri: JWKS_URI,
  }),
  audience:   'dpi-api',
  issuer:     ISSUER,
  algorithms: ['RS256'],
});

const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.auth?.roles || [];
  if (!roles.some(r => userRoles.includes(r))) {
    return res.status(403).json({ error: 'Accès refusé', required: roles });
  }
  next();
};

// ── Routes publiques ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'DPI' }));

// ── Routes protégées ──────────────────────────────────────────────

// GET /api/patients — recherche avec SQL injection (F1)
app.get('/api/patients', checkJWT, requireRole('medecin', 'admin'), async (req, res) => {
  const { search } = req.query;
  try {
    let rows;
    if (search) {
      // ⚠ F1 : SQL INJECTION — paramètre non sanitisé
      // Payload : ?search=' OR '1'='1 → tous les patients
      // En V2 : remplacé par requête paramétrée ($1)
      const sql = `SELECT id, nom, prenom, date_naissance, nss, service, allergie
                   FROM patients WHERE nom ILIKE '%${search}%' OR prenom ILIKE '%${search}%'
                   ORDER BY nom LIMIT 100`;
      const result = await db.query(sql);
      rows = result.rows;
    } else {
      const result = await db.query(
        'SELECT id, nom, prenom, date_naissance, nss, service, allergie FROM patients ORDER BY nom'
      );
      rows = result.rows;
    }
    res.json({ patients: rows });
  } catch (err) {
    res.status(500).json({ error: err.message, query: err.query }); // F5 : expose la requête SQL
  }
});

// GET /api/patients/:id — dossier complet (F2 : IDOR)
app.get('/api/patients/:id', checkJWT, requireRole('medecin', 'admin'), async (req, res) => {
  try {
    // ⚠ F2 : IDOR — tout médecin voit tout patient, peu importe son service
    // En V2 : vérifier que req.auth.service === patient.service
    const [patient, consultations, prescriptions] = await Promise.all([
      db.query('SELECT * FROM patients WHERE id = $1', [req.params.id]),
      db.query('SELECT * FROM consultations WHERE patient_id = $1 ORDER BY date DESC', [req.params.id]),
      db.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY date DESC', [req.params.id]),
    ]);
    if (!patient.rows.length) return res.status(404).json({ error: 'Patient non trouvé' });
    res.json({ patient: patient.rows[0], consultations: consultations.rows, prescriptions: prescriptions.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/patients
app.post('/api/patients', checkJWT, requireRole('medecin', 'admin'), async (req, res) => {
  const { nom, prenom, date_naissance, nss, service, allergie, groupe_sanguin } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO patients (nom, prenom, date_naissance, nss, service, allergie, groupe_sanguin, medecin_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [nom, prenom, date_naissance, nss, service, allergie, groupe_sanguin, req.auth.preferred_username]
    );
    res.status(201).json({ patient: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message, detail: err.detail }); }
});

// POST /api/patients/:id/consultations
app.post('/api/patients/:id/consultations', checkJWT, requireRole('medecin', 'admin'), async (req, res) => {
  const { motif, diagnostic, notes } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO consultations (patient_id, medecin, date, motif, diagnostic, notes)
       VALUES ($1,$2,NOW(),$3,$4,$5) RETURNING *`,
      [req.params.id, req.auth.preferred_username, motif, diagnostic, notes]
    );
    res.status(201).json({ consultation: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/patients/:id/prescriptions
app.post('/api/patients/:id/prescriptions', checkJWT, requireRole('medecin', 'admin'), async (req, res) => {
  const { medicament, dosage, duree, renouveler } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO prescriptions (patient_id, medecin, date, medicament, dosage, duree, renouveler)
       VALUES ($1,$2,NOW(),$3,$4,$5,$6) RETURNING *`,
      [req.params.id, req.auth.preferred_username, medicament, dosage, duree, renouveler || false]
    );
    res.status(201).json({ prescription: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/me
app.get('/api/me', checkJWT, (req, res) => res.json({ user: req.auth }));

// Erreur JWT
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') return res.status(401).json({ error: 'Non authentifié' });
  res.status(500).json({ error: err.message, stack: err.stack }); // F5
});

app.listen(PORT, () => console.log(`🏥 DPI backend :${PORT}`));
