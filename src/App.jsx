import { useState } from 'react'
import { StoreProvider, useStore } from './store.jsx'
import { Sidebar, Topbar } from './components/layout'
import { Dashboard } from './pages/Dashboard'
import { NewAnalysis } from './pages/NewAnalysis'
import { SavedAnalysis } from './pages/SavedAnalysis'
import { Openings } from './pages/Openings'
import { Settings } from './pages/Settings'
import { Auth } from './pages/Auth'

function Shell() {
  const { theme, setTheme, toast } = useStore()
  const [page, setPage] = useState('dashboard')

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="main">
        <Topbar
          page={page}
          theme={theme}
          onToggleTheme={setTheme}
        />
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'analysis' && <NewAnalysis onNavigate={setPage} />}
        {page === 'saved' && <SavedAnalysis />}
        {page === 'openings' && <Openings />}
        {page === 'settings' && <Settings onNavigate={setPage} />}
        {page === 'auth' && <Auth onNavigate={setPage} />}
      </div>
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>{toast.msg}</div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
