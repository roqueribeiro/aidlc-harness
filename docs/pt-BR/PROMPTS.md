# Texto dos comandos do Claude Code

> **Arquivo gerado.** A fonte são os comandos em `plugins/aidlc-harness/commands/`. Não edite aqui: edite o comando e rode `node scripts/gerar-prompts.mjs`. O CI confere com `--check`.

No Claude Code, estes textos são os comandos `/aidlc-harness:inception` e `/aidlc-harness:construction`. As outras ferramentas não precisam colar nada: o `aidlc-init` gera o comando de cada uma no formato dela (veja `docs/pt-BR/FERRAMENTAS.md`). O método completo de cada fase está nas skills `aidlc-inception` e `aidlc-construction`.

## Inception

````text
Conduza a **Inception** deste projeto seguindo a skill `aidlc-harness:aidlc-inception` (carregue-a com a ferramenta Skill antes de qualquer outra coisa). Ela é a fonte do método; este comando só fixa o que vale no Claude Code.

Pedido inicial: [Quero um cadastro de clientes com busca e histórico de alterações] (se vazio, leia os insumos e o repositório e proponha você mesmo um ponto de partida antes de perguntar).

No Claude Code:

- Pergunte **sempre** com a ferramenta `AskUserQuestion`: até 4 perguntas por chamada, 2 a 4 opções cada, a recomendada primeiro com "(Recomendado)" no rótulo, `multiSelect` quando as opções não se excluem. Nunca escreva perguntas numeradas no texto para a pessoa responder digitando.
- O rascunho completo vem **antes** da primeira pergunta, e são no máximo 5 perguntas na rodada (com 5, duas chamadas seguidas).
- Você não aprova: `Aprovado por:`, `Data:` e `Premissas revisadas por:` ficam em branco, e `aidlc-phase check inception` com a saída crua fecha o turno.
````

## Construction

````text
Conduza a **Construction** seguindo a skill `aidlc-harness:aidlc-construction` (carregue-a com a ferramenta Skill antes de qualquer outra coisa).

Unidade alvo: [U1] (se vazio, a primeira de `aidlc/inception/units-of-work.md` sem entrega).

No Claude Code:

- A porta de entrada é `aidlc-phase check inception`: se sair com erro, pare e mostre a saída.
- Pergunte **sempre** com `AskUserQuestion`, no máximo 5 perguntas, a recomendada primeiro. Nunca peça para a pessoa responder lista numerada digitando.
- Você não aprova: `Aprovado por:` e `Data:` ficam em branco, e `aidlc-phase check construction` com a saída crua fecha o desenho.
````
