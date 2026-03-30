const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const { query } = require('./db')

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://ai-customer-support-production-56f8.up.railway.app/api/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const googleId = profile.id
    const email = profile.emails?.[0]?.value
    const name = profile.displayName
    const avatar = profile.photos?.[0]?.value

    // Upsert user
    const res = await query(
      `INSERT INTO users (google_id, name, email, avatar)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
       SET name = $2, email = $3, avatar = $4
       RETURNING *`,
      [googleId, name, email, avatar]
    )
    return done(null, res.rows[0])
  } catch (err) {
    return done(err, null)
  }
}))

passport.serializeUser((user, done) => done(null, user.id))

passport.deserializeUser(async (id, done) => {
  try {
    const res = await query('SELECT * FROM users WHERE id = $1', [id])
    done(null, res.rows[0] || false)
  } catch (err) {
    done(err, null)
  }
})
