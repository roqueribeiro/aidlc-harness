# Claude Code com o aidlc-harness

*Também em [inglês](../../tools/claude.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

## Em resumo

| | |
| --- | --- |
| Comando | `/inception` |
| Janela de perguntas | `AskUserQuestion` |
| Hooks do kit | sim |
| Verificado em máquina de verdade | ainda não (documentação conferida em 2026-11-06) |

## Passo a passo

1. Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools claude
    ```

2. O que a ferramenta recebe:

    - `AGENTS.md`
    - `CLAUDE.md`
    - `.claude/settings.json`
    - `.aidlc/COMANDOS.md`
    - `.aidlc/kit/`: uma cópia do kit, de onde hooks, gate e fases rodam (`node .aidlc/kit/tools/aidlc-gate`), sem instalar nada. Vai para o git; não se edita à mão

3. Abra o Claude Code no projeto e aceite o diálogo de confiança da pasta. O `.claude/settings.json`, gravado pelo `aidlc-init`, registra o marketplace do kit fixado nesta versão e habilita o plugin, que então carrega sozinho; em pasta não confiada, o Claude Code ignora as configurações do projeto.
4. Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.
5. Rode a Inception: ponha em `aidlc/inception/insumos/` o que já existe sobre o pedido e digite `/inception` com uma frase do que você quer.
6. O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois no máximo cinco perguntas na janela do `AskUserQuestion`, com a opção recomendada primeiro. Aceitar todas as recomendações é uma resposta válida.
7. Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.

## Limites

- O kit inteiro: hooks que bloqueiam (evidência no Stop, segredo, gerenciador de pacote), agentes, skills e comandos.
- O `AskUserQuestion` aceita até 4 perguntas por chamada; com 5, o agente faz duas chamadas.

## Fonte

O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em 2026-11-06: <https://code.claude.com/docs/en/plugins>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.
