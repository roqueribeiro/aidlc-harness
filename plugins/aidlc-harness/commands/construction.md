---
description: 'Conduz a fase Construction do AI-DLC: desenho e plano de testes recomendados e aprovados por uma pessoa antes do código, depois uma unidade de trabalho por vez.'
argument-hint: '[número da unidade, padrão: a primeira sem entrega]'
allowed-tools: Skill, AskUserQuestion, Bash, Read, Write, Edit, Glob, Grep
---

Conduza a **Construction** seguindo a skill `aidlc-harness:aidlc-construction` (carregue-a com a ferramenta Skill antes de qualquer outra coisa).

Unidade alvo: $ARGUMENTS (se vazio, a primeira de `aidlc/inception/units-of-work.md` sem entrega).

No Claude Code:

- A porta de entrada é `aidlc-phase check inception`: se sair com erro, pare e mostre a saída.
- Pergunte **sempre** com `AskUserQuestion`, no máximo 5 perguntas, a recomendada primeiro. Nunca peça para a pessoa responder lista numerada digitando.
- Você não aprova: `Aprovado por:` e `Data:` ficam em branco, e `aidlc-phase check construction` com a saída crua fecha o desenho.
