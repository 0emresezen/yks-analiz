import { supabase } from './supabaseClient.js'

const VISITOR_KEY = 'yks_visitor_id'
const SESSION_KEY = 'yks_presence_session'
const LOCAL_STATS_KEY = 'yks_local_usage_stats'

const PRESENCE_INTERVAL_MS = 30000
const LIVE_CUTOFF_MS = 2 * 60 * 1000

let presenceTimer = null

const getLocalStats = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const saveLocalStats = (stats) => {
  localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats))
}

const bumpLocal = (key, amount = 1) => {
  const stats = getLocalStats()
  stats[key] = (stats[key] || 0) + amount
  saveLocalStats(stats)
}

const isSupabaseConfigured = () => {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

const incrementRemoteStat = async (key, amount = 1) => {
  if (!isSupabaseConfigured()) return false

  try {
    const { error } = await supabase.rpc('increment_yks_stat', {
      stat_key: key,
      amount
    })
    if (!error) return true
  } catch {
    // fall through
  }

  try {
    const { data, error: readError } = await supabase
      .from('yks_usage_stats')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (readError) throw readError

    const { error: writeError } = await supabase
      .from('yks_usage_stats')
      .upsert({
        key,
        value: (data?.value || 0) + amount,
        updated_at: new Date().toISOString()
      })

    return !writeError
  } catch {
    return false
  }
}

const trackStat = (key, amount = 1) => {
  if (!key || amount <= 0) return
  bumpLocal(key, amount)
  incrementRemoteStat(key, amount)
}

const getPresenceSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

const sendPresenceHeartbeat = async () => {
  if (!isSupabaseConfigured()) return

  const sessionId = getPresenceSessionId()
  await supabase
    .from('yks_active_sessions')
    .upsert({
      session_id: sessionId,
      last_seen: new Date().toISOString()
    })
}

const removePresenceSession = () => {
  if (!isSupabaseConfigured()) return

  const sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) return

  supabase
    .from('yks_active_sessions')
    .delete()
    .eq('session_id', sessionId)
}

export const startPresence = () => {
  sendPresenceHeartbeat()
  if (presenceTimer) clearInterval(presenceTimer)
  presenceTimer = setInterval(sendPresenceHeartbeat, PRESENCE_INTERVAL_MS)
  window.addEventListener('beforeunload', removePresenceSession)
}

export const trackVisit = () => {
  let visitorId = localStorage.getItem(VISITOR_KEY)
  if (!visitorId) {
    visitorId = crypto.randomUUID?.() || `v_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(VISITOR_KEY, visitorId)
    trackStat('unique_visitors')
  }
}

export const trackWizardUsed = () => trackStat('wizard_used')
export const trackListCreated = () => trackStat('lists_created')

export const formatStatNumber = (value) => {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('tr-TR')
}

const fetchRemoteStats = async () => {
  if (!isSupabaseConfigured()) return null

  try {
    const { data, error } = await supabase
      .from('yks_usage_stats')
      .select('key, value')
      .in('key', ['unique_visitors', 'lists_created', 'wizard_used'])

    if (error) return null

    const stats = {}
    data.forEach((row) => {
      stats[row.key] = Number(row.value) || 0
    })
    return stats
  } catch {
    return null
  }
}

const fetchLiveUserCount = async () => {
  if (!isSupabaseConfigured()) return null

  try {
    const cutoff = new Date(Date.now() - LIVE_CUTOFF_MS).toISOString()
    const { count, error } = await supabase
      .from('yks_active_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', cutoff)

    if (error) return null
    return count || 0
  } catch {
    return null
  }
}

export const fetchSimpleStats = async () => {
  const local = getLocalStats()
  const remote = await fetchRemoteStats()
  const liveUsers = await fetchLiveUserCount()

  const useRemote = remote !== null

  return {
    remoteAvailable: useRemote,
    totalVisitors: useRemote ? (remote.unique_visitors || 0) : (local.unique_visitors || 0),
    liveUsers: useRemote ? liveUsers : null,
    listsCreated: useRemote ? (remote.lists_created || 0) : (local.lists_created || 0),
    wizardUsed: useRemote ? (remote.wizard_used || 0) : (local.wizard_used || 0)
  }
}
