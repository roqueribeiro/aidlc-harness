# Operação

*Tradução de [OPERATIONS.md](../OPERATIONS.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

> **Para quem:** quem mantém o kit rodando, dos dois lados: quem mantém e publica o `aidlc-harness`, e o time que o roda dentro de um projeto e precisa atualizá-lo, voltar atrás e acompanhá-lo.
> **O que tem aqui:** o que roda sozinho e onde, como se publica uma versão, como um projeto passa para uma versão nova sem CI vermelho, como desfazer cada passo, o que há para guardar e o que acompanhar.
> **Onde ir para o resto:** cada comando e opção estão na [REFERÊNCIA](REFERENCIA.md); o que cada resultado vermelho quer dizer, em [QUANDO-QUEBRA](QUANDO-QUEBRA.md); a primeira instalação, em [COMECAR](COMECAR.md).

## Sumário

1. [A rotina](#1-a-rotina)
2. [Publicar uma versão](#2-publicar-uma-versão)
3. [Atualizar um projeto sem quebrar](#3-atualizar-um-projeto-sem-quebrar)
4. [Desfazer](#4-desfazer)
5. [Backup e restauração](#5-backup-e-restauração)
6. [Monitorar](#6-monitorar)

## 1. A rotina

O kit não tem servidor nem tarefa agendada. Tudo o que roda sozinho é disparado por um evento no git ou na ferramenta de IA.

| O que roda | Quando | Onde | Como saber que rodou |
| --- | --- | --- | --- |
| `ci` ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) | todo pull request e todo push na `main` | GitHub Actions, Node 20, 22 e 24; o job de máquina limpa em Linux, macOS e Windows | os checks do pull request |
| `dco` ([`.github/workflows/dco.yml`](../../.github/workflows/dco.yml)) | todo pull request | GitHub Actions | reprova o commit sem `Signed-off-by` |
| `release` ([`.github/workflows/release.yml`](../../.github/workflows/release.yml)) | todo push na `main`, ou à mão (`workflow_dispatch`) | GitHub Actions | uma tag e uma release `vX.Y.Z`, ou a linha `vX.Y.Z já existe; nada a fazer` no log |
| `site` ([`.github/workflows/site.yml`](../../.github/workflows/site.yml)) | todo pull request e push | GitHub Actions; publica no GitHub Pages só a partir da `main` e só quando a variável do repositório `SITE_PAGES` vale `ativo` | o job `publicar` rodou |
| Workflow `aidlc-gate` num projeto ([molde](../../plugins/aidlc-harness/templates/project/aidlc-gate.yml)) | todo pull request e push do projeto | o CI do projeto, com o kit clonado em `AIDLC_REF` | os checks do projeto |
| Os hooks do kit (`dod-check` e os outros) | todo turno da ferramenta de IA que aceita hooks | a máquina de quem desenvolve, pelo plugin ou por `.aidlc/kit/` | uma linha por decisão em `aidlc/audit/<dia>.jsonl` |
| O `pre-push` | todo `git push` | a máquina de quem desenvolve, se foi instalado | o push espera o `aidlc-gate` |

Se a `SITE_PAGES` está definida hoje no repositório público não foi conferido daqui: o workflow a lê, este documento não prova o valor dela.

## 2. Publicar uma versão

A versão mora em quatro lugares, e o [`scripts/notas-da-versao.mjs`](../../scripts/notas-da-versao.mjs) reprova enquanto qualquer um deles discordar: `version` no `package.json`, `version` em `plugins/aidlc-harness/.claude-plugin/plugin.json`, `AIDLC_REF` em [`plugins/aidlc-harness/templates/project/aidlc-gate.yml`](../../plugins/aidlc-harness/templates/project/aidlc-gate.yml) e uma seção datada no `CHANGELOG.md`. O motivo está no topo do script: na v0.2.0 o workflow gerado fixou uma tag que ainda não existia, e todo projeto novo teria o CI quebrado no checkout do kit.

```bash
# 1. leve os quatro lugares ao mesmo X.Y.Z e troque "## [Unreleased]" por "## [X.Y.Z] - AAAA-MM-DD"
node scripts/notas-da-versao.mjs --check     # exit 1 enquanto discordarem
node scripts/notas-da-versao.mjs             # imprime vX.Y.Z, uma linha em branco e as notas que a release vai levar

# 2. o gate do próprio repositório, os mesmos passos do CI
node --test
node scripts/check-plugin.mjs
node scripts/check-quality-manifests.mjs
node scripts/check-docs-consistency.mjs
node scripts/gerar-prompts.mjs --check
node scripts/gerar-ferramentas.mjs --check
node scripts/gerar-diagramas.mjs --check
node scripts/check-reference.mjs
node scripts/check-i18n.mjs
node scripts/check-links.mjs
node site/scripts/sync-docs.mjs --check
node plugins/aidlc-harness/tools/aidlc-identity
```

Depois abra o pull request, com todo commit assinado (`git commit -s`). Quando o merge chega à `main`, o workflow `release` roda `notas-da-versao.mjs --check` de novo, cria a tag `vX.Y.Z` naquele commit e a release do GitHub com a seção do CHANGELOG como notas. Ninguém cria tag à mão ([CONTRIBUTING, Publicando uma versão](CONTRIBUTING.md#publicando-uma-versão)).

O script `verificar` do `package.json` encadeia a maior parte desses checks pelo `yarn`, mas não o `check-i18n` nem o `sync-docs --check`; o CI roda os dois, então a lista acima é a completa.

## 3. Atualizar um projeto sem quebrar

Um projeto depende do kit em três lugares que precisam andar juntos, e o `aidlc-init --check` no CI os compara:

| Onde | O que fixa a versão | Quem atualiza |
| --- | --- | --- |
| `.aidlc/kit/` | os arquivos da cópia, comparados com o kit em `AIDLC_REF` | `aidlc-init --sync` regrava a cópia e remove o que uma versão antiga deixou ([`lib/init.mjs`](../../plugins/aidlc-harness/lib/init.mjs)) |
| `.claude/settings.json` | `extraKnownMarketplaces.aidlc.source.ref`, `v<versão>` | `aidlc-init --sync` mescla a fixação nova e mantém o resto do arquivo ([`lib/adaptadores.mjs`](../../plugins/aidlc-harness/lib/adaptadores.mjs)) |
| `.github/workflows/aidlc-gate.yml` | `AIDLC_REF` | **você, à mão**: um workflow que já existe fica como está, o `--sync` não o regrava |

O CI roda o `--check` do kit fixado em `AIDLC_REF`, não da cópia, para um agente não conseguir afrouxar o gate editando `.aidlc/kit/`. A consequência numa atualização: cópia sincronizada com a versão nova e `AIDLC_REF` ainda na antiga reprova no CI. Mude os dois no mesmo commit.

```bash
# leia antes o CHANGELOG da versão nova; na série 0.x qualquer versão pode mudar comportamento
npx github:roqueribeiro/aidlc-harness init --sync      # cópia do kit, comandos e hooks gerados, fixação no settings
# edite .github/workflows/aidlc-gate.yml: AIDLC_REF: vX.Y.Z (a mesma versão)
node .aidlc/kit/tools/aidlc-init --check                # exit 0: cópias e kit concordam
node .aidlc/kit/tools/aidlc-gate                        # exit 0: o gate fica verde com o kit novo
git add -A && git commit -s -m "chore: aidlc-harness vX.Y.Z"
```

O `npx github:roqueribeiro/aidlc-harness` pega o branch padrão do repositório. Apontar para uma tag com o sufixo `#vX.Y.Z` é como o próprio npm lê uma dependência git; os testes do kit não exercitam essa forma, então ela não está provada aqui. A fixação que importa para o CI é a `AIDLC_REF`: ponha uma tag ou um commit que você revisou, nunca `main` (o comentário no workflow gerado diz por quê).

No Claude Code, depois do commit, o plugin passa a vir da tag nova do marketplace quando a pasta é confiada de novo ou os plugins são recarregados (`/reload-plugins`).

## 4. Desfazer

| Passo | O caminho de volta | O que ele não desfaz |
| --- | --- | --- |
| `aidlc-init` num projeto | `git revert <commit>` do commit único que o [COMECAR](COMECAR.md#2-prepare-o-projeto) pede. Um `AGENTS.md` que já existia só ganhou um bloco entre `<!-- aidlc:inicio -->` e `<!-- aidlc:fim -->`, que o revert tira | o `pre-push` em `.git/hooks/`, que não é versionado: tire à mão |
| Uma atualização do kit num projeto | `git revert` do commit da atualização: a cópia, a fixação no settings e a `AIDLC_REF` voltam juntas | nada; os três estavam no mesmo commit (seção 3) |
| Um gate que bloqueia numa emergência | `AIDLC_GATE=0` desliga o gate de evidência e os outros hooks de Stop; a opção `gate_mode` do plugin em `warn` os mantém avisando sem bloquear ([REFERÊNCIA, variáveis de ambiente](REFERENCIA.md#variáveis-de-ambiente-e-configuração)) | é uma chave, não um conserto; religue e leia o [QUANDO-QUEBRA](QUANDO-QUEBRA.md) |
| `aidlc-limpeza --apagar` | não precisa: ele só remove o que o remoto já tem, e o que perderia trabalho sai em "decidir" e nunca é apagado | um branch que você mesmo apague depois |
| Uma versão publicada do kit | revert na `main` e uma versão de correção nova; o workflow `release` pula tag que já existe, então nunca move uma tag publicada | a tag publicada fica, e os projetos que a fixaram continuam rodando ela. Apagar uma tag quebra o CI de todo projeto com aquela `AIDLC_REF` |

## 5. Backup e restauração

O kit não guarda estado próprio fora do git. Tudo de que um projeto precisa é versionado com o projeto: `AGENTS.md`, `context/`, `aidlc/` (requisitos, desenho, plano de testes, decisões) e a cópia em `.aidlc/kit/`. Um clone é a restauração, com três exceções:

| O quê | Por que não está no clone | Como recuperar |
| --- | --- | --- |
| O `pre-push` | `.git/hooks/` não é versionado e some num clone novo, calado | `node scripts/install-git-hooks.mjs --check`, depois `node scripts/install-git-hooks.mjs` a partir de um clone do kit ([QUANDO-QUEBRA, Antes do push](QUANDO-QUEBRA.md#antes-do-push)) |
| O binário do Trivy | é baixado para o cache do kit no primeiro `aidlc-secscan`, fixado por versão e sha256 em [`lib/trivy.mjs`](../../plugins/aidlc-harness/lib/trivy.mjs) | baixa de novo sozinho; no CI o workflow gerado guarda `~/.cache/aidlc-harness` em cache |
| `aidlc/audit/<dia>.jsonl` | é gravado na máquina em que os hooks rodaram; se o time o versiona é escolha do time, e ele é local e editável ([REGULADO](REGULADO.md)) | se importa para auditoria, mande para o seu sistema de log; o kit não faz isso |

Os segredos usados com o `aidlc-secrets` moram no chaveiro do macOS ou em arquivos locais, nunca no repositório; guardá-los é trabalho do cofre, não do kit.

## 6. Monitorar

| O que acompanhar | Comando | Saudável |
| --- | --- | --- |
| O gate do projeto | `node .aidlc/kit/tools/aidlc-gate` | exit 0; PULADO não é verde ([QUANDO-QUEBRA](QUANDO-QUEBRA.md#os-quatro-estados)) |
| Cópias e kit em acordo | `node .aidlc/kit/tools/aidlc-init --check` | exit 0 |
| Sobras no fim de uma unidade | `node .aidlc/kit/tools/aidlc-limpeza` | exit 0 com `aidlc-limpeza: nada sobrando` |
| O ciclo | `node .aidlc/kit/tools/aidlc-cycle --since 30d` | números em vez de `não medido`; sem registro quer dizer que os hooks não gravaram `aidlc/audit/` |
| O repositório contra o padrão | `node .aidlc/kit/tools/aidlc-doctor` | a nota e a lista do que falta; o kit não fixa nota-alvo |
| O custo de contexto sempre ligado | `node .aidlc/kit/tools/aidlc-harness --check` | exit 0: a linha de base em `.claude/harness-baseline.json` não cresceu além da tolerância |
| Este repositório | os checks do `ci` na `main` | todos verdes, inclusive o job de máquina limpa nos três sistemas |

Nenhum número desta tabela foi medido num projeto específico: são os códigos de saída e as linhas que os programas imprimem, como descreve a [REFERÊNCIA](REFERENCIA.md#códigos-de-saída).
