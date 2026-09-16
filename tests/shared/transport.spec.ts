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
