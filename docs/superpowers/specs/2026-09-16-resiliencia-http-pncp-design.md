# Resiliência HTTP dos nodes PNCP / Dados Abertos

**Data:** 2026-09-16
**Status:** Aprovado, aguardando plano de implementação

## Problema

Workflows quebram com frequência porque o servidor do PNCP (`pncp.gov.br/api/consulta`)
é lento e instável. O erro observado em produção:

```
Gateway timed out - perhaps try again later?
NodeOperationError: at ExecuteContext.execute (nodes/Pncp/Pncp.node.ts:343:11)
n8n 2.39.5 (self-hosted), n8n-nodes-aspone.pncp v1
```

O node não possui nenhuma camada de resiliência própria. Pontos de falha no código atual:

| Local | Situação |
| --- | --- |
| `Pncp.node.ts:68-74` | `options` não define `timeout`; usa o default do n8n (300s). |
| `Pncp.node.ts:274`, `:308` | Chamada HTTP única, sem retry. Qualquer 504/502/`ECONNRESET` derruba a execução. |
| `Pncp.node.ts:272-295` | No modo `returnAll`, falha na página 7 de 10 descarta as 6 páginas já baixadas. |
| `Pncp.node.ts:294` | Pausa fixa de 200ms entre páginas, sem jitter e sem reação a `429`/`Retry-After`. |
| `Pncp.node.ts:46-50` | `getCidades` chama a API do IBGE sem timeout, sem retry e sem cache. |
| `Pncp.node.ts:70-72` | Apenas `Content-Type`. Sem `Accept` e sem `User-Agent` identificável. |

A única resiliência disponível hoje é o "Retry On Fail" do n8n, que reexecuta o node
inteiro. No modo `returnAll` isso significa refazer a paginação desde a página 1 — o
mecanismo mais caro e menos eficaz para falhas transitórias de gateway.

Node types não conseguem definir defaults de retry: `retryOnFail`, `maxTries` e
`waitBetweenTries` existem em `INode` (a instância no workflow), não em
`INodeTypeDescription`. Verificado em `node_modules/n8n-workflow/dist/esm/interfaces.d.ts:801-803`.
Retry interno é, portanto, a única via.

## Decisões tomadas

1. **Falha parcial na paginação devolve dados parciais com flag**, em vez de abortar tudo.
2. **Configuração de retry vive na credencial `pncpApi`**, valendo para todos os workflows
   que a usam.
3. **Escopo:** node PNCP, `loadOptions` de cidades (IBGE) e node Dados Abertos.
4. **Abordagem:** módulo de transporte compartilhado com retry. O `DadosAbertosNode`
   permanece declarativo e recebe apenas o que a API declarativa do n8n permite.

## Arquitetura

### Credencial `pncpApi`

`credentials/PncpApi.credentials.ts` mantém `baseUrl` (hidden) e ganha cinco campos:

| Campo | Rótulo | Default | Faixa |
| --- | --- | --- | --- |
| `timeoutMs` | Timeout Por Requisição (Ms) | `60000` | 5.000–300.000 |
| `maxTentativas` | Máximo De Tentativas | `4` | 1–10 |
| `backoffInicialMs` | Backoff Inicial (Ms) | `1000` | 0–30.000 |
| `backoffMaxMs` | Backoff Máximo (Ms) | `16000` | 0–120.000 |
| `delayEntrePaginasMs` | Intervalo Entre Páginas (Ms) | `200` | 0–10.000 |

`maxTentativas` conta a tentativa inicial: `4` significa 1 tentativa + 3 retries.

Os dois campos de backoff aceitam `0`, o que significa "retenta sem esperar". É uma
escolha agressiva e não recomendada contra o PNCP, mas é um valor válido, e manter o piso
em zero torna a regra de *clamp* uniforme: `undefined` usa o default, qualquer número
dentro da faixa é respeitado como está.

Credenciais já salvas não possuem esses campos e retornam `undefined` em
`getCredentials`. `lerRetryConfig()` aplica o default e faz *clamp* na faixa válida, o
que torna a mudança retrocompatível sem migração.

### Módulo de transporte

