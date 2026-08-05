import { BRAND_NAME, BRAND_SLUG } from './brand.js'

const EXPORT_TITLE = BRAND_NAME

export const EXPORT_SCOPES = [
  { id: 'filtered', label: 'Şu anki liste', hint: 'Tabloda gördüğünüz programlar' },
  { id: 'favorites', label: 'Favorilerim', hint: 'Yıldızladığınız programlar' },
  { id: 'all', label: 'Tüm programlar', hint: 'Listeye eklediğiniz her şey' },
]

/** Sadece günlük kullanıma uygun formatlar */
export const EXPORT_FORMATS = [
  {
    id: 'excel',
    label: 'Excel',
    hint: 'Excel veya Google Sheets\'te açılır',
    ext: 'csv',
    mime: 'text/csv;charset=utf-8',
    icon: 'XL',
    bom: true,
    action: 'download',
    downloadLabel: 'Excel İndir',
  },
  {
    id: 'pdf',
    label: 'PDF',
    hint: 'Yazdır penceresinden PDF olarak kaydedin',
    ext: 'pdf',
    mime: 'text/html;charset=utf-8',
    icon: 'PDF',
    action: 'print',
    downloadLabel: 'PDF Oluştur',
  },
]

const COLUMN_DEFS = [
  { key: 'full_name', label: 'Üniversite & Bölüm' },
  { key: 'city', label: 'Şehir' },
  { key: 'language', label: 'Dil' },
  { key: 'tuition_status', label: 'Burs' },
  { key: 'uniar_score', label: 'ÜNİAR' },
  { key: 'prestige_score', label: 'Prestij' },
  { key: 'academic_score', label: 'Akademik' },
  { key: 'last_rank', label: 'Geçen Yıl Sıra' },
  { key: 'predicted_rank', label: 'Tahmini Sıra' },
  { key: 'rating', label: 'Puanınız' },
  { key: 'notes', label: 'Notlar' },
]

const SCOPE_LABELS = {
  filtered: 'Şu anki liste',
  favorites: 'Favorilerim',
  all: 'Tüm programlar',
}

