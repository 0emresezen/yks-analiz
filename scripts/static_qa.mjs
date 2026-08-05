import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const YEAR = 2026
const DATA_BASE = path.join(ROOT, 'data', 'analysis', String(YEAR))
const URL = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:5173'
const UI_ONLY = process.argv.includes('--ui-only')
const DB_ONLY = process.argv.includes('--db-only')
const REPORT_DIR = path.join(ROOT, 'reports')

const issues = []
const checks = []

const addCheck = (group, name, pass, info = '') => {
  checks.push({ group, name, pass, info })
  const label = pass ? 'GEÇTİ' : 'KALDI'
  console.log(`${label} | [${group}] ${name}${info ? ` — ${info}` : ''}`)
  if (!pass) {
    issues.push({
      severity: group === 'database' ? 'high' : 'medium',
      category: group,
      description: `${name}${info ? `: ${info}` : ''}`,
      fix_prompt: fixPromptFor(group, name, info),
    })
  }
}

const fixPromptFor = (group, name, info) => {
  if (group === 'database' && name.includes('manifest')) {
    return 'details_manifest.json ile disk üzerindeki partition dosyalarını eşleştir; eksik part dosyalarını build_analysis_database.py ile yeniden üret.'
  }
  if (group === 'database' && name.includes('program sayısı')) {
    return 'meta.json total_programs ile analysis_index satır sayısını hizala; pipeline\'ı yeniden çalıştır.'
  }
  if (group === 'ui' && name.includes('LLM')) {
    return 'metricExplanations.js ve app.js içinde LLM/gemini kaynak etiketlerinin UI\'da render edilmediğini doğrula.'
  }
  if (group === 'ui' && name.includes('modal')) {
    return 'İlgili modalın DOM id\'lerini ve click handler\'larını src/app.js içinde kontrol et.'
  }
  if (group === 'ui' && name.includes('responsive')) {
    return 'Mobil viewport (375px) için CSS grid/flex kırılımlarını src/style.css içinde düzelt.'
  }
  if (group === 'accessibility' && name.includes('label')) {
    return 'Form inputlarına aria-label veya bağlı label ekle.'
  }
  return `${name} başarısız${info ? ` (${info})` : ''} — ilgili bileşeni src/ altında incele.`
}

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

const runDatabaseChecks = () => {
  const required = [
    'meta.json',
    'analysis_index.json',
    'details_manifest.json',
    'string_dictionary.json',
    'enums.json',
    'city_index.json',
    'department_index.json',
    'university_index.json',
    'campus_metrics.json',
  ]

  for (const file of required) {
    const full = path.join(DATA_BASE, file)
    const exists = fs.existsSync(full)
    addCheck('database', `${file} mevcut`, exists, exists ? '' : full)
    if (!exists) continue
    try {
      readJson(full)
      addCheck('database', `${file} geçerli JSON`, true)
    } catch (e) {
      addCheck('database', `${file} geçerli JSON`, false, e.message)
    }
  }

  const meta = readJson(path.join(DATA_BASE, 'meta.json'))
  const index = readJson(path.join(DATA_BASE, 'analysis_index.json'))
  const manifest = readJson(path.join(DATA_BASE, 'details_manifest.json'))

  const rowCount = Array.isArray(index?.data) ? index.data.length : (Array.isArray(index) ? index.length : 0)
  addCheck(
    'database',
    'Program sayısı meta ile uyumlu',
    rowCount === meta.total_programs,
    `index=${rowCount}, meta=${meta.total_programs}`,
  )

  const mapCount = manifest?.program_map ? Object.keys(manifest.program_map).length : 0
  addCheck(
    'database',
    'Manifest program eşlemesi tam',
    mapCount === meta.total_programs,
    `manifest=${mapCount}, meta=${meta.total_programs}`,
  )

  const sampleIds = Object.keys(manifest.program_map || {}).slice(0, 5)
  const partitionById = Object.fromEntries((manifest.partitions || []).map((p) => [p.id, p.file]))
  let missingPartitions = 0
  for (const id of sampleIds) {
    const partId = manifest.program_map[id]
    const rel = partitionById[partId]
    const partPath = rel ? path.join(DATA_BASE, 'details', rel) : null
    if (!partPath || !fs.existsSync(partPath)) missingPartitions++
  }
  addCheck('database', 'Örnek partition dosyaları mevcut', missingPartitions === 0, `${missingPartitions} eksik`)

  const healthPath = path.join(ROOT, 'validated', 'system_health.json')
  if (fs.existsSync(healthPath)) {
    const health = readJson(healthPath)
    addCheck('database', 'Sistem sağlığı HEALTHY', health.status === 'HEALTHY', health.status)
    addCheck('database', 'Doğrulama oranı %100', health.validation_success_rate === 100, String(health.validation_success_rate))
  }

  const firstPartFile = manifest.partitions?.[0]?.file
  const samplePart = firstPartFile ? path.join(DATA_BASE, 'details', firstPartFile) : null
  if (samplePart && fs.existsSync(samplePart)) {
    const part = readJson(samplePart)
    const programs = part.programs || part.data || (Array.isArray(part) ? part : [])
    const first = programs[0] || Object.values(part.programs || {})[0] || part
    const blob = JSON.stringify(first)
    addCheck('database', 'Detay verisinde LLM etiketi yok', !/llm|gemini|yapay zek/i.test(blob))
  }
}

