const ANALYSIS_DB_URL = '/validated/analysis_database/2026.json'
const FALLBACK_DB_URL = '/validated/yks_master_database.json'
const LEGACY_DB_URL = '/data/yks_master_database.json'

let _database = null
let _programMap = null
let _loadPromise = null

export const loadMasterDatabase = async () => {
  if (_database) return _database
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    for (const url of [ANALYSIS_DB_URL, FALLBACK_DB_URL, LEGACY_DB_URL]) {
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          _database = data
          _programMap = new Map(data.map(item => [String(item.program_id || item.id), item]))
          return _database
        }
      } catch (e) {
        console.warn(`DB yükleme başarısız: ${url}`, e)
      }
    }
    throw new Error('Analiz veritabanı yüklenemedi')
  })()

  return _loadPromise
}

export const getProgramById = (programId) => {
  if (!_programMap) return null
  return _programMap.get(String(programId)) || null
}

export const getDatabaseMeta = () => ({
  loaded: Boolean(_database),
  count: _database?.length || 0,
  source: _database ? ANALYSIS_DB_URL : null,
})

// Backward compat — populated after loadMasterDatabase()
export let MASTER_DATABASE = []
export let DATA_SOURCE = 'pending'

export const initDataModule = async () => {
  MASTER_DATABASE = await loadMasterDatabase()
  DATA_SOURCE = 'analysis_database'
  return MASTER_DATABASE
}
