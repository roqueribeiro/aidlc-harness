# Operations

*Also available in [Brazilian Portuguese](pt-BR/OPERACAO.md).*

> **Who it is for:** whoever keeps the kit running, on both sides: the maintainer who releases `aidlc-harness`, and the team that runs it inside a project and has to update it, roll it back and watch it.
> **What is here:** what runs on its own and where, how a version is released, how a project moves to a new version without a red CI, how to undo each step, what there is to back up, and what to watch.
> **Where to go for the rest:** every command and flag is in the [REFERENCE](REFERENCE.md); what each red result means, in [WHEN-IT-BREAKS](WHEN-IT-BREAKS.md); the first install, in [GETTING-STARTED](GETTING-STARTED.md).

## Table of contents

1. [The routine](#1-the-routine)
2. [Releasing a version](#2-releasing-a-version)
3. [Updating a project without breaking it](#3-updating-a-project-without-breaking-it)
4. [Undoing](#4-undoing)
5. [Backup and restore](#5-backup-and-restore)
6. [Monitoring](#6-monitoring)

## 1. The routine

The kit has no server and no scheduled job. Everything that runs on its own is triggered by an event in git or in the AI tool.

| What runs | When | Where | How you know it ran |
| --- | --- | --- | --- |
| `ci` ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) | every pull request and every push to `main` | GitHub Actions, Node 20, 22 and 24; the clean-machine job on Linux, macOS and Windows | the checks on the pull request |
| `dco` ([`.github/workflows/dco.yml`](../.github/workflows/dco.yml)) | every pull request | GitHub Actions | fails the commit without `Signed-off-by` |
| `release` ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) | every push to `main`, or by hand (`workflow_dispatch`) | GitHub Actions | a `vX.Y.Z` tag and release, or the line `vX.Y.Z já existe; nada a fazer` in the log |
| `site` ([`.github/workflows/site.yml`](../.github/workflows/site.yml)) | every pull request and push | GitHub Actions; publishes to GitHub Pages only from `main` and only when the repository variable `SITE_PAGES` is `ativo` | the `publicar` job ran |
| `aidlc-gate` workflow in a project ([template](../plugins/aidlc-harness/templates/project/aidlc-gate.yml)) | every pull request and push of the project | the project's CI, with the kit cloned at `AIDLC_REF` | the project's checks |
| The kit hooks (`dod-check` and the others) | every turn of the AI tool that supports hooks | the developer's machine, from the plugin or from `.aidlc/kit/` | a line per decision in `aidlc/audit/<day>.jsonl` |
| The `pre-push` | every `git push` | the developer's machine, if it was installed | the push waits for `aidlc-gate` |

Whether `SITE_PAGES` is set on the public repository today was not checked from here: the workflow reads it, this document does not prove its value.

## 2. Releasing a version

The version lives in four places, and [`scripts/notas-da-versao.mjs`](../scripts/notas-da-versao.mjs) fails while any of them disagrees: `version` in `package.json`, `version` in `plugins/aidlc-harness/.claude-plugin/plugin.json`, `AIDLC_REF` in [`plugins/aidlc-harness/templates/project/aidlc-gate.yml`](../plugins/aidlc-harness/templates/project/aidlc-gate.yml), and a dated section in `CHANGELOG.md`. The reason is written at the top of that script: in v0.2.0 the generated workflow pinned a tag that did not exist yet, and every new project would have had its CI broken at the kit checkout.

```bash
# 1. bump the four places to the same X.Y.Z, and turn "## [Unreleased]" into "## [X.Y.Z] - YYYY-MM-DD"
node scripts/notas-da-versao.mjs --check     # exit 1 while they disagree
node scripts/notas-da-versao.mjs             # prints vX.Y.Z, a blank line, then the notes the release will carry

# 2. the repository's own gate, the same steps CI runs
node --test
node scripts/check-plugin.mjs
node scripts/check-quality-manifests.mjs
node scripts/check-docs-consistency.mjs
node scripts/gerar-prompts.mjs --check
node scripts/gerar-ferramentas.mjs --check
node scripts/gerar-diagramas.mjs --check
node scripts/check-reference.mjs
node scripts/check-i18n.mjs
node scripts/check-links.mjs
node site/scripts/sync-docs.mjs --check
node plugins/aidlc-harness/tools/aidlc-identity
```

Then open the pull request, with every commit signed off (`git commit -s`). When the merge reaches `main`, the `release` workflow runs `notas-da-versao.mjs --check` again, creates the tag `vX.Y.Z` on that commit and the GitHub release with the CHANGELOG section as the notes. Nobody tags by hand ([CONTRIBUTING, Releasing a version](../CONTRIBUTING.md#releasing-a-version)).

The `verificar` script in `package.json` chains most of these checks through `yarn`, but not `check-i18n` nor `sync-docs --check`; CI runs both, so the list above is the complete one.

## 3. Updating a project without breaking it

A project depends on the kit in three places that must move together, and `aidlc-init --check` in CI compares them:

| Where | What pins the version | Who updates it |
| --- | --- | --- |
| `.aidlc/kit/` | the files of the copy, compared with the kit at `AIDLC_REF` | `aidlc-init --sync` rewrites the copy and removes what an older version left ([`lib/init.mjs`](../plugins/aidlc-harness/lib/init.mjs)) |
| `.claude/settings.json` | `extraKnownMarketplaces.aidlc.source.ref`, `v<version>` | `aidlc-init --sync` merges the new pin and keeps the rest of the file ([`lib/adaptadores.mjs`](../plugins/aidlc-harness/lib/adaptadores.mjs)) |
| `.github/workflows/aidlc-gate.yml` | `AIDLC_REF` | **you, by hand**: an existing workflow is kept as it is, `--sync` does not rewrite it |

The CI runs `--check` from the kit pinned in `AIDLC_REF`, not from the copy, so an agent cannot loosen the gate by editing `.aidlc/kit/`. The consequence for an update: a copy synced to the new version with `AIDLC_REF` still on the old one fails CI. Change both in the same commit.

```bash
# read the CHANGELOG of the new version first; in the 0.x series any version may change behavior
npx github:roqueribeiro/aidlc-harness init --sync      # copy of the kit, generated commands and hooks, settings pin
# edit .github/workflows/aidlc-gate.yml: AIDLC_REF: vX.Y.Z (the same version)
node .aidlc/kit/tools/aidlc-init --check                # exit 0: copies and kit agree
node .aidlc/kit/tools/aidlc-gate                        # exit 0: the gate is green with the new kit
git add -A && git commit -s -m "chore: aidlc-harness vX.Y.Z"
```

`npx github:roqueribeiro/aidlc-harness` takes the repository's default branch. Pointing it at a tag with npm's own `#vX.Y.Z` suffix is how npm reads a git dependency; the kit's tests do not exercise that form, so it is not proven here. The pin that matters for CI is `AIDLC_REF`: put a tag or a commit you reviewed, never `main` (the comment in the generated workflow says why).

In Claude Code, after the commit, the plugin is served from the new tag of the marketplace once the folder is trusted again or the plugins are reloaded (`/reload-plugins`).

## 4. Undoing

| Step | The way back | What it does not undo |
| --- | --- | --- |
| `aidlc-init` in a project | `git revert <commit>` of the single commit that [GETTING-STARTED](GETTING-STARTED.md#2-prepare-the-project) asks for. An existing `AGENTS.md` only got a block between `<!-- aidlc:inicio -->` and `<!-- aidlc:fim -->`, which the revert removes | the `pre-push` in `.git/hooks/`, which is not versioned: remove it by hand |
| A kit update in a project | `git revert` of the update commit: the copy, the settings pin and `AIDLC_REF` go back together | nothing; the three were in the same commit (section 3) |
| A gate that blocks in an emergency | `AIDLC_GATE=0` turns off the evidence gate and the other Stop hooks; the plugin option `gate_mode` set to `warn` keeps them reporting without blocking ([REFERENCE, environment variables](REFERENCE.md#environment-variables-and-configuration)) | it is a switch, not a fix; turn it back on and read [WHEN-IT-BREAKS](WHEN-IT-BREAKS.md) |
| `aidlc-limpeza --apagar` | not needed: it removes only what the remote already holds, and what would lose work comes out under "decidir" and is never deleted | a branch you delete yourself afterwards |
| A released version of the kit | revert on `main` and release a new patch version; the `release` workflow skips a tag that already exists, so it never moves a published tag | the published tag stays, and projects that pinned it keep running it. Deleting a tag breaks the CI of every project with that `AIDLC_REF` |

## 5. Backup and restore

The kit keeps no state of its own outside git. Everything a project needs is versioned with the project: `AGENTS.md`, `context/`, `aidlc/` (requirements, design, test plan, decisions) and the copy in `.aidlc/kit/`. A clone is the restore, with three exceptions:

| What | Why it is not in the clone | How to get it back |
| --- | --- | --- |
| The `pre-push` | `.git/hooks/` is not versioned and vanishes on a fresh clone, silently | `node scripts/install-git-hooks.mjs --check`, then `node scripts/install-git-hooks.mjs` from a clone of the kit ([WHEN-IT-BREAKS, Before the push](WHEN-IT-BREAKS.md#before-the-push)) |
| The Trivy binary | it is downloaded into the kit cache on the first `aidlc-secscan`, pinned by version and sha256 in [`lib/trivy.mjs`](../plugins/aidlc-harness/lib/trivy.mjs) | downloads again on its own; in CI the generated workflow caches `~/.cache/aidlc-harness` |
| `aidlc/audit/<day>.jsonl` | it is written on the machine where the hooks ran; whether a team commits it is the team's choice, and it is local and editable ([REGULATED](REGULATED.md)) | if it matters for audit, ship it to your logging system; the kit does not |

Secrets used with `aidlc-secrets` live in the macOS keychain or in local files, never in the repository; backing them up is the vault's job, not the kit's.

## 6. Monitoring

| What to watch | Command | Healthy |
| --- | --- | --- |
| The gate of the project | `node .aidlc/kit/tools/aidlc-gate` | exit 0; PULADO (skipped) is not green ([WHEN-IT-BREAKS](WHEN-IT-BREAKS.md#the-four-states)) |
| Copies and kit in agreement | `node .aidlc/kit/tools/aidlc-init --check` | exit 0 |
| Leftovers at the end of a unit | `node .aidlc/kit/tools/aidlc-limpeza` | exit 0 with `aidlc-limpeza: nada sobrando` |
| The cycle | `node .aidlc/kit/tools/aidlc-cycle --since 30d` | numbers instead of `não medido`; no record means the hooks did not write `aidlc/audit/` |
| The repository against the standard | `node .aidlc/kit/tools/aidlc-doctor` | the grade and the list of what is missing; the kit fixes no target grade |
| The always-on context cost | `node .aidlc/kit/tools/aidlc-harness --check` | exit 0: the baseline in `.claude/harness-baseline.json` did not grow past the tolerance |
| This repository | the `ci` checks on `main` | all green, including the clean-machine job on the three systems |

No number in this table was measured for a specific project: they are the exit codes and lines the programs print, as described in the [REFERENCE](REFERENCE.md#exit-codes).
