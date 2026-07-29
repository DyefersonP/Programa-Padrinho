const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error('[db] ERRO: a variável de ambiente DATABASE_URL não foi configurada.');
  console.error('[db] Configure a string de conexão do seu banco Postgres (ex: Supabase) no .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] Erro inesperado no pool de conexões do Postgres:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

// Atividades padrão a partir da Ficha de Desenvolvimento dos Bombeiros (Ambipar)
const atividadesPadrao = [
  'Combate a incêndio SKILLRESCUE',
  'Resgate em altura SKILLRESCUE',
  'Espaço confinado SKILLRESCUE',
  'Resgate aquático SKILLRESCUE',
  'Incêndio Florestal Equipamentos',
  'Acionamento de Ramal de Emergência PAE',
  'Inspeções de extintores',
  'Listagem de medicamentos (B2)',
  'Instruções de 5S e LAIA',
  'Preenchimento de ART e PTS',
  'Captura de animais',
  'Manejo e remoção de insetos',
  'Captura de animais peçonhentos',
  'Soprador',
  'Motoserra',
  'Serra a disco',
  'Almofada Pneumática',
  'Kit de desencarceramento',
  'KIT Ambiental',
  'Condução de Ambulância',
  'Condução de caminhão',
  'Condução de Caminhonete 4x4',
  'Troca de cilindro de O2',
  'Manuseio da maca de transporte da vítima',
  'Conhecimento Checklist da Ambulância',
  'Rota hospitalar',
  'Balizamento de veículo',
  'Conceito de APH/Ficha de atendimento',
  'Relatório de ocorrência',
];

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nome_completo TEXT NOT NULL,
      matricula TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      lider TEXT,
      tutor TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS atividades (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS progresso (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
      concluido BOOLEAN NOT NULL DEFAULT FALSE,
      data_execucao TIMESTAMPTZ,
      feedback_lider TEXT,
      data_feedback TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, atividade_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS fotos (
      id SERIAL PRIMARY KEY,
      progresso_id INTEGER NOT NULL REFERENCES progresso(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      original_name TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
  `);

  // connect-pg-simple cria a própria tabela "session" automaticamente (createTableIfMissing: true)

  const { rows: countRows } = await query('SELECT COUNT(*)::int AS n FROM atividades');
  if (countRows[0].n === 0) {
    let ordem = 1;
    for (const nome of atividadesPadrao) {
      await query('INSERT INTO atividades (nome, ordem, ativo) VALUES ($1, $2, TRUE)', [nome, ordem]);
      ordem += 1;
    }
    console.log(`[db] ${atividadesPadrao.length} atividades padrão (Ficha Ambipar) cadastradas.`);
  }

  const { rows: adminRows } = await query("SELECT valor FROM config WHERE chave = 'admin_password_hash'");
  if (adminRows.length === 0) {
    const initialPassword = process.env.ADMIN_PASSWORD || 'Ambipar@';
    const hash = bcrypt.hashSync(initialPassword, 10);
    await query("INSERT INTO config (chave, valor) VALUES ('admin_password_hash', $1)", [hash]);
    console.log('[db] Senha inicial do administrador configurada a partir de ADMIN_PASSWORD.');
  }
}

module.exports = { pool, query, initDb };
