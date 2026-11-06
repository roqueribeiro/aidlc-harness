# Adaptadores: o que cada ferramenta de IA recebe

*Também em [inglês](../ADAPTERS.md).*

O kit roda em 15 ferramentas de IA, e **não do mesmo jeito em todas**. Este documento diz o que é comum a todas, o que cada uma recebe, o que é garantido por mecanismo e o que é só instrução, e como conferir na sua versão. O passo a passo de cada ferramenta está em [FERRAMENTAS.md](FERRAMENTAS.md).

## A ideia

Um método, um conjunto de regras, uma camada fina por ferramenta:

```
AGENTS.md (as regras, com o bloco do kit)        lido por todas as ferramentas
.agents/skills/aidlc-inception/SKILL.md          o método de cada fase, lido pela maioria
.agents/skills/aidlc-construction/SKILL.md
        │
        └── por ferramenta: o comando da fase na pasta e no formato dela,
            nomeando a janela de perguntas, mais hooks onde a ferramenta deixa
```

O `aidlc-init --tools <lista>` (ou o seletor que ele mostra num terminal) gera a camada de cada ferramenta escolhida a partir dos adaptadores em `plugins/aidlc-harness/lib/adaptadores.mjs`. Os arquivos gerados dizem que não se editam: o `aidlc-init --check` reprova quando um deles diverge do que o kit gera, e o `aidlc-init --sync` os regrava. Os arquivos de hook que o time pode já ter (`.cursor/hooks.json`, `.codex/hooks.json`) não são substituídos: as entradas do kit entram ao lado das do time.

## Instrução versus mecanismo

| Garantia | Claude Code | Copilot, Cursor, Codex | As outras 11 ferramentas |
| --- | --- | --- | --- |
| O agente **lê** as regras do projeto | sim | sim | sim |
| A Inception pergunta na **janela de perguntas** da ferramenta | sim (`AskUserQuestion`) | sim | onde a ferramenta tem uma (veja [FERRAMENTAS.md](FERRAMENTAS.md)) |
| "Pronto" sem gate verde **volta** para o agente | sim, o hook de Stop lê a evidência no chat | sim, o `aidlc-hook parada` confere o gate na árvore atual | não |
| Comando com segredo ou com o gerenciador errado é **bloqueado** | sim | sim, `aidlc-hook shell` | não |
| Os executáveis `aidlc-*` funcionam | sim | sim | sim |
| O CI reprova identidade vazada, fase incompleta e gate vermelho | sim | sim | sim |

Leia a tabela com honestidade: no Claude Code, no Copilot, no Cursor e no Codex o kit bloqueia; nas outras ele instrui, e quem segura é o CI e as pessoas. O CI reprova de verdade, mas não é o mesmo que um hook que devolve o agente antes do fim do turno.

## A janela de perguntas

O motivo de esta camada existir. Sem ela, cada ferramenta improvisa a Inception a partir do `AGENTS.md`, e em algumas isso vira uma lista numerada que a pessoa responde digitando. Cada comando gerado nomeia a ferramenta de pergunta da sua ferramenta e proíbe a lista numerada:

| Ferramenta | Ferramenta de pergunta | Observação |
| --- | --- | --- |
| Claude Code | `AskUserQuestion` | até 4 perguntas por chamada |
| OpenCode, Kilo Code | `question` | só no agente principal; negada em subagente |
| GitHub Copilot | `askQuestions` (VS Code), `ask_user` (CLI) | não existe no agente de nuvem |
| Cursor | Ask questions | não se declara, o comando pede por escrito |
| Gemini CLI | `ask_user` | |
| Codex | `request_user_input` | só no modo Plan |
| Devin Desktop | `ask_user_question` | |
| Cline | `ask_question` | uma pergunta por chamada, escolha única |
| JetBrains Junie | `AskUserQuestion` | |
| Continue | `AskQuestion` | só no CLI `cn` |
| Antigravity | seletor de respostas | o nome da ferramenta não está na documentação pública |
| Kiro, Augment, Zed | não tem | texto curto, opções em letras, "ok" aceita todas |

## Os hooks fora do Claude Code

