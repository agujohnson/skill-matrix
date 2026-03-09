import { useState, useEffect, useCallback } from 'react'
import {
  auth, login, register, loginWithMicrosoft, logout,
  getUserProfile, createUserProfile,
  saveAssessment, getAssessments, onAssessmentsSnapshot,
  saveUserCerts, getUserCerts, onUserCertsSnapshot,
  getCategories, saveCategories,
  getCertsLibrary, saveCertsLibrary,
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
  .fadeUp { animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
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
  { val: 1, label: 'Awareness', color: '#0d1a2e', textColor: '#4a90d9' },
  { val: 2, label: 'Working',   color: '#0a1f18', textColor: '#00c87a' },
  { val: 3, label: 'Advanced',  color: '#1f1a00', textColor: '#ffc400' },
  { val: 4, label: 'Expert',    color: '#2a0a1a', textColor: '#ff4da6' },
]

const INTEREST = ['Low', 'Medium', 'High']

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
    if (profile.role === 'manager') {
      const unsub1 = onAssessmentsSnapshot(setAssessments)
      const unsub2 = onUserCertsSnapshot(setUserCerts)
      return () => { unsub1(); unsub2() }
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
    onLogout: handleLogout,
  }

  return (
    <>
      <style>{STYLE}</style>
      {profile.role === 'manager' ? <ManagerApp {...ctx} /> : <MemberApp {...ctx} />}
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
  const [role, setRole]       = useState('member')
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
    if (!team.trim())         return setErr('Please enter your practice / team.')
    if (pass !== pass2)       return setErr('Passwords do not match.')
    if (pass.length < 6)      return setErr('Password must be at least 6 characters.')
    setLoading(true)
    try {
      const cred = await register(email, pass)
      await createUserProfile(cred.user.uid, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        team: team.trim(),
      })
      // onAuthStateChanged will pick up the new user automatically
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setErr('An account with this email already exists.')
      else if (e.code === 'auth/invalid-email')   setErr('Please enter a valid email address.')
      else setErr('Sign up failed. Please try again.')
    } finally { setLoading(false) }
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
        {/* white layer for dark text */}
        <img src="/logo.png" alt="Reailize" style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block' }} />
        {/* magenta layer on top via mix-blend-mode */}
        <img src="/logo.png" alt="Reailize" style={{ height: 36, objectFit: 'contain', position: 'absolute', top: 0, left: 0, mixBlendMode: 'lighten', display: 'block' }} />
      </div>
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

        {/* ── Sign In ── */
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
                    { val: 'member',  label: '👷 Team Member',      desc: 'Rate my own skills' },
                    { val: 'manager', label: '📊 Practice Manager', desc: 'View team dashboards' },
                  ].map(r => (
                    <div key={r.val} onClick={() => setRole(r.val)} style={{
                      padding: '10px 12px', borderRadius: 9, border: '2px solid',
                      borderColor: role === r.val ? 'var(--accent)' : 'var(--border)',
                      background: role === r.val ? '#eff6ff' : 'transparent',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Input label="Practice / Team" value={team} onChange={setTeam} placeholder="e.g. Cloud Engineering" />
              <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="Min. 6 characters" />
              <Input label="Confirm Password" type="password" value={pass2} onChange={setPass2} placeholder="Repeat password" />

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
<div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
            <img src="/logo.png" alt="Reailize" style={{ height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block' }} />
            <img src="/logo.png" alt="Reailize" style={{ height: 32, objectFit: 'contain', position: 'absolute', top: 0, left: 0, mixBlendMode: 'lighten', display: 'block' }} />
          </div>
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
                  { val: 'member',  label: '👷 Team Member',   desc: 'I rate my own skills' },
                  { val: 'manager', label: '📊 Practice Manager', desc: 'I view team dashboards' },
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
            <Input
              label="Your Practice / Team"
              value={team}
              onChange={setTeam}
              placeholder="e.g. Cloud Engineering, Network, Lab…"
            />

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
<div style={{ position: 'relative', display: 'inline-block' }}>
            <img src="/logo.png" alt="Reailize" style={{ height: 22, objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block' }} />
            <img src="/logo.png" alt="Reailize" style={{ height: 22, objectFit: 'contain', position: 'absolute', top: 0, left: 0, mixBlendMode: 'lighten', display: 'block' }} />
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--muted)', letterSpacing: '.02em' }}>Skill Matrix</span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {nav.map(n => (
            <button key={n.key} onClick={() => setActiveTab(n.key)} style={{
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
    { key: 'skills', icon: '🧠', label: 'My Skills' },
    { key: 'certs',  icon: '🏅', label: 'My Certifications' },
  ]
  return (
    <Shell user={ctx.user} onLogout={ctx.onLogout} nav={nav} activeTab={tab} setActiveTab={setTab}>
      {tab === 'skills' && <MemberSkills {...ctx} />}
      {tab === 'certs'  && <MemberCerts {...ctx} />}
    </Shell>
  )
}

function MemberSkills({ user, categories, assessments, setAssessment }) {
  const myA = assessments[user.uid] || {}

  const setSkill = useCallback((skillId, field, val) => {
    const current = myA[skillId] || { prof: 0, interest: 'Low' }
    setAssessment(user.uid, skillId, { ...current, [field]: val })
  }, [user.uid, myA, setAssessment])

  const filled = Object.values(myA).filter(a => a.prof > 0).length
  const total  = categories.reduce((s, c) => s + c.skills.length, 0)

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>My Skills</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Rate your proficiency and growth interest for each skill.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Syne, sans-serif', background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {filled}/{total}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>skills assessed</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PROFICIENCY.map(p => <Badge key={p.val} label={`${p.val} – ${p.label}`} color={p.color} textColor={p.textColor} />)}
      </div>

      {categories.map(cat => (
        <div key={cat.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{cat.name}</h3>
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

  const toggle = (certId, status) => {
    const exists = myC.find(c => c.certId === certId)
    let updated
    if (exists) {
      if (exists.status === status) {
        updated = myC.filter(c => c.certId !== certId)
      } else {
        updated = myC.map(c => c.certId === certId ? { ...c, status } : c)
      }
    } else {
      updated = [...myC, { certId, status, date: new Date().toISOString().slice(0, 10) }]
    }
    setUserCerts(user.uid, updated)
  }

  const statusColors = {
    Earned:  { bg: '#d1fae5', text: '#065f46' },
    Planned: { bg: '#dbeafe', text: '#1d4ed8' },
  }

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>My Certifications</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Mark certifications you've earned or are working toward.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {certs.map(cert => {
          const mine = myC.find(c => c.certId === cert.id)
          return (
            <Card key={cert.id} style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{cert.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{cert.provider} · {cert.level}</div>
                </div>
                {mine && <Badge label={mine.status} color={statusColors[mine.status].bg} textColor={statusColors[mine.status].text} />}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Btn small variant={mine?.status === 'Earned' ? 'primary' : 'secondary'} onClick={() => toggle(cert.id, 'Earned')}>✓ Earned</Btn>
                <Btn small variant={mine?.status === 'Planned' ? 'primary' : 'secondary'} onClick={() => toggle(cert.id, 'Planned')}>⏱ Planned</Btn>
              </div>
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
  const nav = [
    { key: 'heatmap', icon: '🔥', label: 'Skills Heatmap' },
    { key: 'certs',   icon: '🏅', label: 'Certifications' },
    { key: 'domains', icon: '🗂',  label: 'By Domain' },
    { key: 'admin',   icon: '⚙️',  label: 'Admin' },
  ]
  return (
    <Shell user={ctx.user} onLogout={ctx.onLogout} nav={nav} activeTab={tab} setActiveTab={setTab}>
      {tab === 'heatmap' && <Heatmap {...ctx} />}
      {tab === 'certs'   && <CertTracker {...ctx} />}
      {tab === 'domains' && <DomainView {...ctx} />}
      {tab === 'admin'   && <AdminPanel {...ctx} />}
    </Shell>
  )
}

function Heatmap({ assessments, categories }) {
  // In the real app, users come from Firestore. Here we derive from assessment keys.
  const memberIds = Object.keys(assessments)
  const profColor = v => ['#1e1e2a','#0d1a2e','#0a1f18','#1f1a00','#2a0a1a'][v] || '#1e1e2a'

  const totalAssessed = Object.values(assessments).reduce((s, u) => s + Object.values(u).filter(a => a.prof > 0).length, 0)
  const allVals = Object.values(assessments).flatMap(u => Object.values(u).map(a => a.prof)).filter(v => v > 0)
  const avgProf = allVals.length ? (allVals.reduce((s, v) => s + v, 0) / allVals.length).toFixed(1) : '—'

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Skills Heatmap</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Team proficiency at a glance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Team Members', val: memberIds.length, icon: '👥' },
          { label: 'Skills Tracked',    val: categories.reduce((s, c) => s + c.skills.length, 0), icon: '🧠' },
          { label: 'Assessments Done',  val: totalAssessed, icon: '✅' },
          { label: 'Avg Proficiency',   val: avgProf, icon: '📈' },
        ].map(c => (
          <Card key={c.label} style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, marginTop: 4 }}>{c.val}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--muted)', position: 'sticky', left: 0, background: 'var(--panel)', zIndex: 2 }}>Skill</th>
              {memberIds.map(uid => (
                <th key={uid} style={{ padding: '12px 10px', minWidth: 80, textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>{uid.slice(0, 8)}…</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <>
                <tr key={cat.id + '_h'}>
                  <td colSpan={memberIds.length + 1} style={{ padding: '10px 16px', background: cat.color + '18', fontWeight: 700, fontSize: 11, color: cat.color, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {cat.name}
                  </td>
                </tr>
                {cat.skills.map(sk => (
                  <tr key={sk.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 16px', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--panel)', zIndex: 1 }}>{sk.name}</td>
                    {memberIds.map(uid => {
                      const v = assessments[uid]?.[sk.id]?.prof || 0
                      return (
                        <td key={uid} style={{ textAlign: 'center', padding: '6px 10px' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, background: profColor(v),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto', fontWeight: 700, fontSize: 13,
                            color: v > 0 ? PROFICIENCY[v].textColor : '#d1d5db',
                          }}>{v > 0 ? v : '·'}</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PROFICIENCY.map(p => <Badge key={p.val} label={`${p.val} – ${p.label}`} color={p.color} textColor={p.textColor} />)}
      </div>
    </div>
  )
}

function CertTracker({ userCerts, certs }) {
  const allUserIds = Object.keys(userCerts)
  const earned  = certId => allUserIds.filter(uid => userCerts[uid]?.find(c => c.certId === certId && c.status === 'Earned'))
  const planned = certId => allUserIds.filter(uid => userCerts[uid]?.find(c => c.certId === certId && c.status === 'Planned'))

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Certifications Tracker</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Who holds what — and what the team is pursuing.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {certs.map(cert => {
          const e = earned(cert.id)
          const p = planned(cert.id)
          return (
            <Card key={cert.id} style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{cert.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{cert.provider} · {cert.level}</div>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#16a34a' }}>{e.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Earned</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: '#2563eb' }}>{p.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Planned</div>
                  </div>
                </div>
              </div>
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

function AdminPanel({ categories, setCategories, certs, setCerts }) {
  const [newCatName,  setNewCatName]  = useState('')
  const [newSkillName,setNewSkillName]= useState('')
  const [selCat,      setSelCat]      = useState(null)
  const [newCertName, setNewCertName] = useState('')
  const [newCertProv, setNewCertProv] = useState('')
  const [newCertLvl,  setNewCertLvl]  = useState('')
  const [adminTab,    setAdminTab]    = useState('skills')

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

  const tabStyle = t => ({
    padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: 13,
    background: adminTab === t ? '#eff6ff' : 'transparent',
    color: adminTab === t ? 'var(--accent)' : 'var(--muted)',
  })

  return (
    <div className="fadeUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Admin Panel</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Manage skill categories and the certifications library.</p>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1.5px solid var(--border)', paddingBottom: 4 }}>
        <button style={tabStyle('skills')} onClick={() => setAdminTab('skills')}>🧠 Skills Library</button>
        <button style={tabStyle('certs')}  onClick={() => setAdminTab('certs')}>🏅 Certifications</button>
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
    </div>
  )
}
