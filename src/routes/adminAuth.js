const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');

const router = express.Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de acesso administrativo. Aguarde alguns minutos.' },
});

router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const chave = req.body.chave || '';

    const { rows } = await query("SELECT valor FROM config WHERE chave = 'admin_password_hash'");
    if (rows.length === 0) {
      return res.status(500).json({ erro: 'Chave de administrador ainda não configurada no servidor.' });
    }

    if (!chave || !bcrypt.compareSync(chave, rows[0].valor)) {
      return res.status(401).json({ erro: 'Chave de acesso inválida.' });
    }

    req.session.isAdmin = true;
    res.json({ ok: true });
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

router.get('/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ isAdmin: true });
  }
  res.status(401).json({ erro: 'Não autenticado.' });
});

module.exports = router;
