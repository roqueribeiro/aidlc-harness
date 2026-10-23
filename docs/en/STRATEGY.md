# The kit's strategy

*Translation of [../ESTRATEGIA.md](../ESTRATEGIA.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

> Why `aidlc-harness` is designed the way it is, what each decision costs and what you can take elsewhere. For those who want to understand the design before adopting or contributing.
>
> The numbers in this document were measured in this repository (Linux, Node 22) and checked by `scripts/check-docs-consistency.mjs`. Where something is opinion or a lesson from use, the text says so.

---

## The problem

AI agents generate code cheaply. Checking it is still expensive. Without written criteria, "done" is whatever the agent thinks it is, and the same kind of problem comes back in review for the fifth time, because each session starts over without knowing what the team has already learned.

Three practical consequences:

1. **Review becomes the bottleneck.** Generating got cheap; checking did not.
2. **"It's done" means nothing** without executable criteria.
3. **The same fix is redone in every repository**, because the rule lives in someone's head or in a conversation nobody rereads.

The kit attacks this in the tooling, not in the prompt.

---

## The thesis

Four decisions carry the rest.

**1. Acceptance criteria are data, not prose.** "Run the tests" is open to interpretation. A JSON saying which command, with which output it fails, on which platform, and whether it blocks or not, is executable. Each technology has a manifest in `plugins/aidlc-harness/quality/`, validated by schema. Today there are 4 manifests with 19 gates and 6 pieces of evidence declared, plus the organization layer (`_org.json`), which adds the `lockfile` gate and the cleanup evidence.

**2. Determinism beats models, whenever the task is mechanical.** If a check can be a script, it is a script. The agent is expensive and not reproducible; a `node` process of a few tens of milliseconds is cheap and gives the same answer every time.

**3. Evidence before "done".** The agent does not declare completion: it pastes the gate output in the chat, and the `Stop` hook refuses to end the turn if it is not there.

**4. Those who approve are people.** In the AI-DLC phases, approval is a signature (`Aprovado por:` and `Data:`, the literal labels the check looks for, in Portuguese) that a person writes in the artifact itself, and `aidlc-phase check` fails an approval that is blank or carries the name of an AI tool. The AI proposes and implements; the Inception decisions and the closing of Construction belong to people. See [AIDLC.md](AIDLC.md).

---

## The parts

| Part | Quantity | What it does |
| --- | --- | --- |
| Hooks | 8 | Enforce rules in the tooling: package manager, secret leakage, stray files outside the scratch folder, evidence at close, promise to continue, and deliver the right rule when the file changes |
| Agents | 3 | `scanner` (mechanical sweep, cheap), `advisor` (rare judgment, expensive), `supply-chain-reviewer` (new dependency) |
| Skills | 4 | `aidlc-context`, `bolts`, `blast`, `repo-standard` |
| Commands | 4 | `/inception`, `/construction`, `/gate`, `/status` |
| Executables | 13 | `aidlc-gate`, `aidlc-init`, `aidlc-phase`, `aidlc-identity`, `aidlc-secrets`, `aidlc-doctor` and others, all with zero token cost |

**Measured on 2026-10-23 (Linux, Node 22):** each hook responds in 31 to 67 ms. Hooks are external processes, so they do not spend model context. The repository has 269 passing tests.

---

## Model policy: three roles, three prices

The expensive mistake is not picking the wrong model in one turn. It is paying for extra context in all of them.

| Role | When | How it is invoked |
| --- | --- | --- |
| **Scanner** (cheap) | Mechanical sweep with no judgment: inventory, drift, diff, output triage | Subagent with low effort |
| **Executor** (intermediate) | The turn-by-turn: implement, run the gate, paste evidence, document | The main session |
| **Advisor** (expensive) | Rare judgment: architecture, refuting a finding, a gate that failed twice, an irreversible action | Subagent on demand |

A subagent **does not inherit the conversation**. So "the advisor reviews the context" does not happen for free: hand over the diff, the transcript path or a short briefing. Copying the whole conversation cancels the savings.

---

## Acceptance criteria, as data

The form matters more than the content:

```json
{
  "tech": "node-yarn",
  "detect": { "...how to recognize a repository of this stack..." },
  "gates": [
    { "id": "test", "cmd": "yarn test", "blocking": true, "platform": "any" }
  ],
  "evidence": [
    { "id": "gate-output", "label": "Gate output pasted in the chat" }
  ]
}
```

Three details that only show up in use:

- **`platform`**: a gate that only runs on one system must come out as "skipped", never as green. Faking green is worse than red.
- **`whenTouches`**: makes the evidence conditional. Demanding proof of something the session did not touch trains people to ignore the gate.
- **Schema validation**: `check-quality-manifests` fails an invalid manifest before it becomes criteria.

The project manifest (`.aidlc/quality/<tech>.json`) overrides the kit's for the same `tech`. See [EXTENDING.md](EXTENDING.md).

---

## The evidence contract

The `Stop` hook refuses to finish without the evidence the manifest asks for. That is strong enough to become a nuisance, so four safeguards were born with it:

| Safeguard | Behavior |
| --- | --- |
| Never traps | After three refusals in the same session, it becomes a warning and allows |
| Always reversible | `AIDLC_GATE=0` turns it off |
| Only when there is a delivery | A clean working tree means there is nothing to prove |
| Conditional | Evidence is only demanded when the session touched a file that matches the glob |

**A gate that traps is a gate that will be turned off in the first week.** Design the exit together with the lock.

---

## Secrets without handing over the key

A session's transcript can be stored and synced. An `echo $TOKEN` becomes a secret persisted off the machine. That is why no `aidlc-secrets` command prints a value: consumption is by injection into the child process.

```bash
aidlc-secrets exec github -- gh api user
```

The value leaves the system vault, enters the child's environment, and the process ends. `secret-guard` blocks what would get around this (`echo` of a secret variable, `set -x`, base64 of a credential). Each project can declare its own secrets in `.aidlc/secrets.json`.

---

## What keeps the documentation honest

`scripts/check-docs-consistency.mjs` counts from disk what the documents claim (how many hooks, agents, skills, executables) and warns when a written number diverges. `docs/PROMPTS.md` (Portuguese) is generated from `commands/` and CI fails if it goes stale. `aidlc-identity` keeps personal or infrastructure data out of the repository.

A source hash alone is not enough: it catches "the source changed", not "the number is wrong". Counting from disk catches the second.

---

## What the kit does not do

Said plainly, because a document that only reports successes does not help:

- **Blocking hooks only exist in Claude Code.** In Kiro and Copilot the kit delivers the instructions (`aidlc-init`), but what enforces is CI and people. See [ADAPTERS.md](ADAPTERS.md).
- **Operations is the thinnest part.** The kit covers Inception and Construction well; for Operations there is minimal content.
- **It was not tested on macOS, Windows, Kiro or Copilot.** Automated tests run on Linux.
- **It is not AWS documentation.** It is an interpretation of AI-DLC, with the source linked in [AIDLC.md](AIDLC.md).

---

## Lessons that travel

1. **Write the acceptance criteria as data.** The moment it is open to interpretation, it is ignorable.
2. **Every mechanical check wants to be a script.** If an agent is doing file path arithmetic, someone is paying a lot for a calculator.
3. **A gate that traps will be turned off.** Give the emergency exit together with the lock.
4. **Silent failure costs more than noisy failure.** An invalid manifest that is ignored without warning looks like it works. That is why the kit reports what it ignored.
5. **A document without a gate rots.** Measure what it claims.
6. **A rule without a mechanism is decoration.** Before writing a norm, say which hook, gate or manifest will enforce it.
7. **A check that never failed is not a check.** Break it on purpose (mutation test) before declaring it done.
8. **Always-on context is paid for in every subagent.** Keep it short.
