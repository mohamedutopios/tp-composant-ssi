import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';

// ── Auth ──────────────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('rh_token'));
  const [user,  setUser]  = useState(JSON.parse(localStorage.getItem('rh_user') || 'null'));
  const login  = (tok, usr) => { localStorage.setItem('rh_token', tok); localStorage.setItem('rh_user', JSON.stringify(usr)); setToken(tok); setUser(usr); };
  const logout = () => { localStorage.removeItem('rh_token'); localStorage.removeItem('rh_user'); setToken(null); setUser(null); };
  return <AuthCtx.Provider value={{ token, user, login, logout }}>{children}</AuthCtx.Provider>;
}

async function keycloakLogin(username, password) {
  const KC = process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8080';
  const res = await fetch(`${KC}/realms/hopital/protocol/openid-connect/token`, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ grant_type:'password', client_id:'hopital-frontend', username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Identifiants incorrects');
  const payload = JSON.parse(atob(data.access_token.split('.')[1]));
  return { token: data.access_token, user: payload };
}

const API = process.env.REACT_APP_API_URL || 'http://localhost:3003';
function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('rh_token');
  return fetch(`${API}${path}`, {
    ...opts,
    headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error||`HTTP ${r.status}`); return d; });
}

function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  shell:    { display:'flex', minHeight:'100vh' },
  sidebar:  { width:220, background:'#2d3748', color:'white', display:'flex', flexDirection:'column' },
  brand:    { padding:'24px 20px 16px', fontSize:18, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.1)' },
  brandSub: { fontSize:12, fontWeight:400, opacity:0.7, display:'block', marginTop:2 },
  nav:      { flex:1, padding:'12px 0' },
  navLink:  { display:'block', padding:'10px 20px', color:'rgba(255,255,255,0.75)', textDecoration:'none', fontSize:14, borderLeft:'3px solid transparent' },
  navActive:{ color:'white', borderLeftColor:'#a0aec0', background:'rgba(255,255,255,0.08)' },
  userBox:  { padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)', fontSize:13 },
  userName: { fontWeight:600, marginBottom:2 },
  userRole: { opacity:0.6, fontSize:12, marginBottom:10 },
  logoutBtn:{ width:'100%', padding:'7px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:6, color:'white', cursor:'pointer', fontSize:12 },
  main:     { flex:1, background:'#f0f4f8', overflow:'auto' },
  page:     { padding:32, maxWidth:1100, margin:'0 auto' },
  pageHead: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 },
  title:    { fontSize:22, fontWeight:700, color:'#2d3748' },
  card:     { background:'white', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden', marginBottom:16 },
  cardHead: { padding:'14px 20px', borderBottom:'1px solid #e2e8f0', fontWeight:600, color:'#2d3748', display:'flex', justifyContent:'space-between', alignItems:'center' },
  cardBody: { padding:'20px' },
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { padding:'10px 14px', background:'#2d3748', color:'white', textAlign:'left', fontSize:12, fontWeight:600, textTransform:'uppercase' },
  td:       { padding:'11px 14px', borderBottom:'1px solid #e2e8f0', fontSize:13 },
  form:     { display:'flex', flexDirection:'column', gap:14 },
  label:    { fontSize:13, fontWeight:500, color:'#4a5568', marginBottom:3 },
  input:    { width:'100%', padding:'9px 12px', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14 },
  select:   { width:'100%', padding:'9px 12px', border:'1px solid #cbd5e0', borderRadius:7, fontSize:14, background:'white' },
  row2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  btnPrimary:{ padding:'9px 20px', background:'#2d3748', color:'white', border:'none', borderRadius:7, fontSize:14, fontWeight:600, cursor:'pointer' },
  btnSmall: { padding:'5px 12px', background:'#edf2f7', color:'#2d3748', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' },
  btnGreen: { padding:'5px 12px', background:'#c6f6d5', color:'#276749', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' },
  btnRed:   { padding:'5px 12px', background:'#fff5f5', color:'#c53030', border:'none', borderRadius:5, fontSize:12, cursor:'pointer' },
  badge:    { display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600 },
  error:    { padding:'10px 14px', background:'#fff5f5', border:'1px solid #fc8181', borderRadius:7, color:'#c53030', fontSize:13 },
  success:  { padding:'10px 14px', background:'#f0fff4', border:'1px solid #68d391', borderRadius:7, color:'#276749', fontSize:13 },
  warning:  { padding:'10px 14px', background:'#fffaf0', border:'1px solid #f6ad55', borderRadius:7, color:'#c05621', fontSize:13 },
  loginPage:{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#2d3748 0%,#4a5568 100%)' },
  loginCard:{ background:'white', borderRadius:14, padding:'40px 48px', width:400, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  statsGrid:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 },
  statCard: { background:'white', borderRadius:10, padding:18, textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' },
};

function Badge({ color, children }) {
  const c = { green:{bg:'#f0fff4',text:'#276749'}, blue:{bg:'#ebf8ff',text:'#2b6cb0'}, red:{bg:'#fff5f5',text:'#c53030'}, orange:{bg:'#fffaf0',text:'#c05621'}, gray:{bg:'#f7fafc',text:'#4a5568'}, purple:{bg:'#faf5ff',text:'#6b46c1'} };
  const cl = c[color] || c.gray;
  return <span style={{ ...s.badge, background:cl.bg, color:cl.text }}>{children}</span>;
}

function FieldGroup({ label, children }) {
  return <div><div style={s.label}>{label}</div>{children}</div>;
}

function Spinner() { return <div style={{ textAlign:'center', padding:40, color:'#718096' }}>Chargement...</div>; }

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
        <div style={{ textAlign:'center', fontSize:48, marginBottom:8 }}>👥</div>
        <h1 style={{ textAlign:'center', fontSize:22, fontWeight:700, color:'#2d3748', marginBottom:4 }}>Portail RH</h1>
        <p style={{ textAlign:'center', fontSize:13, color:'#718096', marginBottom:28 }}>Hôpital Utopios · Ressources Humaines</p>
        <form style={s.form} onSubmit={submit}>
          <FieldGroup label="Identifiant"><input style={s.input} value={username} onChange={e=>setU(e.target.value)} placeholder="marie.manager" autoFocus /></FieldGroup>
          <FieldGroup label="Mot de passe"><input style={s.input} type="password" value={password} onChange={e=>setP(e.target.value)} /></FieldGroup>
          {error && <div style={s.error}>{error}</div>}
          <button style={{ ...s.btnPrimary, width:'100%', padding:'11px' }} disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
        </form>
        <div style={{ marginTop:20, padding:'12px', background:'#f7fafc', borderRadius:8, fontSize:12, color:'#718096' }}>
          <strong>Comptes :</strong><br/>
          Manager : marie.manager / Marie2024!<br/>
          Employé : pierre.employe / Pierre2024!<br/>
          Admin   : admin.hopital / Admin2024!
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
  const isManager = roles.includes('manager') || roles.includes('admin');

  const navItems = [
    { to:'/',           icon:'📊', label:'Tableau de bord' },
    { to:'/mon-profil', icon:'👤', label:'Mon profil' },
    { to:'/mes-conges', icon:'🏖️', label:'Mes congés' },
    { to:'/planning',   icon:'📅', label:'Mon planning' },
    ...(isManager ? [
      { to:'/employes',   icon:'👥', label:'Employés' },
      { to:'/paie',       icon:'💰', label:'Paie' },
    ] : []),
  ];

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>👥 RH<span style={s.brandSub}>Ressources Humaines</span></div>
        <nav style={s.nav}>
          {navItems.map(item => (
            <Link key={item.to} to={item.to} style={{ ...s.navLink, ...(loc===item.to ? s.navActive:{}) }}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div style={s.userBox}>
          <div style={s.userName}>{user?.given_name} {user?.family_name}</div>
          <div style={s.userRole}>{isManager ? '👔 Manager' : '👤 Employé'}</div>
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
  const [employes, setEmployes] = useState([]);
  const [conges,   setConges]   = useState([]);
  const navigate  = useNavigate();
  const roles = user?.roles || [];
  const isManager = roles.includes('manager') || roles.includes('admin');

  useEffect(() => {
    if (isManager) {
      apiFetch('/api/employes').then(d => setEmployes(d.employes || [])).catch(() => {});
    }
  }, [isManager]);

  const actifs    = employes.filter(e => e.statut === 'actif').length;
  const enConge   = employes.filter(e => e.statut === 'conge').length;

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:24 }}>Bonjour, {user?.given_name} 👋</h1>

      {isManager && (
        <div style={s.statsGrid}>
          {[
            { label:'Employés total', value:employes.length, color:'#2d3748', icon:'👥' },
            { label:'Actifs',         value:actifs,          color:'#276749', icon:'✅' },
            { label:'En congé',       value:enConge,         color:'#c05621', icon:'🏖️' },
            { label:'Congés en attente', value:'—',          color:'#6b46c1', icon:'⏳' },
          ].map((st,i) => (
            <div key={i} style={s.statCard}>
              <div style={{ fontSize:26, marginBottom:6 }}>{st.icon}</div>
              <div style={{ fontSize:28, fontWeight:700, color:st.color, marginBottom:4 }}>{st.value}</div>
              <div style={{ fontSize:12, color:'#718096' }}>{st.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: isManager ? '1fr 1fr' : '1fr', gap:16 }}>
        <div style={s.card}>
          <div style={s.cardHead}>Accès rapides</div>
          <div style={{ ...s.cardBody, display:'flex', flexDirection:'column', gap:10 }}>
            <button style={{ ...s.btnPrimary, width:'100%', textAlign:'left', padding:'12px 16px' }} onClick={() => navigate('/mes-conges')}>
              🏖️ Demander un congé
            </button>
            <button style={{ ...s.btnPrimary, width:'100%', textAlign:'left', padding:'12px 16px', background:'#4a5568' }} onClick={() => navigate('/planning')}>
              📅 Voir mon planning
            </button>
            <button style={{ ...s.btnPrimary, width:'100%', textAlign:'left', padding:'12px 16px', background:'#744210' }} onClick={() => navigate('/mon-profil')}>
              👤 Ma fiche & mes fiches de paie
            </button>
          </div>
        </div>

        {isManager && (
          <div style={s.card}>
            <div style={s.cardHead}>Derniers employés <button style={s.btnSmall} onClick={() => navigate('/employes')}>Voir tous</button></div>
            <table style={s.table}>
              <thead><tr>{['Nom','Service','Poste','Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {employes.slice(0,4).map(e => (
                  <tr key={e.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/employes/${e.id}`)}>
                    <td style={s.td}><strong>{e.nom} {e.prenom}</strong></td>
                    <td style={s.td}><Badge color="blue">{e.service}</Badge></td>
                    <td style={s.td}>{e.poste}</td>
                    <td style={s.td}><Badge color={e.statut==='actif'?'green':'orange'}>{e.statut}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Liste employés ─────────────────────────────────────────────────────────────
function Employes() {
  const [employes, setEmployes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/api/employes').then(d => { setEmployes(d.employes || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={s.page}>
      <div style={s.pageHead}><h1 style={s.title}>Employés ({employes.length})</h1></div>
      <div style={s.card}>
        {loading ? <Spinner /> : (
          <table style={s.table}>
            <thead><tr>{['Matricule','Nom','Service','Poste','Contrat','Salaire brut','Statut','Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {employes.map(e => (
                <tr key={e.id}>
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:11 }}>{e.matricule}</td>
                  <td style={s.td}><strong>{e.nom} {e.prenom}</strong></td>
                  <td style={s.td}><Badge color="blue">{e.service}</Badge></td>
                  <td style={s.td}>{e.poste}</td>
                  <td style={s.td}><Badge color={e.type_contrat==='CDI'?'green':'orange'}>{e.type_contrat}</Badge></td>
                  <td style={s.td}>{e.salaire_brut ? `${Number(e.salaire_brut).toLocaleString('fr-FR')} €` : '—'}</td>
                  <td style={s.td}><Badge color={e.statut==='actif'?'green':'gray'}>{e.statut}</Badge></td>
                  <td style={s.td}><button style={s.btnSmall} onClick={() => navigate(`/employes/${e.id}`)}>Voir fiche</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Fiche employé ─────────────────────────────────────────────────────────────
function FicheEmploye() {
  const { id } = useParams();
  const [data,    setData]    = useState(null);
  const [fiches,  setFiches]  = useState([]);
  const [tab,     setTab]     = useState('info');
  const navigate = useNavigate();

  useEffect(() => {
    // ⚠ IDOR : l'ID dans l'URL peut être n'importe quel employé
    apiFetch(`/api/employes/${id}`).then(setData).catch(() => {});
    apiFetch(`/api/paie/${id}`).then(d => setFiches(d.fiches || [])).catch(() => {});
  }, [id]);

  if (!data) return <Spinner />;
  const { employe: e, contrats, conges, planning } = data;

  return (
    <div style={s.page}>
      <button style={{ ...s.btnSmall, marginBottom:16 }} onClick={() => navigate(-1)}>← Retour</button>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={s.title}>{e.prenom} {e.nom}</h1>
          <div style={{ display:'flex', gap:10, marginTop:6 }}>
            <Badge color="blue">{e.service}</Badge>
            <Badge color="gray">{e.poste}</Badge>
            <Badge color={e.statut==='actif'?'green':'orange'}>{e.statut}</Badge>
            <span style={{ fontSize:12, color:'#718096', fontFamily:'monospace' }}>{e.matricule}</span>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:20 }}>
        {['info','paie','conges','planning'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:14,
            fontWeight:tab===t?700:400, color:tab===t?'#2d3748':'#718096',
            borderBottom: tab===t?'2px solid #2d3748':'2px solid transparent', marginBottom:-2,
          }}>
            {{ info:'Informations', paie:`Fiches de paie (${fiches.length})`, conges:`Congés (${conges.length})`, planning:`Planning (${planning.length})` }[t]}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={s.card}>
            <div style={s.cardHead}>Informations personnelles</div>
            <div style={s.cardBody}>
              {[['Nom','',`${e.prenom} ${e.nom}`],['NSS','',e.nss||'—'],['Email','',e.email||'—'],['Embauche','',e.date_embauche?new Date(e.date_embauche).toLocaleDateString('fr-FR'):'—']].map(([l,,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f7fafc', fontSize:13 }}>
                  <span style={{ color:'#718096' }}>{l}</span>
                  <span style={{ fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={s.card}>
            <div style={s.cardHead}>Contrats</div>
            <table style={s.table}>
              <thead><tr>{['Type','Début','Salaire','Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {contrats.map(c => (
                  <tr key={c.id}>
                    <td style={s.td}><Badge color={c.type==='CDI'?'green':'orange'}>{c.type}</Badge></td>
                    <td style={s.td}>{new Date(c.date_debut).toLocaleDateString('fr-FR')}</td>
                    <td style={{ ...s.td, fontWeight:700 }}>{Number(c.salaire_brut).toLocaleString('fr-FR')} €</td>
                    <td style={s.td}><Badge color={c.statut==='actif'?'green':'gray'}>{c.statut}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'paie' && (
        <div style={s.card}>
          <div style={s.cardHead}>Fiches de paie</div>
          <table style={s.table}>
            <thead><tr>{['Période','Brut','Cotisations','Net','Prime','IBAN','Virement'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {!fiches.length && <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', padding:24, color:'#718096' }}>Aucune fiche</td></tr>}
              {fiches.map(f => (
                <tr key={f.id}>
                  <td style={s.td}><strong>{['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][f.mois-1]} {f.annee}</strong></td>
                  <td style={s.td}>{Number(f.salaire_brut).toLocaleString('fr-FR')} €</td>
                  <td style={s.td}>{Number(f.cotisations).toLocaleString('fr-FR')} €</td>
                  <td style={{ ...s.td, fontWeight:700, color:'#276749' }}>{Number(f.salaire_net).toLocaleString('fr-FR')} €</td>
                  <td style={s.td}>{f.prime > 0 ? `+ ${Number(f.prime).toLocaleString('fr-FR')} €` : '—'}</td>
                  {/* ⚠ IDOR : IBAN affiché sans restriction de rôle */}
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:11, color:'#c05621' }}>{f.iban}</td>
                  <td style={s.td}>{f.date_virement ? new Date(f.date_virement).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'conges' && (
        <div style={s.card}>
          <table style={s.table}>
            <thead><tr>{['Type','Début','Fin','Jours','Motif','Statut','Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {!conges.length && <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', padding:24, color:'#718096' }}>Aucun congé</td></tr>}
              {conges.map(c => (
                <tr key={c.id}>
                  <td style={s.td}><Badge color="blue">{c.type?.replace('_',' ')}</Badge></td>
                  <td style={s.td}>{new Date(c.date_debut).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}>{new Date(c.date_fin).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}>{c.nb_jours || '—'}</td>
                  <td style={s.td}>{c.motif || '—'}</td>
                  <td style={s.td}><Badge color={c.statut==='approuve'?'green':c.statut==='refuse'?'red':'orange'}>{c.statut}</Badge></td>
                  <td style={s.td}>
                    {c.statut === 'en_attente' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button style={s.btnGreen} onClick={async () => { await apiFetch(`/api/conges/${c.id}`, { method:'PATCH', body:JSON.stringify({ statut:'approuve' }) }); apiFetch(`/api/employes/${id}`).then(setData); }}>✓</button>
                        <button style={s.btnRed}   onClick={async () => { await apiFetch(`/api/conges/${c.id}`, { method:'PATCH', body:JSON.stringify({ statut:'refuse' }) }); apiFetch(`/api/employes/${id}`).then(setData); }}>✗</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'planning' && (
        <div style={s.card}>
          <table style={s.table}>
            <thead><tr>{['Date','Début','Fin','Type','Service'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {!planning.length && <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', padding:24, color:'#718096' }}>Aucun planning</td></tr>}
              {planning.map(p => (
                <tr key={p.id}>
                  <td style={s.td}>{new Date(p.date_shift).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}>{p.heure_debut}</td>
                  <td style={s.td}>{p.heure_fin}</td>
                  <td style={s.td}><Badge color={p.type_shift==='matin'?'blue':'orange'}>{p.type_shift}</Badge></td>
                  <td style={s.td}>{p.service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Mon profil (employé connecté) ─────────────────────────────────────────────
function MonProfil() {
  const { user } = useAuth();
  const [fiches,   setFiches]   = useState([]);
  const [employes, setEmployes] = useState([]);

  // Trouver l'ID de l'employé connecté
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    // On charge la liste pour retrouver l'ID par username
    apiFetch('/api/employes').then(d => {
      const all = d.employes || [];
      setEmployes(all);
      // Mapping approximatif : username keycloak ↔ matricule/nom
      const me = all.find(e =>
        e.email?.startsWith(user?.preferred_username?.replace('.','.'))||
        e.nom?.toLowerCase() === (user?.family_name||'').toLowerCase()
      );
      if (me) { setMyId(me.id); apiFetch(`/api/paie/${me.id}`).then(d => setFiches(d.fiches||[])); }
    }).catch(() => {
      // Si pas accès à /api/employes (employé sans rôle manager), essayer avec ID 3 par défaut
      setMyId(3);
      apiFetch('/api/paie/3').then(d => setFiches(d.fiches||[])).catch(() => {});
    });
  }, []);

  const navigate = useNavigate();

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:24 }}>Mon profil</h1>
      <div style={s.card}>
        <div style={s.cardHead}>Informations Keycloak</div>
        <div style={s.cardBody}>
          {[
            ['Identifiant',   user?.preferred_username],
            ['Prénom',        user?.given_name],
            ['Nom',           user?.family_name],
            ['Email',         user?.email],
            ['Rôles',         (user?.roles||[]).join(', ')],
            ['Service',       user?.service || '—'],
          ].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f7fafc', fontSize:13 }}>
              <span style={{ color:'#718096' }}>{l}</span>
              <span style={{ fontWeight:500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {fiches.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHead}>Mes fiches de paie</div>
          <table style={s.table}>
            <thead><tr>{['Période','Brut','Net','IBAN'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {fiches.map(f => (
                <tr key={f.id}>
                  <td style={s.td}><strong>{['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][f.mois-1]} {f.annee}</strong></td>
                  <td style={s.td}>{Number(f.salaire_brut).toLocaleString('fr-FR')} €</td>
                  <td style={{ ...s.td, fontWeight:700, color:'#276749' }}>{Number(f.salaire_net).toLocaleString('fr-FR')} €</td>
                  <td style={{ ...s.td, fontFamily:'monospace', fontSize:11 }}>{f.iban}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {myId && <button style={{ ...s.btnSmall, marginTop:8 }} onClick={() => navigate(`/employes/${myId}`)}>Voir ma fiche complète</button>}
    </div>
  );
}

// ── Mes Congés ────────────────────────────────────────────────────────────────
function MesConges() {
  const { user } = useAuth();
  const [conges,  setConges]  = useState([]);
  const [form,    setForm]    = useState({ type:'conges_payes', date_debut:'', date_fin:'', motif:'' });
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');

  // Trouver l'ID employé connecté (simplifié)
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    // On essaie les premiers IDs pour trouver notre profil
    const checkIds = async () => {
      for (let id = 1; id <= 6; id++) {
        try {
          const d = await apiFetch(`/api/employes/${id}`);
          if (d.employe?.email?.includes(user?.preferred_username?.split('.')[0])) {
            setMyId(id);
            setConges(d.conges || []);
            break;
          }
        } catch { /* skip */ }
      }
    };
    checkIds();
  }, []);

  const submit = async e => {
    e.preventDefault(); setError(''); setMsg('');
    if (!myId) return setError('Profil non trouvé');
    try {
      const nb = Math.ceil((new Date(form.date_fin)-new Date(form.date_debut))/(86400000)) + 1;
      await apiFetch('/api/conges', { method:'POST', body: JSON.stringify({ ...form, employe_id:myId, nb_jours:nb }) });
      setMsg('Demande de congé envoyée !');
      setForm({ type:'conges_payes', date_debut:'', date_fin:'', motif:'' });
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:24 }}>Mes congés</h1>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:16 }}>
        <div style={s.card}>
          <div style={s.cardHead}>Nouvelle demande</div>
          <div style={s.cardBody}>
            <form style={s.form} onSubmit={submit}>
              <FieldGroup label="Type de congé">
                <select style={s.select} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="conges_payes">Congés payés</option>
                  <option value="rtt">RTT</option>
                  <option value="maladie">Maladie</option>
                  <option value="sans_solde">Sans solde</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Date début">
                <input style={s.input} type="date" value={form.date_debut} onChange={e=>setForm(f=>({...f,date_debut:e.target.value}))} required />
              </FieldGroup>
              <FieldGroup label="Date fin">
                <input style={s.input} type="date" value={form.date_fin} onChange={e=>setForm(f=>({...f,date_fin:e.target.value}))} required />
              </FieldGroup>
              <FieldGroup label="Motif">
                <input style={s.input} value={form.motif} onChange={e=>setForm(f=>({...f,motif:e.target.value}))} />
              </FieldGroup>
              {error && <div style={s.error}>{error}</div>}
              {msg   && <div style={s.success}>{msg}</div>}
              <button style={s.btnPrimary}>Envoyer la demande</button>
            </form>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.cardHead}>Historique</div>
          <table style={s.table}>
            <thead><tr>{['Type','Du','Au','Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {!conges.length && <tr><td colSpan={4} style={{ ...s.td, textAlign:'center', padding:24, color:'#718096' }}>Aucun congé</td></tr>}
              {conges.map(c => (
                <tr key={c.id}>
                  <td style={s.td}><Badge color="blue">{c.type?.replace('_',' ')}</Badge></td>
                  <td style={s.td}>{new Date(c.date_debut).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}>{new Date(c.date_fin).toLocaleDateString('fr-FR')}</td>
                  <td style={s.td}><Badge color={c.statut==='approuve'?'green':c.statut==='refuse'?'red':'orange'}>{c.statut}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Mon Planning ───────────────────────────────────────────────────────────────
function MonPlanning() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    // Chercher le planning de l'employé connecté
    const findPlanning = async () => {
      for (let id = 1; id <= 6; id++) {
        try {
          const d = await apiFetch(`/api/employes/${id}`);
          if (d.employe?.email?.includes(user?.preferred_username?.split('.')[0])) {
            setShifts(d.planning || []); break;
          }
        } catch { /* skip */ }
      }
    };
    findPlanning();
  }, []);

  return (
    <div style={s.page}>
      <h1 style={{ ...s.title, marginBottom:24 }}>Mon planning</h1>
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>{['Date','Heure début','Heure fin','Type','Service'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {!shifts.length && <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', padding:32, color:'#718096' }}>Aucun shift planifié</td></tr>}
            {shifts.map(p => (
              <tr key={p.id}>
                <td style={s.td}><strong>{new Date(p.date_shift).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</strong></td>
                <td style={s.td}>{p.heure_debut}</td>
                <td style={s.td}>{p.heure_fin}</td>
                <td style={s.td}><Badge color={p.type_shift==='matin'?'blue':'orange'}>{p.type_shift}</Badge></td>
                <td style={s.td}>{p.service}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Paie (manager) ─────────────────────────────────────────────────────────────
function Paie() {
  const navigate = useNavigate();
  return (
    <div style={s.page}>
      <div style={s.pageHead}><h1 style={s.title}>Gestion de la paie</h1></div>
      <div style={{ ...s.warning, marginBottom:20 }}>
        ⚠ <strong>Phase 1 :</strong> L'export CSV des fiches de paie (avec IBAN) est accessible sans vérification de rôle stricte.
      </div>
      <div style={s.card}>
        <div style={s.cardHead}>Export</div>
        <div style={s.cardBody}>
          <p style={{ fontSize:14, color:'#4a5568', marginBottom:16 }}>Exporter toutes les fiches de paie (salaires + IBAN) au format CSV.</p>
          <a href={`${API}/api/paie/export/csv`}
             style={{ ...s.btnPrimary, display:'inline-block', textDecoration:'none' }}>
            💾 Télécharger CSV (tous les IBAN)
          </a>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHead}>Fiches par employé</div>
        <div style={s.cardBody}>
          <p style={{ fontSize:13, color:'#718096', marginBottom:14 }}>Cliquer sur un employé dans la liste pour voir ses fiches de paie.</p>
          <button style={s.btnPrimary} onClick={() => navigate('/employes')}>Voir la liste des employés →</button>
        </div>
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
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/"             element={<Protected><Layout><Dashboard    /></Layout></Protected>} />
          <Route path="/employes"     element={<Protected><Layout><Employes     /></Layout></Protected>} />
          <Route path="/employes/:id" element={<Protected><Layout><FicheEmploye /></Layout></Protected>} />
          <Route path="/mon-profil"   element={<Protected><Layout><MonProfil    /></Layout></Protected>} />
          <Route path="/mes-conges"   element={<Protected><Layout><MesConges    /></Layout></Protected>} />
          <Route path="/planning"     element={<Protected><Layout><MonPlanning  /></Layout></Protected>} />
          <Route path="/paie"         element={<Protected><Layout><Paie         /></Layout></Protected>} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
