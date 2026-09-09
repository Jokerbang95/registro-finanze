// auth.js
// Logica di autenticazione: hashing password, emissione/verifica JWT,
// middleware Express per proteggere le rotte.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if(!JWT_SECRET){
  // Non partire mai in produzione senza un secret esplicito: se manca,
  // meglio fallire rumorosamente ora che avere sessioni deboli/prevedibili.
  throw new Error('JWT_SECRET mancante: impostalo nel file .env (vedi .env.example)');
}

const COOKIE_NAME = 'session';
const TOKEN_TTL = '30d';

async function hashPassword(plain){
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
}

async function verifyPassword(plain, hash){
  return bcrypt.compare(plain, hash);
}

function signToken(user){
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token){
  try{
    return jwt.verify(token, JWT_SECRET);
  }catch(e){
    return null;
  }
}

function setSessionCookie(res, token){
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,                                   // il JS del browser non può leggerlo: mitiga furto token via XSS
    secure: process.env.NODE_ENV === 'production',     // solo HTTPS in produzione
    sameSite: 'lax',                                   // protezione base da CSRF sulle richieste cross-site
    maxAge: 30 * 24 * 60 * 60 * 1000,                  // 30 giorni, coerente con TOKEN_TTL
    path: '/',
  });
}

function clearSessionCookie(res){
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Middleware: richiede una sessione valida, altrimenti risponde 401.
function requireAuth(req, res, next){
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if(!token) return res.status(401).json({ error: 'Non autenticato' });
  const payload = verifyToken(token);
  if(!payload) return res.status(401).json({ error: 'Sessione non valida o scaduta' });
  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
};
