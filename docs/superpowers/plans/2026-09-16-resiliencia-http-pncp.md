# Resiliência HTTP dos nodes PNCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o node PNCP sobreviver às falhas transitórias do servidor (504, 502, `ECONNRESET`) sem quebrar workflows, via retry com backoff exponencial e paginação que devolve resultado parcial.

**Architecture:** Um módulo de transporte sem dependência de `n8n-workflow` (`nodes/shared/transport/`) expõe `comRetry(operacao, cfg, dormir?)`. O node PNCP lê a configuração da credencial `pncpApi` e envolve cada requisição — inclusive cada página da paginação — nessa função. Falha em página do meio vira `paginasComErro` em vez de abortar tudo.

**Tech Stack:** TypeScript 5.8 (strict, `noUnusedLocals`), Jest 30 + ts-jest, `n8n-workflow` ^1.82 como peer dependency.

**Spec:** `docs/superpowers/specs/2026-09-16-resiliencia-http-pncp-design.md`

---

## Contexto que o implementador precisa saber

**Como o n8n faz requisições nesse node.** `this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', options)` é um wrapper sobre axios. O `options` aceita `timeout` (ms). Em erro, o objeto lançado tem `error.response.statusCode`, `error.response.body` e `error.response.headers`.

**Por que retry interno e não o do n8n.** `retryOnFail`, `maxTries` e `waitBetweenTries` existem em `INode` (a instância no workflow), não em `INodeTypeDescription` — verificável em `node_modules/n8n-workflow/dist/esm/interfaces.d.ts:801-803`. Um node type não consegue definir defaults de retry para si. Além disso, o retry do n8n reexecuta o node inteiro, o que no modo `returnAll` refaz a paginação desde a página 1.

**Regras de lint que vão te morder.** `npm run lint` roda `eslint-plugin-n8n-nodes-base`. Duas regras relevantes:
- `node-param-description-excess-final-period`: descrições **não** podem terminar em ponto final.
- `cred-class-field-display-name-miscased`: exige Title Case, mas a lib `sentence-case` trata acentos como separadores e reprova qualquer texto em pt-BR acentuado. O projeto já contorna isso com um `eslint-disable` no topo de `nodes/Pncp/descriptions/PncpDescription.ts:1-5`. A Task 4 faz o mesmo na credencial.

**`noUnusedLocals` está ligado.** Nada de import ou variável sobrando. Use `catch {` (optional catch binding, disponível no target es2019) quando não for usar a variável do erro.

**Baseline.** `npx jest` hoje passa com 2 testes. O aviso `jest-haste-map: Haste module naming collision` sobre `dist/package.json` é pré-existente e não é problema seu.

---

## File Structure

**Criar:**

| Arquivo | Responsabilidade |
| --- | --- |
| `nodes/shared/transport/types.ts` | `RetryConfig`, `ClassificacaoErro`. Só tipos, sem lógica. |
| `nodes/shared/transport/config.ts` | Defaults, faixas, *clamp*, `lerRetryConfig`, `PERFIL_IBGE`, `VERSAO`. |
| `nodes/shared/transport/retry.ts` | Funções puras: classificar erro, ler `Retry-After`, calcular espera. |
| `nodes/shared/transport/executor.ts` | `comRetry` — o laço. Única parte com efeito colateral (dormir). |
| `nodes/shared/transport/index.ts` | Re-exports, para o node importar de um lugar só. |
| `tests/shared/transport.spec.ts` | Testes unitários do módulo de transporte. |

**Modificar:**

| Arquivo | Mudança |
| --- | --- |
| `credentials/PncpApi.credentials.ts` | 5 campos novos de configuração. |
| `nodes/Pncp/Pncp.node.ts` | `timeout` + headers, `comRetry` nas duas vias, paginação resiliente, cache do IBGE. |
| `nodes/DadosAbertosNode/DadosAbertosNode.node.ts` | `timeout` + `Accept` em `requestDefaults`. |
| `tests/pncp/PncpNode.spec.ts` | Ajustar 2 testes existentes, adicionar 5 novos. |
| `README.md` | Seção sobre resiliência. |

A separação `retry.ts` (puro) / `executor.ts` (efeito colateral) é o que permite testar a política de backoff sem esperar de verdade.

---

## Task 1: Tipos e configuração

**Files:**
- Create: `nodes/shared/transport/types.ts`
- Create: `nodes/shared/transport/config.ts`
- Test: `tests/shared/transport.spec.ts`

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/shared/transport.spec.ts`:

```ts
import { describe, it, expect } from '@jest/globals';
import { lerRetryConfig, lerDelayPaginas, PERFIL_IBGE } from '../../nodes/shared/transport/config';

describe('lerRetryConfig', () => {
	it('aplica defaults quando a credencial não tem os campos', () => {
		expect(lerRetryConfig({ baseUrl: 'https://pncp.gov.br/api/consulta' })).toEqual({
			timeoutMs: 60000,
			maxTentativas: 4,
			backoffInicialMs: 1000,
			backoffMaxMs: 16000,
		});
	});

	it('respeita valores válidos informados', () => {
		expect(
			lerRetryConfig({
				timeoutMs: 30000,
				maxTentativas: 6,
				backoffInicialMs: 500,
				backoffMaxMs: 8000,
			}),
		).toEqual({
			timeoutMs: 30000,
			maxTentativas: 6,
			backoffInicialMs: 500,
			backoffMaxMs: 8000,
		});
	});

	it('trata zero como valor explícito, não como ausente', () => {
		const cfg = lerRetryConfig({ backoffInicialMs: 0, backoffMaxMs: 0 });
		expect(cfg.backoffInicialMs).toBe(0);
		expect(cfg.backoffMaxMs).toBe(0);
	});

	it('faz clamp de valores fora da faixa', () => {
		const cfg = lerRetryConfig({
			timeoutMs: 999999,
			maxTentativas: 50,
			backoffInicialMs: -100,
			backoffMaxMs: 999999,
		});
		expect(cfg).toEqual({
			timeoutMs: 300000,
			maxTentativas: 10,
			backoffInicialMs: 0,
			backoffMaxMs: 120000,
		});
	});

	it('ignora valores não numéricos', () => {
		const cfg = lerRetryConfig({ timeoutMs: 'abc', maxTentativas: NaN });
		expect(cfg.timeoutMs).toBe(60000);
		expect(cfg.maxTentativas).toBe(4);
	});
});

describe('lerDelayPaginas', () => {
	it('usa 200ms por padrão', () => {
		expect(lerDelayPaginas({})).toBe(200);
	});

	it('aceita zero', () => {
		expect(lerDelayPaginas({ delayEntrePaginasMs: 0 })).toBe(0);
	});

	it('faz clamp acima de 10000', () => {
		expect(lerDelayPaginas({ delayEntrePaginasMs: 99999 })).toBe(10000);
	});
});

