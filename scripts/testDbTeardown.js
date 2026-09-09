const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set for DB teardown')
  process.exit(1)
}

async function main() {
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    const teardownFile = path.join(__dirname, '..', 'db', 'seed', 'teardown.sql')
    console.log('Running teardown', teardownFile)
    const sql = fs.readFileSync(teardownFile, 'utf8')
    await client.query(sql)
    console.log('DB teardown complete')
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
