const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
});

function limparTexto(v) {
  return typeof v === 'string' ? v.trim() : '';
}

// Cadastro (primeiro acesso do bombeiro)
router.post('/cadastro', loginLimiter, async (req, res) => {
  try {
    const nomeCompleto = limparTexto(req.body.nomeCompleto);
    const matricula = limparTexto(req.body.matricula);
    const lider = limparTexto(req.body.lider);
    const tutor = limparTexto(req.body.tutor);
    const senha = req.body.senha || '';
    const confirmarSenha = req.body.confirmarSenha || '';

    if (!nomeCompleto || nomeCompleto.length < 3) {
      return res.status(400).json({ erro: 'Informe o nome completo.' });
    }
    if (!matricula) {
      return res.status(400).json({ erro: 'Informe a matrícula.' });
    }
    if (!senha || senha.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
    }
    if (senha !== confirmarSenha) {
      return res.status(400).json({ erro: 'As senhas não coincidem.' });
    }

    const { rows: existentes } = await query('SELECT id FROM users WHERE matricula = $1', [matricula]);
    if (existentes.length > 0) {
      return res.status(409).json({ erro: 'Já existe uma conta cadastrada com essa matrícula. Faça login.' });
    }

    const senhaHash = bcrypt.hashSync(senha, 10);
    const { rows } = await query(
      'INSERT INTO users (nome_completo, matricula, senha_hash, lider, tutor) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [nomeCompleto, matricula, senhaHash, lider || null, tutor || null]
    );

    req.session.userId = rows[0].id;
    req.session.nomeCompleto = nomeCompleto;

    res.status(201).json({
      ok: true,
      usuario: { id: rows[0].id, nomeCompleto, matricula, lider, tutor },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar conta. Tente novamente.' });
  }
});

// Login do bombeiro
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const matricula = limparTexto(req.body.matricula);
    const senha = req.body.senha || '';

    if (!matricula || !senha) {
      return res.status(400).json({ erro: 'Informe matrícula e senha.' });
    }

    const { rows } = await query('SELECT * FROM users WHERE matricula = $1', [matricula]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(senha, user.senha_hash)) {
      return res.status(401).json({ erro: 'Matrícula ou senha inválida.' });
    }

    req.session.userId = user.id;
    req.session.nomeCompleto = user.nome_completo;

    res.json({
      ok: true,
      usuario: {
        id: user.id,
        nomeCompleto: user.nome_completo,
        matricula: user.matricula,
        lider: user.lider,
        tutor: user.tutor,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao entrar. Tente novamente.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }
  try {
    const { rows } = await query(
      'SELECT id, nome_completo, matricula, lider, tutor FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }
    res.json({
      id: user.id,
      nomeCompleto: user.nome_completo,
      matricula: user.matricula,
      lider: user.lider,
      tutor: user.tutor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar usuário.' });
  }
});

module.exports = router;
