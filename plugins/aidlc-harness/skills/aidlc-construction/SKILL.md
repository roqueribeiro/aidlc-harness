---
name: aidlc-construction
description: 'Conduz a fase Construction do AI-DLC: desenho e plano de testes recomendados pela IA e aprovados por uma pessoa antes do código, depois uma unidade de trabalho por vez com teste e evidência. Use quando a Inception estiver aprovada e pedirem o desenho, a arquitetura, o plano de testes ou para começar a construir.'
---

# Construction: desenho e testes aprovados, depois código

Primeiro o desenho e o plano de testes, aprovados por uma pessoa; só então código. Como na Inception, você rascunha tudo com a sua recomendação e pergunta só o que a equipe precisa decidir.

## Porta de entrada

Rode `node .aidlc/kit/tools/aidlc-phase check inception`. Se sair com erro, **pare** e mostre a saída: sem Inception aprovada, o que falta é a equipe, não o desenho.

Unidade alvo: a pedida, ou a primeira de `aidlc/inception/units-of-work.md` sem entrega.

## 1. Desenho (`aidlc/construction/design.md`)

1. Leia as unidades, as histórias, `context/product.md`, `aidlc/decisions.md` e o código existente.
2. Escreva o desenho completo com a sua recomendação. Onde houver decisão técnica aberta de verdade, mostre **duas alternativas reais**, o que cada uma custa e ganha, e qual você recomenda.
3. Registre o escolhido **e o descartado, com o motivo**. Contrato novo ou alterado entre repositórios passa por `node .aidlc/kit/tools/aidlc-graph blast` antes de entrar no desenho.
4. Perguntas: só o que a equipe sabe e você não (padrões internos, plataformas aprovadas, integrações, dados sensíveis, custo). No máximo 5, na janela de pergunta nativa da sua ferramenta, recomendada primeiro, exatamente como na skill `aidlc-inception` (a tabela de ferramentas e o formato em texto estão lá).

## 2. Plano de testes (`aidlc/construction/test-plan.md`)

- Cada critério de aceite das histórias ligado ao teste que o prova (arquivo e nome). Critério sem teste previsto vira pergunta, não lacuna aceita.
- Quais checks novos serão quebrados de propósito para provar que reprovam (`node .aidlc/kit/tools/aidlc-mutation`).
- O que **continuará sem verificação**. "Nada" só se for verdade.

## 3. Aprovação

Rode `node .aidlc/kit/tools/aidlc-phase check construction`, cole a saída crua e deixe `Aprovado por:` e `Data:` em branco nos dois arquivos. A pessoa que aprova assina. Você não assina.

## 4. Código, uma unidade por vez

Com a Construction aprovada, siga a skill `bolts`:

1. Branch curta da unidade.
2. Teste primeiro, código depois, no mesmo diff. Mecanismo novo nasce com mutante.
3. `node .aidlc/kit/tools/aidlc-gate` e **a saída crua colada**.
4. Dependência nova: `supply-chain-reviewer` (ou a revisão equivalente da sua ferramenta) antes de seguir.
5. Antes de fechar: `node .aidlc/kit/tools/aidlc-identity`, `node .aidlc/kit/tools/aidlc-limpeza` e a linha final no chat.

Uma unidade que descobre trabalho novo não cresce: o trabalho vira unidade nova no plano, e o plano volta para aprovação se mudar o escopo.
