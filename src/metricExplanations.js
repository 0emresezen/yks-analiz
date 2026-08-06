/**
 * Deterministik metrik açıklamaları — skor bantları ve kanıt kaynakları.
 * LLM kaynağı kullanıcıya asla gösterilmez.
 */

import { buildMetricSectionsFromScore, getMetricSectionBand, getSectionText } from './metricSectionTexts.js'
import { getQualitativeReason } from './metricQualitative.js'

const GENERIC_FILLER = /değerlendirmeye dahil|değerlendirme yapıldı|katılmıştır|katkı sağlıyor|değerlendirmeye alındı/i

const SUB_KEY_LABELS = {
  learning_experience: 'Öğrenme deneyimi',
  academic_support: 'Akademik destek',
  learning_resources: 'Öğrenme kaynakları',
  employer_reputation: 'İşveren itibarı',
  employment_rate: 'İstihdam oranı',
  alumni_network: 'Mezun ağı',
  academic_reputation: 'Akademik itibar',
  industry_collaboration: 'Sanayi iş birliği',
  research_power: 'Araştırma gücü',
  mudek_fedek: 'MÜDEK/FEDEK akreditasyonu',
  professor_count: 'Profesör sayısı',
  student_faculty_ratio: 'Öğrenci/hoca oranı',
  sci_publications: 'SCI yayın performansı',
  tubitak_projects: 'TÜBİTAK projeleri',
  erasmus_mobility: 'Erasmus anlaşmaları',
  lab_facilities: 'Laboratuvar altyapısı',
  teknopark_presence: 'Teknopark varlığı',
  metro_access: 'Metro erişimi',
  tram_access: 'Tramvay erişimi',
  bus_frequency: 'Otobüs sıklığı',
  kyk_dorm_capacity: 'KYK yurt kapasitesi',
  kyk_occupancy_rate: 'KYK doluluk durumu',
  inner_campus_transit: 'Kampüs ulaşımı',
  city_transit_integration: 'Şehir içi ulaşım entegrasyonu',
  uniar_satisfaction: 'ÜNİAR memnuniyeti',
  student_clubs: 'Öğrenci kulüpleri',
  erasmus_mobility_rate: 'Erasmus değişimi',
  sports_facilities: 'Spor tesisleri',
  campus_size: 'Kampüs genişliği',
}

const LLM_SOURCE_PATTERNS = [/llm/i, /yapay zek/i, /gemini/i, /model/i]

export const METRIC_EVIDENCE_DEFAULTS = {
  prestige: ['ÜNİAR', 'URAP', 'YÖK Atlas'],
  academic: ['ÜNİAR', 'YÖK İstatistik', 'Akreditasyon kayıtları'],
  transport: ['Belediye ulaşım verileri', 'KYK yurt kapasitesi', 'Kampüs konum modeli'],
  student_life: ['ÜNİAR TÜMA', 'Öğrenci kulüpleri', 'Kampüs yaşam anketleri'],
  industry: ['Sanayi iş birlikleri', 'Teknopark verileri', 'Staj istatistikleri'],
  research: ['URAP', 'TÜBİTAK projeleri', 'SCI yayın endeksi'],
  international: ['YÖK Atlas Erasmus', 'Uluslararası öğrenci istatistikleri'],
  cost: ['TÜİK tüketici fiyat endeksi', 'Şehir maliyet modeli'],
  housing: ['KYK Genel Müdürlüğü', 'Barınma yoğunluk modeli'],
  career: ['TÜİK istihdam', 'Mezun yerleşme verileri', 'Sektör istatistikleri'],
  ai_opportunity: ['Teknopark envanteri', 'Bilişim ekosistemi', 'Teknoloji yatırımları'],
  internship: ['Staj kontenjan verileri', 'Sanayi yoğunluğu', 'İşveren anketleri'],
  scholarship: ['ÖSYM Tercih Kılavuzu', 'YÖK Atlas'],
  startup: ['TÜBİTAK Girişimci Üniversite', 'Kuluçka merkezleri', 'Teknopark'],
}

