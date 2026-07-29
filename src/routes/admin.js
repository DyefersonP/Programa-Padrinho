const express = require('express');
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { montarChecklist } = require('./progresso');
const { removerFoto } = require('../supabaseStorage');

const router = express.Router();
router.use(requireAdmin);

async function resumoUsuario(user) {
  const { rows: totalRows } = await query('SELECT COUNT(*)::int AS n FROM atividades WHERE ativo = TRUE');
  const totalAtividades = totalRows[0].n;

  const { rows: concluidasRows } = await query(
    `SELECT COUNT(*)::int AS n FROM progresso
     JOIN atividades ON atividades.id = progresso.atividade_id
     WHERE progresso.user_id = $1 AND progresso.concluido = TRUE AND atividades.ativo = TRUE`,
    [user.id]
  );
  const concluidas = concluidasRows[0].n;

  return {
    id: user.id,
    nomeCompleto: user.nome_completo,
    matricula: user.matricula,
    lider: user.lider,
    tutor: user.tutor,
    createdAt: user.created_at,
    totalAtividades,
    concluidas,
    percentual: totalAtividades > 0 ? Math.round((concluidas / totalAtividades) * 100) : 0,
  };
}

// Lista todos os bombeiros com resumo de progresso
router.get('/bombeiros', async (req, res) => {
  try {
    const { rows: usuarios } = await query('SELECT * FROM users ORDER BY nome_completo ASC');
    const resumos = await Promise.all(usuarios.map(resumoUsuario));
    res.json(resumos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar bombeiros.' });
  }
});

// Estatísticas gerais para o dashboard do admin
router.get('/estatisticas', async (req, res) => {
  try {
    const { rows: totalBombeirosRows } = await query('SELECT COUNT(*)::int AS n FROM users');
    const { rows: totalAtividadesRows } = await query('SELECT COUNT(*)::int AS n FROM atividades WHERE ativo = TRUE');
    const { rows: usuarios } = await query('SELECT * FROM users');
    const resumos = await Promise.all(usuarios.map(resumoUsuario));

    const concluidosTotal = resumos.filter((r) => r.percentual === 100 && r.totalAtividades > 0).length;
    const mediaProgresso = resumos.length > 0
      ? Math.round(resumos.reduce((acc, r) => acc + r.percentual, 0) / resumos.length)
      : 0;

    res.json({
      totalBombeiros: totalBombeirosRows[0].n,
      totalAtividades: totalAtividadesRows[0].n,
      concluidosTotal,
      mediaProgresso,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar estatísticas.' });
  }
});

// Detalhe completo de um bombeiro: dados + checklist com fotos e feedback
router.get('/bombeiros/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ erro: 'Bombeiro não encontrado.' });

    res.json({
      ...(await resumoUsuario(user)),
      checklist: await montarChecklist(id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar bombeiro.' });
  }
});

// Admin define/edita o feedback do líder para uma atividade específica do bombeiro,
// e opcionalmente corrige o status de conclusão / data de execução
router.put('/progresso/:userId/:atividadeId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const atividadeId = Number(req.params.atividadeId);
    const { feedbackLider, concluido, dataExecucao } = req.body;

    let { rows } = await query(
      'SELECT * FROM progresso WHERE user_id = $1 AND atividade_id = $2',
      [userId, atividadeId]
    );
    let progresso = rows[0];

    if (!progresso) {
      const { rows: novo } = await query(
        'INSERT INTO progresso (user_id, atividade_id, concluido) VALUES ($1, $2, FALSE) RETURNING *',
        [userId, atividadeId]
      );
      progresso = novo[0];
    }

    const novoConcluido = typeof concluido === 'boolean' ? concluido : progresso.concluido;
    const novaData = typeof dataExecucao !== 'undefined' ? dataExecucao : progresso.data_execucao;
    const novoFeedback = typeof feedbackLider === 'string' ? feedbackLider : null;

    await query(
      `UPDATE progresso
       SET feedback_lider = COALESCE($1, feedback_lider),
           data_feedback = CASE WHEN $1::text IS NOT NULL THEN NOW() ELSE data_feedback END,
           concluido = $2,
           data_execucao = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [novoFeedback, novoConcluido, novaData, progresso.id]
    );

    const checklist = await montarChecklist(userId);
    res.json({ ok: true, checklist: checklist.find((a) => a.atividadeId === atividadeId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar feedback.' });
  }
});

// Remove um bombeiro (e todo o seu histórico, incluindo fotos no Storage) — usar com cautela
router.delete('/bombeiros/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows: fotos } = await query(
      `SELECT fotos.storage_path FROM fotos
       JOIN progresso ON progresso.id = fotos.progresso_id
       WHERE progresso.user_id = $1`,
      [id]
    );
    for (const f of fotos) {
      try {
        await removerFoto(f.storage_path);
      } catch (e) {
        console.error('Falha ao remover arquivo do Storage:', e.message);
      }
    }
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover bombeiro.' });
  }
});

// --- Gestão das atividades do checklist ---

router.get('/atividades', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM atividades ORDER BY ordem ASC, id ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar atividades.' });
  }
});

router.post('/atividades', async (req, res) => {
  try {
    const nome = (req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da atividade.' });
    const { rows: maxRows } = await query('SELECT COALESCE(MAX(ordem), 0) AS m FROM atividades');
    const novaOrdem = Number(maxRows[0].m) + 1;
    const { rows } = await query(
      'INSERT INTO atividades (nome, ordem, ativo) VALUES ($1, $2, TRUE) RETURNING *',
      [nome, novaOrdem]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao adicionar atividade.' });
  }
});

router.put('/atividades/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM atividades WHERE id = $1', [id]);
    const atividade = rows[0];
    if (!atividade) return res.status(404).json({ erro: 'Atividade não encontrada.' });

    const nome = typeof req.body.nome === 'string' && req.body.nome.trim() ? req.body.nome.trim() : atividade.nome;
    const ordem = typeof req.body.ordem === 'number' ? req.body.ordem : atividade.ordem;
    const ativo = typeof req.body.ativo === 'boolean' ? req.body.ativo : atividade.ativo;

    const { rows: atualizado } = await query(
      'UPDATE atividades SET nome = $1, ordem = $2, ativo = $3 WHERE id = $4 RETURNING *',
      [nome, ordem, ativo, id]
    );
    res.json(atualizado[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar atividade.' });
  }
});

// "Remove" a atividade (soft delete, preserva histórico de quem já tinha progresso registrado)
router.delete('/atividades/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query('UPDATE atividades SET ativo = FALSE WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao desativar atividade.' });
  }
});

// Exporta todos os registros de progresso em CSV
router.get('/export.csv', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT users.nome_completo, users.matricula, users.lider, users.tutor,
              atividades.nome AS atividade, progresso.concluido, progresso.data_execucao,
              progresso.feedback_lider, progresso.data_feedback
       FROM users
       CROSS JOIN atividades
       LEFT JOIN progresso ON progresso.user_id = users.id AND progresso.atividade_id = atividades.id
       WHERE atividades.ativo = TRUE
       ORDER BY users.nome_completo ASC, atividades.ordem ASC`
    );

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };

    const formatarData = (v) => {
      if (!v) return '';
      const d = v instanceof Date ? v : new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };

    const header = ['Nome Completo', 'Matrícula', 'Líder', 'Tutor', 'Atividade', 'Concluído', 'Data Execução', 'Feedback do Líder', 'Data Feedback'];
    const linhas = rows.map((r) =>
      [
        r.nome_completo,
        r.matricula,
        r.lider,
        r.tutor,
        r.atividade,
        r.concluido ? 'SIM' : 'NÃO',
        formatarData(r.data_execucao),
        r.feedback_lider,
        formatarData(r.data_feedback),
      ]
        .map(escape)
        .join(';')
    );

    const csv = '﻿' + [header.map(escape).join(';'), ...linhas].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="programa-padrinho-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao exportar CSV.' });
  }
});

module.exports = router;