Novo diretório `nodes/shared/transport/`, sem dependência de `n8n-workflow`. Recebe uma
closure com a operação e uma função `dormir` injetável, o que mantém os testes
instantâneos e determinísticos.

```
nodes/shared/transport/
├── types.ts      RetryConfig
├── config.ts     lerRetryConfig, PERFIL_IBGE
├── retry.ts      classificarErro, extrairRetryAfterMs, calcularEspera
├── executor.ts   comRetry
└── index.ts      re-exports
```

#### `types.ts`

```ts
export interface RetryConfig {
  timeoutMs: number;
  maxTentativas: number;
  backoffInicialMs: number;
  backoffMaxMs: number;
}
```

#### `retry.ts`

```ts
export function classificarErro(erro: unknown): 'retryavel' | 'fatal';
export function extrairRetryAfterMs(erro: unknown): number | undefined;
export function calcularEspera(
  tentativa: number,
  cfg: RetryConfig,
  retryAfterMs?: number,
): number;
```

**Retryável** — status `408`, `425`, `429`, `500`, `502`, `503`, `504`; códigos de rede
`ECONNRESET`, `ETIMEDOUT`, `ESOCKETTIMEDOUT`, `EAI_AGAIN`, `EPIPE`; e erro sem status nem
código reconhecível (falha de socket genérica).

**Fatal** — `400`, `401`, `403`, `404`, `422` e demais 4xx fora da lista acima. Falha
imediatamente, sem consumir tentativas: repetir um CNPJ inválido não muda o resultado.

O status é lido de `erro.response.statusCode` (formato do helper do n8n), com fallback
para `erro.statusCode` e `erro.response.status`.

**Espera** — *full jitter*:

```
teto  = min(backoffMaxMs, backoffInicialMs * 2 ** (tentativa - 1))
espera = Math.random() * teto
```

O jitter não é cosmético: sem ele, todos os workflows que falharem no mesmo minuto
retentam no mesmo instante e mantêm o gateway derrubado.

Quando `retryAfterMs` está presente, ele substitui o valor calculado, limitado a
`backoffMaxMs`. `extrairRetryAfterMs` aceita as duas formas do header `Retry-After`:
segundos (`"120"`) e HTTP-date (`"Wed, 16 Sep 2026 08:10:00 GMT"`), retornando
`undefined` quando ausente ou não-parseável.

#### `executor.ts`

```ts
export async function comRetry<T>(
  operacao: () => Promise<T>,
  cfg: RetryConfig,
  dormir?: (ms: number) => Promise<void>,
): Promise<T>;
```

Executa `operacao`. Em erro fatal, relança de imediato. Em erro retryável, dorme
`calcularEspera(...)` e repete, até `maxTentativas`. Esgotadas as tentativas, relança o
último erro com a propriedade `tentativas` anexada, para que o chamador reporte quantas
foram gastas. O parâmetro `dormir` tem default de `setTimeout` promisificado e existe
para os testes injetarem uma implementação sem espera real.

#### `config.ts`

```ts
export function lerRetryConfig(credentials: ICredentialDataDecryptedObject): RetryConfig;
export const PERFIL_IBGE: RetryConfig;
export const DELAY_PAGINAS_PADRAO_MS = 200;
export const VERSAO = '0.1.3';
```

`lerRetryConfig` lê os campos da credencial, aplica defaults e faz *clamp*.
`PERFIL_IBGE` é fixo: `{ timeoutMs: 15000, maxTentativas: 3, backoffInicialMs: 500, backoffMaxMs: 4000 }`.
`VERSAO` é um literal mantido em sincronia com `package.json` — importar o `package.json`
acoplaria o código ao layout do `dist`, onde ele é copiado para a raiz e não para junto
do módulo.

### `Pncp.node.ts`

**Requisição.** `options` passa a incluir:

```ts
{
  baseURL: baseUrl,
  method: 'GET',
  timeout: cfg.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': `n8n-nodes-aspone/${VERSAO}`,
  },
}
```

`VERSAO` vem de um `const` no módulo compartilhado, não de `require('package.json')`, para
não depender do layout do `dist`.

O `User-Agent` identificável permite que a equipe do PNCP distinga esse tráfego, o que
importa caso passem a aplicar rate limiting por cliente.

