import { INodePropertyOptions, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

// Entrada inerte usada em selects de campos opcionais para permitir "não filtrar"
const NONE_OPTION: INodePropertyOptions = { name: '- Não Filtrar -', value: '' };

const UF_OPTIONS = [
	{ name: 'Acre (AC)', value: 'AC' },
	{ name: 'Alagoas (AL)', value: 'AL' },
	{ name: 'Amapá (AP)', value: 'AP' },
	{ name: 'Amazonas (AM)', value: 'AM' },
	{ name: 'Bahia (BA)', value: 'BA' },
	{ name: 'Ceará (CE)', value: 'CE' },
	{ name: 'Distrito Federal (DF)', value: 'DF' },
	{ name: 'Espírito Santo (ES)', value: 'ES' },
	{ name: 'Goiás (GO)', value: 'GO' },
	{ name: 'Maranhão (MA)', value: 'MA' },
	{ name: 'Mato Grosso (MT)', value: 'MT' },
	{ name: 'Mato Grosso do Sul (MS)', value: 'MS' },
	{ name: 'Minas Gerais (MG)', value: 'MG' },
	{ name: 'Pará (PA)', value: 'PA' },
	{ name: 'Paraíba (PB)', value: 'PB' },
	{ name: 'Paraná (PR)', value: 'PR' },
	{ name: 'Pernambuco (PE)', value: 'PE' },
	{ name: 'Piauí (PI)', value: 'PI' },
	{ name: 'Rio de Janeiro (RJ)', value: 'RJ' },
	{ name: 'Rio Grande Do Norte (RN)', value: 'RN' },
	{ name: 'Rio Grande Do Sul (RS)', value: 'RS' },
	{ name: 'Rondônia (RO)', value: 'RO' },
	{ name: 'Roraima (RR)', value: 'RR' },
	{ name: 'Santa Catarina (SC)', value: 'SC' },
	{ name: 'São Paulo (SP)', value: 'SP' },
	{ name: 'Sergipe (SE)', value: 'SE' },
	{ name: 'Tocantins (TO)', value: 'TO' },
];

// Valores conforme Manual das APIs de Consulta do PNCP
const MODALIDADE_CONTRATACAO_OPTIONS = [
	{ name: 'Leilão - Eletrônico', value: '1' },
	{ name: 'Diálogo Competitivo', value: '2' },
	{ name: 'Concurso', value: '3' },
	{ name: 'Concorrência - Eletrônica', value: '4' },
	{ name: 'Concorrência - Presencial', value: '5' },
	{ name: 'Pregão - Eletrônico', value: '6' },
	{ name: 'Pregão - Presencial', value: '7' },
	{ name: 'Dispensa de Licitação', value: '8' },
	{ name: 'Inexigibilidade', value: '9' },
	{ name: 'Manifestação de Interesse', value: '10' },
	{ name: 'Pré-Qualificação', value: '11' },
	{ name: 'Credenciamento', value: '12' },
	{ name: 'Leilão - Presencial', value: '13' },
	{ name: 'Inaplicabilidade da Licitação', value: '14' },
];

const MODO_DISPUTA_OPTIONS = [
	{ name: 'Aberto', value: 1 },
	{ name: 'Fechado', value: 2 },
	{ name: 'Aberto-Fechado', value: 3 },
	{ name: 'Dispensa Com Disputa', value: 4 },
	{ name: 'Não Se Aplica', value: 5 },
	{ name: 'Fechado-Aberto', value: 6 },
];

const TIPO_INSTRUMENTO_COBRANCA_OPTIONS = [
	{ name: 'Nota Fiscal Eletrônica', value: 1 },
	{ name: 'Nota Fiscal Avulsa', value: 2 },
	{ name: 'Nota Fiscal de Serviços Eletrônica (NFS-E)', value: 3 },
	{ name: 'Fatura', value: 4 },
	{ name: 'Recibo', value: 5 },
	{ name: 'Outros', value: 6 },
];

// Variantes opcionais: prepende uma entrada vazia para que o usuário possa limpar o filtro
const UF_OPTIONS_OPTIONAL: INodePropertyOptions[] = [NONE_OPTION, ...UF_OPTIONS];
const MODALIDADE_CONTRATACAO_OPTIONS_OPTIONAL: INodePropertyOptions[] = [
	NONE_OPTION,
	...MODALIDADE_CONTRATACAO_OPTIONS,
];
const MODO_DISPUTA_OPTIONS_OPTIONAL: INodePropertyOptions[] = [NONE_OPTION, ...MODO_DISPUTA_OPTIONS];
const TIPO_INSTRUMENTO_COBRANCA_OPTIONS_OPTIONAL: INodePropertyOptions[] = [
	NONE_OPTION,
	...TIPO_INSTRUMENTO_COBRANCA_OPTIONS,
];

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
			default: '1',
			description: 'Modalidade de contratação',
			options: MODALIDADE_CONTRATACAO_OPTIONS,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			required: true,
		},
		{
			displayName: 'Modo de Disputa',
			name: 'codigoModoDisputa',
			type: 'options',
			options: MODO_DISPUTA_OPTIONS_OPTIONAL,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
			default: '',
			required: false,
			description: 'Modo de disputa da contratação (opcional)',
		},
		{
			displayName: 'UF',
			name: 'uf',
			type: 'options',
			default: '',
			required: false,
			description: 'Sigla da UF (opcional)',
			options: UF_OPTIONS_OPTIONAL,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataPublicacao'],
				},
			},
		},
		{
			displayName: 'Município Name or ID',
			name: 'codigoMunicipioIbge',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getCidades',
				loadOptionsDependsOn: ['uf'],
			},
			default: '',
			required: false,
			description:
				'Selecione um município após escolher a UF. O código IBGE é enviado automaticamente para a API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
			description: 'Modalidade de contratação (opcional)',
			options: MODALIDADE_CONTRATACAO_OPTIONS_OPTIONAL,
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
			options: UF_OPTIONS_OPTIONAL,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorPeriodoPropostas'],
				},
			},
		},
		{
			displayName: 'Município Name or ID',
			name: 'codigoMunicipioIbge',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getCidades',
				loadOptionsDependsOn: ['uf'],
			},
			default: '',
			required: false,
			description:
				'Selecione um município após escolher a UF. O código IBGE é enviado automaticamente para a API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
			default: '1',
			description: 'Modalidade de contratação',
			options: MODALIDADE_CONTRATACAO_OPTIONS,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			required: true,
		},
		{
			displayName: 'Modo de Disputa',
			name: 'codigoModoDisputa',
			type: 'options',
			options: MODO_DISPUTA_OPTIONS_OPTIONAL,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
			default: '',
			required: false,
			description: 'Modo de disputa da contratação (opcional)',
		},
		{
			displayName: 'UF',
			name: 'uf',
			type: 'options',
			default: '',
			required: false,
			description: 'Sigla da UF (opcional)',
			options: UF_OPTIONS_OPTIONAL,
			displayOptions: {
				show: {
					resource: ['contratacao'],
					operation: ['consultarPorDataAtualizacao'],
				},
			},
		},
		{
			displayName: 'Município Name or ID',
			name: 'codigoMunicipioIbge',
			type: 'options',
			typeOptions: {
				loadOptionsMethod: 'getCidades',
				loadOptionsDependsOn: ['uf'],
			},
			default: '',
			required: false,
			description:
				'Selecione um município após escolher a UF. O código IBGE é enviado automaticamente para a API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
			type: 'options',
			options: TIPO_INSTRUMENTO_COBRANCA_OPTIONS_OPTIONAL,
			displayOptions: {
				show: {
					resource: ['instrumentoCobranca'],
					operation: ['consultarPorDataInclusao'],
				},
			},
			default: '',
			required: false,
			description: 'Tipo do instrumento de cobrança (opcional)',
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
