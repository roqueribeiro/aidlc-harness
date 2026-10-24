# Modelo operacional

*Tradução de [OPERATING-MODEL.md](../../OPERATING-MODEL.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

Como trabalhamos com agentes de IA neste repositório e em qualquer projeto que adote o `aidlc-harness`. Este arquivo é normativo para o próprio kit: é a razão de o manifesto `harness-self` existir, e o `aidlc-gate` só reconhece este repositório quando ele está aqui.

A regra que organiza todo o resto: **regra sem mecanismo é decoração.** Toda norma abaixo aponta para o hook, o gate ou o manifesto que a executa. Se você quiser acrescentar uma norma, diga primeiro qual mecanismo vai cobrá-la.

## 1. Princípios

| # | Princípio | O que o executa |
| --- | --- | --- |
| 1 | **Critério de aceite é dado, não prosa.** Qual comando, que saída reprova, se bloqueia. | `quality/<tech>.json`, validado por `quality/_schema.json` e por `scripts/check-quality-manifests.mjs` |
| 2 | **Determinismo vence modelo quando a tarefa é mecânica.** Se uma checagem pode ser um script, é um script. | `tools/aidlc-*`, todos sem chamada a modelo |
| 3 | **Evidência antes de "pronto".** O agente cola a saída crua do gate; não a resume. | hook `dod-check` (Stop): recusa encerrar sem o marcador da evidência declarada no manifesto |
| 4 | **Quem aprova a fase é uma pessoa.** A IA propõe, a equipe valida. | `aidlc-phase check`: reprova campo `PREENCHER` e `Aprovado por:` vazio ou com nome de IA |
| 5 | **Check que nunca reprovou não é check.** Antes de declarar pronto, quebre de propósito. | `tools/aidlc-mutation` e a regra de escrever o mutante junto do teste (`skills/bolts`) |
| 6 | **Segredo não aparece em tela.** Nem echo, nem log, nem codificado. | hook `secret-guard` (PreToolUse) e `tools/aidlc-secrets exec` |
| 7 | **Nada que identifique pessoa ou infraestrutura vai para o repositório.** | `tools/aidlc-identity`, gate `identity` do CI |
| 8 | **Dependência nova só entra conferida.** Existe, tem dono, nome não imita outro, está no lockfile. | `tools/aidlc-lockcheck`, `tools/aidlc-secscan` e o agente `supply-chain-reviewer` |
| 9 | **O gerenciador de pacote é o do projeto.** O guard não presume um. | hook `pkg-manager`, lendo `pkgManager` do manifesto |
| 10 | **Ação irreversível pede confirmação.** Apagar, sobrescrever, publicar, force push. | instrução de `AGENTS.md` e o agente `advisor` para a decisão; nenhum hook substitui o julgamento aqui |
| 11 | **O contexto sempre carregado é curto.** Invariante fica, referência sai. | `tools/aidlc-harness --check` (orçamento do baseline) e `aidlc-doctor` (CLAUDE.md abaixo de 8 KB) |
| 12 | **Trabalho terminado deixa a bancada limpa.** | `tools/aidlc-limpeza` e a evidência `fechamento-limpeza` da camada org |

O item 10 é o único sem hook de bloqueio, de propósito: decidir se um apagar é seguro depende de contexto que um padrão de texto não tem. Ele fica com a instrução e com o humano.

## 2. Papéis de modelo

O erro caro não é escolher o modelo errado num turno; é pagar contexto de sobra em todos.

| Papel | Quando | Como |
| --- | --- | --- |
| **Scanner** | varredura mecânica sem julgamento: inventário, drift, triagem de lint | `agents/scanner.md`, modelo pequeno, esforço baixo |
| **Executor** | o turno a turno: implementar, rodar o gate, escrever documentação | a sessão principal |
| **Advisor** | decisão grande demais para o turno: arquitetura, refutar um achado, gate travado duas vezes, ação irreversível | `agents/advisor.md`, sob demanda, nunca a cada turno |

## 3. Autonomia declarada como dado

Cada manifesto declara `autonomy`: `observe` (só lê e relata), `advise` (recomenda, o humano executa), `approve` (propõe, o humano aprova, então executa) ou `breaker` (executa sozinho e o humano interrompe). O padrão é `approve`. Um gate pode declarar a sua e sobrescrever a da stack. O schema (`quality/_schema.json`) recusa valor fora dessa lista, e o `scripts/check-quality-manifests.mjs` aplica o schema.

## 4. Critério de aceite por tecnologia

O kit traz manifestos genéricos; cada projeto acrescenta os seus em `.aidlc/quality/<tech>.json` (veja [`docs/pt-BR/ESTENDER.md`](ESTENDER.md)).

| Tecnologia | Detecção | Gates bloqueantes |
| --- | --- | --- |
| `node-yarn` | `package.json` + `yarn.lock` | testes, `aidlc-secscan`, `supply-chain-reviewer`, `aidlc-lockcheck` (camada org) |
| `node-npm` | `package.json` + `package-lock.json` | os mesmos, com `npm` |
| `python-uv` | `pyproject.toml` + `uv.lock` | lint, formato, lockfile, segredo, testes unitários |
| `harness-self` | este repositório | `node --test`, sintaxe de todo `.mjs`, manifestos, integridade do plugin |

Lint e build começam como não bloqueantes nos manifestos genéricos, porque o kit não sabe se o seu projeto os tem. Transformar um em bloqueante é uma edição do manifesto, revisada como qualquer outra, nunca uma decisão de sessão.

## 5. Contrato de evidência

"Pronto" só vale com a evidência que o manifesto declara, colada no chat:

- **Gate:** a saída de `aidlc-gate`, crua. Resumo não vale.
- **Mudança visível:** capturas de tela abertas e lidas, não só geradas.
- **Fechamento de unidade de trabalho:** a linha final `aidlc-limpeza: nada sobrando`.
- **Fase do AI-DLC:** `aidlc-phase check <fase>` saindo com 0, e a aprovação de uma pessoa nos arquivos.

O `dod-check` grava cada decisão em `.claude/audit/<dia>.jsonl`, e o `aidlc-cycle` lê esse registro. O que não tem registro aparece como "não medido", nunca como zero.

## 6. O que fica fora deste modelo

- **Decisão de produto** mora em `context/product.md` e `aidlc/decisions.md` de cada projeto, não aqui.
- **Política de uma organização específica** (classificação de dados, aprovadores, fornecedores) mora num repositório interno que estende o kit. Veja [`docs/pt-BR/REGULADO.md`](REGULADO.md).
- **A documentação oficial do AI-DLC** é da AWS. `docs/pt-BR/AIDLC.md` é uma interpretação, e diz que é.

## 7. Como este arquivo é mantido

Mudou um hook, um manifesto ou uma ferramenta que a tabela da seção 1 cita? A mesma alteração atualiza esta tabela. O `scripts/check-docs-consistency.mjs` confere as contagens e os nomes que a documentação afirma; a revisão confere o resto.
