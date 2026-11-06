# GitHub Copilot com o aidlc-harness

*Também em [inglês](../../tools/copilot.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

## Em resumo

| | |
| --- | --- |
| Comando | `/aidlc-inception` (no VS Code; no Copilot CLI, peça a skill aidlc-inception) |
| Janela de perguntas | `askQuestions` |
| Hooks do kit | sim |
| Verificado em máquina de verdade | ainda não (documentação conferida em 2026-11-06) |

## Passo a passo

1. Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools copilot
    ```

2. O que a ferramenta recebe:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.github/prompts/aidlc-inception.prompt.md`
    - `.github/prompts/aidlc-construction.prompt.md`
    - `.github/hooks/aidlc.json`
    - `.aidlc/COMANDOS.md`

3. No VS Code, abra o projeto com o Copilot Chat no modo **Agent**. No Copilot CLI, rode `copilot` no projeto.
4. Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.
5. Rode a Inception: ponha em `aidlc/inception/insumos/` o que já existe sobre o pedido e digite `/aidlc-inception` com uma frase do que você quer. (no VS Code; no Copilot CLI, peça a skill aidlc-inception)
6. O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois no máximo cinco perguntas na janela do `askQuestions`, com a opção recomendada primeiro. Aceitar todas as recomendações é uma resposta válida.
7. Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.

## Limites

- Prompt files (`/aidlc-inception`) são do VS Code; no CLI, peça a skill `aidlc-inception`.
- Os hooks precisam do `aidlc-hook` no `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).
- O agente de nuvem não tem janela de perguntas: ele pergunta no pull request.

## Fonte

O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em 2026-11-06: <https://code.visualstudio.com/docs/agent-customization/prompt-files>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.
