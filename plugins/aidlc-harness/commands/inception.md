---
description: 'Conduz a fase Inception do AI-DLC: perguntas em rodadas, requisitos, histórias e unidades de trabalho, até uma pessoa aprovar.'
argument-hint: '[o que se quer construir, em uma frase]'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Conduza a **Inception** deste projeto. A IA propõe e pergunta; a equipe responde e valida. Você não aprova nada.

Pedido inicial: $ARGUMENTS (se vazio, comece perguntando o que se quer construir).

## Antes de perguntar

1. Leia `AGENTS.md`, `context/product.md` e `aidlc/decisions.md`. O que está decidido ali não se reabre.
2. Rode `aidlc-phase status`. Se a Inception já tem arquivos preenchidos, **retome do ponto em que parou**: não recomece nem sobrescreva resposta que a equipe já deu.
3. Se `aidlc/` não existe, pare e peça para rodar `aidlc-init`.

## Como conduzir

**Pergunte em rodadas, no máximo cinco perguntas por rodada.** Cada pergunta traz, quando couber, opções numeradas e a sua recomendação com uma frase de motivo. Espere as respostas antes da rodada seguinte. Pergunta que a equipe já respondeu em outro lugar do repositório não se repete: cite onde está e peça só a confirmação.

Ordem das rodadas:

1. **Intenção e contexto:** o problema hoje, o resultado esperado, quem usa, quem decide.
2. **Escopo:** o que entra, o que fica de fora e por quê.
3. **Requisitos não funcionais e restrições:** desempenho, segurança, auditoria, retenção de dados, plataformas obrigatórias, prazos.
4. **Riscos e dúvidas em aberto:** o que ninguém sabe ainda, quem responde e até quando.

Ao fim de cada rodada, escreva as respostas **com as palavras da equipe** em `aidlc/inception/requirements.md`. Não invente requisito, número, nome de sistema ou norma que ninguém disse. Se faltar informação, a pergunta continua em "Perguntas em aberto".

## Depois dos requisitos

- **Histórias** em `aidlc/inception/user-stories.md`: cada uma com critérios de aceite que dá para dizer "atendido" ou "não atendido". Critério com adjetivo ("rápido", "intuitivo") volta para a equipe com a pergunta "como medimos?".
- **Unidades de trabalho** em `aidlc/inception/units-of-work.md`: entregas de ponta a ponta, pequenas, cada uma com as histórias que cobre, o que depende e a evidência que a dá por pronta.

## Como terminar

1. Remova todo `<!-- PREENCHER ... -->` que você resolveu. Deixe o que não foi respondido como pergunta em aberto, não como texto inventado.
2. Rode `aidlc-phase check inception` e cole a saída crua.
3. **Deixe `Aprovado por:` e `Data:` em branco.** Diga quem precisa aprovar e o que ela deve conferir. A aprovação é de uma pessoa: preencher a sua própria é fraude no processo, e o `aidlc-phase` reprova nome de IA.
4. Registre em `aidlc/decisions.md` cada decisão que a equipe tomou durante as rodadas.

Só depois que uma pessoa assinar e `aidlc-phase check inception` sair com 0, a Construction pode começar (`/construction`).
