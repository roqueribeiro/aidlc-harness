# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning from 1.0 on; in the 0.x series, any version may change behavior.

## [Unreleased]

## [0.2.0] - 2026-11-06

### Fixed

- `aidlc-init` in a repository that already has an `AGENTS.md`: the kit rules now go into a managed block (`<!-- aidlc:inicio -->` to `<!-- aidlc:fim -->`) appended to the team's file, and the Copilot and Kiro copies derive from the final file. Before, `aidlc-init --check` failed right after `aidlc-init` and the AI-DLC rules never reached the project. `--check` now fails when the block is missing; `--sync` refreshes only the inside of the block.
- The Node manifests rejected every green `node --test` run: the `reject` pattern is evaluated case-insensitively and `FAIL ` matched the `# fail 0` summary line. Present since 0.1.0. A new test runs each manifest's pattern against real green and red runner output.
- `aidlc-doctor` no longer charges a Kiro- or Copilot-only project for Claude Code files, no longer points at the kit's internal folder or quotes another product's version, and checks that `AGENTS.md` has the kit block and is in sync.
- The evidence gate log moved from `.claude/audit/` to `aidlc/audit/` (the folder `aidlc-init` creates for every tool); `aidlc-doctor` and `aidlc-cycle` read both.
- `pkg-manager` now sees `pnpm`, `bun` and `bunx` invocations.
- `scripts/setup.mjs` did nothing on Windows and exited 0: the "am I the main module" test compared a `file://` URL with a Windows path and never matched. The same defect was in `gerar-prompts`, `definir-dono` and `install-git-hooks`; all four now use `ehPrincipal`. Paths are built for the target platform, `Path` is found on Windows, and the setup prints the exact line to add it to the `PATH`.

### Changed

- **The Inception recommends first.** New `aidlc-inception` and `aidlc-construction` skills hold the method: the AI reads everything (including `aidlc/inception/insumos/`), writes a complete draft with its recommendations, records what it decided alone under `## Premissas`, and asks at most 5 questions, only what the team must decide, in the tool's native question window, with "accept all recommendations" always available. `/inception` and `/construction` now load the skill and require `AskUserQuestion`; the v0.1 text asked for numbered options in up to four rounds of five.
- `aidlc-phase check inception` fails with more than 5 open questions, without a `## Premissas` section, or with assumptions listed and `Premissas revisadas por:` blank or signed by an AI.

### Added

- **Adapters for 15 tools.** `aidlc-init --tools` (or an interactive picker in a terminal, with the tools found on disk already checked) generates each tool's command in its own format and folder, naming its question tool: Claude Code, OpenCode, Kilo Code, GitHub Copilot (VS Code prompt files, CLI through skills), Cursor, Gemini CLI, Google Antigravity, Kiro, OpenAI Codex, Devin Desktop (ex-Windsurf), Cline, JetBrains Junie, Continue, Augment and Zed. The skills are copied to `.agents/skills/`; `.aidlc/COMANDOS.md` lists what to type in each tool. `--check` fails when a generated file diverges and `--sync` refreshes them.
- **Hooks outside Claude Code.** New `aidlc-hook` executable, wired by `aidlc-init` into `.github/hooks/aidlc.json` (GitHub Copilot), `.cursor/hooks.json` (Cursor) and `.codex/hooks.json` (Codex), merged next to the team's own hooks. Before a shell command it applies `secret-guard` and `pkg-manager`; at the end of a turn it sends the agent back when the working tree changed and the last `aidlc-gate` on that exact tree was not green. `aidlc-gate` now records a tree fingerprint on every full run (`aidlc/audit/gate-<day>.jsonl`).
- **One-command install.** `npx github:roqueribeiro/aidlc-harness init` prepares a project with no clone and no setup; `npm install -g github:roqueribeiro/aidlc-harness` puts every `aidlc-*` on the `PATH` on Linux, macOS and Windows. `aidlc-harness <command>` dispatches to `aidlc-<command>`; with no command it is still the context-cost meter. `scripts/pacote.test.mjs` packs the tree, installs the tarball and runs the installed executables, in CI on the three systems.
- **Documentation for every tool.** `scripts/gerar-ferramentas.mjs` generates one step-by-step page per AI tool in English (`docs/tools/`, `docs/TOOLS.md`) and Brazilian Portuguese (`docs/pt-BR/ferramentas/`, `docs/pt-BR/FERRAMENTAS.md`) and the tools table of both READMEs, from the same adapters `aidlc-init` applies; CI runs it with `--check`. README, getting started, adapters, architecture and the multi-tool and installation diagrams rewritten for 15 tools and the one-command install.
- **Documentation site** in `site/` (Astro Starlight, English and Brazilian Portuguese, search, light and dark), generated from `docs/` and the READMEs by `site/scripts/sync-docs.mjs` with no hand-written copy; `--check` fails on a link with no destination or two pages on the same route. The `site.yml` workflow builds it on every push and publishes it to GitHub Pages from `main` once Pages is turned on.
- `.gitattributes` keeps the kit's files LF; `aidlc-init` also tolerates CRLF files (a Windows clone with `autocrlf` made `--check` fail on the project `init` had just created).
- Manifests for `node-pnpm`, `node-bun`, `java-maven`, `java-gradle`, `dotnet` and `go`. Detection accepts root-level patterns such as `*.csproj`.
- The generated CI workflow installs `trivy` (pinned by commit) and the dependencies of the detected technology, from the new `ci.setup` manifest field. Before, a clean runner failed `aidlc-secscan` and the tests for reasons that were not the project's.
- **Verification records.** A tool page says "Verified on a real machine: yes" only when `docs/compatibilidade/<tool>.json` lists the version, system, date and screenshots that exist in `docs/assets/compatibilidade/<tool>/`; a broken record fails the generator. No tool has a record yet: every page says "not yet".
- **Releases from the version.** The `release` workflow creates the `vX.Y.Z` tag and the GitHub release when a new version reaches `main`, with the CHANGELOG section as notes; `scripts/notas-da-versao.mjs --check` fails when `package.json`, `plugin.json`, the generated workflow's `AIDLC_REF` and the CHANGELOG disagree.
- `scripts/e2e-maquina-limpa.test.mjs`: setup, init, check, gate and doctor through the `PATH`, with an empty `HOME`, for seven technologies; CI runs it on Linux, macOS and Windows.

### Limits

CI runs the clean-machine and installed-package tests on Linux, macOS and Windows with Node 20, 22 and 24. The real gates of Go, bun, Maven, pnpm and yarn were run green and red; Gradle and .NET were not. The question-window behavior of each tool comes from its official documentation: no tool session was recorded yet (see "Contributing a verification" in `docs/ADAPTERS.md`).

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
