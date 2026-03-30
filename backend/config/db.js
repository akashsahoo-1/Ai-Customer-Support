const { Pool } = require('pg')

// Mirror the isProduction check from index.js \u2014 Railway always runs over HTTPS
// even if NODE_ENV is accidentally left as 'development' in the env file.
const isProduction = process.env.NODE_ENV === 'production' ||
  (process.env.GOOGLE_CALLBACK_URL || '').startsWith('https://')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
})

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err)
})

async function query(text, params) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

module.exports = { pool, query }