describe('PERFIL_IBGE', () => {
	it('usa timeout curto, adequado a um dropdown do editor', () => {
		expect(PERFIL_IBGE).toEqual({
			timeoutMs: 15000,
			maxTentativas: 3,
			backoffInicialMs: 500,
			backoffMaxMs: 4000,
		});
	});
});
```

- [ ] **Step 2: Rode o teste e confirme que falha**

Run: `npx jest tests/shared/transport.spec.ts`
Expected: FAIL — `Cannot find module '../../nodes/shared/transport/config'`

- [ ] **Step 3: Crie `nodes/shared/transport/types.ts`**

```ts
export interface RetryConfig {
	/** Tempo máximo de espera por requisição, em ms */
	timeoutMs: number;
	/** Número total de tentativas, incluindo a primeira */
	maxTentativas: number;
	/** Base do backoff exponencial, em ms */
	backoffInicialMs: number;
	/** Teto do backoff, em ms */
	backoffMaxMs: number;
}

export type ClassificacaoErro = 'retryavel' | 'fatal';
```

- [ ] **Step 4: Crie `nodes/shared/transport/config.ts`**

```ts
import type { RetryConfig } from './types';

/**
 * Mantido em sincronia manual com `package.json`. Importar o package.json
 * acoplaria o código ao layout do `dist`, onde ele é copiado para a raiz
 * e não para junto deste módulo.
 */
export const VERSAO = '0.1.3';

export const DELAY_PAGINAS_PADRAO_MS = 200;

/** Falhas consecutivas de página que acionam o circuit break */
export const MAX_FALHAS_CONSECUTIVAS = 3;

/**
 * Perfil fixo para a consulta de municípios do IBGE. Não usa a credencial:
 * é um dropdown do editor com o usuário esperando, e um timeout de 60s ali
 * seria péssima experiência.
 */
export const PERFIL_IBGE: RetryConfig = {
	timeoutMs: 15000,
	maxTentativas: 3,
	backoffInicialMs: 500,
	backoffMaxMs: 4000,
};

interface Faixa {
	padrao: number;
	min: number;
	max: number;
}

const FAIXAS: Record<string, Faixa> = {
	timeoutMs: { padrao: 60000, min: 5000, max: 300000 },
	maxTentativas: { padrao: 4, min: 1, max: 10 },
	backoffInicialMs: { padrao: 1000, min: 0, max: 30000 },
	backoffMaxMs: { padrao: 16000, min: 0, max: 120000 },
	delayEntrePaginasMs: { padrao: DELAY_PAGINAS_PADRAO_MS, min: 0, max: 10000 },
};

/**
 * Distingue `undefined` (campo ausente, usa default) de `0` (valor explícito).
 * Um teste de truthiness aqui transformaria zero em default silenciosamente.
 */
function ler(valor: unknown, faixa: Faixa): number {
	if (typeof valor !== 'number' || !Number.isFinite(valor)) return faixa.padrao;
	return Math.min(faixa.max, Math.max(faixa.min, valor));
}

export function lerRetryConfig(credentials: Record<string, unknown>): RetryConfig {
	return {
		timeoutMs: ler(credentials?.timeoutMs, FAIXAS.timeoutMs),
		maxTentativas: ler(credentials?.maxTentativas, FAIXAS.maxTentativas),
		backoffInicialMs: ler(credentials?.backoffInicialMs, FAIXAS.backoffInicialMs),
		backoffMaxMs: ler(credentials?.backoffMaxMs, FAIXAS.backoffMaxMs),
	};
}

export function lerDelayPaginas(credentials: Record<string, unknown>): number {
	return ler(credentials?.delayEntrePaginasMs, FAIXAS.delayEntrePaginasMs);
}
```

- [ ] **Step 5: Rode o teste e confirme que passa**

Run: `npx jest tests/shared/transport.spec.ts`
Expected: PASS — 9 testes

- [ ] **Step 6: Commit**

```bash
git add nodes/shared/transport/types.ts nodes/shared/transport/config.ts tests/shared/transport.spec.ts
git commit -m "feat(transport): add retry config with range clamping"
```

---

## Task 2: Classificação de erro e cálculo de espera

**Files:**
- Create: `nodes/shared/transport/retry.ts`
- Modify: `tests/shared/transport.spec.ts` (adiciona blocos)

- [ ] **Step 1: Escreva os testes que falham**

Adicione ao topo de `tests/shared/transport.spec.ts` o import:

```ts
import {
	calcularEspera,
	classificarErro,
	extrairRetryAfterMs,
	extrairStatus,
} from '../../nodes/shared/transport/retry';
import type { RetryConfig } from '../../nodes/shared/transport/types';
```

E adicione ao final do arquivo:

```ts
describe('extrairStatus', () => {
	it('lê de response.statusCode (formato do helper do n8n)', () => {
		expect(extrairStatus({ response: { statusCode: 504 } })).toBe(504);
	});

	it('lê de response.status (formato axios cru)', () => {
		expect(extrairStatus({ response: { status: 502 } })).toBe(502);
	});

	it('lê de statusCode na raiz', () => {
		expect(extrairStatus({ statusCode: 429 })).toBe(429);
	});

	it('devolve undefined quando não há status', () => {
		expect(extrairStatus(new Error('boom'))).toBeUndefined();
		expect(extrairStatus(undefined)).toBeUndefined();
	});
});

describe('classificarErro', () => {
	it.each([408, 425, 429, 500, 502, 503, 504])('trata %i como retryável', (status) => {
		expect(classificarErro({ response: { statusCode: status } })).toBe('retryavel');
	});

	it.each([400, 401, 403, 404, 422])('trata %i como fatal', (status) => {
		expect(classificarErro({ response: { statusCode: status } })).toBe('fatal');
	});

	it('trata 5xx fora da lista como retryável', () => {
		expect(classificarErro({ response: { statusCode: 599 } })).toBe('retryavel');
	});

	it.each(['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EAI_AGAIN', 'EPIPE'])(
		'trata o código de rede %s como retryável',
		(code) => {
			expect(classificarErro({ code })).toBe('retryavel');
		},
	);

	it('trata código conhecido mas não transitório como fatal', () => {
		expect(classificarErro({ code: 'CERT_HAS_EXPIRED' })).toBe('fatal');
		expect(classificarErro({ code: 'ENOTFOUND' })).toBe('fatal');
	});

	it('trata erro sem status e sem código como retryável', () => {
		expect(classificarErro(new Error('socket hang up'))).toBe('retryavel');
	});
});

