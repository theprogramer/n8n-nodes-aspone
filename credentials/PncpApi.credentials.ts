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
