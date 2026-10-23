# Adaptadores: Claude Code, Kiro e GitHub Copilot

O kit funciona com as três ferramentas, mas **não da mesma maneira**. Este documento diz o que cada uma recebe, o que é garantido por mecanismo e o que é só instrução, e como você confere isso na sua versão.

## A ideia

Uma fonte, três cópias:

```
AGENTS.md  ──▶  CLAUDE.md                          (importa o AGENTS.md)
           ──▶  .github/copilot-instructions.md    (cópia gerada)
           ──▶  .kiro/steering/aidlc.md            (cópia gerada, inclusion: always)
```

Você edita só o `AGENTS.md`. `aidlc-init --check` falha se uma cópia divergir (e o CI roda esse `--check`), e `aidlc-init --sync` as regrava. Instrução copiada à mão diverge em silêncio, e a divergência é o pior defeito deste desenho, porque cada ferramenta passa a obedecer a uma regra diferente sem ninguém perceber.

## Instrução versus mecanismo

| Garantia | Claude Code | Kiro | GitHub Copilot |
| --- | --- | --- | --- |
| O agente **lê** as regras do projeto | sim | sim | sim |
| "Pronto" sem a saída do gate é **recusado** (hook de Stop) | **sim**, pelo plugin | não | não |
| Comando com segredo ou gerenciador de pacote errado é **bloqueado** (hooks de PreToolUse) | **sim**, pelo plugin | não | não |
| Contexto relevante é **entregue** ao editar um arquivo (`path-strategy`) | **sim**, pelo plugin | não | não |
| Os executáveis `aidlc-*` funcionam | sim | sim | sim |
| O CI reprova identidade vazada, fase incompleta e gate vermelho | sim | sim | sim |
| Revisão humana do pull request | sim | sim | sim |

Leia a tabela com honestidade: **fora do Claude Code, o kit instrui, e quem impede é o CI e as pessoas.** Isso é bastante (o CI reprova de verdade), mas não é o mesmo que um hook que corta o turno do agente no meio. Se a sua organização exige o bloqueio no momento da ação nas três ferramentas, o kit hoje não entrega isso para Kiro e Copilot.

## Claude Code

- Instruções: `CLAUDE.md` com `@AGENTS.md`, que importa o arquivo inteiro.
- Plugin: `claude plugin marketplace add roqueribeiro/aidlc-harness` e `claude plugin install aidlc-harness@aidlc`. Os hooks, agentes, skills e comandos vêm juntos.
- Executáveis: `node scripts/setup.mjs` (o plugin não põe `aidlc-*` no PATH sozinho).
- Comandos: `/aidlc-harness:inception`, `/aidlc-harness:construction`, `/aidlc-harness:gate`, `/aidlc-harness:status`.
- Confira: `claude plugin validate <pasta do plugin> --strict` e, dentro da sessão, `/reload-plugins` seguido de `/context`.
- Configuração: `gate_mode` do plugin (`block`, `warn` ou `off`) controla os hooks de Stop. Comece em `warn` se a equipe ainda está se acostumando, e passe a `block` quando o gate estiver estável.

## Kiro

- Instruções: o [Kiro lê steering de `.kiro/steering/`](https://kiro.dev/docs/steering/) e, segundo a documentação pública, também lê `AGENTS.md` na raiz do workspace (sempre incluído, sem modos de inclusão). O `aidlc-init` gera `.kiro/steering/aidlc.md` com `inclusion: always`.
- **Duplicidade provável:** se a sua versão do Kiro lê o `AGENTS.md`, a cópia em `.kiro/steering/aidlc.md` é redundante e as regras entram duas vezes no contexto. Nesse caso rode `aidlc-init --tools claude,copilot` e apague a cópia. A cópia existe para versões que ainda não leem `AGENTS.md`.
- Sem plugin: os comandos `/inception` e `/construction` não existem. Use os textos de [PROMPTS.md](PROMPTS.md), colados no chat.
- Sem hooks do kit: o Kiro tem mecanismo próprio de hooks, que o kit **não** usa. Quem cobra a evidência é o CI.

## GitHub Copilot

- Instruções: a [documentação do GitHub](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions) cita `.github/copilot-instructions.md` (todo o repositório), `.github/instructions/*.instructions.md` (por caminho) e `AGENTS.md`, `CLAUDE.md` ou `GEMINI.md` como instruções de agente. O `aidlc-init` gera `.github/copilot-instructions.md`.
- **Qual superfície lê qual arquivo varia** (chat no GitHub, agente de código, revisão de código, CLI, IDEs) e a página que consultamos remete a uma matriz separada. Antes de confiar, faça o teste do canário abaixo na superfície que a sua equipe usa.
- Sem plugin e sem hooks do kit, como no Kiro. Use [PROMPTS.md](PROMPTS.md).

## O teste do canário

Não confie na tabela de ninguém, inclusive nesta. Confira na sua versão, na superfície que você usa:

1. Acrescente ao `AGENTS.md` uma linha única: `Canário: a palavra de controle deste projeto é "marmelada-42".` (e rode `aidlc-init --sync`).
2. Numa sessão **nova** da ferramenta, pergunte: "Qual é a palavra de controle deste projeto?"
3. Se ela responder `marmelada-42`, a ferramenta está lendo as instruções. Se não, ela não está, e nada do que o `AGENTS.md` diz está chegando ao agente.
4. Para a duplicidade: se a ferramenta lê o `AGENTS.md` **e** a cópia gerada, desligue uma das duas.
5. Remova o canário.

Faça isso uma vez por ferramenta e por versão major. É dez minutos que poupam semanas de uma regra que ninguém estava recebendo.

## Windows

Os hooks do plugin são scripts Node (`node "${CLAUDE_PLUGIN_ROOT}/hooks/…"`) e em tese rodam no Windows. Os gates dos manifestos executam comandos de shell (`yarn test`, `uv run pytest`), que dependem do shell que você usa. **Nada disso foi testado em Windows por quem escreveu o kit.** Se você testar, registre o resultado numa issue: é uma contribuição valiosa.

## Quando acrescentar uma quarta ferramenta

Gere a cópia a partir do `AGENTS.md` em `lib/init.mjs` (veja como `copilot` e `kiro` estão ligados lá), acrescente a conferência de divergência no `--check`, e escreva no mínimo um teste que falhe quando a cópia divergir. Regra sem esse teste vira a decoração que este kit existe para evitar.
