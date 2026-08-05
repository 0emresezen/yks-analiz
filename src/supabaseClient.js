import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

let authReadyPromise = null

export const ensureAuthSession = async () => {
  if (!supabaseUrl || !supabaseAnonKey) return null
  if (authReadyPromise) return authReadyPromise

  authReadyPromise = (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session

    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      authReadyPromise = null
      console.warn('Supabase anonymous oturum açılamadı:', error.message)
      return null
    }
    return data.session
  })()

  return authReadyPromise
}

export const getAuthUserId = async () => {
  const session = await ensureAuthSession()
  return session?.user?.id ?? null
}
