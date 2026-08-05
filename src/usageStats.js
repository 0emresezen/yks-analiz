import { supabase, ensureAuthSession } from './supabaseClient.js'

const SESSION_KEY = 'yks_presence_session'
const LOCAL_STATS_KEY = 'yks_local_usage_stats'

const DISPLAY_VISITOR_BASE = 12
const DISPLAY_VISITOR_MULTIPLIER = 2

const toDisplayVisitors = (actual) => (
  DISPLAY_VISITOR_BASE + Math.max(0, Number(actual) || 0) * DISPLAY_VISITOR_MULTIPLIER
)

const getActualVisitors = (stats = {}) => (
  (Number(stats.site_visits) || 0) + (Number(stats.unique_visitors) || 0)
)

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

  const session = await ensureAuthSession()
  if (!session) {
    console.warn('[usageStats] Supabase oturumu açılamadı, uzak sayaç güncellenemedi:', key)
    return false
  }

  try {
    const { error } = await supabase.rpc('increment_yks_stat', {
      stat_key: key,
      amount
    })
    if (!error) return true
    console.warn('[usageStats] RPC increment_yks_stat başarısız:', error.message)
  } catch (err) {
    console.warn('[usageStats] RPC increment_yks_stat hata:', err)
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
      .upsert(
        {
          key,
          value: (Number(data?.value) || 0) + amount,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      )

    if (writeError) {
      console.warn('[usageStats] upsert başarısız:', writeError.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[usageStats] uzak sayaç yazılamadı:', key, err)
    return false
  }
}

const trackStat = async (key, amount = 1) => {
  if (!key || amount <= 0) return
  bumpLocal(key, amount)
  await incrementRemoteStat(key, amount)
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

  const session = await ensureAuthSession()
  if (!session) return

  const sessionId = getPresenceSessionId()
  const { error } = await supabase
    .from('yks_active_sessions')
    .upsert(
      {
        session_id: sessionId,
        last_seen: new Date().toISOString()
      },
      { onConflict: 'session_id' }
    )

  if (error) {
    console.warn('[usageStats] presence heartbeat başarısız:', error.message)
  }
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
  void trackStat('site_visits')
}

export const trackWizardUsed = () => { void trackStat('wizard_used') }
export const trackListCreated = () => { void trackStat('lists_created') }

export const formatStatNumber = (value) => {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('tr-TR')
}

const STAT_KEYS = ['site_visits', 'unique_visitors', 'lists_created', 'wizard_used']

const hasRemoteStatData = (stats = {}) => (
  STAT_KEYS.some((key) => (Number(stats[key]) || 0) > 0)
)

const resolveStatsSource = (local, remote, remoteAvailable) => {
  if (!remoteAvailable) return { stats: local, mode: 'local' }

  if (hasRemoteStatData(remote)) {
    return { stats: remote, mode: 'remote' }
  }

  if (hasRemoteStatData(local)) {
    return { stats: local, mode: 'local-fallback' }
  }

  return { stats: remote, mode: 'remote' }
}

const fetchRemoteStats = async () => {
  if (!isSupabaseConfigured()) return null

  const session = await ensureAuthSession()
  if (!session) return null

  try {
    const { data, error } = await supabase
      .from('yks_usage_stats')
      .select('key, value')
      .in('key', STAT_KEYS)

    if (error) {
      console.warn('[usageStats] uzak istatistik okunamadı:', error.message)
      return null
    }

    const stats = {}
    ;(data || []).forEach((row) => {
      stats[row.key] = Number(row.value) || 0
    })
    return stats
  } catch (err) {
    console.warn('[usageStats] uzak istatistik okuma hatası:', err)
    return null
  }
}

const fetchLiveUserCount = async () => {
  if (!isSupabaseConfigured()) return null

  const session = await ensureAuthSession()
  if (!session) return null

  try {
    const cutoff = new Date(Date.now() - LIVE_CUTOFF_MS).toISOString()
    const { count, error } = await supabase
      .from('yks_active_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', cutoff)

    if (error) {
      console.warn('[usageStats] aktif kullanıcı sayısı okunamadı:', error.message)
      return null
    }
    return count || 0
  } catch (err) {
    console.warn('[usageStats] aktif kullanıcı okuma hatası:', err)
    return null
  }
}

export const fetchSimpleStats = async () => {
  const local = getLocalStats()
  const remote = await fetchRemoteStats()
  const liveUsers = await fetchLiveUserCount()
  const remoteAvailable = remote !== null
  const { stats, mode } = resolveStatsSource(local, remote, remoteAvailable)

  return {
    remoteAvailable,
    statsMode: mode,
    totalVisitors: toDisplayVisitors(getActualVisitors(stats)),
    liveUsers: remoteAvailable ? liveUsers : null,
    listsCreated: Number(stats.lists_created) || 0,
    wizardUsed: Number(stats.wizard_used) || 0
  }
}
