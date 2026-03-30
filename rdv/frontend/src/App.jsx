import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';

// ── Auth ──────────────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('rdv_token'));
  const [user,  setUser]  = useState(JSON.parse(localStorage.getItem('rdv_user') || 'null'));
  const login  = (tok, usr) => { localStorage.setItem('rdv_token', tok); localStorage.setItem('rdv_user', JSON.stringify(usr)); setToken(tok); setUser(usr); };
  const logout = ()         => { localStorage.removeItem('rdv_token'); localStorage.removeItem('rdv_user'); setToken(null); setUser(null); };
  return <AuthCtx.Provider value={{ token, user, login, logout }}>{children}</AuthCtx.Provider>;
}

async function keycloakLogin(username, password) {
  const KC = process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080';
  const res = await fetch(`${KC}/realms/hopital/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'password', client_id:'hopital-frontend', username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Identifiants incorrects');
  const payload = JSON.parse(atob(data.access_token.split('.')[1]));
  return { token: data.access_token, user: payload };
}

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';
function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('rdv_token');
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...opts.headers },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d; });
}

function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  shell:    { display:'flex', minHeight:'100vh' },
  sidebar:  { width:220, background:'#1a4731', color:'white', display:'flex', flexDirection:'column' },
  brand:    { padding:'24px 20px 16px', fontSize:18, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.1)' },
  brandSub: { fontSize:12, fontWeight:400, opacity:0.7, display:'block', marginTop:2 },
  nav:      { flex:1, padding:'12px 0' },
  navLink:  { display:'block', padding:'10px 20px', color:'rgba(255,255,255,0.75)', textDecoration:'none', fontSize:14, borderLeft:'3px solid transparent' },
  navActive:{ color:'white', borderLeftColor:'#68d391', background:'rgba(255,255,255,0.08)' },
  userBox:  { padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)', fontSize:13 },
  userName: { fontWeight:600, marginBottom:2 },
  userRole: { opacity:0.6, fontSize:12, marginBottom:10 },
  logoutBtn:{ width:'100%', padding:'7px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:6, color:'white', cursor:'pointer', fontSize:12 },
  main:     { flex:1, background:'#f0f4f8', overflow:'auto' },
  page:     { padding:32, maxWidth:1100, margin:'0 auto' },
  pageHead: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 },
  title:    { fontSize:22, fontWeight:700, color:'#1a4731' },
  card:     { background:'white', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden', marginBottom:16 },
  cardHead: { padding:'14px 20px', borderBottom:'1px solid #e2e8f0', fontWeight:600, color:'#1a4731', display:'flex', justifyContent:'space-between', alignItems:'center' },
  cardBody: { padding:'20px' },
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { padding:'10px 14px', background:'#1a4731', color:'white', textAlign:'left', fontSize:12, fontWeight:600, textTransform:'uppercase' },
  td:       { padding:'11px 14px', borderBottom:'1px solid #e2e8f0', fontSize:13 },
  form:     { display:'flex', flexDirection:'column', gap:14 },
  label:    { fontSize:13, fontWeight:500, color:'#4a5568', marginBottom:3 },
  input:    { width:'100%', padding:'9px 12px', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14 },
  select:   { width:'100%', padding:'9px 12px', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14, background:'white' },
  row2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  btnPrimary:{ padding:'9px 20px', background:'#1a4731', color:'white', border:'none', borderRadius:7, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnDanger: { padding:'6px 14px', background:'#fff5f5', color:'#c53030', border:'1px solid #fc8181', borderRadius:6, fontSize:12, cursor:'pointer' },
  btnSmall:  { padding:'5px 12px', background:'#e6fffa', color:'#276749', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' },
  badge:    { display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600 },
  error:    { padding:'10px 14px', background:'#fff5f5', border:'1px solid #fc8181', borderRadius:7, color:'#c53030', fontSize:13 },
  success:  { padding:'10px 14px', background:'#f0fff4', border:'1px solid #68d391', borderRadius:7, color:'#276749', fontSize:13 },
  loginPage:{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1a4731 0%,#276749 100%)' },
  loginCard:{ background:'white', borderRadius:14, padding:'40px 48px', width:400, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  statsGrid:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 },
  statCard: { background:'white', borderRadius:10, padding:20, textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' },
  statNum:  { fontSize:36, fontWeight:700, marginBottom:4 },
};

function Badge({ color, children }) {
  const c = { green:{bg:'#f0fff4',text:'#276749'}, blue:{bg:'#ebf8ff',text:'#2b6cb0'}, red:{bg:'#fff5f5',text:'#c53030'}, orange:{bg:'#fffaf0',text:'#c05621'}, gray:{bg:'#f7fafc',text:'#4a5568'} };
  const cl = c[color] || c.gray;
  return <span style={{ ...s.badge, background:cl.bg, color:cl.text }}>{children}</span>;
}

function FieldGroup({ label, children }) {
  return <div><div style={s.label}>{label}</div>{children}</div>;
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [error, setError] = useState('');
  const [loading, setL]   = useState(false);

  const submit = async e => {
    e.preventDefault(); setL(true); setError('');
    try { const { token, user } = await keycloakLogin(username, password); login(token, user); navigate('/'); }
    catch (err) { setError(err.message); }
    finally { setL(false); }
  };

  return (
    <div style={s.loginPage}>
      <div style={s.loginCard}>
        <div style={{ textAlign:'center', fontSize:48, marginBottom:8 }}>🗓️</div>
        <h1 style={{ textAlign:'center', fontSize:22, fontWeight:700, color:'#1a4731', marginBottom:4 }}>Portail RDV</h1>
        <p style={{ textAlign:'center', fontSize:13, color:'#718096', marginBottom:28 }}>Hôpital Utopios · Rendez-vous</p>
        <form style={s.form} onSubmit={submit}>
          <FieldGroup label="Identifiant"><input style={s.input} value={username} onChange={e=>setU(e.target.value)} placeholder="pierre.employe" autoFocus /></FieldGroup>
          <FieldGroup label="Mot de passe"><input style={s.input} type="password" value={password} onChange={e=>setP(e.target.value)} /></FieldGroup>
          {error && <div style={s.error}>{error}</div>}
          <button style={{ ...s.btnPrimary, width:'100%', padding:'11px' }} disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        </form>
        <div style={{ marginTop:20, padding:'12px', background:'#f7fafc', borderRadius:8, fontSize:12, color:'#718096' }}>
          <strong>Comptes :</strong><br/>
          pierre.employe / Pierre2024! · marie.manager / Marie2024! · jean.dupont / Jean2024!
        </div>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = window.location.pathname;
  const roles = user?.roles || [];
  const navItems = [
    { to:'/',        icon:'📊', label:'Tableau de bord' },
    { to:'/mes-rdv', icon:'📅', label:'Mes rendez-vous' },
    { to:'/prendre', icon:'➕', label:'Prendre un RDV' },
    ...(roles.includes('medecin') || roles.includes('admin') ? [{ to:'/planning', icon:'🗓', label:'Planning' }] : []),
  ];
  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>🗓️ RDV<span style={s.brandSub}>Prise de rendez-vous</span></div>
        <nav style={s.nav}>
          {navItems.map(item => (
            <Link key={item.to} to={item.to} style={{ ...s.navLink, ...(loc===item.to ? s.navActive : {}) }}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div style={s.userBox}>
          <div style={s.userName}>{user?.given_name} {user?.family_name}</div>
          <div style={s.userRole}>{roles.includes('medecin') ? '🩺 Médecin' : roles.includes('manager') ? '👔 Manager' : '👤 Patient'}</div>
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/login'); }}>Déconnexion</button>
        </div>
      </aside>
      <main style={s.main}>{children}</main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const { user } = useAuth();
  const [rdvs, setRdvs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => { apiFetch('/api/rdv').then(d => setRdvs(d.rdvs || [])).catch(() => {}); }, []);

  const prochains = rdvs.filter(r => new Date(r.date) >= new Date() && r.statut === 'confirme');
  const passes    = rdvs.filter(r => r.statut === 'termine');

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:24 }}>Bonjour, {user?.given_name} 👋</h1>
      <div style={s.statsGrid}>
        {[
          { label:'Prochains RDV',    value:prochains.length, color:'#1a4731', icon:'📅' },
          { label:'RDV terminés',     value:passes.length,    color:'#2b6cb0', icon:'✅' },
          { label:'RDV total',        value:rdvs.length,      color:'#c05621', icon:'📊' },
        ].map((st,i) => (
          <div key={i} style={s.statCard}>
            <div style={{ fontSize:28, marginBottom:6 }}>{st.icon}</div>
            <div style={{ ...s.statNum, color:st.color }}>{st.value}</div>
            <div style={{ fontSize:13, color:'#718096' }}>{st.label}</div>
          </div>
        ))}
      </div>
      {prochains.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHead}>Prochains rendez-vous <button style={s.btnSmall} onClick={() => navigate('/mes-rdv')}>Voir tous</button></div>
          <table style={s.table}>
            <thead><tr>{['Date','Heure','Praticien','Spécialité','Motif','Type'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {prochains.slice(0,3).map(r => (
                <tr key={r._id}>
                  <td style={s.td}>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}><strong>{r.heure}</strong></td>
                  <td style={s.td}>{r.praticienNom}</td>
                  <td style={s.td}><Badge color="blue">{r.specialite}</Badge></td>
                  <td style={s.td}>{r.motif}</td>
                  <td style={s.td}><Badge color={r.type==='teleconsultation'?'orange':'green'}>{r.type}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Mes RDV ───────────────────────────────────────────────────────────────────
function MesRdv() {
  const [rdvs, setRdvs] = useState([]);
  const [msg,  setMsg]  = useState('');

  const load = () => apiFetch('/api/rdv').then(d => setRdvs(d.rdvs || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const annuler = async id => {
    if (!window.confirm('Annuler ce rendez-vous ?')) return;
    try {
      await apiFetch(`/api/rdv/${id}/annuler`, { method:'PATCH' });
      setMsg('Rendez-vous annulé.'); load();
    } catch (err) { setMsg(err.message); }
  };

  const statutColor = s => ({ confirme:'green', annule:'red', en_attente:'orange', termine:'gray' }[s] || 'gray');

  return (
    <div style={s.page}>
      <div style={s.pageHead}><h1 style={s.title}>Mes rendez-vous</h1></div>
      {msg && <div style={{ ...s.success, marginBottom:16 }}>{msg}</div>}
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Date','Heure','Praticien','Spécialité','Motif','Type','Statut','Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {!rdvs.length && <tr><td colSpan={8} style={{ ...s.td, textAlign:'center', padding:32, color:'#718096' }}>Aucun rendez-vous</td></tr>}
            {rdvs.map(r => (
              <tr key={r._id}>
                <td style={s.td}>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td style={s.td}><strong>{r.heure}</strong></td>
                <td style={s.td}>{r.praticienNom}</td>
                <td style={s.td}><Badge color="blue">{r.specialite}</Badge></td>
                <td style={s.td}>{r.motif}</td>
                <td style={s.td}><Badge color={r.type==='teleconsultation'?'orange':'green'}>{r.type==='teleconsultation'?'💻 Télé':'🏥 Présentiel'}</Badge></td>
                <td style={s.td}><Badge color={statutColor(r.statut)}>{r.statut}</Badge></td>
                <td style={s.td}>
                  {r.statut === 'confirme' && (
                    <button style={s.btnDanger} onClick={() => annuler(r._id)}>Annuler</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Prendre un RDV ────────────────────────────────────────────────────────────
function PrendreRdv() {
  const [step, setStep]           = useState(1);
  const [praticiens, setPrat]     = useState([]);
  const [selectedPrat, setSelPrat]= useState(null);
  const [form, setForm]           = useState({ date:'', heure:'09:00', motif:'', type:'presentiel' });
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => { apiFetch('/api/praticiens').then(d => setPrat(d.praticiens || [])).catch(() => {}); }, []);

  const heures = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];

  const confirmer = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch('/api/rdv', { method:'POST', body: JSON.stringify({
        praticienId:  selectedPrat.userId,
        praticienNom: `Dr. ${selectedPrat.prenom} ${selectedPrat.nom}`,
        specialite:   selectedPrat.specialite,
        date:         new Date(form.date),
        heure:        form.heure,
        motif:        form.motif,
        type:         form.type,
      })});
      setSuccess(true);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (success) return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth:500, margin:'60px auto' }}>
        <div style={{ ...s.cardBody, textAlign:'center', padding:40 }}>
          <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
          <h2 style={{ color:'#1a4731', marginBottom:8 }}>Rendez-vous confirmé !</h2>
          <p style={{ color:'#718096', marginBottom:20 }}>Dr. {selectedPrat?.prenom} {selectedPrat?.nom} · {form.heure} · {new Date(form.date).toLocaleDateString('fr-FR')}</p>
          <button style={s.btnPrimary} onClick={() => { setSuccess(false); setStep(1); setSelPrat(null); setForm({ date:'', heure:'09:00', motif:'', type:'presentiel' }); }}>
            Prendre un autre RDV
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.pageHead}><h1 style={s.title}>Prendre un rendez-vous</h1></div>

      {/* Steps */}
      <div style={{ display:'flex', gap:0, marginBottom:28 }}>
        {[{n:1,l:'Praticien'},{n:2,l:'Date & heure'},{n:3,l:'Confirmation'}].map(st => (
          <div key={st.n} style={{ flex:1, padding:'10px 16px', background: step===st.n ? '#1a4731' : step>st.n ? '#d1fae5' : 'white',
            color: step===st.n ? 'white' : step>st.n ? '#276749' : '#718096',
            border:'1px solid #e2e8f0', fontSize:13, fontWeight: step===st.n ? 700 : 400,
            borderRadius: st.n===1?'8px 0 0 8px':st.n===3?'0 8px 8px 0':'0' }}>
            {step>st.n?'✓ ':''}{st.n}. {st.l}
          </div>
        ))}
      </div>

      {/* Étape 1 : choisir praticien */}
      {step === 1 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {praticiens.map(p => (
            <div key={p._id} style={{ ...s.card, cursor:'pointer', border:`2px solid ${selectedPrat?.userId===p.userId?'#1a4731':'transparent'}` }}
              onClick={() => setSelPrat(p)}>
              <div style={{ ...s.cardBody, textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🩺</div>
                <div style={{ fontWeight:700, color:'#1a4731', marginBottom:4 }}>Dr. {p.prenom} {p.nom}</div>
                <Badge color="blue">{p.specialite}</Badge>
              </div>
            </div>
          ))}
          <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end' }}>
            <button style={{ ...s.btnPrimary, opacity: selectedPrat?1:0.4 }} disabled={!selectedPrat} onClick={() => setStep(2)}>
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 : date et heure */}
      {step === 2 && (
        <div style={{ ...s.card, maxWidth:560 }}>
          <div style={s.cardHead}>Dr. {selectedPrat?.prenom} {selectedPrat?.nom} · {selectedPrat?.specialite}</div>
          <div style={s.cardBody}>
            <div style={{ ...s.form }}>
              <FieldGroup label="Date *">
                <input style={s.input} type="date" value={form.date} min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f=>({...f,date:e.target.value}))} required />
              </FieldGroup>
              <FieldGroup label="Heure">
                <select style={s.select} value={form.heure} onChange={e => setForm(f=>({...f,heure:e.target.value}))}>
                  {heures.map(h => <option key={h}>{h}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Type de consultation">
                <select style={s.select} value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                  <option value="presentiel">🏥 Présentiel</option>
                  <option value="teleconsultation">💻 Téléconsultation</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Motif de la consultation *">
                <input style={s.input} value={form.motif} onChange={e => setForm(f=>({...f,motif:e.target.value}))} placeholder="ex: Douleurs thoraciques, contrôle annuel..." required />
              </FieldGroup>
              <div style={{ display:'flex', gap:10 }}>
                <button style={s.btnPrimary} disabled={!form.date||!form.motif} onClick={() => setStep(3)}>Suivant →</button>
                <button style={{ ...s.btnPrimary, background:'#718096' }} onClick={() => setStep(1)}>← Retour</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Étape 3 : confirmation */}
      {step === 3 && (
        <form style={{ ...s.card, maxWidth:560 }} onSubmit={confirmer}>
          <div style={s.cardHead}>Confirmer le rendez-vous</div>
          <div style={s.cardBody}>
            <div style={{ background:'#f0fff4', borderRadius:8, padding:16, marginBottom:16 }}>
              {[
                ['Praticien', `Dr. ${selectedPrat?.prenom} ${selectedPrat?.nom}`],
                ['Spécialité', selectedPrat?.specialite],
                ['Date', new Date(form.date).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})],
                ['Heure', form.heure],
                ['Type', form.type],
                ['Motif', form.motif],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #c6f6d5', fontSize:14 }}>
                  <span style={{ color:'#276749' }}>{l}</span>
                  <span style={{ fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
            {error && <div style={{ ...s.error, marginBottom:12 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button style={s.btnPrimary} type="submit" disabled={saving}>{saving?'Confirmation...':'✓ Confirmer le RDV'}</button>
              <button type="button" style={{ ...s.btnPrimary, background:'#718096' }} onClick={() => setStep(2)}>← Retour</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Planning (médecins) ───────────────────────────────────────────────────────
function Planning() {
  const [rdvs, setRdvs] = useState([]);
  const { user } = useAuth();

  useEffect(() => { apiFetch('/api/rdv').then(d => setRdvs(d.rdvs || [])).catch(() => {}); }, []);

  const aujourd = rdvs.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:24 }}>Planning — Tous les rendez-vous</h1>
      <div style={s.card}>
        <div style={s.cardHead}>Aujourd'hui ({aujourd.length} RDV)</div>
        <table style={s.table}>
          <thead><tr>{['Heure','Patient','Motif','Type','Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {!aujourd.length && <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', padding:24, color:'#718096' }}>Aucun RDV aujourd'hui</td></tr>}
            {aujourd.map(r => (
              <tr key={r._id}>
                <td style={s.td}><strong>{r.heure}</strong></td>
                <td style={s.td}>{r.patientNom}</td>
                <td style={s.td}>{r.motif}</td>
                <td style={s.td}><Badge color={r.type==='teleconsultation'?'orange':'green'}>{r.type}</Badge></td>
                <td style={s.td}><Badge color={r.statut==='confirme'?'green':r.statut==='annule'?'red':'gray'}>{r.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={s.card}>
        <div style={s.cardHead}>Tous les rendez-vous ({rdvs.length})</div>
        <table style={s.table}>
          <thead><tr>{['Date','Heure','Patient','Praticien','Motif','Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {rdvs.map(r => (
              <tr key={r._id}>
                <td style={s.td}>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td style={s.td}>{r.heure}</td>
                <td style={s.td}>{r.patientNom}</td>
                <td style={s.td}>{r.praticienNom}</td>
                <td style={s.td}>{r.motif}</td>
                <td style={s.td}><Badge color={r.statut==='confirme'?'green':r.statut==='annule'?'red':'gray'}>{r.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"   element={<LoginPage />} />
          <Route path="/"        element={<Protected><Layout><Dashboard  /></Layout></Protected>} />
          <Route path="/mes-rdv" element={<Protected><Layout><MesRdv    /></Layout></Protected>} />
          <Route path="/prendre" element={<Protected><Layout><PrendreRdv /></Layout></Protected>} />
          <Route path="/planning"element={<Protected><Layout><Planning  /></Layout></Protected>} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
