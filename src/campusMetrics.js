/**
 * Kampüs bazlı tahmini metrikler — pipeline/campus_heuristics.py ile uyumlu.
 * Her kampüs için bir kez hesaplanır, bölümlere kopyalanır.
 */

const HEURISTIC_SOURCE = 'Kampüs konum modeli (şehir tier + ilçe heuristikleri)'
const HEURISTIC_NOTE =
  'Resmî açık veri yerine şehir ulaşım altyapısı, yaşam maliyeti ve barınma yoğunluğu için üretilmiş tahmini skor; kampüs bazında paylaşılır.'

const METRO_CITIES = new Set([
  'ISTANBUL', 'ANKARA', 'IZMIR', 'BURSA', 'ANTALYA', 'KOCAELI',
  'ADANA', 'GAZIANTEP', 'MERSIN', 'KONYA', 'ESKISEHIR',
])

const REGIONAL_HUBS = new Set([
  'SAMSUN', 'TRABZON', 'KAYSERI', 'DENIZLI', 'MANISA', 'MUGLA',
  'TEKIRDAG', 'SAKARYA', 'BALIKESIR', 'AYDIN', 'DIYARBAKIR',
  'SANLIURFA', 'MALATYA', 'ERZURUM', 'VAN', 'SIVAS', 'TOKAT',
])

const HIGH_COST_CITIES = new Set(['ISTANBUL', 'IZMIR', 'ANTALYA', 'MUGLA', 'KOCAELI'])

const REMOTE_DISTRICT_MARKERS = new Set([
  'AYAS', 'SEREFLIKOCHISAR', 'POLATLI', 'BEYPAZARI', 'GUDUL', 'NALLIHAN',
  'CUBUK', 'KIZILCAHAMAM', 'GOLBASI', 'SILIVRI', 'CATALCA', 'SILE', 'TUZLA', 'PENDIK',
])

let campusMetricsIndex = null
let campusMetricsLoadPromise = null

const stripAccents = (text) =>
  text.normalize('NFD').replace(/\p{M}/gu, '')

export const normalizeToken = (text) => {
  const raw = stripAccents(String(text || '').trim().toUpperCase())
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return raw || 'BILINMIYOR'
}

export const computeCampusKey = (item) => {
  const universityId = String(item?.university_id || '').trim()
  const university = normalizeToken(item?.university)
  const city = normalizeToken(item?.city)
  const district = normalizeToken(item?.district) || 'MERKEZ'
  const faculty = normalizeToken(item?.faculty)
  const uid = universityId || university

  if (faculty && faculty !== 'BILINMIYOR' && faculty !== 'FAKULTE' && faculty !== 'MESLEK_YUKSEKOKULU') {
    return `${uid}|${city}|${district}|${faculty}`
  }
  return `${uid}|${city}|${district}`
}

const roundScore = (value) => Math.round(Math.max(0, Math.min(10, value)) * 10) / 10

const cityTier = (city, university) => {
  const cityNorm = normalizeToken(city)
  const uniNorm = normalizeToken(university)
  if (cityNorm.includes('KKTC') || cityNorm.includes('KIBRIS') || uniNorm.includes('KKTC')) return 'kktc'
  if (METRO_CITIES.has(cityNorm)) return 'metro'
  if (REGIONAL_HUBS.has(cityNorm)) return 'regional'
  return 'local'
}

const campusLifeBoost = (item) => {
  const sub = item?.uniar_subcategories
  const campusLife = sub?.campus_life
  if (campusLife == null) return 0
  return (Number(campusLife) - 6.5) * 0.25
}

