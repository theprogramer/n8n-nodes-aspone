import { describe, it, expect, jest } from '@jest/globals';
import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
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

		await expect(node.execute.call(contextoPaginado(mockHttpRequest))).rejects.toBeInstanceOf(
			NodeOperationError,
		);
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

describe('PncpNode.getCidades', () => {
	// `cacheCidades` é module-level e não é exposto para os testes. Por isso
	// cada teste deste describe precisa usar uma UF que nenhum outro teste
	// usa — reaproveitar uma UF faz o teste acertar por acidente, batendo no
	// cache em vez de exercitar o código que deveria testar.
	const node = new Pncp();

	function contextoLoadOptions(uf: string, mockHttpRequest: any) {
		return {
			getCurrentNodeParameter: jest.fn().mockReturnValue(uf),
			getNode: jest.fn().mockReturnValue({}),
			helpers: { httpRequest: mockHttpRequest },
		} as any;
	}

	it('devolve apenas a opção vazia quando não há UF selecionada', async () => {
		const mockHttpRequest = jest.fn() as any;
		const resultado = await node.methods.loadOptions.getCidades.call(
			contextoLoadOptions('', mockHttpRequest),
		);

		expect(resultado).toEqual([{ name: '- Não Filtrar -', value: '' }]);
		expect(mockHttpRequest).not.toHaveBeenCalled();
	});

	it('ordena os municípios e prepende a opção vazia', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue([
			{ nome: 'Uberlândia', id: 3170206 },
			{ nome: 'Araxá', id: 3104007 },
		]);

		const resultado = await node.methods.loadOptions.getCidades.call(
			contextoLoadOptions('MG', mockHttpRequest),
		);

		expect(resultado).toEqual([
			{ name: '- Não Filtrar -', value: '' },
			{ name: 'Araxá', value: 3104007 },
			{ name: 'Uberlândia', value: 3170206 },
		]);
	});

	it('usa cache na segunda chamada para a mesma UF', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue([{ nome: 'Salvador', id: 2927408 }]);

		const contexto = contextoLoadOptions('BA', mockHttpRequest);
		await node.methods.loadOptions.getCidades.call(contexto);
		await node.methods.loadOptions.getCidades.call(contexto);

		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
	});

	it('retenta antes de desistir e lança mensagem em pt-BR', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockRejectedValue({ response: { statusCode: 503 } });

		await expect(
			node.methods.loadOptions.getCidades.call(contextoLoadOptions('AC', mockHttpRequest)),
		).rejects.toBeInstanceOf(NodeOperationError);

		expect(mockHttpRequest).toHaveBeenCalledTimes(3);

		// O automock de `n8n-workflow` não roda o construtor real, então a
		// instância sai com `message` vazia e nem é `instanceof Error`.
		// A mensagem só pode ser verificada no argumento do construtor.
		expect(NodeOperationError).toHaveBeenLastCalledWith(
			expect.anything(),
			expect.stringContaining('IBGE'),
			expect.objectContaining({ description: expect.stringContaining('tentativas') }),
		);
	}, 15000);

	it('rejeita corpo que não é uma lista, sem TypeError cru', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue({ erro: 'UF inválida' });

		await expect(
			node.methods.loadOptions.getCidades.call(contextoLoadOptions('RJ', mockHttpRequest)),
		).rejects.toBeInstanceOf(NodeOperationError);

		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
	});

	it('rejeita e não cacheia lista com itens sem nome/id', async () => {
		const mockHttpRequest = jest.fn() as any;
		mockHttpRequest.mockResolvedValue([{ nome: 'Curitiba' }, { id: 4106902 }]);

		const contexto = contextoLoadOptions('PR', mockHttpRequest);

		await expect(
			node.methods.loadOptions.getCidades.call(contexto),
		).rejects.toBeInstanceOf(NodeOperationError);
		expect(mockHttpRequest).toHaveBeenCalledTimes(1);

		// Nada foi cacheado: uma segunda chamada para a mesma UF refaz a requisição.
		await expect(
			node.methods.loadOptions.getCidades.call(contexto),
		).rejects.toBeInstanceOf(NodeOperationError);
		expect(mockHttpRequest).toHaveBeenCalledTimes(2);
	});
});
