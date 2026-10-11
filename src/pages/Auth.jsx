import { useState, useEffect, useRef } from 'react'
import { Mail, KeyRound, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import { useStore } from '../store.jsx'
import { supabaseEnabled } from '../lib/supabase'

export function Auth({ onNavigate }) {
  const {
    user,
    authLoading,
    sendOtp,
    verifyOtpCode,
    createPassword,
    signInPassword,
    sendRecoveryOtp,
    showToast
  } = useStore()

  // mode: 'login' | 'signup' | 'recovery'
  // step within signup/recovery: 'email' -> 'otp' -> 'password'
  const [mode, setMode] = useState('signup')
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const otpRef = useRef(null)

  useEffect(() => {
    if (user && !authLoading) onNavigate('dashboard')
  }, [user, authLoading, onNavigate])

  useEffect(() => {
    if (step === 'otp' && otpRef.current) otpRef.current.focus()
  }, [step])

  if (!supabaseEnabled) {
    return (
      <div className="content">
        <div className="card card-pad auth-card">
          <div className="section-title"><ShieldCheck /> Cloud accounts not configured</div>
          <p className="muted small">
            This build has no Supabase keys, so it runs in guest mode: analyses stay in
            this browser only. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to a <code>.env</code> file (see{' '}
            <code>.env.example</code>) and restart the dev server to enable sign-in.
          </p>
          <button className="btn btn-ghost mt-14" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="content">
        <div className="card card-pad auth-card center">
          <Loader2 className="spin" />
          <p className="muted small">Checking session…</p>
        </div>
      </div>
    )
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    const v = email.trim()
    if (!validEmail(v)) {
      showToast('Enter a valid email address.', 'error')
      return
    }
    setBusy(true)
    const { error } = await sendOtp(v)
    setBusy(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('OTP sent — check your inbox.')
    setStep('otp')
  }

  async function handleVerify(e) {
    e.preventDefault()
    const code = otp.trim()
    if (!/^\d{6,8}$/.test(code)) {
      showToast('Enter the digit code from your email (6–8 digits).', 'error')
      return
    }
    setBusy(true)
    const { error, needsPassword } = await verifyOtpCode(email.trim(), code)
    setBusy(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    if (needsPassword) {
      setStep('password')
      showToast('Verified. Now create a password for your account.')
    } else {
      showToast('Signed in.')
      onNavigate('dashboard')
    }
  }

  async function handleCreatePassword(e) {
    e.preventDefault()
    if (password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error')
      return
    }
    if (password !== password2) {
      showToast('Passwords do not match.', 'error')
      return
    }
    setBusy(true)
    const { error } = await createPassword(password)
    setBusy(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Account ready — you are signed in.')
    onNavigate('dashboard')
  }

  async function handleLogin(e) {
    e.preventDefault()
    const v = email.trim()
    if (!validEmail(v) || !password) {
      showToast('Enter email and password.', 'error')
      return
    }
    setBusy(true)
    const { error } = await signInPassword(v, password)
    setBusy(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Signed in.')
    onNavigate('dashboard')
  }

  async function handleSendRecovery(e) {
    e.preventDefault()
    const v = email.trim()
    if (!validEmail(v)) {
      showToast('Enter a valid email address.', 'error')
      return
    }
    setBusy(true)
    const { error } = await sendRecoveryOtp(v)
    setBusy(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    showToast('Reset code sent — check your inbox.')
    setStep('otp')
  }

  function switchMode(next) {
    setMode(next)
    setStep('email')
    setOtp('')
    setPassword('')
    setPassword2('')
  }

  return (
    <div className="content">
      <div className="card card-pad auth-card">
        {mode === 'login' && (
          <>
            <div className="section-title"><KeyRound /> Sign in</div>
            <p className="muted small mb-14">
              Welcome back. Sign in to access your saved analyses from any device.
            </p>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <KeyRound />} Sign in
              </button>
            </form>
            <div className="auth-links">
              <button type="button" onClick={() => switchMode('recovery')}>
                Forgot password?
              </button>
              <span className="muted">·</span>
              <button type="button" onClick={() => switchMode('signup')}>
                Create a new account
              </button>
            </div>
          </>
        )}

        {mode === 'signup' && step === 'email' && (
          <>
            <div className="section-title"><Mail /> Create your account</div>
            <p className="muted small mb-14">
              Enter your email — we'll send a 6-digit OTP to verify it. No password needed yet.
            </p>
            <form onSubmit={handleSendOtp}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <Mail />} Send OTP
              </button>
            </form>
            <div className="auth-links">
              <button type="button" onClick={() => switchMode('login')}>
                I already have an account
              </button>
            </div>
          </>
        )}

        {mode === 'signup' && step === 'otp' && (
          <>
            <div className="section-title"><ShieldCheck /> Enter OTP</div>
            <p className="muted small mb-14">
              We sent a code to <strong>{email}</strong>. It expires shortly — check spam if needed.
            </p>
            <form onSubmit={handleVerify}>
              <div className="field">
                <label>Verification code</label>
                <input
                  ref={otpRef}
                  className="otp-input"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="00000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={busy || otp.length < 6}
              >
                {busy ? <Loader2 className="spin" /> : <ShieldCheck />} Verify
              </button>
            </form>
            <div className="auth-links">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const { error } = await sendOtp(email.trim())
                  showToast(error || 'OTP resent.', error ? 'error' : 'ok')
                }}
              >
                Resend code
              </button>
              <span className="muted">·</span>
              <button type="button" onClick={() => switchMode('signup')}>
                Change email
              </button>
            </div>
          </>
        )}

        {mode === 'signup' && step === 'password' && (
          <>
            <div className="section-title"><KeyRound /> Create a password</div>
            <p className="muted small mb-14">
              Email verified. Set a password so you can sign in next time with email + password.
            </p>
            <form onSubmit={handleCreatePassword}>
              <div className="field">
                <label>Password (min 8 characters)</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={busy}
              >
                {busy ? <Loader2 className="spin" /> : <KeyRound />} Create password
              </button>
            </form>
          </>
        )}

        {mode === 'recovery' && step === 'email' && (
          <>
            <div className="section-title"><KeyRound /> Reset password</div>
            <p className="muted small mb-14">
              Enter your email — we'll send a 6-digit OTP to confirm it's you.
            </p>
            <form onSubmit={handleSendRecovery}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <Mail />} Send reset code
              </button>
            </form>
            <div className="auth-links">
              <button type="button" onClick={() => switchMode('login')}>
                Back to sign in
              </button>
            </div>
          </>
        )}

        {mode === 'recovery' && step === 'otp' && (
          <>
            <div className="section-title"><ShieldCheck /> Enter reset code</div>
            <p className="muted small mb-14">
              We sent a code to <strong>{email}</strong>.
            </p>
            <form onSubmit={handleVerify}>
              <div className="field">
                <label>Verification code</label>
                <input
                  ref={otpRef}
                  className="otp-input"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="00000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button
                className="btn btn-primary btn-block"
                type="submit"
                disabled={busy || otp.length < 6}
              >
                {busy ? <Loader2 className="spin" /> : <ShieldCheck />} Verify
              </button>
            </form>
            <div className="auth-links">
              <button type="button" onClick={() => switchMode('login')}>
                Back to sign in
              </button>
            </div>
          </>
        )}

        {mode === 'recovery' && step === 'password' && (
          <>
            <div className="section-title"><KeyRound /> Set new password</div>
            <p className="muted small mb-14">Choose a new password for your account.</p>
            <form onSubmit={handleCreatePassword}>
              <div className="field">
                <label>New password (min 8 characters)</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? <Loader2 className="spin" /> : <KeyRound />} Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
