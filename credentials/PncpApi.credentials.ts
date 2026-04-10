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
	];
}
