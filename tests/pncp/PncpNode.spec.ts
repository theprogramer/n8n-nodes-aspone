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
			'pncpCredential',
			{
				baseURL: 'https://api.pncp.gov.br/api/consulta',
				url: '/v1/pca/usuario',
				method: 'GET',
				qs: { anoPca: 2024, idUsuario: 1, pagina: 1, tamanhoPagina: 10 },
				headers: { 'Content-Type': 'application/json' },
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
		});

		(mockExecuteFunctions.getNodeParameter as any)
			.mockReturnValueOnce('planoContratacao') // resource
			.mockReturnValue('consultarItensPorUsuarioAno'); // operation + remaining params

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{
			json: {
				success: false,
				statusCode: undefined,
				message: 'API Error',
				serverResponse: undefined,
			},
			pairedItem: { item: 0 },
		}]]);
	});
});
