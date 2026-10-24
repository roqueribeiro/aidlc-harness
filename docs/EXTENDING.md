# Extending the kit

*Also available in [Brazilian Portuguese](pt-BR/ESTENDER.md).*

How to add something new without it being born decorative.

The one rule this document exists to enforce: **every new piece needs a check that holds it**. A rule without a hook, gate or manifest to execute it is decoration: it looks like coverage and enforces nothing.

Before touching anything, know who rules what.

## What is the source of truth

On the left, what you want to know; on the right, the file that decides. Prose that disagrees with the source is the prose that is wrong.

| The question | The source |
| --- | --- |
| Which technologies exist and which gate each one has | `plugins/aidlc-harness/quality/*.json` |
| Which package manager a repository uses | the `pkgManager` field of that technology's manifest |
| What evidence `Stop` asks for | the manifest's `evidence` block |
| Which rule governs which path, and which reviewer it requires | the manifest's `strategy` block |
| What holds for every stack | `quality/_org.json` |
| Who depends on whom in your project | `aidlc-graph list` and `aidlc-graph blast <target>` (graph in `.aidlc/graph.json`) |
| How the team works: models, autonomy, secrets, evidence | [`OPERATING-MODEL.md`](../OPERATING-MODEL.md) |
| What this repository carries | [`AGENTS.md`](../AGENTS.md) |

The kit's numbers (how many hooks, agents, skills) **are not written by hand anywhere without a gate**. `scripts/check-docs-consistency.mjs` counts from disk and warns when a document diverges.

## Adding a technology

A technology is a manifest. Without one, the repository has no gate, evidence or strategy, and `aidlc-doctor` says the technology is not recognized.

For **your project**, create `.aidlc/quality/<tech>.json`: it applies only there, and if the `tech` equals that of a kit manifest, the project's overrides it. An invalid manifest is ignored and reported, never silently. For the **kit**, the file goes in `plugins/aidlc-harness/quality/`.

1. **Create the file.** The name is the `tech`, in kebab-case, and the two must match. The contract is in `quality/_schema.json`: read it before this document.
2. **`detect`** is how to recognize a directory of that stack. `allFiles` is AND, `anyFiles` is OR, `packageDeps` is OR over `dependencies` plus `devDependencies`. Detection looks at the **directory contents**, never at the repository name. Use `priority` when more than one manifest can match.
3. **`pkgManager`** decides the package guard. Guessing here makes `pkg-manager.mjs` deny a command that the repository's own documentation tells you to run.
4. **`gates`** is what runs. Every gate has exactly one of `cmd` and `agent`. Use `platform` when the gate only runs on one system: on the others it comes out **PULADO** (skipped), never green.
5. **`evidence`** is what must appear in the chat before declaring done. `markers` are regexes, and any one matching satisfies it. `whenTouches` makes the evidence conditional on the path touched.
6. **`strategy`** is what delivers the right rule when the file changes. See its own section.
7. **Run `node scripts/check-quality-manifests.mjs`.** It validates against the schema and against invariants the schema alone does not express.
8. **Declare `autonomy`** (`observe`, `advise`, `approve`, `breaker`; `approve` is the default) and the **`security`** block with the id of the gate that fulfills each role (`sca`, `sast`, `pinning`, `review`). Absent means there is no barrier, never an implicit barrier. `aidlc-gate --list` shows both.
9. **Do not copy a gate the org layer already delivers.** `quality/_org.json` holds what applies to every stack matching the `when` (today the `lockfile`, for `pkgManager` yarn or npm). The inherited gate is marked `inherited: "_org"`; a manifest that declares the same id overrides it, and `inherits: false` refuses the whole inheritance. `check-quality-manifests` fails the literal copy, because a copy diverges silently.

A technology that went out of circulation is not deleted: it gets `"status": "archived"`. It disappears from the gate without disappearing from the registry.

## Adding a stack reviewer

A reviewer is a subagent that reads the diff against that stack's rules. It is expensive if badly written, in two opposite ways: a reviewer that approves everything is worth nothing, and a reviewer with wrong instructions **fails correct code**, which is worse than no reviewer.

