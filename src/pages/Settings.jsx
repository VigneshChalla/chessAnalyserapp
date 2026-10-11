import { useState } from 'react'
import { User, KeyRound, SlidersHorizontal, Eye, EyeOff, Check, LogIn, Loader2 } from 'lucide-react'
import { useStore } from '../store.jsx'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'password', label: 'Change Password' },
  { id: 'prefs', label: 'Preferences' }
]

export function Settings({ onNavigate }) {
  const {
    profile, setProfile, prefs, setPrefs, theme, setTheme, showToast,
    user, signInPassword, createPassword
  } = useStore()
  const [tab, setTab] = useState('profile')
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  function saveProfile(e) {
    e.preventDefault()
    setProfile({ name: name.trim() || 'username_123', email: email.trim() })
    showToast('Profile updated.')
  }

  async function savePassword(e) {
    e.preventDefault()
    if (!pw.cur || !pw.next || !pw.confirm) {
      showToast('Fill in all password fields.', 'error')
      return
    }
    if (pw.next.length < 8) {
      showToast('New password must be at least 8 characters.', 'error')
      return
    }
    if (pw.next !== pw.confirm) {
      showToast('New passwords do not match.', 'error')
      return
    }
    setPwBusy(true)
    // Re-verify current password before allowing the change (like Amazon/Flipkart).
    const re = await signInPassword(profile.email, pw.cur)
    if (re.error) {
      setPwBusy(false)
      showToast(re.error, 'error')
      return
    }
    const res = await createPassword(pw.next)
    setPwBusy(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    setPw({ cur: '', next: '', confirm: '' })
    showToast('Password updated.')
  }

  return (
    <div className="content">
      <div className="card card-pad">
        <div className="section-title"><SlidersHorizontal /> Settings</div>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="settings-grid">
            <div className="card card-pad" style={{ boxShadow: 'none' }}>
              <div className="section-title"><User /> Profile Information</div>
              <form onSubmit={saveProfile}>
                <div className="field-row mb-14">
                  <div className="avatar" style={{ margin: 0 }}>
                    ♞
                  </div>
                  <div className="grow">
                    <div className="bold">{name || 'username_123'}</div>
                    <div className="small muted">Default name for new visitors: username_123</div>
                  </div>
                </div>
                <div className="field">
                  <label>Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  <Check /> Save Profile
                </button>
              </form>
            </div>

            <div className="card card-pad" style={{ boxShadow: 'none' }}>
              <div className="section-title"><KeyRound /> Change Password</div>
              {!user ? (
                <div>
                  <p className="muted small mb-14">
                    You are browsing as a guest. Passwords belong to accounts — sign in
                    first to change or create one.
                  </p>
                  <button className="btn btn-primary" onClick={() => onNavigate?.('auth')}>
                    <LogIn /> Sign in to set a password
                  </button>
                </div>
              ) : (
                <form onSubmit={savePassword}>
                  <div className="field pw-wrap">
                    <label>Current Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pw.cur}
                      onChange={(e) => setPw({ ...pw, cur: e.target.value })}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="field pw-wrap">
                    <label>New Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pw.next}
                      onChange={(e) => setPw({ ...pw, next: e.target.value })}
                      placeholder="Enter new password (min 8 chars)"
                    />
                  </div>
                  <div className="field pw-wrap">
                    <label>Confirm New Password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pw.confirm}
                      onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mb-10"
                    onClick={() => setShowPw((s) => !s)}
                  >
                    {showPw ? <EyeOff /> : <Eye />} {showPw ? 'Hide' : 'Show'} passwords
                  </button>
                  <div>
                    <button className="btn btn-primary" type="submit" disabled={pwBusy}>
                      {pwBusy ? <Loader2 className="spin" /> : <KeyRound />} Update Password
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {tab === 'prefs' && (
          <div className="card card-pad" style={{ boxShadow: 'none', maxWidth: 640 }}>
            <div className="pref-row">
              <div>
                <div className="lbl">Theme</div>
                <div className="desc">Orange &amp; white for light, black &amp; green for dark.</div>
              </div>
              <div className="seg">
                <button
                  className={theme === 'light' ? 'active' : ''}
                  onClick={() => setTheme('light')}
                >
                  Light
                </button>
                <button
                  className={theme === 'dark' ? 'active' : ''}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="pref-row">
              <div>
                <div className="lbl">Analysis depth</div>
                <div className="desc">Higher depth = stronger evals, slower analysis. Default: 20.</div>
              </div>
              <select
                value={prefs.depth || 20}
                onChange={(e) => setPrefs({ ...prefs, depth: parseInt(e.target.value, 10) })}
              >
                <option value={12}>12 — Fast</option>
                <option value={16}>16 — Balanced</option>
                <option value={20}>20 — Deep (default)</option>
                <option value={22}>22 — Very deep</option>
              </select>
            </div>

            <div className="pref-row">
              <div>
                <div className="lbl">Board orientation</div>
                <div className="desc">Which side of the board sits at the bottom.</div>
              </div>
              <div className="seg">
                <button
                  className={prefs.orientation !== 'black' ? 'active' : ''}
                  onClick={() => setPrefs({ ...prefs, orientation: 'white' })}
                >
                  White
                </button>
                <button
                  className={prefs.orientation === 'black' ? 'active' : ''}
                  onClick={() => setPrefs({ ...prefs, orientation: 'black' })}
                >
                  Black
                </button>
              </div>
            </div>

            <div className="mt-14">
              <button
                className="btn btn-primary"
                onClick={() => showToast('Preferences saved.')}
              >
                <Check /> Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
