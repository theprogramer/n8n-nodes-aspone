import { describe, it, expect } from '@jest/globals';
import { PncpApi } from '../../credentials/PncpApi.credentials';
import { lerDelayPaginas, lerRetryConfig } from '../../nodes/shared/transport/config';

/**
 * As faixas dos campos numéricos existem em dois lugares: no `typeOptions` da
 * credencial (o que a UI do n8n deixa o usuário salvar) e em `FAIXAS` dentro de
 * `config.ts` (o que o leitor aceita sem reescrever). Se os dois divergirem, a
 * UI passa a aceitar um valor que o leitor silenciosamente troca por outro, e
 * nada avisa. Estes testes fecham a porta contra essa divergência.
 */
describe('PncpApi: faixas da credencial vs leitor', () => {
	const credencial = new PncpApi();

	const leitores: Record<string, (c: Record<string, unknown>) => number> = {
		timeoutMs: (c) => lerRetryConfig(c).timeoutMs,
		maxTentativas: (c) => lerRetryConfig(c).maxTentativas,
		backoffInicialMs: (c) => lerRetryConfig(c).backoffInicialMs,
		backoffMaxMs: (c) => lerRetryConfig(c).backoffMaxMs,
		delayEntrePaginasMs: (c) => lerDelayPaginas(c),
	};

	const campoDa = (nome: string) => {
		const campo = credencial.properties.find((p) => p.name === nome);
		if (!campo) throw new Error(`Campo ${nome} não existe mais na credencial`);
		return campo;
	};

	it.each(Object.keys(leitores))('o leitor preserva os extremos da UI em %s', (nome) => {
		const { minValue, maxValue } = campoDa(nome).typeOptions ?? {};

		expect(typeof minValue).toBe('number');
		expect(typeof maxValue).toBe('number');
		expect(leitores[nome]({ [nome]: minValue })).toBe(minValue);
		expect(leitores[nome]({ [nome]: maxValue })).toBe(maxValue);
	});

	it.each(Object.keys(leitores))('o default da UI bate com o do leitor em %s', (nome) => {
		expect(leitores[nome]({})).toBe(campoDa(nome).default);
	});

	it('mantém baseUrl como campo oculto', () => {
		const baseUrl = campoDa('baseUrl');
		expect(baseUrl.type).toBe('hidden');
		expect(baseUrl.default).toBe('https://pncp.gov.br/api/consulta');
	});
});
