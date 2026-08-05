import {
  isSupabaseDataEnabled,
  hasSupabaseCredentials,
  probeSupabaseData,
  setSupabaseDataEnabled,
  fetchProgramDetail as fetchProgramDetailFromDb,
  getCachedProgram,
  getDatabaseMeta as getSupabaseMeta,
} from './analysisRepository.js'

const YEAR = 2026
const BASE = `/data/analysis/${YEAR}`

const URLS = {
  index: `${BASE}/analysis_index.json`,
  indexGz: `${BASE}/analysis_index.json.gz`,
  manifest: `${BASE}/details_manifest.json`,
  dictionary: `${BASE}/string_dictionary.json`,
  meta: `${BASE}/meta.json`,
  cityIndex: `${BASE}/city_index.json`,
  departmentIndex: `${BASE}/department_index.json`,
  universityIndex: `${BASE}/university_index.json`,
  detailPartition: (relPath) => `${BASE}/details/${relPath}`,
}

let _indexDoc = null
let _cards = null
let _manifest = null
let _dictionary = null
let _partitionCache = new Map()
let _loadPromise = null

const fetchJson = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Yüklenemedi: ${url}`)
  return res.json()
}

const fetchIndex = async () => {
  try {
    const res = await fetch(URLS.indexGz)
    if (res.ok && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip')
      const stream = res.body.pipeThrough(ds)
      const text = await new Response(stream).text()
      return JSON.parse(text)
    }
  } catch (e) {
    console.warn('gzip index yüklenemedi, json fallback', e)
  }
  return fetchJson(URLS.index)
}

const expandRow = (row, doc) => {
  const enums = doc.enums || {}
  const strings = doc.strings || []
  const [i, ur, dr, gr, ci, de, st, ln, tu, lr, or_, ss, ts, ys, us] = row
  const rating = or_ != null ? or_ / 10 : null
  const pick = (list, idx) => (list && idx != null && idx < list.length ? list[idx] : '')
  const university = strings[ur] || ''
  const department = strings[dr] || ''
  return {
    id: i,
    program_id: i,
    university,
    department,
    department_group: strings[gr] || '',
    full_name: university && department ? `${university} - ${department}` : university || department,
    faculty: '',
    city: pick(enums.city, ci),
    degree: pick(enums.degree, de),
    score_type: pick(enums.score_type, st),
    language: pick(enums.language, ln),
    tuition_status: pick(enums.tuition_status, tu),
    last_rank: lr,
    overall_rating: or_,
    rating,
    scholarship_score: ss != null ? ss / 10 : null,
    trend_score: ts != null ? ts / 10 : null,
    yok_rank_score: ys != null ? ys / 10 : null,
    uniar_score: us != null ? us / 10 : null,
    yok_data_available: lr != null,
    isFavorite: false,
    notes: '-',
  }
}

const expandLegacyCard = (card) => ({
  ...card,
  id: String(card.id || card.program_id),
  program_id: String(card.program_id || card.id),
  rating: card.rating ?? (card.overall_rating != null ? card.overall_rating / 10 : null),
  isFavorite: false,
  notes: card.notes || '-',
})

const normalizeIndex = (doc) => {
  if (doc?.version === 2 && Array.isArray(doc.data)) {
    return doc.data.map((row) => expandRow(row, doc))
  }
  if (Array.isArray(doc)) {
    return doc.map(expandLegacyCard)
  }
  return []
}

const resolveRefs = (obj, dict) => {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((v) => resolveRefs(v, dict))

  const out = {}
  for (const [key, val] of Object.entries(obj)) {
    if (key.endsWith('_ref') && typeof val === 'number') {
      out[key.replace(/_ref$/, '')] = dict[String(val)] ?? null
      continue
    }
    out[key] = resolveRefs(val, dict)
  }
  return out
}

const findPartitionFile = (programId) => {
  const id = String(programId)
  if (_manifest?.version === 2 && _manifest.program_map?.[id]) {
    const partId = _manifest.program_map[id]
    const part = (_manifest.partitions || []).find((p) => p.id === partId)
    return part?.file || null
  }
  if (_manifest?.chunks) {
    for (const chunk of _manifest.chunks) {
      if (chunk.min_id && chunk.max_id && id >= chunk.min_id && id <= chunk.max_id) {
        return chunk.file
      }
    }
  }
  return null
}

const loadPartition = async (relPath) => {
  if (_partitionCache.has(relPath)) return _partitionCache.get(relPath)
  const data = await fetchJson(URLS.detailPartition(relPath))
  const programs = data.programs || {}
  _partitionCache.set(relPath, programs)
  return programs
}

export const preloadCityPartitions = async (cityName) => {
  if (!_manifest?.partitions) return
  const slug = (cityName || '').toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/İ/g, 'i')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'bilinmiyor'
  const targets = _manifest.partitions.filter((p) => p.id?.startsWith(`${slug}/`))
  await Promise.all(targets.map((p) => loadPartition(p.file)))
}

export const loadProgramIndex = async () => {
  if (_cards) return _cards
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    const [indexDoc, manifest] = await Promise.all([
      fetchIndex(),
      fetchJson(URLS.manifest),
    ])
    _indexDoc = indexDoc
    _manifest = manifest
    _cards = normalizeIndex(indexDoc)
    return _cards
  })()

  return _loadPromise
}

export const fetchProgramsByIds = async (ids = []) => {
  await loadProgramIndex()
  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  return unique.map((id) => getProgramCard(id)).filter(Boolean)
}

export const getProgramCard = (programId) => {
  if (isSupabaseDataEnabled()) {
    return getCachedProgram(programId)
  }
  if (!_cards) return null
  const id = String(programId)
  return _cards.find((c) => String(c.program_id) === id || String(c.id) === id) || null
}

export const loadProgramDetail = async (programId) => {
  if (isSupabaseDataEnabled()) {
    return fetchProgramDetailFromDb(programId)
  }

  const card = getProgramCard(programId)
  if (!card) return null

  const partFile = findPartitionFile(programId)
  if (!partFile) return { ...card }

  const [programs, dict] = await Promise.all([
    loadPartition(partFile),
    _dictionary ? Promise.resolve(_dictionary) : fetchJson(URLS.dictionary).then((d) => { _dictionary = d; return d }),
  ])

  const detail = programs[String(programId)]
  if (!detail) return { ...card }

  return { ...card, ...resolveRefs(detail, dict) }
}

export const loadFilterIndexes = async () => {
  const [city, department, university] = await Promise.all([
    fetchJson(URLS.cityIndex),
    fetchJson(URLS.departmentIndex),
    fetchJson(URLS.universityIndex),
  ])
  return { city, department, university }
}

export const getDatabaseMeta = () => {
  if (isSupabaseDataEnabled()) return getSupabaseMeta()
  return {
    loaded: Boolean(_cards),
    count: _cards?.length || 0,
    version: _indexDoc?.version || 1,
    source: _cards ? URLS.index : null,
  }
}

export let MASTER_DATABASE = []
export let DATA_SOURCE = 'pending'

const loadLocalAnalysisIndex = async () => {
  MASTER_DATABASE = await loadProgramIndex()
  DATA_SOURCE = 'analysis_index_v2'
  setSupabaseDataEnabled(false)
  return MASTER_DATABASE
}

export const initDataModule = async () => {
  if (hasSupabaseCredentials()) {
    const ready = await probeSupabaseData()
    if (ready) {
      MASTER_DATABASE = []
      DATA_SOURCE = 'supabase'
      return MASTER_DATABASE
    }
    console.warn('Supabase hazır değil — yerel analiz verisine geçiliyor.')
  }
  return loadLocalAnalysisIndex()
}

export const getProgramById = getProgramCard
