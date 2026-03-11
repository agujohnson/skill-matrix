import { useState, useEffect, useCallback } from 'react'
import {
  auth, login, register, loginWithMicrosoft, logout,
  getUserProfile, createUserProfile,
  onUsersSnapshot, updateUserProfile, deleteUserData,
  submitSuggestion as fbSubmitSuggestion, onSuggestionsSnapshot, approveSuggestion, rejectSuggestion,
  saveAssessment, saveAssessmentsBulk, getAssessments, onAssessmentsSnapshot,
  saveUserCerts, getUserCerts, onUserCertsSnapshot,
  getCategories, saveCategories,
  getCertsLibrary, saveCertsLibrary,
  getInviteCode, saveInviteCode,
  savePendingUser, getPendingUserByEmail, deletePendingUser, onPendingUsersSnapshot,
} from './firebase.js'
import { onAuthStateChanged } from 'firebase/auth'

// ─── Palette & Fonts ──────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink:     #f0f0f5;
    --paper:   #0a0a0f;
    --panel:   #13131a;
    --panel2:  #1a1a24;
    --muted:   #6b6b80;
    --border:  #2a2a38;
    --accent:  #e00080;
    --accent2: #ff2d9b;
    --success: #00d084;
    --warn:    #ffb800;
    --danger:  #ff4444;
    --grad:    linear-gradient(135deg, #e00080 0%, #ff6030 100%);
    --glow:    0 0 24px #e0008044;
  }

  html, body, #root { height: 100%; font-family: 'Inter', sans-serif; background: var(--paper); color: var(--ink); }
  h1,h2,h3,h4,h5 { font-family: 'Space Grotesk', sans-serif; }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--paper); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent); }

  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes glow { 0%,100% { box-shadow: 0 0 20px #e0008033; } 50% { box-shadow: 0 0 40px #e0008066; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fadeUp { animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
  select { color: #f0f0f5 !important; }
  select option { background: #1a1a24 !important; color: #f0f0f5 !important; }
  select option:disabled { color: #6b6b80 !important; }
`

// ─── Seed Data (used on first load if Firestore is empty) ─────────────────────
const SEED_CATS = [
  {
    id: 'c1', name: 'Cloud', color: '#2563eb',
    skills: [
      { id: 's1', name: 'Kubernetes / K8s' },
      { id: 's2', name: 'OpenShift' },
      { id: 's3', name: 'AWS' },
      { id: 's4', name: 'Azure' },
      { id: 's5', name: 'GCP' },
      { id: 's6', name: 'OpenStack' },
    ],
  },
  {
    id: 'c2', name: 'DevOps & Automation', color: '#7c3aed',
    skills: [
      { id: 's7',  name: 'Ansible' },
      { id: 's8',  name: 'Terraform / IaC' },
      { id: 's9',  name: 'CI/CD Pipelines' },
      { id: 's10', name: 'Git / GitOps' },
      { id: 's11', name: 'Docker / Containers' },
    ],
  },
  {
    id: 'c3', name: 'Networking', color: '#0891b2',
    skills: [
      { id: 's12', name: 'BGP / OSPF / Routing' },
      { id: 's13', name: 'VLANs / Switching' },
      { id: 's14', name: 'IPv4 / IPv6' },
      { id: 's15', name: 'SD-WAN' },
      { id: 's16', name: 'Firewall / Security' },
    ],
  },
  {
    id: 'c4', name: 'Programming', color: '#059669',
    skills: [
      { id: 's17', name: 'Python' },
      { id: 's18', name: 'Bash / Shell' },
      { id: 's19', name: 'Go' },
      { id: 's20', name: 'YAML / JSON' },
    ],
  },
  {
    id: 'c5', name: 'Observability', color: '#d97706',
    skills: [
      { id: 's21', name: 'Prometheus / Grafana' },
      { id: 's22', name: 'ELK Stack' },
      { id: 's23', name: 'Jaeger / Tracing' },
    ],
  },
]

const SEED_CERTS = [
  { id: 'cert1', name: 'CKA – Certified Kubernetes Administrator', provider: 'CNCF',        level: 'Professional'  },
  { id: 'cert2', name: 'AWS Solutions Architect – Associate',       provider: 'AWS',         level: 'Associate'     },
  { id: 'cert3', name: 'Google Associate Cloud Engineer',            provider: 'GCP',         level: 'Associate'     },
  { id: 'cert4', name: 'Azure Fundamentals AZ-900',                  provider: 'Microsoft',   level: 'Fundamentals'  },
  { id: 'cert5', name: 'CCNA',                                        provider: 'Cisco',       level: 'Associate'     },
  { id: 'cert6', name: 'HashiCorp Terraform Associate',               provider: 'HashiCorp',   level: 'Associate'     },
  { id: 'cert7', name: 'Red Hat RHCSA',                               provider: 'Red Hat',     level: 'Associate'     },
]

const PROFICIENCY = [
  { val: 0, label: 'N/A',       color: '#1e1e2a', textColor: '#4a4a60' },
  { val: 1, label: 'Awareness', color: '#2a0a1a', textColor: '#e00080' },
  { val: 2, label: 'Working',   color: '#1f1a00', textColor: '#ffc400' },
  { val: 3, label: 'Advanced',  color: '#0d1a2e', textColor: '#4a90d9' },
  { val: 4, label: 'Expert',    color: '#0a1f18', textColor: '#00c87a' },
]

const INTEREST = ['Low', 'Medium', 'High']

const PRACTICES = [
  'AI Engineering',
  'Cloud Engineering',
  'Core Network Eng',
  'HR/Recruiting',
  'Network Operations Eng',
  'RAN Network Eng',
  'Software Engineering',
  'Testing Engineering',
  'Transport Network Eng',
  'Voice and Signaling Eng',
]


// ─── UI helpers ───────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 36, style: s = {} }) => {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},60%,35%)`,
      border: `1.5px solid hsl(${hue},60%,45%)`,
      color: `hsl(${hue},80%,85%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: size * 0.36, flexShrink: 0, ...s,
    }}>{initials}</div>
  )
}

const Badge = ({ label, color, textColor }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: 99,
    background: color, color: textColor, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  }}>{label}</span>
)

const ProfBadge = ({ val }) => {
  const p = PROFICIENCY[val] || PROFICIENCY[0]
  return <Badge label={p.label} color={p.color} textColor={p.textColor} />
}

const Btn = ({ children, onClick, variant = 'primary', small = false, disabled = false, style: s = {} }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: small ? '6px 14px' : '10px 22px',
    borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: small ? 12 : 14,
    transition: 'all .2s', opacity: disabled ? .4 : 1, letterSpacing: '.01em',
  }
  const variants = {
    primary:   { background: 'var(--grad)', color: '#fff', boxShadow: 'var(--glow)' },
    secondary: { background: 'var(--panel2)', color: 'var(--ink)', border: '1px solid var(--border)' },
    danger:    { background: '#2a0a0a', color: 'var(--danger)', border: '1px solid #3a1a1a' },
    ghost:     { background: 'transparent', color: 'var(--accent)', padding: small ? '4px 8px' : '8px 12px' },
  }
  return <button style={{ ...base, ...variants[variant], ...s }} onClick={onClick} disabled={disabled}>{children}</button>
}

const Input = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Space Grotesk, sans-serif' }}>{label}</label>}
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
        fontFamily: 'Inter, sans-serif', fontSize: 14, background: 'var(--panel2)',
        color: 'var(--ink)', outline: 'none', transition: 'border-color .15s',
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px #e0008022'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
    />
  </div>
)

const Card = ({ children, style: s = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: 'var(--panel)', borderRadius: 12, border: '1px solid var(--border)',
    padding: 20, transition: 'all .2s', cursor: onClick ? 'pointer' : 'default',
    ...(onClick ? {} : {}), ...s,
  }}
  onMouseEnter={onClick ? e => { e.currentTarget.style.borderColor = '#e0008055'; e.currentTarget.style.transform = 'translateY(-1px)'; } : undefined}
  onMouseLeave={onClick ? e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; } : undefined}
  >{children}</div>
)

const Spinner = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, background: 'var(--paper)' }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'glow 1.5s ease-in-out infinite' }}>
      <span style={{ color: '#fff', fontSize: 18 }}>◈</span>
    </div>
    <span style={{ color: 'var(--muted)', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, letterSpacing: '.06em' }}>LOADING…</span>
  </div>
)

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser]       = useState(undefined) // undefined = loading
  const [profile, setProfile]         = useState(null)
  const [categories, setCategories]   = useState(SEED_CATS)
  const [certs, setCerts]             = useState(SEED_CERTS)
  const [assessments, setAssessments] = useState({})
  const [userCerts, setUserCerts]     = useState({})
  const [suggestions, setSuggestions] = useState([])
  const [allUsers, setAllUsers]       = useState([])
  const [pendingUsers, setPendingUsers] = useState([])

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const p = await getUserProfile(u.uid)
        setProfile(p) // null = new user, needs role setup
        setAuthUser(u)
      } else {
        setAuthUser(null)
        setProfile(null)
      }
    })
  }, [])

  // Load shared config from Firestore
  useEffect(() => {
    if (!authUser) return
    getCategories().then(c => { if (c) setCategories(c) })
    getCertsLibrary().then(c => { if (c) setCerts(c) })
  }, [authUser])

  // Real-time listeners (manager gets all, member gets own)
  useEffect(() => {
    if (!profile) return
    if (['manager', 'lead'].includes(profile.role)) {
      const unsub1 = onAssessmentsSnapshot(setAssessments)
      const unsub2 = onUserCertsSnapshot(setUserCerts)
      const unsub3 = onSuggestionsSnapshot(setSuggestions)
      const unsub4 = onUsersSnapshot(setAllUsers)
      const unsub5 = onPendingUsersSnapshot(setPendingUsers)
      return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5() }
    } else {
      getAssessments(authUser.uid).then(a => setAssessments({ [authUser.uid]: a }))
      getUserCerts(authUser.uid).then(c => setUserCerts({ [authUser.uid]: c }))
    }
  }, [profile, authUser])

  const handleSaveCategories = (cats) => {
    setCategories(cats)
    saveCategories(cats)
  }

  const handleSaveCerts = (cs) => {
    setCerts(cs)
    saveCertsLibrary(cs)
  }

  const handleSetAssessment = useCallback((userId, skillId, data) => {
    setAssessments(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [skillId]: data },
    }))
    saveAssessment(userId, skillId, data)
  }, [])

  const handleSetUserCerts = useCallback((userId, certsArr) => {
    setUserCerts(prev => ({ ...prev, [userId]: certsArr }))
    saveUserCerts(userId, certsArr)
  }, [])

  const handleLogout = () => logout()

  if (authUser === undefined) return <><style>{STYLE}</style><Spinner /></>
  if (authUser && !profile) return <><style>{STYLE}</style><RoleSetup authUser={authUser} onComplete={setProfile} /></>
  if (!authUser) return <><style>{STYLE}</style><Login /></>

  const ctx = {
    user: { ...profile, uid: authUser.uid },
    categories, certs,
    assessments, userCerts,
    setCategories: handleSaveCategories,
    setCerts: handleSaveCerts,
    setAssessment: handleSetAssessment,
    setUserCerts: handleSetUserCerts,
    suggestions: suggestions || [], setSuggestions,
    allUsers: allUsers || [], setAllUsers,
    pendingUsers: pendingUsers || [], setPendingUsers,
    onLogout: handleLogout,
  }

  return (
    <>
      <style>{STYLE}</style>
      {['manager','lead'].includes(profile.role) ? <ManagerApp {...ctx} /> : <MemberApp {...ctx} />}
    </>
  )
}

// ─── Login / Register ─────────────────────────────────────────────────────────
function Login() {
  const [tab, setTab]         = useState('login') // 'login' | 'signup'
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [pass2, setPass2]     = useState('')
  const [team, setTeam]       = useState('')
  const [role, setRole]       = useState('contributor')
  const [code, setCode]       = useState('')
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setErr(''); setLoading(true)
    try { await login(email, pass) }
    catch { setErr('Invalid email or password.') }
    finally { setLoading(false) }
  }

  const handleSignup = async () => {
    setErr('')
    if (!name.trim())         return setErr('Please enter your full name.')
    if (!team.trim())         return setErr('Please select your practice / team.')
    if (!code.trim())         return setErr('Please enter the company access code.')
    if (pass !== pass2)       return setErr('Passwords do not match.')
    if (pass.length < 6)      return setErr('Password must be at least 6 characters.')
    setLoading(true)
    try {
      // Verify invite code against Firestore before creating the account
      const storedCode = await getInviteCode()
      if (!storedCode) {
        setLoading(false)
        return setErr('Registration is currently disabled. Contact your administrator.')
      }
      if (code.trim().toLowerCase() !== storedCode.toLowerCase()) {
        setLoading(false)
        return setErr('Invalid access code. Please check with your administrator.')
      }
      const cred = await register(email, pass)
      // Check if a pending CV-imported profile exists for this email
      const pending = await getPendingUserByEmail(email.trim().toLowerCase())
      if (pending) {
        await createUserProfile(cred.user.uid, {
          name: name.trim() || pending.name,
          email: email.trim().toLowerCase(),
          role: pending.role || role,
          team: pending.team || team.trim(),
        })
        if (pending.assessments && Object.keys(pending.assessments).length > 0)
          await saveAssessmentsBulk(cred.user.uid, pending.assessments)
        if (pending.certs && pending.certs.length > 0)
          await saveUserCerts(cred.user.uid, pending.certs)
        await deletePendingUser(email.trim().toLowerCase())
      } else {
        await createUserProfile(cred.user.uid, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          team: team.trim(),
        })
      }
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setErr('An account with this email already exists.')
      else if (e.code === 'auth/invalid-email')   setErr('Please enter a valid email address.')
      else setErr('Sign up failed. Please try again.')
    } finally { setLoading(false) }
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <img src="/logo.png" alt="Reailize" style={{ height: 36, objectFit: 'contain', marginBottom: 0 }} />
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--muted)', letterSpacing: '.04em', marginBottom: 6 }}>
        SKILL MATRIX
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        {tab === 'login' ? 'Sign in to manage your skills & certifications.' : 'Create your account to get started.'}
      </p>
    </div>
  )

  // Tab switcher
  const Tabs = () => (
    <div style={{ display: 'flex', background: 'var(--panel)', borderRadius: 10, padding: 4, gap: 4, border: '1px solid var(--border)' }}>
      {[['login', 'Sign in'], ['signup', 'Create account']].map(([key, label]) => (
        <button key={key} onClick={() => { setTab(key); setErr('') }} style={{
          flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13,
          background: tab === key ? 'var(--grad)' : 'transparent',
          color: tab === key ? '#fff' : 'var(--muted)',
          boxShadow: tab === key ? 'var(--glow)' : 'none',
          transition: 'all .2s',
        }}>{label}</button>
      ))}
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)',
      backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, #e0008018 0%, transparent 70%)',
    }}>
      <div className="fadeUp" style={{ width: 440, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Logo />

        {/* ── Sign In ── */}
        {tab === 'login' && (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@b-yond.com" />
              <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="••••••••" />
              {err && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</p>}
              <Btn onClick={handleLogin} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Btn>
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                No account yet?{' '}
                <span onClick={() => setTab('signup')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Create one →</span>
              </p>
            </div>
          </Card>
        )}

        {/* ── Sign Up ── */}
        {tab === 'signup' && (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Full Name" value={name} onChange={setName} placeholder="e.g. Alejandro Islas" />
              <Input label="Work Email" type="email" value={email} onChange={setEmail} placeholder="you@b-yond.com" />

              {/* Role picker */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>
                  Your Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { val: 'contributor', label: '👷 Contributor',       desc: 'Rate my own skills' },
                    { val: 'lead',        label: '🎯 Practice Lead',     desc: 'Lead + view team' },
                    { val: 'manager',     label: '📊 Practice Manager',  desc: 'Full admin access' },
                  ].map(r => (
                    <div key={r.val} onClick={() => setRole(r.val)} style={{
                      padding: '10px 12px', borderRadius: 9, border: '2px solid',
                      borderColor: role === r.val ? 'var(--accent)' : 'var(--border)',
                      background: role === r.val ? '#e0008015' : 'transparent',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Practice / Team</label>
                <select value={team} onChange={e => setTeam(e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--panel2)', color: team ? 'var(--ink)' : 'var(--muted)', fontSize:13, fontFamily:'Inter, sans-serif', outline:'none' }}
                  onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}>
                  <option value="">Select your practice…</option>
                  {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="Min. 6 characters" />
              <Input label="Confirm Password" type="password" value={pass2} onChange={setPass2} placeholder="Repeat password" />
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <Input label="Company Access Code" value={code} onChange={setCode} placeholder="Enter the code shared by your admin" />
                <p style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>Ask your Practice Manager for the access code.</p>
              </div>

              {err && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</p>}

              <Btn onClick={handleSignup} disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Creating account…' : 'Create account →'}
              </Btn>

              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                Already have an account?{' '}
                <span onClick={() => setTab('login')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign in</span>
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Role Setup (first Microsoft login) ──────────────────────────────────────
function RoleSetup({ authUser, onComplete }) {
  const [role, setRole]   = useState('')
  const [team, setTeam]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!role || !team.trim()) return
    setSaving(true)
    const profile = {
      name:  authUser.displayName || authUser.email.split('@')[0],
      email: authUser.email,
      role,
      team: team.trim(),
    }
    await createUserProfile(authUser.uid, profile)
    onComplete({ id: authUser.uid, ...profile })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, #e0008018 0%, transparent 70%)' }}>
      <div className="fadeUp" style={{ width: 440, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
<img src="/logo.png" alt="Reailize" style={{ height: 32, objectFit: 'contain', marginBottom: 10 }} />
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Welcome!</div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Hi <strong style={{ color: 'var(--ink)' }}>{authUser.displayName || authUser.email}</strong>! Just a couple of quick questions before we get started.
          </p>
        </div>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Role picker */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 10 }}>
                What is your role?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { val: 'contributor', label: '👷 Contributor',      desc: 'I rate my own skills' },
                  { val: 'lead',        label: '🎯 Practice Lead',    desc: 'Lead + view team' },
                  { val: 'manager',     label: '📊 Practice Manager', desc: 'Full admin access' },
                ].map(r => (
                  <div key={r.val} onClick={() => setRole(r.val)} style={{
                    padding: '14px 16px', borderRadius: 10, border: '2px solid',
                    borderColor: role === r.val ? 'var(--accent)' : 'var(--border)',
                    background: role === r.val ? '#eff6ff' : 'var(--panel)',
                    cursor: 'pointer', transition: 'all .15s',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team/practice */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Your Practice / Team</label>
              <select value={team} onChange={e => setTeam(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--panel2)', color: team ? 'var(--ink)' : 'var(--muted)', fontSize:13, fontFamily:'Inter, sans-serif', outline:'none' }}
                onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}>
                <option value="">Select your practice…</option>
                {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <Btn onClick={handleSave} disabled={!role || !team.trim() || saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Setting up…' : 'Get started →'}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ user, onLogout, nav, activeTab, setActiveTab, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 28px', height: 60, gap: 24,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
<img src="/logo.png" alt="Reailize" style={{ height: 22, objectFit: 'contain' }} />
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--muted)', letterSpacing: '.02em' }}>Skill Matrix</span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {nav.map(n => (
            <button key={n.key} onClick={() => setActiveTab(n.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: '7px 7px 0 0', border: 'none', cursor: 'pointer',
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500, fontSize: 13,
              background: activeTab === n.key ? '#e0008018' : 'transparent',
              color: activeTab === n.key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: activeTab === n.key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all .15s',
            }}>{n.icon} {n.label}</button>
          ))}
        </nav>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={user.name} size={30} />
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{user.role}</div>
          </div>
          <Btn variant="ghost" small onClick={onLogout} style={{ marginLeft: 4, color: 'var(--muted)', fontSize: 12 }}>Sign out</Btn>
        </div>
      </header>
      <main style={{ flex: 1, padding: '32px 28px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  )
}

// ─── Member App ───────────────────────────────────────────────────────────────
function MemberApp(ctx) {
  const [tab, setTab] = useState('skills')
  const nav = [
    { key: 'skills', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>, label: 'My Skills' },
    { key: 'certs',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, label: 'My Certifications' },
  ]
  return (
    <Shell user={ctx.user} onLogout={ctx.onLogout} nav={nav} activeTab={tab} setActiveTab={setTab}>
      {tab === 'skills' && <MemberSkills {...ctx} />}
      {tab === 'certs'  && <MemberCerts {...ctx} />}
    </Shell>
  )
}

function SuggestModal({ type, domainName, domainId, allDomains, user, onClose, onSubmit }) {
  const [name, setName]     = useState('')
  const [domain, setDomain] = useState(domainId || '')
  const [provider, setProvider] = useState('')
  const [level, setLevel]   = useState('Associate')
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    const payload = type === 'skill'
      ? { type: 'skill', skillName: name.trim(), domainId: domain, domainName: allDomains.find(d=>d.id===domain)?.name || domainName, suggestedBy: user.uid, suggestedByName: user.name }
      : { type: 'cert',  certName: name.trim(), provider: provider.trim(), level, suggestedBy: user.uid, suggestedByName: user.name }
    await onSubmit(payload)
    setSaving(false)
    setDone(true)
    setTimeout(onClose, 1800)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fadeUp" style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16 }}>Suggestion submitted!</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>A manager will review it shortly.</div>
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                Suggest a {type === 'skill' ? 'Skill' : 'Certification'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Your suggestion will be reviewed by a manager before appearing for everyone.
              </div>
            </div>
            <Input label={type === 'skill' ? 'Skill Name' : 'Certification Name'} value={name} onChange={setName}
              placeholder={type === 'skill' ? 'e.g. Terraform Cloud' : 'e.g. AWS Solutions Architect'} />
            {type === 'skill' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Space Grotesk, sans-serif' }}>Domain</label>
                <select value={domain} onChange={e => setDomain(e.target.value)} style={{
                  padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--panel2)', color: 'var(--ink)', fontSize: 14, fontFamily: 'Inter, sans-serif',
                }}>
                  {allDomains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {type === 'cert' && (
              <>
                <Input label="Provider" value={provider} onChange={setProvider} placeholder="e.g. Amazon, Microsoft, Google" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Space Grotesk, sans-serif' }}>Level</label>
                  <select value={level} onChange={e => setLevel(e.target.value)} style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--panel2)', color: 'var(--ink)', fontSize: 14, fontFamily: 'Inter, sans-serif',
                  }}>
                    {['Foundational','Associate','Professional','Specialty','Expert'].map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" small onClick={onClose}>Cancel</Btn>
              <Btn small onClick={handleSubmit} disabled={saving || !name.trim()}>
                {saving ? 'Submitting…' : 'Submit suggestion'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MemberSkills({ user, categories, assessments, setAssessment }) {
  const myA = assessments[user.uid] || {}
  const [modal, setModal] = useState(null) // { domainId, domainName } | null

  const setSkill = useCallback((skillId, field, val) => {
    const current = myA[skillId] || { prof: 0, interest: 'Low' }
    setAssessment(user.uid, skillId, { ...current, [field]: val, updatedAt: Date.now() })
  }, [user.uid, myA, setAssessment])

  const filled = Object.values(myA).filter(a => a.prof > 0).length
  const total  = categories.reduce((s, c) => s + c.skills.length, 0)

  const handleSuggest = async (payload) => {
    await fbSubmitSuggestion(payload)
  }

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {modal && (
        <SuggestModal type="skill" domainId={modal.domainId} domainName={modal.domainName}
          allDomains={categories} user={user} onClose={() => setModal(null)} onSubmit={handleSuggest} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>My Skills</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Rate your proficiency and growth interest for each skill.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {filled}/{total}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>skills assessed</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PROFICIENCY.map(p => <Badge key={p.val} label={`${p.val} – ${p.label}`} color={p.color} textColor={p.textColor} />)}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:9, background:'#1f1a00', border:'1px solid #ffb80033' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{ fontSize:12, color:'#ffb800', fontWeight:500 }}>Only rate skills backed by hands-on experience or training within the last 5 years. Older experience should not be considered.</span>
      </div>

      {categories.map(cat => (
        <div key={cat.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{cat.name}</h3>
            <button onClick={() => setModal({ domainId: cat.id, domainName: cat.name })} style={{
              marginLeft: 'auto', fontSize: 12, color: 'var(--accent)', background: 'none',
              border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600,
            }}>+ Suggest skill</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {cat.skills.map(sk => {
              const a = myA[sk.id] || { prof: 0, interest: 'Low' }
              return (
                <Card key={sk.id} style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>{sk.name}</div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Proficiency</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {PROFICIENCY.map(p => (
                        <button key={p.val} onClick={() => setSkill(sk.id, 'prof', p.val)} style={{
                          width: 32, height: 32, borderRadius: 7,
                          border: a.prof === p.val ? `2px solid ${cat.color}` : '1.5px solid var(--border)',
                          background: a.prof === p.val ? p.color : 'transparent',
                          color: a.prof === p.val ? p.textColor : 'var(--muted)',
                          cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all .12s',
                        }}>{p.val}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Growth Interest</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {INTEREST.map(i => (
                        <button key={i} onClick={() => setSkill(sk.id, 'interest', i)} style={{
                          padding: '4px 10px', borderRadius: 6, border: '1.5px solid',
                          borderColor: a.interest === i ? cat.color : 'var(--border)',
                          background: a.interest === i ? cat.color + '22' : 'transparent',
                          color: a.interest === i ? cat.color : 'var(--muted)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all .12s',
                        }}>{i}</button>
                      ))}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function MemberCerts({ user, certs, userCerts, setUserCerts }) {
  const myC = userCerts[user.uid] || []
  const [editing, setEditing] = useState(null) // certId being edited
  const [showCertModal, setShowCertModal] = useState(false)
  const handleSuggestCert = async (payload) => { await fbSubmitSuggestion(payload) }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 20 }, (_, i) => currentYear - i)
  const futureYears = Array.from({ length: 6 }, (_, i) => currentYear + i)
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

  const toggle = (certId, status) => {
    const exists = myC.find(c => c.certId === certId)
    let updated
    if (exists) {
      if (exists.status === status) {
        updated = myC.filter(c => c.certId !== certId)
        setEditing(null)
      } else {
        updated = myC.map(c => c.certId === certId ? { ...c, status, acquiredDate: '', expiryDate: '', plannedYear: '', plannedQuarter: '' } : c)
        setEditing(certId)
      }
    } else {
      updated = [...myC, { certId, status, acquiredDate: '', expiryDate: '', plannedYear: '', plannedQuarter: '' }]
      setEditing(certId)
    }
    setUserCerts(user.uid, updated)
  }

  const updateField = (certId, field, val) => {
    const updated = myC.map(c => c.certId === certId ? { ...c, [field]: val } : c)
    setUserCerts(user.uid, updated)
  }

  const statusColors = { Earned: { bg: '#0a1f18', text: '#00d084' }, Planned: { bg: '#0d1a2e', text: '#4a90d9' } }

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false
    const diff = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24 * 30)
    return diff < 3 && diff > 0
  }
  const isExpired = (expiryDate) => expiryDate && new Date(expiryDate) < new Date()

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showCertModal && <SuggestModal type="cert" user={user} allDomains={[]} onClose={() => setShowCertModal(false)} onSubmit={handleSuggestCert} />}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>My Certifications</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Mark certifications you've earned or are working toward.</p>
        </div>
        <button onClick={() => setShowCertModal(true)} style={{
          fontSize: 13, color: 'var(--accent)', background: 'none',
          border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600,
        }}>+ Suggest certification</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {certs.map(cert => {
          const mine = myC.find(c => c.certId === cert.id)
          const isEditOpen = editing === cert.id
          const expWarn = isExpiringSoon(mine?.expiryDate)
          const expBad  = isExpired(mine?.expiryDate)
          return (
            <Card key={cert.id} style={{ padding: '14px 16px', border: expBad ? '1px solid #ff444466' : expWarn ? '1px solid #ffb80066' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{cert.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{cert.provider} · {cert.level}</div>
                </div>
                {mine && <Badge label={mine.status} color={statusColors[mine.status].bg} textColor={statusColors[mine.status].text} />}
              </div>

              {/* Status toggles */}
              <div style={{ display: 'flex', gap: 6, marginBottom: mine ? 12 : 0 }}>
                <Btn small variant={mine?.status === 'Earned' ? 'primary' : 'secondary'} onClick={() => toggle(cert.id, 'Earned')}>✓ Earned</Btn>
                <Btn small variant={mine?.status === 'Planned' ? 'primary' : 'secondary'} onClick={() => toggle(cert.id, 'Planned')}>⏱ Planned</Btn>
              </div>

              {/* Detail fields */}
              {mine?.status === 'Earned' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Date Acquired</div>
                    <input type="month" value={mine.acquiredDate || ''} onChange={e => updateField(cert.id, 'acquiredDate', e.target.value)}
                      style={{ padding:'5px 9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:12, fontFamily:'Inter, sans-serif', width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color: expBad ? '#ff4444' : expWarn ? '#ffb800' : 'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>
                      Expiry Date {expBad ? '⚠ Expired' : expWarn ? '⚠ Expiring Soon' : '(optional)'}
                    </div>
                    <input type="month" value={mine.expiryDate || ''} onChange={e => updateField(cert.id, 'expiryDate', e.target.value)}
                      style={{ padding:'5px 9px', borderRadius:7, border:`1px solid ${expBad ? '#ff4444' : expWarn ? '#ffb800' : 'var(--border)'}`, background:'var(--panel2)', color: expBad ? '#ff4444' : expWarn ? '#ffb800' : 'var(--ink)', fontSize:12, fontFamily:'Inter, sans-serif', width:'100%' }} />
                  </div>
                </div>
              )}

              {mine?.status === 'Planned' && (
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Target Date</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <select value={mine.plannedYear || ''} onChange={e => updateField(cert.id, 'plannedYear', e.target.value)}
                      style={{ flex:1, padding:'5px 8px', borderRadius:7, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:12 }}>
                      <option value="">Year…</option>
                      {futureYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={mine.plannedQuarter || ''} onChange={e => updateField(cert.id, 'plannedQuarter', e.target.value)}
                      style={{ flex:1, padding:'5px 8px', borderRadius:7, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:12 }}>
                      <option value="">Quarter…</option>
                      {quarters.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Manager App ──────────────────────────────────────────────────────────────
function ManagerApp(ctx) {
  const [tab, setTab] = useState('heatmap')
  const pendingCount = (ctx.suggestions || []).filter(s => s.status === 'pending').length
  const NavIcon = ({ d, d2, viewBox = "0 0 24 24" }) => (
    <svg width="15" height="15" viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />{d2 && <path d={d2} />}
    </svg>
  )
  const nav = [
    { key: 'heatmap',     icon: <NavIcon d="M3 3v18h18" d2="M7 16l4-4 4 4 4-6" />, label: 'Skills Heatmap' },
    { key: 'certs',       icon: <NavIcon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />, label: 'Certifications' },
    { key: 'domains',     icon: <NavIcon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />, label: 'By Domain' },
    { key: 'people',      icon: <NavIcon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" d2="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />, label: 'People' },
    { key: 'suggestions', icon: <NavIcon d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 8v4M12 16h.01" />, label: `Suggestions${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { key: 'myskills',    icon: <NavIcon d="M12 2L2 7l10 5 10-5-10-5z" d2="M2 17l10 5 10-5M2 12l10 5 10-5" />, label: 'My Skills' },
    { key: 'mycerts',     icon: <NavIcon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />, label: 'My Certs' },
    { key: 'admin',       icon: <NavIcon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" d2="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />, label: 'Admin' },
  ]
  return (
    <Shell user={ctx.user} onLogout={ctx.onLogout} nav={nav} activeTab={tab} setActiveTab={setTab}>
      {tab === 'heatmap'     && <Heatmap {...ctx} />}
      {tab === 'certs'       && <CertTracker {...ctx} />}
      {tab === 'domains'     && <DomainView {...ctx} />}
      {tab === 'people'      && <PeoplePanel {...ctx} />}
      {tab === 'suggestions' && <SuggestionsPanel {...ctx} />}
      {tab === 'myskills'    && <MemberSkills {...ctx} user={{ ...ctx.user, uid: ctx.user.uid }} />}
      {tab === 'mycerts'     && <MemberCerts  {...ctx} user={{ ...ctx.user, uid: ctx.user.uid }} />}
      {tab === 'admin'       && <AdminPanel {...ctx} />}
    </Shell>
  )
}

function Heatmap({ assessments, categories, allUsers }) {
  const memberIds = Object.keys(assessments)
  const profTextColor = v => ['#4a4a60','#e00080','#ffc400','#4a90d9','#00c87a'][v] || '#4a4a60'
  const profBg       = v => ['#1e1e2a','#0d1a2e11','#0a1f1811','#1f1a0011','#2a0a1a11'][v] || '#1e1e2a'
  const profLabel    = v => ['N/A','Awareness','Working','Advanced','Expert'][v] || 'N/A'

  const [drillSkill, setDrillSkill] = useState(null)
  const [filterPractice, setFilterPractice] = useState('all')
  const userById = Object.fromEntries((allUsers||[]).map(u => [u.id, u]))

  // Filter memberIds by practice if selected
  const visibleIds = filterPractice === 'all'
    ? memberIds
    : memberIds.filter(uid => userById[uid]?.team === filterPractice)

  // For a skill, count how many visible members are at each proficiency level
  const levelCounts = (skillId) => {
    const counts = [0, 0, 0, 0, 0] // index = prof level 0-4
    visibleIds.forEach(uid => {
      const p = assessments[uid]?.[skillId]?.prof || 0
      counts[p]++
    })
    return counts
  }

  const avgProf = (skillId) => {
    const vals = visibleIds.map(uid => assessments[uid]?.[skillId]?.prof || 0).filter(v => v > 0)
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : 0
  }

  const coverage = (skillId) => {
    const rated = visibleIds.filter(uid => (assessments[uid]?.[skillId]?.prof || 0) > 0).length
    return visibleIds.length > 0 ? Math.round((rated / visibleIds.length) * 100) : 0
  }

  const getDrillData = (skillId) =>
    visibleIds
      .map(uid => ({ uid, prof: assessments[uid]?.[skillId]?.prof || 0, user: userById[uid] }))
      .filter(d => d.prof > 0)
      .sort((a, b) => b.prof - a.prof)

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentlyUpdated = Object.values(assessments).filter(u =>
    Object.values(u).some(a => a.updatedAt && a.updatedAt > sevenDaysAgo)
  ).length
  const totalRated = Object.values(assessments).reduce((s, u) => s + Object.values(u).filter(a => a.prof > 0).length, 0)
  const avgSkillsPerUser = memberIds.length > 0 ? (totalRated / memberIds.length).toFixed(1) : '—'

  const drillData = drillSkill ? getDrillData(drillSkill.id) : []

  const PROF_COLS = [
    { val: 1, label: 'Awareness', color: '#e00080', bg: '#2a0a1a' },
    { val: 2, label: 'Working',   color: '#ffc400', bg: '#1f1a00' },
    { val: 3, label: 'Advanced',  color: '#4a90d9', bg: '#0d1a2e' },
    { val: 4, label: 'Expert',    color: '#00c87a', bg: '#0a1f18' },
  ]

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Drill-down side panel */}
      {drillSkill && (
        <div style={{ position:'fixed', top:0, right:0, width:340, height:'100vh', background:'var(--panel)', borderLeft:'1px solid var(--border)', zIndex:200, display:'flex', flexDirection:'column', boxShadow:'-8px 0 32px #0008' }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:drillSkill.catColor, flexShrink:0 }} />
                <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:16 }}>{drillSkill.name}</div>
              </div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{drillData.length} {drillData.length===1?'person has':'people have'} this skill{filterPractice !== 'all' ? ` in ${filterPractice}` : ''}</div>
            </div>
            <button onClick={()=>setDrillSkill(null)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer', padding:4 }}>✕</button>
          </div>
          <div style={{ overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:8 }}>
            {drillData.length === 0
              ? <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:13 }}>No one has rated this skill yet.</div>
              : drillData.map(d => (
                <div key={d.uid} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--panel2)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <Avatar name={d.user?.name || d.uid} size={34} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, fontFamily:'Space Grotesk, sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.user?.name || d.uid}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{d.user?.team || ''}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:99, background:profTextColor(d.prof)+'22', color:profTextColor(d.prof), whiteSpace:'nowrap' }}>
                    {profLabel(d.prof)}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Header + practice filter */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Skills Heatmap</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Proficiency distribution across the team. <span style={{ color:'var(--accent)' }}>Click any skill to see who has it →</span></p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>Filter by practice:</span>
          <select value={filterPractice} onChange={e => setFilterPractice(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', fontSize:13, minWidth:200 }}>
            <option value="all">All Practices ({memberIds.length} people)</option>
            {PRACTICES.map(p => {
              const count = memberIds.filter(uid => userById[uid]?.team === p).length
              return count > 0 ? <option key={p} value={p}>{p} ({count})</option> : null
            })}
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Team Members', val: visibleIds.length, color: '#0ea5e9',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          { label: 'Skills Tracked', val: categories.reduce((s, c) => s + c.skills.length, 0), color: '#a855f7',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> },
          { label: 'Updated Last 7 Days', val: recentlyUpdated, color: '#00d084',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          { label: 'Avg Skills / Member', val: avgSkillsPerUser, color: '#e00080',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
        ].map(c => (
          <Card key={c.label} style={{ padding: '20px 16px' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:c.color+'18', display:'flex', alignItems:'center', justifyContent:'center', color:c.color, marginBottom:12 }}>{c.icon}</div>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:800, fontSize:30, lineHeight:1 }}>{c.val}</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:6, fontWeight:500 }}>{c.label}</div>
          </Card>
        ))}
      </div>

      {/* Matrix table — rows=skills, cols=proficiency levels */}
      <Card style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
              <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, color:'var(--muted)', position:'sticky', left:0, background:'var(--panel)', zIndex:2, minWidth:200 }}>Skill</th>
              {PROF_COLS.map(p => (
                <th key={p.val} style={{ padding:'12px 20px', textAlign:'center', fontSize:12, fontWeight:700, color:p.color, minWidth:110, whiteSpace:'nowrap' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <span style={{ fontSize:18, fontWeight:800 }}>{p.val}</span>
                    <span style={{ fontSize:11, fontWeight:600, opacity:.8 }}>{p.label}</span>
                  </div>
                </th>
              ))}
              <th style={{ padding:'12px 16px', textAlign:'center', fontSize:12, color:'var(--muted)', minWidth:80 }}>Avg</th>
              <th style={{ padding:'12px 16px', textAlign:'center', fontSize:12, color:'var(--muted)', minWidth:90 }}>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <>
                <tr key={cat.id + '_h'}>
                  <td colSpan={7} style={{ padding:'10px 16px', background:cat.color+'18', fontWeight:700, fontSize:11, color:cat.color, textTransform:'uppercase', letterSpacing:'.08em' }}>
                    {cat.name}
                  </td>
                </tr>
                {cat.skills.map(sk => {
                  const counts  = levelCounts(sk.id)
                  const avg     = avgProf(sk.id)
                  const cov     = coverage(sk.id)
                  const total   = visibleIds.length
                  return (
                    <tr key={sk.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      {/* Skill name — clickable */}
                      <td onClick={() => setDrillSkill({ id:sk.id, name:sk.name, catColor:cat.color })}
                        style={{ padding:'10px 16px', fontWeight:500, whiteSpace:'nowrap', position:'sticky', left:0, background:'var(--panel)', zIndex:1, cursor:'pointer', color:drillSkill?.id===sk.id?'var(--accent)':'var(--ink)', transition:'color .15s' }}
                        onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'}
                        onMouseLeave={e=>e.currentTarget.style.color=drillSkill?.id===sk.id?'var(--accent)':'var(--ink)'}>
                        {sk.name}
                      </td>

                      {/* Level count cells */}
                      {PROF_COLS.map(p => {
                        const n = counts[p.val]
                        const pct = total > 0 ? n / total : 0
                        return (
                          <td key={p.val} style={{ padding:'8px 12px', textAlign:'center' }}>
                            {n > 0
                              ? <span style={{ fontSize:14, fontWeight:700, color:p.color }}>{n}</span>
                              : <span style={{ color:'var(--border)', fontSize:16 }}>·</span>
                            }
                          </td>
                        )
                      })}

                      {/* Avg */}
                      <td style={{ padding:'10px 16px', textAlign:'center' }}>
                        {avg > 0
                          ? <span style={{ fontSize:13, fontWeight:700, color:profTextColor(Math.round(avg)) }}>{avg.toFixed(1)}</span>
                          : <span style={{ color:'var(--border)' }}>—</span>
                        }
                      </td>

                      {/* Coverage bar */}
                      <td style={{ padding:'10px 16px', textAlign:'center' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                          <div style={{ width:56, height:5, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
                            <div style={{ width:`${cov}%`, height:'100%', background: cov > 66 ? '#00c87a' : cov > 33 ? '#ffc400' : '#ff4444', borderRadius:99 }} />
                          </div>
                          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>{cov}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function CertTracker({ userCerts, certs, allUsers }) {
  const allUserIds = Object.keys(userCerts)
  const userById = Object.fromEntries((allUsers||[]).map(u => [u.id, u]))
  const [expanded, setExpanded] = useState(null)

  const getCertHolders = (certId) =>
    allUserIds.flatMap(uid => {
      const c = userCerts[uid]?.find(c => c.certId === certId)
      if (!c) return []
      return [{ uid, user: userById[uid], ...c }]
    })

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false
    const diff = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24 * 30)
    return diff < 3 && diff > 0
  }
  const isExpired = (expiryDate) => expiryDate && new Date(expiryDate) < new Date()

  const fmtMonth = (ym) => {
    if (!ym) return null
    const [y, m] = ym.split('-')
    return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${y}`
  }

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Certifications Tracker</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Who holds what, when they earned it, and what the team is pursuing.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {certs.map(cert => {
          const holders = getCertHolders(cert.id)
          const earned  = holders.filter(h => h.status === 'Earned')
          const planned = holders.filter(h => h.status === 'Planned')
          const expiredCount = earned.filter(h => isExpired(h.expiryDate)).length
          const warnCount    = earned.filter(h => isExpiringSoon(h.expiryDate)).length
          const isOpen = expanded === cert.id
          return (
            <Card key={cert.id} style={{ padding: 0, overflow:'hidden', border: expiredCount > 0 ? '1px solid #ff444433' : warnCount > 0 ? '1px solid #ffb80033' : undefined }}>
              {/* Header row */}
              <div onClick={() => setExpanded(isOpen ? null : cert.id)}
                style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16, cursor:'pointer', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{cert.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{cert.provider} · {cert.level}</div>
                </div>
                <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, fontFamily:'Space Grotesk, sans-serif', color:'#00d084' }}>{earned.length}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>Earned</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, fontFamily:'Space Grotesk, sans-serif', color:'#4a90d9' }}>{planned.length}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>Planned</div>
                  </div>
                  {expiredCount > 0 && <Badge label={`${expiredCount} expired`} color="#2a0a0a" textColor="#ff4444" />}
                  {warnCount > 0 && <Badge label={`${warnCount} expiring soon`} color="#1f1a00" textColor="#ffb800" />}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {/* Expanded list */}
              {isOpen && (
                <div style={{ borderTop:'1px solid var(--border)', padding:'12px 20px', display:'flex', flexDirection:'column', gap:6 }}>
                  {holders.length === 0 && <div style={{ fontSize:13, color:'var(--muted)', padding:'8px 0' }}>No one has this cert yet.</div>}
                  {earned.map(h => {
                    const expired = isExpired(h.expiryDate)
                    const warn    = isExpiringSoon(h.expiryDate)
                    return (
                      <div key={h.uid} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', borderRadius:9, background:'var(--panel2)', border:`1px solid ${expired ? '#ff444433' : warn ? '#ffb80033' : 'transparent'}` }}>
                        <Avatar name={h.user?.name || h.uid} size={30} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:13 }}>{h.user?.name || h.uid}</div>
                          <div style={{ fontSize:11, color:'var(--muted)' }}>{h.user?.team}</div>
                        </div>
                        <Badge label="Earned" color="#0a1f18" textColor="#00d084" />
                        {h.acquiredDate && <span style={{ fontSize:11, color:'var(--muted)' }}>Acquired: {fmtMonth(h.acquiredDate)}</span>}
                        {h.expiryDate && (
                          <span style={{ fontSize:11, fontWeight:600, color: expired ? '#ff4444' : warn ? '#ffb800' : 'var(--muted)' }}>
                            {expired ? '⚠ Expired' : warn ? '⚠ Expires'  : 'Expires'}: {fmtMonth(h.expiryDate)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {planned.map(h => (
                    <div key={h.uid} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', borderRadius:9, background:'var(--panel2)' }}>
                      <Avatar name={h.user?.name || h.uid} size={30} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{h.user?.name || h.uid}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{h.user?.team}</div>
                      </div>
                      <Badge label="Planned" color="#0d1a2e" textColor="#4a90d9" />
                      {h.plannedYear && h.plannedQuarter && (
                        <span style={{ fontSize:11, color:'#4a90d9', fontWeight:600 }}>Target: {h.plannedQuarter} {h.plannedYear}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function DomainView({ assessments, categories }) {
  const memberIds    = Object.keys(assessments)
  const [selCat, setSelCat] = useState(null)
  const cat = selCat ? categories.find(c => c.id === selCat) : null

  const avgForSkill = skillId => {
    const vals = memberIds.map(uid => assessments[uid]?.[skillId]?.prof || 0).filter(v => v > 0)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }
  const highInterest = skillId => memberIds.filter(uid => assessments[uid]?.[skillId]?.interest === 'High').length

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Skills by Domain</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Drill into each technology domain.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {categories.map(c => {
          const allVals = c.skills.flatMap(sk => memberIds.map(uid => assessments[uid]?.[sk.id]?.prof || 0))
          const pos = allVals.filter(v => v > 0)
          const avg = pos.length ? (pos.reduce((s, v) => s + v, 0) / pos.length).toFixed(1) : 0
          return (
            <Card key={c.id} onClick={() => setSelCat(selCat === c.id ? null : c.id)}
              style={{ cursor: 'pointer', borderColor: selCat === c.id ? c.color : 'var(--border)', borderWidth: 2 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: c.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: c.color }} />
              </div>
              <div style={{ fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 4 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.skills.length} skills</div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 700 }}>avg {avg}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{pos.length} rated</div>
              </div>
            </Card>
          )
        })}
      </div>
      {cat && (
        <Card style={{ borderColor: cat.color, borderWidth: 2, padding: 0, overflow: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700 }}>{cat.name} — Skill Breakdown</h3>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--panel2)' }}>
                {['Skill', 'Team Avg', 'High Interest', 'Coverage'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cat.skills.map(sk => {
                const avg = avgForSkill(sk.id)
                const hi  = highInterest(sk.id)
                const cov = memberIds.filter(uid => (assessments[uid]?.[sk.id]?.prof || 0) > 0).length
                return (
                  <tr key={sk.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{sk.name}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#f3f4f6', overflow: 'hidden' }}>
                          <div style={{ width: `${avg / 4 * 100}%`, height: '100%', background: cat.color, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cat.color }}>{avg ? avg.toFixed(1) : '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: hi > 0 ? '#d97706' : 'var(--muted)', fontWeight: 600 }}>{hi > 0 ? `${hi} 🔥` : '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{cov}/{memberIds.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ─── People Panel ────────────────────────────────────────────────────────────
const ROLES = [
  { val: 'manager',     label: 'Practice Manager',     color: '#e00080' },
  { val: 'lead',        label: 'Practice Lead',        color: '#7c3aed' },
  { val: 'contributor', label: 'Practice Contributor', color: '#0ea5e9' },
]

function RoleBadge({ role }) {
  const r = ROLES.find(r => r.val === role) || ROLES[2]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
      background: r.color + '22', color: r.color,
      fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '.03em', whiteSpace: 'nowrap',
    }}>{r.label}</span>
  )
}

function UserProfileModal({ person, assessments, userCerts, categories, certs, onClose }) {
  const myA  = assessments[person.id] || {}
  const myC  = userCerts[person.id]   || []

  // Only rated skills (prof > 0)
  const ratedSkills = categories.flatMap(cat =>
    cat.skills
      .filter(sk => myA[sk.id] && myA[sk.id].prof > 0)
      .map(sk => ({ ...sk, catName: cat.name, catColor: cat.color, ...myA[sk.id] }))
  )

  // High-interest skills (growth intentions)
  const growthSkills = categories.flatMap(cat =>
    cat.skills
      .filter(sk => myA[sk.id] && myA[sk.id].interest === 'High')
      .map(sk => ({ ...sk, catName: cat.name, catColor: cat.color, ...myA[sk.id] }))
  )

  const earnedCerts  = myC.filter(c => c.status === 'Earned')
  const plannedCerts = myC.filter(c => c.status === 'Planned')
  const certById     = Object.fromEntries(certs.map(c => [c.id, c]))

  const profLabel = v => ['N/A','Awareness','Working','Advanced','Expert'][v] || 'N/A'
  const profColor = v => ['#4a4a60','#e00080','#ffc400','#4a90d9','#00c87a'][v] || '#4a4a60'

  return (
    <div style={{ position:'fixed', inset:0, background:'#000c', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding: 20 }}
         onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="fadeUp" style={{
        background:'var(--panel)', border:'1px solid var(--border)', borderRadius:16,
        width:'100%', maxWidth:700, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'24px 28px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:16 }}>
          <Avatar name={person.name} size={48} />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:18 }}>{person.name}</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginTop:3 }}>{person.email} · {person.team}</div>
            <div style={{ marginTop:6 }}><RoleBadge role={person.role} /></div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', padding:4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', padding:'24px 28px', display:'flex', flexDirection:'column', gap:28 }}>

          {/* Current Skills */}
          <div>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:13, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
              Skills Assessed ({ratedSkills.length})
            </div>
            {ratedSkills.length === 0
              ? <div style={{ color:'var(--muted)', fontSize:13 }}>No skills rated yet.</div>
              : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {ratedSkills.map(sk => (
                    <div key={sk.id} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'6px 12px',
                      background:'var(--panel2)', borderRadius:8, border:'1px solid var(--border)',
                    }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:sk.catColor, flexShrink:0 }} />
                      <span style={{ fontSize:13, fontWeight:500 }}>{sk.name}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:profColor(sk.prof), background:profColor(sk.prof)+'22', padding:'2px 7px', borderRadius:99 }}>
                        {sk.prof} · {profLabel(sk.prof)}
                      </span>
                      {sk.lastYear && <span style={{ fontSize:11, color:'var(--muted)' }}>({sk.lastYear})</span>}
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Certifications */}
          <div>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:13, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
              Certifications Earned ({earnedCerts.length})
            </div>
            {earnedCerts.length === 0
              ? <div style={{ color:'var(--muted)', fontSize:13 }}>None recorded yet.</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {earnedCerts.map(c => {
                    const cert = certById[c.certId]
                    if (!cert) return null
                    const expired = c.expiryDate && new Date(c.expiryDate) < new Date()
                    const warn = c.expiryDate && !expired && (new Date(c.expiryDate) - new Date()) / (1000*60*60*24*30) < 3
                    const fmtM = ym => { if (!ym) return null; const [y,m] = ym.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${y}` }
                    return (
                      <div key={c.certId} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#0a1f18', border:`1px solid ${expired?'#ff444466':warn?'#ffb80066':'#00d08433'}`, borderRadius:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, color:'#00d084', fontWeight:600 }}>🏅 {cert.name}</span>
                        {c.acquiredDate && <span style={{ fontSize:11, color:'var(--muted)' }}>Acquired: {fmtM(c.acquiredDate)}</span>}
                        {c.expiryDate && <span style={{ fontSize:11, fontWeight:600, color: expired?'#ff4444':warn?'#ffb800':'var(--muted)' }}>{expired?'⚠ Expired':warn?'⚠ Expiring soon':'Expires'}: {fmtM(c.expiryDate)}</span>}
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Growth Intentions */}
          <div>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:13, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
              Intends to Learn / Grow ({growthSkills.length + plannedCerts.length})
            </div>
            {growthSkills.length === 0 && plannedCerts.length === 0
              ? <div style={{ color:'var(--muted)', fontSize:13 }}>No growth intentions recorded.</div>
              : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {growthSkills.map(sk => (
                    <div key={sk.id} style={{ padding:'6px 12px', background:'#1f1a00', border:'1px solid #ffc40033', borderRadius:8, fontSize:13, color:'#ffc400', fontWeight:500 }}>
                      ⭐ {sk.name} <span style={{ opacity:.6 }}>({sk.catName})</span>
                      {sk.lastYear && <span style={{ opacity:.6, marginLeft:4 }}>· {sk.lastYear}</span>}
                    </div>
                  ))}
                  {plannedCerts.map(c => {
                    const cert = certById[c.certId]
                    if (!cert) return null
                    return (
                      <div key={c.certId} style={{ padding:'6px 12px', background:'#0d1a2e', border:'1px solid #4a90d933', borderRadius:8, fontSize:13, color:'#4a90d9', fontWeight:500 }}>
                        📋 {cert.name}
                        {c.plannedYear && c.plannedQuarter && <span style={{ opacity:.7, marginLeft:4 }}>· {c.plannedQuarter} {c.plannedYear}</span>}
                      </div>
                    )
                  })}
                </div>
            }
          </div>

        </div>
      </div>
    </div>
  )
}

function PeoplePanel({ allUsers, assessments, userCerts, categories, certs, user: currentUser }) {
  const [mode, setMode]           = useState('roster')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [editUser, setEditUser]   = useState(null)   // user being edited in modal
  const [editFields, setEditFields] = useState({})   // { name, email, role, team }
  const [saving, setSaving]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // uid pending delete
  const [deleting, setDeleting]   = useState(false)

  // ── Talent search state ──────────────────────────────────────────────────
  const [skillFilters, setSkillFilters] = useState([])
  const [certFilters,  setCertFilters]  = useState([])
  const [addingSkill,  setAddingSkill]  = useState(false)
  const [addingCert,   setAddingCert]   = useState(false)
  const [newSkillCat,  setNewSkillCat]  = useState('')
  const [newSkillId,   setNewSkillId]   = useState('')
  const [newSkillLevel,setNewSkillLevel]= useState(0)
  const [newCertId,    setNewCertId]    = useState('')
  const [newCertStatus,setNewCertStatus]= useState('Earned')

  const canEdit = currentUser.role === 'manager'
  const profLabels = ['Any','Awareness','Working','Advanced','Expert']

  // ── Roster helpers ───────────────────────────────────────────────────────
  const filtered = allUsers.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.team?.toLowerCase().includes(search.toLowerCase())
  )
  const grouped  = filtered.reduce((acc, u) => {
    const t = u.team || 'Unassigned'
    if (!acc[t]) acc[t] = []
    acc[t].push(u)
    return acc
  }, {})
  const practices = Object.keys(grouped).sort()

  const openEdit = (u) => {
    setEditUser(u)
    setEditFields({ name: u.name || '', email: u.email || '', role: u.role || 'contributor', team: u.team || '' })
  }
  const saveEdit = async () => {
    if (!editFields.name.trim()) return
    setSaving(true)
    await updateUserProfile(editUser.id, {
      name: editFields.name.trim(),
      email: editFields.email.trim().toLowerCase(),
      role: editFields.role,
      team: editFields.team,
    })
    setSaving(false)
    setEditUser(null)
  }
  const confirmDelete = (uid) => setDeleteConfirm(uid)
  const handleDelete  = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    await deleteUserData(deleteConfirm)
    setDeleting(false)
    setDeleteConfirm(null)
    setEditUser(null)
  }

  // ── Talent search helpers ────────────────────────────────────────────────
  const skillById = Object.fromEntries(
    categories.flatMap(c => c.skills.map(s => [s.id, { ...s, catName: c.name, catColor: c.color }]))
  )
  const certById  = Object.fromEntries(certs.map(c => [c.id, c]))

  const addSkillFilter = () => {
    if (!newSkillId) return
    const sk = skillById[newSkillId]
    if (!sk || skillFilters.find(f => f.skillId === newSkillId)) return
    setSkillFilters(f => [...f, { skillId: newSkillId, skillName: sk.name, catName: sk.catName, catColor: sk.catColor, minLevel: newSkillLevel }])
    setNewSkillId(''); setNewSkillCat(''); setNewSkillLevel(0); setAddingSkill(false)
  }
  const addCertFilter = () => {
    if (!newCertId) return
    const c = certById[newCertId]
    if (!c || certFilters.find(f => f.certId === newCertId)) return
    setCertFilters(f => [...f, { certId: newCertId, certName: c.name, status: newCertStatus }])
    setNewCertId(''); setAddingCert(false)
  }

  // ── Match logic ──────────────────────────────────────────────────────────
  const searchResults = allUsers.filter(u => {
    if (skillFilters.length === 0 && certFilters.length === 0) return false
    const ua = assessments[u.id] || {}
    const uc = userCerts[u.id]   || []
    const skillsOk = skillFilters.every(f => {
      const a = ua[f.skillId]
      return a && a.prof >= (f.minLevel === 0 ? 1 : f.minLevel)
    })
    const certsOk = certFilters.every(f => {
      return uc.some(c => c.certId === f.certId && (f.status === 'Any' || c.status === f.status))
    })
    return skillsOk && certsOk
  }).map(u => {
    const ua = assessments[u.id] || {}
    const uc = userCerts[u.id]   || []
    return {
      ...u,
      matchedSkills: skillFilters.map(f => ({ ...f, prof: ua[f.skillId]?.prof || 0 })),
      matchedCerts:  certFilters.map(f => ({ ...f, earned: uc.find(c => c.certId === f.certId)?.status })),
    }
  })

  const profColor = v => ['#4a4a60','#e00080','#ffc400','#4a90d9','#00c87a'][v] || '#4a4a60'
  const profLabel = v => ['N/A','Awareness','Working','Advanced','Expert'][v] || 'N/A'

  const hasFilters = skillFilters.length > 0 || certFilters.length > 0

  // ── Edit User Modal ──────────────────────────────────────────────────────
  const EditUserModal = () => !editUser ? null : (
    <div style={{ position:'fixed', inset:0, background:'#000a', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div className="fadeUp" style={{ background:'var(--panel)', borderRadius:16, width:'100%', maxWidth:480, border:'1px solid var(--border)', boxShadow:'0 24px 64px #0008' }}>
        <div style={{ padding:'24px 28px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:18 }}>Edit User</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{editUser.email}</div>
          </div>
          <button onClick={() => setEditUser(null)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Full Name</label>
            <input value={editFields.name} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:14, outline:'none', boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
          </div>
          {/* Email */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Email</label>
            <input value={editFields.email} onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:14, outline:'none', boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
          </div>
          {/* Role */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Role</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { val:'contributor', label:'Contributor' },
                { val:'lead',        label:'Practice Lead' },
                { val:'manager',     label:'Manager' },
              ].map(r => (
                <div key={r.val} onClick={() => setEditFields(f => ({ ...f, role: r.val }))}
                  style={{ padding:'8px 10px', borderRadius:8, border:'2px solid', borderColor: editFields.role===r.val ? 'var(--accent)' : 'var(--border)', background: editFields.role===r.val ? '#e0008015' : 'transparent', cursor:'pointer', textAlign:'center', fontSize:12, fontWeight:600, transition:'all .15s' }}>
                  {r.label}
                </div>
              ))}
            </div>
          </div>
          {/* Practice */}
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:6 }}>Practice</label>
            <select value={editFields.team} onChange={e => setEditFields(f => ({ ...f, team: e.target.value }))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:14, outline:'none' }}
              onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}>
              <option value="">— Unassigned —</option>
              {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <Btn onClick={saveEdit} disabled={saving || !editFields.name.trim()} style={{ flex:1, justifyContent:'center' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Btn>
            <Btn variant="secondary" onClick={() => setEditUser(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
          </div>

          {/* Delete zone */}
          {editUser.id !== currentUser.uid && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>Danger zone — this cannot be undone.</div>
              <button onClick={() => confirmDelete(editUser.id)}
                style={{ width:'100%', padding:'9px', borderRadius:9, border:'1px solid #ff444466', background:'#ff444411', color:'#ff6666', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'Space Grotesk, sans-serif', transition:'all .15s' }}
                onMouseEnter={e=>{e.target.style.background='#ff444422';e.target.style.borderColor='#ff4444'}}
                onMouseLeave={e=>{e.target.style.background='#ff444411';e.target.style.borderColor='#ff444466'}}>
                Remove User from Platform
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Delete Confirmation Modal ─────────────────────────────────────────────
  const DeleteConfirmModal = () => {
    const target = allUsers.find(u => u.id === deleteConfirm)
    if (!target) return null
    return (
      <div style={{ position:'fixed', inset:0, background:'#000c', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div className="fadeUp" style={{ background:'var(--panel)', borderRadius:16, width:'100%', maxWidth:420, border:'1px solid #ff444466', boxShadow:'0 24px 64px #ff000022' }}>
          <div style={{ padding:'28px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:16, textAlign:'center' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'#ff444418', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>⚠️</div>
            <div>
              <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:800, fontSize:18, marginBottom:6 }}>Remove {target.name}?</div>
              <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>
                This will permanently delete their profile, skill assessments, and certifications from Firestore. Their login credentials will remain in Firebase Auth but they will not be able to access the platform.
              </p>
            </div>
            <div style={{ display:'flex', gap:10, width:'100%' }}>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex:1, padding:'10px', borderRadius:9, border:'none', background:'#ff4444', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'Space Grotesk, sans-serif' }}>
                {deleting ? 'Removing…' : 'Yes, Remove User'}
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex:1, padding:'10px', borderRadius:9, border:'1px solid var(--border)', background:'transparent', color:'var(--ink)', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'Space Grotesk, sans-serif' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Shared person row ────────────────────────────────────────────────────
  const PersonRow = ({ person, matchedSkills, matchedCerts, showEdit = false }) => (
    <Card style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', flexWrap:'wrap' }}>
      <Avatar name={person.name || '?'} size={38} style={{ cursor:'pointer' }} onClick={() => setSelected(person)} />
      <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => setSelected(person)}>
        <div style={{ fontWeight:600, fontSize:14, fontFamily:'Space Grotesk, sans-serif' }}>{person.name}</div>
        <div style={{ fontSize:12, color:'var(--muted)' }}>{person.email} · {person.team}</div>
      </div>
      {matchedSkills && matchedSkills.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {matchedSkills.map(f => (
            <span key={f.skillId} style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:99, background: profColor(f.prof)+'22', color: profColor(f.prof) }}>
              {f.skillName} · {profLabel(f.prof)}
            </span>
          ))}
          {matchedCerts && matchedCerts.map(f => (
            <span key={f.certId} style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:99, background:'#0a1f18', color:'#00d084' }}>
              🏅 {f.certName}
            </span>
          ))}
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <RoleBadge role={person.role} />
        <button onClick={() => setSelected(person)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontSize:12, color:'var(--muted)', fontFamily:'Space Grotesk, sans-serif' }}
          onMouseEnter={e=>{e.target.style.borderColor='var(--accent)';e.target.style.color='var(--accent)'}}
          onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--muted)'}}>View</button>
        {showEdit && canEdit && person.id !== currentUser.uid && (
          <button onClick={() => openEdit(person)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontSize:12, color:'var(--muted)', fontFamily:'Space Grotesk, sans-serif' }}
            onMouseEnter={e=>{e.target.style.borderColor='var(--accent)';e.target.style.color='var(--accent)'}}
            onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--muted)'}}>Edit</button>
        )}
      </div>
    </Card>
  )

  return (
    <div className="fadeUp" style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {selected && <UserProfileModal person={selected} assessments={assessments} userCerts={userCerts} categories={categories} certs={certs} onClose={() => setSelected(null)} />}
      <EditUserModal />
      <DeleteConfirmModal />

      {/* Mode toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800 }}>People</h1>
          <p style={{ color:'var(--muted)', fontSize:14, marginTop:4 }}>{allUsers.length} members across {[...new Set(allUsers.map(u=>u.team).filter(Boolean))].length} practices</p>
        </div>
        <div style={{ display:'flex', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, padding:4, gap:4 }}>
          {[['roster','👥  Roster'],['search','🔍  Talent Search']].map(([key,label]) => (
            <button key={key} onClick={() => setMode(key)} style={{
              padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer',
              fontFamily:'Space Grotesk, sans-serif', fontWeight:600, fontSize:13,
              background: mode===key ? 'var(--grad)' : 'transparent',
              color: mode===key ? '#fff' : 'var(--muted)',
              boxShadow: mode===key ? 'var(--glow)' : 'none', transition:'all .2s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── ROSTER MODE ───────────────────────────────────────────────────── */}
      {mode === 'roster' && (
        <>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or practice…"
            style={{ padding:'9px 14px', borderRadius:9, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13, fontFamily:'Inter, sans-serif', outline:'none' }}
            onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
          {practices.map(practice => (
            <div key={practice}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:14, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em' }}>{practice}</div>
                <div style={{ fontSize:12, color:'var(--muted)', background:'var(--panel2)', padding:'2px 8px', borderRadius:99, border:'1px solid var(--border)' }}>{grouped[practice].length}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {grouped[practice].map(person => <PersonRow key={person.id} person={person} showEdit={true} />)}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign:'center', padding:48, color:'var(--muted)' }}>No people match your search.</div>}
        </>
      )}

      {/* ── TALENT SEARCH MODE ────────────────────────────────────────────── */}
      {mode === 'search' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Filter builder */}
          <Card style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:14 }}>Build your search</div>

            {/* Active skill filters */}
            {skillFilters.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {skillFilters.map(f => (
                  <div key={f.skillId} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px 5px 12px', background:'var(--panel2)', border:'1px solid var(--border)', borderRadius:99 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:f.catColor }} />
                    <span style={{ fontSize:12, fontWeight:600 }}>{f.skillName}</span>
                    {f.minLevel > 0 && <span style={{ fontSize:11, color:'var(--muted)' }}>≥ {profLabels[f.minLevel]}</span>}
                    <button onClick={() => setSkillFilters(fs => fs.filter(x => x.skillId !== f.skillId))}
                      style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Active cert filters */}
            {certFilters.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {certFilters.map(f => (
                  <div key={f.certId} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px 5px 12px', background:'#0a1f18', border:'1px solid #00d08433', borderRadius:99 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'#00d084' }}>🏅 {f.certName}</span>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>{f.status}</span>
                    <button onClick={() => setCertFilters(fs => fs.filter(x => x.certId !== f.certId))}
                      style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add skill row */}
            {addingSkill ? (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <select value={newSkillCat} onChange={e=>{setNewSkillCat(e.target.value);setNewSkillId('')}} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13 }}>
                  <option value="">Select domain…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {newSkillCat && (
                  <select value={newSkillId} onChange={e=>setNewSkillId(e.target.value)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13 }}>
                    <option value="">Select skill…</option>
                    {(categories.find(c=>c.id===newSkillCat)?.skills||[]).filter(s=>!skillFilters.find(f=>f.skillId===s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <select value={newSkillLevel} onChange={e=>setNewSkillLevel(Number(e.target.value))} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13 }}>
                  {profLabels.map((l,i) => <option key={i} value={i}>{i===0?'Any level':`≥ ${l}`}</option>)}
                </select>
                <Btn small onClick={addSkillFilter} disabled={!newSkillId}>Add</Btn>
                <Btn small variant="secondary" onClick={()=>setAddingSkill(false)}>Cancel</Btn>
              </div>
            ) : addingCert ? (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <select value={newCertId} onChange={e=>setNewCertId(e.target.value)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13 }}>
                  <option value="">Select certification…</option>
                  {certs.filter(c=>!certFilters.find(f=>f.certId===c.id)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
                </select>
                <select value={newCertStatus} onChange={e=>setNewCertStatus(e.target.value)} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13 }}>
                  <option>Earned</option><option>Planned</option><option value="Any">Any</option>
                </select>
                <Btn small onClick={addCertFilter} disabled={!newCertId}>Add</Btn>
                <Btn small variant="secondary" onClick={()=>setAddingCert(false)}>Cancel</Btn>
              </div>
            ) : (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{setAddingSkill(true);setAddingCert(false)}} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'1px dashed var(--border)', background:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, fontFamily:'Space Grotesk, sans-serif', fontWeight:600, transition:'all .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  + Add skill filter
                </button>
                <button onClick={()=>{setAddingCert(true);setAddingSkill(false)}} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, border:'1px dashed var(--border)', background:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, fontFamily:'Space Grotesk, sans-serif', fontWeight:600, transition:'all .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  + Add cert filter
                </button>
                {hasFilters && <Btn small variant="secondary" onClick={()=>{setSkillFilters([]);setCertFilters([])}}>Clear all</Btn>}
              </div>
            )}
          </Card>

          {/* Results */}
          {!hasFilters ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--muted)' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
              <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:600, fontSize:15, marginBottom:6 }}>Add filters to find people</div>
              <div style={{ fontSize:13 }}>Search by skills, proficiency level, and certifications.</div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:13, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:12 }}>
                {searchResults.length} {searchResults.length === 1 ? 'person matches' : 'people match'} all criteria
              </div>
              {searchResults.length === 0
                ? <Card style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>😕</div>
                    <div style={{ fontSize:14 }}>No one matches all selected criteria yet.</div>
                  </Card>
                : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {searchResults.map(p => <PersonRow key={p.id} person={p} matchedSkills={p.matchedSkills} matchedCerts={p.matchedCerts} />)}
                  </div>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ─── CV Scanner ───────────────────────────────────────────────────────────────
function CVScanner({ categories, certs, pendingUsers, onPendingUsersChange }) {
  const [step, setStep]           = useState('upload')  // upload | scanning | review | done
  const [dragOver, setDragOver]   = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [scanError, setScanError] = useState('')
  const [extracted, setExtracted] = useState(null)   // parsed result from Claude
  const [saving, setSaving]       = useState(false)
  const [activeTab, setActiveTab] = useState('import') // import | pending

  const skillsFlat = categories.flatMap(c =>
    c.skills.map(s => ({ id: s.id, name: s.name, domain: c.name }))
  )

  // ── Extract text from file ───────────────────────────────────────────────
  const extractText = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'pdf') {
      // Use pdf.js via CDN
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const typedArray = new Uint8Array(e.target.result)
            const pdfjsLib = window['pdfjs-dist/build/pdf']
            if (!pdfjsLib) {
              // Fallback: read as binary and extract readable text
              const text = new TextDecoder('utf-8', { fatal: false }).decode(typedArray)
              const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim()
              resolve(readable.substring(0, 12000))
              return
            }
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
            let fullText = ''
            for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
              const page = await pdf.getPage(i)
              const content = await page.getTextContent()
              fullText += content.items.map(item => item.str).join(' ') + '\n'
            }
            resolve(fullText.substring(0, 12000))
          } catch (err) { reject(err) }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
    } else if (ext === 'docx' || ext === 'doc') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const mammoth = window.mammoth
            if (!mammoth) throw new Error('mammoth not loaded')
            const result = await mammoth.extractRawText({ arrayBuffer: e.target.result })
            resolve(result.value.substring(0, 12000))
          } catch (err) { reject(err) }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
    } else {
      throw new Error('Unsupported file type. Please upload a PDF or Word document.')
    }
  }

  // ── Call Claude API ──────────────────────────────────────────────────────
  const scanWithClaude = async (text) => {
    const skillsList = skillsFlat.map(s => `${s.id}|${s.name} (${s.domain})`).join('\n')
    const certsList  = certs.map(c => `${c.id}|${c.name}${c.provider ? ' - ' + c.provider : ''}`).join('\n')
    const practicesList = [
      'AI Engineering','Cloud Engineering','Core Network Eng','HR/Recruiting',
      'Network Operations Eng','RAN Network Eng','Software Engineering',
      'Testing Engineering','Transport Network Eng','Voice and Signaling Eng'
    ].join(', ')

    const prompt = `You are analyzing a CV/Resume to extract structured data for a skills matrix platform.

AVAILABLE SKILLS (format: id|name (domain)):
${skillsList}

AVAILABLE CERTIFICATIONS (format: id|name):
${certsList}

AVAILABLE PRACTICES: ${practicesList}

CV TEXT:
${text}

INSTRUCTIONS:
- Extract the person's full name and email address
- Suggest the most appropriate practice from the AVAILABLE PRACTICES list
- Map their experience to skills from AVAILABLE SKILLS only. Use proficiency: 1=Awareness, 2=Working, 3=Advanced, 4=Expert. Only include skills you are confident about. Do NOT invent skill IDs.
- Map their certifications to AVAILABLE CERTIFICATIONS only. Only include certs you are confident about.
- If you are unsure about any skill or cert mapping, omit it rather than guess.

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "name": "Full Name",
  "email": "email@example.com or null",
  "suggestedPractice": "one of the available practices",
  "practiceReason": "one sentence explanation",
  "skills": [
    {"skillId": "exact_id_from_list", "skillName": "name", "proficiency": 1-4, "confidence": "high|medium"}
  ],
  "certifications": [
    {"certId": "exact_id_from_list", "certName": "name", "status": "Earned", "confidence": "high|medium"}
  ],
  "summary": "2-3 sentence professional summary based on the CV"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Claude API error')
    }

    const data = await response.json()
    const raw = data.content.find(b => b.type === 'text')?.text || ''
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  }

  // ── Handle file drop / select ────────────────────────────────────────────
  const processFile = async (file) => {
    setScanError('')
    setStep('scanning')
    setScanning(true)
    try {
      const text = await extractText(file)
      if (!text || text.length < 100) throw new Error('Could not extract enough text from this file. Try a different format.')
      const result = await scanWithClaude(text)
      // Only keep high/medium confidence items
      result.skills = (result.skills || []).filter(s => s.confidence !== 'low' && skillsFlat.find(sf => sf.id === s.skillId))
      result.certifications = (result.certifications || []).filter(c => c.confidence !== 'low' && certs.find(cf => cf.id === c.certId))
      setExtracted(result)
      setStep('review')
    } catch (e) {
      setScanError(e.message || 'Scan failed. Please try again.')
      setStep('upload')
    } finally {
      setScanning(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }
  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  // ── Save to Firestore as pending user ────────────────────────────────────
  const handleSave = async () => {
    if (!extracted) return
    setSaving(true)
    try {
      const assessmentsObj = {}
      extracted.skills.forEach(s => {
        assessmentsObj[s.skillId] = { prof: s.proficiency, interest: 'Low', updatedAt: Date.now() }
      })
      const certsArr = extracted.certifications.map(c => ({
        certId: c.certId, status: c.status || 'Earned',
        acquiredDate: null, expiryDate: null, plannedYear: null, plannedQuarter: null,
      }))
      await savePendingUser({
        name: extracted.name,
        email: (extracted.email || '').toLowerCase(),
        role: 'contributor',
        team: extracted.suggestedPractice,
        assessments: assessmentsObj,
        certs: certsArr,
        summary: extracted.summary,
        scannedAt: Date.now(),
      })
      setStep('done')
      setExtracted(null)
    } catch (e) {
      setScanError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => { setStep('upload'); setExtracted(null); setScanError('') }

  const profLabel = v => ['','Awareness','Working','Advanced','Expert'][v] || ''
  const profColor = v => ['','#e00080','#ffc400','#4a90d9','#00c87a'][v] || '#4a4a60'

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setActiveTab(key)} style={{
      padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
      fontFamily:'Space Grotesk, sans-serif', fontWeight:600, fontSize:13,
      background: activeTab===key ? 'var(--grad)' : 'transparent',
      color: activeTab===key ? '#fff' : 'var(--muted)',
      boxShadow: activeTab===key ? 'var(--glow)' : 'none',
    }}>{label}</button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', gap:4, padding:'4px', background:'var(--panel)', borderRadius:10, border:'1px solid var(--border)', alignSelf:'flex-start' }}>
        {tabBtn('import', '📄 Scan CV')}
        {tabBtn('pending', `⏳ Pending (${(pendingUsers||[]).length})`)}
      </div>

      {/* ── SCAN TAB ── */}
      {activeTab === 'import' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Upload step */}
          {step === 'upload' && (
            <>
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius:16, padding:'48px 32px', textAlign:'center',
                  background: dragOver ? '#e0008008' : 'var(--panel)',
                  transition:'all .2s', cursor:'pointer',
                }}
                onClick={() => document.getElementById('cv-file-input').click()}
              >
                <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
                <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:16, marginBottom:8 }}>
                  Drop a CV here or click to browse
                </div>
                <div style={{ fontSize:13, color:'var(--muted)' }}>Supports PDF and Word (.docx) files</div>
                <input id="cv-file-input" type="file" accept=".pdf,.doc,.docx" style={{ display:'none' }} onChange={handleFileInput} />
              </div>
              {scanError && (
                <div style={{ padding:'12px 16px', borderRadius:10, background:'#ff444418', border:'1px solid #ff444444', color:'#ff6666', fontSize:13 }}>
                  ⚠️ {scanError}
                </div>
              )}
              <div style={{ padding:'16px 20px', borderRadius:12, background:'var(--panel2)', border:'1px solid var(--border)', fontSize:13, color:'var(--muted)', lineHeight:1.7 }}>
                <strong style={{ color:'var(--ink)' }}>How it works:</strong> Claude reads the CV, maps experience to your skills library, and creates a pending profile. When this person registers using the same email, their profile and skills are automatically assigned to their account.
              </div>
            </>
          )}

          {/* Scanning step */}
          {step === 'scanning' && (
            <div style={{ textAlign:'center', padding:'64px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
              <div style={{ width:56, height:56, borderRadius:'50%', border:'3px solid var(--border)', borderTopColor:'var(--accent)', animation:'spin 0.8s linear infinite' }} />
              <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:16 }}>Scanning CV with Claude…</div>
              <div style={{ fontSize:13, color:'var(--muted)' }}>Extracting skills, certifications and profile data</div>
            </div>
          )}

          {/* Review step */}
          {step === 'review' && extracted && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:16, padding:'20px 24px', background:'var(--panel2)', borderRadius:14, border:'1px solid var(--border)' }}>
                <Avatar name={extracted.name || '?'} size={52} />
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:800, fontSize:20 }}>{extracted.name || 'Unknown Name'}</div>
                  <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>{extracted.email || 'No email found — add manually before saving'}</div>
                  {extracted.summary && <div style={{ fontSize:13, color:'var(--muted)', marginTop:6, lineHeight:1.5 }}>{extracted.summary}</div>}
                </div>
              </div>

              {/* Practice suggestion */}
              <Card style={{ padding:'16px 20px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Suggested Practice</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:15, color:'var(--accent)' }}>{extracted.suggestedPractice}</span>
                  {extracted.practiceReason && <span style={{ fontSize:12, color:'var(--muted)' }}>— {extracted.practiceReason}</span>}
                </div>
                <div style={{ marginTop:10 }}>
                  <label style={{ fontSize:12, color:'var(--muted)', fontWeight:600, display:'block', marginBottom:6 }}>Override practice:</label>
                  <select value={extracted.suggestedPractice}
                    onChange={e => setExtracted(x => ({ ...x, suggestedPractice: e.target.value }))}
                    style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13 }}>
                    {['AI Engineering','Cloud Engineering','Core Network Eng','HR/Recruiting','Network Operations Eng','RAN Network Eng','Software Engineering','Testing Engineering','Transport Network Eng','Voice and Signaling Eng'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </Card>

              {/* Email override if missing */}
              {!extracted.email && (
                <Card style={{ padding:'16px 20px', border:'1px solid #ffc40044' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#ffc400', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>⚠️ No email found in CV</div>
                  <p style={{ fontSize:13, color:'var(--muted)', marginBottom:10 }}>The profile won't auto-link when this person registers without an email. Add it manually:</p>
                  <input placeholder="person@company.com" value={extracted.email || ''}
                    onChange={e => setExtracted(x => ({ ...x, email: e.target.value }))}
                    style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--panel2)', color:'var(--ink)', fontSize:13, boxSizing:'border-box' }} />
                </Card>
              )}

              {/* Skills */}
              <Card style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                    Skills Identified ({extracted.skills.length})
                  </div>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Click × to remove any false positives</span>
                </div>
                {extracted.skills.length === 0
                  ? <div style={{ fontSize:13, color:'var(--muted)', textAlign:'center', padding:16 }}>No skills matched to library</div>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {extracted.skills.map((s, i) => (
                      <div key={s.skillId} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px 5px 12px', borderRadius:99, border:`1px solid ${profColor(s.proficiency)}44`, background:profColor(s.proficiency)+'18' }}>
                        <span style={{ fontSize:12, fontWeight:600, color:profColor(s.proficiency) }}>{s.skillName}</span>
                        <span style={{ fontSize:11, color:profColor(s.proficiency), opacity:.8 }}>· {profLabel(s.proficiency)}</span>
                        <button onClick={() => setExtracted(x => ({ ...x, skills: x.skills.filter((_,j)=>j!==i) }))}
                          style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>×</button>
                      </div>
                    ))}
                  </div>
                }
              </Card>

              {/* Certifications */}
              <Card style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                    Certifications Identified ({extracted.certifications.length})
                  </div>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Click × to remove any false positives</span>
                </div>
                {extracted.certifications.length === 0
                  ? <div style={{ fontSize:13, color:'var(--muted)', textAlign:'center', padding:16 }}>No certifications matched to library</div>
                  : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {extracted.certifications.map((c, i) => (
                      <div key={c.certId} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px 5px 12px', borderRadius:99, border:'1px solid #00d08444', background:'#00d08418' }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'#00d084' }}>🏅 {c.certName}</span>
                        <button onClick={() => setExtracted(x => ({ ...x, certifications: x.certifications.filter((_,j)=>j!==i) }))}
                          style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>×</button>
                      </div>
                    ))}
                  </div>
                }
              </Card>

              {/* Actions */}
              <div style={{ display:'flex', gap:10 }}>
                <Btn onClick={handleSave} disabled={saving || !extracted.name} style={{ flex:1, justifyContent:'center' }}>
                  {saving ? 'Saving…' : '✓ Save to Pending Users'}
                </Btn>
                <Btn variant="secondary" onClick={reset} style={{ justifyContent:'center' }}>Scan Another</Btn>
              </div>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && (
            <div style={{ textAlign:'center', padding:'48px 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#00d08418', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>✓</div>
              <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:800, fontSize:18 }}>Profile saved!</div>
              <p style={{ fontSize:13, color:'var(--muted)', maxWidth:400 }}>
                When this person registers with their email, their skills and certifications will be automatically assigned to their account.
              </p>
              <Btn onClick={reset}>Scan Another CV</Btn>
            </div>
          )}
        </div>
      )}

      {/* ── PENDING USERS TAB ── */}
      {activeTab === 'pending' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {(!pendingUsers || pendingUsers.length === 0)
            ? <div style={{ textAlign:'center', padding:48, color:'var(--muted)', fontSize:14 }}>No pending profiles. Scan a CV to create one.</div>
            : pendingUsers.map(u => (
              <Card key={u.id} style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                <Avatar name={u.name || '?'} size={40} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'Space Grotesk, sans-serif', fontWeight:700, fontSize:14 }}>{u.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{u.email || 'No email'} · {u.team}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
                    {Object.keys(u.assessments||{}).length} skills · {(u.certs||[]).length} certs · scanned {new Date(u.scannedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:'#ffc40018', color:'#ffc400', fontWeight:600, border:'1px solid #ffc40044' }}>Awaiting registration</span>
                  <button onClick={async () => { await deletePendingUser(u.email); onPendingUsersChange() }}
                    style={{ background:'none', border:'1px solid #ff444444', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontSize:12, color:'#ff6666' }}>Remove</button>
                </div>
              </Card>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ─── Suggestions Panel (Manager) ─────────────────────────────────────────────
function SuggestionsPanel({ suggestions = [], categories, setCategories, certs, setCerts }) {
  const [busy, setBusy] = useState({})

  const pending  = suggestions.filter(s => s.status === 'pending')
  const resolved = suggestions.filter(s => s.status !== 'pending')

  const handleApprove = async (s) => {
    setBusy(b => ({ ...b, [s.id]: true }))
    await approveSuggestion(s.id)

    if (s.type === 'skill') {
      // Add skill to the right domain in categories
      const newSkillId = 'sk_' + Date.now()
      const updated = categories.map(cat =>
        cat.id === s.domainId
          ? { ...cat, skills: [...cat.skills, { id: newSkillId, name: s.skillName }] }
          : cat
      )
      setCategories(updated)
    } else if (s.type === 'cert') {
      const newCert = { id: 'c_' + Date.now(), name: s.certName, provider: s.provider || '', level: s.level || '' }
      setCerts([...certs, newCert])
    }
    setBusy(b => ({ ...b, [s.id]: false }))
  }

  const handleReject = async (s) => {
    setBusy(b => ({ ...b, [s.id]: true }))
    await rejectSuggestion(s.id)
    setBusy(b => ({ ...b, [s.id]: false }))
  }

  const statusBadge = (status) => {
    const map = {
      pending:  { label: 'Pending',  bg: '#1f1a00', color: '#ffb800' },
      approved: { label: 'Approved', bg: '#0a1f18', color: '#00d084' },
      rejected: { label: 'Rejected', bg: '#2a0a0a', color: '#ff4444' },
    }
    const s = map[status] || map.pending
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color, fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '.04em' }}>{s.label}</span>
  }

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Suggestions</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Review skill and certification suggestions from your team.</p>
      </div>

      {/* Pending */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
          Pending Review ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 14 }}>No pending suggestions — all caught up!</div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(s => (
              <Card key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                <div style={{ fontSize: 22 }}>{s.type === 'skill' ? '🔧' : '🏅'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                    {s.type === 'skill' ? s.skillName : s.certName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {s.type === 'skill'
                      ? `Skill · Domain: ${s.domainName}`
                      : `Certification · ${s.provider || ''}${s.level ? ` · ${s.level}` : ''}`}
                    {' · '}Suggested by <strong style={{ color: 'var(--ink)' }}>{s.suggestedByName}</strong>
                    {' · '}{new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {statusBadge(s.status)}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn small onClick={() => handleApprove(s)} disabled={busy[s.id]}
                    style={{ background: '#0a1f18', color: '#00d084', border: '1px solid #00d08444' }}>
                    ✓ Approve
                  </Btn>
                  <Btn small variant="danger" onClick={() => handleReject(s)} disabled={busy[s.id]}>
                    ✕ Reject
                  </Btn>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
            Previously Resolved ({resolved.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resolved.map(s => (
              <Card key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', opacity: 0.7 }}>
                <div style={{ fontSize: 18 }}>{s.type === 'skill' ? '🔧' : '🏅'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.type === 'skill' ? s.skillName : s.certName}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>by {s.suggestedByName}</div>
                </div>
                {statusBadge(s.status)}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AdminPanel({ categories, setCategories, certs, setCerts, allUsers, assessments, userCerts, user, pendingUsers, setPendingUsers }) {
  const [newCatName,  setNewCatName]  = useState('')
  const [newSkillName,setNewSkillName]= useState('')
  const [selCat,      setSelCat]      = useState(null)
  const [newCertName, setNewCertName] = useState('')
  const [newCertProv, setNewCertProv] = useState('')
  const [newCertLvl,  setNewCertLvl]  = useState('')
  const [adminTab,    setAdminTab]    = useState('skills')
  const [exporting,   setExporting]   = useState(false)
  const [inviteCode,  setInviteCode]  = useState('')
  const [codeInput,   setCodeInput]   = useState('')
  const [codeSaved,   setCodeSaved]   = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeVisible, setCodeVisible] = useState(false)

  useEffect(() => {
    getInviteCode().then(c => { if (c) { setInviteCode(c); setCodeInput(c) } })
  }, [])

  const handleSaveCode = async () => {
    if (!codeInput.trim()) return
    setCodeLoading(true)
    await saveInviteCode(codeInput.trim())
    setInviteCode(codeInput.trim())
    setCodeSaved(true)
    setCodeLoading(false)
    setTimeout(() => setCodeSaved(false), 2500)
  }

  const COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#0d9488','#9333ea']

  const addCat = () => {
    if (!newCatName.trim()) return
    setCategories([...categories, { id: 'c' + Date.now(), name: newCatName.trim(), color: COLORS[categories.length % COLORS.length], skills: [] }])
    setNewCatName('')
  }
  const addSkill = () => {
    if (!newSkillName.trim() || !selCat) return
    setCategories(categories.map(c => c.id === selCat ? { ...c, skills: [...c.skills, { id: 's' + Date.now(), name: newSkillName.trim() }] } : c))
    setNewSkillName('')
  }
  const deleteCat   = id => setCategories(categories.filter(c => c.id !== id))
  const deleteSkill = (catId, skId) => setCategories(categories.map(c => c.id === catId ? { ...c, skills: c.skills.filter(s => s.id !== skId) } : c))
  const addCert     = () => {
    if (!newCertName.trim()) return
    setCerts([...certs, { id: 'cert' + Date.now(), name: newCertName.trim(), provider: newCertProv, level: newCertLvl }])
    setNewCertName(''); setNewCertProv(''); setNewCertLvl('')
  }
  const deleteCert = id => setCerts(certs.filter(c => c.id !== id))

  const profLabels = ['','Awareness','Working','Advanced','Expert']

  const handleExport = () => {
    if (!window.XLSX) return alert('Export library not loaded yet, please try again.')
    setExporting(true)
    try {
      const XLSX = window.XLSX
      const wb = XLSX.utils.book_new()
      const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })

      // ── Sheet 1: Skills Matrix ──────────────────────────────────────────
      const allSkills = categories.flatMap(c => c.skills.map(s => ({ ...s, domain: c.name })))
      const skillHeaders = ['Name', 'Practice / Team', 'Role', ...allSkills.map(s => `[${s.domain}] ${s.name}`)]
      const skillRows = allUsers.map(u => {
        const ua = assessments[u.id] || {}
        return [
          u.name || '',
          u.team || '',
          u.role || '',
          ...allSkills.map(s => {
            const prof = ua[s.id]?.prof || 0
            return prof > 0 ? `${prof} - ${profLabels[prof]}` : ''
          })
        ]
      })
      const skillSheet = XLSX.utils.aoa_to_sheet([skillHeaders, ...skillRows])
      // Column widths
      skillSheet['!cols'] = [
        { wch: 28 }, { wch: 28 }, { wch: 18 },
        ...allSkills.map(() => ({ wch: 22 }))
      ]
      // Style header row bold
      const skillRange = XLSX.utils.decode_range(skillSheet['!ref'])
      for (let C = skillRange.s.c; C <= skillRange.e.c; C++) {
        const cell = skillSheet[XLSX.utils.encode_cell({ r: 0, c: C })]
        if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'E00080' } } }
      }
      XLSX.utils.book_append_sheet(wb, skillSheet, 'Skills Matrix')

      // ── Sheet 2: Certifications Matrix ─────────────────────────────────
      const certHeaders = ['Name', 'Practice / Team', 'Role', ...certs.map(c => `${c.name} (${c.provider})`)]
      const certRows = allUsers.map(u => {
        const uc = userCerts[u.id] || []
        return [
          u.name || '',
          u.team || '',
          u.role || '',
          ...certs.map(c => {
            const mine = uc.find(x => x.certId === c.id)
            if (!mine) return ''
            if (mine.status === 'Earned') {
              const parts = ['Earned']
              if (mine.acquiredDate) parts.push(`Acquired: ${mine.acquiredDate}`)
              if (mine.expiryDate)   parts.push(`Expires: ${mine.expiryDate}`)
              return parts.join(' | ')
            }
            if (mine.status === 'Planned') {
              const target = mine.plannedYear && mine.plannedQuarter ? ` (${mine.plannedQuarter} ${mine.plannedYear})` : ''
              return `Planned${target}`
            }
            return mine.status
          })
        ]
      })
      const certSheet = XLSX.utils.aoa_to_sheet([certHeaders, ...certRows])
      certSheet['!cols'] = [
        { wch: 28 }, { wch: 28 }, { wch: 18 },
        ...certs.map(() => ({ wch: 30 }))
      ]
      XLSX.utils.book_append_sheet(wb, certSheet, 'Certifications Matrix')

      // ── Sheet 3: People Directory ───────────────────────────────────────
      const peopleHeaders = ['Name', 'Email', 'Practice / Team', 'Role', 'Skills Rated', 'Certs Earned', 'Certs Planned']
      const peopleRows = allUsers.map(u => {
        const ua = assessments[u.id] || {}
        const uc = userCerts[u.id]   || []
        return [
          u.name || '',
          u.email || '',
          u.team || '',
          u.role || '',
          Object.values(ua).filter(a => a.prof > 0).length,
          uc.filter(c => c.status === 'Earned').length,
          uc.filter(c => c.status === 'Planned').length,
        ]
      })
      const peopleSheet = XLSX.utils.aoa_to_sheet([peopleHeaders, ...peopleRows])
      peopleSheet['!cols'] = [{ wch:28 },{ wch:32 },{ wch:28 },{ wch:18 },{ wch:14 },{ wch:14 },{ wch:14 }]
      XLSX.utils.book_append_sheet(wb, peopleSheet, 'People Directory')

      // ── Download ────────────────────────────────────────────────────────
      const filename = `Reailize_SkillMatrix_${now.replace(/\s/g,'_').replace(/,/g,'')}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch(e) {
      console.error(e)
      alert('Export failed: ' + e.message)
    }
    setExporting(false)
  }

  const tabStyle = t => ({
    padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13,
    background: adminTab === t ? '#e0008018' : 'transparent',
    color: adminTab === t ? 'var(--accent)' : 'var(--muted)',
    borderBottom: adminTab === t ? '2px solid var(--accent)' : '2px solid transparent',
  })

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Admin Panel</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Manage skill categories, certifications library, and exports.</p>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1.5px solid var(--border)', paddingBottom: 4 }}>
        <button style={tabStyle('skills')} onClick={() => setAdminTab('skills')}>Skills Library</button>
        <button style={tabStyle('certs')}  onClick={() => setAdminTab('certs')}>Certifications</button>
        {user?.role === 'manager' && (
          <button style={tabStyle('cv')} onClick={() => setAdminTab('cv')}>CV Import</button>
        )}
        {user?.role === 'manager' && (
          <button style={tabStyle('access')} onClick={() => setAdminTab('access')}>Access Code</button>
        )}
        {user?.role === 'manager' && (
          <button style={tabStyle('export')} onClick={() => setAdminTab('export')}>Export Data</button>
        )}
      </div>

      {adminTab === 'skills' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Categories</h3>
            {categories.map(c => (
              <div key={c.id} onClick={() => setSelCat(selCat === c.id ? null : c.id)}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid', borderColor: selCat === c.id ? c.color : 'var(--border)', background: selCat === c.id ? c.color + '10' : 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.skills.length}</span>
                <button onClick={e => { e.stopPropagation(); deleteCat(c.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14 }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category" onKeyDown={e => e.key === 'Enter' && addCat()}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }} />
              <Btn onClick={addCat} small>Add</Btn>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>{selCat ? `Skills in "${categories.find(c=>c.id===selCat)?.name}"` : 'Select a category →'}</h3>
            {selCat && (
              <>
                {categories.find(c => c.id === selCat)?.skills.map(sk => (
                  <div key={sk.id} style={{ padding: '9px 14px', borderRadius: 9, border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>{sk.name}</span>
                    <button onClick={() => deleteSkill(selCat, sk.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="New skill" onKeyDown={e => e.key === 'Enter' && addSkill()}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }} />
                  <Btn onClick={addSkill} small>Add</Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {adminTab === 'certs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {certs.map(c => (
            <div key={c.id} style={{ padding: '12px 16px', borderRadius: 10, border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.provider} · {c.level}</div>
              </div>
              <button onClick={() => deleteCert(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14 }}>✕</button>
            </div>
          ))}
          <Card style={{ padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Add New Certification</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Input label="Name"     value={newCertName} onChange={setNewCertName} placeholder="e.g. CKA" />
              <Input label="Provider" value={newCertProv} onChange={setNewCertProv} placeholder="e.g. CNCF" />
              <Input label="Level"    value={newCertLvl}  onChange={setNewCertLvl}  placeholder="e.g. Professional" />
            </div>
            <Btn onClick={addCert} small>Add Certification</Btn>
          </Card>
        </div>
      )}

      {adminTab === 'cv' && user?.role === 'manager' && (
        <CVScanner
          categories={categories}
          certs={certs}
          pendingUsers={pendingUsers}
          onPendingUsersChange={() => {}}
        />
      )}

      {adminTab === 'access' && user?.role === 'manager' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 540 }}>
          <Card style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#e0008018', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🔐</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Company Access Code</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  New users must enter this code when creating an account. Share it only with employees you want to grant access. Change it anytime to invalidate old codes — existing users are unaffected.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Current Access Code</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type={codeVisible ? 'text' : 'password'}
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value)}
                    placeholder="Set an access code…"
                    style={{ width: '100%', padding: '10px 44px 10px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--panel2)', color: 'var(--ink)', fontSize: 15, fontFamily: 'Courier New, monospace', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    onKeyDown={e => e.key === 'Enter' && handleSaveCode()}
                  />
                  <button onClick={() => setCodeVisible(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                    {codeVisible ? '🙈' : '👁️'}
                  </button>
                </div>
                <Btn onClick={handleSaveCode} disabled={codeLoading || !codeInput.trim()} style={{ whiteSpace: 'nowrap' }}>
                  {codeLoading ? 'Saving…' : codeSaved ? '✓ Saved!' : 'Save Code'}
                </Btn>
              </div>
              {inviteCode && (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  A code is currently set. Users must enter it exactly (case-insensitive) when registering.
                </p>
              )}
              {!inviteCode && (
                <p style={{ fontSize: 12, color: 'var(--danger)' }}>
                  ⚠️ No access code is set — registration is currently blocked for all new users.
                </p>
              )}
            </div>
          </Card>

          <Card style={{ padding: '20px 24px', background: '#1f1a00', border: '1px solid #ffc40033' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#ffc400', marginBottom: 8 }}>💡 Tips</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
              • Use something memorable but not guessable (e.g. <span style={{ fontFamily: 'monospace', color: 'var(--ink)' }}>byond-skills-2025</span>)<br />
              • Share it via a private Slack message or email — not in public channels<br />
              • Rotate it periodically or after someone leaves the company<br />
              • Changing the code does not affect existing logged-in users
            </div>
          </Card>
        </div>
      )}

      {adminTab === 'export' && user?.role === 'manager' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Export Full Skill Matrix</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Downloads an Excel workbook with three sheets covering the complete state of your practice's skills and certifications.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { icon: '📊', title: 'Skills Matrix', desc: `${allUsers.length} people × ${categories.reduce((s,c)=>s+c.skills.length,0)} skills with proficiency levels` },
                { icon: '🏅', title: 'Certifications Matrix', desc: `${allUsers.length} people × ${certs.length} certs with dates and target quarters` },
                { icon: '👥', title: 'People Directory', desc: `Full roster with role, practice, and summary counts` },
              ].map(s => (
                <div key={s.title} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--panel2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>

            <div>
              <Btn onClick={handleExport} disabled={exporting} style={{ gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {exporting ? 'Generating…' : 'Download Excel (.xlsx)'}
              </Btn>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                Exports current data for {allUsers.length} team members · {categories.reduce((s,c)=>s+c.skills.length,0)} skills · {certs.length} certifications
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