describe('extrairRetryAfterMs', () => {
	it('lê Retry-After em segundos', () => {
		expect(extrairRetryAfterMs({ response: { headers: { 'retry-after': '120' } } })).toBe(120000);
	});

	it('lê Retry-After como HTTP-date', () => {
		const agora = Date.parse('2026-09-16T08:00:00Z');
		const erro = { response: { headers: { 'retry-after': 'Wed, 16 Sep 2026 08:00:30 GMT' } } };
		expect(extrairRetryAfterMs(erro, agora)).toBe(30000);
	});

	it('devolve 0 para HTTP-date no passado', () => {
		const agora = Date.parse('2026-09-16T08:00:00Z');
		const erro = { response: { headers: { 'retry-after': 'Wed, 16 Sep 2026 07:00:00 GMT' } } };
		expect(extrairRetryAfterMs(erro, agora)).toBe(0);
	});

	it('aceita o header com capitalização alternativa', () => {
		expect(extrairRetryAfterMs({ response: { headers: { 'Retry-After': '5' } } })).toBe(5000);
	});

	it('devolve undefined quando ausente ou inválido', () => {
		expect(extrairRetryAfterMs({ response: { headers: {} } })).toBeUndefined();
		expect(extrairRetryAfterMs({ response: {} })).toBeUndefined();
		expect(extrairRetryAfterMs(new Error('boom'))).toBeUndefined();
		expect(
			extrairRetryAfterMs({ response: { headers: { 'retry-after': 'depois' } } }),
		).toBeUndefined();
	});
});

describe('calcularEspera', () => {
	const cfg: RetryConfig = {
		timeoutMs: 60000,
		maxTentativas: 4,
		backoffInicialMs: 1000,
		backoffMaxMs: 16000,
	};

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('cresce exponencialmente com jitter em [0, teto]', () => {
		jest.spyOn(Math, 'random').mockReturnValue(1);
		expect(calcularEspera(1, cfg)).toBe(1000);
		expect(calcularEspera(2, cfg)).toBe(2000);
		expect(calcularEspera(3, cfg)).toBe(4000);
	});

	it('com random em 0, a espera é 0 (full jitter)', () => {
		jest.spyOn(Math, 'random').mockReturnValue(0);
		expect(calcularEspera(3, cfg)).toBe(0);
	});

	it('respeita o teto backoffMaxMs', () => {
		jest.spyOn(Math, 'random').mockReturnValue(1);
		expect(calcularEspera(10, cfg)).toBe(16000);
	});

	it('Retry-After sobrepõe o backoff calculado', () => {
		jest.spyOn(Math, 'random').mockReturnValue(1);
		expect(calcularEspera(1, cfg, 5000)).toBe(5000);
	});

	it('Retry-After também é limitado pelo teto', () => {
		expect(calcularEspera(1, cfg, 999999)).toBe(16000);
	});

	it('devolve 0 quando o backoff está zerado', () => {
		const zerado: RetryConfig = { ...cfg, backoffInicialMs: 0, backoffMaxMs: 0 };
		expect(calcularEspera(1, zerado)).toBe(0);
		expect(calcularEspera(1, zerado, 5000)).toBe(0);
	});
});
```

Adicione `jest` ao import de `@jest/globals` no topo do arquivo, que passa a ser:

```ts
import { describe, it, expect, jest, afterEach } from '@jest/globals';
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx jest tests/shared/transport.spec.ts`
Expected: FAIL — `Cannot find module '../../nodes/shared/transport/retry'`

- [ ] **Step 3: Crie `nodes/shared/transport/retry.ts`**

```ts
import type { ClassificacaoErro, RetryConfig } from './types';

/** Status que indicam falha transitória do servidor ou do gateway */
const STATUS_RETRYAVEIS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Códigos de rede que indicam falha transitória de conexão */
const CODIGOS_REDE_RETRYAVEIS = new Set([
	'ECONNRESET',
	'ETIMEDOUT',
	'ESOCKETTIMEDOUT',
	'EAI_AGAIN',
	'EPIPE',
]);

export function extrairStatus(erro: unknown): number | undefined {
	if (!erro || typeof erro !== 'object') return undefined;
	const e = erro as { response?: { statusCode?: unknown; status?: unknown }; statusCode?: unknown };
	const candidatos = [e.response?.statusCode, e.response?.status, e.statusCode];
	for (const candidato of candidatos) {
		if (typeof candidato === 'number') return candidato;
	}
	return undefined;
}

export function classificarErro(erro: unknown): ClassificacaoErro {
	const status = extrairStatus(erro);
	if (status !== undefined) {
		if (STATUS_RETRYAVEIS.has(status)) return 'retryavel';
		// 4xx restantes são erro do cliente: repetir não muda o resultado.
		if (status >= 400 && status < 500) return 'fatal';
		return 'retryavel';
	}

	const codigo = (erro as { code?: unknown } | undefined)?.code;
	if (typeof codigo === 'string') {
		// Código conhecido e não listado (certificado expirado, DNS inexistente)
		// é permanente: retentar só queima tentativas.
		return CODIGOS_REDE_RETRYAVEIS.has(codigo) ? 'retryavel' : 'fatal';
	}

	// Sem status e sem código: falha de socket genérica, vale tentar de novo.
	return 'retryavel';
}

export function extrairRetryAfterMs(erro: unknown, agora: number = Date.now()): number | undefined {
	if (!erro || typeof erro !== 'object') return undefined;
	const headers = (erro as { response?: { headers?: Record<string, unknown> } }).response?.headers;
	if (!headers) return undefined;

	const bruto = headers['retry-after'] ?? headers['Retry-After'];
	if (bruto === undefined || bruto === null) return undefined;

	const texto = String(Array.isArray(bruto) ? bruto[0] : bruto).trim();
	if (texto === '') return undefined;

	if (/^\d+$/.test(texto)) return Number(texto) * 1000;

	const timestamp = Date.parse(texto);
	if (Number.isNaN(timestamp)) return undefined;

	return Math.max(0, timestamp - agora);
}

/**
 * Full jitter: espera uniforme em [0, teto], com teto exponencial.
 * O jitter não é cosmético — sem ele, todos os workflows que falham no mesmo
 * minuto retentam no mesmo instante e mantêm o gateway derrubado.
 */
