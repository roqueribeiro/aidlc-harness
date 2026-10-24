# aidlc-harness

The quality kit for software development with AI agents in the AI-DLC cycle. This repository governs itself with its own kit (manifest `harness-self`).

## Non-negotiable rules

- **A rule without a mechanism is decoration.** Before proposing a norm, say which hook, gate or manifest will enforce it.
- **Every new check is born with a mutant.** Break the code on purpose and confirm the test fails. A check that never failed is not a check.
- **Done requires evidence.** Run `node --test` and paste the raw output. A summary does not count.
- **Never weaken a test to make the gate pass.**
- **Nothing that identifies a person, company or infrastructure.** `aidlc-identity` must pass. Examples use fictional names (`app-exemplo`, `fulano`).
- **Do not claim what you did not verify.** If it was only tested on Linux, the text says so.
- **Before deleting, overwriting or moving, list and show.**
- **Documentation in English first, with a Brazilian Portuguese pair** under `docs/pt-BR/` (and `README.pt-BR.md`), updated in the same change (`check-i18n` fails otherwise). The kit's own prose (prompts, executable messages, commands) is still Brazilian Portuguese. No em dash as a style device (`check-plugin` fails on it in the kit's prose).

## Where things live

- `plugins/aidlc-harness/`: the plugin (hooks, agents, skills, commands, `tools/`, `lib/`, `quality/`, `templates/`).
- `scripts/`: the repository's own checks and utilities (`setup`, `install-git-hooks`, `definir-dono`, `gerar-prompts`).
- `docs/`: documentation in English; `docs/pt-BR/`: the Brazilian Portuguese pair. `docs/pt-BR/PROMPTS.md` is **generated** from `commands/` and `docs/assets/diagramas/*.svg` is **generated** by `scripts/gerar-diagramas.mjs`: do not edit them by hand.
- `OPERATING-MODEL.md`: the operating model, with the mechanism behind each rule.

## Commands

- Tests: `node --test`
- Plugin integrity: `node scripts/check-plugin.mjs`
- Manifests: `node scripts/check-quality-manifests.mjs`
- Documentation: `node scripts/check-docs-consistency.mjs` and `node scripts/gerar-prompts.mjs --check`
- Diagrams, reference and links: `node scripts/gerar-diagramas.mjs --check`, `node scripts/check-reference.mjs` and `node scripts/check-links.mjs`
- Both languages in step: `node scripts/check-i18n.mjs`. Changed a document, update its pair and run `--update` after reviewing both
- Identity: `node plugins/aidlc-harness/tools/aidlc-identity`
- Official plugin validation: `claude plugin validate ./plugins/aidlc-harness --strict`

See `CONTRIBUTING.md` for the full flow.
