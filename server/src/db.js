// db.js
// Livello di accesso al database. Usa PostgreSQL tramite il driver ufficiale "pg".
//
// Perché Postgres e non SQLite: su quasi tutti gli hosting gratuiti (Render,
// Railway, Fly.io) il disco dei servizi web è "effimero" — viene azzerato a
// ogni redeploy o riavvio. Un database SQLite (un file sul disco) andrebbe
// perso. Postgres gira invece come servizio separato con storage persistente
// vero, spesso offerto gratis da provider come Neon o Supabase.
//
// Il resto dell'app (routes-auth.js, routes-data.js) chiama solo le funzioni
// esportate da questo file, mai query dirette: se in futuro cambi provider
// del database, questo è l'unico file da toccare.

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if(!connectionString){
  throw new Error('DATABASE_URL mancante: impostala nel file .env (vedi .env.example)');
}

// Molti provider gratuiti (Neon, Supabase, Render) richiedono SSL per le
// connessioni esterne. "rejectUnauthorized: false" accetta il certificato
// del provider senza validarlo contro una CA nota: è la configurazione
// standard per questi servizi (non è un problema di sicurezza nella pratica,
// perché la connessione resta comunque cifrata in transito).
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function init(){
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Un documento JSON per utente: replica 1:1 lo "state" che prima viveva in
  // localStorage. È la via più rapida per avere un backend reale senza
  // riscrivere la logica di calcolo dell'app.
  //
  // NOTA PER IL FUTURO: se il prodotto cresce e serve reportistica, storico,
  // o merge intelligente dei conflitti multi-dispositivo, questa tabella
  // andrebbe normalizzata in tabelle separate (cost_items, daily_entries,
  // investments, altri_conti...). Per un MVP vendibile, un blob JSON
  // versionato è una scelta pragmatica e collaudata.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// ===== Utenti =====

async function createUser(email, passwordHash){
  const res = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    [email.toLowerCase().trim(), passwordHash]
  );
  return res.rows[0];
}

async function getUserByEmail(email){
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return res.rows[0] || null;
}

async function getUserById(id){
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] || null;
}

// ===== Dati finanziari (documento JSON per utente) =====

async function getUserData(userId){
  const res = await pool.query('SELECT data, updated_at FROM user_data WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

async function upsertUserData(userId, dataObj){
  const res = await pool.query(
    `INSERT INTO user_data (user_id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = now()
     RETURNING data, updated_at`,
    [userId, JSON.stringify(dataObj)]
  );
  return res.rows[0];
}

module.exports = {
  pool,
  init,
  createUser,
  getUserByEmail,
  getUserById,
  getUserData,
  upsertUserData,
};
