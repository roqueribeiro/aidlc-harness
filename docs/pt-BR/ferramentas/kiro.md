# Kiro com o aidlc-harness

*Também em [inglês](../../tools/kiro.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

## Em resumo

| | |
| --- | --- |
| Comando | `/aidlc-inception` (ou #aidlc-inception no chat) |
| Janela de perguntas | não tem: texto com opções em letras |
| Hooks do kit | não, o CI cobra a evidência |
| Verificado em máquina de verdade | ainda não (documentação conferida em 2026-11-06) |

## Passo a passo

1. Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools kiro
    ```

2. O que a ferramenta recebe:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.kiro/skills/aidlc-inception/SKILL.md`
    - `.kiro/skills/aidlc-construction/SKILL.md`
    - `.kiro/steering/aidlc-inception.md`
    - `.kiro/steering/aidlc-construction.md`
    - `.aidlc/COMANDOS.md`
    - `.aidlc/kit/`: uma cópia do kit, de onde hooks, gate e fases rodam (`node .aidlc/kit/tools/aidlc-gate`), sem instalar nada. Vai para o git; não se edita à mão

3. Abra o projeto no Kiro (IDE ou CLI).
4. Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.
5. Rode a Inception: ponha em `aidlc/inception/insumos/` o que já existe sobre o pedido e digite `/aidlc-inception` com uma frase do que você quer. (ou #aidlc-inception no chat)
6. O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois uma mensagem curta com no máximo cinco perguntas, opções em letras e a recomendada marcada; "ok" aceita todas.
7. Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.

## Limites

- O Kiro não tem janela de perguntas: a Inception pergunta em texto curto, com opções em letras, a recomendada marcada, e "ok" aceita todas. É o mesmo formato do modo Plan do próprio Kiro.
- O Kiro também lê o `AGENTS.md`, então as regras podem entrar duas vezes com o `.kiro/steering/aidlc.md`; rode o teste do canário e fique com um.
- O kit ainda não gera hooks do Kiro: a evidência é cobrada pelo CI.

## Fonte

O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em 2026-11-06: <https://kiro.dev/docs/steering/>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.
