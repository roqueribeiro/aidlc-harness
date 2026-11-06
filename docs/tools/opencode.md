# OpenCode with aidlc-harness

*Also available in [Brazilian Portuguese](../pt-BR/ferramentas/opencode.md).*

> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.

## At a glance

| | |
| --- | --- |
| Command | `/aidlc-inception` |
| Question window | `question` |
| Kit hooks | no, CI enforces the evidence |
| Verified on a real machine | not yet (documentation checked on 2026-11-06) |

## Step by step

1. Prepare the project (in its folder, with Node 20.19 or newer):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools opencode
    ```

2. What the tool receives:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.opencode/commands/aidlc-inception.md`
    - `.opencode/commands/aidlc-construction.md`
    - `.aidlc/COMANDOS.md`

3. Open `opencode` in the project. It reads `AGENTS.md` by itself.
4. Check that the rules arrive (canary test): add the line `Canary: this project's control word is "marmelada-42".` to `AGENTS.md` outside the kit block, open a **new** session and ask for the control word. If it answers `marmelada-42`, the rules arrive. Remove the line.
5. Run the Inception: put whatever already exists about the request in `aidlc/inception/insumos/` and type `/aidlc-inception` with one sentence about what you want.
6. What you should see: a complete draft in `aidlc/inception/` first, then at most five questions in the `question` window, the recommended option first. Accepting all recommendations is a valid answer.
7. Close the phase: a person reviews and signs `Aprovado por:`, `Data:` and, when there are assumptions, `Premissas revisadas por:`. Then `aidlc-phase check inception` must exit 0. Construction comes next with the Construction command.

## Limits

- The command runs in the main `build` agent: in a subagent the `question` tool is denied.
- No hook can hold the end of a turn in OpenCode: evidence is enforced by CI.

## Source

What this page says about the tool was checked against its official documentation on 2026-11-06: <https://opencode.ai/docs/commands/>. Tools change fast; if something differs in your version, open an issue.
