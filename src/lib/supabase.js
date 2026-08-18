import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Shared storage is opt-in: with no env vars the app runs exactly as before,
 * saving to this browser only. That keeps local development and the hosted,
 * shared deployment on the same code path.
 */
export const isSharedMode = Boolean(url && anonKey)

export const supabase = isSharedMode
  ? createClient(url, anonKey, {
      auth: { persistSession: false }, // no accounts: the anon key is the access model
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

export const TABLE = 'tracker_entities'
