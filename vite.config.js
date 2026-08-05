import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const DATA_FILES = [
  'program_search.json',
  'program_index.json',
  'departments_index.json',
  'analysis_index_2026.json',
]

const STATIC_DIRS = [
  { urlPrefix: '/data', dir: 'data' },
  { urlPrefix: '/validated', dir: 'validated' },
]

const serveStaticJson = () => ({
  name: 'serve-static-json',
  configureServer(server) {
    for (const { urlPrefix, dir } of STATIC_DIRS) {
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
        fs.createReadStream(filePath).pipe(res)
      })
    }
  },
  closeBundle() {
    for (const { urlPrefix, dir } of STATIC_DIRS) {
      const destRoot = path.join(process.cwd(), 'dist', urlPrefix.replace(/^\//, ''))
      const srcRoot = path.join(process.cwd(), dir)
      if (!fs.existsSync(srcRoot)) continue

      const copyRecursive = (src, dest) => {
        fs.mkdirSync(dest, { recursive: true })
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, entry.name)
          const destPath = path.join(dest, entry.name)
          if (entry.isDirectory()) copyRecursive(srcPath, destPath)
          else if (entry.name.endsWith('.json')) fs.copyFileSync(srcPath, destPath)
        }
      }
      copyRecursive(srcRoot, destRoot)
    }

    const destData = path.join(process.cwd(), 'dist', 'data')
    fs.mkdirSync(destData, { recursive: true })
    for (const name of DATA_FILES) {
      const src = path.join(process.cwd(), 'data', name)
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(destData, name))
    }
  },
})

export default defineConfig({
  plugins: [serveStaticJson()],
})
