import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { OPENINGS } from './data/openings'
import { supabase, supabaseEnabled } from './lib/supabase'

const StoreContext = createContext(null)

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage full or unavailable */ }
}

const DEFAULT_PROFILE = {
  name: 'username_123',
  email: 'username_123@example.com'
}

function analysisToRow(a, userId) {
  return {
    id: a.id,
    user_id: userId,
    name: a.name,
    date: a.date,
    pgn: a.pgn,
    sans: a.sans || [],
    opening: a.opening,
    depth: a.depth,
    counts: a.counts,
    per_move: a.perMove,
    summary: a.summary,
    favorite: Boolean(a.favorite),
    author: a.author
  }
}

function rowToAnalysis(r) {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    pgn: r.pgn,
    sans: r.sans || [],
    opening: r.opening,
    depth: r.depth,
    counts: r.counts,
    perMove: r.per_move || [],
    summary: r.summary,
    favorite: Boolean(r.favorite),
    author: r.author
  }
}

function openingToRow(o, userId) {
  return {
    id: o.id,
    user_id: userId,
    name: o.name,
    eco: o.eco,
    moves: o.moves,
    description: o.description
  }
}

function rowToOpening(r) {
  return {
    id: r.id,
    name: r.name,
    eco: r.eco,
    moves: r.moves,
    description: r.description
  }
}

