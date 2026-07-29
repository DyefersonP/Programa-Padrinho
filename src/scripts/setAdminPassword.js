// Script utilitário para trocar a senha do administrador.
// Uso: npm run set-admin-password "NovaSenhaForte123!"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../db');

async function main() {
  const novaSenha = process.argv[2];

  if (!novaSenha || novaSenha.length < 6) {
    console.error('Uso: npm run set-admin-password "NovaSenhaComPeloMenos6Caracteres"');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(novaSenha, 10);
  await query(
    `INSERT INTO config (chave, valor) VALUES ('admin_password_hash', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [hash]
  );

  console.log('✅ Senha do administrador atualizada com sucesso!');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro ao trocar a senha:', err.message);
  process.exit(1);
});
