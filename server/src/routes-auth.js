// routes-auth.js
// Endpoint: /api/auth/register, /api/auth/login, /api/auth/logout, /api/auth/me

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const {
  hashPassword, verifyPassword, signToken,
  setSessionCookie, clearSessionCookie, requireAuth,
} = require('./auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limita i tentativi di login/registrazione per IP: mitiga il brute-force
// sulle password senza bisogno di infrastruttura aggiuntiva.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi. Riprova tra qualche minuto.' },
});

function validateCredentials(email, password){
  if(typeof email !== 'string' || !EMAIL_RE.test(email.trim())){
    return 'Email non valida';
  }
  if(typeof password !== 'string' || password.length < 8){
    return 'La password deve avere almeno 8 caratteri';
  }
  return null;
}

router.post('/register', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const validationError = validateCredentials(email, password);
  if(validationError) return res.status(400).json({ error: validationError });

  const existing = await db.getUserByEmail(email);
  if(existing) return res.status(409).json({ error: 'Esiste già un account con questa email' });

  const passwordHash = await hashPassword(password);
  const user = await db.createUser(email, passwordHash);

  const token = signToken(user);
  setSessionCookie(res, token);
  res.status(201).json({ email: user.email });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if(typeof email !== 'string' || typeof password !== 'string'){
    return res.status(400).json({ error: 'Email e password sono richieste' });
  }

  const user = await db.getUserByEmail(email);
  // Messaggio identico per email inesistente o password errata:
  // non dare a un attaccante informazioni su quali email sono registrate.
  const genericError = { error: 'Email o password non corretti' };
  if(!user) return res.status(401).json(genericError);

  const ok = await verifyPassword(password, user.password_hash);
  if(!ok) return res.status(401).json(genericError);

  const token = signToken(user);
  setSessionCookie(res, token);
  res.json({ email: user.email });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ email: req.userEmail });
});

module.exports = router;
