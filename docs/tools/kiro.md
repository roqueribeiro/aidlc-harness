# Kiro with aidlc-harness

*Also available in [Brazilian Portuguese](../pt-BR/ferramentas/kiro.md).*

> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.

## At a glance

| | |
| --- | --- |
| Command | `/aidlc-inception` (or #aidlc-inception in the chat) |
| Question window | none: text with lettered options |
| Kit hooks | no, CI enforces the evidence |
| Verified on a real machine | not yet (documentation checked on 2026-11-06) |

## Step by step

1. Prepare the project (in its folder, with Node 20.19 or newer):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools kiro
    ```

2. What the tool receives:

    - `AGENTS.md`
    - `.agents/skills/aidlc-inception/SKILL.md`
    - `.agents/skills/aidlc-construction/SKILL.md`
    - `.kiro/skills/aidlc-inception/SKILL.md`
    - `.kiro/skills/aidlc-construction/SKILL.md`
    - `.kiro/steering/aidlc-inception.md`
    - `.kiro/steering/aidlc-construction.md`
    - `.aidlc/COMANDOS.md`

3. Open the project in Kiro (IDE or CLI).
4. Check that the rules arrive (canary test): add the line `Canary: this project's control word is "marmelada-42".` to `AGENTS.md` outside the kit block, open a **new** session and ask for the control word. If it answers `marmelada-42`, the rules arrive. Remove the line.
5. Run the Inception: put whatever already exists about the request in `aidlc/inception/insumos/` and type `/aidlc-inception` with one sentence about what you want. (or #aidlc-inception in the chat)
6. What you should see: a complete draft in `aidlc/inception/` first, then one short message with at most five questions, lettered options and the recommended one marked; "ok" accepts them all.
7. Close the phase: a person reviews and signs `Aprovado por:`, `Data:` and, when there are assumptions, `Premissas revisadas por:`. Then `aidlc-phase check inception` must exit 0. Construction comes next with the Construction command.

## Limits

- Kiro has no question window: the Inception asks in short text with lettered options, the recommended one marked, and "ok" accepts them all. This is the same format as Kiro's own Plan mode.
- Kiro also reads `AGENTS.md`, so the rules may enter twice with `.kiro/steering/aidlc.md`; run the canary test and keep one.
- The kit does not generate Kiro hooks yet: evidence is enforced by CI.

## Source

What this page says about the tool was checked against its official documentation on 2026-11-06: <https://kiro.dev/docs/steering/>. Tools change fast; if something differs in your version, open an issue.