export function StoreProvider({ children }) {
  const [theme, setTheme] = useState(() => read('ca_theme', 'dark'))
  const [profile, setProfile] = useState(() => read('ca_profile', DEFAULT_PROFILE))
  const [prefs, setPrefs] = useState(() => read('ca_prefs', { depth: 20, orientation: 'white' }))
  const [analyses, setAnalyses] = useState(() => read('ca_analyses', []))
  const [myOpenings, setMyOpenings] = useState(() => read('ca_my_openings', []))
  const [toast, setToast] = useState(null)

  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabaseEnabled))

  // Skip localStorage->cloud echo writes while we hydrate state FROM the cloud.
  const hydrating = useRef(false)
  // Which flow produced the pending OTP (signup vs password recovery).
  const otpPurpose = useRef('signup')

  useEffect(() => { write('ca_theme', theme) }, [theme])
  useEffect(() => { write('ca_profile', profile) }, [profile])
  useEffect(() => { write('ca_prefs', prefs) }, [prefs])
  useEffect(() => { write('ca_analyses', analyses) }, [analyses])
  useEffect(() => { write('ca_my_openings', myOpenings) }, [myOpenings])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const hydrateFromCloud = useCallback(async (authUser) => {
    if (!supabase || !authUser) return
    hydrating.current = true
    try {
      const uid = authUser.id
      const [profRes, anRes, opRes, prefRes] = await Promise.all([
        supabase.from('profiles').select('username').eq('id', uid).maybeSingle(),
        supabase.from('analyses').select('*').order('created_at', { ascending: false }),
        supabase.from('openings').select('*').order('created_at', { ascending: false }),
        supabase.from('preferences').select('*').eq('user_id', uid).maybeSingle()
      ])

      const remoteAnalyses = (anRes.data || []).map(rowToAnalysis)
      const remoteOpenings = (opRes.data || []).map(rowToOpening)

      const username = profRes.data?.username || authUser.email?.split('@')[0] || 'player'
      setProfile({ name: username, email: authUser.email || '' })
      setAnalyses(remoteAnalyses)
      setMyOpenings(remoteOpenings)

      if (prefRes.data) {
        if (prefRes.data.theme) setTheme(prefRes.data.theme)
        setPrefs({
          depth: prefRes.data.depth || 20,
          orientation: prefRes.data.board_orientation || 'white'
        })
      }

      // One-time migration: first login on this browser uploads any
      // guest-mode data that was saved before the user had an account.
      const migKey = `ca_migrated_${uid}`
      if (!localStorage.getItem(migKey)) {
        const localAn = read('ca_analyses', [])
        const localOp = read('ca_my_openings', [])
        if (remoteAnalyses.length === 0 && localAn.length > 0) {
          await supabase.from('analyses')
            .upsert(localAn.map((a) => analysisToRow(a, uid)), { onConflict: 'id' })
        }
        if (remoteOpenings.length === 0 && localOp.length > 0) {
          await supabase.from('openings')
            .upsert(localOp.map((o) => openingToRow(o, uid)), { onConflict: 'id' })
        }
        localStorage.setItem(migKey, '1')
      }
    } catch (err) {
      console.error('cloud hydrate failed', err)
    } finally {
      // Let React commit the hydrated state before re-enabling echo writes.
      setTimeout(() => { hydrating.current = false }, 50)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const u = session?.user || null
        setUser(u)
        setAuthLoading(false)
        if (u && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
          hydrateFromCloud(u)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [hydrateFromCloud])

  // ---------- Cloud sync helpers (fire-and-forget with local-first UX) ----------

  const syncError = useCallback((what) => {
    showToast(`${what} saved on this device — cloud sync failed.`, 'error')
  }, [showToast])

  const saveAnalysis = useCallback((analysis) => {
    setAnalyses((prev) => [analysis, ...prev])
    if (supabase && user) {
      supabase.from('analyses')
        .upsert(analysisToRow(analysis, user.id), { onConflict: 'id' })
        .then(({ error }) => { if (error) syncError('Analysis') })
    }
  }, [user, syncError])

  const deleteAnalysis = useCallback((id) => {
    setAnalyses((prev) => prev.filter((a) => a.id !== id))
    if (supabase && user) {
      supabase.from('analyses').delete().eq('id', id)
        .then(({ error }) => { if (error) syncError('Delete') })
    }
  }, [user, syncError])

  const toggleFavorite = useCallback((id) => {
    setAnalyses((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a))
      const target = next.find((a) => a.id === id)
      if (supabase && user && target) {
        supabase.from('analyses').update({ favorite: target.favorite }).eq('id', id)
          .then(({ error }) => { if (error) syncError('Favorite') })
      }
      return next
    })
  }, [user, syncError])

  const addOpening = useCallback((opening) => {
    setMyOpenings((prev) => [opening, ...prev])
    if (supabase && user) {
      supabase.from('openings')
        .upsert(openingToRow(opening, user.id), { onConflict: 'id' })
        .then(({ error }) => { if (error) syncError('Opening') })
    }
  }, [user, syncError])

  const updateOpening = useCallback((id, patch) => {
    setMyOpenings((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
      const target = next.find((o) => o.id === id)
      if (supabase && user && target) {
        supabase.from('openings')
          .update({ name: target.name, eco: target.eco, moves: target.moves, description: target.description })
          .eq('id', id)
          .then(({ error }) => { if (error) syncError('Opening') })
      }
      return next
    })
  }, [user, syncError])

  const deleteOpening = useCallback((id) => {
    setMyOpenings((prev) => prev.filter((o) => o.id !== id))
    if (supabase && user) {
      supabase.from('openings').delete().eq('id', id)
        .then(({ error }) => { if (error) syncError('Delete') })
    }
  }, [user, syncError])

  useEffect(() => {
    if (!supabase || !user || hydrating.current) return
    supabase.from('preferences').upsert({
      user_id: user.id,
      theme,
      depth: prefs.depth || 20,
      board_orientation: prefs.orientation || 'white',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).then(({ error }) => { if (error) syncError('Preferences') })
  }, [theme, prefs, user, syncError])

  useEffect(() => {
    if (!supabase || !user || hydrating.current) return
    supabase.from('profiles').upsert(
      { id: user.id, username: profile.name },
      { onConflict: 'id' }
    ).then(({ error }) => { if (error) syncError('Profile') })
  }, [profile.name, user, syncError])

  // ---------- Auth actions (Amazon/Flipkart-style OTP flow) ----------

  const sendOtp = useCallback(async (email) => {
    if (!supabase) return { error: 'Cloud accounts not configured.' }
    otpPurpose.current = 'signup'
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error: error ? error.message : null }
  }, [])

  const sendRecoveryOtp = useCallback(async (email) => {
    if (!supabase) return { error: 'Cloud accounts not configured.' }
    otpPurpose.current = 'recovery'
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error ? error.message : null }
  }, [])

  const verifyOtpCode = useCallback(async (email, token) => {
    if (!supabase) return { error: 'Cloud accounts not configured.' }
    const type = otpPurpose.current === 'recovery' ? 'recovery' : 'email'
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type })
    if (error) return { error: error.message }
    const u = data.user
    const passwordSet = Boolean(u?.user_metadata?.password_set)
    const needsPassword = otpPurpose.current === 'recovery' || !passwordSet
    return { error: null, needsPassword }
  }, [])

  const createPassword = useCallback(async (password) => {
    if (!supabase) return { error: 'Cloud accounts not configured.' }
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true }
    })
    return { error: error ? error.message : null }
  }, [])

  const signInPassword = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Cloud accounts not configured.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }, [])

  const allBookOpenings = useMemo(() => [...OPENINGS, ...myOpenings], [myOpenings])

  const value = {
    theme, setTheme,
    profile, setProfile,
    prefs, setPrefs,
    analyses, saveAnalysis, deleteAnalysis, toggleFavorite,
    myOpenings, addOpening, updateOpening, deleteOpening,
    allBookOpenings,
    toast, showToast,
    user, authLoading,
    sendOtp, sendRecoveryOtp, verifyOtpCode, createPassword, signInPassword, signOut
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
