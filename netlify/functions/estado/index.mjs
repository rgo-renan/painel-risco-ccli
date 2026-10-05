import { getStore } from '@netlify/blobs';
import { mesclar } from './mesclar.mjs';

/* ════════════════════════════════════════════════════════════════
   Estado compartilhado do Painel de Risco de Churn · CCLi

   GET    /api/estado  → devolve o estado atual (ou null)
   PUT    /api/estado  → grava, MESCLANDO com o que já está lá
   DELETE /api/estado  → limpa (usado pelo botão "Limpar dados")

   Por que mesclar no servidor: o painel grava o estado inteiro a
   cada registro. Vários CS trabalhando ao mesmo tempo se
   sobrescreveriam — quem salva por último apagaria o registro de
   quem salvou antes. Aqui a fusão é por aluno, e vence sempre o
   carimbo de hora mais recente de CADA entrada.

   Proteção: se a variável de ambiente PAINEL_CHAVE existir, toda
   requisição precisa trazer o mesmo valor no cabeçalho
   x-painel-chave. Sem a variável, o painel fica aberto a quem
   tiver o link.
   ════════════════════════════════════════════════════════════════ */

const NOME_LOJA = 'ccli-painel-risco';
const CHAVE_BLOB = 'estado';

const json = (corpo, status = 200) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

function autorizado(req) {
  const esperada = Netlify.env.get('PAINEL_CHAVE');
  if (!esperada) return true;
  return (req.headers.get('x-painel-chave') || '') === esperada;
}

function loja() {
  // consistência forte: logo após alguém gravar, os outros já leem o valor novo
  return getStore({ name: NOME_LOJA, consistency: 'strong' });
}

/* Meses arquivados ficam em blobs próprios (arquivo-2026-07), fora do
   estado vivo: o histórico cresce sem engordar o que trafega a cada
   registro do CS. São snapshots congelados, então não há fusão —
   quem arquiva, arquiva por inteiro. */
const PREFIXO_ARQ = 'arquivo-';
const MES_VALIDO = /^\d{4}-\d{2}$/;

export default async (req) => {
  if (!autorizado(req)) return json({ erro: 'chave-invalida' }, 401);

  const store = loja();
  const mes = new URL(req.url).searchParams.get('mes');

  if (mes) {
    if (!MES_VALIDO.test(mes)) return json({ erro: 'mes-invalido' }, 400);
    const chave = PREFIXO_ARQ + mes;

    if (req.method === 'GET') {
      const texto = await store.get(chave, { type: 'text' });
      return json(texto || 'null');
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const corpo = await req.text();
      if (!corpo) return json({ erro: 'corpo-vazio' }, 400);
      try { JSON.parse(corpo); } catch { return json({ erro: 'json-invalido' }, 400); }
      await store.set(chave, corpo);
      return json({ ok: true, mes });
    }
    if (req.method === 'DELETE') {
      await store.delete(chave);
      return json({ ok: true, mes });
    }
    return json({ erro: 'metodo-nao-suportado' }, 405);
  }

  if (req.method === 'GET') {
    // ?lista=1 devolve só os meses arquivados, sem baixar os pacotes
    if (new URL(req.url).searchParams.get('lista')) {
      const { blobs } = await store.list({ prefix: PREFIXO_ARQ });
      return json({ meses: blobs.map(b => b.key.slice(PREFIXO_ARQ.length)).sort() });
    }
    const texto = await store.get(CHAVE_BLOB, { type: 'text' });
    return json(texto || 'null');
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    let recebido;
    try { recebido = await req.json(); }
    catch { return json({ erro: 'json-invalido' }, 400); }

    let guardado = null;
    try {
      const texto = await store.get(CHAVE_BLOB, { type: 'text' });
      if (texto) guardado = JSON.parse(texto);
    } catch { /* estado anterior ilegível — o recebido assume */ }

    const final = mesclar(guardado, recebido);
    await store.set(CHAVE_BLOB, JSON.stringify(final));
    return json(final);
  }

  if (req.method === 'DELETE') {
    await store.delete(CHAVE_BLOB);
    return json({ ok: true });
  }

  return json({ erro: 'metodo-nao-suportado' }, 405);
};

export const config = { path: '/api/estado' };
