require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { pool } = require('../config/db')

async function initDb() {
  console.log('🗄️  Initializing database schema...')
  const sql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8')
  try {
    await pool.query(sql)
    console.log('✅ Database schema created successfully')
  } catch (err) {
    console.error('❌ Error creating schema:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

initDb()
