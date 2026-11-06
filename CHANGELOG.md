# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning from 1.0 on; in the 0.x series, any version may change behavior.

## [Unreleased]

### Fixed

- `aidlc-init` in a repository that already has an `AGENTS.md`: the kit rules now go into a managed block (`<!-- aidlc:inicio -->` to `<!-- aidlc:fim -->`) appended to the team's file, and the Copilot and Kiro copies derive from the final file. Before, `aidlc-init --check` failed right after `aidlc-init` and the AI-DLC rules never reached the project. `--check` now fails when the block is missing; `--sync` refreshes only the inside of the block.
- The Node manifests rejected every green `node --test` run: the `reject` pattern is evaluated case-insensitively and `FAIL ` matched the `# fail 0` summary line. Present since 0.1.0. A new test runs each manifest's pattern against real green and red runner output.
- `aidlc-doctor` no longer charges a Kiro- or Copilot-only project for Claude Code files, no longer points at the kit's internal folder or quotes another product's version, and checks that `AGENTS.md` has the kit block and is in sync.
- The evidence gate log moved from `.claude/audit/` to `aidlc/audit/` (the folder `aidlc-init` creates for every tool); `aidlc-doctor` and `aidlc-cycle` read both.
- `pkg-manager` now sees `pnpm`, `bun` and `bunx` invocations.

### Added

- Manifests for `node-pnpm`, `node-bun`, `java-maven`, `java-gradle`, `dotnet` and `go`. Detection accepts root-level patterns such as `*.csproj`.
- The generated CI workflow installs `trivy` (pinned by commit) and the dependencies of the detected technology, from the new `ci.setup` manifest field. Before, a clean runner failed `aidlc-secscan` and the tests for reasons that were not the project's.
- `scripts/e2e-maquina-limpa.test.mjs`: setup, init, check, gate and doctor through the `PATH`, with an empty `HOME`, for seven technologies; CI runs it on Linux, macOS and Windows.

## [0.1.0] - 2026-10-23

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
