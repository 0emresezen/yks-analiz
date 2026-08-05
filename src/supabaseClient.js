import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client = null

const getClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) return null
  if (!client) client = createClient(supabaseUrl, supabaseAnonKey)
  return client
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const activeClient = getClient()
      if (!activeClient) return undefined
      const value = activeClient[prop]
      return typeof value === 'function' ? value.bind(activeClient) : value
    },
  }
)

let authReadyPromise = null

export const ensureAuthSession = async () => {
  const activeClient = getClient()
  if (!activeClient) return null
  if (authReadyPromise) return authReadyPromise

  authReadyPromise = (async () => {
    const { data: { session } } = await activeClient.auth.getSession()
    if (session) return session

    const { data, error } = await activeClient.auth.signInAnonymously()
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
