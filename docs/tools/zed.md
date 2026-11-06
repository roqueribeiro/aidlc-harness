# Zed with aidlc-harness

*Also available in [Brazilian Portuguese](../pt-BR/ferramentas/zed.md).*

> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.

## At a glance

| | |
| --- | --- |
| Command | `/aidlc-inception` (the skill becomes a command) |
| Question window | none: text with lettered options |
| Kit hooks | no, CI enforces the evidence |
| Verified on a real machine | not yet (documentation checked on 2026-11-06) |

## Step by step

1. Prepare the project (in its folder, with Node 20.19 or newer):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools zed
    ```

2. What the tool receives:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.aidlc/COMANDOS.md`

3. Open the project in Zed. It reads `AGENTS.md` and the skills in `.agents/skills/`.
4. Check that the rules arrive (canary test): add the line `Canary: this project's control word is "marmelada-42".` to `AGENTS.md` outside the kit block, open a **new** session and ask for the control word. If it answers `marmelada-42`, the rules arrive. Remove the line.
5. Run the Inception: put whatever already exists about the request in `aidlc/inception/insumos/` and type `/aidlc-inception` with one sentence about what you want. (the skill becomes a command)
6. What you should see: a complete draft in `aidlc/inception/` first, then one short message with at most five questions, lettered options and the recommended one marked; "ok" accepts them all.
7. Close the phase: a person reviews and signs `Aprovado por:`, `Data:` and, when there are assumptions, `Premissas revisadas por:`. Then `aidlc-phase check inception` must exit 0. Construction comes next with the Construction command.

## Limits

- Zed has no question window and no hooks: the Inception asks in text and CI enforces the evidence.

## Source

What this page says about the tool was checked against its official documentation on 2026-11-06: <https://zed.dev/docs/ai/skills>. Tools change fast; if something differs in your version, open an issue.
