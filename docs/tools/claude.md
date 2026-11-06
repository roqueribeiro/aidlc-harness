# Claude Code with aidlc-harness

*Also available in [Brazilian Portuguese](../pt-BR/ferramentas/claude.md).*

> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.

## At a glance

| | |
| --- | --- |
| Command | `/inception` |
| Question window | `AskUserQuestion` |
| Kit hooks | yes |
| Verified on a real machine | not yet (documentation checked on 2026-11-06) |

## Step by step

1. Prepare the project (in its folder, with Node 20.19 or newer):

    ```bash
    npx github:roqueribeiro/aidlc-harness init --tools claude
    ```

2. What the tool receives:

    - `AGENTS.md`
    - `CLAUDE.md`
    - `.claude/settings.json`
    - `.aidlc/COMANDOS.md`
    - `.aidlc/kit/`: a copy of the kit, from which hooks, gate and phases run (`node .aidlc/kit/tools/aidlc-gate`), with nothing to install. Commit it; it is not edited by hand

3. Open Claude Code in the project and accept the workspace trust dialog. `.claude/settings.json`, written by `aidlc-init`, registers the kit marketplace pinned to this version and enables the plugin, which then loads by itself; in a folder you have not trusted, Claude Code ignores project settings.
4. Check that the rules arrive (canary test): add the line `Canary: this project's control word is "marmelada-42".` to `AGENTS.md` outside the kit block, open a **new** session and ask for the control word. If it answers `marmelada-42`, the rules arrive. Remove the line.
5. Run the Inception: put whatever already exists about the request in `aidlc/inception/insumos/` and type `/inception` with one sentence about what you want.
6. What you should see: a complete draft in `aidlc/inception/` first, then at most five questions in the `AskUserQuestion` window, the recommended option first. Accepting all recommendations is a valid answer.
7. Close the phase: a person reviews and signs `Aprovado por:`, `Data:` and, when there are assumptions, `Premissas revisadas por:`. Then `aidlc-phase check inception` must exit 0. Construction comes next with the Construction command.

## Limits

- The full kit: blocking hooks (evidence at Stop, secret, package manager), agents, skills and commands.
- `AskUserQuestion` takes up to 4 questions per call; with 5 the agent makes two calls.

## Source

What this page says about the tool was checked against its official documentation on 2026-11-06: <https://code.claude.com/docs/en/plugins>. Tools change fast; if something differs in your version, open an issue.
