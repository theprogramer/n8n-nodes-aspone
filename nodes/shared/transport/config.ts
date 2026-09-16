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

/** Campos configuráveis: os do RetryConfig mais o delay de paginação */
type CampoConfig = keyof RetryConfig | 'delayEntrePaginasMs';

const FAIXAS: Record<CampoConfig, Faixa> = {
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
