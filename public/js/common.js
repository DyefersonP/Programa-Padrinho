// Utilitários compartilhados entre as páginas

async function api(path, options = {}) {
  const opts = {
    method: options.method || 'GET',
    headers: {},
    credentials: 'same-origin',
  };

  if (options.body instanceof FormData) {
    opts.body = options.body;
  } else if (options.body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(options.body);
  }

  const resp = await fetch(path, opts);
  let data = null;
  try {
    data = await resp.json();
  } catch (e) {
    data = null;
  }

  if (!resp.ok) {
    const erro = (data && data.erro) || `Erro (${resp.status})`;
    throw new Error(erro);
  }
  return data;
}

function toast(mensagem, tipo = 'success') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensagem;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

function initParticles() {
  if (typeof tsParticles === 'undefined') return;
  tsParticles.load('tsparticles', {
    fullScreen: { enable: false },
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    particles: {
      number: { value: 46, density: { enable: true, area: 900 } },
      color: { value: ['#00f0ff', '#ff2bd6', '#9b5cff', '#39ff9d'] },
      shape: { type: 'circle' },
      opacity: { value: 0.35, random: true },
      size: { value: { min: 1, max: 3 } },
      links: {
        enable: true,
        distance: 140,
        color: '#3d4aff',
        opacity: 0.15,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.6,
        direction: 'none',
        random: true,
        outModes: { default: 'out' },
      },
    },
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
        resize: true,
      },
      modes: {
        grab: { distance: 160, links: { opacity: 0.35 } },
      },
    },
    detectRetina: true,
  });
}

function ensureParticlesContainer() {
  if (!document.getElementById('tsparticles')) {
    const div = document.createElement('div');
    div.id = 'tsparticles';
    document.body.prepend(div);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureParticlesContainer();
  initParticles();
});

function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] || '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (a + b).toUpperCase();
}

function formatarData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return iso;
  }
}