GitHub Copilot, Cursor e Codex documentam hooks capazes de bloquear um comando e de devolver o agente no fim do turno. O `aidlc-init` grava `.github/hooks/aidlc.json`, `.cursor/hooks.json` e `.codex/hooks.json` chamando o `aidlc-hook`, que traduz o JSON de cada ferramenta e aplica as regras do plugin ([REFERENCIA.md](REFERENCIA.md#aidlc-hook)). Duas coisas para saber:

- **O `aidlc-hook` precisa estar no `PATH`**: instale o kit com `npm install -g github:roqueribeiro/aidlc-harness`.
- **O Codex só roda hooks de projeto depois que você confia neles**: rode `/hooks` uma vez no projeto.

A conferência do fim do turno não lê o transcript, cujo formato muda de ferramenta para ferramenta. Ela confere o que vale em todas: se a árvore de trabalho mudou, a última execução do `aidlc-gate` nesta mesma árvore tem de ter saído verde.

## O teste do canário

Não confie na tabela de ninguém, nem nesta. Confira na sua versão, na superfície que você usa:

1. Acrescente uma linha só ao `AGENTS.md`, fora do bloco do kit: `Canário: a palavra de controle deste projeto é "marmelada-42".` Depois rode `aidlc-init --sync`.
2. Numa sessão **nova** da ferramenta, pergunte: "Qual é a palavra de controle deste projeto?"
3. Se ela responder `marmelada-42`, a ferramenta está lendo as instruções. Se não, nada do que o `AGENTS.md` diz está chegando ao agente.
4. Para duplicação: se a ferramenta lê o `AGENTS.md` **e** uma cópia gerada (o Kiro lê o `AGENTS.md` e o `.kiro/steering/aidlc.md`), desligue um dos dois.
5. Tire o canário.

Faça isso uma vez por ferramenta e por versão grande. Dez minutos que poupam semanas de uma regra que ninguém estava recebendo.

## Windows

O CI roda o teste de máquina limpa e o pacote instalado no Windows: `npx`, `npm install -g`, `aidlc-init`, `aidlc-init --check`, `aidlc-gate` e `aidlc-doctor` funcionam lá. Os gates do manifesto rodam os comandos de shell da stack (`yarn test`, `mvn verify`), que dependem do que está instalado na máquina.

## Contribuir uma verificação

Toda página de ferramenta diz "Verificado em máquina de verdade: ainda não" até alguém rodar o kit naquela ferramenta e deixar prova. A página só muda com registro e print, então um "sim" nunca sai da palavra de ninguém:

1. Rode os passos 1 a 6 da página da ferramenta num projeto de verdade, numa versão recente da ferramenta.
2. Guarde pelo menos um print da janela de perguntas (ou das perguntas em texto, onde a ferramenta não tem janela) em `docs/assets/compatibilidade/<ferramenta>/`, por exemplo `docs/assets/compatibilidade/cursor/janela.png`. Corte o que identificar pessoa ou empresa.
3. Escreva `docs/compatibilidade/<ferramenta>.json`:

    ```json
    {
      "versao": "2.1.0",
      "data": "2026-11-10",
      "sistema": "macOS 15",
      "prints": ["docs/assets/compatibilidade/cursor/janela.png"],
      "viu": { "regras": true, "janela": true, "hooks": true }
    }
    ```

4. Rode `node scripts/gerar-ferramentas.mjs` e abra um pull request. A página passa a dizer qual versão, sistema e data foram verificados, e mostra os prints em "Evidência".

O gerador reprova, em vez de escrever "sim", quando falta campo no registro, a data não está em `AAAA-MM-DD`, o print não existe, não é imagem ou está fora da pasta da ferramenta. O `scripts/gerar-ferramentas.test.mjs` tem um mutante para cada um desses casos.

## Acrescentar uma ferramenta

1. Acrescente o adaptador em `plugins/aidlc-harness/lib/adaptadores.mjs`: nome, ferramenta de pergunta, onde vai o comando e em que formato, como o pedido chega, e os hooks se a ferramenta os tiver.
2. Acrescente as notas da ferramenta (fonte oficial, como abrir, limites, nos dois idiomas) em `NOTAS` no `scripts/gerar-ferramentas.mjs`, e rode-o.
3. O `lib/adaptadores.test.mjs` reprova se a ferramenta tem janela de perguntas e o comando dela não a nomeia, e o `scripts/gerar-ferramentas.test.mjs` reprova se ela não tem notas. Acrescente um mutante para o que for novo.
