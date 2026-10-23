# Operating model

*Translation of [../../OPERATING-MODEL.md](../../OPERATING-MODEL.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

Note: the messages printed by the `aidlc-*` executables and the literal markers they look for (such as `Aprovado por:` and `PREENCHER`) are in Portuguese. They are quoted verbatim below.

How we work with AI agents in this repository and in any project that adopts `aidlc-harness`. This file is normative for the kit itself: it is the reason the `harness-self` manifest exists, and `aidlc-gate` only recognizes this repository when this file is here.

The rule that organizes everything else: **a rule without a mechanism is decoration.** Every norm below points to the hook, gate or manifest that enforces it. If you want to add a norm, first say which mechanism will enforce it.

## 1. Principles

| # | Principle | What enforces it |
| --- | --- | --- |
| 1 | **Acceptance criteria are data, not prose.** Which command, what output fails, whether it blocks. | `quality/<tech>.json`, validated by `quality/_schema.json` and by `scripts/check-quality-manifests.mjs` |
| 2 | **Determinism beats a model when the task is mechanical.** If a check can be a script, it is a script. | `tools/aidlc-*`, all without a model call |
| 3 | **Evidence before "done".** The agent pastes the raw gate output; it does not summarize it. | `dod-check` hook (Stop): refuses to finish without the evidence marker declared in the manifest |
| 4 | **A person approves the phase.** The AI proposes, the team validates. | `aidlc-phase check`: fails on a `PREENCHER` (fill-in) field and on an empty `Aprovado por:` (approved by) or one with an AI's name |
| 5 | **A check that never failed is not a check.** Before declaring done, break it on purpose. | `tools/aidlc-mutation` and the rule of writing the mutant together with the test (`skills/bolts`) |
| 6 | **A secret does not show on screen.** Not by echo, not in a log, not encoded. | `secret-guard` hook (PreToolUse) and `tools/aidlc-secrets exec` |
| 7 | **Nothing that identifies a person or infrastructure goes into the repository.** | `tools/aidlc-identity`, CI `identity` gate |
| 8 | **A new dependency only gets in after being checked.** It exists, has an owner, its name does not imitate another, it is in the lockfile. | `tools/aidlc-lockcheck`, `tools/aidlc-secscan` and the `supply-chain-reviewer` agent |
| 9 | **The package manager is the project's.** The guard does not assume one. | `pkg-manager` hook, reading `pkgManager` from the manifest |
| 10 | **An irreversible action asks for confirmation.** Deleting, overwriting, publishing, force push. | `AGENTS.md` instruction and the `advisor` agent for the decision; no hook replaces judgment here |
| 11 | **The always-loaded context is short.** Invariants stay, reference material goes out. | `tools/aidlc-harness --check` (baseline budget) and `aidlc-doctor` (CLAUDE.md under 8 KB) |
| 12 | **Finished work leaves a clean bench.** | `tools/aidlc-limpeza` and the `fechamento-limpeza` evidence of the org layer |

Item 10 is the only one without a blocking hook, on purpose: deciding whether a deletion is safe depends on context that a text pattern does not have. It is left to the instruction and to the human.

## 2. Model roles

The expensive mistake is not picking the wrong model in one turn; it is paying for extra context in all of them.

| Role | When | How |
| --- | --- | --- |
| **Scanner** | mechanical sweeps without judgment: inventory, drift, lint triage | `agents/scanner.md`, small model, low effort |
| **Executor** | turn by turn: implementing, running the gate, writing documentation | the main session |
| **Advisor** | a decision too big for the turn: architecture, refuting a finding, a gate stuck twice, an irreversible action | `agents/advisor.md`, on demand, never every turn |

## 3. Autonomy declared as data

Each manifest declares `autonomy`: `observe` (only reads and reports), `advise` (recommends, the human executes), `approve` (proposes, the human approves, then it executes) or `breaker` (executes on its own and the human interrupts). The default is `approve`. A gate can declare its own and override the stack's. The schema (`quality/_schema.json`) rejects any value outside that list, and `scripts/check-quality-manifests.mjs` applies the schema.

## 4. Acceptance criteria per technology

The kit ships generic manifests; each project adds its own in `.aidlc/quality/<tech>.json` (see `docs/ESTENDER.md`, in English [`EXTENDING.md`](EXTENDING.md)).

| Technology | Detection | Blocking gates |
| --- | --- | --- |
| `node-yarn` | `package.json` + `yarn.lock` | tests, `aidlc-secscan`, `supply-chain-reviewer`, `aidlc-lockcheck` (org layer) |
| `node-npm` | `package.json` + `package-lock.json` | the same, with `npm` |
| `python-uv` | `pyproject.toml` + `uv.lock` | lint, format, lockfile, secret, unit tests |
| `harness-self` | this repository | `node --test`, syntax of every `.mjs`, manifests, plugin integrity |

Lint and build start as non-blocking in the generic manifests, because the kit does not know whether your project has them. Making one blocking is a manifest edit, reviewed like any other, never a session decision.

## 5. Evidence contract

"Done" only counts with the evidence the manifest declares, pasted in the chat:

- **Gate:** the output of `aidlc-gate`, raw. A summary does not count.
- **Visible change:** screenshots opened and read, not just generated.
- **Closing a unit of work:** the final line `aidlc-limpeza: nada sobrando` (verbatim, as the executable prints it: "nothing left over").
- **AI-DLC phase:** `aidlc-phase check <phase>` exiting with 0, and a person's approval in the files.

`dod-check` records each decision in `.claude/audit/<day>.jsonl`, and `aidlc-cycle` reads that record. What has no record shows up as "not measured", never as zero.

## 6. What stays outside this model

- **Product decisions** live in each project's `context/product.md` and `aidlc/decisions.md`, not here.
- **The policy of a specific organization** (data classification, approvers, vendors) lives in an internal repository that extends the kit. See `docs/REGULADO.md` (in English [`REGULATED.md`](REGULATED.md)).
- **The official AI-DLC documentation** belongs to AWS. `docs/AIDLC.md` ([`AIDLC.md`](AIDLC.md) in English) is an interpretation, and says so.

## 7. How this file is maintained

Did you change a hook, a manifest or a tool that the table in section 1 mentions? The same change updates this table. `scripts/check-docs-consistency.mjs` checks the counts and names the documentation claims; review checks the rest.
