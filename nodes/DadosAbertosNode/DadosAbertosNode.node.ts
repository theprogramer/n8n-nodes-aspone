import type {
	// IExecuteFunctions,
	// INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import {
	NodeConnectionType,
	// NodeOperationError
} from 'n8n-workflow';

import {
  legacyFields,
	legacyOperations,
} from './descriptions';

export class DadosAbertosNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dados Abertos Node',
		name: 'dadosAbertosNode',
		icon: 'file:dados-abertos.png',
		group: ['transform'],
		version: 1,
		description: 'Basic Example Node',
		defaults: {
			name: 'Example Node',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
	  requestDefaults: {
			baseURL: '=https://dadosabertos.compras.gov.br',
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Legacy',
						value: 'legacy',
					},
				],
				default: 'legacy',
			},
			...legacyOperations,
			...legacyFields,
		],
	};
}
