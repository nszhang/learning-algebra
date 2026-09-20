// Create the first admin account (no public signup exists).
// Usage:  node scripts/create-admin.mjs [username] [password]
// Password is generated (and printed once) if not provided.
// DATABASE_URL env var selects the database; schema must already exist
// (it is applied automatically when the app server starts).
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { createUser, findUserByUsername } from '../src/db.js';

const DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://postgres:postgres@localhost:5432/algebraace';

const username = (process.argv[2] || 'admin').toLowerCase();
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const password = process.argv[3]
  || Array.from(Array(12), () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

if (!/^[a-z0-9_]{3,20}$/.test(username)) {
  console.error('Username must be 3-20 chars: letters, numbers, underscores.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  if (await findUserByUsername(pool, username)) {
    console.error(`User "${username}" already exists — nothing done.`);
    process.exit(1);
  }
  const user = await createUser(pool, {
    username,
    displayName: username[0].toUpperCase() + username.slice(1),
    passHash: await bcrypt.hash(password, 10),
    role: 'admin'
  });
  console.log(`✅ Admin created: ${user.username} (id ${user.id})`);
  console.log(process.argv[3]
    ? 'Password: as provided on the command line.'
    : `Password: ${password}   ← save this now, it is not shown again`);
} finally {
  await pool.end();
}
