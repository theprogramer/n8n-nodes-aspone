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
