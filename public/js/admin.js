let bombeiros = [];
let atividades = [];

const bombeiroGrid = document.getElementById('bombeiroGrid');
const viewBombeiros = document.getElementById('viewBombeiros');
const viewAtividades = document.getElementById('viewAtividades');
const tabBombeiros = document.getElementById('tabBombeiros');
const tabAtividades = document.getElementById('tabAtividades');
const modal = document.getElementById('modalBombeiro');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

async function iniciar() {
  try {
    await api('/api/admin/auth/me');
  } catch (e) {
    window.location.href = '/admin-login.html';
    return;
  }
  await Promise.all([carregarEstatisticas(), carregarBombeiros()]);
}

async function carregarEstatisticas() {
  try {
    const stats = await api('/api/admin/estatisticas');
    document.getElementById('statTotalBombeiros').textContent = stats.totalBombeiros;
    document.getElementById('statTotalAtividades').textContent = stats.totalAtividades;
    document.getElementById('statConcluidos').textContent = stats.concluidosTotal;
    document.getElementById('statMedia').textContent = `${stats.mediaProgresso}%`;
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function carregarBombeiros() {
  try {
    bombeiros = await api('/api/admin/bombeiros');
    renderBombeiros();
  } catch (e) {
    bombeiroGrid.innerHTML = `<div class="empty-state">${e.message}</div>`;
  }
}

function renderBombeiros() {
  const termo = document.getElementById('buscaBombeiro').value.trim().toLowerCase();
  const filtrados = bombeiros.filter(
    (b) => b.nomeCompleto.toLowerCase().includes(termo) || b.matricula.toLowerCase().includes(termo)
  );

  if (filtrados.length === 0) {
    bombeiroGrid.innerHTML = '<div class="empty-state">Nenhum bombeiro encontrado.</div>';
    return;
  }

  bombeiroGrid.innerHTML = '';
  filtrados
    .sort((a, b) => b.percentual - a.percentual)
    .forEach((b) => {
      const card = document.createElement('div');
      card.className = 'bombeiro-card';
      card.innerHTML = `
        <h4>${escapeHtml(b.nomeCompleto)}</h4>
        <div class="matricula">Matrícula ${escapeHtml(b.matricula)}${b.lider ? ` · Líder: ${escapeHtml(b.lider)}` : ''}</div>
        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${b.percentual}%;"></div></div>
        <div class="pct-row"><span>${b.concluidas}/${b.totalAtividades} atividades</span><b>${b.percentual}%</b></div>
      `;
      card.addEventListener('click', () => abrirDetalheBombeiro(b.id));
      bombeiroGrid.appendChild(card);
    });
}

document.getElementById('buscaBombeiro').addEventListener('input', renderBombeiros);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ---------- Modal detalhe ----------

async function abrirDetalheBombeiro(id) {
  modal.classList.add('show');
  document.getElementById('modalNome').textContent = 'Carregando…';
  document.getElementById('modalChecklist').innerHTML = '';
  try {
    const detalhe = await api(`/api/admin/bombeiros/${id}`);
    renderDetalhe(detalhe);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderDetalhe(b) {
  document.getElementById('modalNome').textContent = b.nomeCompleto;
  document.getElementById('modalInfo').textContent =
    `Matrícula ${b.matricula}${b.lider ? ' · Líder: ' + b.lider : ''}${b.tutor ? ' · Tutor: ' + b.tutor : ''} · Cadastrado em ${formatarData(b.createdAt)}`;
  document.getElementById('modalProgressoFill').style.width = `${b.percentual}%`;
  document.getElementById('modalProgressoTexto').textContent = `${b.concluidas} de ${b.totalAtividades} atividades concluídas (${b.percentual}%)`;

  const container = document.getElementById('modalChecklist');
  container.innerHTML = '';

  b.checklist
    .sort((a, c) => a.ordem - c.ordem)
    .forEach((atv) => {
      const card = document.createElement('div');
      card.className = `activity-card ${atv.concluido ? 'done' : ''}`;
      card.style.marginBottom = '14px';

      const fotosHtml = atv.fotos
        .map((f) => `<div class="photo-thumb" data-foto-url="${f.url}"><img src="${f.url}" loading="lazy" /></div>`)
        .join('');

      card.innerHTML = `
        <div class="activity-head">
          <div>
            <span class="status-badge ${atv.concluido ? 'status-concluido' : 'status-pendente'}">${atv.concluido ? '✔ Concluído' : 'Pendente'}</span>
            <h4 style="margin-top:8px;">${escapeHtml(atv.nome)}</h4>
          </div>
        </div>
        <div class="activity-meta">${atv.dataExecucao ? `Realizado em ${formatarData(atv.dataExecucao)}` : 'Ainda não realizado'}</div>
        <div class="photo-row">${fotosHtml || '<span style="color:var(--text-2); font-size:0.78rem;">Sem fotos enviadas</span>'}</div>
        <div class="field" style="margin-bottom:0;">
          <label>Feedback do líder</label>
          <textarea rows="2" data-feedback-input placeholder="Escreva o feedback sobre esta atividade…">${atv.feedbackLider || ''}</textarea>
        </div>
        <div class="activity-actions">
          <button class="btn btn-primary btn-sm" data-salvar-feedback="${atv.atividadeId}">Salvar feedback</button>
        </div>
      `;

      card.querySelector('[data-salvar-feedback]').addEventListener('click', async (e) => {
        const textarea = card.querySelector('[data-feedback-input]');
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await api(`/api/admin/progresso/${b.id}/${atv.atividadeId}`, {
            method: 'PUT',
            body: { feedbackLider: textarea.value },
          });
          toast('Feedback salvo!', 'success');
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });

      card.querySelectorAll('.photo-thumb img').forEach((img) => {
        img.addEventListener('click', () => {
          lightboxImg.src = img.src;
          lightbox.classList.add('show');
        });
      });

      container.appendChild(card);
    });
}

document.getElementById('modalFechar').addEventListener('click', () => modal.classList.remove('show'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
document.getElementById('lightboxClose').addEventListener('click', () => lightbox.classList.remove('show'));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.classList.remove('show'); });

// ---------- Tabs ----------

function ativarTab(qual) {
  if (qual === 'atividades') {
    viewAtividades.style.display = 'block';
    viewBombeiros.style.display = 'none';
    tabAtividades.className = 'btn btn-outline btn-sm';
    tabBombeiros.className = 'btn btn-ghost btn-sm';
    carregarAtividades();
  } else {
    viewAtividades.style.display = 'none';
    viewBombeiros.style.display = 'block';
    tabBombeiros.className = 'btn btn-outline btn-sm';
    tabAtividades.className = 'btn btn-ghost btn-sm';
  }
}
tabBombeiros.addEventListener('click', () => ativarTab('bombeiros'));
tabAtividades.addEventListener('click', () => ativarTab('atividades'));

// ---------- Gerenciar atividades ----------

async function carregarAtividades() {
  try {
    atividades = await api('/api/admin/atividades');
    renderAtividades();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderAtividades() {
  const lista = document.getElementById('listaAtividades');
  lista.innerHTML = '';
  atividades
    .sort((a, b) => a.ordem - b.ordem)
    .forEach((a) => {
      const row = document.createElement('div');
      row.className = `atividade-row ${a.ativo ? '' : 'inactive'}`;
      row.innerHTML = `
        <input type="text" value="${escapeHtml(a.nome)}" data-nome-atividade="${a.id}" />
        <button class="btn btn-ghost btn-sm" data-salvar-atividade="${a.id}">Salvar</button>
        <button class="btn ${a.ativo ? 'btn-outline' : 'btn-primary'} btn-sm" data-toggle-atividade="${a.id}">${a.ativo ? 'Desativar' : 'Reativar'}</button>
      `;
      row.querySelector('[data-salvar-atividade]').addEventListener('click', async () => {
        const nome = row.querySelector('[data-nome-atividade]').value.trim();
        if (!nome) return toast('Informe um nome válido.', 'error');
        try {
          await api(`/api/admin/atividades/${a.id}`, { method: 'PUT', body: { nome } });
          toast('Atividade atualizada!', 'success');
          carregarAtividades();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
      row.querySelector('[data-toggle-atividade]').addEventListener('click', async () => {
        try {
          if (a.ativo) {
            await api(`/api/admin/atividades/${a.id}`, { method: 'DELETE' });
          } else {
            await api(`/api/admin/atividades/${a.id}`, { method: 'PUT', body: { ativo: true } });
          }
          carregarAtividades();
          carregarEstatisticas();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
      lista.appendChild(row);
    });
}

document.getElementById('btnAddAtividade').addEventListener('click', async () => {
  const input = document.getElementById('novaAtividadeNome');
  const nome = input.value.trim();
  if (!nome) return toast('Informe o nome da atividade.', 'error');
  try {
    await api('/api/admin/atividades', { method: 'POST', body: { nome } });
    input.value = '';
    toast('Atividade adicionada!', 'success');
    carregarAtividades();
    carregarEstatisticas();
  } catch (e) {
    toast(e.message, 'error');
  }
});

document.getElementById('btnSairAdmin').addEventListener('click', async () => {
  await api('/api/admin/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

iniciar();
