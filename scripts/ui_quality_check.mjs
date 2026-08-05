import puppeteer from 'puppeteer-core'

const URL = process.argv[2] || 'http://localhost:5173'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const logs = []
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 3000))

// 1) Bölüm Ekle modalını aç, ara, ilk sonucu seç ve listeye ekle
await page.click('#btn-open-add-program-modal')
await new Promise((r) => setTimeout(r, 800))
await page.evaluate(() => {
  const inp = document.getElementById('search-add-program')
  inp.value = 'atatürk üniversitesi bilgisayar'
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 6000))

const addState = await page.evaluate(() => {
  const first = document.querySelector('#search-add-results .add-program-result-item')
  if (!first) return { resultFound: false }
  first.click()
  return { resultFound: true, label: first.textContent.trim().slice(0, 90) }
})
await new Promise((r) => setTimeout(r, 800))
const selState = await page.evaluate(() => ({
  barHidden: document.getElementById('add-program-selection-bar')?.classList.contains('hidden'),
  count: document.getElementById('add-program-selection-count')?.textContent,
}))
console.log('seçim çubuğu:', JSON.stringify(selState))
if (addState.resultFound) {
  await page.evaluate(() => document.getElementById('btn-save-new-program')?.click())
  await new Promise((r) => setTimeout(r, 4000))
}

// 2) Eklenen programın detay modalını aç
const clicked = await page.evaluate(() => {
  const el = document.querySelector('.detail-btn[data-id]')
  if (!el) return false
  el.click()
  return true
})
await new Promise((r) => setTimeout(r, 3500))

const modalInfo = await page.evaluate(() => {
  const modal = document.getElementById('dept-detail-modal')
  const title = document.getElementById('modal-dept-title')?.textContent?.trim()
  const cards = [...document.querySelectorAll('.modal-metric-card')].map((c) => ({
    metric: c.querySelector('.modal-metric-title')?.textContent?.trim(),
    score: c.querySelector('.modal-metric-score')?.textContent?.trim(),
    source: c.querySelector('.modal-metric-meta span')?.textContent?.trim(),
  }))
  return {
    modalVisible: modal ? !modal.classList.contains('hidden') : false,
    title,
    cardCount: cards.length,
    cards,
  }
})

console.log('=== ERRORS ===')
logs.length ? logs.forEach((l) => console.log(l)) : console.log('(yok)')
console.log('=== EKLEME ===')
console.log('sonuç bulundu:', addState.resultFound, '|', addState.label || '-')
console.log('=== DETAY MODAL ===')
console.log('satır tıklandı:', clicked, '| görünür:', modalInfo.modalVisible, '| başlık:', modalInfo.title)
console.log('metrik kartı sayısı:', modalInfo.cardCount)
modalInfo.cards.forEach((c) => console.log(`- ${c.metric} | ${c.score} | ${c.source}`))

await page.screenshot({ path: '/tmp/ui_quality_modal.png', fullPage: false })
await browser.close()
