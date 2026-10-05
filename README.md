# Painel de Risco de Churn · CCLi — versão Netlify

Painel com estado **compartilhado de verdade**: todo o time de CS registra abordagens e salva mensagens no mesmo lugar, sem sobrescrever o trabalho de ninguém.

## O que tem aqui

```
public/index.html               → o painel (abre direto, é ele que o time acessa)
netlify/functions/estado/
  ├─ index.mjs                  → API /api/estado (estado vivo e arquivos mensais em Netlify Blobs)
  └─ mesclar.mjs                → regra de fusão de escritas simultâneas
netlify.toml                    → aponta a pasta publicada e a pasta de funções
package.json                    → dependência @netlify/blobs
```

O painel detecta sozinho onde está rodando:

| Ambiente | O que usa | Selo no rodapé |
|---|---|---|
| Netlify (esta pasta) | `/api/estado` + Netlify Blobs | ☁ Sincronizado no servidor do painel |
| Link publicado do Claude | `window.storage` | ☁ Sincronizado no link publicado |
| Arquivo aberto direto no navegador | só localStorage | 💾 Salvo apenas neste navegador |

O mesmo arquivo funciona nos três — não é preciso manter versões separadas.

---

## Publicar (caminho Git, ~10 minutos)

Arrastar a pasta no Netlify **não serve**: deploy manual não sobe funções. Tem que ser por Git ou pelo CLI.

### 1. Criar o repositório

1. Em <https://github.com/new>, crie um repositório **privado** (ex.: `painel-risco-ccli`).
2. Na tela seguinte, clique em **uploading an existing file**.
3. Arraste para lá o conteúdo desta pasta — `public`, `netlify`, `netlify.toml`, `package.json`, `.gitignore`. O GitHub preserva a estrutura de pastas.
4. **Commit changes**.

### 2. Ligar o Netlify ao repositório

1. No Netlify: **Add new site → Import an existing project → GitHub** e escolha o repositório.
2. Não mexa nas configurações de build — o `netlify.toml` já define tudo (publica `public`, funções em `netlify/functions`).
3. **Deploy**.

Ao final, `https://SEU-SITE.netlify.app` mostra o painel e `https://SEU-SITE.netlify.app/api/estado` responde `null` (ainda sem dados). Se a segunda URL der 404, a pasta de funções não subiu — confira se `netlify/functions/estado/index.mjs` está no repositório.

### 3. Proteger com uma chave de acesso

Sem isso, qualquer pessoa com o link lê e escreve os dados dos alunos.

1. No Netlify: **Site configuration → Environment variables → Add a variable**.
2. Nome `PAINEL_CHAVE`, valor: uma senha compartilhada com o time (ex.: `ccli-cs-2026-agosto`).
3. **Deploys → Trigger deploy → Deploy site** — variáveis novas só valem no deploy seguinte.

Na primeira visita, o painel pede a chave e a guarda naquele navegador. Para trocar depois: altere a variável, publique de novo e avise o time (cada pessoa vai ser questionada uma vez).

### 4. Trazer os dados que já existem

No painel antigo (o publicado no Claude), clique em **Exportar snapshot**. No novo, **Importar snapshot**. Isso traz o histórico de origem, os registros de abordagem e as mensagens salvas.

---

## Alternativa: publicar pelo CLI

Se preferir não usar GitHub:

```bash
npm install -g netlify-cli
cd painel-ccli-netlify
netlify login
netlify deploy --prod
```

Na primeira vez ele pergunta se é um site novo; aceite. Os deploys seguintes repetem só o último comando.

---

## Histórico mensal

A cada fechamento, o painel que está saindo é **arquivado inteiro** — alunos, classificação, origem, movimentação, registros de abordagem e mensagens daquele mês — e passa a aparecer no seletor **"Painel exibido"**, no topo.

O mês arquivado abre **somente leitura**: os selects de resultado ficam desabilitados, os botões de mensagem também, e nada ali grava no servidor. É o registro do que a operação tinha em mãos naquele fechamento.

Cada mês vira um objeto próprio no Blobs (`arquivo-2026-07`), fora do estado vivo. É isso que permite guardar anos de histórico sem engordar o pacote que trafega a cada registro do CS — o estado vivo carrega só um índice com mês, contagens e número de abordagens.

### Reconstruir meses que já passaram

Para montar o histórico de meses anteriores, basta refazer os fechamentos em ordem, do mais antigo para o mais novo. Cada fechamento arquiva o painel anterior.

1. **Exporte um snapshot antes de começar** (botão no card de atualização). É a sua rede de segurança.
2. Rode o fechamento mais antigo primeiro. Como ele é anterior ao painel vigente, o sistema pede confirmação — é esperado.
3. Siga mês a mês até chegar ao atual.

Um painel classificado depois do mês que ele representa é marcado como **reconstruído** no seletor e no aviso, em vez de "arquivado". A distinção importa: a Gestão Geral de hoje já traz cancelamentos que não existiam na época, e os registros de abordagem são os de agora, não os daquele mês. Serve para ver a evolução da carteira em risco, não como prova do que a operação sabia naquele momento.

## Como a sincronização funciona

O painel grava o estado inteiro a cada registro. Com várias pessoas trabalhando ao mesmo tempo, quem salvasse por último apagaria o registro de quem salvou antes. Três camadas evitam isso:

1. **Antes de gravar**, o painel relê a versão do servidor e mescla com a sua.
2. **No servidor**, a função mescla de novo, entrada por entrada: vence o carimbo de hora mais recente de **cada aluno**, não do lote inteiro.
3. **Ao voltar para a aba** (e a cada minuto), o painel puxa o que os colegas registraram.

Um fechamento mensal novo substitui o painel inteiro — é o comportamento esperado, e as mensagens editadas e o mapa de timoneiros atravessam a virada.

O armazenamento usa consistência forte: logo depois de alguém gravar, os outros já leem o valor novo.

## Limites e custo

Netlify Blobs e Functions estão no plano gratuito. O estado do painel gira em torno de 1 MB por fechamento, muito abaixo de qualquer limite. As chamadas acontecem só ao abrir, ao registrar algo e uma vez por minuto por aba aberta.

## Se algo não funcionar

| Sintoma | Causa provável |
|---|---|
| Selo cinza "Salvo apenas neste navegador" | `/api/estado` não respondeu — veja se a função aparece em **Functions** no painel do Netlify |
| `/api/estado` retorna 404 | pasta de funções fora do lugar ou `netlify.toml` não subiu |
| Pede a chave toda hora | o navegador está bloqueando localStorage (janela anônima ou cookies de terceiros) |
| "Nenhum aluno ativo encontrado" ao processar | cabeçalho da Gestão Geral mudou — a mensagem de erro lista os cabeçalhos lidos |
