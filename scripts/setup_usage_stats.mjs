import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const PROJECT_REF = 'qyrwvyyowqmrcdbvwfku'
const password = process.env.SUPABASE_DB_PASSWORD

if (!password) {
  console.error('SUPABASE_DB_PASSWORD gerekli.')
  console.error('Supabase Dashboard → Project Settings → Database → Database password')
  process.exit(1)
}

const sqlPath = path.join(ROOT, 'supabase', 'usage_stats.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new pg.Client({
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log('usage_stats tabloları ve increment_yks_stat fonksiyonu oluşturuldu.')
} catch (err) {
  console.error('Kurulum hatası:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
