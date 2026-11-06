# GitHub Copilot with aidlc-harness

*Also available in [Brazilian Portuguese](../pt-BR/ferramentas/copilot.md).*

> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.

## At a glance

| | |
| --- | --- |
| Command | `/aidlc-inception` (in VS Code; in the Copilot CLI, ask for the aidlc-inception skill) |
| Question window | `askQuestions` |
| Kit hooks | yes |
| Verified on a real machine | not yet (documentation checked on 2026-11-06) |

## Step by step

1. Prepare the project (in its folder, with Node 20.19 or newer):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools copilot
    ```

2. What the tool receives:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.github/prompts/aidlc-inception.prompt.md`
    - `.github/prompts/aidlc-construction.prompt.md`
    - `.github/hooks/aidlc.json`
    - `.aidlc/COMANDOS.md`
    - `.aidlc/kit/`: a copy of the kit, from which hooks, gate and phases run (`node .aidlc/kit/tools/aidlc-gate`), with nothing to install. Commit it; it is not edited by hand

3. In VS Code, open the project with Copilot Chat in **Agent** mode. In the Copilot CLI, run `copilot` in the project.
4. Check that the rules arrive (canary test): add the line `Canary: this project's control word is "marmelada-42".` to `AGENTS.md` outside the kit block, open a **new** session and ask for the control word. If it answers `marmelada-42`, the rules arrive. Remove the line.
5. Run the Inception: put whatever already exists about the request in `aidlc/inception/insumos/` and type `/aidlc-inception` with one sentence about what you want. (in VS Code; in the Copilot CLI, ask for the aidlc-inception skill)
6. What you should see: a complete draft in `aidlc/inception/` first, then at most five questions in the `askQuestions` window, the recommended option first. Accepting all recommendations is a valid answer.
7. Close the phase: a person reviews and signs `Aprovado por:`, `Data:` and, when there are assumptions, `Premissas revisadas por:`. Then `aidlc-phase check inception` must exit 0. Construction comes next with the Construction command.

## Limits

- Prompt files (`/aidlc-inception`) are a VS Code feature; in the CLI ask for the `aidlc-inception` skill.
- The hooks run the kit copy in `.aidlc/kit/` from the repository root (`cwd: "."`): nothing to install. A `preToolUse` hook that errors denies the tool, so `aidlc-init --check` fails when the copy is missing.
- The cloud coding agent has no question window: it asks in the pull request.

## Source

What this page says about the tool was checked against its official documentation on 2026-11-06: <https://code.visualstudio.com/docs/agent-customization/prompt-files>. Tools change fast; if something differs in your version, open an issue.