export const METRIC_FACTORS = {
  prestige: [
    { id: 'urap', label: 'URAP Türkiye sıralaması', weight: 60, itemKey: 'prestige_urap_rank' },
    { id: 'employer', label: 'İşveren tanınırlığı', weight: 25 },
    { id: 'alumni', label: 'Mezun ağı gücü', weight: 15 },
  ],
  academic: [
    { id: 'learning', label: 'Öğrenme deneyimi', weight: 35, subKey: 'learning_experience' },
    { id: 'support', label: 'Akademik destek', weight: 35, subKey: 'academic_support' },
    { id: 'resources', label: 'Öğrenme kaynakları', weight: 30, subKey: 'learning_resources' },
  ],
  transport: [
    { id: 'metro', label: 'Metro/tramvay erişimi', weight: 35 },
    { id: 'bus', label: 'Toplu taşıma sıklığı', weight: 25 },
    { id: 'kyk', label: 'KYK yurt erişimi', weight: 25 },
    { id: 'campus', label: 'Kampüs içi ulaşım', weight: 15 },
  ],
  student_life: [
    { id: 'uniar', label: 'ÜNİAR memnuniyeti', weight: 40, itemKey: 'uniar_score' },
    { id: 'clubs', label: 'Öğrenci kulüpleri', weight: 20 },
    { id: 'erasmus', label: 'Erasmus hareketliliği', weight: 15 },
    { id: 'sports', label: 'Spor tesisleri', weight: 10 },
    { id: 'campus', label: 'Kampüs genişliği', weight: 15 },
  ],
  industry: [
    { id: 'collab', label: 'Sanayi iş birlikleri', weight: 40 },
    { id: 'teknopark', label: 'Teknopark entegrasyonu', weight: 30 },
    { id: 'internship', label: 'Staj anlaşmaları', weight: 30 },
  ],
  research: [
    { id: 'urap', label: 'URAP sıralaması', weight: 40 },
    { id: 'sci', label: 'SCI yayın performansı', weight: 30 },
    { id: 'tubitak', label: 'TÜBİTAK projeleri', weight: 30 },
  ],
  international: [
    { id: 'erasmus', label: 'Erasmus anlaşmaları', weight: 45 },
    { id: 'language', label: 'Eğitim dili', weight: 25 },
    { id: 'mobility', label: 'Öğrenci hareketliliği', weight: 30 },
  ],
  cost: [
    { id: 'rent', label: 'Kira endeksi', weight: 40 },
    { id: 'living', label: 'Günlük yaşam giderleri', weight: 35 },
    { id: 'city_tier', label: 'Şehir maliyet bandı', weight: 25 },
  ],
  housing: [
    { id: 'kyk_cap', label: 'KYK kapasitesi', weight: 40 },
    { id: 'occupancy', label: 'Doluluk oranı', weight: 30 },
    { id: 'rent', label: 'Kira baskısı', weight: 30 },
  ],
  career: [
    { id: 'employment', label: 'İstihdam oranı', weight: 35 },
    { id: 'salary', label: 'Başlangıç maaşı', weight: 30 },
    { id: 'graduate', label: 'Mezun başarısı', weight: 20 },
    { id: 'industry', label: 'Sektör yoğunluğu', weight: 15 },
  ],
  ai_opportunity: [
    { id: 'teknopark', label: 'Teknopark varlığı', weight: 35 },
    { id: 'tech_hub', label: 'Teknoloji ekosistemi', weight: 35 },
    { id: 'research', label: 'Ar-Ge altyapısı', weight: 30 },
  ],
  internship: [
    { id: 'density', label: 'İşyeri yoğunluğu', weight: 40 },
    { id: 'agreements', label: 'Staj anlaşmaları', weight: 35 },
    { id: 'acceptance', label: 'Stajyer kabul oranı', weight: 25 },
  ],
  scholarship: [
    { id: 'rate', label: 'Burs/indirim oranı', weight: 60 },
    { id: 'type', label: 'Üniversite statüsü', weight: 40 },
  ],
  startup: [
    { id: 'incubator', label: 'Kuluçka merkezleri', weight: 35 },
    { id: 'teknopark', label: 'Teknopark', weight: 35 },
    { id: 'ecosystem', label: 'Girişimcilik ekosistemi', weight: 30 },
  ],
}

const CITY_INDUSTRY_CONTEXT = {
  Ankara: 'OSTİM, ASELSAN, HAVELSAN ve teknokent ekosistemine erişim avantajı',
  İstanbul: 'finans, teknoloji ve sanayi şirketlerine yakın konum ve yoğun sektör etkinlikleri',
  Izmir: 'organize sanayi bölgeleri ve liman lojistik sektörüne yakınlık',
  İzmir: 'organize sanayi bölgeleri ve liman lojistik sektörüne yakınlık',
  Kocaeli: 'otomotiv ve kimya sanayi kümesine doğrudan entegrasyon',
  Bursa: 'otomotiv ve tekstil sanayi merkezlerine yakınlık',
  Kayseri: 'Kayseri Organize Sanayi ve bölgesel üretim ağı',
  Gaziantep: 'Güneydoğu sanayi ve ihracat merkezlerine erişim',
}

