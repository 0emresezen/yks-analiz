import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

/** Root-level data files required at runtime */
const DEPLOY_DATA_ROOT_FILES = [
  'program_search.json',
  'program_index.json',
]

/** Never copy these into dist — unused by the frontend */
const DEPLOY_DATA_EXCLUDE = new Set([
  'yks_master_database.json',
  'analysis_index_2026.json',
  'departments_index.json',
])

const STATIC_DIRS = [
  { urlPrefix: '/data', dir: 'data' },
]

const copyRecursiveJsonGz = (src, dest, { excludeBasenames = DEPLOY_DATA_EXCLUDE } = {}) => {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludeBasenames.has(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyRecursiveJsonGz(srcPath, destPath, { excludeBasenames })
    } else if (entry.name.endsWith('.json') || entry.name.endsWith('.gz')) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const copyDeployData = () => {
  const dataRoot = path.join(process.cwd(), 'data')
  const distData = path.join(process.cwd(), 'dist', 'data')
  fs.mkdirSync(distData, { recursive: true })

  for (const file of DEPLOY_DATA_ROOT_FILES) {
    const src = path.join(dataRoot, file)
    if (!fs.existsSync(src)) continue
    fs.copyFileSync(src, path.join(distData, file))
  }

  copyRecursiveJsonGz(
    path.join(dataRoot, 'analysis'),
    path.join(distData, 'analysis'),
  )
}

const serveStaticJson = () => ({
  name: 'serve-static-json',
  configureServer(server) {
    const serveDir = (urlPrefix, dir) => {
      server.middlewares.use(urlPrefix, (req, res, next) => {
        const rel = decodeURIComponent((req.url || '').replace(/^\//, ''))
        if (!rel || rel.includes('..')) {
          next()
          return
        }
        const filePath = path.join(process.cwd(), dir, rel)
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (filePath.endsWith('.gz')) {
          res.setHeader('Content-Encoding', 'gzip')
        }
        fs.createReadStream(filePath).pipe(res)
      })
    }
    for (const { urlPrefix, dir } of STATIC_DIRS) serveDir(urlPrefix, dir)
  },
  closeBundle() {
    copyDeployData()
  },
})

export default defineConfig({
  plugins: [serveStaticJson()],
})
