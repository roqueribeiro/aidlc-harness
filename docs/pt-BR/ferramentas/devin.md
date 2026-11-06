# Devin Desktop (ex-Windsurf) com o aidlc-harness

*Também em [inglês](../../tools/devin.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

## Em resumo

| | |
| --- | --- |
| Comando | `/aidlc-inception` (a skill vira comando) |
| Janela de perguntas | `ask_user_question` |
| Hooks do kit | não, o CI cobra a evidência |
| Verificado em máquina de verdade | ainda não (documentação conferida em 2026-11-06) |

## Passo a passo

1. Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools devin
    ```

2. O que a ferramenta recebe:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.aidlc/COMANDOS.md`
    - `.aidlc/kit/`: uma cópia do kit, de onde hooks, gate e fases rodam (`node .aidlc/kit/tools/aidlc-gate`), sem instalar nada. Vai para o git; não se edita à mão

3. Abra o projeto no Devin Desktop (antigo Windsurf). Ele lê o `AGENTS.md` e `.agents/skills/`.
4. Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.
5. Rode a Inception: ponha em `aidlc/inception/insumos/` o que já existe sobre o pedido e digite `/aidlc-inception` com uma frase do que você quer. (a skill vira comando)
6. O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois no máximo cinco perguntas na janela do `ask_user_question`, com a opção recomendada primeiro. Aceitar todas as recomendações é uma resposta válida.
7. Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.

## Limites

- O Devin também carrega o próprio plugin do Claude Code (`devin plugins install roqueribeiro/aidlc-harness`), o que traz os hooks; esse caminho não foi exercido.

## Fonte

O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em 2026-11-06: <https://docs.devin.ai/desktop/devin-local/customizations.md>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.
