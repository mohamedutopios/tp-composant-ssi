import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';

// ── Contexte Auth ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);

function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [token, setToken]   = useState(localStorage.getItem('dpi_token'));
  const [user,  setUser]    = useState(JSON.parse(localStorage.getItem('dpi_user') || 'null'));

  const login = (tok, usr) => {
    localStorage.setItem('dpi_token', tok);
    localStorage.setItem('dpi_user', JSON.stringify(usr));
    setToken(tok); setUser(usr);
  };
  const logout = () => {
    localStorage.removeItem('dpi_token');
    localStorage.removeItem('dpi_user');
    setToken(null); setUser(null);
  };

  return <AuthCtx.Provider value={{ token, user, login, logout }}>{children}</AuthCtx.Provider>;
}

// ── API Client ────────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('dpi_token');
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  });
}

// Obtenir un token Keycloak (Resource Owner Password flow)
async function keycloakLogin(username, password) {
  const KEYCLOAK = process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080';
  const res = await fetch(`${KEYCLOAK}/realms/hopital/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      client_id:     'hopital-frontend',
      username,
      password,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Identifiants incorrects');
  // Décoder le payload JWT pour extraire les infos utilisateur
  const payload = JSON.parse(atob(data.access_token.split('.')[1]));
  return { token: data.access_token, user: payload };
}

// ── Guard ─────────────────────────────────────────────────────────────────────
function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

// ── Styles globaux ────────────────────────────────────────────────────────────
const s = {
  // Layout
  shell:    { display:'flex', minHeight:'100vh' },
  sidebar:  { width:220, background:'#1a3c5e', color:'white', display:'flex', flexDirection:'column' },
  brand:    { padding:'24px 20px 16px', fontSize:18, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.1)' },
  brandSub: { fontSize:12, fontWeight:400, opacity:0.7, display:'block', marginTop:2 },
  nav:      { flex:1, padding:'12px 0' },
  navLink:  { display:'block', padding:'10px 20px', color:'rgba(255,255,255,0.75)', textDecoration:'none', fontSize:14, borderLeft:'3px solid transparent' },
  navActive:{ color:'white', borderLeftColor:'#63b3ed', background:'rgba(255,255,255,0.08)' },
  userBox:  { padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)', fontSize:13 },
  userName: { fontWeight:600, marginBottom:2 },
  userRole: { opacity:0.6, fontSize:12, marginBottom:10 },
  logoutBtn:{ width:'100%', padding:'7px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:6, color:'white', cursor:'pointer', fontSize:12 },
  main:     { flex:1, background:'#f0f4f8', overflow:'auto' },
  // Pages
  page:     { padding:32, maxWidth:1200, margin:'0 auto' },
  pageHead: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 },
  title:    { fontSize:22, fontWeight:700, color:'#1a3c5e' },
  // Cartes
  card:     { background:'white', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden' },
  cardHead: { padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' },
  cardBody: { padding:'20px' },
  // Tableau
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { padding:'10px 14px', background:'#1a3c5e', color:'white', textAlign:'left', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' },
  td:       { padding:'11px 14px', borderBottom:'1px solid #e2e8f0', fontSize:13, verticalAlign:'middle' },
  trHover:  { cursor:'pointer' },
  // Formulaires
  form:     { display:'flex', flexDirection:'column', gap:14 },
  label:    { fontSize:13, fontWeight:500, color:'#4a5568', marginBottom:3 },
  input:    { width:'100%', padding:'9px 12px', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14, outline:'none', transition:'border-color 0.15s' },
  textarea: { width:'100%', padding:'9px 12px', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14, minHeight:80, resize:'vertical' },
  row2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  // Boutons
  btnPrimary: { padding:'9px 18px', background:'#1a3c5e', color:'white', border:'none', borderRadius:7, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnSecond:  { padding:'9px 18px', background:'white', color:'#1a3c5e', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14, cursor:'pointer' },
  btnSmall:   { padding:'5px 12px', background:'#ebf8ff', color:'#2b6cb0', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' },
  // Badges
  badgeA:   { display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 },
  // Messages
  error:    { padding:'10px 14px', background:'#fff5f5', border:'1px solid #fc8181', borderRadius:7, color:'#c53030', fontSize:13 },
  success:  { padding:'10px 14px', background:'#f0fff4', border:'1px solid #68d391', borderRadius:7, color:'#276749', fontSize:13 },
  info:     { padding:'10px 14px', background:'#ebf8ff', border:'1px solid #63b3ed', borderRadius:7, color:'#2c5282', fontSize:13 },
  // Login
  loginPage:{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1a3c5e 0%,#2c5282 100%)' },
  loginCard:{ background:'white', borderRadius:14, padding:'40px 48px', width:400, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  loginLogo:{ textAlign:'center', fontSize:48, marginBottom:8 },
  loginTitle:{ textAlign:'center', fontSize:22, fontWeight:700, color:'#1a3c5e', marginBottom:4 },
  loginSub:  { textAlign:'center', fontSize:13, color:'#718096', marginBottom:28 },
  // Stats
  statsGrid:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 },
  statCard: { background:'white', borderRadius:10, padding:20, textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' },
  statNum:  { fontSize:36, fontWeight:700, marginBottom:4 },
  statLbl:  { fontSize:13, color:'#718096' },
  // Detail
  detail:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 },
  infoBlock:{ background:'white', borderRadius:10, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' },
  infoTitle:{ fontSize:14, fontWeight:700, color:'#1a3c5e', marginBottom:14, paddingBottom:10, borderBottom:'1px solid #e2e8f0' },
  infoRow:  { display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f7fafc', fontSize:13 },
  infoLbl:  { color:'#718096' },
  infoVal:  { fontWeight:500, color:'#2d3748' },
};

// ── Composants utilitaires ────────────────────────────────────────────────────
function Badge({ color, children }) {
  const colors = {
    blue:   { bg:'#ebf8ff', text:'#2b6cb0' },
    green:  { bg:'#f0fff4', text:'#276749' },
    red:    { bg:'#fff5f5', text:'#c53030' },
    orange: { bg:'#fffaf0', text:'#c05621' },
    gray:   { bg:'#f7fafc', text:'#4a5568' },
  };
  const c = colors[color] || colors.gray;
  return <span style={{ ...s.badgeA, background:c.bg, color:c.text }}>{children}</span>;
}

function Spinner() {
  return <div style={{ textAlign:'center', padding:40, color:'#718096' }}>Chargement...</div>;
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <div style={s.label}>{label}</div>
      {children}
    </div>
  );
}

// ── Page Login ────────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token, user } = await keycloakLogin(username, password);
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.loginPage}>
      <div style={s.loginCard}>
        <div style={s.loginLogo}>🏥</div>
        <h1 style={s.loginTitle}>DPI — Dossier Patient</h1>
        <p style={s.loginSub}>Hôpital Utopios · Accès médecins</p>
        <form style={s.form} onSubmit={handleSubmit}>
          <FieldGroup label="Identifiant">
            <input style={s.input} value={username} onChange={e => setUsername(e.target.value)}
              placeholder="jean.dupont" autoFocus />
          </FieldGroup>
          <FieldGroup label="Mot de passe">
            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" />
          </FieldGroup>
          {error && <div style={s.error}>{error}</div>}
          <button style={{ ...s.btnPrimary, width:'100%', padding:'11px' }} disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter via Keycloak'}
          </button>
        </form>
        <div style={{ marginTop:20, padding:'12px 14px', background:'#f7fafc', borderRadius:8, fontSize:12, color:'#718096' }}>
          <strong>Comptes disponibles :</strong><br/>
          jean.dupont / Jean2024! · admin.hopital / Admin2024!
        </div>
      </div>
    </div>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────
function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = window.location.pathname;

  const navItems = [
    { to:'/',            icon:'📊', label:'Tableau de bord' },
    { to:'/patients',    icon:'👥', label:'Patients' },
    { to:'/urgents',     icon:'🚨', label:'Dossiers urgents' },
  ];

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          🏥 DPI
          <span style={s.brandSub}>Dossier Patient Informatisé</span>
        </div>
        <nav style={s.nav}>
          {navItems.map(item => (
            <Link key={item.to} to={item.to} style={{
              ...s.navLink,
              ...(loc === item.to ? s.navActive : {}),
            }}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div style={s.userBox}>
          <div style={s.userName}>
            {user?.given_name} {user?.family_name}
          </div>
          <div style={s.userRole}>
            {(user?.roles || []).includes('medecin') ? '🩺 Médecin' :
             (user?.roles || []).includes('admin')   ? '⚙️ Admin' : '👤 Employé'}
            {user?.service ? ` · ${user.service}` : ''}
          </div>
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>
            Déconnexion
          </button>
        </div>
      </aside>
      <main style={s.main}>{children}</main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/api/patients').then(d => {
      setPatients(d.patients || []);
      const urgents = (d.patients || []).filter(p =>
        ['Oncologie'].includes(p.service)
      ).length;
      setStats({ total: d.patients?.length || 0, urgents });
    }).catch(() => {});
  }, []);

  const statColors = ['#3182ce', '#e53e3e', '#38a169'];

  return (
    <div style={s.page}>
      <div style={s.pageHead}>
        <h1 style={s.title}>Tableau de bord</h1>
        <span style={{ fontSize:13, color:'#718096' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </span>
      </div>

      <div style={s.statsGrid}>
        {[
          { label:'Patients', value: stats?.total ?? '…', color:'#3182ce', icon:'👥' },
          { label:'Urgents',  value: stats?.urgents ?? '…', color:'#e53e3e', icon:'🚨' },
          { label:'Services', value: 5, color:'#38a169', icon:'🏥' },
        ].map((st, i) => (
          <div key={i} style={s.statCard}>
            <div style={{ fontSize:28, marginBottom:6 }}>{st.icon}</div>
            <div style={{ ...s.statNum, color:st.color }}>{st.value}</div>
            <div style={s.statLbl}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.cardHead}>
          <span style={{ fontWeight:600, color:'#1a3c5e' }}>Derniers patients</span>
          <button style={s.btnSmall} onClick={() => navigate('/patients')}>Voir tous</button>
        </div>
        <table style={s.table}>
          <thead>
            <tr>{['Nom','Prénom','Service','Allergie'].map(h =>
              <th key={h} style={s.th}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {patients.slice(0,5).map(p => (
              <tr key={p.id} style={s.trHover} onClick={() => navigate(`/patients/${p.id}`)}>
                <td style={s.td}><strong>{p.nom}</strong></td>
                <td style={s.td}>{p.prenom}</td>
                <td style={s.td}><Badge color="blue">{p.service}</Badge></td>
                <td style={s.td}>{p.allergie ? <Badge color="red">{p.allergie}</Badge> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Liste patients ─────────────────────────────────────────────────────────────
function PatientList() {
  const [patients, setPatients] = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const load = async (q = '') => {
    setLoading(true); setError('');
    try {
      // NOTE : le paramètre search est vulnérable à l'injection SQL côté backend (F1)
      const data = await apiFetch(`/api/patients${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setPatients(data.patients || []);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={s.page}>
      <div style={s.pageHead}>
        <h1 style={s.title}>Patients ({patients.length})</h1>
        <button style={s.btnPrimary} onClick={() => setShowForm(true)}>+ Nouveau patient</button>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <input style={{ ...s.input, maxWidth:360 }}
          placeholder="Rechercher par nom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(search)}
        />
        <button style={s.btnPrimary} onClick={() => load(search)}>Rechercher</button>
        {search && <button style={s.btnSecond} onClick={() => { setSearch(''); load(); }}>Réinitialiser</button>}
      </div>

      {error && <div style={{ ...s.error, marginBottom:16 }}>{error}</div>}

      {showForm && <PatientForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      <div style={s.card}>
        {loading ? <Spinner /> : (
          <table style={s.table}>
            <thead>
              <tr>{['Nom','Prénom','Né(e) le','NSS','Service','Groupe','Allergie','Actions'].map(h =>
                <th key={h} style={s.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id}>
                  <td style={s.td}><strong>{p.nom}</strong></td>
                  <td style={s.td}>{p.prenom}</td>
                  <td style={s.td}>{p.date_naissance ? new Date(p.date_naissance).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:11 }}>{p.nss}</td>
                  <td style={s.td}><Badge color="blue">{p.service}</Badge></td>
                  <td style={s.td}><Badge color="gray">{p.groupe_sanguin || '—'}</Badge></td>
                  <td style={s.td}>{p.allergie ? <Badge color="red">{p.allergie}</Badge> : '—'}</td>
                  <td style={s.td}>
                    <button style={s.btnSmall} onClick={() => navigate(`/patients/${p.id}`)}>
                      Ouvrir dossier
                    </button>
                  </td>
                </tr>
              ))}
              {!patients.length && (
                <tr><td colSpan={8} style={{ ...s.td, textAlign:'center', color:'#718096', padding:32 }}>
                  Aucun patient trouvé
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Formulaire nouveau patient ────────────────────────────────────────────────
function PatientForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ nom:'', prenom:'', date_naissance:'', nss:'', service:'Cardiologie', allergie:'', groupe_sanguin:'A+' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch('/api/patients', { method:'POST', body: JSON.stringify(form) });
      onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  };

  const services = ['Cardiologie','Neurologie','Oncologie','Urgences','Radiologie','Pédiatrie'];
  const groupes  = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  return (
    <div style={{ ...s.card, marginBottom:20 }}>
      <div style={s.cardHead}>
        <span style={{ fontWeight:600 }}>Nouveau patient</span>
        <button style={s.btnSecond} onClick={onClose}>✕ Annuler</button>
      </div>
      <div style={s.cardBody}>
        <form style={s.form} onSubmit={handleSubmit}>
          <div style={s.row2}>
            <FieldGroup label="Nom *"><input style={s.input} value={form.nom} onChange={set('nom')} required /></FieldGroup>
            <FieldGroup label="Prénom *"><input style={s.input} value={form.prenom} onChange={set('prenom')} required /></FieldGroup>
          </div>
          <div style={s.row2}>
            <FieldGroup label="Date de naissance *"><input style={s.input} type="date" value={form.date_naissance} onChange={set('date_naissance')} required /></FieldGroup>
            <FieldGroup label="NSS *"><input style={s.input} value={form.nss} onChange={set('nss')} placeholder="1 85 06 75 001 001 23" required /></FieldGroup>
          </div>
          <div style={s.row2}>
            <FieldGroup label="Service">
              <select style={s.input} value={form.service} onChange={set('service')}>
                {services.map(s => <option key={s}>{s}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Groupe sanguin">
              <select style={s.input} value={form.groupe_sanguin} onChange={set('groupe_sanguin')}>
                {groupes.map(g => <option key={g}>{g}</option>)}
              </select>
            </FieldGroup>
          </div>
          <FieldGroup label="Allergie connue">
            <input style={s.input} value={form.allergie} onChange={set('allergie')} placeholder="ex: Pénicilline, Aspirine..." />
          </FieldGroup>
          {error && <div style={s.error}>{error}</div>}
          <div style={{ display:'flex', gap:10 }}>
            <button style={s.btnPrimary} disabled={saving}>{saving ? 'Enregistrement...' : 'Créer le dossier'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Dossier patient ────────────────────────────────────────────────────────────
function PatientDetail() {
  const { id } = useParams();
  const [data, setData]   = useState(null);
  const [tab,  setTab]    = useState('info');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/api/patients/${id}`)
      .then(setData)
      .catch(err => setError(err.message));
  }, [id]);

  if (error) return <div style={{ ...s.page }}><div style={s.error}>{error}</div></div>;
  if (!data)  return <Spinner />;

  const { patient: p, consultations, prescriptions } = data;

  const tabs = ['info','consultations','prescriptions'];
  const tabLabels = { info:'Informations', consultations:`Consultations (${consultations.length})`, prescriptions:`Prescriptions (${prescriptions.length})` };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <button style={{ ...s.btnSecond, marginBottom:16, fontSize:12 }} onClick={() => navigate('/patients')}>
          ← Retour à la liste
        </button>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h1 style={{ ...s.title, marginBottom:6 }}>{p.prenom} {p.nom}</h1>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Badge color="blue">{p.service}</Badge>
              <Badge color="gray">{p.groupe_sanguin}</Badge>
              {p.allergie && <Badge color="red">⚠ {p.allergie}</Badge>}
              <span style={{ fontSize:12, color:'#718096' }}>NSS : {p.nss}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #e2e8f0', marginBottom:20 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'10px 20px', border:'none', background:'none', cursor:'pointer',
            fontSize:14, fontWeight: tab===t ? 600 : 400,
            color: tab===t ? '#1a3c5e' : '#718096',
            borderBottom: tab===t ? '2px solid #1a3c5e' : '2px solid transparent',
            marginBottom:-2,
          }}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Onglet info */}
      {tab === 'info' && (
        <div style={s.detail}>
          <div style={s.infoBlock}>
            <div style={s.infoTitle}>Informations personnelles</div>
            {[
              ['Nom complet',     `${p.prenom} ${p.nom}`],
              ['Date de naissance', p.date_naissance ? new Date(p.date_naissance).toLocaleDateString('fr-FR') : '—'],
              ['NSS',             p.nss],
              ['Service',         p.service],
              ['Groupe sanguin',  p.groupe_sanguin],
              ['Allergie',        p.allergie || 'Aucune connue'],
              ['Médecin référent',p.medecin_ref],
            ].map(([l, v]) => (
              <div key={l} style={s.infoRow}>
                <span style={s.infoLbl}>{l}</span>
                <span style={s.infoVal}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <ConsultationForm patientId={id} onSaved={() => apiFetch(`/api/patients/${id}`).then(setData)} />
            <PrescriptionForm patientId={id} onSaved={() => apiFetch(`/api/patients/${id}`).then(setData)} />
          </div>
        </div>
      )}

      {/* Onglet consultations */}
      {tab === 'consultations' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {!consultations.length && <div style={s.info}>Aucune consultation enregistrée.</div>}
          {consultations.map(c => (
            <div key={c.id} style={s.card}>
              <div style={{ ...s.cardHead, background:'#f7fafc' }}>
                <div>
                  <span style={{ fontWeight:600, color:'#1a3c5e' }}>
                    {new Date(c.date).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}
                  </span>
                  <span style={{ marginLeft:10, fontSize:12, color:'#718096' }}>Dr. {c.medecin}</span>
                </div>
              </div>
              <div style={s.cardBody}>
                <div style={{ marginBottom:8 }}><span style={s.infoLbl}>Motif : </span><strong>{c.motif}</strong></div>
                {c.diagnostic && <div style={{ marginBottom:8 }}><span style={s.infoLbl}>Diagnostic : </span>{c.diagnostic}</div>}
                {c.notes && <div style={{ padding:'10px', background:'#f7fafc', borderRadius:6, fontSize:13 }}>{c.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglet prescriptions */}
      {tab === 'prescriptions' && (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr>{['Date','Médecin','Médicament','Dosage','Durée','Renouveler'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!prescriptions.length && (
                <tr><td colSpan={6} style={{ ...s.td, textAlign:'center', color:'#718096', padding:24 }}>Aucune prescription</td></tr>
              )}
              {prescriptions.map(pr => (
                <tr key={pr.id}>
                  <td style={s.td}>{new Date(pr.date).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}>{pr.medecin}</td>
                  <td style={s.td}><strong>{pr.medicament}</strong></td>
                  <td style={s.td}>{pr.dosage}</td>
                  <td style={s.td}>{pr.duree}</td>
                  <td style={s.td}><Badge color={pr.renouveler ? 'green' : 'gray'}>{pr.renouveler ? 'Oui' : 'Non'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Formulaire consultation ────────────────────────────────────────────────────
function ConsultationForm({ patientId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ motif:'', diagnostic:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch(`/api/patients/${patientId}/consultations`, { method:'POST', body:JSON.stringify(form) });
      setOpen(false); setForm({ motif:'', diagnostic:'', notes:'' }); onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  };

  if (!open) return (
    <div style={s.infoBlock}>
      <div style={s.infoTitle}>Nouvelle consultation</div>
      <button style={s.btnPrimary} onClick={() => setOpen(true)}>+ Ajouter une consultation</button>
    </div>
  );

  return (
    <div style={s.infoBlock}>
      <div style={s.infoTitle}>Nouvelle consultation</div>
      <form style={s.form} onSubmit={handleSubmit}>
        <FieldGroup label="Motif *"><input style={s.input} value={form.motif} onChange={set('motif')} required /></FieldGroup>
        <FieldGroup label="Diagnostic"><input style={s.input} value={form.diagnostic} onChange={set('diagnostic')} /></FieldGroup>
        <FieldGroup label="Notes"><textarea style={s.textarea} value={form.notes} onChange={set('notes')} /></FieldGroup>
        {error && <div style={s.error}>{error}</div>}
        <div style={{ display:'flex', gap:8 }}>
          <button style={s.btnPrimary} disabled={saving}>{saving ? '...' : 'Enregistrer'}</button>
          <button type="button" style={s.btnSecond} onClick={() => setOpen(false)}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

// ── Formulaire prescription ────────────────────────────────────────────────────
function PrescriptionForm({ patientId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ medicament:'', dosage:'', duree:'', renouveler:false });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.type === 'checkbox' ? e.checked : e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch(`/api/patients/${patientId}/prescriptions`, { method:'POST', body:JSON.stringify(form) });
      setOpen(false); setForm({ medicament:'', dosage:'', duree:'', renouveler:false }); onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  };

  if (!open) return (
    <div style={s.infoBlock}>
      <div style={s.infoTitle}>Nouvelle prescription</div>
      <button style={{ ...s.btnPrimary, background:'#276749' }} onClick={() => setOpen(true)}>+ Ajouter une prescription</button>
    </div>
  );

  return (
    <div style={s.infoBlock}>
      <div style={s.infoTitle}>Nouvelle prescription</div>
      <form style={s.form} onSubmit={handleSubmit}>
        <FieldGroup label="Médicament *"><input style={s.input} value={form.medicament} onChange={set('medicament')} required /></FieldGroup>
        <div style={s.row2}>
          <FieldGroup label="Dosage"><input style={s.input} value={form.dosage} onChange={set('dosage')} placeholder="ex: 5mg/j" /></FieldGroup>
          <FieldGroup label="Durée"><input style={s.input} value={form.duree} onChange={set('duree')} placeholder="ex: 30 jours" /></FieldGroup>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
          <input type="checkbox" checked={form.renouveler} onChange={e => setForm(f => ({ ...f, renouveler: e.target.checked }))} />
          Renouvellement autorisé
        </label>
        {error && <div style={s.error}>{error}</div>}
        <div style={{ display:'flex', gap:8 }}>
          <button style={{ ...s.btnPrimary, background:'#276749' }} disabled={saving}>{saving ? '...' : 'Prescrire'}</button>
          <button type="button" style={s.btnSecond} onClick={() => setOpen(false)}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

// ── Dossiers urgents ───────────────────────────────────────────────────────────
function Urgents() {
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/api/patients')
      .then(d => setPatients((d.patients || []).filter(p => p.service === 'Oncologie')))
      .catch(() => {});
  }, []);

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:20 }}>🚨 Dossiers urgents</h1>
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Nom','Service','Allergie','Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {patients.map(p => (
              <tr key={p.id}>
                <td style={s.td}><strong>{p.nom} {p.prenom}</strong></td>
                <td style={s.td}><Badge color="orange">{p.service}</Badge></td>
                <td style={s.td}>{p.allergie ? <Badge color="red">{p.allergie}</Badge> : '—'}</td>
                <td style={s.td}><button style={s.btnSmall} onClick={() => navigate(`/patients/${p.id}`)}>Ouvrir</button></td>
              </tr>
            ))}
            {!patients.length && <tr><td colSpan={4} style={{ ...s.td, textAlign:'center', color:'#718096', padding:24 }}>Aucun dossier urgent</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── App principale ────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
          <Route path="/patients" element={<Protected><Layout><PatientList /></Layout></Protected>} />
          <Route path="/patients/:id" element={<Protected><Layout><PatientDetail /></Layout></Protected>} />
          <Route path="/urgents" element={<Protected><Layout><Urgents /></Layout></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
