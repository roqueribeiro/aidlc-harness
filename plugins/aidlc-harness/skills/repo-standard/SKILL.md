---
name: repo-standard
description: 'Traz um repositório para o padrão comum do kit: README, AGENTS.md e CLAUDE.md finos, .claude/ com o plugin ligado, rotina de manutenção, docs, CHANGELOG e o gancho de pre-push rodando o gate na máquina. Use quando o aidlc-doctor estiver abaixo de 90, quando um repositório novo entrar no projeto, ou quando o usuário pedir para padronizar um repositório.'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# /repo-standard

Comece medindo, não escrevendo:

```bash
aidlc-doctor          # a nota e exatamente o que falta, com o peso de cada item
aidlc-gate --list     # a tecnologia precisa estar reconhecida
```

Se o `aidlc-doctor` disser que a tecnologia não é reconhecida, **esse é o primeiro trabalho**: falta um manifesto. O kit traz `node-yarn`, `node-npm` e `python-uv`; outra stack entra como manifesto do próprio projeto em `.aidlc/quality/<tech>.json` (veja `docs/pt-BR/ESTENDER.md`). Sem manifesto não há gate, e nenhum outro item importa.

Para um repositório novo, `aidlc-init` escreve o esqueleto inteiro (instruções para Claude, Kiro e Copilot, pastas do ciclo AI-DLC, workflow de CI). Para um repositório existente, ele só cria o que falta e nunca sobrescreve.

Os modelos estão em `${CLAUDE_PLUGIN_ROOT}/templates/`. Copie e preencha, não reinvente convenção.

## Os artefatos, e o que cada um resolve

| Arquivo | O que resolve |
| --- | --- |
| `README.md` | A porta de entrada. Identidade, stack, como começar em cinco minutos, comandos, estrutura |
| `AGENTS.md` | A fonte única das instruções para agentes. `CLAUDE.md`, `.kiro/steering/` e `.github/copilot-instructions.md` derivam dela (`aidlc-init --check`) |
| `CLAUDE.md` | Importa o `AGENTS.md`. **Abaixo de 8 KB** |
| `.claude/settings.json` | Liga o `aidlc-harness@aidlc` e declara a allowlist da stack |
| `.claude/loop.md` | A rotina de manutenção, copiada de `templates/loop/` |
| `.git/hooks/pre-push` | Roda o gate antes do push sair. É a barreira local |
| `aidlc/` | Os artefatos do ciclo: requisitos, histórias, unidades de trabalho, desenho, plano de teste, decisões |
| `CHANGELOG.md` | keep-a-changelog |

## Repositório aberto

Quem declara licença de código aberto (no `LICENSE` ou no `package.json`) entra também no perfil de repositório aberto, porque é a porta de entrada de quem nunca falou com o time. Repositório fechado não ganha nem perde ponto aqui. As regras e o motivo de cada uma moram em `lib/repo-aberto.mjs`, com teste ao lado.

| Item | O que o doctor confere |
| --- | --- |
| `aberto-licenca` | o `LICENSE` tem o texto da licença, e o `package.json` diz o mesmo SPDX |
| `aberto-readme-en` | o README tem a parte em inglês |
| `aberto-contributing` | `CONTRIBUTING.md` com o que só este repositório tem |
| `aberto-security`, `aberto-conduta` | `SECURITY.md` e `CODE_OF_CONDUCT.md` no próprio repositório |
| `aberto-modelos`, `aberto-codeowners` | modelos de issue e de PR, e o `CODEOWNERS` |
| `aberto-ci-fork` | um workflow roda em `pull_request`, e nenhum usa `pull_request_target` ou `secrets.*` no que o PR dispara |
| `aberto-assets` | com mídia no repositório, o `ASSETS.md` diz a origem e a licença de cada arquivo |
| `aberto-dco` | só com `"dco": true` em `.aidlc/config.json`: o CI confere o `Signed-off-by`, e o `CONTRIBUTING` explica |

O que falta, o `scripts/aplicar-repo-aberto.mjs` escreve a partir de `templates/aberto/` (código de conduta, modelos de issue e PR, `CODEOWNERS`, e o workflow de DCO com `--dco`), e com `--harness --loop <tipo>` também o `.claude/` do repositório. Ele nunca sobrescreve: o que existe fica, e a saída diz o que pulou. README, CONTRIBUTING e SECURITY são do repositório, porque dizem o que só ele sabe, e o script não os inventa.

```bash
node scripts/aplicar-repo-aberto.mjs ../meu-app --gate "yarn verificar" --harness --loop generico --seco
```

## A regra que decide o que entra no CLAUDE.md

**Ele é sempre-on**: pago em toda sessão e de novo em cada subagente. Um `CLAUDE.md` de 20 KB num repositório com vários agentes custa centenas de KB por fan-out, antes de alguém ler código.

Então: **invariante fica, referência sai.** Regra que vale em qualquer arquivo do repositório fica. Tabela, narrativa de incidente e detalhe de subsistema vão para uma rule com `paths:` (que carrega por glob) ou para `docs/` (que carrega quando alguém lê).

Confira com `aidlc-harness` depois de escrever. Se o baseline passou de 40 KB, você moveu o problema em vez de resolver.

## A rede é local; a esteira é a segunda barreira

O que padroniza um repositório é o gancho de `pre-push`, que roda o gate na máquina antes do push sair:

```bash
node scripts/install-git-hooks.mjs           # instala no repositório atual (ou nas pastas dadas)
node scripts/install-git-hooks.mjs --check   # só reporta, exit 1 se faltar
```

`.git/hooks/` **não é versionado**: o gancho some em toda formatação, todo clone novo e toda máquina nova, calado. Por isso a ausência dele reprova no `aidlc-doctor` (`gate-local`, 10 pontos), e o gancho que só roda formatação sem chamar o gate reprova também (`gate-local-roda-gate`, 7 pontos). O workflow `aidlc-gate.yml` que o `aidlc-init` escreve repete a checagem no CI, para quem pular o gancho local.

## Como fechar

`aidlc-doctor` de novo, com a nota antes e depois no chat. Meta: acima de 90.

Se a nota **não** subiu, diga isso claramente em vez de justificar: o artefato foi escrito no lugar errado, ou não foi commitado. Nota que não sobe é informação, não fracasso.
