// Server entrypoint: connect to PostgreSQL, ensure schema, serve API + built client.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { createApp } from './app.js';
import { initSchema } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://postgres:postgres@localhost:5432/algebraace';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const useSSL = process.env.PGSSL === 'true' || /sslmode=require/i.test(DATABASE_URL);
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined
});
await initSchema(pool);
console.log('✅ Connected to PostgreSQL and schema is ready');

const app = createApp(pool, JWT_SECRET);

// Serve the built React client in production (client/dist)
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`🚀 AlgebraAce server on http://localhost:${PORT}`));