export function calcularEspera(
	tentativa: number,
	cfg: RetryConfig,
	retryAfterMs?: number,
): number {
	const teto = Math.min(cfg.backoffMaxMs, cfg.backoffInicialMs * 2 ** (tentativa - 1));
	if (retryAfterMs !== undefined) return Math.min(retryAfterMs, cfg.backoffMaxMs);
	return Math.random() * teto;
}
```

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `npx jest tests/shared/transport.spec.ts`
Expected: PASS — todos os blocos, incluindo os 9 da Task 1

- [ ] **Step 5: Commit**

```bash
git add nodes/shared/transport/retry.ts tests/shared/transport.spec.ts
git commit -m "feat(transport): classify errors and compute jittered backoff"
```

---

## Task 3: O executor `comRetry`

**Files:**
- Create: `nodes/shared/transport/executor.ts`
- Create: `nodes/shared/transport/index.ts`
- Modify: `tests/shared/transport.spec.ts` (adiciona bloco)

- [ ] **Step 1: Escreva os testes que falham**

Adicione o import no topo de `tests/shared/transport.spec.ts`:

```ts
import { comRetry } from '../../nodes/shared/transport/executor';
```

E adicione ao final do arquivo:

```ts
describe('comRetry', () => {
	const cfg: RetryConfig = {
		timeoutMs: 60000,
		maxTentativas: 4,
		backoffInicialMs: 1000,
		backoffMaxMs: 16000,
	};

	/** Coleta as esperas solicitadas sem dormir de verdade */
	function espiaoDeEspera() {
		const esperas: number[] = [];
		const dormir = async (ms: number) => {
			esperas.push(ms);
		};
		return { esperas, dormir };
	}

	it('não dorme quando a primeira tentativa dá certo', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const operacao = jest.fn<() => Promise<string>>().mockResolvedValue('ok');

		await expect(comRetry(operacao, cfg, dormir)).resolves.toBe('ok');

		expect(operacao).toHaveBeenCalledTimes(1);
		expect(esperas).toEqual([]);
	});

	it('retenta e dorme entre as tentativas até obter sucesso', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const erro504 = { response: { statusCode: 504 } };
		const operacao = jest
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(erro504)
			.mockRejectedValueOnce(erro504)
			.mockResolvedValue('ok');

		await expect(comRetry(operacao, cfg, dormir)).resolves.toBe('ok');

		expect(operacao).toHaveBeenCalledTimes(3);
		expect(esperas).toHaveLength(2);
	});

	it('desiste após maxTentativas e anexa a contagem ao erro', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const erro504: Record<string, unknown> = { response: { statusCode: 504 } };
		const operacao = jest.fn<() => Promise<string>>().mockRejectedValue(erro504);

		await expect(comRetry(operacao, cfg, dormir)).rejects.toBe(erro504);

		expect(operacao).toHaveBeenCalledTimes(4);
		expect(esperas).toHaveLength(3);
		expect(erro504.tentativas).toBe(4);
	});

	it('falha de imediato em erro fatal, sem dormir', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const erro404: Record<string, unknown> = { response: { statusCode: 404 } };
		const operacao = jest.fn<() => Promise<string>>().mockRejectedValue(erro404);

		await expect(comRetry(operacao, cfg, dormir)).rejects.toBe(erro404);

		expect(operacao).toHaveBeenCalledTimes(1);
		expect(esperas).toEqual([]);
		expect(erro404.tentativas).toBe(1);
	});

	it('respeita Retry-After ao calcular a espera', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const erro429 = { response: { statusCode: 429, headers: { 'retry-after': '3' } } };
		const operacao = jest
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(erro429)
			.mockResolvedValue('ok');

		await expect(comRetry(operacao, cfg, dormir)).resolves.toBe('ok');

		expect(esperas).toEqual([3000]);
	});

	it('com maxTentativas 1 não retenta', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const operacao = jest
			.fn<() => Promise<string>>()
			.mockRejectedValue({ response: { statusCode: 504 } });

		await expect(comRetry(operacao, { ...cfg, maxTentativas: 1 }, dormir)).rejects.toBeDefined();

		expect(operacao).toHaveBeenCalledTimes(1);
		expect(esperas).toEqual([]);
	});
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx jest tests/shared/transport.spec.ts`
Expected: FAIL — `Cannot find module '../../nodes/shared/transport/executor'`

- [ ] **Step 3: Crie `nodes/shared/transport/executor.ts`**

```ts
import { calcularEspera, classificarErro, extrairRetryAfterMs } from './retry';
import type { RetryConfig } from './types';

export const esperar = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

function anexarTentativas(erro: unknown, tentativas: number): void {
	if (erro && typeof erro === 'object') {
		(erro as { tentativas?: number }).tentativas = tentativas;
	}
}

/**
 * Executa `operacao`, retentando enquanto o erro for transitório.
 *
 * `dormir` é injetável para que os testes contem as esperas sem aguardar de
 * verdade. Em produção usa `setTimeout`.
 */
export async function comRetry<T>(
	operacao: () => Promise<T>,
	cfg: RetryConfig,
	dormir: (ms: number) => Promise<void> = esperar,
): Promise<T> {
	let ultimoErro: unknown;

	for (let tentativa = 1; tentativa <= cfg.maxTentativas; tentativa++) {
		try {
			return await operacao();
		} catch (erro) {
			ultimoErro = erro;

			if (classificarErro(erro) === 'fatal') {
				anexarTentativas(erro, tentativa);
				throw erro;
			}

			if (tentativa === cfg.maxTentativas) break;

			await dormir(calcularEspera(tentativa, cfg, extrairRetryAfterMs(erro)));
		}
	}

	anexarTentativas(ultimoErro, cfg.maxTentativas);
	throw ultimoErro;
}
```

- [ ] **Step 4: Crie `nodes/shared/transport/index.ts`**

```ts
export * from './config';
export * from './executor';
export * from './retry';
export * from './types';
```

- [ ] **Step 5: Rode os testes e confirme que passam**

Run: `npx jest tests/shared/transport.spec.ts`
Expected: PASS — todos os blocos

- [ ] **Step 6: Verifique que o TypeScript compila**

Run: `npx tsc --noEmit`
Expected: sem saída (sucesso)

- [ ] **Step 7: Commit**

```bash
git add nodes/shared/transport/executor.ts nodes/shared/transport/index.ts tests/shared/transport.spec.ts
git commit -m "feat(transport): add comRetry executor with injectable sleep"
```

---

## Task 4: Campos de configuração na credencial

**Files:**
- Modify: `credentials/PncpApi.credentials.ts`

Não há teste automatizado aqui: é declaração de UI, verificada por `npm run lint` e pela compilação.

- [ ] **Step 1: Substitua o conteúdo de `credentials/PncpApi.credentials.ts`**

```ts
/* eslint-disable n8n-nodes-base/cred-class-field-display-name-miscased */
// Regra desabilitada: a lib `sentence-case` usada pelo plugin trata caracteres
// acentuados como separadores, impedindo que qualquer `displayName` em português
// com acentuação passe na verificação. Mantemos os textos corretamente
// acentuados para preservar a experiência em pt-BR.

