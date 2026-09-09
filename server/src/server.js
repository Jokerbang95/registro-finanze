// server.js
// Punto di ingresso dell'app. Serve sia le API (/api/...) sia il frontend
// statico (/public), come un unico servizio deployabile: niente CORS da
// configurare, niente due hosting separati da tenere sincronizzati.

require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const authRoutes = require('./routes-auth');
const dataRoutes = require('./routes-data');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

app.disable('x-powered-by'); // non annunciare la tecnologia usata a chi scansiona l'app

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

// Healthcheck: utile per i provider di hosting (Render/Railway/Fly.io) che
// controllano periodicamente se il servizio è vivo prima di instradare traffico.
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(PUBLIC_DIR));

// Qualsiasi altra rotta GET non-API serve l'app (utile se in futuro si
// aggiungono più pagine/route lato client).
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Crea le tabelle nel database (se non esistono già) prima di accettare
// traffico: così al primo avvio su un database vuoto tutto funziona subito,
// senza bisogno di eseguire migrazioni a mano.
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server avviato su http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Impossibile inizializzare il database:', err.message);
    process.exit(1);
  });
