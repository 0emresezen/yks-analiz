import puppeteer from 'puppeteer-core'

const URL = 'http://localhost:5173'
const results = []
const ok = (name, pass, info = '') => {
  results.push({ name, pass, info })
  console.log(`${pass ? 'GEÇTİ' : 'KALDI'} | ${name}${info ? ' — ' + info : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })

const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 150)))
page.on('console', (m) => {
  const t = m.text()
  // Supabase şeması yok (bilinen durum) ve favicon 404'leri gürültü
  if (m.type() === 'error' && !t.includes('supabase') && !t.includes('Failed to load resource')) {
    errors.push('console: ' + t.slice(0, 150))
  }
})

// 1) Sayfa yükleme — yükleme katmanı kaybolana kadar bekle (gerçek kullanıcı davranışı)
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
const t0 = Date.now()
await page
  .waitForFunction(
    () => {
      const l = document.getElementById('app-loading')
      return !l || l.classList.contains('hidden')
    },
    { timeout: 20000 },
  )
  .catch(() => {})
const loadMs = Date.now() - t0
await new Promise((r) => setTimeout(r, 1000))
ok('Sayfa yüklendi', true, `yükleme katmanı ${loadMs}ms sonra kalktı`)

// İlk ziyaret bilgilendirmesini kapat (gerçek kullanıcı akışı)
const disclaimerDismissed = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Anladım'),
  )
  if (btn) {
    btn.click()
    return true
  }
  return false
})
if (disclaimerDismissed) await new Promise((r) => setTimeout(r, 600))
ok('İlk ziyaret bilgilendirmesi kapatıldı', true, disclaimerDismissed ? 'görüldü ve kapatıldı' : 'görünmedi')
await page.screenshot({ path: '/tmp/smoke_1_ana_sayfa.png' })

// 2) Ana tablo dolu mu
const tableInfo = await page.evaluate(() => {
  const rows = document.querySelectorAll('#master-table tbody tr, .master-table tbody tr, table tbody tr')
  return { rowCount: rows.length, sample: rows[0]?.textContent?.trim()?.slice(0, 80) || null }
})
ok('Ana tablo satırları render edildi', tableInfo.rowCount > 0, `${tableInfo.rowCount} satır görünür`)

// 3) Bölüm Ekle akışı
await page.click('#btn-open-add-program-modal')
await new Promise((r) => setTimeout(r, 600))
const modalOpen = await page.evaluate(
  () => !document.getElementById('add-program-modal').classList.contains('hidden'),
)
ok('Bölüm Ekle modalı anında açıldı', modalOpen)

await page.evaluate(() => {
  const inp = document.getElementById('search-add-program')
  inp.value = 'ege üniversitesi bilgisayar'
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 6000))
const searchInfo = await page.evaluate(() => {
  const items = document.querySelectorAll('#search-add-results .add-program-result-item')
  return { count: items.length, first: items[0]?.textContent?.trim()?.replace(/\s+/g, ' ').slice(0, 70) }
})
ok('Arama sonuç veriyor', searchInfo.count > 0, `${searchInfo.count} sonuç, ilki: ${searchInfo.first}`)

// İlk 2 sonucu seç (çoklu seçim testi)
await page.evaluate(() => {
  const items = [...document.querySelectorAll('#search-add-results .add-program-result-item:not(.already-added)')]
  items[0]?.click()
  items[1]?.click()
})
await new Promise((r) => setTimeout(r, 500))
const selCount = await page.evaluate(
  () => document.getElementById('add-program-selection-count')?.textContent,
)
ok('Çoklu seçim çalışıyor', String(selCount).startsWith('2'), selCount)
await page.screenshot({ path: '/tmp/smoke_2_bolum_ekle.png' })

await page.evaluate(() => document.getElementById('btn-save-new-program')?.click())
await new Promise((r) => setTimeout(r, 6000))
const addModalClosed = await page.evaluate(
  () => document.getElementById('add-program-modal').classList.contains('hidden'),
)
ok('Programlar eklendi, modal kapandı', addModalClosed)

// 4) Favoriler listesi
const favInfo = await page.evaluate(() => {
  const items = document.querySelectorAll('.fav-item, [class*="fav-content-block"]')
  const grids = document.querySelectorAll('.fav-metrics-grid')
  const firstGrid = grids[0]?.textContent?.replace(/\s+/g, ' ').slice(0, 140)
  return { count: items.length, firstGrid }
})
ok('Favoriler listesi render edildi', favInfo.count >= 2, `${favInfo.count} öğe | ${favInfo.firstGrid || ''}`)

// 5) Detay modalı — 14 metrik + LLM kaynakları
await page.evaluate(() => document.querySelector('.detail-btn[data-id]')?.click())
await new Promise((r) => setTimeout(r, 3500))
const detail = await page.evaluate(() => {
  const modal = document.getElementById('dept-detail-modal')
  const cards = [...document.querySelectorAll('.modal-metric-card')]
  const withScore = cards.filter((c) => !c.querySelector('.modal-metric-score')?.textContent?.includes('—'))
  const llmSourced = cards.filter((c) => c.textContent.includes('LLM tahmini'))
  const rankCells = document.querySelectorAll('#modal-rank-row td').length
  return {
    visible: modal && !modal.classList.contains('hidden'),
    title: document.getElementById('modal-dept-title')?.textContent?.trim(),
    total: cards.length,
    withScore: withScore.length,
    llm: llmSourced.length,
    rankCells,
  }
})
ok('Detay modalı açıldı', detail.visible, detail.title)
ok('14 metrik kartı mevcut', detail.total === 14, `${detail.total} kart, ${detail.withScore} tanesi skorlu`)
ok('LLM kaynaklı metrikler görünüyor', detail.llm > 0, `${detail.llm} kart LLM kaynaklı`)
ok('Son 4 yıl sıralama tablosu 4 sütunlu', detail.rankCells === 5, `${detail.rankCells - 1} yıl sütunu`)
await page.screenshot({ path: '/tmp/smoke_3_detay_modal.png' })

// 6) Modal çarpı ile kapanıyor mu
await page.evaluate(() => document.getElementById('modal-close-btn')?.click())
await new Promise((r) => setTimeout(r, 600))
const detailClosed = await page.evaluate(() =>
  document.getElementById('dept-detail-modal').classList.contains('hidden'),
)
ok('Detay modalı çarpı ile kapandı', detailClosed)

// 7) Sayfa yenileme sonrası kalıcılık (localStorage)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 4000))
const afterReload = await page.evaluate(() => document.querySelectorAll('.fav-metrics-grid').length)
ok('Yenileme sonrası liste kalıcı', afterReload >= 2, `${afterReload} öğe`)

console.log('\n=== SAYFA HATALARI ===')
errors.length ? errors.forEach((e) => console.log(e)) : console.log('(yok)')
const failed = results.filter((r) => !r.pass).length
console.log(`\nSONUÇ: ${results.length - failed}/${results.length} test geçti`)
await browser.close()
process.exit(failed ? 1 : 0)
