let checklistData = [];
let jaComemorou = false;

const checklistEl = document.getElementById('checklist');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

function svgCheck() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="#04050c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
}

async function iniciar() {
  try {
    const user = await api('/api/auth/me');
    document.getElementById('nomeUsuario').textContent = user.nomeCompleto;
    document.getElementById('matriculaUsuario').textContent = `Matrícula ${user.matricula}`;
    document.getElementById('avatarIniciais').textContent = iniciais(user.nomeCompleto);
  } catch (e) {
    window.location.href = '/entrar.html';
    return;
  }
  await carregarChecklist();
}

async function carregarChecklist() {
  try {
    checklistData = await api('/api/progresso');
    renderChecklist();
    renderProgresso();
  } catch (e) {
    checklistEl.innerHTML = `<div class="empty-state">Não foi possível carregar sua ficha. ${e.message}</div>`;
  }
}

function renderProgresso() {
  const total = checklistData.length;
  const concluidas = checklistData.filter((a) => a.concluido).length;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  document.getElementById('progressoResumo').textContent = `${concluidas} de ${total} atividades concluídas`;
  document.getElementById('progressoPct').textContent = `${pct}%`;
  document.getElementById('progressoFill').style.width = `${pct}%`;

  if (pct === 100 && total > 0 && !jaComemorou) {
    jaComemorou = true;
    comemorar();
  }
  if (pct < 100) jaComemorou = false;
}

function comemorar() {
  if (typeof confetti !== 'function') return;
  const duracao = 2200;
  const fim = Date.now() + duracao;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors: ['#00f0ff', '#ff2bd6', '#9b5cff', '#39ff9d'] });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors: ['#00f0ff', '#ff2bd6', '#9b5cff', '#39ff9d'] });
    if (Date.now() < fim) requestAnimationFrame(frame);
  })();
  toast('🎉 Parabéns! Você concluiu toda a sua Ficha de Desenvolvimento!', 'success');
}

function renderChecklist() {
  if (checklistData.length === 0) {
    checklistEl.innerHTML = '<div class="empty-state">Nenhuma atividade cadastrada ainda. Fale com o administrador.</div>';
    return;
  }

  checklistEl.innerHTML = '';
  checklistData
    .sort((a, b) => a.ordem - b.ordem)
    .forEach((atividade) => {
      checklistEl.appendChild(renderCard(atividade));
    });
}

function renderCard(atividade) {
  const card = document.createElement('div');
  card.className = `activity-card ${atividade.concluido ? 'done' : ''}`;
  card.dataset.id = atividade.atividadeId;

  const fotosHtml = atividade.fotos
    .map(
      (f) => `
      <div class="photo-thumb" data-foto-url="${f.url}">
        <img src="${f.url}" alt="Foto de comprovação" loading="lazy" />
        ${!atividade.concluido ? `<div class="del" data-del-foto="${f.id}">&times;</div>` : ''}
      </div>`
    )
    .join('');

  const feedbackHtml = atividade.feedbackLider
    ? `<div class="feedback-box"><b>Feedback do líder:</b> ${escapeHtml(atividade.feedbackLider)}</div>`
    : '';

  card.innerHTML = `
    <div class="activity-head">
      <div>
        <span class="status-badge ${atividade.concluido ? 'status-concluido' : 'status-pendente'}">
          ${atividade.concluido ? '✔ Concluído' : 'Pendente'}
        </span>
        <h4 style="margin-top:8px;">${escapeHtml(atividade.nome)}</h4>
      </div>
      <div class="checkbox ${atividade.concluido ? 'checked' : ''}" data-toggle="${atividade.atividadeId}">
        ${svgCheck()}
      </div>
    </div>
    <div class="activity-meta">${atividade.dataExecucao ? `Realizado em ${formatarData(atividade.dataExecucao)}` : 'Aguardando execução'}</div>
    <div class="photo-row" data-photo-row>${fotosHtml}</div>
    ${!atividade.concluido ? `
      <div class="upload-zone" data-upload-zone="${atividade.atividadeId}">
        📷 Toque para enviar foto(s) de comprovação
      </div>
      <input type="file" accept="image/*" multiple hidden data-file-input="${atividade.atividadeId}" />
    ` : ''}
    ${feedbackHtml}
  `;

  // Toggle concluído
  card.querySelector('[data-toggle]').addEventListener('click', () => toggleConcluido(atividade.atividadeId, !atividade.concluido));

  // Upload zone
  const zone = card.querySelector('[data-upload-zone]');
  const fileInput = card.querySelector('[data-file-input]');
  if (zone && fileInput) {
    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) enviarFotos(atividade.atividadeId, fileInput.files);
    });
    ['dragover', 'dragenter'].forEach((ev) =>
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
      })
    );
    zone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length) enviarFotos(atividade.atividadeId, files);
    });
  }

  // Delete foto
  card.querySelectorAll('[data-del-foto]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removerFoto(btn.dataset.delFoto);
    });
  });

  // Lightbox
  card.querySelectorAll('.photo-thumb img').forEach((img) => {
    img.addEventListener('click', () => abrirLightbox(img.src));
  });

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function toggleConcluido(atividadeId, concluido) {
  try {
    const resultado = await api(`/api/progresso/${atividadeId}/concluir`, {
      method: 'POST',
      body: { concluido },
    });
    atualizarAtividadeLocal(resultado.checklist);
    toast(concluido ? 'Atividade marcada como concluída! ✅' : 'Atividade desmarcada.', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function enviarFotos(atividadeId, files) {
  const formData = new FormData();
  Array.from(files).forEach((f) => formData.append('fotos', f));
  try {
    toast('Enviando foto(s)…', 'success');
    const resultado = await api(`/api/progresso/${atividadeId}/fotos`, {
      method: 'POST',
      body: formData,
    });
    atualizarAtividadeLocal(resultado.checklist);
    toast('Foto(s) enviada(s) com sucesso!', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function removerFoto(fotoId) {
  try {
    await api(`/api/progresso/foto/${fotoId}`, { method: 'DELETE' });
    await carregarChecklist();
    toast('Foto removida.', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function atualizarAtividadeLocal(atividadeAtualizada) {
  const idx = checklistData.findIndex((a) => a.atividadeId === atividadeAtualizada.atividadeId);
  if (idx >= 0) checklistData[idx] = atividadeAtualizada;
  renderChecklist();
  renderProgresso();
}

function abrirLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('show');
}
document.getElementById('lightboxClose').addEventListener('click', () => lightbox.classList.remove('show'));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) lightbox.classList.remove('show');
});

document.getElementById('btnSair').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

iniciar();