**Requisição única.** Envolta em `comRetry`.

**Paginação (`returnAll`).** Cada página é envolta em `comRetry`. Regras:

- Falha na página 1 aborta a operação e lança o erro. Sem `totalPaginas` não há como
  continuar, e devolver uma lista vazia mascararia a falha.
- Falha em página do meio registra o número em `paginasComErro` e segue para a próxima.
- Três páginas consecutivas com falha acionam *circuit break*: interrompe o laço e
  devolve o parcial. O servidor está fora; insistir só piora.
- O intervalo entre páginas é jitterado: `delayEntrePaginasMs * (0.5 + Math.random())`.

**Saída do `returnAll`.** Ganha dois campos, sem remover nenhum existente:

```ts
{
  data,
  totalRegistros,
  totalPaginas,
  paginasBuscadas,
  limitePaginasAtingido,
  paginasComErro: number[],   // novo
  completo: boolean,          // novo — false se paginasComErro não estiver vazio
}
```

**Erro.** O `errorPayload` atual é preservado e ganha `tentativas`:

```ts
{ success: false, statusCode, message, serverResponse, tentativas }
```

Continua sendo lançado como `NodeOperationError`. Trocar por `NodeApiError` seria mais
correto semanticamente, mas mudaria a mensagem exibida ao usuário sem ganho prático.

### `getCidades` (IBGE)

Contexto diferente do `execute`: é um dropdown do editor com o usuário esperando.

- Usa `PERFIL_IBGE` (3 tentativas, timeout 15s, backoff 500ms→4s), não a credencial.
  Um timeout de 60s travando um dropdown é péssima experiência.
- Cache em memória no escopo do módulo: `Map<string, INodePropertyOptions[]>` com chave
  na UF. A lista de municípios do IBGE é estática; hoje cada abertura do dropdown refaz a
  chamada. O cache vive enquanto o processo do n8n viver, sem invalidação.
- Esgotadas as tentativas, lança erro com mensagem em pt-BR indicando que o serviço do
  IBGE está indisponível. Falha visível é melhor que dropdown silenciosamente vazio.

### `DadosAbertosNode`

Node declarativo, sem `execute`. A API declarativa do n8n não permite retry customizado.
Recebe o que é possível em `requestDefaults`:

```ts
requestDefaults: {
  baseURL: '=https://dadosabertos.compras.gov.br',
  timeout: 60000,
  headers: { Accept: 'application/json' },
}
```

Converter esse node para programático daria paridade total de resiliência, mas exigiria
reescrever 156 linhas de `routing` declarativo. Fica como trabalho futuro, a ser feito se
o servidor de Dados Abertos apresentar o mesmo problema.

## Fluxo de dados

```
execute()
  └─ getCredentials('pncpApi') ─→ lerRetryConfig() ─→ RetryConfig
       └─ monta endpoint + qs (inalterado)
            ├─ returnAll=false ─→ comRetry(() => httpRequestWithAuthentication(...))
            └─ returnAll=true  ─→ laço de páginas
                                    ├─ comRetry por página
                                    ├─ acumula data | registra paginasComErro
                                    ├─ circuit break em 3 falhas consecutivas
                                    └─ delay jitterado entre páginas
```

## Tratamento de erros

| Situação | Comportamento |
| --- | --- |
| 504 em requisição única | Até `maxTentativas`, backoff exponencial com jitter. Esgotado: `NodeOperationError` com `tentativas`. |
| 504 na página 1 de N | Aborta, lança erro. |
| 504 na página K (1 < K ≤ N) | Registra em `paginasComErro`, segue. Saída marcada `completo: false`. |
| 3 páginas consecutivas falhando | Circuit break. Devolve parcial com `completo: false`. |
| 429 com `Retry-After` | Respeita o header, limitado a `backoffMaxMs`. |
| 400 / 401 / 404 / 422 | Falha imediata, sem retry. |
| `continueOnFail()` ligado | Comportamento atual mantido: devolve `errorPayload` como item. |
| IBGE indisponível | 3 tentativas, depois erro com mensagem em pt-BR no dropdown. |

## Testes

**`tests/shared/transport.spec.ts` (novo)**

