import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { lerRetryConfig, lerDelayPaginas, PERFIL_IBGE } from '../../nodes/shared/transport/config';
import {
	calcularEspera,
	classificarErro,
	extrairRetryAfterMs,
	extrairStatus,
} from '../../nodes/shared/transport/retry';
import type { RetryConfig } from '../../nodes/shared/transport/types';
import { comRetry } from '../../nodes/shared/transport/executor';

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
			timeoutMs: 5000,
			maxTentativas: 3,
			backoffInicialMs: 300,
			backoffMaxMs: 2000,
		});
	});
});

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

	it.each(['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EAI_AGAIN', 'EPIPE', 'ECONNABORTED', 'ECONNREFUSED'])(
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

	it('com random em 0.5, a espera é metade do teto (jitter uniforme)', () => {
		jest.spyOn(Math, 'random').mockReturnValue(0.5);
		expect(calcularEspera(3, cfg)).toBe(2000);
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
		const erro: Record<string, unknown> = { response: { statusCode: 504 } };
		const operacao = jest.fn<() => Promise<string>>().mockRejectedValue(erro);

		await expect(comRetry(operacao, { ...cfg, maxTentativas: 1 }, dormir)).rejects.toBe(erro);

		expect(operacao).toHaveBeenCalledTimes(1);
		expect(esperas).toEqual([]);
		expect(erro.tentativas).toBe(1);
	});

	it('rejeita maxTentativas inválido em vez de lançar undefined', async () => {
		const { esperas, dormir } = espiaoDeEspera();
		const operacao = jest.fn<() => Promise<string>>().mockResolvedValue('ok');

		await expect(comRetry(operacao, { ...cfg, maxTentativas: 0 }, dormir)).rejects.toThrow(
			/maxTentativas/,
		);

		expect(operacao).not.toHaveBeenCalled();
		expect(esperas).toEqual([]);
	});
});

