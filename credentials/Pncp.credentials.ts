import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class Pncp implements ICredentialType {
	name = 'pncpCredential';
	displayName = 'PNCP Credential';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'hidden',
			default: 'https://pncp.gov.br/api/consulta',
			description: 'A URL base da API PNCP',
		}
	];
}
