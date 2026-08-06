/** Sıralama evrimi — keskin çizgiler, ters Y ekseni (1 yukarıda), tahmin kesik çizgi + güven bandı */

export const HISTORICAL_YEARS = [2022, 2023, 2024, 2025]
export const PREDICTION_YEAR = 2026

const padRankings = (arr) => {
  const vals = Array.isArray(arr) ? arr.slice(-4) : []
  while (vals.length < 4) vals.unshift(null)
  return vals
}

const fmtRank = (n) => (n != null ? Number(n).toLocaleString('tr-TR') : '—')

export const renderRankingEvolutionChart = (container, { rankings, prediction } = {}) => {
  if (!container) return

  const ranks = padRankings(rankings)
  const histPoints = ranks
    .map((rank, i) => (rank != null ? { year: HISTORICAL_YEARS[i], rank: Number(rank) } : null))
    .filter(Boolean)

  const pred = prediction?.tahmini_skor != null ? Number(prediction.tahmini_skor) : null
  const alt = prediction?.alt_sinir != null ? Number(prediction.alt_sinir) : null
  const ust = prediction?.ust_sinir != null ? Number(prediction.ust_sinir) : null

  if (!histPoints.length && pred == null) {
    container.innerHTML = ''
    container.classList.add('hidden')
    return
  }

  container.classList.remove('hidden')

  const W = 420
  const H = 200
  const padL = 52
  const padR = 16
  const padT = 14
  const padB = 36
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const histSlots = 4
  const gapW = plotW * 0.1
  const predW = plotW * 0.16
  const histW = plotW - gapW - predW
  const histStep = histW / (histSlots - 1)

  const xHist = (i) => padL + i * histStep
  const xPred = padL + histW + gapW + predW * 0.55
  const xGapStart = padL + histW + gapW * 0.15
  const xGapEnd = padL + histW + gapW * 0.85

  const allRanks = [
    ...histPoints.map((p) => p.rank),
    ...(pred != null ? [pred] : []),
    ...(alt != null ? [alt] : []),
    ...(ust != null ? [ust] : []),
  ]
  const rawMin = Math.min(...allRanks)
  const rawMax = Math.max(...allRanks)
  const span = Math.max(rawMax - rawMin, rawMax * 0.08)
  const rankMin = Math.max(1, rawMin - span * 0.12)
  const rankMax = rawMax + span * 0.12

  const yAt = (rank) => padT + ((rank - rankMin) / (rankMax - rankMin)) * plotH

  const histLine = histPoints
    .map((p) => {
      const i = HISTORICAL_YEARS.indexOf(p.year)
      return `${xHist(i)},${yAt(p.rank)}`
    })
    .join(' ')

  const lastHist = histPoints[histPoints.length - 1]
  const predLine = lastHist && pred != null
    ? `${xHist(HISTORICAL_YEARS.indexOf(lastHist.year))},${yAt(lastHist.rank)} ${xPred},${yAt(pred)}`
    : ''

  const yTicks = 4
  const tickEls = []
  for (let t = 0; t <= yTicks; t += 1) {
    const rank = rankMin + ((rankMax - rankMin) * t) / yTicks
    const y = yAt(rank)
    tickEls.push(`
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="rank-chart-grid" />
      <text x="${padL - 6}" y="${y + 3}" class="rank-chart-axis-label" text-anchor="end">${Math.round(rank).toLocaleString('tr-TR')}</text>
    `)
  }

  const histDots = histPoints.map((p) => {
    const i = HISTORICAL_YEARS.indexOf(p.year)
    const x = xHist(i)
    const y = yAt(p.rank)
    return `
      <circle cx="${x}" cy="${y}" r="3.5" class="rank-chart-dot" />
      <text x="${x}" y="${H - 10}" class="rank-chart-year" text-anchor="middle">${p.year}</text>
    `
  }).join('')

  let predBand = ''
  let predExtras = ''
  if (pred != null && alt != null && ust != null) {
    const yTop = yAt(alt)
    const yBot = yAt(ust)
    const bandX = xPred - predW * 0.35
    const bandW = predW * 0.7
    predBand = `
      <rect x="${bandX}" y="${yTop}" width="${bandW}" height="${Math.max(yBot - yTop, 1)}" class="rank-chart-confidence" />
      <line x1="${bandX}" y1="${yTop}" x2="${bandX + bandW}" y2="${yTop}" class="rank-chart-ci-line" />
      <line x1="${bandX}" y1="${yBot}" x2="${bandX + bandW}" y2="${yBot}" class="rank-chart-ci-line" />
    `
  }

  if (pred != null) {
    predExtras = `
      <circle cx="${xPred}" cy="${yAt(pred)}" r="3.5" class="rank-chart-dot rank-chart-dot-pred" />
      <text x="${xPred}" y="${H - 10}" class="rank-chart-year rank-chart-year-pred" text-anchor="middle">${PREDICTION_YEAR}</text>
      <text x="${xPred}" y="${H - 22}" class="rank-chart-pred-label" text-anchor="middle">tahmin</text>
    `
  }

  container.innerHTML = `
    <h4 class="rank-chart-title">Sıralama evrimi</h4>
    <svg class="rank-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Son yıllar sıralama grafiği ve tahmin">
      <defs>
        <pattern id="rank-ci-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="rank-chart-hatch-line" />
        </pattern>
      </defs>
      ${tickEls.join('')}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" class="rank-chart-axis" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" class="rank-chart-axis" />
      ${predBand}
      ${histLine ? `<polyline points="${histLine}" class="rank-chart-line" fill="none" />` : ''}
      ${predLine ? `<polyline points="${predLine}" class="rank-chart-line rank-chart-line-pred" fill="none" />` : ''}
      ${xGapStart < xGapEnd ? `<line x1="${xGapStart}" y1="${padT}" x2="${xGapEnd}" y2="${padT + plotH}" class="rank-chart-gap" />` : ''}
      ${histDots}
      ${predExtras}
    </svg>
    <p class="rank-chart-caption">
      ${histPoints.length ? `Geçmiş: ${histPoints.map((p) => `${p.year} ${fmtRank(p.rank)}`).join(' · ')}` : ''}
      ${pred != null ? `${histPoints.length ? ' | ' : ''}Tahmin ${PREDICTION_YEAR}: ${fmtRank(pred)}${alt != null && ust != null ? ` (${fmtRank(alt)}–${fmtRank(ust)})` : ''}` : ''}
    </p>
  `
}
