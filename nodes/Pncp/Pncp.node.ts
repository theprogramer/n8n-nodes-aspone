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

				const response = (await this.helpers.httpRequest({
					method: 'GET',
					url: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
				})) as Array<{ nome: string; id: number }>;

				const cidades = response
					.map((cidade) => ({ name: cidade.nome, value: cidade.id }))
					.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

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

		const options = {
			baseURL: baseUrl,
			headers: {
				'Content-Type': 'application/json',
			},
			method: 'GET' as const,
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
			Object.keys(qs).forEach((key) => {
				const value = qs[key];
				if (value === undefined || value === '' || value === 0) {
					delete qs[key];
				}
			});

			const response = await this.helpers.httpRequestWithAuthentication.call(this, 'pncpApi', {
				...options,
				url: endpoint,
				qs,
			});

			returnData.push({
				json: response,
				pairedItem: {
					item: 0,
				},
			});
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
