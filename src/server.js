require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const { pool, initDb } = require('./db');

const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const progressoRoutes = require('./routes/progresso').router;
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'programa-padrinho-troque-este-segredo',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
    },
  })
);

// Cabeçalhos básicos de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/progresso', progressoRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.message && err.message.includes('Formato de arquivo')) {
    return res.status(400).json({ erro: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erro: 'Arquivo muito grande. O limite é 8MB por foto.' });
  }
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

async function start() {
  try {
    await initDb();
  } catch (err) {
    console.error('❌ Não foi possível conectar/inicializar o banco de dados (Postgres):', err.message);
    console.error('   Confira se a variável DATABASE_URL está configurada corretamente no .env');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚒 Programa Padrinho rodando em http://localhost:${PORT}`);
  });
}

start();
