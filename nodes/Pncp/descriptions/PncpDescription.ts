import { INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

export const pncpDescription: INodeTypeDescription = {
	displayName: 'PNCP',
	name: 'pncp',
	icon: 'file:../../../icons/pncp.png',
	group: ['transform'],
	version: 1,
	description: 'Interage com a API do Portal Nacional de Contratações Públicas (PNCP)',
	defaults: {
		name: 'PNCP',
	},
	inputs: ['main'] as [NodeConnectionType],
	outputs: ['main'] as [NodeConnectionType],
	credentials: [
		{
			name: 'pncpCredential',
			required: true,
		},
	],
	properties: [
		{
			displayName: 'Recurso',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'Plano de Contratação',
					value: 'planoContratacao',
				},
				{
					name: 'Contratação',
					value: 'contratacao',
				},
				{
					name: 'Contrato/Empenho',
					value: 'contrato',
				},
				{
					name: 'Instrumento de Cobrança',
					value: 'instrumentoCobranca',
				},
				{
					name: 'Ata de Registro de Preços',
					value: 'ata',
				},
			],
			default: 'planoContratacao',
			required: true,
			description: 'O recurso para operar',
		},
		{
			displayName: 'Operação',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
				},
			},
			options: [
				{
					name: 'Consultar Itens por Usuário e Ano',
					value: 'consultarItensPorUsuarioAno',
					description: 'Consultar Itens de PCA por Ano do PCA, IdUsuario e Código de Classificação Superior',
				},
				{
					name: 'Consultar por Data de Atualização',
					value: 'consultarPorDataAtualizacao',
					description: 'Consultar PCA por Data de Atualização Global',
				},
				{
					name: 'Consultar Itens por Ano',
					value: 'consultarItensPorAno',
					description: 'Consultar Itens de PCA por Ano do PCA e Código de Classificação Superior',
				},
			],
			default: 'consultarItensPorUsuarioAno',
			required: true,
			description: 'A operação a executar',
		},
		// Parâmetros para planoContratacao - consultarItensPorUsuarioAno
		{
			displayName: 'Ano do PCA',
			name: 'anoPca',
			type: 'number',
			typeOptions: {
				minValue: 1900,
				maxValue: 2100,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorUsuarioAno'],
				},
			},
			default: 2024,
			required: true,
			description: 'Ano do Plano de Contratação Anual',
		},
		{
			displayName: 'ID do Usuário',
			name: 'idUsuario',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorUsuarioAno'],
				},
			},
			default: 1,
			required: true,
			description: 'ID do usuário',
		},
		{
			displayName: 'Código de Classificação Superior',
			name: 'codigoClassificacaoSuperior',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorUsuarioAno'],
				},
			},
			default: '',
			required: false,
			description: 'Código de classificação superior (opcional)',
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorUsuarioAno'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ do órgão (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorUsuarioAno'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorUsuarioAno'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
		// Parâmetros para planoContratacao - consultarPorDataAtualizacao
		{
			displayName: 'Data Início',
			name: 'dataInicio',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data de início',
		},
		{
			displayName: 'Data Fim',
			name: 'dataFim',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data de fim',
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ do órgão (opcional)',
		},
		{
			displayName: 'Código da Unidade',
			name: 'codigoUnidade',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
		// Parâmetros para planoContratacao - consultarItensPorAno
		{
			displayName: 'Ano do PCA',
			name: 'anoPca',
			type: 'number',
			typeOptions: {
				minValue: 1900,
				maxValue: 2100,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorAno'],
				},
			},
			default: 2024,
			required: true,
			description: 'Ano do Plano de Contratação Anual',
		},
		{
			displayName: 'Código de Classificação Superior',
			name: 'codigoClassificacaoSuperior',
			type: 'string',
			typeOptions: {
				minLength: 0,
				maxLength: 100,
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorAno'],
				},
			},
			default: '',
			required: true,
			description: 'Código de classificação superior',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorAno'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['planoContratacao'],
					operation: ['consultarItensPorAno'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
		// Operações para contratacao
		{
			displayName: 'Operação',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['contratacao'],
				},
			},
			options: [
				{
					name: 'Consultar por ID',
					value: 'consultarPorId',
					description: 'Consultar Contratação por CNPJ, Ano e Sequencial',
				},
				{
					name: 'Consultar por Data de Publicação',
					value: 'consultarPorDataPublicacao',
					description: 'Consultar Contratações por Data de Publicação',
				},
				{
					name: 'Consultar por Período de Propostas',
					value: 'consultarPorPeriodoPropostas',
					description: 'Consultar Contratações com Recebimento de Propostas Aberto',
				},
				{
					name: 'Consultar por Data de Atualização',
					value: 'consultarPorDataAtualizacao',
					description: 'Consultar Contratações por Data de Atualização Global',
				},
			],
			default: 'consultarPorId',
			required: true,
			description: 'A operação a executar',
		},
		// Parâmetros para contratacao - consultarPorId
		{
			displayName: 'CNPJ do Órgão',
			name: 'cnpj',
			type: 'string',
			typeOptions: {
				pattern: '^([0-9]{2}[.]?[0-9]{3}[.]?[0-9]{3}[/]?[0-9]{4}[-]?[0-9]{2})$',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorId'],
				},
			},
			default: '',
			required: true,
			description: 'CNPJ do órgão (formato brasileiro)',
		},
		{
			displayName: 'Ano da Compra',
			name: 'ano',
			type: 'number',
			typeOptions: {
				minValue: 1900,
				maxValue: 2100,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorId'],
				},
			},
			default: 2024,
			required: true,
			description: 'Ano da compra',
		},
		{
			displayName: 'Sequencial da Compra',
			name: 'sequencial',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorId'],
				},
			},
			default: 1,
			required: true,
			description: 'Sequencial da compra (mínimo 1)',
		},
		// Parâmetros para contratacao - consultarPorDataPublicacao
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'Modalidade de Contratação',
			name: 'codigoModalidadeContratacao',
			type: 'options',
			default: '',
			description: 'Selecione uma ou mais modalidades de contratação',
			options: [
				{ name: 'Concorrência', value: '1' },
				{ name: 'Concurso', value: '2' },
				{ name: 'Leilão', value: '3' },
				{ name: 'Pregão', value: '4' },
				{ name: 'Diálogo Competitivo', value: '5' },
				{ name: 'Dispensa de Licitação', value: '6' },
				{ name: 'Inexigibilidade', value: '7' },
			],
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			required: true,
		},
		{
			displayName: 'Código do Modo de Disputa',
			name: 'codigoModoDisputa',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 0,
			required: false,
			description: 'Código do modo de disputa (opcional)',
		},
		{
			displayName: 'UF',
			name: 'uf',
			type: 'options',
			default: '',
			required: false,
			description: 'Sigla da UF (opcional)',
			options: [
				{ name: 'AC', value: 'AC' },
				{ name: 'AL', value: 'AL' },
				{ name: 'AM', value: 'AM' },
				{ name: 'AP', value: 'AP' },
				{ name: 'BA', value: 'BA' },
				{ name: 'CE', value: 'CE' },
				{ name: 'DF', value: 'DF' },
				{ name: 'ES', value: 'ES' },
				{ name: 'GO', value: 'GO' },
				{ name: 'MA', value: 'MA' },
				{ name: 'MG', value: 'MG' },
				{ name: 'MS', value: 'MS' },
				{ name: 'MT', value: 'MT' },
				{ name: 'PA', value: 'PA' },
				{ name: 'PB', value: 'PB' },
				{ name: 'PE', value: 'PE' },
				{ name: 'PI', value: 'PI' },
				{ name: 'PR', value: 'PR' },
				{ name: 'RJ', value: 'RJ' },
				{ name: 'RN', value: 'RN' },
				{ name: 'RO', value: 'RO' },
				{ name: 'RR', value: 'RR' },
				{ name: 'RS', value: 'RS' },
				{ name: 'SC', value: 'SC' },
				{ name: 'SE', value: 'SE' },
				{ name: 'SP', value: 'SP' },
				{ name: 'TO', value: 'TO' },
			],
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
		},
		{
			displayName: 'Código do Município IBGE',
			name: 'codigoMunicipioIbge',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			default: 0,
			required: false,
			description: 'Código IBGE do município (opcional)',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'ID do Usuário',
			name: 'idUsuario',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 50,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-50)',
		},
		// Parâmetros para contratacao - consultarPorPeriodoPropostas
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'Modalidade de Contratação',
			name: 'codigoModalidadeContratacao',
			type: 'options',
			default: '',
			description: 'Selecione uma ou mais modalidades de contratação',
			options: [
				{ name: 'Concorrência', value: '1' },
				{ name: 'Concurso', value: '2' },
				{ name: 'Leilão', value: '3' },
				{ name: 'Pregão', value: '4' },
				{ name: 'Diálogo Competitivo', value: '5' },
				{ name: 'Dispensa de Licitação', value: '6' },
				{ name: 'Inexigibilidade', value: '7' },
			],
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			required: false,
		},
		{
			displayName: 'UF',
			name: 'uf',
			type: 'options',
			default: '',
			required: false,
			description: 'Sigla da UF (opcional)',
			options: [
				{ name: 'AC', value: 'AC' },
				{ name: 'AL', value: 'AL' },
				{ name: 'AM', value: 'AM' },
				{ name: 'AP', value: 'AP' },
				{ name: 'BA', value: 'BA' },
				{ name: 'CE', value: 'CE' },
				{ name: 'DF', value: 'DF' },
				{ name: 'ES', value: 'ES' },
				{ name: 'GO', value: 'GO' },
				{ name: 'MA', value: 'MA' },
				{ name: 'MG', value: 'MG' },
				{ name: 'MS', value: 'MS' },
				{ name: 'MT', value: 'MT' },
				{ name: 'PA', value: 'PA' },
				{ name: 'PB', value: 'PB' },
				{ name: 'PE', value: 'PE' },
				{ name: 'PI', value: 'PI' },
				{ name: 'PR', value: 'PR' },
				{ name: 'RJ', value: 'RJ' },
				{ name: 'RN', value: 'RN' },
				{ name: 'RO', value: 'RO' },
				{ name: 'RR', value: 'RR' },
				{ name: 'RS', value: 'RS' },
				{ name: 'SC', value: 'SC' },
				{ name: 'SE', value: 'SE' },
				{ name: 'SP', value: 'SP' },
				{ name: 'TO', value: 'TO' },
			],
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
		},
		{
			displayName: 'Código do Município IBGE',
			name: 'codigoMunicipioIbge',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			default: 0,
			required: false,
			description: 'Código IBGE do município (opcional)',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			typeOptions: {
				minLength: 1,
				maxLength: 30,
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'ID do Usuário',
			name: 'idUsuario',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 50,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-50)',
		},
		// Parâmetros para contratacao - consultarPorDataAtualizacao (mesmo que porDataPublicacao)
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'Modalidade de Contratação',
			name: 'codigoModalidadeContratacao',
			type: 'options',
			default: '',
			description: 'Selecione uma ou mais modalidades de contratação',
			options: [
				{ name: 'Concorrência', value: '1' },
				{ name: 'Concurso', value: '2' },
				{ name: 'Leilão', value: '3' },
				{ name: 'Pregão', value: '4' },
				{ name: 'Diálogo Competitivo', value: '5' },
				{ name: 'Dispensa de Licitação', value: '6' },
				{ name: 'Inexigibilidade', value: '7' },
			],
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			required: true,
		},
		{
			displayName: 'Código do Modo de Disputa',
			name: 'codigoModoDisputa',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 0,
			required: false,
			description: 'Código do modo de disputa (opcional)',
		},
		{
			displayName: 'UF',
			name: 'uf',
			type: 'options',
			default: '',
			required: false,
			description: 'Sigla da UF (opcional)',
			options: [
				{ name: 'AC', value: 'AC' },
				{ name: 'AL', value: 'AL' },
				{ name: 'AM', value: 'AM' },
				{ name: 'AP', value: 'AP' },
				{ name: 'BA', value: 'BA' },
				{ name: 'CE', value: 'CE' },
				{ name: 'DF', value: 'DF' },
				{ name: 'ES', value: 'ES' },
				{ name: 'GO', value: 'GO' },
				{ name: 'MA', value: 'MA' },
				{ name: 'MG', value: 'MG' },
				{ name: 'MS', value: 'MS' },
				{ name: 'MT', value: 'MT' },
				{ name: 'PA', value: 'PA' },
				{ name: 'PB', value: 'PB' },
				{ name: 'PE', value: 'PE' },
				{ name: 'PI', value: 'PI' },
				{ name: 'PR', value: 'PR' },
				{ name: 'RJ', value: 'RJ' },
				{ name: 'RN', value: 'RN' },
				{ name: 'RO', value: 'RO' },
				{ name: 'RR', value: 'RR' },
				{ name: 'RS', value: 'RS' },
				{ name: 'SC', value: 'SC' },
				{ name: 'SE', value: 'SE' },
				{ name: 'SP', value: 'SP' },
				{ name: 'TO', value: 'TO' },
			],
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
		},
		{
			displayName: 'Código do Município IBGE',
			name: 'codigoMunicipioIbge',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			default: 0,
			required: false,
			description: 'Código IBGE do município (opcional)',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'ID do Usuário',
			name: 'idUsuario',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 50,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-50)',
		},
		// Operações para contrato
		{
			displayName: 'Operação',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['contrato'],
				},
			},
			options: [
				{
					name: 'Consultar por Data de Publicação',
					value: 'consultarPorDataPublicacao',
					description: 'Consultar Contratos por Data de Publicação',
				},
				{
					name: 'Consultar por Data de Atualização',
					value: 'consultarPorDataAtualizacao',
					description: 'Consultar Contratos/Empenhos por Data de Atualização Global',
				},
			],
			default: 'consultarPorDataPublicacao',
			required: true,
			description: 'A operação a executar',
		},
		// Parâmetros para contrato - consultarPorDataPublicacao
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'CNPJ do Órgão',
			name: 'cnpjOrgao',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ do órgão (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'ID do Usuário',
			name: 'usuarioId',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
		// Parâmetros para contrato - consultarPorDataAtualizacao (mesmo que acima)
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'CNPJ do Órgão',
			name: 'cnpjOrgao',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ do órgão (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'ID do Usuário',
			name: 'usuarioId',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['contrato'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
		// Operações para instrumentoCobranca
		{
			displayName: 'Operação',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
				},
			},
			options: [
				{
					name: 'Consultar por Data de Inclusão',
					value: 'consultarPorDataInclusao',
					description: 'Consultar Instrumentos de Cobrança por Data de Inclusão',
				},
			],
			default: 'consultarPorDataInclusao',
			required: true,
			description: 'A operação a executar',
		},
		// Parâmetros para instrumentoCobranca - consultarPorDataInclusao
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'Tipo de Instrumento de Cobrança',
			name: 'tipoInstrumentoCobranca',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: 0,
			required: false,
			description: 'Tipo de instrumento de cobrança (opcional)',
		},
		{
			displayName: 'CNPJ do Órgão',
			name: 'cnpjOrgao',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ do órgão (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 100,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-100)',
		},
		// Operações para ata
		{
			displayName: 'Operação',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['ata'],
				},
			},
			options: [
				{
					name: 'Consultar por Período de Vigência',
					value: 'consultarPorPeriodoVigencia',
					description: 'Consultar Ata de Registro de Preço por Período de Vigência',
				},
				{
					name: 'Consultar por Data de Atualização',
					value: 'consultarPorDataAtualizacao',
					description: 'Consultar Atas de Registro de Preço por Data de Atualização Global',
				},
			],
			default: 'consultarPorPeriodoVigencia',
			required: true,
			description: 'A operação a executar',
		},
		// Parâmetros para ata - consultarPorPeriodoVigencia
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'ID do Usuário',
			name: 'idUsuario',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			typeOptions: {
				minLength: 1,
				maxLength: 30,
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorPeriodoVigencia'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
		// Parâmetros para ata - consultarPorDataAtualizacao (mesmo que acima)
		{
			displayName: 'Data Inicial',
			name: 'dataInicial',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data inicial',
		},
		{
			displayName: 'Data Final',
			name: 'dataFinal',
			type: 'dateTime',
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: true,
			description: 'Data final',
		},
		{
			displayName: 'ID do Usuário',
			name: 'idUsuario',
			type: 'number',
			typeOptions: {
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 0,
			required: false,
			description: 'ID do usuário (opcional)',
		},
		{
			displayName: 'CNPJ',
			name: 'cnpj',
			type: 'string',
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'CNPJ (opcional)',
		},
		{
			displayName: 'Código da Unidade Administrativa',
			name: 'codigoUnidadeAdministrativa',
			type: 'string',
			typeOptions: {
				minLength: 1,
				maxLength: 30,
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'Código da unidade administrativa (opcional)',
		},
		{
			displayName: 'Página',
			name: 'pagina',
			type: 'number',
			typeOptions: {
				minValue: 1,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 1,
			required: true,
			description: 'Número da página (mínimo 1)',
		},
		{
			displayName: 'Tamanho da Página',
			name: 'tamanhoPagina',
			type: 'number',
			typeOptions: {
				minValue: 10,
				maxValue: 500,
				numberType: 'integer',
			},
			displayOptions: {
				show: {
					resource: ['ata'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: 10,
			required: false,
			description: 'Número de itens por página (10-500)',
		},
	],
};
