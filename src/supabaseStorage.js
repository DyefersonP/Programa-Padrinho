// Camada de acesso ao Supabase Storage, usada para guardar as fotos de comprovação
// dos bombeiros. O bucket é privado — o acesso às fotos só acontece através de URLs
// assinadas geradas sob demanda pelo servidor, depois de verificar que quem está
// pedindo é o próprio bombeiro dono do registro ou o administrador.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'fotos-treinamento';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[supabaseStorage] ERRO: configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

function garantirCliente() {
  if (!supabase) {
    throw new Error('Supabase Storage não está configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes).');
  }
}

async function uploadFoto(caminho, buffer, mimetype) {
  garantirCliente();
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, buffer, {
    contentType: mimetype,
    upsert: false,
  });
  if (error) throw error;
  return caminho;
}

async function gerarUrlAssinada(caminho, expiraEmSegundos = 300) {
  garantirCliente();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, expiraEmSegundos);
  if (error) throw error;
  return data.signedUrl;
}

async function removerFoto(caminho) {
  garantirCliente();
  const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
  if (error) throw error;
}

module.exports = { uploadFoto, gerarUrlAssinada, removerFoto, BUCKET };
