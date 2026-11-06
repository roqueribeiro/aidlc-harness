---
name: aidlc-inception
description: 'Conduz a fase Inception do AI-DLC recomendando primeiro: lê tudo, rascunha requisitos, histórias e unidades com as recomendações da IA, e pergunta à pessoa só o que ela não pode decidir sozinha (no máximo 5 perguntas, na janela de pergunta nativa da ferramenta). Use quando pedirem para começar um projeto, uma funcionalidade, a Inception, os requisitos ou as histórias.'
---

# Inception: recomendar primeiro, perguntar só o que trava

A IA propõe e a equipe valida. Você entrega um rascunho completo **antes** de perguntar qualquer coisa, decide sozinha o que é reversível e padrão de mercado, e leva para a pessoa no máximo 5 perguntas: só as que ela precisa decidir. Você não aprova nada.

A meta: um pedido de uma frase chega a requisitos, histórias e unidades prontos para aprovar em **uma rodada de perguntas e uma de revisão**. Processo lento é processo que ninguém usa.

## 1. Ler antes de perguntar

1. `AGENTS.md`, `context/product.md` e `aidlc/decisions.md`. O que está decidido ali não se reabre e não vira pergunta.
2. `aidlc-phase status`. Se a Inception já tem conteúdo, **retome de onde parou**: não recomece nem sobrescreva o que a equipe já respondeu.
3. Tudo o que estiver em `aidlc/inception/insumos/` (transcrição de reunião, briefing, print, planilha) e o código que já existe no repositório.
4. Se `aidlc/` não existe, pare e peça para rodar `aidlc-init`.

Pergunta cuja resposta está em algum desses lugares não é feita: cite onde está.

## 2. Escolher a profundidade

Proponha uma, com uma frase de motivo, e registre em `requirements.md` (seção Profundidade):

| Profundidade | Quando | O que sai |
| --- | --- | --- |
| rápida | correção, prova de conceito, mudança pequena | requisitos curtos, 1 a 3 histórias, 1 unidade |
| padrão | funcionalidade nova num produto que existe | requisitos completos, histórias com critério de aceite, unidades ordenadas |
| completa | produto novo, várias equipes, dado sensível, ambiente regulado | o padrão mais requisitos não funcionais detalhados, riscos e referência às normas que a equipe citar |

A pessoa troca a profundidade na mesma rodada de perguntas (ela entra como a primeira pergunta, com a sua recomendação marcada).

## 3. Rascunhar tudo

Preencha os três arquivos de `aidlc/inception/` com a sua melhor recomendação:

- `requirements.md`: intenção, quem usa e quem decide, requisitos funcionais verificáveis, não funcionais, restrições, fora de escopo.
- `user-stories.md`: cada história com critérios de aceite que dá para dizer "atendido" ou "não atendido" (Dado, quando, então). Critério com adjetivo ("rápido", "intuitivo") vira número ou vira pergunta.
- `units-of-work.md`: entregas pequenas de ponta a ponta, cada uma com as histórias que cobre, do que depende e a evidência que a dá por pronta.

Cada escolha que você fez sem a equipe vai para a seção **Premissas** de `requirements.md`, uma por linha, com o motivo: `- Login por e-mail e senha, sem SSO na primeira versão (motivo: o pedido não cita provedor de identidade)`.

Nunca invente nome de sistema interno, número, norma, prazo ou pessoa que ninguém citou. Isso não é premissa, é ficção: vira pergunta.

## 4. Separar o que é da pessoa

Vai para pergunta **só** o que a IA não pode decidir:

- irreversível ou caro de desfazer (modelo de dados público, contrato com outro sistema, escolha de plataforma);
- decisão de negócio, de escopo ou de prioridade;
- norma, compliance, auditoria, retenção de dados, dado pessoal ou sensível;
- custo, prazo, nome de produto, quem aprova.

Todo o resto você decide e registra como premissa. Ordene as candidatas por **impacto vezes incerteza** e fique com as 5 primeiras. As que sobrarem viram premissa com o motivo, ou pergunta em aberto com dono.

