import {
  LayoutDashboard, Swords, History, BookOpen, Settings,
  Sun, Moon, Pencil, LogIn, LogOut
} from 'lucide-react'
import { useStore } from '../store.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analysis', label: 'New Analysis', icon: Swords },
  { id: 'saved', label: 'Saved Analysis (History)', icon: History },
  { id: 'openings', label: 'Chess Openings', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar({ page, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">♞</span>
        <span>Chess Analyzer</span>
      </div>

      <div className="profile-card">
        <div className="avatar">
          ♞
          <button
            className="avatar-edit"
            title="Edit profile"
            onClick={() => onNavigate('settings')}
          >
            <Pencil />
          </button>
        </div>
        <ProfileName />
        <AuthControls onNavigate={onNavigate} />
      </div>

      <div>
        <div className="nav-section-label">NAVIGATION</div>
        <nav className="nav-list">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => onNavigate(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  )
}

function ProfileName() {
  const { profile, user } = useStore()
  return (
    <>
      <div className="name">{profile.name || 'username_123'}</div>
      <div className="email">{user?.email || profile.email}</div>
    </>
  )
}

function AuthControls({ onNavigate }) {
  const { user, authLoading, signOut, showToast } = useStore()

  if (authLoading) return null

  if (!user) {
    return (
      <button
        className="btn btn-primary btn-block btn-sm mt-10"
        onClick={() => onNavigate('auth')}
      >
        <LogIn /> Sign in
      </button>
    )
  }

  return (
    <button
      className="btn btn-ghost btn-block btn-sm mt-10"
      onClick={async () => {
        await signOut()
        showToast('Signed out. Your data stays saved to your account.')
      }}
    >
      <LogOut /> Sign out
    </button>
  )
}

const TITLES = {
  dashboard: 'Dashboard',
  analysis: 'New Analysis',
  saved: 'Saved Analysis',
  openings: 'Chess Openings',
  settings: 'Settings'
}

const TITLE_ICONS = {
  dashboard: LayoutDashboard,
  analysis: Swords,
  saved: History,
  openings: BookOpen,
  settings: Settings
}

export function Topbar({ page, onToggleTheme, theme }) {
  const TitleIcon = TITLE_ICONS[page] || LayoutDashboard
  return (
    <header className="topbar">
      <h1>
        <TitleIcon />
        {TITLES[page] || 'Chess Analyzer'}
      </h1>
      <div className="theme-toggle" role="group" aria-label="Theme">
        <button
          className={theme === 'light' ? 'active' : ''}
          onClick={() => theme !== 'light' && onToggleTheme('light')}
          title="Light theme"
        >
          <Sun />
        </button>
        <button
          className={theme === 'dark' ? 'active' : ''}
          onClick={() => theme !== 'dark' && onToggleTheme('dark')}
          title="Dark theme"
        >
          <Moon />
        </button>
      </div>
    </header>
  )
}