const isLlmSource = (source) => {
  if (!source) return false
  return LLM_SOURCE_PATTERNS.some((re) => re.test(String(source)))
}

export const getScorePercent = (score) => Math.round(Number(score) * 10)

export const getScoreBand = (scorePercent, metricKey = '') => {
  if (metricKey === 'cost') {
    if (scorePercent >= 80) return { label: 'Çok düşük maliyet', tone: 'positive' }
    if (scorePercent >= 60) return { label: 'Düşük maliyet', tone: 'positive' }
    if (scorePercent >= 40) return { label: 'Orta maliyet', tone: 'neutral' }
    if (scorePercent >= 20) return { label: 'Yüksek maliyet', tone: 'negative' }
    return { label: 'Çok yüksek maliyet', tone: 'negative' }
  }

  if (scorePercent >= 80) return { label: 'Çok Yüksek', tone: 'positive' }
  if (scorePercent >= 65) return { label: 'Yüksek', tone: 'positive' }
  if (scorePercent >= 45) return { label: 'Orta', tone: 'neutral' }
  if (scorePercent >= 25) return { label: 'Sınırlı', tone: 'negative' }
  return { label: 'Düşük', tone: 'negative' }
}

const normalizeCityKey = (city) => {
  const c = String(city || '').trim()
  if (!c) return ''
  if (c === 'Istanbul') return 'İstanbul'
  if (c === 'Izmir') return 'İzmir'
  return c
}

export const getMetricEvidence = (item, metricKey, dataSource) => {
  const metricField = metricKey === 'student_life' ? 'uniar' : metricKey
  const evidence = new Set()

  METRIC_EVIDENCE_DEFAULTS[metricKey]?.forEach((e) => evidence.add(e))

  const planned = item[`${metricField}_planned_source`]
  if (planned) evidence.add(planned)

  if (dataSource && !isLlmSource(dataSource)) {
    evidence.add(String(dataSource).trim())
  }

  if (metricKey === 'scholarship' && item.scholarship_rate) {
    evidence.add('ÖSYM Tercih Kılavuzu')
  }
  if (metricKey === 'student_life' && item.uniar_grade) {
    evidence.add(`ÜNİAR ${item.uniar_year || '2026'}`)
  }

  return [...evidence].slice(0, 5)
}

const factorReasonFromItem = (item, factor, metricKey, score) => {
  if (factor.subKey) {
    const val = item.uniar_subcategories?.[factor.subKey]
    if (val != null) {
      const reason = getQualitativeReason(factor.subKey, Number(val))
      if (reason) return reason
    }
  }
  if (factor.itemKey === 'prestige_urap_rank' && item.prestige_urap_rank) {
    return `URAP Türkiye sıralamasında ${item.prestige_urap_rank}. sırada yer alıyor.`
  }
  if (factor.itemKey && item[factor.itemKey] != null) {
    const val = Number(item[factor.itemKey])
    if (factor.id === 'uniar' || factor.itemKey === 'uniar_score') {
      const reason = getQualitativeReason('uniar_satisfaction', val)
      if (reason) return reason
    }
  }
  if (metricKey === 'scholarship') {
    if (factor.id === 'rate' && item.scholarship_rate) {
      return `${item.scholarship_rate} statüsü burs skorunun ana belirleyicisidir.`
    }
    if (factor.id === 'type' && item.university_type) {
      return `${item.university_type} üniversite statüsü burs imkânlarını şekillendirir.`
    }
  }
  if (metricKey === 'international' && factor.id === 'language' && item.language) {
    return `Eğitim dili ${item.language}; uluslararasılaşma profilini doğrudan etkiler.`
  }
  if (score != null) {
    const scorePercent = getScorePercent(score)
    const band = getMetricSectionBand(scorePercent, metricKey)
    const sectionText = getSectionText(metricKey, factor.id, band)
    if (sectionText && !GENERIC_FILLER.test(sectionText)) return sectionText
  }
  return null
}

export const buildMetricFactors = (item, metricKey, explainableDetails) => {
  const exp = explainableDetails?.[metricKey]
  if (exp && Object.keys(exp).length) {
    return Object.entries(exp).map(([subKey, subVal]) => ({
      label: SUB_KEY_LABELS[subKey] || subKey.replace(/_/g, ' '),
      weight: null,
      reason: String(subVal),
    }))
  }

  const factors = METRIC_FACTORS[metricKey] || []
  return factors.map((factor) => ({
    label: factor.label,
    weight: factor.weight,
    reason: factorReasonFromItem(item, factor, metricKey, item[`${metricKey === 'student_life' ? 'uniar' : metricKey}_score`] ?? item[metricKey]),
  }))
}

