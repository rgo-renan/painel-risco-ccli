/* Fusão do estado do painel — lógica pura, sem dependência do Netlify,
   para poder ser testada isoladamente. Vive numa subpasta da função:
   arquivos soltos em netlify/functions viram endpoints separados. */

export const mesmoPainel = (a, b) =>
  !!(a && b && a.baseline && b.baseline && a.baseline.dataClassificacao === b.baseline.dataClassificacao);

/* funde dois mapas "chave do aluno → entrada", pelo carimbo de hora */
export function mesclarMapa(a = {}, b = {}, campoTs) {
  const saida = { ...(a || {}) };
  for (const k of Object.keys(b || {})) {
    const nova = b[k], atual = saida[k];
    if (!atual) { saida[k] = nova; continue; }
    const tn = nova && nova[campoTs] ? Date.parse(nova[campoTs]) : 0;
    const ta = atual && atual[campoTs] ? Date.parse(atual[campoTs]) : 0;
    if (tn > ta) saida[k] = nova;
  }
  return saida;
}

export function mesclar(guardado, recebido) {
  if (!guardado || !guardado.baseline) return recebido;
  if (!recebido || !recebido.baseline) return guardado;
  // fechamento novo substitui o painel inteiro — é o comportamento esperado
  if (!mesmoPainel(guardado, recebido)) return recebido;

  const fundido = { ...recebido };
  fundido.acoesRegistro = mesclarMapa(guardado.acoesRegistro, recebido.acoesRegistro, 'updatedAt');
  fundido.mensagens = mesclarMapa(guardado.mensagens, recebido.mensagens, 'ts');

  const nG = guardado.weekly && guardado.weekly.updates ? guardado.weekly.updates.length : -1;
  const nR = recebido.weekly && recebido.weekly.updates ? recebido.weekly.updates.length : -1;
  if (nG > nR) fundido.weekly = guardado.weekly;

  return fundido;
}
