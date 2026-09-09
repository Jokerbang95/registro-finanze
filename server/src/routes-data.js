// routes-data.js
// Endpoint: /api/data — legge/scrive il documento JSON con lo stato
// dell'app (registro di cassa, investimenti, altri conti) per l'utente
// autenticato. Ogni utente vede e modifica solo i propri dati: l'id utente
// non arriva mai dal client, ma sempre dal token di sessione verificato
// (vedi requireAuth in auth.js) — questo evita che un utente possa leggere
// o sovrascrivere i dati di un altro semplicemente cambiando un parametro.

const express = require('express');
const db = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
const MAX_PAYLOAD_CHARS = 2_000_000; // limite di sicurezza generoso ma finito

router.use(requireAuth);

router.get('/', async (req, res) => {
  try{
    const row = await db.getUserData(req.userId);
    if(!row) return res.json({ data: null, updatedAt: null });
    // La colonna è JSONB: il driver pg restituisce già un oggetto JS,
    // non serve fare JSON.parse.
    res.json({ data: row.data, updatedAt: row.updated_at });
  }catch(e){
    console.error('Errore lettura dati:', e);
    res.status(500).json({ error: 'Errore del server nella lettura dei dati' });
  }
});

router.put('/', async (req, res) => {
  const { data } = req.body || {};
  if(data === undefined || data === null){
    return res.status(400).json({ error: 'Campo "data" mancante' });
  }
  const serialized = JSON.stringify(data);
  if(serialized.length > MAX_PAYLOAD_CHARS){
    return res.status(413).json({ error: 'Payload troppo grande' });
  }
  try{
    const row = await db.upsertUserData(req.userId, data);
    res.json({ ok: true, updatedAt: row.updated_at });
  }catch(e){
    console.error('Errore scrittura dati:', e);
    res.status(500).json({ error: 'Errore del server nel salvataggio dei dati' });
  }
});

module.exports = router;