const formatRank = (value) => {
  if (value == null || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return num.toLocaleString('tr-TR')
}

const formatScore = (value) => {
  if (value == null || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return String(Math.round(num * 10) / 10)
}

export const buildExportRow = (item) => ({
  id: item.id ?? '',
  degree: item.degree ?? '-',
  full_name: item.full_name ?? '-',
  faculty: item.faculty ?? '-',
  city: item.city ?? '-',
  language: item.language ?? '-',
  tuition_status: item.tuition_status ?? '-',
  transport_score: formatScore(item.transport_score),
  uniar_score: formatScore(item.uniar_score),
  prestige_score: formatScore(item.prestige_score),
  academic_score: formatScore(item.academic_score),
  last_rank: formatRank(item.last_rank),
  predicted_rank: item.prediction && typeof item.prediction.tahmini_skor === 'number'
    ? formatRank(item.prediction.tahmini_skor)
    : '-',
  rating: item.rating != null && item.rating !== '' ? String(item.rating) : '-',
  notes: (item.notes && item.notes !== '-') ? String(item.notes).replace(/\s+/g, ' ').trim() : '-',
})

export const buildExportRows = (items = []) => items.map(buildExportRow)

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const escapeDelimitedCell = (value, delimiter) => {
  const str = String(value ?? '')
  if (str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(delimiter)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const buildMeta = (scope, count) => ({
  title: EXPORT_TITLE,
  exported_at: new Date().toISOString(),
  scope,
  scope_label: SCOPE_LABELS[scope] || scope,
  count,
})

/** Türkiye Excel uyumu: noktalı virgül ayırıcı + UTF-8 BOM */
export const generateExcelExport = (items, scope = 'filtered') => {
  const rows = buildExportRows(items)
  const delimiter = ';'
  const lines = [COLUMN_DEFS.map((c) => escapeDelimitedCell(c.label, delimiter)).join(delimiter)]
  rows.forEach((row) => {
    lines.push(COLUMN_DEFS.map((c) => escapeDelimitedCell(row[c.key], delimiter)).join(delimiter))
  })
  return lines.join('\r\n')
}

export const generateHtmlExport = (items, scope = 'filtered') => {
  const rows = buildExportRows(items)
  const meta = buildMeta(scope, rows.length)
  const headerCells = COLUMN_DEFS.map((c) => `<th>${escapeXml(c.label)}</th>`).join('')
  const bodyRows = rows.map((row) => {
    const cells = COLUMN_DEFS.map((c) => `<td>${escapeXml(row[c.key])}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(meta.title)} — ${escapeXml(meta.scope_label)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 1.25rem; color: #18181b; }
    h1 { font-size: 1.2rem; margin: 0 0 0.25rem; }
    .meta { font-size: 0.8125rem; color: #71717a; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
    th, td { border: 1px solid #e4e4e7; padding: 0.4rem 0.45rem; text-align: left; vertical-align: top; }
    th { background: #f4f4f5; font-weight: 700; }
    tr:nth-child(even) td { background: #fafafa; }
    @page { size: A4 landscape; margin: 8mm; }
    @media print {
      body { margin: 0; }
      table { font-size: 0.58rem; page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      th, td { padding: 0.25rem 0.3rem; }
    }
  </style>
</head>
<body>
  <h1>${escapeXml(meta.title)}</h1>
  <p class="meta">${escapeXml(new Date(meta.exported_at).toLocaleString('tr-TR'))} · ${rows.length} program · ${escapeXml(meta.scope_label)}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</body>
</html>`
}

export const generateExportPreviewHtml = (items, scope = 'filtered', limit = 8) => {
  const rows = buildExportRows(items).slice(0, limit)
  const meta = buildMeta(scope, items.length)
  const headerCells = COLUMN_DEFS.map((c) => `<th>${escapeXml(c.label)}</th>`).join('')
  const bodyRows = rows.map((row) => {
    const cells = COLUMN_DEFS.map((c) => `<td>${escapeXml(row[c.key])}</td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const more = items.length > limit
    ? `<p class="export-preview-more">${items.length - limit} program daha dosyada yer alacak.</p>`
    : ''

  return `
    <div class="export-table-preview">
      <p class="export-preview-caption">${escapeXml(meta.scope_label)} · ${items.length} program</p>
      <div class="export-table-scroll">
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      ${more}
    </div>
  `
}

export const generatePdfHelpHtml = (itemCount, scope = 'filtered') => {
  const meta = buildMeta(scope, itemCount)
  return `
    <div class="export-pdf-help">
      <p class="export-pdf-help-title">PDF olarak kaydetmek için</p>
      <ol class="export-pdf-help-steps">
        <li>Aşağıdaki <strong>PDF Oluştur</strong> butonuna tıklayın.</li>
        <li>Açılan yazdır penceresinde hedef olarak <strong>PDF olarak kaydet</strong> seçin.</li>
        <li>Dosya adını yazıp kaydedin.</li>
      </ol>
      <p class="export-pdf-help-meta">${escapeXml(meta.scope_label)} · ${itemCount} program</p>
    </div>
  `
}

const GENERATORS = {
  excel: generateExcelExport,
  pdf: generateHtmlExport,
}

export const generateExportContent = (formatId, items, scope = 'filtered') => {
  const generator = GENERATORS[formatId] || GENERATORS.excel
  return generator(items, scope)
}

export const getExportFormat = (formatId) => (
  EXPORT_FORMATS.find((f) => f.id === formatId) || EXPORT_FORMATS[0]
)

export const buildExportFilename = (formatId, scope = 'liste') => {
  const fmt = getExportFormat(formatId)
  const stamp = new Date().toISOString().slice(0, 10)
  const safeScope = scope.replace(/[^a-z0-9_-]/gi, '')
  const ext = formatId === 'excel' ? 'csv' : 'html'
  return `${BRAND_SLUG}-${safeScope}-${stamp}.${ext}`
}

export const downloadExportFile = (content, formatId, scope = 'filtered') => {
  const fmt = getExportFormat(formatId)
  const body = fmt.bom ? `\uFEFF${content}` : content
  const blob = new Blob([body], { type: fmt.mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = buildExportFilename(formatId, scope)
  link.click()
  URL.revokeObjectURL(url)
}

const openPrintPreviewTab = (htmlContent) => {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    return false
  }

  const triggerPrint = () => {
    try {
      printWindow.focus()
      printWindow.print()
    } catch {
      // Kullanıcı sekmeyi manuel yazdırabilir.
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }
  }

  printWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 400))
  window.setTimeout(triggerPrint, 1200)
  return true
}

const printViaHiddenFrame = (htmlContent) => new Promise((resolve, reject) => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Yazdırma önizlemesi')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 2000)
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    reject(new Error('Yazdırma başlatılamadı.'))
    return
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  window.setTimeout(() => {
    const win = iframe.contentWindow
    if (!win) {
      cleanup()
      reject(new Error('Yazdırma başlatılamadı.'))
      return
    }
    win.focus()
    win.print()
    cleanup()
    resolve()
  }, 400)
})

export const printExportHtml = async (htmlContent) => {
  try {
    await printViaHiddenFrame(htmlContent)
  } catch (frameError) {
    const opened = openPrintPreviewTab(htmlContent)
    if (!opened) {
      throw new Error('PDF oluşturulamadı. Tarayıcı pop-up engelleyicisini kapatıp tekrar deneyin.')
    }
  }
}

/** @deprecated */
export const generateMarkdownTable = (items) => generateExcelExport(items, 'filtered')