const buildCostDescription = (item, scorePercent) => {
  const city = normalizeCityKey(item.city)

  if (scorePercent < 40) {
    if (city === 'İstanbul') {
      return 'İstanbul ortalama öğrenci yaşam maliyeti Türkiye ortalamasının üzerindedir; kira ve günlük harcamalar yüksek baskı oluşturur.'
    }
    if (city === 'Ankara' || city === 'İzmir') {
      return `${city} büyükşehir yaşam maliyeti orta-yüksek bandında; bütçe planlaması önemlidir.`
    }
    return 'Bölgesel yaşam maliyeti yüksek veya orta bandında; harcama planı gerektirir.'
  }
  if (scorePercent >= 60) {
    return `${city || 'Bölge'} genelinde yaşam maliyeti Türkiye ortalamasının altında veya dengeli seviyededir.`
  }
  return `${city || 'Bölge'} için yaşam maliyeti orta bandında değerlendirilmiştir.`
}

const buildIndustryDescription = (item, scorePercent) => {
  const city = normalizeCityKey(item.city)
  const uni = item.university || 'Üniversite'
  const cityCtx = CITY_INDUSTRY_CONTEXT[city]

  if (item.industry_desc && item.industry_desc.length > 40) {
    return item.industry_desc
  }

  if (cityCtx) {
    return `${uni}, ${cityCtx} nedeniyle sanayi bağlantısı ${getScoreBand(scorePercent).label.toLowerCase()} değerlendirilmiştir.`
  }

  if (scorePercent >= 70) {
    return `${uni} bölgesel sanayi iş birlikleri ve staj anlaşmalarıyla güçlü sektör entegrasyonuna sahiptir.`
  }
  if (scorePercent >= 45) {
    return `${uni} orta düzeyde sanayi bağlantıları ve staj imkânları sunmaktadır.`
  }
  return `${uni} için sanayi entegrasyonu sınırlı; staj ve iş birliği fırsatları bölgesel planlama gerektirir.`
}

const buildMetricSpecificDescription = (item, metricKey, scorePercent) => {
  const metricField = metricKey === 'student_life' ? 'uniar' : metricKey
  const storedDesc = item[`${metricField}_desc`]

  switch (metricKey) {
    case 'cost':
      return buildCostDescription(item, scorePercent)
    case 'industry':
      return buildIndustryDescription(item, scorePercent)
    case 'prestige':
      if (storedDesc && !/100 üzerinden/i.test(storedDesc) && !/deterministik/i.test(storedDesc)) {
        return storedDesc
      }
      if (item.prestige_urap_rank) {
        return `URAP Türkiye sıralamasında ${item.prestige_urap_rank}. — diploma gücü ve işveren tanınırlığı bu konuma dayanır.`
      }
      return 'URAP akademik performans sıralaması ve mezun ağı verileri diploma gücünü şekillendiriyor.'
    case 'academic':
      if (storedDesc) return storedDesc
      return 'Akademik kalite; öğrenme deneyimi, kadro gücü ve öğrenme kaynakları birleşimiyle hesaplanır.'
    case 'transport':
      if (storedDesc) return storedDesc
      return `${item.city || 'Kampüs'} ulaşım altyapısı, toplu taşıma erişimi ve KYK yurt bağlantıları değerlendirilmiştir.`
    case 'student_life':
      if (storedDesc) return storedDesc
      return item.uniar_grade
        ? `ÜNİAR ${item.uniar_grade} memnuniyet düzeyi kampüs yaşamını yansıtır.`
        : 'ÜNİAR memnuniyet endeksleri ve kampüs sosyal imkânları referans alınmıştır.'
    case 'research':
      if (storedDesc) return storedDesc
      return 'URAP sıralaması, SCI yayın performansı ve TÜBİTAK proje hacmi araştırma gücünü belirler.'
    case 'international':
      if (storedDesc) return storedDesc
      return item.language === 'İngilizce'
        ? 'İngilizce eğitim dili Erasmus ve uluslararası iş birliklerini doğrudan destekler.'
        : 'Erasmus anlaşmaları ve uluslararası öğrenci hareketliliği değerlendirilmiştir.'
    case 'housing':
      if (storedDesc) return storedDesc
      return `${item.city || 'Bölge'} KYK yurt kapasitesi, doluluk oranı ve kira baskısı barınma skorunu belirler.`
    case 'career':
      if (storedDesc) return storedDesc
      return 'Mezun istihdam oranı, iş bulma hızı ve sektör yoğunluğu kariyer skorunu oluşturur.'
    case 'ai_opportunity':
      if (storedDesc) return storedDesc
      return item.city === 'İstanbul' || item.city === 'Ankara'
        ? 'Bölgedeki yapay zeka ekosistemi ve teknopark yoğunluğu fırsat skorunu yükseltir.'
        : 'Teknopark varlığı ve teknoloji yatırımları yapay zeka sektörü yakınlığını belirler.'
    case 'internship':
      if (storedDesc) return storedDesc
      return 'Çevredeki sanayi/ofis yoğunluğu ve stajyer kabul istatistikleri staj kolaylığını yansıtır.'
    case 'scholarship':
      if (item.scholarship_rate?.includes('Burslu')) {
        return 'Tam burslu statü finansal yükü minimize eder; burs skoru yüksek banda yerleşir.'
      }
      if (storedDesc) return storedDesc
      return 'ÖSYM kılavuzundaki burs/indirim oranı ve üniversite statüsü değerlendirilmiştir.'
    case 'startup':
      if (storedDesc) return storedDesc
      return 'Kuluçka merkezleri, teknopark entegrasyonu ve girişimcilik ekosistemi girişimcilik skorunu belirler.'
    default:
      return storedDesc || 'Kanıta dayalı değerlendirme modeli ile hesaplanmıştır.'
  }
}

