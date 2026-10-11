import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// When env vars are missing (e.g. fresh clone before .env is set up),
// export null and the app runs in guest/local-only mode.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null

export const supabaseEnabled = Boolean(supabase)