- `classificarErro`: tabela cobrindo 408/425/429/500/502/503/504 como retryáveis;
  400/401/403/404/422 como fatais; `ECONNRESET`/`ETIMEDOUT`/`EAI_AGAIN`/`EPIPE` como
  retryáveis; erro sem status nem código como retryável.
- `classificarErro`: lê status de `response.statusCode`, `statusCode` e `response.status`.
- `extrairRetryAfterMs`: segundos, HTTP-date, ausente, valor inválido.
- `calcularEspera`: respeita o teto `backoffMaxMs`; com `Math.random` stubado em 0 e em
  ~1, o resultado fica dentro de `[0, teto]`; `retryAfterMs` sobrepõe e é limitado.
- `comRetry`: sucesso na 1ª tentativa não dorme; sucesso na 3ª dorme 2 vezes; desiste
  após `maxTentativas` e anexa `tentativas` ao erro; erro fatal falha na 1ª sem dormir.

**`tests/pncp/PncpNode.spec.ts` (modificado)**

- Ajustar `should execute consultarItensPorUsuarioAno`: a asserção de args exatos de
  `httpRequestWithAuthentication` agora inclui `timeout` e os headers `Accept` e
  `User-Agent`.
- Ajustar `should handle error and continue if continueOnFail is true`: o mock rejeita
  com `new Error('API Error')`, que é classificado como retryável. Sem ajuste, o teste
  passaria a gastar 3 retries com espera real. O mock da credencial precisa zerar o
  backoff (ver abaixo), e a asserção ganha o campo `tentativas`.
- Novo: página 2 de 3 falha em todas as tentativas → saída com `paginasComErro: [2]`,
  `completo: false` e os dados das páginas 1 e 3.
- Novo: página 1 falha → lança erro.
- Novo: 3 páginas consecutivas falhando → circuit break com `completo: false`.
- Novo: erro fatal (404) não consome tentativas extras.

Os testes do node **não** injetam `dormir`. O `execute` chama `comRetry(operacao, cfg)`
usando o default, e os testes controlam a espera pelo mock de `getCredentials`, definindo
`backoffInicialMs: 0`, `backoffMaxMs: 0` e `delayEntrePaginasMs: 0`. Isso mantém o node
sem nenhum gancho de teste na assinatura e ainda deixa a suíte instantânea. A injeção de
`dormir` existe apenas para os testes unitários de `comRetry`, que precisam contar as
chamadas de espera.

Consequência para `lerRetryConfig`: o *clamp* de `backoffInicialMs` e `backoffMaxMs`
precisa tratar `0` como valor explícito válido, e não confundi-lo com ausente. A
distinção é entre `undefined` (usa default) e `0` (usa zero), não entre *falsy* e
*truthy*.

## Documentação

`README.md` ganha uma seção sobre resiliência cobrindo os campos novos da credencial, o
significado de `paginasComErro` / `completo`, e uma nota operacional: com retry interno
ativo, o "Retry On Fail" do n8n passa a multiplicar o número de requisições
(`maxTries × maxTentativas` no pior caso). A recomendação é deixar o retry do node
desligado, ou no máximo em 2.

## Arquivos

**Novos**

- `nodes/shared/transport/types.ts`
- `nodes/shared/transport/config.ts`
- `nodes/shared/transport/retry.ts`
- `nodes/shared/transport/executor.ts`
- `nodes/shared/transport/index.ts`
- `tests/shared/transport.spec.ts`

**Modificados**

- `credentials/PncpApi.credentials.ts`
- `nodes/Pncp/Pncp.node.ts`
- `nodes/DadosAbertosNode/DadosAbertosNode.node.ts`
- `tests/pncp/PncpNode.spec.ts`
- `README.md`

`tsconfig.json` já inclui `nodes/**/*`, então `nodes/shared/` compila para
`dist/nodes/shared/` sem alteração de build. `noUnusedLocals` está ligado: nada de
imports ou variáveis sobrando.

## Fora de escopo

- Converter `DadosAbertosNode` para node programático.
- Cache de respostas do PNCP entre execuções.
- Throttle adaptativo que reduz a taxa de requisições conforme o servidor degrada.
- Persistir progresso da paginação entre execuções do workflow.