1. **Write `plugins/aidlc-harness/agents/<name>.md`.** The `name` in the frontmatter must match the file name. Use `model: haiku` and `effort: low` for pattern review, which is mechanical scanning.
2. **The `description` is paid in every session.** Leave in it only the trigger (which stack, when to invoke). The inventory of what the reviewer checks goes in the **body**, which is only paid when it runs.
3. **Anchor on the rules, not on your opinion.** List the sources of truth at the top of the body and tell it to read them. A reviewer that disagrees with the stack's rule fails the canonical pattern.
4. **Declare the gate in the manifest**, with `"agent": "<name>"`, `"model": "haiku"` and `"blocking": true`.
5. **Declare the evidence that enforces it**, with `"id": "stack-review"`, `markers` matching the agent's name, and `whenTouches` in its scope. Without this, `Stop` lets it through with the review never done.
6. **Run `node scripts/check-plugin.mjs`.** It fails a dangling reference, a reviewer that `strategy` asks for and no gate declares, a blocking gate with no evidence covering it, and evidence enforcing a gate that declares itself optional.

`aidlc-gate` **does not run** agent-type gates: the session is what triggers the subagent. It shows up as **PENDENTE** (pending) and becomes `::warning::` in the CI, because a runner does not trigger a subagent. What really enforces it is `dod-check`, at `Stop`, reading the transcript.

## Writing a `strategy` cut

The `strategy` block is what makes the right rule arrive at the moment the file changes. It has two parts.

`always` are the pointers valid for any file of that technology. They go into the map that `strategy-map` injects on every prompt, so they are expensive: two or three at most.

`paths` are the cuts by path. Each has `when` (globs of the touched path), `read` (what to open before writing), `why` (one line saying what breaks if ignored) and the optional `reviewer`.

```json
{
  "when": ["src/**/*.controller.ts"],
  "read": ["@kit/rules/testing.md"],
  "why": "endpoint sem teste ao lado entra no CI sem prova de que responde",
  "reviewer": "supply-chain-reviewer"
}
```

(The `why` in this example reads: "an endpoint with no test next to it enters the CI with no proof that it responds". The example is kept as in the original.)

Three rules worth memorizing:

**The `@kit/` prefix points inside the plugin.** A fixed path to the kit folder is right for one layout and silently breaks the other. The kit resolves the token, because it knows where it is installed itself. A pointer without `@kit/` is relative to the repository root and serves that repository's local rules.

**The `why` is not decoration.** A pointer without a reason is not read. Write what breaks, not what the rule is.

**Each pointer comes out once per session.** Repeating the same line on every save is the shortest path to someone turning the hook off, and a hook that is off delivers zero.

`check-quality-manifests` fails a `@kit/` pointer that points to nothing and a cut without `when`. It cannot verify from here the pointers that are relative to the consuming repository.

## Adding a rule

The kit's rules live in `plugins/aidlc-harness/rules/` and **are never auto-loaded**: a plugin does not serve `.claude/rules/`. The way to deliver them is to tie the rule to a `strategy` cut (above), which is the path that does not depend on someone remembering to open an index. A rule that no cut points to is a rule nobody reads.

## Adding a hook

1. Write it in `plugins/aidlc-harness/hooks/`.
2. **Register it in `hooks/hooks.json`.** A hook that exists in the directory and is not in the JSON never runs, and `check-plugin` fails exactly that.
3. **Write the test in `hooks/hooks.test.mjs`**, in both directions: it blocks when it should and lets through when it should. The test measures latency; the ceiling is 400 ms, because `Stop` fires dozens of times per session.
4. **Fail toward letting work happen.** No recognized technology, no path, invalid stdin: exit 0 and stay quiet.
5. **Give it a kill switch** and state its name in the message.

Two traps:

`process.stdout.write(x)` followed by `process.exit(0)` **truncates at 64 KiB** when stdout is a pipe, which is always the case for a hook. Use `escreve()` from `lib/strategy.mjs`, which exits only after the flush.

`require()` inside an `.mjs` throws `ReferenceError`, and a generic `catch` swallows it. The function silently disappears and returns empty. Test the happy path for real, not just the absence of an error.

## Before closing

```bash
node --test
node scripts/check-plugin.mjs
node scripts/check-quality-manifests.mjs
node scripts/check-docs-consistency.mjs
node plugins/aidlc-harness/tools/aidlc-identity
```

And the rule that holds for everything above: **mutation test**. Break on purpose the thing you just protected and confirm that the check fails. A check that has never been seen failing is a hope, not a guarantee.
