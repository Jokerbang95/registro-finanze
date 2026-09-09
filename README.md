# Registro di Cassa — versione con account, database e deploy online

Questa è l'evoluzione "prodotto" dell'app: stesso registro di cassa, investimenti
e patrimonio che già conosci, ma ora con **account utente veri**, **password
cifrate**, **dati salvati su un database online persistente**, e pronta per
essere messa online e usata da qualsiasi dispositivo, telefono incluso.

## Cosa c'è dentro

```
app-full/
├── server/              backend Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── server.js        punto di ingresso, serve API + frontend
│   │   ├── db.js            accesso al database (utenti + dati)
│   │   ├── auth.js          hashing password, sessioni JWT, middleware
│   │   ├── routes-auth.js   /api/auth/register, /login, /logout, /me
│   │   └── routes-data.js   /api/data (lettura/scrittura dati utente)
│   ├── .env.example          modello per le variabili d'ambiente
│   └── package.json
└── public/
    └── index.html         il frontend (la tua app), ora con login/registrazione
```

## Come funziona (in breve)

- **Autenticazione**: email + password. Le password non sono mai salvate in
  chiaro — sono cifrate con bcrypt prima di finire nel database. Al login il
  server rilascia un token di sessione (JWT) in un cookie **httpOnly** (il
  JavaScript del browser non può leggerlo, il che limita il rischio di furto
  del token via script malevoli).
- **Dati**: ogni utente ha un proprio "documento" nel database con tutto lo
  stato dell'app (costi fissi, stipendio, giorni, investimenti, altri conti).
  Il frontend continua a funzionare esattamente come prima — l'unica cosa
  cambiata "sotto il cofano" è che invece di salvare nel browser, ora salva
  sul server, legato al tuo account.
- **Isolamento tra utenti**: il server identifica sempre l'utente dal cookie
  di sessione, mai da un parametro mandato dal client — quindi un utente non
  può in nessun modo leggere o modificare i dati di un altro.
- **Database**: PostgreSQL, non SQLite. La scelta non è casuale: quasi tutti
  gli hosting gratuiti (Render, Railway, Fly.io) azzerano il disco dei
  servizi web a ogni riavvio o redeploy — un database a file singolo (come
  SQLite) andrebbe perso. Postgres gira come servizio separato con storage
  vero e persistente, e diversi provider (Neon, Supabase) lo offrono gratis.

## Avvio in locale

Serve Node.js 18 o superiore, e un database PostgreSQL raggiungibile — anche
uno gratuito online (vedi sotto), non serve installarlo sul tuo computer.

```bash
cd server
npm install
cp .env.example .env
```

Apri `.env` e imposta due cose:

1. **`JWT_SECRET`** — una stringa lunga e casuale. Generane una con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **`DATABASE_URL`** — la stringa di connessione al tuo database Postgres.
   Il modo più veloce per averne uno gratis, senza installare nulla:
   - Vai su **[neon.tech](https://neon.tech)** (o [supabase.com](https://supabase.com))
   - Crea un account gratuito e un nuovo progetto
   - Copia la "Connection string" che ti mostrano (inizia con `postgresql://...`)
   - Incollala come valore di `DATABASE_URL` nel file `.env`

Poi avvia:

```bash
npm start
```

Al primo avvio il server crea da solo le tabelle nel database. Apri
**http://localhost:3000** — vedrai la schermata di accesso.

## Come mettere il prodotto online (deploy)

Ecco il percorso più semplice, interamente gratuito per iniziare, usando
**Neon** per il database e **Render** per far girare il server.

### 1. Database — Neon

1. Vai su [neon.tech](https://neon.tech) e crea un account gratuito.
2. Crea un nuovo progetto (bastano pochi click, nessuna configurazione).
3. Nella dashboard del progetto trovi la "Connection string" — copiala,
   ti servirà tra poco.

### 2. Codice — GitHub

Render fa il deploy leggendo il codice da un repository GitHub.

1. Se non hai un account, creane uno gratuito su [github.com](https://github.com).
2. Crea un nuovo repository (anche privato).
3. Carica dentro la cartella `app-full` (quella con `server/` e `public/`) —
   puoi farlo dal sito di GitHub trascinando i file, oppure con `git` da
   terminale se lo conosci già.

### 3. Hosting — Render

1. Vai su [render.com](https://render.com) e registrati (puoi farlo
   direttamente con l'account GitHub, così sono già collegati).
2. Crea un nuovo **"Web Service"** e seleziona il repository che hai appena
   caricato.
3. Configuralo così:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Nella sezione "Environment Variables" aggiungi:
   - `JWT_SECRET` → una stringa casuale (generala come sopra)
   - `DATABASE_URL` → la connection string di Neon copiata al passo 1
   - `NODE_ENV` → `production`
5. Clicca "Create Web Service". Render installa le dipendenze e avvia il
   server automaticamente: dopo un paio di minuti ti dà un indirizzo tipo
   `https://registro-di-cassa.onrender.com`.

Quell'indirizzo è il tuo sito, raggiungibile da qualunque dispositivo,
telefono compreso — apri quel link da Safari o Chrome sul cellulare, fai
login con lo stesso account, e ritrovi i tuoi dati.

**Nota sul piano gratuito di Render**: dopo 15 minuti senza visite, il
servizio "si addormenta" e il primo caricamento successivo richiede qualche
secondo in più per "svegliarsi" — normale sui piani gratuiti, non è un guasto.
Se in futuro l'uso diventa serio, i piani a pagamento (pochi euro al mese)
eliminano questo comportamento.

## Limiti attuali e prossimi passi naturali

Questa è una base solida ma minima — onesto elenco di cosa manca prima di
avere un prodotto commerciale maturo:

- **Nessun recupero password**: oggi se un utente dimentica la password non
  c'è un flusso di reset. Va aggiunto un invio email con link temporaneo
  (servono un provider email transazionale come Resend o Postmark, e
  un minimo di lavoro lato server).
- **Nessuna verifica email**: chiunque può registrarsi con qualsiasi
  indirizzo, anche non suo. Da aggiungere prima del lancio pubblico.
- **Nessun pagamento**: per vendere abbonamenti serve integrare Stripe
  (checkout + webhook per attivare/disattivare l'accesso in base allo stato
  dell'abbonamento).
- **Dati come blob JSON**: comodo e veloce da far funzionare oggi, ma se in
  futuro vorrai reportistica, storico multi-mese o esportazioni, conviene
  normalizzare in tabelle separate (vedi i commenti in `db.js`).
- **GDPR**: essendo dati finanziari, prima di avere utenti reali servono
  privacy policy, informativa e un modo per l'utente di esportare/cancellare
  i propri dati (anche solo un endpoint `DELETE /api/account` da aggiungere).

Nessuno di questi è urgente per iniziare a validare il prodotto con
utenti reali — ma vale la pena saperli, per non trovarsi sorpresi più avanti.
