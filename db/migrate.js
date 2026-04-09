/**
 * migrate.js — Run from the nextjs-auth folder
 * Usage:
 *   node db/migrate.js
 *
 * Requires: npm install pg  (already in deps)
 * Uses the Supabase connection pooler directly.
 */
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local manually (no dotenv needed)
const envFile = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .forEach(l => {
      const [k, ...v] = l.split('=')
      if (k && v.length) process.env[k.trim()] = v.join('=').trim()
    })
}

const DB_URL = process.env.DATABASE_URL ||
  `postgresql://postgres.xtixlhodoqvfopuukhjt:${process.env.SUPABASE_DB_PASS ?? ''}@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')

  console.log('Connecting to Supabase...')
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected. Running migration...')

  // Split on semicolons but keep function bodies intact
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await client.query(stmt)
      process.stdout.write('.')
    } catch (e) {
      if (e.message.includes('already exists')) {
        process.stdout.write('s') // skipped
      } else {
        console.error('\nError running:\n', stmt.slice(0, 80))
        console.error(e.message)
      }
    }
  }

  console.log('\n✅ Migration complete!')
  await client.end()
}

migrate().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
