import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const DATA_FILES = [
  'program_search.json',
  'program_index.json',
  'departments_index.json',
]

const STATIC_DIRS = [
  { urlPrefix: '/data', dir: 'data' },
]

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
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(src)) return
      fs.mkdirSync(dest, { recursive: true })
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) copyRecursive(srcPath, destPath)
        else if (entry.name.endsWith('.json') || entry.name.endsWith('.gz')) fs.copyFileSync(srcPath, destPath)
      }
    }
    copyRecursive(path.join(process.cwd(), 'data'), path.join(process.cwd(), 'dist', 'data'))
  },
})

export default defineConfig({
  plugins: [serveStaticJson()],
})
