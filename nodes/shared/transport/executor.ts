import { calcularEspera, classificarErro, extrairRetryAfterMs } from './retry';
import type { RetryConfig } from './types';

export const esperar = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

function anexarTentativas(erro: unknown, tentativas: number): void {
	if (!erro || typeof erro !== 'object') return;
	try {
		(erro as { tentativas?: number }).tentativas = tentativas;
	} catch {
		// Erro congelado: seguir sem a contagem é melhor que mascarar a falha real
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
	if (!Number.isFinite(cfg.maxTentativas) || cfg.maxTentativas < 1) {
		throw new Error(`maxTentativas deve ser >= 1, recebido: ${cfg.maxTentativas}`);
	}

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
