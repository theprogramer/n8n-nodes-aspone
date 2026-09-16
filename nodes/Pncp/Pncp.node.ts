import type {
	IExecuteFunctions,
	INodeExecutionData,
	NodeConnectionType,
} from 'n8n-workflow';
import {
	INodeType,
	INodeTypeDescription,
	ILoadOptionsFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import { pncpProperties } from './descriptions/PncpDescription';
import {
	comRetry,
	esperar,
	extrairStatus,
	lerDelayPaginas,
	lerRetryConfig,
	MAX_FALHAS_CONSECUTIVAS,
	PERFIL_IBGE,
	VERSAO,
} from '../shared/transport';

/**
 * A lista de municípios do IBGE é estática. Cachear por UF no escopo do
 * módulo elimina a maior parte das chamadas: o dropdown do editor refaz a
 * consulta a cada abertura. O cache vive enquanto o processo do n8n viver.
 */
const cacheCidades = new Map<string, Array<{ name: string; value: number }>>();

type MunicipioIBGE = { nome: string; id: number };

/**
 * Sem essa validação, um corpo inesperado ou vira TypeError cru (se não for
 * array) ou entra no cache e contamina o dropdown pelo resto do processo
 * (se for array com itens malformados) — o cache não tem invalidação.
 */
function ehListaDeMunicipios(valor: unknown): valor is MunicipioIBGE[] {
	return (
		Array.isArray(valor) &&
		valor.every(
			(item) =>
				!!item &&
				typeof (item as MunicipioIBGE).nome === 'string' &&
				typeof (item as MunicipioIBGE).id === 'number',
		)
	);
}

export class Pncp implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PNCP',
		name: 'pncp',
		icon: 'file:pncp.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interage com a API do Portal Nacional de Contratações Públicas (PNCP)',
		defaults: {
			name: 'PNCP',
		},
		inputs: ['main'] as [NodeConnectionType],
		outputs: ['main'] as [NodeConnectionType],
		credentials: [
			{
				name: 'pncpApi',
				required: true,
			},
		],
		properties: pncpProperties,
	};

	methods = {
		loadOptions: {
			async getCidades(this: ILoadOptionsFunctions) {
				// Entrada vazia permite limpar o filtro de município
				const emptyOption = { name: '- Não Filtrar -', value: '' };

				const uf = this.getCurrentNodeParameter('uf') as string;
				if (!uf) return [emptyOption];

				const cacheado = cacheCidades.get(uf);
				if (cacheado) return [emptyOption, ...cacheado];

				let response: MunicipioIBGE[];
				try {
					response = await comRetry(
						async () =>
							(await this.helpers.httpRequest({
								method: 'GET',
								url: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
								timeout: PERFIL_IBGE.timeoutMs,
								headers: { Accept: 'application/json' },
							})) as MunicipioIBGE[],
						PERFIL_IBGE,
					);
				} catch (erro) {
					const status = extrairStatus(erro);
					const causa =
						status !== undefined
							? `HTTP ${status}`
							: (erro as { code?: string })?.code ?? (erro as Error)?.message ?? 'causa desconhecida';
					const tentativas = (erro as { tentativas?: number })?.tentativas ?? PERFIL_IBGE.maxTentativas;

					// Falha visível é melhor que um dropdown silenciosamente vazio.
					throw new NodeOperationError(
						this.getNode(),
						`Não foi possível carregar os municípios de ${uf}: o serviço do IBGE está indisponível`,
						{ description: `Falhou após ${tentativas} tentativas (${causa})` },
					);
				}

				if (!ehListaDeMunicipios(response)) {
					// Sem isso, um corpo inesperado ou vira TypeError cru, ou entra
					// no cache e contamina o dropdown pelo resto do processo.
					throw new NodeOperationError(
						this.getNode(),
						`Resposta inesperada do IBGE ao carregar os municípios de ${uf}`,
					);
				}

				const cidades = response
					.map((cidade) => ({ name: cidade.nome, value: cidade.id }))
					.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

				cacheCidades.set(uf, cidades);
				return [emptyOption, ...cidades];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('pncpApi');
		const baseUrl = credentials.baseUrl as string;
		const retryConfig = lerRetryConfig(credentials);
		const delayPaginas = lerDelayPaginas(credentials);

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

		const formatDateToYYYYMMDD = (dateStr: string): string => {
			if (!dateStr) return '';
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return '';
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}${month}${day}`;
		};

		let endpoint = '';
		let qs: Record<string, string | number> = {};

		try {
			if (resource === 'planoContratacao') {
				if (operation === 'consultarItensPorUsuarioAno') {
					endpoint = '/v1/pca/usuario';
					qs = {
						anoPca: this.getNodeParameter('anoPca', 0) as number,
						idUsuario: this.getNodeParameter('idUsuario', 0) as number,
						codigoClassificacaoSuperior: this.getNodeParameter('codigoClassificacaoSuperior', 0) as string,
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				} else if (operation === 'consultarPorDataAtualizacao') {
					endpoint = '/v1/pca/atualizacao';
					qs = {
						dataInicio: formatDateToYYYYMMDD(this.getNodeParameter('dataInicio', 0) as string),
						dataFim: formatDateToYYYYMMDD(this.getNodeParameter('dataFim', 0) as string),
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						codigoUnidade: this.getNodeParameter('codigoUnidade', 0) as string,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				} else if (operation === 'consultarItensPorAno') {
					endpoint = '/v1/pca';
					qs = {
						anoPca: this.getNodeParameter('anoPca', 0) as number,
						codigoClassificacaoSuperior: this.getNodeParameter('codigoClassificacaoSuperior', 0) as string,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				}
			} else if (resource === 'contratacao') {
				if (operation === 'consultarPorId') {
					const cnpj = this.getNodeParameter('cnpj', 0) as string;
					const ano = this.getNodeParameter('ano', 0) as number;
					const sequencial = this.getNodeParameter('sequencial', 0) as number;
					endpoint = `/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`;
					qs = {};
				} else if (operation === 'consultarPorDataPublicacao') {
					endpoint = '/v1/contratacoes/publicacao';
					const codigoModalidadeContratacaoStr = this.getNodeParameter('codigoModalidadeContratacao', 0) as string;
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						codigoModoDisputa: this.getNodeParameter('codigoModoDisputa', 0) as number | string,
						uf: this.getNodeParameter('uf', 0) as string,
						codigoMunicipioIbge: this.getNodeParameter('codigoMunicipioIbge', 0) as string | number,
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						idUsuario: this.getNodeParameter('idUsuario', 0) as number,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
					if (codigoModalidadeContratacaoStr) {
						qs.codigoModalidadeContratacao = Number(codigoModalidadeContratacaoStr);
					}
				} else if (operation === 'consultarPorPeriodoPropostas') {
					endpoint = '/v1/contratacoes/proposta';
					const codigoModalidadeContratacaoStr = this.getNodeParameter('codigoModalidadeContratacao', 0) as string;
					qs = {
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						uf: this.getNodeParameter('uf', 0) as string,
						codigoMunicipioIbge: this.getNodeParameter('codigoMunicipioIbge', 0) as string | number,
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						idUsuario: this.getNodeParameter('idUsuario', 0) as number,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
					if (codigoModalidadeContratacaoStr) {
						qs.codigoModalidadeContratacao = Number(codigoModalidadeContratacaoStr);
					}
				} else if (operation === 'consultarPorDataAtualizacao') {
					endpoint = '/v1/contratacoes/atualizacao';
					const codigoModalidadeContratacaoStr = this.getNodeParameter('codigoModalidadeContratacao', 0) as string;
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						codigoModoDisputa: this.getNodeParameter('codigoModoDisputa', 0) as number | string,
						uf: this.getNodeParameter('uf', 0) as string,
						codigoMunicipioIbge: this.getNodeParameter('codigoMunicipioIbge', 0) as string | number,
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						idUsuario: this.getNodeParameter('idUsuario', 0) as number,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
					if (codigoModalidadeContratacaoStr) {
						qs.codigoModalidadeContratacao = Number(codigoModalidadeContratacaoStr);
					}
				}
			} else if (resource === 'contrato') {
				if (operation === 'consultarPorDataPublicacao') {
					endpoint = '/v1/contratos';
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						cnpjOrgao: this.getNodeParameter('cnpjOrgao', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						usuarioId: this.getNodeParameter('usuarioId', 0) as number,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				} else if (operation === 'consultarPorDataAtualizacao') {
					endpoint = '/v1/contratos/atualizacao';
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						cnpjOrgao: this.getNodeParameter('cnpjOrgao', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						usuarioId: this.getNodeParameter('usuarioId', 0) as number,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				}
			} else if (resource === 'instrumentoCobranca') {
				if (operation === 'consultarPorDataInclusao') {
					endpoint = '/v1/instrumentoscobranca/inclusao';
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						tipoInstrumentoCobranca: this.getNodeParameter('tipoInstrumentoCobranca', 0) as number | string,
						cnpjOrgao: this.getNodeParameter('cnpjOrgao', 0) as string,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				}
			} else if (resource === 'ata') {
				if (operation === 'consultarPorPeriodoVigencia') {
					endpoint = '/v1/atas';
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						idUsuario: this.getNodeParameter('idUsuario', 0) as number,
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				} else if (operation === 'consultarPorDataAtualizacao') {
					endpoint = '/v1/atas/atualizacao';
					qs = {
						dataInicial: formatDateToYYYYMMDD(this.getNodeParameter('dataInicial', 0) as string),
						dataFinal: formatDateToYYYYMMDD(this.getNodeParameter('dataFinal', 0) as string),
						idUsuario: this.getNodeParameter('idUsuario', 0) as number,
						cnpj: this.getNodeParameter('cnpj', 0) as string,
						codigoUnidadeAdministrativa: this.getNodeParameter('codigoUnidadeAdministrativa', 0) as string,
						pagina: this.getNodeParameter('pagina', 0) as number,
						tamanhoPagina: this.getNodeParameter('tamanhoPagina', 0) as number,
					};
				}
			}

			// Remove keys that are undefined, empty string, or 0 (optional fields not filled)
			const cleanQs = (input: Record<string, string | number>) => {
				const out: Record<string, string | number> = {};
				Object.keys(input).forEach((key) => {
					const value = input[key];
					if (value !== undefined && value !== '' && value !== 0) out[key] = value;
				});
				return out;
			};

			// Read pagination toggle (default false — preserves backward compatibility)
			let returnAll = false;
			let limitePaginas = 10;
			try {
				returnAll = this.getNodeParameter('returnAll', 0, false) as boolean;
				limitePaginas = this.getNodeParameter('limitePaginas', 0, 10) as number;
			} catch {
				// Parameters not defined for this operation; keep defaults
			}

			const isPaginated = qs.tamanhoPagina !== undefined && qs.tamanhoPagina !== 0;

			if (returnAll && isPaginated && endpoint) {
				const allData: unknown[] = [];
				const paginasComErro: number[] = [];
				let totalRegistros = 0;
				let totalPaginas = 1;
				let paginasBuscadas = 0;
				let limiteAtingido = false;
				let falhasConsecutivas = 0;

				// `let` no for dá um binding novo por iteração, então o closure do
				// comRetry enxerga a página daquela volta e não o estado final do laço.
				for (let paginaAtual = 1; ; paginaAtual++) {
					try {
						const response = await comRetry(
							() =>
								this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
									...options,
									url: endpoint,
									qs: cleanQs({ ...qs, pagina: paginaAtual }),
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
						if (paginaAtual === 1) throw erroPagina;

						paginasComErro.push(paginaAtual);
						falhasConsecutivas++;
					}

					// A ordem destas três saídas importa: `limitePaginas` é a única
					// que marca uma flag na saída, então fica por último para não
					// sobrescrever um motivo de parada mais específico. Condição
					// nova que também sinalize algo entra acima dela.
					// Circuit break: o servidor está fora, insistir só piora.
					if (falhasConsecutivas >= MAX_FALHAS_CONSECUTIVAS) break;
					if (paginaAtual >= totalPaginas) break;
					// paginaAtual é a contagem de páginas tentadas, incluindo as que falharam.
					if (paginaAtual >= limitePaginas) {
						limiteAtingido = true;
						break;
					}
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
				const response = await comRetry(
					() =>
						this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
							...options,
							url: endpoint,
							qs: cleanQs(qs),
						}),
					retryConfig,
				);

				returnData.push({
					json: response,
					pairedItem: { item: 0 },
				});
			}
		} catch (error) {
			const err = error as any;

			const statusCode = err?.response?.statusCode;
			const serverBody = err?.response?.body;
			const serverMessage =
				serverBody?.message ||
				serverBody?.error ||
				serverBody?.mensagem ||
				err.message;

			const errorPayload = {
				success: false,
				statusCode,
				message: serverMessage,
				serverResponse: serverBody,
				tentativas: err?.tentativas,
			};

			if (this.continueOnFail()) {
				returnData.push({
					json: errorPayload,
					pairedItem: { item: 0 },
				});
			} else {
				throw new NodeOperationError(this.getNode(), errorPayload, {
					description: serverMessage,
				});
			}
		}

		return [returnData];
	}
}
