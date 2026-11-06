# Adapters: what each AI tool gets

*Also available in [Brazilian Portuguese](pt-BR/ADAPTADORES.md).*

The kit runs in 15 AI tools, and **not all of them in the same way**. This document says what is common to all of them, what each one receives, what is guaranteed by a mechanism and what is only instruction, and how to check it in your version. The step by step of each tool is in [TOOLS.md](TOOLS.md).

## The idea

One method, one set of rules, one thin layer per tool:

```
AGENTS.md (the rules, with the kit block)        read by every tool
.agents/skills/aidlc-inception/SKILL.md          the method of each phase, read by most tools
.agents/skills/aidlc-construction/SKILL.md
        │
        └── per tool: the phase command in its own folder and format,
            naming its question window, plus hooks where the tool allows
```

`aidlc-init --tools <list>` (or the picker it shows in a terminal) generates the layer of each chosen tool from the adapters in `plugins/aidlc-harness/lib/adaptadores.mjs`. The generated files say they must not be edited: `aidlc-init --check` fails when one of them diverges from what the kit generates, and `aidlc-init --sync` rewrites them. The hook files that the team may already have (`.cursor/hooks.json`, `.codex/hooks.json`) are not replaced: the kit entries are merged next to the team's.

## Instruction versus mechanism

| Guarantee | Claude Code | Copilot, Cursor, Codex | The other 11 tools |
| --- | --- | --- | --- |
| The agent **reads** the project rules | yes | yes | yes |
| The Inception asks in the tool's **question window** | yes (`AskUserQuestion`) | yes | where the tool has one (see [TOOLS.md](TOOLS.md)) |
| "Done" without a green gate is **sent back** to the agent | yes, Stop hook reads the evidence in the chat | yes, `aidlc-hook parada` checks the gate on the current tree | no |
| A command with a secret or the wrong package manager is **blocked** | yes | yes, `aidlc-hook shell` | no |
| The `aidlc-*` executables work | yes | yes | yes |
| CI fails on leaked identity, an incomplete phase and a red gate | yes | yes | yes |

Read the table honestly: in Claude Code, Copilot, Cursor and Codex the kit blocks; in the others it instructs, and what stops things is CI and people. CI really fails, but it is not the same as a hook that sends the agent back before the end of the turn.

## The question window

The reason this layer exists. Without it, each tool improvises the Inception from `AGENTS.md`, and in some of them that becomes a numbered list that the person answers by typing. Each generated command names the question tool of its tool and forbids the numbered list:

| Tool | Question tool | Note |
| --- | --- | --- |
| Claude Code | `AskUserQuestion` | up to 4 questions per call |
| OpenCode, Kilo Code | `question` | main agent only; denied in subagents |
| GitHub Copilot | `askQuestions` (VS Code), `ask_user` (CLI) | none in the cloud agent |
| Cursor | Ask questions | cannot be declared, the command asks for it in words |
| Gemini CLI | `ask_user` | |
| Codex | `request_user_input` | Plan mode only |
| Devin Desktop | `ask_user_question` | |
| Cline | `ask_question` | one question per call, single choice |
| JetBrains Junie | `AskUserQuestion` | |
| Continue | `AskQuestion` | `cn` CLI only |
| Antigravity | answer picker | the tool name is not in the public documentation |
| Kiro, Augment, Zed | none | short text, lettered options, "ok" accepts all |

## The hooks outside Claude Code

GitHub Copilot, Cursor and Codex document hooks that can block a command and send the agent back at the end of a turn. `aidlc-init` writes `.github/hooks/aidlc.json`, `.cursor/hooks.json` and `.codex/hooks.json` calling `aidlc-hook`, which translates each tool's JSON and applies the plugin rules ([REFERENCE.md](REFERENCE.md#aidlc-hook)). Two things to know:

- **`aidlc-hook` must be on the `PATH`**: install the kit with `npm install -g github:roqueribeiro/aidlc-harness`.
- **Codex only runs project hooks after you trust them**: run `/hooks` once in the project.

The end-of-turn check does not read the transcript, whose format differs per tool. It checks what holds in all of them: if the working tree changed, the last `aidlc-gate` on that exact tree must have been green.

## The canary test

Do not trust anyone's table, including this one. Check in your version, on the surface you use:

1. Add a single line to `AGENTS.md`, outside the kit block: `Canary: this project's control word is "marmelada-42".` Then run `aidlc-init --sync`.
2. In a **new** session of the tool, ask: "What is this project's control word?"
3. If it answers `marmelada-42`, the tool is reading the instructions. If not, nothing `AGENTS.md` says is reaching the agent.
4. For duplication: if the tool reads `AGENTS.md` **and** a generated copy (Kiro reads both `AGENTS.md` and `.kiro/steering/aidlc.md`), turn off one of the two.
5. Remove the canary.

Do this once per tool and per major version. Ten minutes that save weeks of a rule nobody was receiving.

## Windows

CI runs the clean-machine test and the installed package on Windows: `npx`, `npm install -g`, `aidlc-init`, `aidlc-init --check`, `aidlc-gate` and `aidlc-doctor` work there. The manifest gates run the stack's shell commands (`yarn test`, `mvn verify`), which depend on the tools installed on the machine.

## Adding a tool

1. Add the adapter to `plugins/aidlc-harness/lib/adaptadores.mjs`: name, question tool, where the command goes and its format, how the request arrives, and the hooks if the tool has them.
2. Add the tool's notes (official source, how to open it, limits, in both languages) to `NOTAS` in `scripts/gerar-ferramentas.mjs`, and run it.
3. `lib/adaptadores.test.mjs` fails if the tool has a question window and its command does not name it, and `scripts/gerar-ferramentas.test.mjs` fails if it has no notes. Add a mutant for anything new.
