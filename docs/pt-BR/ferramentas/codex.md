# OpenAI Codex com o aidlc-harness

*Também em [inglês](../../tools/codex.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

## Em resumo

| | |
| --- | --- |
| Comando | `$aidlc-inception` (depois de entrar no modo Plan com /plan) |
| Janela de perguntas | `request_user_input` |
| Hooks do kit | sim |
| Verificado em máquina de verdade | ainda não (documentação conferida em 2026-11-06) |

## Passo a passo

1. Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools codex
    ```

2. O que a ferramenta recebe:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.codex/hooks.json`
    - `.aidlc/COMANDOS.md`

3. Rode `codex` no projeto e depois `/hooks` para revisar e confiar nos hooks do kit (o Codex ignora hooks de projeto até você confiar).
4. Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.
5. Rode a Inception: ponha em `aidlc/inception/insumos/` o que já existe sobre o pedido e digite `$aidlc-inception` com uma frase do que você quer. (depois de entrar no modo Plan com /plan)
6. O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois no máximo cinco perguntas na janela do `request_user_input`, com a opção recomendada primeiro. Aceitar todas as recomendações é uma resposta válida.
7. Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.

## Limites

- O `request_user_input` só existe no modo Plan: entre com `/plan` antes da Inception.
- Os hooks precisam do `aidlc-hook` no `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).

## Fonte

O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em 2026-11-06: <https://learn.chatgpt.com/docs/hooks>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.
