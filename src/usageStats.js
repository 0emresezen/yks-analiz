import { supabase } from './supabaseClient.js'

const SESSION_KEY = 'yks_presence_session'

export const DISPLAY_VISITOR_BASE = 40

const toDisplayVisitors = (actual) => (
  DISPLAY_VISITOR_BASE + Math.max(0, Number(actual) || 0)
)

const PRESENCE_INTERVAL_MS = 30000
const LIVE_CUTOFF_MS = 2 * 60 * 1000

let presenceTimer = null
let visitRecorded = false

const isConfigured = () => (
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
)

const trackStat = async (key, amount = 1) => {
  if (!isConfigured() || !key || amount <= 0) return false

  const { error } = await supabase.rpc('increment_yks_stat', {
    stat_key: key,
    amount,
  })

  if (!error) return true
  console.warn('[usageStats] increment başarısız:', error.message)
  return false
}

const getSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

const sendHeartbeat = async () => {
  if (!isConfigured()) return
  await supabase.from('yks_active_sessions').upsert(
    { session_id: getSessionId(), last_seen: new Date().toISOString() },
    { onConflict: 'session_id' }
  )
}

const removeSession = () => {
  if (!isConfigured()) return
  const sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) return
  void supabase.from('yks_active_sessions').delete().eq('session_id', sessionId)
}

export const startPresence = () => {
  if (!isConfigured()) return
  void sendHeartbeat()
  if (presenceTimer) clearInterval(presenceTimer)
  presenceTimer = setInterval(sendHeartbeat, PRESENCE_INTERVAL_MS)
  window.addEventListener('beforeunload', removeSession)
}

// Her sayfa açılışı / F5 = +1
export const initUsageStats = () => {
  if (visitRecorded || !isConfigured()) return
  visitRecorded = true
  void trackStat('site_visits', 1)
}

export const trackVisit = () => { void initUsageStats() }
export const trackWizardUsed = () => { void trackStat('wizard_used', 1) }
export const trackListCreated = () => { void trackStat('lists_created', 1) }

export const formatStatNumber = (value) => {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('tr-TR')
}

export const fetchSimpleStats = async () => {
  if (!isConfigured()) {
    return {
      remoteAvailable: false,
      statsMode: 'unconfigured',
      totalVisitors: null,
      liveUsers: null,
      listsCreated: null,
      wizardUsed: null,
    }
  }

  try {
    const [{ data, error }, live] = await Promise.all([
      supabase
        .from('yks_usage_stats')
        .select('key, value')
        .in('key', ['site_visits', 'lists_created', 'wizard_used']),
      supabase
        .from('yks_active_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', new Date(Date.now() - LIVE_CUTOFF_MS).toISOString()),
    ])

    if (error) {
      console.warn('[usageStats] okuma hatası:', error.message)
      return {
        remoteAvailable: false,
        statsMode: 'error',
        totalVisitors: toDisplayVisitors(0),
        liveUsers: 0,
        listsCreated: 0,
        wizardUsed: 0,
      }
    }

    const map = Object.fromEntries((data || []).map((row) => [row.key, Number(row.value) || 0]))

    return {
      remoteAvailable: true,
      statsMode: 'remote',
      totalVisitors: toDisplayVisitors(map.site_visits || 0),
      liveUsers: live.count || 0,
      listsCreated: map.lists_created || 0,
      wizardUsed: map.wizard_used || 0,
    }
  } catch (err) {
    console.warn('[usageStats] fetch hatası:', err)
    return {
      remoteAvailable: false,
      statsMode: 'error',
      totalVisitors: toDisplayVisitors(0),
      liveUsers: 0,
      listsCreated: 0,
      wizardUsed: 0,
    }
  }
}
