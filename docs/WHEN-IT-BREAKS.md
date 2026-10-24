# When the gate fails

*Also available in [Brazilian Portuguese](pt-BR/QUANDO-QUEBRA.md).*

What each state means and what to do about it. The underlying rule is that **skipped is a pending item, not an approval**, and that weakening a test to make the gate pass is forbidden: a test that failed means the code is wrong.

**A note on language:** the kit's executables print their messages and state labels in Portuguese, and this document keeps those labels exactly as the programs print them. The four you will see: `PASSOU` = passed, `FALHOU` = failed, `PULADO` = skipped, `PENDENTE` = pending. Related words in other messages: `REPROVADO` = failed (rejected), `NAO RODOU` = did not run.

## The four states

```bash
aidlc-gate            # runs the gates of the detected technology
aidlc-gate --list     # what exists for each technology
aidlc-gate --json     # the same thing as data
```

| State | What it is | What to do |
| --- | --- | --- |
| **PASSOU** (passed) | the command ran and exited 0 | nothing |
| **FALHOU** (failed) | the command exited non-zero, or the output matched the `reject` | fix the code, never the test |
| **PULADO** (skipped) | the gate requires another platform, and this machine is not it | report it as pending on a machine, never as green |
| **PENDENTE** (pending) | it is a stack reviewer, and it is the session that triggers a subagent | run the subagent and paste the verdict |

The exit code is about the **command**, and only that. A pending reviewer does not fail the binary, because the binary does not read the transcript and has no way of knowing whether you ran the subagent. What enforces it is `dod-check`, at `Stop`, through the `stack-review` evidence. In the CI it becomes `::warning::`, because a runner does not trigger a subagent.

## Stop refused to end the turn

`dod-check` read the transcript since your last message, saw that the tree changed and did not find the evidence that technology's manifest requires. It lists what is missing.

This is not bureaucracy: it is the difference between a delivery and a report. Paste the gate output without summarizing, the screenshot, the `curl`, the reviewer's verdict, whatever it asked for.

Safeguards, so it never becomes a prison:

- Nothing changed in the tree: it lets through. There was no delivery to prove.
- Technology not recognized: it lets through.
- After three blocks in the same session, it becomes a warning and lets through.
- `AIDLC_GATE=0` turns it off, and the plugin's `gate_mode` option accepts `block`, `warn` and `off`.

Use the kill switch when the evidence is truly unnecessary, and say why. Using it out of habit is turning off the only thing that separates "done" from "I think it's done".

## False red, which is worse than red

A gate that fails what is right teaches people to ignore the gate. Classes that tend to appear:

**The gate changed the repository's state.** A gate writes to its own directory and does not dirty the tree.

**The `reject` matched a test name.** The `reject` regex aims at the summary line, anchored with `^`, not anywhere in the output.

**The command's variable did not exist.** A manifest that cites `$VAR` needs something that defines it.

**The suite became flaky.** If it fails alone and passes together, or the reverse, suspect shared state in `tmp` between runs, for example a test session id derived only from the `pid`, which the system reuses.

## The reviewer failed it

Read the verdict before accepting. A reviewer is anchored on the stack's rules, and when its instruction diverges from the rule, it fails correct code.

If the finding is real, fix it. If the reviewer is wrong, fix **the reviewer** and say so in the delivery: a wrong reviewer that nobody fixes becomes a reviewer everyone ignores.

## Before the push

```bash
node scripts/install-git-hooks.mjs --check     # only reports, exit 1 if missing
node scripts/install-git-hooks.mjs             # installs the pre-push
```

The `pre-push` runs `aidlc-gate` before letting the push out. It does not overwrite someone else's hook and respects `core.hooksPath` and husky. If `aidlc-gate` is not on the `PATH`, the hook lets it pass: installing the kit (`scripts/setup.mjs`) is part of the prerequisites.

⚠️ **The hook disappears on its own.** `.git/hooks/` is not versioned, so it vanishes on a fresh clone and a new machine, silently. That is why `--check` exists.

## A document contradicts the disk

```bash
node scripts/check-docs-consistency.mjs
```

It is a **warning**, not a block, on purpose. It does not distinguish an inventory of the present from a true historical account. If the passage is history, it is right and the warning is noise. If it is an inventory, fix it at the source. To make it truly fail, use `--strict`.
