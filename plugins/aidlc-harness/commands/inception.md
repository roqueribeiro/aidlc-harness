---
description: 'Conduz a fase Inception do AI-DLC: a IA rascunha requisitos, histórias e unidades com as recomendações dela e pergunta só o que a equipe precisa decidir, na janela de perguntas.'
argument-hint: '[o que se quer construir, em uma frase]'
allowed-tools: Skill, AskUserQuestion, Bash, Read, Write, Edit, Glob, Grep
---

Conduza a **Inception** deste projeto seguindo a skill `aidlc-harness:aidlc-inception` (carregue-a com a ferramenta Skill antes de qualquer outra coisa). Ela é a fonte do método; este comando só fixa o que vale no Claude Code.

Pedido inicial: $ARGUMENTS (se vazio, leia os insumos e o repositório e proponha você mesmo um ponto de partida antes de perguntar).

No Claude Code:

- Pergunte **sempre** com a ferramenta `AskUserQuestion`: até 4 perguntas por chamada, 2 a 4 opções cada, a recomendada primeiro com "(Recomendado)" no rótulo, `multiSelect` quando as opções não se excluem. Nunca escreva perguntas numeradas no texto para a pessoa responder digitando.
- O rascunho completo vem **antes** da primeira pergunta, e são no máximo 5 perguntas na rodada (com 5, duas chamadas seguidas).
- Você não aprova: `Aprovado por:`, `Data:` e `Premissas revisadas por:` ficam em branco, e `aidlc-phase check inception` com a saída crua fecha o turno.
