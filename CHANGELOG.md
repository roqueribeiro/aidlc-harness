# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning from 1.0 on; in the 0.x series, any version may change behavior.

## [Unreleased]

## [0.2.2] - 2026-11-06

### Added

- **Codex marketplace.** The repository is also a Codex plugin marketplace (`.agents/plugins/marketplace.json`), and the plugin carries a portable Agent Plugins manifest (`plugins/aidlc-harness/plugin.json`): `codex plugin marketplace add roqueribeiro/aidlc-harness` and `codex plugin add aidlc-harness@aidlc` install it, and its skills reach the model as `aidlc-harness:aidlc-inception` and the like (checked with Codex CLI 0.167.0, from a local copy of the repository). The manifest declares `hooks: []`, so Codex never reads the Claude Code `hooks/hooks.json`; in Codex the hooks come from the `.codex/hooks.json` that `aidlc-init` writes. `scripts/marketplaces.test.mjs` checks that both marketplaces point to the same plugin with the same name and version, with mutants; `notas-da-versao --check` now covers the Codex manifest version too.

### Changed

- The plugin and marketplace descriptions said the kit generated instructions for Kiro and Copilot only, a 0.1 text; they now describe the 15 tools.


## [0.2.1] - 2026-11-06

Works on the first run with nothing installed. In 0.2.0 the steps `aidlc-init` announced did not work on a new machine, and the tests passed because they ran with the kit on the `PATH`.

### Fixed

- **Hooks of GitHub Copilot, Cursor and Codex exited 127** without a global install: they called `aidlc-hook` from the `PATH`. In Copilot a `preToolUse` hook that errors denies the tool call, so every command of the agent was denied; in Cursor the hook failed open and protected nothing. They now call `node .aidlc/kit/tools/aidlc-hook`, and `aidlc-init --sync` replaces the old entries.
- **Claude Code had no `/inception` in a new session**: nothing in the project installed the plugin. `aidlc-init` now merges into `.claude/settings.json` the kit marketplace pinned to `v<version>`, the enabled plugin and the permission to run the kit copy; the plugin loads when the folder is trusted.
- **The first `aidlc-gate` was red on a new machine**: `aidlc-gate` and `aidlc-phase` were not on the `PATH`, and `aidlc-secscan` required Trivy installed. The gate also ran the kit's own executables by name, which fails without the executable bit and on Windows (`Permission denied`); it now runs them with Node.
- The banners of `aidlc-secscan`, `aidlc-lockcheck`, `aidlc-mutation` and `aidlc-limpeza` still printed an old internal name.

### Added

- **The kit inside the project.** `aidlc-init` writes `.aidlc/kit/`, a copy of the kit (about 100 files, no tests), committed with the project. Hooks, skills, the `AGENTS.md` block and the guide call `node .aidlc/kit/tools/<command>`. `--check` fails when a file of the copy differs, is missing or is extra; in CI it runs from the kit pinned in `AIDLC_REF`, so an agent cannot loosen the gate by editing the copy. `--sync` and `init` rewrite it and remove what an older version left behind.
- **Trivy on demand.** `aidlc-secscan` uses `AIDLC_TRIVY`, the `trivy` on the `PATH`, the kit cache or, otherwise, downloads Trivy 0.76.1 and checks its sha256, pinned in `lib/trivy.mjs` for Linux, macOS (x64 and ARM64) and Windows and checked against the downloaded files. `AIDLC_TRIVY_BASE` points to an internal mirror. The generated CI no longer installs Trivy through a third-party action; it caches the kit's.
- `scripts/primeira-execucao.test.mjs`: with no `aidlc` on the `PATH` and an empty home, `init`, `--check`, every generated hook command, `aidlc-phase`, a green gate with Trivy downloaded, a fresh clone, and a mutant (an edited kit copy fails `--check`). CI runs it on Linux, macOS and Windows, and downloads Trivy on Linux x64 and ARM64, macOS and Windows.

### Changed

- **Visual identity.** A new mark: three chevrons (the phases) rising through a ring that is open at the bottom (the gate), drawn as an exact vector in the diagram generator after concepts made with an image model. Diagrams, banner and social preview use the design system: stage `#07080f`, ink `#f2f4fa`, accent `#007aff`, Inter Tight and Geist Mono; every diagram text color passes 4.5:1 on both themes (new test). The README banner is a composition (`scripts/gerar-arte.mjs`): background art made with an image model with no text in it, and the type set in the design system fonts, with the numbers read from disk; a stamp fails the tests when the version or the counts change without regenerating it. Logo PNGs (512, 1024, horizontal for light and dark backgrounds) in `docs/assets/marca/`. The README links the method page on LEVELHARD in a callout under the banner, and opens with an animated diagram of the cycle (CSS only, no script; it stands still on the final frame for whoever asks the system for reduced motion).

### Limits

The first run was measured on Linux on 2026-11-06; macOS and Windows are measured by CI. The AI tools themselves were not driven in a real session: that the Claude Code plugin loads from `.claude/settings.json` after trust comes from its documentation, not from a recorded session. Codex runs hooks in the session folder, so it must be opened at the project root.

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
