<p align="center">
  <img src="docs/assets/diagramas/logo.claro.svg" alt="aidlc-harness" width="96">
</p>

# aidlc-harness

Um harness de qualidade para desenvolver software com agentes de IA seguindo o ciclo **AI-DLC**: a IA propõe, a equipe valida, e nada é "pronto" sem evidência.

Funciona com **Claude Code**, **Kiro** e **GitHub Copilot**, e lê o relatório de **qualquer plataforma de segurança** (SARIF, o formato neutro do kit, ou o AI Fix Bundle do [RoqueShield](docs/ROQUESHIELD.md)). Não depende de nenhum produto, empresa ou stack específica.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/diagramas/contexto.escuro.svg">
  <img alt="Contexto: a equipe decide, a ferramenta de IA executa, o kit cobra o que foi combinado" src="docs/assets/diagramas/contexto.claro.svg">
</picture>

> **Estado: pré-lançamento (0.1.0).** O que está descrito aqui existe e tem teste. O que ainda não foi verificado em máquina real (macOS, Windows, Kiro, Copilot) está dito em [Limites conhecidos](#limites-conhecidos). Este projeto é uma interpretação prática do AI-DLC; não é documentação nem produto da AWS (veja [docs/AIDLC.md](docs/AIDLC.md)).

## Por que existe

O sintoma que motivou o kit: um agente entrega, a pessoa revisa, e encontra o mesmo tipo de problema pela quinta vez. Não porque o modelo seja ruim, mas porque cada sessão recomeça sem saber o que a equipe já decidiu e sem nada que cobre o "pronto". O gargalo vira a revisão.

O kit trata isso com quatro decisões que não são sobre prompt:

1. **Critério de aceite é dado, não prosa.** Um arquivo JSON diz qual comando roda, que saída reprova e se bloqueia.
2. **Determinismo vence modelo quando a tarefa é mecânica.** Se uma checagem pode ser um script, é um script.
3. **Evidência antes de "pronto".** O agente cola a saída crua do gate no chat, e um hook recusa encerrar a sessão sem ela.
4. **Quem aprova a fase é uma pessoa.** O kit confere que a aprovação existe e que não foi preenchida por uma IA.

Uma regra atravessa tudo: **regra sem mecanismo é decoração.** Cada norma deste repositório aponta para o hook, o gate ou o manifesto que a executa ([OPERATING-MODEL.md](OPERATING-MODEL.md)).

## O que vem no kit

| Peça | O que faz |
| --- | --- |
| `aidlc-init` | Prepara um projeto: instruções para as três ferramentas a partir de um `AGENTS.md`, pastas do ciclo, workflow de CI |
| `aidlc-phase` | Estado das fases. `check inception` reprova campo por preencher e aprovação em branco |
| `aidlc-gate` | Roda o critério de aceite da stack detectada e sai com 1 se um gate bloqueante reprova |
| `aidlc-identity` | Varre o repositório atrás de IP, e-mail, caminho de home, hostname interno, segredo e termos que você proíbe |
| `aidlc-doctor` | Nota o repositório contra o padrão e diz o que falta, com peso |
| `aidlc-scan` | Lê o relatório de qualquer plataforma de segurança e separa **limpo** de **não rodou** ([INTEGRACOES.md](docs/INTEGRACOES.md)) |
| `aidlc-secrets`, `aidlc-secscan`, `aidlc-lockcheck` | Cofre que o agente usa sem ver, CVE com correção publicada, dependência fora do lockfile |
| `aidlc-mutation`, `aidlc-limpeza`, `aidlc-cycle`, `aidlc-graph`, `aidlc-harness` | Teste de mutação, bancada limpa, painel do ciclo, raio de impacto entre repositórios, custo de contexto |
| Hooks (Claude Code) | `dod-check` (Stop), `promise-check`, `secret-guard`, `pkg-manager`, `strategy-map`, `path-strategy`, `session-brief`, `scratch-guard` |
| Agentes | `advisor`, `scanner`, `supply-chain-reviewer` |
| Skills e comandos | `aidlc-context`, `bolts`, `blast`, `repo-standard`, `/inception`, `/construction`, `/gate`, `/status` |

## Começar

Pré-requisitos: Node 20.19 ou mais novo e git. O guia passo a passo, com o que esperar em cada passo, está em **[docs/COMECAR.md](docs/COMECAR.md)**. O resumo:

```bash
# 1. Pegue o kit e ponha os executáveis no PATH
git clone https://github.com/roqueribeiro/aidlc-harness.git
node aidlc-harness/scripts/setup.mjs

# 2. No Claude Code: registre o marketplace e instale o plugin
#    claude plugin marketplace add roqueribeiro/aidlc-harness
#    claude plugin install aidlc-harness@aidlc

# 3. No seu projeto
cd meu-projeto
aidlc-init --name "Meu Projeto" --desc "uma frase"
aidlc-phase status
aidlc-gate
```

Depois do `aidlc-init`, a equipe preenche `aidlc/inception/` com a IA fazendo as perguntas, e uma pessoa assina a aprovação no próprio arquivo. A Construction só começa depois.

## O ciclo

```
Inception                         Construction                    Operations
requisitos ─ histórias ─ unidades ─▶ desenho ─ plano de teste ─▶ código + teste ─▶ entrega
   │              (aprovação humana)         (aprovação humana)      │                  │
   └─ aidlc-phase check inception            └─ aidlc-phase check construction         └─ aidlc-gate, aidlc-limpeza
```

`aidlc/decisions.md` guarda o que foi decidido e não se reabre. [docs/AIDLC.md](docs/AIDLC.md) mapeia cada fase para o que o kit faz e diz onde ele se afasta do método original.

## Qualquer plataforma de segurança, inclusive o RoqueShield

O kit não embute um scanner: **cobra o resultado de um**, com uma regra que não muda: *um scan que não rodou não é um scan limpo.* O `aidlc-scan` lê o relatório e responde com **0 limpo**, **1 reprovado** ou **2 não rodou**; no manifesto, é um gate comum.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/diagramas/varredura.escuro.svg">
  <img alt="Contrato de varredura: qualquer plataforma entra por um relatório, e o kit separa limpo de não rodou" src="docs/assets/diagramas/varredura.claro.svg">
</picture>

| A plataforma exporta | Como entra |
| --- | --- |
| AI Fix Bundle do [RoqueShield](docs/ROQUESHIELD.md) (código aberto, Apache-2.0, alfa) | `aidlc-scan relatorio.json --format roqueshield` |
| SARIF 2.1.0 (Semgrep, CodeQL, Trivy e outras) | `aidlc-scan relatorio.sarif --format sarif` |
| Qualquer outro JSON | converter para o formato neutro ([receita](docs/INTEGRACOES.md#5-receitas-por-plataforma)) |

O kit **não depende** do RoqueShield, e o RoqueShield não depende do kit: o RoqueShield é uma das plataformas que entram pelo mesmo contrato. O que está e o que não está verificado nessa ligação está dito em [docs/ROQUESHIELD.md](docs/ROQUESHIELD.md).

## Compatibilidade: o que cada ferramenta recebe

O kit aplica regras de duas maneiras: **instrução** (o agente lê e deveria seguir) e **mecanismo** (algo bloqueia ou reprova de fato). A diferença importa.

| | Claude Code | Kiro | GitHub Copilot |
| --- | --- | --- | --- |
| Instruções do projeto | `CLAUDE.md` importa `AGENTS.md` | `AGENTS.md` e `.kiro/steering/aidlc.md` | `.github/copilot-instructions.md` |
| Hooks que bloqueiam (evidência no Stop, segredo, gerenciador de pacote) | sim, pelo plugin | não | não |
| Executáveis `aidlc-*` | sim | sim, via `setup` | sim, via `setup` |
| Gate no CI (`aidlc-gate.yml`) | sim | sim | sim |

Em resumo: no Claude Code o kit bloqueia; em Kiro e Copilot ele instrui e o CI confere. Detalhes e o que verificar na sua versão de cada ferramenta: [docs/ADAPTADORES.md](docs/ADAPTADORES.md).

## Documentação

O mapa completo está em **[docs/INDEX.md](docs/INDEX.md)**. Os principais:

- [docs/COMECAR.md](docs/COMECAR.md): a trilha em sete passos
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como é feito por dentro, com diagramas
- [docs/REFERENCIA.md](docs/REFERENCIA.md): todo executável, hook, comando, campo e variável
- [docs/INTEGRACOES.md](docs/INTEGRACOES.md): plataformas de segurança, CI e ferramentas de IA
- [docs/ROQUESHIELD.md](docs/ROQUESHIELD.md): a ligação com o RoqueShield, com o estado dela dito sem enfeite
- [docs/AIDLC.md](docs/AIDLC.md): o método e como o kit o interpreta
- [docs/ADAPTADORES.md](docs/ADAPTADORES.md): Claude Code, Kiro e Copilot
- [docs/REGULADO.md](docs/REGULADO.md): perfil para empresas reguladas
- [docs/ESTENDER.md](docs/ESTENDER.md): como acrescentar uma tecnologia, um revisor, uma regra
- [docs/QUANDO-QUEBRA.md](docs/QUANDO-QUEBRA.md): o que cada resultado do gate significa
- [docs/ESTRATEGIA.md](docs/ESTRATEGIA.md): o raciocínio por trás das decisões
- [docs/GLOSSARIO.md](docs/GLOSSARIO.md): termos e perguntas frequentes
- [OPERATING-MODEL.md](OPERATING-MODEL.md): o modelo operacional, com o mecanismo de cada regra

## Limites conhecidos

Dito sem enfeite, para você não descobrir na hora errada:

- **Testado:** Linux, com Node 22. As suítes do repositório (`node --test`) cobrem hooks, fases, scanner de identidade, `aidlc-init`, instalação e manifestos, e cada mecanismo novo foi testado com mutantes.
- **Não testado em máquina real:** macOS, Windows (o `setup` gera atalhos `.cmd`, mas ninguém os executou), Kiro e Copilot. As convenções de arquivo dessas duas ferramentas foram conferidas na documentação pública, e a documentação muda.
- **A ligação com o RoqueShield foi validada contra a documentação dele**, com relatórios sintéticos, não contra uma instância em execução. O SARIF e o formato neutro são testados com os exemplos de `docs/exemplos/scan/`; a invocação de cada scanner externo, não.
- **Hooks só existem no Claude Code.** Em Kiro e Copilot, o que impede um "pronto" sem evidência é o CI e a revisão humana.
- **O scanner de identidade acha formatos, não nomes.** Ele pega IP, e-mail, caminho de home, hostname e segredo. Nome de pessoa, de cliente ou de sistema interno só é pego se estiver na sua lista de termos proibidos, que fica fora do repositório.
- **`aidlc-phase` confere forma, não verdade.** Ele garante que a aprovação existe e não é de uma IA. Se o nome escrito é de quem realmente aprovou, é revisão humana.

## English summary

`aidlc-harness` is an open-source quality harness for building software with AI agents following the AI-DLC cycle (Inception, Construction, Operations). Acceptance criteria are executable data (`quality/*.json`), "done" requires pasted gate output, and phase approvals must be filled in by a human (`aidlc-phase check`). One `AGENTS.md` source generates the instruction files for Claude Code, Kiro and GitHub Copilot. Hooks that actually block run only in Claude Code; for Kiro and Copilot the CI workflow is the enforcement point. An identity scanner (`aidlc-identity`) keeps IPs, emails, home paths, internal hostnames, secrets and your own denylist terms out of the repository. `aidlc-scan` reads the report of any security platform (SARIF, a neutral format, or the AI Fix Bundle of the open-source [RoqueShield](docs/ROQUESHIELD.md), which the kit does not depend on) and separates three outcomes, not two: clean, failed, and **did not run**. A scan that did not run is never clean.

Status: pre-release 0.1.0, tested on Linux with Node 22. macOS, Windows, Kiro and Copilot are untested. This is an interpretation of AI-DLC, not AWS documentation. Documentation is in Brazilian Portuguese first; English translations of the guides are welcome (see CONTRIBUTING).

## Licença

[MIT](LICENSE). Contribuições seguem o [DCO](CONTRIBUTING.md#dco): assine os commits com `git commit -s`.