## 5. Perguntar na janela nativa

Faça **uma** chamada à ferramenta de pergunta da sua ferramenta, com todas as perguntas da rodada:

- cada pergunta com 2 a 4 opções, a recomendada **primeiro** e com "(Recomendado)" no rótulo, e uma linha de descrição dizendo o que muda se escolher;
- múltipla escolha quando as opções não se excluem;
- não crie uma opção "Outro": a janela já oferece o campo de texto livre;
- a primeira pergunta pode ser a profundidade; a última, quando houver premissas, é "Alguma destas premissas está errada?" com múltipla escolha.

| Ferramenta | Ferramenta de pergunta |
| --- | --- |
| Claude Code | `AskUserQuestion` (até 4 perguntas por chamada; com 5, faça duas chamadas seguidas) |
| OpenCode, Kilo Code | `question` (rode no agente principal: em subagente ela vem negada) |
| GitHub Copilot no VS Code | `askQuestions` (`#tool:vscode/askQuestions`) |
| GitHub Copilot CLI | `ask_user` |
| Cursor | Ask questions (a ferramenta de perguntas com opções) |
| Gemini CLI | `ask_user` |
| Devin | `ask_user_question` |
| Google Antigravity | o seletor de respostas (opções clicáveis e "Write-in") |
| JetBrains Junie | `AskUserQuestion` |
| Codex | `request_user_input` (disponível no modo Plan) |
| Cline | `ask_question` (uma pergunta por vez, até 5 opções) |
| Continue (CLI) | `AskQuestion` |

**Sem ferramenta de pergunta** (Kiro, Zed, Aider e qualquer outra), mande uma mensagem curta neste formato e espere a resposta:

```text
Rascunho pronto em aidlc/inception/. Preciso de você em 3 pontos; "ok" aceita todas as recomendações.

1. Profundidade: a) padrão (Recomendado: funcionalidade nova num produto existente) b) rápida c) completa
2. Onde ficam os dados de clientes? a) banco atual do produto (Recomendado) b) banco novo c) outro: ____
3. Alguma destas premissas está errada? (responda as letras) a) login sem SSO b) só português c) nenhuma
```

Em qualquer caso, sempre existe a saída **"aceitar todas as recomendações"**: na janela, como a opção recomendada de cada pergunta; em texto, como o "ok".

## 6. Registrar as respostas

- Escreva cada resposta **com as palavras da pessoa** no arquivo certo e ajuste o rascunho.
- A premissa que a pessoa marcou como errada vira pergunta da próxima rodada; as outras ficam.
- Cada decisão que a pessoa tomou vai para `aidlc/decisions.md`.
- Se surgiu dúvida nova que só a pessoa responde, faça mais uma rodada, de novo com no máximo 5 perguntas. Em geral uma rodada basta.

## 7. Fechar

1. Remova todo `<!-- PREENCHER ... -->` resolvido. O que não foi respondido fica em "Perguntas em aberto", com quem responde e até quando; no máximo 5.
2. Rode `aidlc-phase check inception` e cole a saída crua.
3. Deixe em branco `Aprovado por:`, `Data:` e `Premissas revisadas por:`. Diga quem precisa aprovar e o que conferir. Aprovar o próprio trabalho é fraude no processo, e o `aidlc-phase` reprova nome de IA.

A Construction só começa depois que uma pessoa assinar e `aidlc-phase check inception` sair com 0.

## O que o kit confere

| Regra | Quem executa |
| --- | --- |
| Nenhum campo por preencher, aprovação de uma pessoa com data | `aidlc-phase check inception` |
| No máximo 5 perguntas em aberto | `aidlc-phase check inception` reprova com mais de 5 |
| Premissa visível e revisada | `aidlc-phase check inception` exige a seção Premissas e, com premissas listadas, `Premissas revisadas por:` de uma pessoa |
| Pronto exige evidência | o gate de evidência (hook de Stop) nas ferramentas que têm hook; o CI nas outras |