import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PncpApi implements ICredentialType {
	name = 'pncpApi';
	displayName = 'PNCP API';
	documentationUrl = 'https://www.gov.br/pncp/pt-br';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'hidden',
			default: 'https://pncp.gov.br/api/consulta',
			description: 'A URL base da API PNCP',
		},
		{
			displayName: 'Timeout Por Requisição (Ms)',
			name: 'timeoutMs',
			type: 'number',
			default: 60000,
			typeOptions: {
				minValue: 5000,
				maxValue: 300000,
			},
			description: 'Tempo máximo de espera por requisição antes de abortar e retentar',
		},
		{
			displayName: 'Máximo De Tentativas',
			name: 'maxTentativas',
			type: 'number',
			default: 4,
			typeOptions: {
				minValue: 1,
				maxValue: 10,
			},
			description:
				'Número total de tentativas por requisição, incluindo a primeira. Erros 4xx (CNPJ inválido, recurso inexistente) falham de imediato, sem retentar',
		},
		{
			displayName: 'Backoff Inicial (Ms)',
			name: 'backoffInicialMs',
			type: 'number',
			default: 1000,
			typeOptions: {
				minValue: 0,
				maxValue: 30000,
			},
			description:
				'Base da espera exponencial entre tentativas. A espera real é sorteada entre zero e o valor calculado, para evitar que workflows sincronizados retentem no mesmo instante',
		},
		{
			displayName: 'Backoff Máximo (Ms)',
			name: 'backoffMaxMs',
			type: 'number',
			default: 16000,
			typeOptions: {
				minValue: 0,
				maxValue: 120000,
			},
			description: 'Teto da espera entre tentativas, incluindo o valor vindo do header Retry-After',
		},
		{
			displayName: 'Intervalo Entre Páginas (Ms)',
			name: 'delayEntrePaginasMs',
			type: 'number',
			default: 200,
			typeOptions: {
				minValue: 0,
				maxValue: 10000,
			},
			description:
				'Pausa entre requisições de páginas consecutivas quando "Buscar Todas Páginas" está ligado',
		},
	];
}
```

- [ ] **Step 2: Rode o lint**

Run: `npm run lint`
Expected: sem erros. Se aparecer erro de `cred-class-field-display-name-miscased`, confirme que o `eslint-disable` está na primeira linha do arquivo.

- [ ] **Step 3: Verifique a compilação**

Run: `npx tsc --noEmit`
Expected: sem saída

- [ ] **Step 4: Commit**

```bash
git add credentials/PncpApi.credentials.ts
git commit -m "feat(pncp): add timeout and retry fields to credential"
```

---

## Task 5: Requisição única com retry, timeout e headers

**Files:**
- Modify: `nodes/Pncp/Pncp.node.ts:1-12` (imports), `:65-74` (options), `:306-318` (via única), `:319-347` (catch)
- Modify: `tests/pncp/PncpNode.spec.ts`

Esta task cobre só a via não paginada. A paginação vem na Task 6.

- [ ] **Step 1: Atualize os dois testes existentes para o novo contrato**

Em `tests/pncp/PncpNode.spec.ts`, no primeiro teste (`should execute consultarItensPorUsuarioAno`), troque o mock da credencial e a asserção:

```ts
		(mockExecuteFunctions.getCredentials as any).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			bearerToken: 'test-token',
			backoffInicialMs: 0,
			backoffMaxMs: 0,
			delayEntrePaginasMs: 0,
		});
```

```ts
		expect(mockHttpRequest).toHaveBeenCalledWith(
			'pncpApi',
			{
				baseURL: 'https://api.pncp.gov.br/api/consulta',
				url: '/v1/pca/usuario',
				method: 'GET',
				timeout: 60000,
				qs: { anoPca: 2024, idUsuario: 1, pagina: 1, tamanhoPagina: 10 },
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'User-Agent': 'n8n-nodes-aspone/0.1.3',
				},
			}
		);
```

No segundo teste (`should handle error and continue if continueOnFail is true`), o mock rejeita com `new Error('API Error')`, que é classificado como retryável. Sem `maxTentativas: 1` o teste gastaria 3 retries. Troque o mock da credencial e a asserção:

```ts
		(mockExecuteFunctions.getCredentials as any).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			maxTentativas: 1,
			backoffInicialMs: 0,
			backoffMaxMs: 0,
			delayEntrePaginasMs: 0,
		});
```

```ts
		expect(result).toEqual([[{
			json: {
				success: false,
				statusCode: undefined,
				message: 'API Error',
				serverResponse: undefined,
				tentativas: 1,
			},
			pairedItem: { item: 0 },
		}]]);
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx jest tests/pncp/PncpNode.spec.ts`
Expected: FAIL nos dois testes — o objeto recebido não tem `timeout`, nem os headers novos, nem `tentativas`

- [ ] **Step 3: Adicione o import do transporte em `nodes/Pncp/Pncp.node.ts`**

Depois da linha `import { pncpProperties } from './descriptions/PncpDescription';` (linha 12), adicione:

```ts
import { comRetry, lerRetryConfig, VERSAO } from '../shared/transport';
```

`lerDelayPaginas` e `MAX_FALHAS_CONSECUTIVAS` entram só na Task 6, quando passam a ser usados. `noUnusedLocals` reprova import e variável sem uso, então não os adicione antes da hora.

- [ ] **Step 4: Substitua o bloco de credenciais e options (`:65-74`)**

Troque:

```ts
		const credentials = await this.getCredentials('pncpApi');
		const baseUrl = credentials.baseUrl as string;

		const options = {
			baseURL: baseUrl,
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'GET' as const,
		};
```

Por:

```ts
		const credentials = await this.getCredentials('pncpApi');
		const baseUrl = credentials.baseUrl as string;
		const retryConfig = lerRetryConfig(credentials);

		const options = {
			baseURL: baseUrl,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'User-Agent': `n8n-nodes-aspone/${VERSAO}`,
			},
			method: 'GET' as const,
			timeout: retryConfig.timeoutMs,
		};
```

- [ ] **Step 5: Envolva a via não paginada em `comRetry` (`:307-312`)**

Troque:

```ts
			} else {
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
					...options,
					url: endpoint,
					qs: cleanQs(qs),
				});
```

Por:

```ts
			} else {
				const response = await comRetry(
					async () =>
						await this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
							...options,
							url: endpoint,
							qs: cleanQs(qs),
						}),
					retryConfig,
				);
```

- [ ] **Step 6: Anexe `tentativas` ao payload de erro (`:330-335`)**

Troque:

```ts
			const errorPayload = {
				success: false,
				statusCode,
				message: serverMessage,
				serverResponse: serverBody,
			};
```

Por:

```ts
			const errorPayload = {
				success: false,
				statusCode,
				message: serverMessage,
				serverResponse: serverBody,
				tentativas: err?.tentativas,
			};
