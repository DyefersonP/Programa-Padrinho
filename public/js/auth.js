const tabLogin = document.getElementById('tabLogin');
const tabCadastro = document.getElementById('tabCadastro');
const formLogin = document.getElementById('formLogin');
const formCadastro = document.getElementById('formCadastro');
const alertErro = document.getElementById('alertErro');
const alertSucesso = document.getElementById('alertSucesso');

function esconderAlertas() {
  alertErro.classList.remove('show');
  alertSucesso.classList.remove('show');
}

function mostrarErro(msg) {
  esconderAlertas();
  alertErro.textContent = msg;
  alertErro.classList.add('show');
}

function mostrarSucesso(msg) {
  esconderAlertas();
  alertSucesso.textContent = msg;
  alertSucesso.classList.add('show');
}

function ativarAba(qual) {
  esconderAlertas();
  if (qual === 'cadastro') {
    tabCadastro.classList.add('active');
    tabLogin.classList.remove('active');
    formCadastro.classList.add('active');
    formLogin.classList.remove('active');
  } else {
    tabLogin.classList.add('active');
    tabCadastro.classList.remove('active');
    formLogin.classList.add('active');
    formCadastro.classList.remove('active');
  }
}

tabLogin.addEventListener('click', () => ativarAba('login'));
tabCadastro.addEventListener('click', () => ativarAba('cadastro'));

const params = new URLSearchParams(window.location.search);
ativarAba(params.get('cadastro') ? 'cadastro' : 'login');

function setLoading(btn, loading) {
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
  } else if (btn.dataset.originalHtml) {
    btn.innerHTML = btn.dataset.originalHtml;
  }
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  esconderAlertas();
  const btn = document.getElementById('btnLogin');
  setLoading(btn, true);
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: {
        matricula: document.getElementById('loginMatricula').value.trim(),
        senha: document.getElementById('loginSenha').value,
      },
    });
    window.location.href = '/dashboard.html';
  } catch (err) {
    mostrarErro(err.message);
  } finally {
    setLoading(btn, false);
  }
});

formCadastro.addEventListener('submit', async (e) => {
  e.preventDefault();
  esconderAlertas();
  const btn = document.getElementById('btnCadastro');
  setLoading(btn, true);
  try {
    await api('/api/auth/cadastro', {
      method: 'POST',
      body: {
        nomeCompleto: document.getElementById('cadNome').value.trim(),
        matricula: document.getElementById('cadMatricula').value.trim(),
        lider: document.getElementById('cadLider').value.trim(),
        tutor: document.getElementById('cadTutor').value.trim(),
        senha: document.getElementById('cadSenha').value,
        confirmarSenha: document.getElementById('cadConfirmarSenha').value,
      },
    });
    mostrarSucesso('Conta criada com sucesso! Redirecionando…');
    setTimeout(() => (window.location.href = '/dashboard.html'), 700);
  } catch (err) {
    mostrarErro(err.message);
  } finally {
    setLoading(btn, false);
  }
});