export const buildMetricDescription = (item, metricKey, score) => {
  const scorePercent = getScorePercent(score)
  return buildMetricSpecificDescription(item, metricKey, scorePercent)
}

export const buildMetricCardSections = ({
  item,
  metricKey,
  label,
  score,
  dataNote,
  escapeHtml,
}) => {
  const hasScore = score != null
  const scorePercent = hasScore ? getScorePercent(score) : null
  const band = hasScore ? getScoreBand(scorePercent, metricKey) : null
  const metricField = metricKey === 'student_life' ? 'uniar' : metricKey
  const storedSections = item?.[`${metricField}_sections`]
  const fromData = Array.isArray(storedSections)
    ? storedSections.map(sanitizeMetricSection).filter(Boolean)
    : []
  const sections = fromData.length
    ? fromData
    : (hasScore ? buildMetricSectionsFallback(item, metricKey, score) : [])

  const description = hasScore
    ? buildMetricDescription(item, metricKey, score)
    : (dataNote || 'Bu alan için doğrulanmış resmî veri bulunamadı.')

  const eh = escapeHtml

  const statusClass = band?.tone === 'positive'
    ? 'metric-status-positive'
    : band?.tone === 'negative'
      ? 'metric-status-negative'
      : 'metric-status-neutral'

  const sectionsHtml = sections.map((section) => `
    <div class="modal-metric-section">
      <div class="modal-metric-section-head">${eh(section.title || '')}</div>
      <p class="modal-metric-section-text">${eh(section.text || '')}</p>
    </div>
  `).join('')

  return {
    hasScore,
    scorePercent,
    sections,
    html: `
      <div class="modal-metric-header">
        <span class="modal-metric-title">${eh(label)}</span>
        <span class="modal-metric-score">${hasScore ? `${scorePercent} / 100` : '—'}</span>
      </div>
      ${hasScore ? `
        <div class="modal-metric-status-badge ${statusClass}">${eh(band.label)}</div>
        <div class="modal-metric-divider" aria-hidden="true"></div>
      ` : ''}
      <p class="modal-metric-summary">${eh(description)}</p>
      ${sectionsHtml ? `<div class="modal-metric-sections">${sectionsHtml}</div>` : ''}
    `,
  }
}

const sanitizeMetricSection = (section) => {
  const title = String(section?.title || '').trim()
  const text = String(section?.text || '').trim()
  if (!title || !text || GENERIC_FILLER.test(text)) return null
  return { title, text }
}

const buildMetricSectionsFallback = (item, metricKey, score) => {
  const fromScore = buildMetricSectionsFromScore(metricKey, score)
  if (fromScore.length) return fromScore

  const factors = buildMetricFactors(item, metricKey, item.explainable_details)
  return factors
    .map((factor) => {
      const text = factor.reason?.trim()
      if (!text || GENERIC_FILLER.test(text)) return null
      return { title: factor.label, text }
    })
    .filter(Boolean)
    .slice(0, 4)
}
