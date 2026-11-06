# Ferramentas de IA

*Também em [inglês](../TOOLS.md).*

> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.

O kit roda em 15 ferramentas de IA. Cada uma recebe os comandos de Inception e Construction no formato dela, nomeando a própria janela de perguntas; onde a ferramenta deixa, os hooks do kit também seguram um "pronto" sem prova. Escolha a sua:

| Ferramenta | Comando | Janela de perguntas | Hooks do kit | Página |
| --- | --- | --- | --- | --- |
| Claude Code | `/inception` | `AskUserQuestion` | sim | [passo a passo](ferramentas/claude.md) |
| OpenCode | `/aidlc-inception` | `question` | não | [passo a passo](ferramentas/opencode.md) |
| Kilo Code | `/aidlc-inception` | `question` | não | [passo a passo](ferramentas/kilo.md) |
| GitHub Copilot | `/aidlc-inception` (no VS Code; no Copilot CLI, peça a skill aidlc-inception) | `askQuestions` | sim | [passo a passo](ferramentas/copilot.md) |
| Cursor | `/aidlc-inception` | `Ask questions` | sim | [passo a passo](ferramentas/cursor.md) |
| Gemini CLI | `/aidlc:inception` | `ask_user` | não | [passo a passo](ferramentas/gemini.md) |
| Google Antigravity | `/aidlc-inception` (a skill vira comando) | seletor de respostas | não | [passo a passo](ferramentas/antigravity.md) |
| Kiro | `/aidlc-inception` (ou #aidlc-inception no chat) | não tem: texto com opções em letras | não | [passo a passo](ferramentas/kiro.md) |
| OpenAI Codex | `$aidlc-inception` (depois de entrar no modo Plan com /plan) | `request_user_input` | sim | [passo a passo](ferramentas/codex.md) |
| Devin Desktop (ex-Windsurf) | `/aidlc-inception` (a skill vira comando) | `ask_user_question` | não | [passo a passo](ferramentas/devin.md) |
| Cline | `/aidlc-inception.md` | `ask_question` | não | [passo a passo](ferramentas/cline.md) |
| JetBrains Junie | `/aidlc-inception` | `AskUserQuestion` | não | [passo a passo](ferramentas/junie.md) |
| Continue | `/aidlc-inception` | `AskQuestion` | não | [passo a passo](ferramentas/continue.md) |
| Augment (Auggie) | `/aidlc-inception` | não tem: texto com opções em letras | não | [passo a passo](ferramentas/augment.md) |
| Zed | `/aidlc-inception` (a skill vira comando) | não tem: texto com opções em letras | não | [passo a passo](ferramentas/zed.md) |
