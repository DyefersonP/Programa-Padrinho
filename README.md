# 🔥 Programa Padrinho — Ambipar Bombeiros

Plataforma web para acompanhar o desenvolvimento dos bombeiros dentro do Programa Padrinho: cada bombeiro cria sua conta, marca as atividades da Ficha de Desenvolvimento como concluídas, anexa fotos de comprovação, e o líder registra o feedback de cada etapa. O administrador tem uma chave própria e acesso permanente a todos os registros de todos os bombeiros.

Tema visual: neon profissional (ciano, magenta e roxo sobre fundo escuro), com partículas interativas, animações e confete ao concluir 100% da ficha.

**Esta versão roda 100% em serviços gratuitos** (sem precisar de cartão de crédito): o site fica hospedado no [Render](https://render.com), o banco de dados e as fotos ficam guardados no [Supabase](https://supabase.com).

## O que já vem pronto

- Login/cadastro do bombeiro (nome completo + matrícula + senha)
- Checklist com as 29 atividades da Ficha de Desenvolvimento dos Bombeiros (Ambipar) já cadastradas
- Upload de múltiplas fotos por atividade (obrigatório enviar ao menos 1 foto antes de marcar como concluído), guardadas no Supabase Storage
- Feedback do líder por atividade (preenchido pelo administrador)
- Painel administrativo protegido por chave própria, com:
  - Estatísticas gerais (bombeiros, atividades, % de conclusão)
  - Lista e busca de bombeiros com barra de progresso
  - Detalhe completo de cada bombeiro (fotos, datas, feedback)
  - Gerenciamento das atividades do checklist (adicionar, renomear, desativar)
  - Exportação de todos os registros em CSV
- Banco de dados Postgres (Supabase) — permanente, sem depender do disco do servidor
- Sessões seguras (cookies httpOnly), senhas com hash bcrypt, limite de tentativas de login

## Passo a passo: colocando o site no ar de graça

### 1. Criar o banco de dados e o espaço de fotos (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita (pode entrar com GitHub).
2. Clique em **New Project**. Escolha um nome (ex: `programa-padrinho`), crie uma senha para o banco (guarde essa senha) e escolha a região mais próxima (ex: South America).
3. Aguarde o projeto ser criado (leva 1-2 minutos).
4. Vá em **Project Settings → Database → Connection string**. Copie a string no formato **URI**, que se parece com:
   `postgresql://postgres.xxxxxxxx:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
   Troque `[SUA-SENHA]` pela senha que você criou no passo 2. Isso vai virar a variável `DATABASE_URL`.
5. Vá em **Project Settings → API**. Copie:
   - **Project URL** → vira a variável `SUPABASE_URL`
   - **service_role key** (não a "anon/public") → vira a variável `SUPABASE_SERVICE_ROLE_KEY` (essa chave é secreta, nunca compartilhe)
6. Vá em **Storage** (no menu lateral) → **New bucket**. Nome do bucket: `fotos-treinamento`. **Deixe como "Private"** (não marque "Public bucket"). Crie.

### 2. Publicar o site (Render)

1. Acesse [render.com](https://render.com) e crie uma conta gratuita (pode entrar com GitHub).
2. Clique em **New +** → **Web Service**.
3. Conecte sua conta do GitHub e selecione o repositório deste projeto.
4. Configure:
   - **Name**: o nome que aparecer no link (ex: `programa-padrinho`)
   - **Region**: a mais próxima
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Antes de clicar em criar, role até **Environment Variables** e adicione (uma por vez, em "Add Environment Variable"):
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = uma string aleatória longa (gere em https://generate-secret.vercel.app/32)
   - `ADMIN_PASSWORD` = sua chave de administrador (ex: `Ambipar@`)
   - `DATABASE_URL` = a string que você copiou do Supabase no passo 1.4
   - `SUPABASE_URL` = a URL copiada no passo 1.5
   - `SUPABASE_SERVICE_ROLE_KEY` = a chave copiada no passo 1.5
   - `SUPABASE_BUCKET` = `fotos-treinamento`
6. Clique em **Create Web Service**. O Render vai instalar tudo e ligar o site — acompanhe pela aba **Logs**. Quando aparecer `🚒 Programa Padrinho rodando em http://localhost:...`, está pronto.
7. O link do site fica visível no topo da página do serviço no Render (algo como `https://programa-padrinho.onrender.com`).

### Sobre as limitações do plano gratuito

- **Render**: o site "dorme" depois de ~15 minutos sem visitas. A primeira pessoa a acessar depois disso espera uns 30-50 segundos para o site "acordar" — as próximas pessoas acessam normalmente, rápido.
- **Supabase**: o projeto gratuito pausa depois de 7 dias **sem nenhum acesso**. Se isso acontecer, basta entrar em supabase.com, abrir o projeto e clicar em "Restore/Resume" — os dados não são apagados, só fica pausado temporariamente.

Se no futuro o Programa Padrinho crescer e esse "soninho" incomodar, dá para migrar para os planos pagos do Render/Supabase (bem baratos) a qualquer momento, sem perder nenhum dado.

## Rodando localmente (para testar antes de publicar)

Pré-requisitos: [Node.js](https://nodejs.org) versão 18 ou superior, e um banco Postgres (pode ser o mesmo Supabase criado acima).

```bash
cd programa-padrinho
npm install
cp .env.example .env
```

Edite o `.env` preenchendo `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` com os valores do seu Supabase (passo 1 acima), e deixe `NODE_ENV=development` para testar sem HTTPS.

```bash
npm start
```

Acesse `http://localhost:3000`.

## Trocar a chave do administrador depois

A variável `ADMIN_PASSWORD` só é usada na primeira vez que o sistema sobe (para gerar o hash salvo no banco). Para trocar a chave depois, sem perder nenhum dado:

```bash
npm run set-admin-password "NovaChaveForte123!"
```

Rode esse comando com as variáveis de ambiente apontando para o mesmo banco Postgres em uso (ou seja, rode localmente com o `.env` configurado, ou use o terminal do Render/Shell do serviço).

## Estrutura do projeto

```
programa-padrinho/
├── src/
│   ├── server.js              # ponto de entrada
│   ├── db.js                   # conexão Postgres + criação das tabelas + seed das atividades
│   ├── supabaseStorage.js      # upload/URLs assinadas das fotos no Supabase Storage
│   ├── middleware/auth.js      # proteção de rotas (bombeiro / admin)
│   ├── scripts/setAdminPassword.js
│   └── routes/
│       ├── auth.js             # cadastro/login do bombeiro
│       ├── adminAuth.js        # login do administrador (chave)
│       ├── progresso.js        # checklist, fotos, conclusão
│       └── admin.js            # painel administrativo (API)
├── public/                     # frontend (HTML/CSS/JS puro, sem build)
│   ├── index.html              # landing
│   ├── entrar.html             # login/cadastro do bombeiro
│   ├── dashboard.html          # checklist do bombeiro
│   ├── admin-login.html        # login do administrador
│   ├── admin.html              # painel administrativo
│   ├── css/style.css
│   └── js/
├── .env.example
└── package.json
```

## Personalizações comuns

- **Adicionar/editar atividades do checklist**: faça login como administrador → aba "Gerenciar atividades". Não precisa mexer em código.
- **Trocar as cores neon**: edite as variáveis no topo de `public/css/style.css` (`--neon-cyan`, `--neon-magenta`, `--neon-purple`, etc.).
- **Trocar textos/nome do programa**: edite diretamente os arquivos `.html` dentro de `public/`.
- **Limite de tamanho das fotos**: hoje é 8MB por foto e até 10 fotos por envio — ajustável em `src/routes/progresso.js` (`limits: { fileSize, files }`).

## Segurança

- Senhas de bombeiros e a chave de administrador são armazenadas com hash bcrypt (nunca em texto puro).
- Cookies de sessão são `httpOnly` (não acessíveis via JavaScript do navegador) e `secure` em produção (exigem HTTPS).
- O bucket de fotos no Supabase é **privado**: as fotos só podem ser vistas pelo próprio bombeiro dono do registro ou pelo administrador, através de links temporários gerados pelo servidor (expiram em poucos minutos).
- Existe limite de tentativas de login (bombeiro e administrador) para dificultar ataques de força bruta.
- **Recomendação**: troque a `SESSION_SECRET` do `.env.example` por um valor único e aleatório antes de publicar, e não reutilize a senha padrão `Ambipar@` por muito tempo — troque-a com `npm run set-admin-password` assim que o site estiver no ar.
