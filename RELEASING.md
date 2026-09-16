# Como publicar uma versão

Este projeto segue git-flow e publica no npm por **Trusted Publishing (OIDC)**,
pelo workflow `.github/workflows/publish.yml`. Não existe `NPM_TOKEN` no
repositório e não é preciso digitar OTP.

## Por que OIDC e não `npm publish` da sua máquina

O npm **descontinuou o cadastro de novos métodos TOTP**. Contas criadas ou
reconfiguradas depois dessa mudança ficam só com passkey / chave de segurança
como segundo fator — e passkey não gera o código de 6 dígitos que a CLI pede em
`npm publish --otp=...`. Publicar manualmente virou um beco sem saída.

Recovery code **não** é uma saída: usar um coloca a conta em estado somente-leitura
por **72 horas**, o que bloqueia inclusive a criação de access tokens. Confirmado
em produção neste projeto (16/09/2026).

O OIDC resolve os dois problemas: o npm confia neste workflow específico deste
repositório, verificado pelo GitHub. Sem segredo de longa duração, sem OTP.

## Pré-requisito, feito uma vez

No npmjs.com, na página do pacote → **Settings → Trusted Publisher**:

| Campo | Valor |
| --- | --- |
| Organization or user | `theprogramer` |
| Repository | `n8n-nodes-aspone` |
| Workflow filename | `publish.yml` |

Todos os campos são case-sensitive e precisam bater exatamente.

**Pegadinha:** configurações criadas a partir de 03/09/2026 permitem apenas
`npm stage publish` por padrão. Marque também a permissão de **publicação
direta**, senão o `npm publish` do workflow falha sem explicar o motivo.

## Passo a passo de uma release

Partindo de `develop` com o trabalho já mergeado:

```bash
git checkout -b release/X.Y.Z
npm version X.Y.Z --no-git-tag-version
```

Atualize **`VERSAO` em `nodes/shared/transport/config.ts`** para o mesmo número.
Ela alimenta o header `User-Agent` enviado ao PNCP. Um teste em
`tests/shared/transport.spec.ts` prende `VERSAO` ao `package.json`, então
esquecer disso quebra a suíte — de propósito.

Verifique com os exit codes de verdade, não canalizando para `grep`:

```bash
npx jest && npx tsc --noEmit && npm run lint && npm run build
```

Confira o que vai no pacote antes de publicar:

```bash
npm publish --dry-run
```

Deve listar `dist/nodes/**` e `dist/credentials/**`, e **não** deve conter
`tsconfig.tsbuildinfo` nem `dist/package.json`. O campo `files` do
`package.json` lista os dois diretórios em vez de `dist` inteiro justamente
por isso — antes da 0.1.4, 40% do pacote era cache de build.

Feche o git-flow:

```bash
git checkout master && git merge --no-ff release/X.Y.Z
git tag -a vX.Y.Z -m "vX.Y.Z — resumo"
git checkout develop && git merge --no-ff release/X.Y.Z
git branch -d release/X.Y.Z
git push origin master develop --follow-tags
```

O push da tag dispara o workflow, que roda lint, testes, confere que a tag bate
com o `package.json` e publica com provenance automática.

## Publicar uma tag que já existe

Se a tag foi criada antes do workflow existir, ela não dispara nada. Use
**Actions → Publish to npm → Run workflow**, escolhendo o branch `master`.

## Armadilhas conhecidas

**`tsBuildInfoFile` fora do `dist` quebra o build.** Já foi tentado. O script
`build` faz `rimraf dist`, que deixa de limpar o buildinfo se ele morar fora
dali; o `tsc` então lê um cache obsoleto, conclui que a saída está atualizada e
**não emite nada** — o `dist` fica só com os ícones e o pacote sai vazio. O
buildinfo morar dentro do `dist` é o que mantém os dois em sincronia.

**`package.json` no `include` do `tsconfig.json` é intencional.** É o que permite
o eslint fazer typed linting nele. Remover quebra `npm run lint`. O efeito
colateral é um `dist/package.json` inócuo, que o `files` já exclui do pacote.

**O `gh` pode responder sobre o repositório errado.** Existe um remote `upstream`
apontando para o template `n8n-io/n8n-nodes-starter`, e o `gh` prefere `upstream`
quando os dois existem — ele chega a listar os workflows e o default branch do
template. Já corrigido localmente com `gh repo set-default`, mas em uma máquina
nova refaça, ou use `-R theprogramer/n8n-nodes-aspone` explicitamente.

**O default branch deste repositório é `develop`**, não `master`.

## Requisitos do workflow

Trusted publishing exige npm ≥ 11.5.1 e Node ≥ 22.14.0, e **não funciona em
self-hosted runners**. O workflow instala `npm@latest` explicitamente porque o
npm que vem no runner pode ser anterior a isso.
