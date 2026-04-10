import type {
	// IExecuteFunctions,
	// INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import {
  legacyFields,
	legacyOperations,
} from './descriptions';

export class DadosAbertosNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dados Abertos Node',
		name: 'dadosAbertosNode',
		icon: 'file:dadosAbertos.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Basic Example Node',
		defaults: {
			name: 'Example Node',
		},
		inputs: ['main'] as [NodeConnectionType],
		outputs: ['main'] as [NodeConnectionType],
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
