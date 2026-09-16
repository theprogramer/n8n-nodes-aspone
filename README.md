![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-starter

This repo contains example nodes to help you get started building your own custom integrations for [n8n](https://n8n.io). It includes the node linter and other dependencies.

To make your custom node available to the community, you must create it as an npm package, and [submit it to the npm registry](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry).

If you would like your node to be available on n8n cloud you can also [submit your node for verification](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/).

## Prerequisites

You need the following installed on your development machine:

* [git](https://git-scm.com/downloads)
* Node.js and npm. Minimum version Node 20. You can find instructions on how to install both using nvm (Node Version Manager) for Linux, Mac, and WSL [here](https://github.com/nvm-sh/nvm). For Windows users, refer to Microsoft's guide to [Install NodeJS on Windows](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows).
* Install n8n with:
  ```
  npm install n8n -g
  ```
* Recommended: follow n8n's guide to [set up your development environment](https://docs.n8n.io/integrations/creating-nodes/build/node-development-environment/).

## Using this starter

These are the basic steps for working with the starter. For detailed guidance on creating and publishing nodes, refer to the [documentation](https://docs.n8n.io/integrations/creating-nodes/).

1. [Generate a new repository](https://github.com/n8n-io/n8n-nodes-starter/generate) from this template repository.
2. Clone your new repo:
   ```
   git clone https://github.com/<your organization>/<your-repo-name>.git
   ```
3. Run `npm i` to install dependencies.
4. Open the project in your editor.
5. Browse the examples in `/nodes` and `/credentials`. Modify the examples, or replace them with your own nodes.
6. Update the `package.json` to match your details.
7. Run `npm run lint` to check for errors or `npm run lintfix` to automatically fix errors when possible.
8. Test your node locally. Refer to [Run your node locally](https://docs.n8n.io/integrations/creating-nodes/test/run-node-locally/) for guidance.
9. Replace this README with documentation for your node. Use the [README_TEMPLATE](README_TEMPLATE.md) to get started.
10. Update the LICENSE file to use your details.
11. [Publish](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry) your package to npm.

## More information

Refer to our [documentation on creating nodes](https://docs.n8n.io/integrations/creating-nodes/) for detailed information on building your own nodes.

## Resiliência de rede

O servidor do PNCP é frequentemente lento e instável. O node trata falhas
transitórias automaticamente, sem quebrar o workflow.

### Configuração (credencial PNCP API)

| Campo | Default | O que faz |
| --- | --- | --- |
| Timeout Por Requisição (Ms) | 60000 | Aborta e retenta requisições mais lentas que isso |
| Máximo De Tentativas | 4 | Total de tentativas, incluindo a primeira |
| Backoff Inicial (Ms) | 1000 | Base da espera exponencial entre tentativas |
| Backoff Máximo (Ms) | 16000 | Teto da espera, inclusive do `Retry-After` |
| Intervalo Entre Páginas (Ms) | 200 | Pausa entre páginas no modo "Buscar Todas Páginas" |

Credenciais salvas antes desta versão continuam funcionando: os campos ausentes
assumem os defaults acima.

**Retentado:** status `408`, `425`, `429` e qualquer `5xx`; e as falhas de rede
`ECONNRESET`, `ETIMEDOUT`, `ESOCKETTIMEDOUT`, `EAI_AGAIN`, `EPIPE`,
`ECONNABORTED` (timeout do cliente — a falha mais comum contra o PNCP) e
`ECONNREFUSED`.

**Não retentado:** `4xx` como `400`, `401`, `404` e `422` falham de imediato —
retentar um CNPJ inválido não muda o resultado. `ENOTFOUND` e
`CERT_HAS_EXPIRED` também são permanentes.

A espera entre tentativas é sorteada entre zero e o teto exponencial. Esse
jitter não é enfeite: sem ele, todos os workflows que falham no mesmo minuto
retentam no mesmo instante e mantêm o servidor derrubado. Quando a resposta traz
o header `Retry-After`, ele é respeitado.

### Resultado parcial na paginação

Com "Buscar Todas Páginas" ligado, a saída ganha dois campos:

```json
{
  "data": [],
  "totalRegistros": 250,
  "totalPaginas": 25,
  "paginasBuscadas": 24,
  "limitePaginasAtingido": false,
  "paginasComErro": [7],
  "completo": false
}
```

Se uma página falhar em todas as tentativas, o node registra o número em
`paginasComErro`, marca `completo: false` e continua. Você recebe o que deu para
buscar em vez de perder a execução inteira. Use `completo` em um nó IF para
decidir se reprocessa.

Duas exceções: se a **página 1** falhar, o node lança erro — sem ela não há
`totalPaginas` e não dá para saber o tamanho do que ficou faltando. E se **3
páginas consecutivas** falharem, o node para (*circuit break*): o servidor está
fora, insistir só piora.

`Limite De Páginas` conta páginas **tentadas**, incluindo as que falharam.

### Interação com o "Retry On Fail" do n8n

O node já retenta internamente. Se você também ligar o "Retry On Fail" nas
configurações do node, os dois se multiplicam: com `maxTries: 3` e
`maxTentativas: 4`, uma página pode ser pedida até 12 vezes.

**Recomendação:** deixe o "Retry On Fail" do n8n desligado, ou no máximo em 2.
No modo "Buscar Todas Páginas" ele é especialmente caro, porque reexecuta o node
inteiro e refaz a paginação desde a página 1 — justamente o que a resiliência
interna existe para evitar.

### Dropdown de municípios (IBGE)

A lista de municípios usa um perfil próprio, mais curto (3 tentativas, timeout
de 5s), porque é um dropdown do editor com alguém esperando. O n8n não impõe
timeout próprio em `loadOptions`, então uma espera longa ali chegaria inteira ao
usuário.

O resultado fica em cache por UF enquanto o processo do n8n viver — a lista do
IBGE é estática, e antes disso cada abertura do dropdown refazia a chamada.

### Node Dados Abertos

Node declarativo não suporta retry customizado (`retryOnFail` e `maxTries`
existem em `INode`, não em `INodeTypeDescription`). Ele recebe o que a API
declarativa permite: timeout explícito de 60s e header `Accept`.

## License

[MIT](https://github.com/n8n-io/n8n-nodes-starter/blob/master/LICENSE.md)