```

- [ ] **Step 7: Rode os testes e confirme que passam**

Run: `npx jest tests/pncp/PncpNode.spec.ts`
Expected: PASS — 2 testes. O segundo deve terminar em menos de 1s (era esse o ponto do `maxTentativas: 1`).

- [ ] **Step 8: Verifique compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem saída do tsc, sem erros do lint

- [ ] **Step 9: Commit**

```bash
git add nodes/Pncp/Pncp.node.ts tests/pncp/PncpNode.spec.ts
git commit -m "feat(pncp): add timeout, headers and retry to single requests"
```

---

## Task 6: Paginação resiliente com resultado parcial

**Files:**
- Modify: `nodes/Pncp/Pncp.node.ts:264-306` (laço de paginação)
- Modify: `tests/pncp/PncpNode.spec.ts`

- [ ] **Step 1: Escreva os testes que falham**

Adicione a `tests/pncp/PncpNode.spec.ts`, dentro do `describe('PncpNode')`, um helper e os novos casos:

```ts
	/**
	 * Monta um contexto de execução para `consultarItensPorAno` com returnAll
	 * ligado. `respostas` é a sequência de resultados (ou erros) por página.
	 */
	function contextoPaginado(mockHttpRequest: any, limitePaginas = 10) {
		const mockExecuteFunctions = {
			getNodeParameter: jest.fn() as any,
			getCredentials: jest.fn() as any,
			helpers: { httpRequestWithAuthentication: mockHttpRequest },
			continueOnFail: jest.fn().mockReturnValue(false),
			getInputData: jest.fn().mockReturnValue([{}]),
			getNode: jest.fn().mockReturnValue({}),
		} as unknown as IExecuteFunctions;

		(mockExecuteFunctions.getCredentials as any).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			maxTentativas: 1,
			backoffInicialMs: 0,
			backoffMaxMs: 0,
			delayEntrePaginasMs: 0,
		});

		(mockExecuteFunctions.getNodeParameter as any).mockImplementation(
			(nome: string, _indice: number, padrao?: unknown) => {
				const valores: Record<string, unknown> = {
					resource: 'planoContratacao',
					operation: 'consultarItensPorAno',
					anoPca: 2024,
					codigoClassificacaoSuperior: '',
					pagina: 1,
					tamanhoPagina: 10,
					returnAll: true,
					limitePaginas,
				};
				return nome in valores ? valores[nome] : padrao;
			},
		);

		return mockExecuteFunctions;
	}

	const pagina = (numero: number, totalPaginas: number) => ({
		data: [`item-${numero}`],
		totalRegistros: totalPaginas * 10,
		totalPaginas,
	});

	it('devolve resultado parcial quando uma página do meio falha', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest
			.mockResolvedValueOnce(pagina(1, 3))
			.mockRejectedValueOnce({ response: { statusCode: 504 } })
			.mockResolvedValueOnce(pagina(3, 3));

		const result = await node.execute.call(contextoPaginado(mockHttpRequest));

		expect(result[0][0].json).toEqual({
			data: ['item-1', 'item-3'],
			totalRegistros: 30,
			totalPaginas: 3,
			paginasBuscadas: 2,
			limitePaginasAtingido: false,
			paginasComErro: [2],
			completo: false,
		});
	});

	it('marca completo quando todas as páginas vêm', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValueOnce(pagina(1, 2)).mockResolvedValueOnce(pagina(2, 2));

		const result = await node.execute.call(contextoPaginado(mockHttpRequest));

		expect(result[0][0].json).toEqual({
			data: ['item-1', 'item-2'],
			totalRegistros: 20,
			totalPaginas: 2,
			paginasBuscadas: 2,
			limitePaginasAtingido: false,
			paginasComErro: [],
			completo: true,
		});
	});

	it('lança erro quando a página 1 falha, pois não há totalPaginas', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockRejectedValue({ response: { statusCode: 504 } });

		await expect(node.execute.call(contextoPaginado(mockHttpRequest))).rejects.toBeDefined();
		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
	});

	it('aciona o circuit break após 3 páginas consecutivas com falha', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest
			.mockResolvedValueOnce(pagina(1, 10))
			.mockRejectedValue({ response: { statusCode: 503 } });

		const result = await node.execute.call(contextoPaginado(mockHttpRequest));

		// página 1 ok, páginas 2/3/4 falham e param o laço
		expect(mockHttpRequest).toHaveBeenCalledTimes(4);
		expect(result[0][0].json).toMatchObject({
			data: ['item-1'],
			paginasComErro: [2, 3, 4],
			completo: false,
		});
	});

	it('respeita limitePaginas contando páginas tentadas, não só as bem-sucedidas', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest
			.mockResolvedValueOnce(pagina(1, 10))
			.mockRejectedValueOnce({ response: { statusCode: 504 } })
			.mockResolvedValueOnce(pagina(3, 10));

		const result = await node.execute.call(contextoPaginado(mockHttpRequest, 3));

		expect(mockHttpRequest).toHaveBeenCalledTimes(3);
		expect(result[0][0].json).toMatchObject({
			paginasBuscadas: 2,
			paginasComErro: [2],
			limitePaginasAtingido: true,
			completo: false,
		});
	});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx jest tests/pncp/PncpNode.spec.ts`
Expected: FAIL — a saída não tem `paginasComErro` nem `completo`, e a primeira falha de página aborta tudo

- [ ] **Step 3: Amplie o import do transporte e leia o delay da credencial**

Troque o import adicionado na Task 5:

```ts
import { comRetry, lerRetryConfig, VERSAO } from '../shared/transport';
```

Por:

```ts
import {
	comRetry,
	esperar,
	lerDelayPaginas,
	lerRetryConfig,
	MAX_FALHAS_CONSECUTIVAS,
	VERSAO,
} from '../shared/transport';
```

E logo abaixo de `const retryConfig = lerRetryConfig(credentials);`, adicione:

```ts
		const delayPaginas = lerDelayPaginas(credentials);