const runUiChecks = async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const page = await browser.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 150)}`))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !t.includes('supabase') && !t.includes('Failed to load resource')) {
      consoleErrors.push(`console: ${t.slice(0, 150)}`)
    }
  })

  const dismissDisclaimer = async () => {
    const dismissed = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Anladım'))
      if (btn) { btn.click(); return true }
      return false
    })
    if (dismissed) await new Promise((r) => setTimeout(r, 600))
    return dismissed
  }

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForFunction(
    () => {
      const l = document.getElementById('app-loading')
      return !l || l.classList.contains('hidden')
    },
    { timeout: 20000 },
  ).catch(() => {})
  await dismissDisclaimer()

  const assets = await page.evaluate(() =>
    [...document.querySelectorAll('script[src], link[href]')]
      .map((el) => el.src || el.href)
      .filter((u) => u && u.startsWith(window.location.origin)),
  )
  let brokenAssets = 0
  for (const asset of assets.slice(0, 20)) {
    const res = await fetch(asset).catch(() => null)
    if (!res?.ok) brokenAssets++
  }
  addCheck('ui', 'Statik assetler yükleniyor', brokenAssets === 0, `${brokenAssets} kırık`)

  const tableInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr')
    return { rowCount: rows.length }
  })
  addCheck('ui', 'Ana tablo render edildi', tableInfo.rowCount > 0, `${tableInfo.rowCount} satır`)

  await page.click('#btn-open-add-program-modal')
  await new Promise((r) => setTimeout(r, 600))
  const modalOpen = await page.evaluate(
    () => !document.getElementById('add-program-modal')?.classList.contains('hidden'),
  )
  addCheck('ui', 'Bölüm Ekle modalı açılıyor', modalOpen)

  await page.evaluate(() => {
    const inp = document.getElementById('search-add-program')
    inp.value = 'ege üniversitesi bilgisayar'
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 6000))
  const searchCount = await page.evaluate(
    () => document.querySelectorAll('#search-add-results .add-program-result-item').length,
  )
  addCheck('ui', 'Program araması sonuç veriyor', searchCount > 0, `${searchCount} sonuç`)

  await page.evaluate(() => {
    const items = [...document.querySelectorAll('#search-add-results .add-program-result-item:not(.already-added)')]
    items[0]?.click()
    items[1]?.click()
  })
  await new Promise((r) => setTimeout(r, 500))
  const selCount = await page.evaluate(() => document.getElementById('add-program-selection-count')?.textContent)
  addCheck('ui', 'Çoklu seçim çalışıyor', String(selCount).startsWith('2'), selCount)

  await page.evaluate(() => document.getElementById('btn-save-new-program')?.click())
  await new Promise((r) => setTimeout(r, 6000))
  const addClosed = await page.evaluate(
    () => document.getElementById('add-program-modal')?.classList.contains('hidden'),
  )
  addCheck('ui', 'Program ekleme tamamlanıyor', addClosed)

  const favCount = await page.evaluate(() => document.querySelectorAll('.fav-metrics-grid').length)
  addCheck('ui', 'Favoriler listesi render edildi', favCount >= 2, `${favCount} öğe`)

  await page.click('.detail-btn[data-id]')
  await new Promise((r) => setTimeout(r, 4000))
  const detail = await page.evaluate(() => {
    const modal = document.getElementById('dept-detail-modal')
    const cards = [...document.querySelectorAll('.modal-metric-card')]
    const withLlm = cards.filter((c) => /\bLLM\b|gemini|yapay zek/i.test(c.textContent))
    return {
      visible: modal && !modal.classList.contains('hidden'),
      total: cards.length,
      llm: withLlm.length,
      evidence: cards.filter((c) => c.textContent.includes('Daha fazla bilgi')).length,
      verdict: cards.filter((c) => c.querySelector('.modal-metric-verdict')).length,
    }
  })
  addCheck('ui', 'Detay modalı açılıyor', detail.visible)
  addCheck('ui', '14 metrik kartı mevcut', detail.total === 14, `${detail.total} kart`)
  addCheck('ui', 'LLM kaynağı kullanıcıya gösterilmiyor', detail.llm === 0, `${detail.llm} sızıntı`)
  addCheck('ui', 'Metrik açıklamaları görünüyor', detail.evidence >= 10, `${detail.evidence} kart`)
  addCheck('ui', 'Durum etiketleri görünüyor', detail.verdict >= 5, `${detail.verdict} kart`)

  await page.click('#modal-close-btn')
  await new Promise((r) => setTimeout(r, 600))

  await page.setViewport({ width: 375, height: 812 })
  await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  await dismissDisclaimer()
  const mobile = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 24
    const search = document.getElementById('global-search')
    const searchVisible = search ? search.getBoundingClientRect().width > 0 : false
    return { overflow, searchVisible }
  })
  addCheck('responsive', 'Mobilde yatay taşma yok', !mobile.overflow)
  addCheck('responsive', 'Mobilde arama alanı görünür', mobile.searchVisible)

  const a11y = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input, select, textarea')]
    const unlabeled = inputs.filter((el) => {
      const id = el.id
      const hasLabel = id && document.querySelector(`label[for="${id}"]`)
      const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
      return !hasLabel && !hasAria && el.type !== 'hidden'
    })
    return { unlabeled: unlabeled.length, total: inputs.length }
  })
  addCheck('accessibility', 'Kritik form alanları etiketli', a11y.unlabeled <= 12, `${a11y.unlabeled}/${a11y.total} etiketsiz`)

  const criticalErrors = consoleErrors.filter(
    (e) => !e.includes('enrichItemWithPrediction') && !e.includes('favicon'),
  )
  addCheck('ui', 'Kritik konsol/page hatası yok', criticalErrors.length === 0, criticalErrors.slice(0, 3).join(' | ') || 'temiz')

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(REPORT_DIR, 'qa-screenshot-desktop.png') })
  await browser.close()
}

const buildReport = () => {
  const passed = checks.filter((c) => c.pass).length
  const failed = checks.length - passed
  const high = issues.filter((i) => i.severity === 'high').length
  const medium = issues.filter((i) => i.severity === 'medium').length

  let status = 'passing'
  let statusEmoji = '✅'
  if (high > 0) { status = 'high-severity'; statusEmoji = '🔴' }
  else if (medium > 0) { status = 'medium-severity'; statusEmoji = '🟠' }
  else if (issues.length > 0) { status = 'low-severity'; statusEmoji = '🟡' }

  return {
    mode: 'static',
    engine: 'puppeteer + filesystem',
    requires_api_key: false,
    requires_agents: false,
    url: DB_ONLY ? null : URL,
    generated_at: new Date().toISOString(),
    summary: {
      status,
      status_emoji: statusEmoji,
      total_checks: checks.length,
      passed,
      failed,
      total_issues: issues.length,
    },
    checks,
    issues,
    fix_prompts: issues.map((i) => i.fix_prompt),
  }
}

console.log('\n=== YKS Kıyas Statik QA ===\n')
console.log(`Mod: ${DB_ONLY ? 'database' : UI_ONLY ? 'ui' : 'full'} | API: yok | Agent: yok\n`)

if (!UI_ONLY) runDatabaseChecks()
if (!DB_ONLY) await runUiChecks()

const report = buildReport()
fs.mkdirSync(REPORT_DIR, { recursive: true })
const reportPath = path.join(REPORT_DIR, 'qa-report.json')
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

console.log(`\n${report.summary.status_emoji} ${report.summary.status.toUpperCase()} — ${report.summary.passed}/${report.summary.total_checks} geçti`)
console.log(`Rapor: ${reportPath}`)
if (report.fix_prompts.length) {
  console.log('\n=== Düzeltme önerileri ===')
  report.fix_prompts.forEach((p, i) => console.log(`${i + 1}. ${p}`))
}

process.exit(report.summary.failed > 0 ? 1 : 0)
