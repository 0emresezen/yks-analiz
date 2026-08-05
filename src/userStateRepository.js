import { supabase, ensureAuthSession, getAuthUserId } from './supabaseClient.js'

const MIGRATION_KEY = 'yks_user_state_migrated_v1'
const stateMap = new Map()

const toState = (row) => ({
  programId: String(row.program_id),
  isFavorite: Boolean(row.is_favorite),
  notes: row.notes || '-',
  isDeleted: Boolean(row.is_deleted),
  sortOrder: row.sort_order ?? null,
})

export const getUserStateMap = () => stateMap

export const getFavoriteOrder = () => (
  [...stateMap.values()]
    .filter((s) => s.isFavorite)
    .sort((a, b) => {
      const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER
      const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER
      return ao - bo
    })
    .map((s) => s.programId)
)

export const getFavoriteCount = () => (
  [...stateMap.values()].filter((s) => s.isFavorite).length
)

export const loadUserProgramState = async () => {
  await ensureAuthSession()
  const { data, error } = await supabase
    .from('user_program_state')
    .select('program_id, is_favorite, notes, is_deleted, sort_order')

  if (error) throw new Error(error.message)

  stateMap.clear()
  ;(data || []).forEach((row) => {
    const state = toState(row)
    stateMap.set(state.programId, state)
  })
  return stateMap
}

const upsertState = async (programId, patch) => {
  const userId = await getAuthUserId()
  if (!userId) throw new Error('Oturum açılamadı')

  const key = String(programId)
  const current = stateMap.get(key) || {
    programId: key,
    isFavorite: false,
    notes: '-',
    isDeleted: false,
    sortOrder: null,
  }
  const next = { ...current, ...patch }
  stateMap.set(key, next)

  const { error } = await supabase
    .from('user_program_state')
    .upsert({
      user_id: userId,
      program_id: key,
      is_favorite: next.isFavorite,
      notes: next.notes,
      is_deleted: next.isDeleted,
      sort_order: next.sortOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,program_id' })

  if (error) throw new Error(error.message)
  return next
}

export const setFavorite = async (programId, isFavorite) => (
  upsertState(programId, { isFavorite })
)

export const setNotes = async (programId, notes) => (
  upsertState(programId, { notes: notes || '-' })
)

export const setDeleted = async (programId, isDeleted) => (
  upsertState(programId, { isDeleted })
)

export const setFavoriteOrder = async (orderedIds = []) => {
  await ensureAuthSession()
  const userId = await getAuthUserId()
  if (!userId) return

  const updates = orderedIds.map((id, index) => {
    const key = String(id)
    const current = stateMap.get(key) || {
      programId: key,
      isFavorite: true,
      notes: '-',
      isDeleted: false,
      sortOrder: null,
    }
    const next = { ...current, isFavorite: true, sortOrder: index }
    stateMap.set(key, next)
    return {
      user_id: userId,
      program_id: key,
      is_favorite: true,
      notes: next.notes,
      is_deleted: next.isDeleted,
      sort_order: index,
      updated_at: new Date().toISOString(),
    }
  })

  if (!updates.length) return

  const { error } = await supabase
    .from('user_program_state')
    .upsert(updates, { onConflict: 'user_id,program_id' })

  if (error) throw new Error(error.message)
}

export const clearAllFavorites = async () => {
  await ensureAuthSession()
  const userId = await getAuthUserId()
  if (!userId) return

  const favIds = [...stateMap.values()].filter((s) => s.isFavorite).map((s) => s.programId)
  if (!favIds.length) return

  favIds.forEach((id) => {
    const current = stateMap.get(id)
    if (current) stateMap.set(id, { ...current, isFavorite: false })
  })

  const { error } = await supabase
    .from('user_program_state')
    .update({ is_favorite: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('program_id', favIds)

  if (error) throw new Error(error.message)
}

export const deleteAllUserState = async () => {
  await ensureAuthSession()
  const userId = await getAuthUserId()
  if (!userId) return

  const { error } = await supabase
    .from('user_program_state')
    .delete()
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  stateMap.clear()
}

const readLocalFavoriteIds = () => {
  const ids = new Set()
  try {
    const saved = localStorage.getItem('yks_favorite_ids')
    if (saved) JSON.parse(saved).forEach((id) => ids.add(String(id)))
  } catch (e) {}
  try {
    const order = localStorage.getItem('yks_fav_v5_order')
    if (order) JSON.parse(order).forEach((id) => ids.add(String(id)))
  } catch (e) {}
  try {
    const state = localStorage.getItem('yks_master_v8_employability_data')
    if (state) {
      JSON.parse(state).forEach((row) => {
        if (row.isFavorite) ids.add(String(row.id))
      })
    }
  } catch (e) {}
  return [...ids]
}

const readLocalNotesMap = () => {
  const map = new Map()
  try {
    const state = localStorage.getItem('yks_master_v8_employability_data')
    if (state) {
      JSON.parse(state).forEach((row) => {
        if (row.notes) map.set(String(row.id), row.notes)
      })
    }
  } catch (e) {}
  return map
}

const readLocalDeletedIds = () => {
  try {
    const deleted = localStorage.getItem('yks_deleted_ids')
    return deleted ? JSON.parse(deleted).map(String) : []
  } catch (e) {
    return []
  }
}

export const migrateLocalStorageToSupabase = async () => {
  if (localStorage.getItem(MIGRATION_KEY)) return
  await ensureAuthSession()
  const userId = await getAuthUserId()
  if (!userId) return

  const favoriteOrder = (() => {
    try {
      const saved = localStorage.getItem('yks_fav_v5_order')
      return saved ? JSON.parse(saved).map(String) : []
    } catch (e) {
      return []
    }
  })()

  const favoriteSet = new Set(readLocalFavoriteIds())
  const notesMap = readLocalNotesMap()
  const deletedIds = new Set(readLocalDeletedIds())
  const allIds = new Set([...favoriteSet, ...deletedIds, ...notesMap.keys()])

  if (!allIds.size) {
    localStorage.setItem(MIGRATION_KEY, '1')
    return
  }

  const rows = [...allIds].map((programId) => {
    const sortIndex = favoriteOrder.indexOf(programId)
    return {
      user_id: userId,
      program_id: programId,
      is_favorite: favoriteSet.has(programId),
      notes: notesMap.get(programId) || '-',
      is_deleted: deletedIds.has(programId),
      sort_order: sortIndex >= 0 ? sortIndex : null,
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase
    .from('user_program_state')
    .upsert(rows, { onConflict: 'user_id,program_id' })

  if (error) throw new Error(error.message)
  localStorage.setItem(MIGRATION_KEY, '1')
  await loadUserProgramState()
}

export const applyUserStateToProgram = (item) => {
  const state = stateMap.get(String(item.id))
  if (!state) return item
  return {
    ...item,
    isFavorite: state.isFavorite,
    notes: state.notes || item.notes || '-',
  }
}
