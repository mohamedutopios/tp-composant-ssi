// RDV Backend — Prise de rendez-vous
// Phase 1 : BOLA sur GET/PATCH /api/rdv/:id (pas de vérification propriétaire)
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const morgan    = require('morgan');
const mongoose  = require('mongoose');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa   = require('jwks-rsa');

const app  = express();
const PORT = process.env.PORT || 4000;

const KEYCLOAK_URL   = process.env.KEYCLOAK_URL   || 'http://keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'hopital';
const JWKS_URI = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const ISSUER   = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;

mongoose.connect(process.env.MONGO_URI || 'mongodb://rdv_admin:rdv_pass_2024@mongo-rdv:27017/rdv_hopital?authSource=admin')
  .then(() => console.log('✅ MongoDB RDV connecté'))
  .catch(e => console.error('❌', e.message));

// ── Modèles ───────────────────────────────────────────────────────────────────
const RendezVous = mongoose.model('RendezVous', new mongoose.Schema({
  patientId:    { type: String, required: true },
  patientNom:   { type: String, required: true },
  praticienId:  { type: String, required: true },
  praticienNom: String,
  specialite:   String,
  date:         { type: Date, required: true },
  heure:        { type: String, required: true },
  motif:        { type: String, required: true },
  type:         { type: String, enum: ['presentiel','teleconsultation'], default: 'presentiel' },
  statut:       { type: String, enum: ['confirme','annule','en_attente','termine'], default: 'confirme' },
  notes:        String,
}, { timestamps: true }));

const Praticien = mongoose.model('Praticien', new mongoose.Schema({
  userId:     { type: String, unique: true },
  nom:        String,
  prenom:     String,
  specialite: String,
  service:    String,
}));

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('combined'));

const checkJWT = jwt({
  secret: jwksRsa.expressJwtSecret({ cache:true, rateLimit:true, jwksRequestsPerMinute:10, jwksUri:JWKS_URI }),
  audience: 'rdv-api', issuer: ISSUER, algorithms: ['RS256'],
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status:'ok', service:'RDV' }));

// GET /api/rdv — mes RDV (filtrés par userId)
app.get('/api/rdv', checkJWT, async (req, res) => {
  try {
    const userId = req.auth.preferred_username;
    const roles  = req.auth.roles || [];
    // Médecins et admins voient tout, patients voient les leurs
    const filter = (roles.includes('medecin') || roles.includes('admin'))
      ? {}
      : { patientId: userId };
    const rdvs = await RendezVous.find(filter).sort({ date: 1 });
    res.json({ rdvs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/rdv/:id — BOLA (F1 Phase 1)
app.get('/api/rdv/:id', checkJWT, async (req, res) => {
  try {
    // ⚠ BOLA : pas de vérification que req.auth.preferred_username === rdv.patientId
    const rdv = await RendezVous.findById(req.params.id);
    if (!rdv) return res.status(404).json({ error: 'RDV non trouvé' });
    res.json({ rdv });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/rdv — prendre un RDV
app.post('/api/rdv', checkJWT, async (req, res) => {
  try {
    const rdv = await RendezVous.create({
      ...req.body,
      patientId:  req.auth.preferred_username,
      patientNom: `${req.auth.given_name || ''} ${req.auth.family_name || ''}`.trim() || req.auth.preferred_username,
    });
    res.status(201).json({ rdv });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/rdv/:id/annuler — BOLA (F1 Phase 1)
app.patch('/api/rdv/:id/annuler', checkJWT, async (req, res) => {
  try {
    // ⚠ BOLA : n'importe qui peut annuler n'importe quel RDV
    const rdv = await RendezVous.findByIdAndUpdate(req.params.id, { statut:'annule' }, { new:true });
    if (!rdv) return res.status(404).json({ error: 'RDV non trouvé' });
    res.json({ rdv });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/praticiens
app.get('/api/praticiens', checkJWT, async (req, res) => {
  try {
    const praticiens = await Praticien.find();
    res.json({ praticiens });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/me
app.get('/api/me', checkJWT, (req, res) => res.json({ user: req.auth }));

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') return res.status(401).json({ error: 'Non authentifié' });
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`🗓 RDV backend :${PORT}`));
