# Glossary and FAQ

*Translation of [../GLOSSARIO.md](../GLOSSARIO.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

The messages printed by the `aidlc-*` executables are in Portuguese. Where a term appears in those messages, the Portuguese term is given in parentheses next to the English one.

## Glossary

| Term | Meaning in this kit |
| --- | --- |
| **AI-DLC** | AI-Driven Development Life Cycle: an AWS method (published in July 2025) in which the AI leads the planning and the team validates. Phases: Inception, Construction, Operations. The kit is a **practical interpretation**, not an AWS product or documentation ([AIDLC.md](AIDLC.md)) |
| **Inception** | The phase in which the AI asks and the team answers: requirements, stories and units of work. It ends with a person's signature |
| **Construction** | Design and test plan approved before any code; then code and tests in the same diff, one unit at a time |
| **Operations** | Delivery and observation. It is the thinnest phase of the kit |
| **Bolt** | A short delivery cycle that closes a **unit of work** with a test, evidence and cleanup (skill `bolts`) |
| **Unit of work** (`unidade de trabalho`) | A piece of delivery with a clear boundary, defined in `aidlc/inception/units-of-work.md` |
| **Gate** | An executable check in the manifest (`cmd` or `agent`). A **blocking** one makes `aidlc-gate` fail when it fails |
| **Acceptance criteria** (`critério de aceite`) | The set of gates and evidence of a technology, as data, in `quality/<tech>.json` |
| **Evidence** (`evidência`) | What must appear **in the chat** before declaring something done (the raw gate output, a screenshot, the reviewer's verdict). The `Stop` hook looks for it by markers |
| **Manifest** | A technology's JSON file: how to recognize it, what to run, what to prove, what to read before writing |
| **Technology (`tech`)** | A manifest's identifier (`node-yarn`, `python-uv`...). The project's own overrides the kit's |
| **Organization layer** | `quality/_org.json`: gates and evidence that apply to every stack matching a `when`, written once |
| **Strategy (`strategy`)** | The part of the manifest that says **what to read before writing**, per touched path, and which reviewer the stack requires |
| **Hook** | A process Claude Code fires on an event (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`) |
| **Fail toward letting go** (`falhar para o lado de liberar`) | A principle of the hooks: when in doubt, exit 0. Blocking by mistake costs more than letting one case through |
| **Kill switch** | A variable that turns a hook off in an emergency (`AIDLC_GATE=0` and similar). It exists so a gate never becomes a prison |
| **`gate_mode`** | Plugin option: `block`, `warn` or `off`, for the `Stop` hooks |
| **PASSOU / FALHOU / PULADO / PENDENTE** (passed / failed / skipped / pending) | Results of a gate. **PULADO** (skipped): the current platform cannot run it (it never turns green). **PENDENTE** (pending): a reviewer has not given a verdict yet ([WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md)) |
| **Coverage (of a scan)** (`cobertura`) | Whether all expected scanners ran. **Complete**, **incomplete** or **unknown**; only the first allows "clean" |
| **Clean / failed / did not run** (`limpo` / `reprovado` / `não rodou`) | The three results of `aidlc-scan` (exits 0, 1 and 2). **Did not run** never counts as clean |
| **Finding** (`achado`) | A problem a scanner reported, with severity, title, location and a stable key |
| **Stable key** (`chave estável`) | A finding identifier that survives between scans (`key`, `deduped_key`); it is what `--baseline` uses to say what changed |
| **Baseline** | The previous report, against which a new one is compared |
| **SARIF** | Static Analysis Results Interchange Format 2.1.0, a static analysis report standard that many tools export |
| **Neutral format** | The kit's own contract (`coverage_complete`, `scanners_ran`, `findings`), the target of any conversion |
| **AI Fix Bundle** | RoqueShield's JSON (schema 1.0.0) with deduplicated, prioritized findings for an agent to fix ([ROQUESHIELD.md](ROQUESHIELD.md)) |
| **Mutant** (`mutante`) | A deliberate breakage of the code to prove that a test fails. Every new check is born with one |
| **Slopsquatting** | Someone registers the name of a package that AI models tend to invent. `aidlc-lockcheck` and `supply-chain-reviewer` exist because of it |
| **Scratch** | A scratch folder outside any repository, which `scratch-guard` (opt-in) enforces |
| **Kernel** | `context/kernel.md`: three lines of product context that `session-brief` injects into every session |
| **`AGENTS.md`** | The single source of instructions for any AI tool. Kiro and Copilot get derived copies |
| **Steering (Kiro)** | Kiro's persistent instructions mechanism (`.kiro/steering/`) |
| **DCO** | Developer Certificate of Origin: every commit carries `Signed-off-by` (`git commit -s`) |

## Frequently asked questions

### Does the kit work only with Claude Code?

The instructions (`AGENTS.md`) and the `aidlc-*` executables work with any tool; the **hooks that block** exist only in Claude Code. In Kiro and GitHub Copilot, what prevents a "done" without evidence is CI (`aidlc-gate.yml`) and human review. See [ADAPTERS.md](ADAPTERS.md).

### Do I need RoqueShield?

No. It is one of the platforms `aidlc-scan` knows how to read. With SARIF, with the neutral format, with the built-in `aidlc-secscan` or with no scanning at all, the kit works. See [ROQUESHIELD.md](ROQUESHIELD.md).

### What happens if the scanner goes down?

The report does not exist or comes with incomplete coverage, and `aidlc-scan` exits with **2 (did not run)**, which fails the gate. That is the point of the contract: a scan that did not run is not a clean scan.

### Can the hook trap me in a session?

No. After 3 refusals in the same session `dod-check` becomes a warning and lets you through; `gate_mode` accepts `warn` and `off`; `AIDLC_GATE=0` turns everything off. A gate that traps people gets turned off in the first week, so the design asks for little and leaves a way out.

### Can the AI approve a phase on its own?

`aidlc-phase check` refuses a blank approval and the name of an AI tool. It does **not prove** that the name belongs to someone with authority: that is up to your process (for example, mandatory review of the pull request that commits the signature).

### How do I change the acceptance criteria for my project?

Create `.aidlc/quality/<tech>.json` with the same `tech` as the kit: it overrides. For a rule that applies to every stack in the organization, use the `_org.json` layer. See [EXTENDING.md](EXTENDING.md).

### Can I use it in a regulated company?

The kit was designed for that, but **an organization's internal layer does not live here**: keep manifests, forbidden terms and internal rules in a private repository of your own. See [REGULATED.md](REGULATED.md).

### Can the documents and diagrams get out of date?

There are checks for that: `check-docs-consistency` (counts), `check-reference` (the reference covers everything that exists and the prose does not cite a command that does not exist) and `gerar-diagramas --check` (the SVGs follow the code). All of them run in CI.

### What has not been verified yet?

macOS, Windows, Kiro, GitHub Copilot, the Node 20.19 floor (only 22 was run) and the RoqueShield integration against a running instance. The full list, without decoration, is in [ARCHITECTURE.md](ARCHITECTURE.md#14-known-limits).

### How do I contribute?

Read [CONTRIBUTING.md](CONTRIBUTING.md). In short: every new check comes with a mutant, "done" requires the raw output of `node --test`, and commits carry `Signed-off-by`.

### I want to translate the documentation.

Welcome. The documentation is in Brazilian Portuguese first, with an English summary in the README. English translations of the guides follow the CONTRIBUTING flow.
