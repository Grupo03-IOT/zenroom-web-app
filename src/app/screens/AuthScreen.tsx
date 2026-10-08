import { useState } from 'react'
import { Activity, ArrowRight, BellRing, Building2, Check, Eye, EyeOff, Radio, Users } from 'lucide-react'
import type { Role } from '../../contexts/identity/domain/session'
import type { AuthMode } from '../routing'
import { LanguageToggle } from '../components/LanguageToggle'
import { tr } from '../../shared/i18n/i18n'
import brandIcon from '../../shared/assets/logo-isotype.svg'
import './AuthScreen.css'

interface Props {
  demo: boolean
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string, name: string, role: Role) => Promise<void>
}

export function AuthScreen({ demo, mode, onModeChange, onLogin, onRegister }: Props) {
  const signup = mode === 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [registrationRole, setRegistrationRole] = useState<Role>('MEMBER')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function switchMode(nextSignup: boolean, role: Role = 'MEMBER') {
    onModeChange(nextSignup ? 'signup' : 'login')
    setRegistrationRole(role)
    setError('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (signup) {
        await onRegister(email, password, `${firstName.trim()} ${lastName.trim()}`.trim(), registrationRole)
      } else {
        await onLogin(email, password)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Unable to continue'))
    } finally {
      setBusy(false)
    }
  }

  const adminSignup = signup && registrationRole === 'ADMIN'
  const registrationBlocked = adminSignup && !demo

  return <div className="auth-page">
    <div className="auth-grid" aria-hidden="true" />
    <div className="auth-orbit auth-orbit-one" aria-hidden="true"><Radio /></div>
    <div className="auth-orbit auth-orbit-two" aria-hidden="true"><Activity /></div>
    <div className="auth-orbit auth-orbit-three" aria-hidden="true"><Radio /></div>
    <div className="auth-orbit auth-orbit-four" aria-hidden="true"><Activity /></div>

    <div className="auth-page-language"><LanguageToggle /></div>

    <main className={`auth-stage ${adminSignup ? 'auth-stage-single' : ''}`}>
      <form className="auth-form-card" onSubmit={submit}>
        <div className="auth-logo"><img src={brandIcon} alt=""/><strong>Sense<span>Work</span></strong></div>
        <div className="auth-intro">
          <h1>{tr(signup ? 'Create your account' : 'Welcome back')}</h1>
          <p>{tr(signup ? (adminSignup ? (demo ? 'Set up your administrator account to monitor your spaces.' : 'Administrator access requires an existing administrator.') : 'Discover the comfort of every room before choosing one.') : 'Your spaces and comfort data are waiting for you.')}</p>
        </div>

        {signup && <div className="auth-name-fields">
          <label>{tr('First name')}<input value={firstName} onChange={event => setFirstName(event.target.value)} placeholder={tr('Your first name')} autoComplete="given-name" required /></label>
          <label>{tr('Last name')}<input value={lastName} onChange={event => setLastName(event.target.value)} placeholder={tr('Your last name')} autoComplete="family-name" required /></label>
        </div>}

        <label>{tr('Email')}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" autoComplete="email" required /></label>
        <label>{tr('Password')}<span className="auth-password"><input type={visible ? 'text' : 'password'} minLength={signup ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete={signup ? 'new-password' : 'current-password'} required /><button type="button" onClick={() => setVisible(!visible)} aria-label={tr(visible ? 'Hide password' : 'Show password')}>{visible ? <EyeOff /> : <Eye />}</button></span></label>

        {signup && <>
          <button className={`auth-role-choice ${adminSignup ? 'selected' : ''}`} type="button" role="switch" aria-checked={adminSignup} onClick={() => { setRegistrationRole(adminSignup ? 'MEMBER' : 'ADMIN'); setError('') }}>
            <span className="auth-role-icon"><Building2 /></span>
            <span className="auth-role-copy"><strong>{tr('I manage a coworking space')}</strong><small>{tr('Monitor rooms, devices and alerts as an administrator.')}</small></span>
            <span className="auth-role-track"><i /></span>
          </button>
          {registrationBlocked && <div className="auth-role-note" role="status">{tr('Cloud API currently creates member accounts only. An existing administrator must grant the administrator role.')}</div>}
        </>}

        {error && <div className="auth-error" role="alert">{tr(error)}</div>}
        <button className="auth-submit" disabled={busy || registrationBlocked}>{tr(busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in')}<ArrowRight /></button>

        <div className="auth-switch">{tr(signup ? 'Already have an account?' : 'New to SenseWork?')} <button type="button" onClick={() => switchMode(!signup)}>{tr(signup ? 'Sign in' : 'Sign up')}</button></div>
        <p className="auth-legal">{tr('By continuing you accept the')} {tr('Terms of Service')} {tr('and the')} {tr('Privacy Policy')}.</p>
      </form>

      {!adminSignup && <aside className="auth-business-card">
        <div className="auth-business-eyebrow">SENSEWORK · {tr('FOR WORKSPACES')}</div>
        <h2>{tr('Manage a coworking space?')}<br />{tr('Understand every room in real time.')}</h2>
        <p>{tr(demo ? 'Choose the administrator role during sign up to manage spaces, review sensor readings and respond to alerts.' : 'Cloud API creates member accounts. An existing administrator grants access to manage spaces and alerts.')}</p>
        <ul>
          <li><span><Radio /></span>{tr('Live room readings')}</li>
          <li><span><Users /></span>{tr('Occupancy and comfort trends')}</li>
          <li><span><BellRing /></span>{tr('Alerts and corrective actions')}</li>
        </ul>
        <button type="button" className="auth-business-link" onClick={() => switchMode(true, 'ADMIN')}>{tr(demo ? 'Register as an administrator' : 'View administrator access')}<ArrowRight /></button>
        <div className="auth-business-foot"><Check />{tr('Built for connected spaces')}</div>
      </aside>}
    </main>

    <footer className="auth-page-footer">SENSEWORK · {tr('REAL-TIME COMFORT')} · {tr('CONNECTED SPACES')}</footer>
  </div>
}
