const express = require('express');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const { query } = require('../db');
const { uploadFoto, gerarUrlAssinada, removerFoto } = require('../supabaseStorage');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato de arquivo não suportado. Envie apenas imagens.'));
  },
});

async function getOrCreateProgresso(userId, atividadeId) {
  let { rows } = await query(
    'SELECT * FROM progresso WHERE user_id = $1 AND atividade_id = $2',
    [userId, atividadeId]
  );
  if (rows.length > 0) return rows[0];

  await query(
    `INSERT INTO progresso (user_id, atividade_id, concluido)
     VALUES ($1, $2, FALSE)
     ON CONFLICT (user_id, atividade_id) DO NOTHING`,
    [userId, atividadeId]
  );
  ({ rows } = await query(
    'SELECT * FROM progresso WHERE user_id = $1 AND atividade_id = $2',
    [userId, atividadeId]
  ));
  return rows[0];
}

async function montarChecklist(userId) {
  const { rows: linhas } = await query(
    `SELECT a.id AS atividade_id, a.nome, a.ordem,
            p.id AS progresso_id, p.concluido, p.data_execucao, p.feedback_lider, p.data_feedback
     FROM atividades a
     LEFT JOIN progresso p ON p.atividade_id = a.id AND p.user_id = $1
     WHERE a.ativo = TRUE
     ORDER BY a.ordem ASC, a.id ASC`,
    [userId]
  );

  const progressoIds = linhas.filter((l) => l.progresso_id).map((l) => l.progresso_id);
  let fotosPorProgresso = new Map();
  if (progressoIds.length > 0) {
    const { rows: fotos } = await query(
      'SELECT id, progresso_id, original_name, uploaded_at FROM fotos WHERE progresso_id = ANY($1::int[]) ORDER BY id ASC',
      [progressoIds]
    );
    fotosPorProgresso = fotos.reduce((mapa, f) => {
      if (!mapa.has(f.progresso_id)) mapa.set(f.progresso_id, []);
      mapa.get(f.progresso_id).push(f);
      return mapa;
    }, new Map());
  }

  return linhas.map((l) => ({
    atividadeId: l.atividade_id,
    nome: l.nome,
    ordem: l.ordem,
    concluido: !!l.concluido,
    dataExecucao: l.data_execucao,
    feedbackLider: l.feedback_lider,
    dataFeedback: l.data_feedback,
    progressoId: l.progresso_id,
    fotos: (fotosPorProgresso.get(l.progresso_id) || []).map((f) => ({
      id: f.id,
      url: `/api/progresso/foto/${f.id}`,
      originalName: f.original_name,
      uploadedAt: f.uploaded_at,
    })),
  }));
}

// Lista o checklist completo do bombeiro logado, com progresso mesclado
router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await montarChecklist(req.session.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar checklist.' });
  }
});

// Upload de uma ou mais fotos de comprovação para uma atividade
router.post('/:atividadeId/fotos', requireAuth, upload.array('fotos', 10), async (req, res) => {
  try {
    const atividadeId = Number(req.params.atividadeId);
    const { rows: atividades } = await query('SELECT * FROM atividades WHERE id = $1 AND ativo = TRUE', [atividadeId]);
    if (atividades.length === 0) {
      return res.status(404).json({ erro: 'Atividade não encontrada.' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ erro: 'Envie ao menos uma foto.' });
    }

    const progresso = await getOrCreateProgresso(req.session.userId, atividadeId);

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const caminho = `${req.session.userId}/${atividadeId}/${randomUUID()}${ext}`;
      await uploadFoto(caminho, file.buffer, file.mimetype);
      await query(
        'INSERT INTO fotos (progresso_id, storage_path, original_name) VALUES ($1, $2, $3)',
        [progresso.id, caminho, file.originalname]
      );
    }

    const checklist = await montarChecklist(req.session.userId);
    res.status(201).json({ ok: true, checklist: checklist.find((a) => a.atividadeId === atividadeId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao enviar foto(s). Tente novamente.' });
  }
});

// Remove uma foto (somente enquanto a atividade não estiver marcada como concluída)
router.delete('/foto/:fotoId', requireAuth, async (req, res) => {
  try {
    const fotoId = Number(req.params.fotoId);
    const { rows } = await query(
      `SELECT fotos.*, progresso.user_id AS owner_id, progresso.concluido AS concluido
       FROM fotos JOIN progresso ON progresso.id = fotos.progresso_id
       WHERE fotos.id = $1`,
      [fotoId]
    );
    const foto = rows[0];

    if (!foto || foto.owner_id !== req.session.userId) {
      return res.status(404).json({ erro: 'Foto não encontrada.' });
    }
    if (foto.concluido) {
      return res.status(400).json({ erro: 'Desmarque a atividade como concluída antes de remover fotos.' });
    }

    await query('DELETE FROM fotos WHERE id = $1', [fotoId]);
    try {
      await removerFoto(foto.storage_path);
    } catch (e) {
      console.error('Falha ao remover arquivo do Storage (registro já removido do banco):', e.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover foto.' });
  }
});

// Redireciona para uma URL assinada e temporária da foto no Supabase Storage
// (somente o dono do progresso ou um administrador podem visualizar)
router.get('/foto/:fotoId', async (req, res) => {
  try {
    const fotoId = Number(req.params.fotoId);
    const { rows } = await query(
      `SELECT fotos.*, progresso.user_id AS owner_id
       FROM fotos JOIN progresso ON progresso.id = fotos.progresso_id
       WHERE fotos.id = $1`,
      [fotoId]
    );
    const foto = rows[0];
    if (!foto) return res.status(404).send('Não encontrado');

    const isOwner = req.session && req.session.userId === foto.owner_id;
    const isAdmin = req.session && req.session.isAdmin;
    if (!isOwner && !isAdmin) {
      return res.status(403).send('Acesso negado');
    }

    const url = await gerarUrlAssinada(foto.storage_path, 300);
    res.redirect(url);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar foto');
  }
});

// Marca/desmarca uma atividade como concluída (exige ao menos 1 foto para concluir)
router.post('/:atividadeId/concluir', requireAuth, async (req, res) => {
  try {
    const atividadeId = Number(req.params.atividadeId);
    const concluido = !!req.body.concluido;

    const { rows: atividades } = await query('SELECT * FROM atividades WHERE id = $1 AND ativo = TRUE', [atividadeId]);
    if (atividades.length === 0) {
      return res.status(404).json({ erro: 'Atividade não encontrada.' });
    }

    const progresso = await getOrCreateProgresso(req.session.userId, atividadeId);

    if (concluido) {
      const { rows: contagem } = await query('SELECT COUNT(*)::int AS n FROM fotos WHERE progresso_id = $1', [progresso.id]);
      if (contagem[0].n === 0) {
        return res.status(400).json({ erro: 'Envie ao menos uma foto de comprovação antes de marcar como concluído.' });
      }
    }

    await query(
      `UPDATE progresso SET concluido = $1, data_execucao = $2, updated_at = NOW() WHERE id = $3`,
      [concluido, concluido ? new Date().toISOString() : null, progresso.id]
    );

    const checklist = await montarChecklist(req.session.userId);
    res.json({ ok: true, checklist: checklist.find((a) => a.atividadeId === atividadeId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar atividade.' });
  }
});

module.exports = { router, montarChecklist };
