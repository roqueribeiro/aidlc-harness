# Prompts para Kiro e GitHub Copilot

> **Arquivo gerado.** A fonte são os comandos em `plugins/aidlc-harness/commands/`. Não edite aqui: edite o comando e rode `node scripts/gerar-prompts.mjs`. O CI confere com `--check`.

No Claude Code, estes textos são os comandos `/aidlc-harness:inception` e `/aidlc-harness:construction`. Em Kiro e Copilot, que não carregam o plugin, cole o texto abaixo no chat do agente, trocando o trecho entre colchetes pelo seu pedido.

## Inception

````text
Conduza a **Inception** deste projeto. A IA propõe e pergunta; a equipe responde e valida. Você não aprova nada.

Pedido inicial: [Quero um cadastro de clientes com busca e histórico de alterações] (se vazio, comece perguntando o que se quer construir).

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
````

## Construction

````text
Conduza a **Construction**. Primeiro desenho e plano de testes, aprovados por uma pessoa; só então código.

Unidade alvo: [U1] (se vazio, a primeira de `aidlc/inception/units-of-work.md` sem entrega).

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
````
