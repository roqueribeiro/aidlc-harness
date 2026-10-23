---
description: 'Conduz a fase Construction do AI-DLC: desenho e plano de testes aprovados antes do código, e depois uma unidade de trabalho por vez.'
argument-hint: '[número da unidade, padrão: a primeira sem entrega]'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Conduza a **Construction**. Primeiro desenho e plano de testes, aprovados por uma pessoa; só então código.

Unidade alvo: $ARGUMENTS (se vazio, a primeira de `aidlc/inception/units-of-work.md` sem entrega).

## Porta de entrada

```bash
aidlc-phase check inception
```

Se sair com erro, **pare** e mostre a saída. Sem Inception completa e aprovada, não há desenho a fazer: o que falta é a equipe.

## 1. Desenho (`aidlc/construction/design.md`)

- Leia as unidades e as histórias. Proponha a arquitetura com **duas alternativas reais** quando houver decisão técnica aberta, cada uma com o que custa e o que ganha, e a sua recomendação.
- Pergunte, em rodadas de no máximo cinco, o que só a equipe sabe: padrões internos, plataformas aprovadas, integrações, dados sensíveis.
- Registre o escolhido **e o descartado, com o motivo**. Contrato novo ou alterado entre repositórios passa por `aidlc-graph blast` antes de entrar no desenho.

## 2. Plano de testes (`aidlc/construction/test-plan.md`)

- Cada critério de aceite das histórias aparece ligado ao teste que o prova (arquivo e nome). Critério sem teste previsto é pergunta para a equipe, não lacuna aceita.
- Diga quais checks novos serão quebrados de propósito para provar que reprovam (`aidlc-mutation`).
- Escreva o que **continuará sem verificação**. "Nada" só se for verdade.

## 3. Aprovação

Rode `aidlc-phase check construction`, cole a saída e deixe `Aprovado por:` e `Data:` em branco. A pessoa que aprova assina nos dois arquivos. Você não assina.

## 4. Código, uma unidade por vez

Com a Construction aprovada, siga `skills/bolts` (`/bolts`):

1. Branch curta da unidade.
2. Teste primeiro, código depois, no mesmo diff. Mecanismo novo nasce com mutante.
3. `aidlc-gate` e **a saída crua colada**.
4. Dependência nova: `supply-chain-reviewer` antes de seguir.
5. Antes de fechar: `aidlc-identity`, `aidlc-limpeza` e a linha final no chat.

Uma unidade que descobre trabalho novo não cresce: o trabalho vira unidade nova no plano, e o plano volta para aprovação se mudar o escopo.
