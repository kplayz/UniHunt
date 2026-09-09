const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set for DB setup')
  process.exit(1)
}

async function runSqlFile(client, file) {
  console.log('Applying', file)
  const sql = fs.readFileSync(file, 'utf8')
  await client.query(sql)
}

async function main() {
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations')
    const seedDir = path.join(__dirname, '..', 'db', 'seed')

    const migFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    for (const f of migFiles) await runSqlFile(client, path.join(migrationsDir, f))

    const seedFiles = fs.readdirSync(seedDir).filter(f => f.endsWith('.sql')).sort()
    for (const f of seedFiles) {
      if (f.includes('teardown')) continue
      await runSqlFile(client, path.join(seedDir, f))
    }
    console.log('DB setup complete')
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
