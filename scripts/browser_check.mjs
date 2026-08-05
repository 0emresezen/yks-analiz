import puppeteer from 'puppeteer-core'

const URL = process.argv[2] || 'http://localhost:5173'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const page = await browser.newPage()
const logs = []
page.on('console', (msg) => {
  const type = msg.type()
  if (type === 'error' || type === 'warn') logs.push(`[${type}] ${msg.text()}`)
})
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) => logs.push(`[reqfail] ${req.url()} ${req.failure()?.errorText}`))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))

// Try clicking the add-program button
const result = await page.evaluate(() => {
  const btn = document.getElementById('btn-open-add-program-modal')
  if (!btn) return { found: false }
  btn.click()
  const modal = document.getElementById('add-program-modal')
  return { found: true, modalHidden: modal?.classList.contains('hidden') }
})
await new Promise((r) => setTimeout(r, 1500))
const modalState = await page.evaluate(() => {
  const modal = document.getElementById('add-program-modal')
  return { hidden: modal?.classList.contains('hidden') }
})

console.log('=== CONSOLE LOGS ===')
logs.forEach((l) => console.log(l))
console.log('=== BUTTON TEST ===')
console.log('button found:', result.found, '| modal hidden after click:', modalState.hidden)

await browser.close()