```

- [ ] **Step 4: Substitua o laço de paginação (`nodes/Pncp/Pncp.node.ts:264-306`)**

Troque o bloco inteiro:

```ts
			if (returnAll && isPaginated && endpoint) {
				const allData: unknown[] = [];
				let currentPage = 1;
				let totalRegistros = 0;
				let totalPaginas = 1;
				let paginasBuscadas = 0;
				let limiteAtingido = false;

				while (true) {
					qs.pagina = currentPage;
					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
						...options,
						url: endpoint,
						qs: cleanQs(qs),
					});

					paginasBuscadas++;
					totalRegistros = (response?.totalRegistros as number) ?? 0;
					totalPaginas = (response?.totalPaginas as number) ?? 1;

					if (Array.isArray(response?.data)) {
						allData.push(...response.data);
					}

					if (currentPage >= totalPaginas) break;
					if (paginasBuscadas >= limitePaginas) {
						limiteAtingido = true;
						break;
					}
					currentPage++;
					await new Promise((resolve) => setTimeout(resolve, 200));
				}

				returnData.push({
					json: {
						data: allData,
						totalRegistros,
						totalPaginas,
						paginasBuscadas,
						limitePaginasAtingido: limiteAtingido,
					},
					pairedItem: { item: 0 },
				});
			} else {
```

Por:

```ts
			if (returnAll && isPaginated && endpoint) {
				const allData: unknown[] = [];
				const paginasComErro: number[] = [];
				let currentPage = 1;
				let totalRegistros = 0;
				let totalPaginas = 1;
				let paginasBuscadas = 0;
				let limiteAtingido = false;
				let falhasConsecutivas = 0;

				while (true) {
					qs.pagina = currentPage;

					try {
						const response = await comRetry(
							async () =>
								await this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
									...options,
									url: endpoint,
									qs: cleanQs(qs),
								}),
							retryConfig,
						);

						falhasConsecutivas = 0;
						paginasBuscadas++;
						totalRegistros = (response?.totalRegistros as number) ?? 0;
						totalPaginas = (response?.totalPaginas as number) ?? 1;

						if (Array.isArray(response?.data)) {
							allData.push(...response.data);
						}
					} catch (erroPagina) {
						// Sem a página 1 não temos totalPaginas, então não há como
						// seguir nem como saber o tamanho do que ficou faltando.
						if (currentPage === 1) throw erroPagina;

						paginasComErro.push(currentPage);
						falhasConsecutivas++;
					}

					// Circuit break: o servidor está fora, insistir só piora.
					if (falhasConsecutivas >= MAX_FALHAS_CONSECUTIVAS) break;
					if (currentPage >= totalPaginas) break;
					// currentPage é a contagem de páginas tentadas, incluindo as que falharam.
					if (currentPage >= limitePaginas) {
						limiteAtingido = true;
						break;
					}
					currentPage++;
					// Jitter no intervalo entre páginas pelo mesmo motivo do backoff:
					// não sincronizar workflows concorrentes contra o mesmo servidor.
					await esperar(delayPaginas * (0.5 + Math.random()));
				}

				returnData.push({
					json: {
						data: allData,
						totalRegistros,
						totalPaginas,
						paginasBuscadas,
						limitePaginasAtingido: limiteAtingido,
						paginasComErro,
						completo: paginasComErro.length === 0,
					},
					pairedItem: { item: 0 },
				});
			} else {
```

- [ ] **Step 5: Rode os testes e confirme que passam**

Run: `npx jest tests/pncp/PncpNode.spec.ts`
Expected: PASS — 7 testes

- [ ] **Step 6: Rode a suíte inteira**

Run: `npx jest`
Expected: PASS — 2 suítes, todos os testes

- [ ] **Step 7: Verifique compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem saída do tsc, sem erros do lint

- [ ] **Step 8: Commit**

```bash
git add nodes/Pncp/Pncp.node.ts tests/pncp/PncpNode.spec.ts
git commit -m "feat(pncp): return partial results when a page fails"
```

---

## Task 7: Retry e cache na consulta de municípios do IBGE

**Files:**
- Modify: `nodes/Pncp/Pncp.node.ts:37-58` (`methods.loadOptions.getCidades`)
- Modify: `tests/pncp/PncpNode.spec.ts`

- [ ] **Step 1: Escreva os testes que falham**

Adicione a `tests/pncp/PncpNode.spec.ts` um novo `describe` no nível do arquivo (fora do `describe('PncpNode')`):

```ts
describe('PncpNode.getCidades', () => {
	const node = new Pncp();

	function contextoLoadOptions(uf: string, mockHttpRequest: any) {
		return {
			getCurrentNodeParameter: jest.fn().mockReturnValue(uf),
			getNode: jest.fn().mockReturnValue({}),
			helpers: { httpRequest: mockHttpRequest },
		} as any;
	}

	it('devolve apenas a opção vazia quando não há UF selecionada', async () => {
		const mockHttpRequest = jest.fn() as any;
		const resultado = await node.methods.loadOptions.getCidades.call(
			contextoLoadOptions('', mockHttpRequest),
		);

		expect(resultado).toEqual([{ name: '- Não Filtrar -', value: '' }]);
		expect(mockHttpRequest).not.toHaveBeenCalled();
	});

	it('ordena os municípios e prepende a opção vazia', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue([
			{ nome: 'Uberlândia', id: 3170206 },
			{ nome: 'Araxá', id: 3104007 },
		]);

		const resultado = await node.methods.loadOptions.getCidades.call(
			contextoLoadOptions('MG', mockHttpRequest),
		);

		expect(resultado).toEqual([
			{ name: '- Não Filtrar -', value: '' },
			{ name: 'Araxá', value: 3104007 },
			{ name: 'Uberlândia', value: 3170206 },
		]);
	});

	it('usa cache na segunda chamada para a mesma UF', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue([{ nome: 'Salvador', id: 2927408 }]);

		const contexto = contextoLoadOptions('BA', mockHttpRequest);
		await node.methods.loadOptions.getCidades.call(contexto);
		await node.methods.loadOptions.getCidades.call(contexto);

		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
	});

	it('retenta antes de desistir e lança mensagem em pt-BR', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockRejectedValue({ response: { statusCode: 503 } });

		await expect(
			node.methods.loadOptions.getCidades.call(contextoLoadOptions('AC', mockHttpRequest)),
		).rejects.toThrow(/IBGE/);

		expect(mockHttpRequest).toHaveBeenCalledTimes(3);
	}, 15000);
});
```

O teste de retry usa o `PERFIL_IBGE` real, com backoff de 500ms e 1s entre as 3 tentativas — daí o timeout de 15s no teste. É a única espera real da suíte, e é curta o suficiente para valer a simplicidade de não injetar `dormir` no node.

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx jest tests/pncp/PncpNode.spec.ts -t getCidades`
Expected: FAIL — sem cache (2 chamadas em vez de 1) e sem retry (1 chamada em vez de 3)

- [ ] **Step 3: Adicione o import de `PERFIL_IBGE`**

No import do transporte em `nodes/Pncp/Pncp.node.ts`, adicione `PERFIL_IBGE`:

```ts
import {
	comRetry,
	lerDelayPaginas,
	lerRetryConfig,
	MAX_FALHAS_CONSECUTIVAS,
	PERFIL_IBGE,
	VERSAO,
} from '../shared/transport';
```

- [ ] **Step 4: Adicione o cache no escopo do módulo**

Logo após os imports em `nodes/Pncp/Pncp.node.ts`, antes de `export class Pncp`:

```ts
/**
 * A lista de municípios do IBGE é estática. Cachear por UF no escopo do
 * módulo elimina a maior parte das chamadas: o dropdown do editor refaz a
 * consulta a cada abertura. O cache vive enquanto o processo do n8n viver.
 */
const cacheCidades = new Map<string, Array<{ name: string; value: number }>>();
```

- [ ] **Step 5: Substitua `getCidades` (`:39-56`)**

Troque:

```ts
			async getCidades(this: ILoadOptionsFunctions) {
				// Entrada vazia permite limpar o filtro de município
				const emptyOption = { name: '- Não Filtrar -', value: '' };

				const uf = this.getCurrentNodeParameter('uf') as string;
				if (!uf) return [emptyOption];

				const response = (await this.helpers.httpRequest({
					method: 'GET',
					url: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
				})) as Array<{ nome: string; id: number }>;

				const cidades = response
					.map((cidade) => ({ name: cidade.nome, value: cidade.id }))
					.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

				return [emptyOption, ...cidades];
			},
```

Por:

```ts
			async getCidades(this: ILoadOptionsFunctions) {
				// Entrada vazia permite limpar o filtro de município
				const emptyOption = { name: '- Não Filtrar -', value: '' };

				const uf = this.getCurrentNodeParameter('uf') as string;
				if (!uf) return [emptyOption];

				const cacheado = cacheCidades.get(uf);
				if (cacheado) return [emptyOption, ...cacheado];

				let response: Array<{ nome: string; id: number }>;
				try {
					response = await comRetry(
						async () =>
							(await this.helpers.httpRequest({
								method: 'GET',
								url: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
								timeout: PERFIL_IBGE.timeoutMs,
								headers: { Accept: 'application/json' },
							})) as Array<{ nome: string; id: number }>,
						PERFIL_IBGE,
					);
				} catch {
					// Falha visível é melhor que um dropdown silenciosamente vazio.
					throw new NodeOperationError(
						this.getNode(),
						`Não foi possível carregar os municípios de ${uf}: o serviço do IBGE está indisponível`,
					);
				}

				const cidades = response
					.map((cidade) => ({ name: cidade.nome, value: cidade.id }))
					.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

				cacheCidades.set(uf, cidades);
				return [emptyOption, ...cidades];
			},
```

- [ ] **Step 6: Rode os testes e confirme que passam**

Run: `npx jest tests/pncp/PncpNode.spec.ts`
Expected: PASS — 11 testes

- [ ] **Step 7: Commit**

```bash
git add nodes/Pncp/Pncp.node.ts tests/pncp/PncpNode.spec.ts
git commit -m "feat(pncp): retry and cache IBGE municipality lookup"
```

---

## Task 8: Timeout e header no node Dados Abertos

**Files:**
- Modify: `nodes/DadosAbertosNode/DadosAbertosNode.node.ts:29-31`

Node declarativo não suporta retry customizado. Recebe o que a API declarativa permite.

- [ ] **Step 1: Substitua o bloco `requestDefaults`**

Troque:

```ts
	  requestDefaults: {
			baseURL: '=https://dadosabertos.compras.gov.br',
		},
```

Por:

```ts
	  requestDefaults: {
			baseURL: '=https://dadosabertos.compras.gov.br',
			timeout: 60000,
			headers: {
				Accept: 'application/json',
			},
		},
```

- [ ] **Step 2: Verifique compilação e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem saída do tsc, sem erros do lint

- [ ] **Step 3: Commit**

```bash
git add nodes/DadosAbertosNode/DadosAbertosNode.node.ts
git commit -m "feat(dados-abertos): set explicit timeout and Accept header"
```

---

## Task 9: Documentação e verificação final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Acrescente a seção ao `README.md`**

Adicione antes da seção de licença (ou ao final, se não houver):

````markdown
## Resiliência de rede

O servidor do PNCP é frequentemente lento e instável. O node trata falhas
transitórias automaticamente, sem quebrar o workflow.

### Configuração (credencial PNCP API)

| Campo | Default | O que faz |
| --- | --- | --- |
| Timeout Por Requisição (Ms) | 60000 | Aborta e retenta requisições mais lentas que isso |
| Máximo De Tentativas | 4 | Total de tentativas, incluindo a primeira |
| Backoff Inicial (Ms) | 1000 | Base da espera exponencial entre tentativas |
| Backoff Máximo (Ms) | 16000 | Teto da espera |
| Intervalo Entre Páginas (Ms) | 200 | Pausa entre páginas no modo "Buscar Todas Páginas" |

Erros `408`, `425`, `429` e `5xx`, além de falhas de conexão (`ECONNRESET`,
`ETIMEDOUT`), são retentados. Erros `4xx` como `400`, `401`, `404` e `422`
falham de imediato: retentar um CNPJ inválido não muda o resultado. Quando o
servidor responde com o header `Retry-After`, ele é respeitado.

### Resultado parcial na paginação

Com "Buscar Todas Páginas" ligado, a saída ganha dois campos:

```json
{
  "data": [],
  "totalRegistros": 250,
  "totalPaginas": 25,
  "paginasBuscadas": 24,
  "limitePaginasAtingido": false,
  "paginasComErro": [7],
  "completo": false
}
```

Se uma página falhar em todas as tentativas, o node registra o número em
`paginasComErro`, marca `completo: false` e continua. Você recebe o que deu
para buscar em vez de perder a execução inteira. Use `completo` em um nó IF
para decidir se reprocessa.

Duas exceções: se a **página 1** falhar, o node lança erro — sem ela não há
`totalPaginas` e não dá para saber o tamanho do que ficou faltando. E se **3
páginas consecutivas** falharem, o node para (*circuit break*): o servidor está
fora, insistir só piora.

### Interação com o "Retry On Fail" do n8n

O node já retenta internamente. Se você também ligar o "Retry On Fail" nas
configurações do node, os dois se multiplicam: com `maxTries: 3` e
`maxTentativas: 4`, uma página pode ser pedida até 12 vezes.

**Recomendação:** deixe o "Retry On Fail" do n8n desligado, ou no máximo em 2.
No modo "Buscar Todas Páginas" ele é especialmente caro, porque reexecuta o
node inteiro e refaz a paginação desde a página 1.
````

- [ ] **Step 2: Rode a verificação completa**

Run: `npx jest && npx tsc --noEmit && npm run lint && npm run build`
Expected: todos os testes passando, sem erros de tipo, sem erros de lint, `dist/` gerado

- [ ] **Step 3: Confirme que o módulo compartilhado foi para o `dist`**

Run: `ls dist/nodes/shared/transport/`
Expected: `config.js`, `executor.js`, `index.js`, `retry.js`, `types.js` e os `.d.ts` correspondentes

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document network resilience behavior and settings"
```

---

## Verificação de cobertura da spec

| Requisito da spec | Task |
| --- | --- |
| 5 campos novos na credencial, com clamp e retrocompatibilidade | 1, 4 |
| `RetryConfig`, `PERFIL_IBGE`, `VERSAO` | 1 |
| Classificação retryável / fatal | 2 |
| `Retry-After` em segundos e HTTP-date | 2 |
| Full jitter com teto | 2 |
| `comRetry` com `dormir` injetável | 3 |
| `timeout`, `Accept`, `User-Agent` | 5 |
| Retry na requisição única | 5 |
| `tentativas` no payload de erro | 5 |
| Página 1 falha → aborta | 6 |
| Página do meio falha → `paginasComErro`, segue | 6 |
| Circuit break em 3 falhas consecutivas | 6 |
| Delay entre páginas jitterado | 6 |
| `paginasComErro` e `completo` na saída | 6 |
| Retry + cache no `getCidades` | 7 |
| `timeout` e `Accept` no Dados Abertos | 8 |
| README com nota sobre retry do n8n | 9 |

## Desvio deliberado da spec

A spec descreve "erro sem status nem código reconhecível" como retryável. A
Task 2 é mais restritiva: um código de erro **conhecido mas não listado**
(`CERT_HAS_EXPIRED`, `ENOTFOUND`) é tratado como **fatal**. São falhas
permanentes — certificado inválido e DNS inexistente não se resolvem em 4
segundos, e retentar só atrasa o erro que o usuário precisa ver. Erro sem
nenhum código continua retryável, como a spec pede.