export const computeCampusMetricsHeuristic = (item) => {
  const city = String(item?.city || 'Bilinmiyor')
  const district = String(item?.district || 'Merkez')
  const university = String(item?.university || '')
  const tier = cityTier(city, university)
  const boost = campusLifeBoost(item)
  const districtNorm = normalizeToken(district)
  const campusKey = computeCampusKey(item)

  let transportScore
  let transportDesc
  if (tier === 'kktc') {
    transportScore = 5.5
    transportDesc = `${city} kampüsü: ada içi ulaşım sınırlı; öğrenci ulaşımı genelde otobüs ve özel araç ağırlıklı.`
  } else if (tier === 'metro') {
    transportScore = 7.8
    transportDesc = `${city} metropolünde metro/tramvay ve yoğun toplu taşıma ağı; kampüse ulaşım genelde kolay.`
  } else if (tier === 'regional') {
    transportScore = 6.2
    transportDesc = `${city} bölgesel merkez: şehir içi otobüs hatları mevcut; kampüs ulaşımı orta düzey.`
  } else {
    transportScore = 4.8
    transportDesc = `${city} yerel ölçek: toplu taşıma sınırlı; kampüse ulaşım çoğunlukla otobüs veya özel araç ile.`
  }

  if ([...REMOTE_DISTRICT_MARKERS].some((m) => districtNorm.includes(m))) {
    transportScore -= 1.4
    transportDesc += ` ${district} uzak kampüs konumu ulaşımı zorlaştırıyor.`
  }
  transportScore = roundScore(transportScore + boost)

  let costScore
  let costDesc
  const cityNorm = normalizeToken(city)
  if (tier === 'kktc') {
    costScore = 5.5
    costDesc = `${city}: döviz ve lojistik nedeniyle yaşam maliyeti orta-yüksek bandında.`
  } else if (HIGH_COST_CITIES.has(cityNorm)) {
    costScore = 4.2
    costDesc = `${city} yüksek yaşam maliyeti bandı; kira ve günlük harcamalar ortalamanın üzerinde.`
  } else if (tier === 'metro') {
    costScore = 4.8
    costDesc = `${city} metropol: kira ve sosyal yaşam maliyeti yüksek.`
  } else if (tier === 'regional') {
    costScore = 6.0
    costDesc = `${city} bölgesel merkez: yaşam maliyeti orta band.`
  } else {
    costScore = 7.2
    costDesc = `${city} yerel ölçek: genel yaşam maliyeti dengeli veya düşük.`
  }

  let housingScore
  let housingDesc
  if (tier === 'kktc') {
    housingScore = 5.8
    housingDesc = `${city}: KYK ve özel yurt kapasitesi sınırlı.`
  } else if (tier === 'metro') {
    housingScore = 6.5
    housingDesc = `${city}: KYK ve özel yurt seçenekleri geniş; kira baskısı yüksek olabilir.`
  } else if (tier === 'regional') {
    housingScore = 6.8
    housingDesc = `${city}: yurt ve kiralık seçenekleri orta-yüksek.`
  } else {
    housingScore = 7.5
    housingDesc = `${city}: barınma maliyeti genelde düşük; yurt kapasitesi çoğu öğrenci için yeterli olabilir.`
  }
  housingScore = roundScore(housingScore + boost * 0.5)

  return {
    campus_key: campusKey,
    transport_score: transportScore,
    transport_desc: transportDesc,
    transport_data_available: true,
    transport_data_source: HEURISTIC_SOURCE,
    transport_data_note: HEURISTIC_NOTE,
    cost_score: costScore,
    cost_desc: costDesc,
    cost_data_available: true,
    cost_data_source: HEURISTIC_SOURCE,
    cost_data_note: HEURISTIC_NOTE,
    housing_score: housingScore,
    housing_desc: housingDesc,
    housing_data_available: true,
    housing_data_source: HEURISTIC_SOURCE,
    housing_data_note: HEURISTIC_NOTE,
  }
}

export const loadCampusMetricsIndex = async (year = 2026) => {
  if (campusMetricsIndex) return campusMetricsIndex
  if (campusMetricsLoadPromise) return campusMetricsLoadPromise

  campusMetricsLoadPromise = (async () => {
    try {
      const res = await fetch(`/data/analysis/${year}/campus_metrics.json`)
      if (res.ok) {
        const doc = await res.json()
        campusMetricsIndex = doc?.metrics || {}
        return campusMetricsIndex
      }
    } catch (e) {
      console.warn('campus_metrics.json yüklenemedi, runtime heuristik kullanılacak', e)
    }
    campusMetricsIndex = {}
    return campusMetricsIndex
  })()

  return campusMetricsLoadPromise
}

export const applyCampusMetricsToItem = (item, year = 2026) => {
  if (!item) return item
  if (item.transport_data_available && item.transport_score != null) return item

  const key = item.campus_key || computeCampusKey(item)
  item.campus_key = key

  const index = campusMetricsIndex || {}
  const cached = index[key]
  const metrics = cached || computeCampusMetricsHeuristic(item)

  Object.assign(item, metrics)
  return item
}

export const ensureCampusMetricsOnItem = async (item, year = 2026) => {
  await loadCampusMetricsIndex(year)
  return applyCampusMetricsToItem(item, year)
}

export const applyAcademicHeuristic = (item) => {
  if (!item || item.academic_data_available) return item
  const sub = item.uniar_subcategories || {}
  const parts = []
  const labels = []
  const fields = [
    ['öğrenme deneyimi', 'learning_experience'],
    ['akademik destek', 'academic_support'],
    ['öğrenme kaynakları', 'learning_resources'],
  ]
  for (const [label, field] of fields) {
    const val = sub[field]
    if (val != null && !Number.isNaN(Number(val))) {
      parts.push(Number(val))
      labels.push(label)
    }
  }
  if (!parts.length) return item
  const score = roundScore(parts.reduce((a, b) => a + b, 0) / parts.length)
  item.academic_score = score
  item.academic_data_available = true
  item.academic_data_source = 'ÜNİAR alt kategorilerinden türetilmiş tahmin'
  item.academic_desc = `ÜNİAR öğrenci anketinden türetilmiş tahmini akademik kalite (${labels.join(', ')}).`
  item.academic_data_note = 'Resmî YÖK personel verisi yerine ÜNİAR alt skorlarından türetildi.'
  return item
}
