import { describe, it, expect, jest } from '@jest/globals';
import type { IExecuteFunctions } from 'n8n-workflow';
import { Pncp } from '../../nodes/Pncp/Pncp.node';

jest.mock('n8n-workflow');

describe('PncpNode', () => {
	const node = new Pncp();

	it('should execute consultarItensPorUsuarioAno operation', async () => {
		const mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			helpers: {
				httpRequest: jest.fn(),
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getInputData: jest.fn().mockReturnValue([{}]),
			getNode: jest.fn().mockReturnValue({}),
		} as unknown as IExecuteFunctions;

		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			baseUrl: 'https://api.pncp.gov.br/api/consulta',
			bearerToken: 'test-token',
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('planoContratacao') // resource
			.mockReturnValueOnce('consultarItensPorUsuarioAno') // operation
			.mockReturnValue(2024) // anoPca
			.mockReturnValue(1) // idUsuario
			.mockReturnValue(undefined) // codigoClassificacaoSuperior
			.mockReturnValue(undefined) // cnpj
			.mockReturnValue(1) // pagina
			.mockReturnValue(10); // tamanhoPagina

		(mockExecuteFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue({ data: 'test' });

		const result = await node.execute.call(mockExecuteFunctions);

		expect(mockExecuteFunctions.helpers.httpRequest).toHaveBeenCalledWith({
			baseURL: 'https://api.pncp.gov.br/api/consulta',
			url: '/v1/pca/usuario',
			method: 'GET',
			qs: { anoPca: 2024, idUsuario: 1, pagina: 1, tamanhoPagina: 10 },
			headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
		});

		expect(result).toEqual([[{ json: { data: 'test' }, pairedItem: { item: 0 } }]]);
	});

	it('should handle error and continue if continueOnFail is true', async () => {
		const mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			helpers: {
				httpRequest: jest.fn().mockRejectedValue(new Error('API Error')),
			},
			continueOnFail: jest.fn().mockReturnValue(true),
			getInputData: jest.fn().mockReturnValue([{}]),
			getNode: jest.fn().mockReturnValue({}),
		} as unknown as IExecuteFunctions;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('planoContratacao');

		const result = await node.execute.call(mockExecuteFunctions);

		expect(result).toEqual([[{ json: { error: 'API Error' }, pairedItem: { item: 0 } }]]);
	});
});
