# AI tools

*Also available in [Brazilian Portuguese](pt-BR/FERRAMENTAS.md).*

> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.

The kit runs in 15 AI tools. Each one receives the Inception and Construction commands in its own format, naming its own question window; where the tool allows, the kit hooks also hold an unproven "done". Pick yours:

| Tool | Command | Question window | Kit hooks | Page |
| --- | --- | --- | --- | --- |
| Claude Code | `/inception` | `AskUserQuestion` | yes | [step by step](tools/claude.md) |
| OpenCode | `/aidlc-inception` | `question` | no | [step by step](tools/opencode.md) |
| Kilo Code | `/aidlc-inception` | `question` | no | [step by step](tools/kilo.md) |
| GitHub Copilot | `/aidlc-inception` (in VS Code; in the Copilot CLI, ask for the aidlc-inception skill) | `askQuestions` | yes | [step by step](tools/copilot.md) |
| Cursor | `/aidlc-inception` | `Ask questions` | yes | [step by step](tools/cursor.md) |
| Gemini CLI | `/aidlc:inception` | `ask_user` | no | [step by step](tools/gemini.md) |
| Google Antigravity | `/aidlc-inception` (the skill becomes a command) | answer picker | no | [step by step](tools/antigravity.md) |
| Kiro | `/aidlc-inception` (or #aidlc-inception in the chat) | none: text with lettered options | no | [step by step](tools/kiro.md) |
| OpenAI Codex | `$aidlc-inception` (after entering Plan mode with /plan) | `request_user_input` | yes | [step by step](tools/codex.md) |
| Devin Desktop (ex-Windsurf) | `/aidlc-inception` (the skill becomes a command) | `ask_user_question` | no | [step by step](tools/devin.md) |
| Cline | `/aidlc-inception.md` | `ask_question` | no | [step by step](tools/cline.md) |
| JetBrains Junie | `/aidlc-inception` | `AskUserQuestion` | no | [step by step](tools/junie.md) |
| Continue | `/aidlc-inception` | `AskQuestion` | no | [step by step](tools/continue.md) |
| Augment (Auggie) | `/aidlc-inception` | none: text with lettered options | no | [step by step](tools/augment.md) |
| Zed | `/aidlc-inception` (the skill becomes a command) | none: text with lettered options | no | [step by step](tools/zed.md) |
