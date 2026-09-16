import { describe, it, expect, jest } from '@jest/globals';
import type { IExecuteFunctions } from 'n8n-workflow';
import { Pncp } from '../../nodes/Pncp/Pncp.node';

jest.mock('n8n-workflow');

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('PncpNode', () => {
	const node = new Pncp();

	it('should execute consultarItensPorUsuarioAno operation', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue({ data: 'test' });

		const mockExecuteFunctions = {
			getNodeParameter: jest.fn() as any,
			getCredentials: jest.fn() as any,
			helpers: {
				httpRequestWithAuthentication: mockHttpRequest,
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getInputData: jest.fn().mockReturnValue([{}]),
			getNode: jest.fn().mockReturnValue({}),
		} as unknown as IExecuteFunctions;

		(mockExecuteFunctions.getCredentials as any).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			bearerToken: 'test-token',
			backoffInicialMs: 0,
			backoffMaxMs: 0,
			delayEntrePaginasMs: 0,
		});

		(mockExecuteFunctions.getNodeParameter as any)
			.mockReturnValueOnce('planoContratacao') // resource
			.mockReturnValueOnce('consultarItensPorUsuarioAno') // operation
			.mockReturnValueOnce(2024) // anoPca
			.mockReturnValueOnce(1) // idUsuario
			.mockReturnValueOnce('') // codigoClassificacaoSuperior
			.mockReturnValueOnce('') // cnpj
			.mockReturnValueOnce(1) // pagina
			.mockReturnValueOnce(10); // tamanhoPagina

		const result = await node.execute.call(mockExecuteFunctions);

		expect(mockHttpRequest).toHaveBeenCalledWith(
			'pncpApi',
			{
				baseURL: 'https://api.pncp.gov.br/api/consulta',
				url: '/v1/pca/usuario',
				method: 'GET',
				timeout: 60000,
				qs: { anoPca: 2024, idUsuario: 1, pagina: 1, tamanhoPagina: 10 },
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'User-Agent': 'n8n-nodes-aspone/0.1.3',
				},
			}
		);

		expect(result).toEqual([[{ json: { data: 'test' }, pairedItem: { item: 0 } }]]);
	});

	it('should handle error and continue if continueOnFail is true', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockRejectedValue(new Error('API Error'));

		const mockExecuteFunctions = {
			getNodeParameter: jest.fn() as any,
			getCredentials: jest.fn() as any,
			helpers: {
				httpRequestWithAuthentication: mockHttpRequest,
			},
			continueOnFail: jest.fn().mockReturnValue(true),
			getInputData: jest.fn().mockReturnValue([{}]),
			getNode: jest.fn().mockReturnValue({}),
		} as unknown as IExecuteFunctions;

		(mockExecuteFunctions.getCredentials as any).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			maxTentativas: 1,
			backoffInicialMs: 0,
			backoffMaxMs: 0,
			delayEntrePaginasMs: 0,
		});

		(mockExecuteFunctions.getNodeParameter as any)
			.mockReturnValueOnce('planoContratacao') // resource
			.mockReturnValueOnce('consultarItensPorUsuarioAno'); // operation
		// Params restantes (incluindo tamanhoPagina e returnAll) ficam undefined
		// pelo default do mock — isPaginated some e a via não paginada é usada.

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{
			json: {
				success: false,
				statusCode: undefined,
				message: 'API Error',
				serverResponse: undefined,
				tentativas: 1,
			},
			pairedItem: { item: 0 },
		}]]);
	});

	/**
	 * Monta um contexto de execução para `consultarItensPorAno` com returnAll
	 * ligado. A sequência de respostas por página vem do `mockHttpRequest`.
	 */
	function contextoPaginado(mockHttpRequest: any, limitePaginas = 10) {
		const mockExecuteFunctions = {
			getNodeParameter: jest.fn() as any,
			getCredentials: jest.fn() as any,
			helpers: { httpRequestWithAuthentication: mockHttpRequest },
			continueOnFail: jest.fn().mockReturnValue(false),
			getInputData: jest.fn().mockReturnValue([{}]),
			getNode: jest.fn().mockReturnValue({}),
		} as unknown as IExecuteFunctions;

		(mockExecuteFunctions.getCredentials as any).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			maxTentativas: 1,
			backoffInicialMs: 0,
			backoffMaxMs: 0,
			delayEntrePaginasMs: 0,
		});

		(mockExecuteFunctions.getNodeParameter as any).mockImplementation(
			(nome: string, _indice: number, padrao?: unknown) => {
				const valores: Record<string, unknown> = {
					resource: 'planoContratacao',
					operation: 'consultarItensPorAno',
					anoPca: 2024,
					codigoClassificacaoSuperior: '',
					pagina: 1,
					tamanhoPagina: 10,
					returnAll: true,
					limitePaginas,
				};
				return nome in valores ? valores[nome] : padrao;
			},
		);

		return mockExecuteFunctions;
	}

	const pagina = (numero: number, totalPaginas: number) => ({
		data: [`item-${numero}`],
		totalRegistros: totalPaginas * 10,
		totalPaginas,
	});

	it('devolve resultado parcial quando uma página do meio falha', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest
			.mockResolvedValueOnce(pagina(1, 3))
			.mockRejectedValueOnce({ response: { statusCode: 504 } })
			.mockResolvedValueOnce(pagina(3, 3));

		const result = await node.execute.call(contextoPaginado(mockHttpRequest));

		expect(result[0][0].json).toEqual({
			data: ['item-1', 'item-3'],
			totalRegistros: 30,
			totalPaginas: 3,
			paginasBuscadas: 2,
			limitePaginasAtingido: false,
			paginasComErro: [2],
			completo: false,
		});
	});

	it('marca completo quando todas as páginas vêm', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValueOnce(pagina(1, 2)).mockResolvedValueOnce(pagina(2, 2));

		const result = await node.execute.call(contextoPaginado(mockHttpRequest));

		expect(result[0][0].json).toEqual({
			data: ['item-1', 'item-2'],
			totalRegistros: 20,
			totalPaginas: 2,
			paginasBuscadas: 2,
			limitePaginasAtingido: false,
			paginasComErro: [],
			completo: true,
		});
	});

	it('lança erro quando a página 1 falha, pois não há totalPaginas', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockRejectedValue({ response: { statusCode: 504 } });

		await expect(node.execute.call(contextoPaginado(mockHttpRequest))).rejects.toBeDefined();
		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
	});

	it('aciona o circuit break após 3 páginas consecutivas com falha', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest
			.mockResolvedValueOnce(pagina(1, 10))
			.mockRejectedValue({ response: { statusCode: 503 } });

		const result = await node.execute.call(contextoPaginado(mockHttpRequest));

		// página 1 ok, páginas 2/3/4 falham e param o laço
		expect(mockHttpRequest).toHaveBeenCalledTimes(4);
		expect(result[0][0].json).toMatchObject({
			data: ['item-1'],
			paginasComErro: [2, 3, 4],
			completo: false,
		});
	});

	it('respeita limitePaginas contando páginas tentadas, não só as bem-sucedidas', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest
			.mockResolvedValueOnce(pagina(1, 10))
			.mockRejectedValueOnce({ response: { statusCode: 504 } })
			.mockResolvedValueOnce(pagina(3, 10));

		const result = await node.execute.call(contextoPaginado(mockHttpRequest, 3));

		expect(mockHttpRequest).toHaveBeenCalledTimes(3);
		expect(result[0][0].json).toMatchObject({
			paginasBuscadas: 2,
			paginasComErro: [2],
			limitePaginasAtingido: true,
			completo: false,
		});
	});
});
