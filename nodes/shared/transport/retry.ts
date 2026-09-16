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
	'ECONNABORTED', // axios: client-side timeout (primary PNCP failure mode)
	'ECONNREFUSED', // server restarting or briefly down
	// Note: ENOTFOUND (DNS) and CERT_HAS_EXPIRED stay fatal — they will not fix themselves in retry window
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
