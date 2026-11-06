# Cursor com o aidlc-harness

*Também em [inglês](../../tools/cursor.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

## Em resumo

| | |
| --- | --- |
| Comando | `/aidlc-inception` |
| Janela de perguntas | `Ask questions` |
| Hooks do kit | sim |
| Verificado em máquina de verdade | ainda não (documentação conferida em 2026-11-06) |

## Passo a passo

1. Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools cursor
    ```

2. O que a ferramenta recebe:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.cursor/commands/aidlc-inception.md`
    - `.cursor/commands/aidlc-construction.md`
    - `.cursor/hooks.json`
    - `.aidlc/COMANDOS.md`

3. Abra o projeto no Cursor, no modo Agent. Ele lê o `AGENTS.md` sozinho.
4. Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.
5. Rode a Inception: ponha em `aidlc/inception/insumos/` o que já existe sobre o pedido e digite `/aidlc-inception` com uma frase do que você quer.
6. O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois no máximo cinco perguntas na janela do `Ask questions`, com a opção recomendada primeiro. Aceitar todas as recomendações é uma resposta válida.
7. Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.

## Limites

- Não há como declarar a ferramenta "Ask questions" num comando: o comando pede por escrito.
- Os hooks precisam do `aidlc-hook` no `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).

## Fonte

O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em 2026-11-06: <https://cursor.com/docs/agent/hooks>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.
