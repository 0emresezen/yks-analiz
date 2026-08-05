import { supabase } from './supabaseClient.js'

const PROGRAM_CACHE = new Map()
const DETAIL_CACHE = new Map()

let supabaseDataActive = false

export const hasSupabaseCredentials = () => Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const isSupabaseDataEnabled = () => supabaseDataActive

export const setSupabaseDataEnabled = (enabled) => {
  supabaseDataActive = Boolean(enabled)
}

export const probeSupabaseData = async () => {
  if (!hasSupabaseCredentials()) {
    setSupabaseDataEnabled(false)
    return false
  }

  try {
    const { error } = await supabase.rpc('count_analysis_programs', {})
    if (error) {
      console.warn(
        'Supabase veri katmanı kullanılamıyor (şema veya migration eksik):',
        error.message
      )
      setSupabaseDataEnabled(false)
      return false
    }
    setSupabaseDataEnabled(true)
    return true
  } catch (err) {
    console.warn('Supabase bağlantı hatası:', err)
    setSupabaseDataEnabled(false)
    return false
  }
}

export const mapDbRowToCard = (row) => {
  const programId = String(row.program_id)
  const rating = row.rating != null
    ? Number(row.rating)
    : (row.overall_rating != null ? Number(row.overall_rating) / 10 : null)

  const card = {
    id: programId,
    program_id: programId,
    university: row.university || '',
    department: row.department || '',
    department_group: row.department_group || '',
    faculty: row.faculty || '',
    full_name: row.full_name || `${row.university || ''} - ${row.department || ''}`.trim(),
    city: row.city || '',
    degree: row.degree || '',
    score_type: row.score_type || '',
    language: row.language || '',
    tuition_status: row.tuition_status || '',
    scholarship_rate: row.scholarship_rate || '',
    university_type: row.university_type || '',
    last_rank: row.last_rank ?? null,
    overall_rating: row.overall_rating != null ? Number(row.overall_rating) : null,
    rating,
    scholarship_score: row.scholarship_score ?? null,
    trend_score: row.trend_score ?? null,
    yok_rank_score: row.yok_rank_score ?? null,
    uniar_score: row.uniar_score ?? null,
    prestige_score: row.prestige_score ?? null,
    academic_score: row.academic_score ?? null,
    transport_score: row.transport_score ?? null,
    yok_data_available: Boolean(row.yok_data_available),
    publication_year: row.publication_year ?? null,
    isFavorite: false,
    notes: '-',
  }
  PROGRAM_CACHE.set(programId, card)
  return card
}

const buildSearchParams = (filters = {}) => ({
  p_search: filters.search || null,
  p_city: filters.city || null,
  p_degree: filters.degree && filters.degree !== 'all' ? filters.degree : null,
  p_language: filters.language || null,
  p_tuition: filters.tuition || null,
  p_min_rating: filters.minRating > 0 ? filters.minRating : null,
  p_sort: filters.sort || 'rating-desc',
  p_limit: Math.min(filters.limit ?? 100, 200),
  p_offset: filters.offset ?? 0,
})

export const searchPrograms = async (filters = {}) => {
  const params = buildSearchParams(filters)
  const [listRes, countRes] = await Promise.all([
    supabase.rpc('search_analysis_programs', params),
    supabase.rpc('count_analysis_programs', {
      p_search: params.p_search,
      p_city: params.p_city,
      p_degree: params.p_degree,
      p_language: params.p_language,
      p_tuition: params.p_tuition,
      p_min_rating: params.p_min_rating,
    }),
  ])

  if (listRes.error) throw new Error(listRes.error.message)
  if (countRes.error) throw new Error(countRes.error.message)

  const programs = (listRes.data || []).map(mapDbRowToCard)
  return {
    programs,
    total: Number(countRes.data ?? programs.length),
  }
}

export const fetchProgramsByIds = async (ids = []) => {
  const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
  const missing = unique.filter((id) => !PROGRAM_CACHE.has(id))
  if (missing.length) {
    const { data, error } = await supabase
      .from('analysis_programs')
      .select('*')
      .in('program_id', missing)
    if (error) throw new Error(error.message)
    ;(data || []).forEach(mapDbRowToCard)
  }
  return unique.map((id) => PROGRAM_CACHE.get(id)).filter(Boolean)
}

export const fetchProgramDetail = async (programId) => {
  const id = String(programId)
  if (DETAIL_CACHE.has(id)) return DETAIL_CACHE.get(id)

  let card = PROGRAM_CACHE.get(id)
  if (!card) {
    const { data, error } = await supabase
      .from('analysis_programs')
      .select('*')
      .eq('program_id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    card = mapDbRowToCard(data)
  }

  const { data: detailRow, error: detailError } = await supabase
    .from('program_details')
    .select('detail')
    .eq('program_id', id)
    .maybeSingle()

  if (detailError) throw new Error(detailError.message)

  const merged = { ...card, ...(detailRow?.detail || {}) }
  DETAIL_CACHE.set(id, merged)
  return merged
}

export const fetchFilterOptions = async () => {
  const { data, error } = await supabase
    .from('analysis_filter_options')
    .select('values')
    .eq('key', 'filters')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data?.values) return data.values

  console.warn('analysis_filter_options boş — migrate_to_supabase.py çalıştırın')
  return { cities: [], degrees: [], languages: [], tuition_statuses: [], universities: [] }
}

export const getCachedProgram = (programId) => PROGRAM_CACHE.get(String(programId)) || null

export const getDatabaseMeta = () => ({
  loaded: PROGRAM_CACHE.size > 0,
  count: PROGRAM_CACHE.size,
  version: 'supabase',
  source: 'supabase',
})
