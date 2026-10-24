# Adapters: Claude Code, Kiro and GitHub Copilot

*Also available in [Brazilian Portuguese](pt-BR/ADAPTADORES.md).*

The kit works with the three tools, but **not in the same way**. This document says what each one receives, what is guaranteed by a mechanism and what is only instruction, and how you check that in your version.

## The idea

One source, three copies:

```
AGENTS.md  ──▶  CLAUDE.md                          (imports AGENTS.md)
           ──▶  .github/copilot-instructions.md    (generated copy)
           ──▶  .kiro/steering/aidlc.md            (generated copy, inclusion: always)
```

You edit only `AGENTS.md`. `aidlc-init --check` fails if a copy diverges (and CI runs that `--check`), and `aidlc-init --sync` rewrites them. Instructions copied by hand diverge silently, and divergence is the worst defect of this design, because each tool starts obeying a different rule without anyone noticing.

## Instruction versus mechanism

| Guarantee | Claude Code | Kiro | GitHub Copilot |
| --- | --- | --- | --- |
| The agent **reads** the project rules | yes | yes | yes |
| "Done" without the gate output is **refused** (Stop hook) | **yes**, via the plugin | no | no |
| A command with a secret or the wrong package manager is **blocked** (PreToolUse hooks) | **yes**, via the plugin | no | no |
| Relevant context is **delivered** when editing a file (`path-strategy`) | **yes**, via the plugin | no | no |
| The `aidlc-*` executables work | yes | yes | yes |
| CI fails on leaked identity, an incomplete phase and a red gate | yes | yes | yes |
| Human review of the pull request | yes | yes | yes |

Read the table honestly: **outside Claude Code, the kit instructs, and what stops things is CI and people.** That is a lot (CI really fails), but it is not the same as a hook that cuts the agent's turn in the middle. If your organization requires blocking at the moment of the action in all three tools, the kit does not deliver that today for Kiro and Copilot.

## Claude Code

- Instructions: `CLAUDE.md` with `@AGENTS.md`, which imports the whole file.
- Plugin: `claude plugin marketplace add roqueribeiro/aidlc-harness` and `claude plugin install aidlc-harness@aidlc`. Hooks, agents, skills and commands come together.
- Executables: `node scripts/setup.mjs` (the plugin does not put `aidlc-*` on the PATH by itself).
- Commands: `/aidlc-harness:inception`, `/aidlc-harness:construction`, `/aidlc-harness:gate`, `/aidlc-harness:status`.
- Check: `claude plugin validate <plugin folder> --strict` and, inside the session, `/reload-plugins` followed by `/context`.
- Configuration: the plugin's `gate_mode` (`block`, `warn` or `off`) controls the Stop hooks. Start with `warn` if the team is still getting used to it, and move to `block` when the gate is stable.

## Kiro

- Instructions: [Kiro reads steering from `.kiro/steering/`](https://kiro.dev/docs/steering/) and, according to the public documentation, also reads `AGENTS.md` at the workspace root (always included, with no inclusion modes). `aidlc-init` generates `.kiro/steering/aidlc.md` with `inclusion: always`.
- **Probable duplication:** if your version of Kiro reads `AGENTS.md`, the copy in `.kiro/steering/aidlc.md` is redundant and the rules enter the context twice. In that case run `aidlc-init --tools claude,copilot` and delete the copy. The copy exists for versions that do not yet read `AGENTS.md`.
- No plugin: the `/inception` and `/construction` commands do not exist. Use the texts in [pt-BR/PROMPTS.md](pt-BR/PROMPTS.md) (Portuguese), pasted into the chat.
- No kit hooks: Kiro has its own hook mechanism, which the kit does **not** use. CI is what enforces the evidence.

## GitHub Copilot

- Instructions: the [GitHub documentation](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions) mentions `.github/copilot-instructions.md` (whole repository), `.github/instructions/*.instructions.md` (per path) and `AGENTS.md`, `CLAUDE.md` or `GEMINI.md` as agent instructions. `aidlc-init` generates `.github/copilot-instructions.md`.
- **Which surface reads which file varies** (chat on GitHub, coding agent, code review, CLI, IDEs) and the page we consulted points to a separate matrix. Before relying on it, run the canary test below on the surface your team uses.
- No plugin and no kit hooks, as with Kiro. Use [pt-BR/PROMPTS.md](pt-BR/PROMPTS.md) (Portuguese).

## The canary test

Do not trust anyone's table, including this one. Check in your version, on the surface you use:

1. Add a single line to `AGENTS.md`: `Canary: this project's control word is "marmelada-42".` (and run `aidlc-init --sync`).
2. In a **new** session of the tool, ask: "What is this project's control word?"
3. If it answers `marmelada-42`, the tool is reading the instructions. If not, it is not, and nothing `AGENTS.md` says is reaching the agent.
4. For duplication: if the tool reads `AGENTS.md` **and** the generated copy, turn off one of the two.
5. Remove the canary.

Do this once per tool and per major version. It is ten minutes that save weeks of a rule nobody was receiving.

## Windows

The plugin's hooks are Node scripts (`node "${CLAUDE_PLUGIN_ROOT}/hooks/…"`) and in theory run on Windows. The manifest gates run shell commands (`yarn test`, `uv run pytest`), which depend on the shell you use. **None of this was tested on Windows by whoever wrote the kit.** If you test it, record the result in an issue: it is a valuable contribution.

## When adding a fourth tool

Generate the copy from `AGENTS.md` in `lib/init.mjs` (see how `copilot` and `kiro` are wired there), add the divergence check to `--check`, and write at least one test that fails when the copy diverges. A rule without that test becomes the decoration this kit exists to avoid.
