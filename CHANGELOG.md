# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning from 1.0 on; in the 0.x series, any version may change behavior.

## [0.1.0] - unreleased

First public version of the kit.

### Added

- `aidlc-harness` plugin for Claude Code: 8 hooks, 3 agents, 4 skills, 4 commands (`/inception`, `/construction`, `/gate`, `/status`) and 14 `aidlc-*` executables.
- AI-DLC phases as checked artifacts: `aidlc-init` (skeleton and instructions for Claude Code, Kiro and Copilot from one `AGENTS.md`) and `aidlc-phase` (Inception and Construction, human approval required).
- Acceptance criteria as data: `node-yarn`, `node-npm`, `python-uv` and `harness-self` manifests, plus project manifests in `.aidlc/quality/`.
- `aidlc-identity`: scanner for IP, MAC, email, home path, internal hostname, secret and forbidden terms kept outside the repository.
- `scripts/setup.mjs` (executables on the PATH, macOS, Linux and Windows), `scripts/install-git-hooks.mjs`, `scripts/definir-dono.mjs`, `scripts/gerar-prompts.mjs`.
- `aidlc-scan`: reads the report of any security platform (SARIF 2.1.0, neutral format, RoqueShield AI Fix Bundle) and separates clean (0), failed (1) and did not run (2). Gate template in `templates/security/`.
- `aidlc-gate` puts the kit's executables folder at the front of the gates' `PATH`: without it, an `aidlc-scan` or `aidlc-lockcheck` gate gave `command not found` on a clean CI runner.
- `aidlc-identity`: the allowlist accepts `valor`, to allow a single term instead of the whole category in a file.
- Documentation in English (primary) and Brazilian Portuguese (`docs/pt-BR/`, `README.pt-BR.md`): guided path, AI-DLC interpretation, adapters, regulated-organization profile, and reference documentation (architecture, reference, integrations, RoqueShield, glossary) with diagrams and the brand mark in both languages, generated from code (light and dark), checked in CI, plus example reports executed by the tests.
- New checks, each with mutants: `gerar-diagramas --check` (SVG follows the code, and every diagram string has an English translation), `check-reference` (the reference covers what exists and the prose cites no phantom command), `check-links` (every relative link resolves, anchors included) and `check-i18n` (every document has its pair in the other language, with the same structure, and the pair is reviewed when the primary changes).

### Limits

Tested on Linux with Node 22, and on macOS arm64 (an earlier revision). Windows, Kiro and GitHub Copilot were not tested on a real machine. The kit's own messages and prompts are in Brazilian Portuguese.
