# Glossário e perguntas frequentes

*Tradução de [GLOSSARY.md](../GLOSSARY.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

## Glossário

| Termo | Significado neste kit |
| --- | --- |
| **AI-DLC** | AI-Driven Development Life Cycle: método da AWS (publicado em julho de 2025) em que a IA conduz o planejamento e a equipe valida. Fases: Inception, Construction, Operations. O kit é uma **interpretação prática**, não produto nem documentação da AWS ([AIDLC.md](AIDLC.md)) |
| **Inception** | Fase em que a IA pergunta e a equipe responde: requisitos, histórias e unidades de trabalho. Termina com a assinatura de uma pessoa |
| **Construction** | Desenho e plano de testes aprovados antes do código; depois, código e testes no mesmo diff, uma unidade por vez |
| **Operations** | Entrega e observação. É a fase mais fina do kit |
| **Bolt** | Ciclo curto de entrega que fecha uma **unidade de trabalho** com teste, evidência e limpeza (skill `bolts`) |
| **Unidade de trabalho** | Pedaço de entrega com fronteira clara, definida em `aidlc/inception/units-of-work.md` |
| **Gate** | Uma verificação executável do manifesto (`cmd` ou `agent`). **Bloqueante** reprova o `aidlc-gate` quando falha |
| **Critério de aceite** | O conjunto de gates e evidências de uma tecnologia, como dado, em `quality/<tech>.json` |
| **Evidência** | O que precisa aparecer **no chat** antes de declarar pronto (a saída crua do gate, um print, o veredito do revisor). O hook de `Stop` a procura por marcadores |
| **Manifesto** | O arquivo JSON de uma tecnologia: como reconhecê-la, o que rodar, o que provar, o que ler antes de escrever |
| **Tecnologia (`tech`)** | O identificador de um manifesto (`node-yarn`, `python-uv`...). O do projeto sobrescreve o do kit |
| **Camada da organização** | `quality/_org.json`: gates e evidências que valem para toda stack que casa um `when`, escritos uma vez |
| **Estratégia (`strategy`)** | O recorte do manifesto que diz **o que ler antes de escrever**, por caminho tocado, e qual revisor a stack exige |
| **Hook** | Processo que o Claude Code dispara em um evento (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`) |
| **Falhar para o lado de liberar** | Princípio dos hooks: sem certeza, saem com 0. Bloquear por engano custa mais que deixar passar um caso |
| **Kill switch** | Variável que desliga um hook em emergência (`AIDLC_GATE=0` e semelhantes). Existe para um gate nunca virar prisão |
| **`gate_mode`** | Opção do plugin: `block`, `warn` ou `off`, para os hooks de `Stop` |
| **PASSOU / FALHOU / PULADO / PENDENTE** | Resultados de um gate. **PULADO**: a plataforma atual não consegue rodá-lo (nunca vira verde). **PENDENTE**: um revisor ainda não deu o veredito ([QUANDO-QUEBRA.md](QUANDO-QUEBRA.md)) |
| **Cobertura (de varredura)** | Se todos os scanners esperados rodaram. **Completa**, **incompleta** ou **desconhecida**; só a primeira permite "limpo" |
| **Limpo / reprovado / não rodou** | Os três resultados do `aidlc-scan` (saídas 0, 1 e 2). **Não rodou** nunca conta como limpo |
| **Achado** | Um problema que um scanner reportou, com severidade, título, local e chave estável |
| **Chave estável** | Identificador do achado que sobrevive entre varreduras (`key`, `deduped_key`); é o que `--baseline` usa para dizer o que mudou |
| **Baseline** | O relatório anterior, contra o qual um novo é comparado |
| **SARIF** | Static Analysis Results Interchange Format 2.1.0, padrão de relatório de análise estática que muitas ferramentas exportam |
| **Formato neutro** | O contrato próprio do kit (`coverage_complete`, `scanners_ran`, `findings`), alvo de qualquer conversão |
| **AI Fix Bundle** | O JSON do RoqueShield (schema 1.0.0) com achados deduplicados e priorizados para um agente corrigir ([ROQUESHIELD.md](ROQUESHIELD.md)) |
| **Mutante** | Quebra proposital do código para provar que um teste reprova. Todo check novo nasce com um |
| **Slopsquatting** | Alguém registra o nome de um pacote que modelos de IA costumam inventar. O `aidlc-lockcheck` e o `supply-chain-reviewer` existem por isso |
| **Scratch** | Pasta de rascunho fora de qualquer repositório, que o `scratch-guard` (opt-in) impõe |
| **Kernel** | `context/kernel.md`: três linhas de contexto de produto que o `session-brief` injeta em toda sessão |
| **`AGENTS.md`** | A fonte única de instruções para qualquer ferramenta de IA. Kiro e Copilot recebem cópias derivadas |
| **Steering (Kiro)** | O mecanismo de instruções persistentes do Kiro (`.kiro/steering/`) |
| **DCO** | Developer Certificate of Origin: cada commit leva `Signed-off-by` (`git commit -s`) |

## Perguntas frequentes

### O kit funciona só com Claude Code?

As instruções (`AGENTS.md`) e os executáveis `aidlc-*` funcionam com qualquer ferramenta; os **hooks que bloqueiam** só existem no Claude Code. Em Kiro e GitHub Copilot, o que impede um "pronto" sem evidência é o CI (`aidlc-gate.yml`) e a revisão humana. Veja [ADAPTADORES.md](ADAPTADORES.md).

### Preciso do RoqueShield?

Não. Ele é uma das plataformas que o `aidlc-scan` sabe ler. Com SARIF, com o formato neutro, com o `aidlc-secscan` embutido ou sem varredura nenhuma, o kit funciona. Veja [ROQUESHIELD.md](ROQUESHIELD.md).

### O que acontece se o scanner cair?

O relatório não existe ou vem com cobertura incompleta, e o `aidlc-scan` sai com **2 (não rodou)**, que reprova o gate. É o ponto do contrato: um scan que não rodou não é um scan limpo.

### O hook pode me prender numa sessão?

Não. Depois de 3 recusas na mesma sessão o `dod-check` vira aviso e libera; `gate_mode` aceita `warn` e `off`; `AIDLC_GATE=0` desliga tudo. Um gate que prende é desligado na primeira semana, então o desenho cobra pouco e deixa saída.

### A IA pode aprovar uma fase sozinha?

O `aidlc-phase check` recusa aprovação em branco e nome de ferramenta de IA. Ele **não prova** que o nome é de quem tem autoridade: isso é do seu processo (por exemplo, revisão obrigatória do pull request que comita a assinatura).

### Como mudo o critério de aceite para o meu projeto?

Crie `.aidlc/quality/<tech>.json` com o mesmo `tech` do kit: ele sobrescreve. Para uma regra que vale para toda stack da organização, use a camada `_org.json`. Veja [ESTENDER.md](ESTENDER.md).

### Posso usar numa empresa regulada?

O kit foi pensado para isso, mas **a camada interna de uma organização não mora aqui**: mantenha manifestos, termos proibidos e regras internas num repositório privado seu. Veja [REGULADO.md](REGULADO.md).

### Os documentos e os diagramas podem ficar desatualizados?

Existem checks para isso: `check-docs-consistency` (contagens), `check-reference` (a referência cobre tudo o que existe e a prosa não cita comando que não existe) e `gerar-diagramas --check` (SVG acompanha o código). Todos rodam no CI.

### O que ainda não foi verificado?

macOS, Windows, Kiro, GitHub Copilot, o piso de Node 20.19 (só o 22 rodou) e a integração com o RoqueShield contra uma instância em execução. A lista completa, sem enfeite, está em [ARQUITETURA.md](ARQUITETURA.md#14-limites-conhecidos).

### Como contribuo?

Leia o [CONTRIBUTING.md](CONTRIBUTING.md). Em resumo: todo check novo vem com mutante, "pronto" exige a saída crua do `node --test`, e os commits levam `Signed-off-by`.

### Quero traduzir a documentação.

Bem-vindo. A documentação é em inglês primeiro, com o par completo em português do Brasil em `docs/pt-BR/`. As mensagens que o kit imprime continuam em português.
