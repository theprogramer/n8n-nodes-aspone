import type { INodeProperties } from 'n8n-workflow';

export const legacyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['legacy'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a tender',
        routing: {
				  request: {
            method: 'GET',
						url: '=/modulo-legado/1.1_consultarLicitacao_Id?id_compra={{$parameter["id_compra"]}}',
					},
          output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
								  property: 'resultado',
							  },
						  },
						],
					},
		  	},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tenders',
        routing: {
				  request: {
            method: 'GET',
						url: '=/modulo-legado/1_consultarLicitacao',
						qs: {
					    data_publicacao_inicial: '={{$parameter.data_publicacao_inicial}}',
					    data_publicacao_final: '={{$parameter.data_publicacao_final}}',
					    uasg: '={{$parameter.uasg || undefined}}',
							numero_aviso: '={{$parameter.numero_aviso || undefined}}',
							modalidade: '={{$parameter.modalidade || undefined}}',
							pertence14133: '={{$parameter.pertence14133 || undefined}}'
						}
					},
          output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
								  property: 'resultado',
							  },
						  },
						],
					},
		  	},
			},
		],
		default: 'get',
	},
];

export const legacyFields: INodeProperties[] = [
	{
		displayName: 'Tender Id',
		description: 'ID Compra',
		name: 'id_compra',
		default: '',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['get'],
			},
		},
	},
  {
    displayName: 'End Date',
    name: 'data_publicacao_inicial',
    type: 'dateTime',
    default: '={{ $now.minus({ months: 6 }).toFormat("yyyy-MM-dd") }}',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['getAll'],
			},
		},
  },
	{
    displayName: 'End Date',
    name: 'data_publicacao_final',
    type: 'dateTime',
    default: '={{ $now.plus({ days: 1 }).toFormat("yyyy-MM-dd") }}',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['getAll'],
			},
		},
  },
	{
		displayName: 'UASG',
		name: 'uasg',
		default: '',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Notice Number',
		name: 'numero_aviso',
		default: '',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Modality',
		name: 'modalidade',
		default: '',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Subject to Law 14.133',
		name: 'pertence14133',
		default: 'true',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['legacy'],
				operation: ['getAll'],
			},
		},
	},
];
