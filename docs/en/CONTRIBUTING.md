# Contributing

*Translation of [../../CONTRIBUTING.md](../../CONTRIBUTING.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

Thank you for wanting to improve `aidlc-harness`. This guide is short on purpose. The messages printed by the executables are in Portuguese.

## Before opening a pull request

1. **Open an issue first** for any change beyond a small fix. Aligning on direction costs less than redoing work.
2. **The project's rule applies to the project:** a rule without a mechanism is decoration. If you propose a norm, say which hook, gate or manifest will enforce it.
3. **Every new check is born with a mutant.** Break the code on purpose and show that the test fails. A test that never failed proves nothing. In the PR description, list the mutants you tried.

## Running locally

Requires Node 20.19 or newer and git.

```bash
node --test                          # all suites
node scripts/check-plugin.mjs        # plugin integrity
node scripts/check-quality-manifests.mjs
node scripts/check-docs-consistency.mjs
node scripts/gerar-prompts.mjs --check
node scripts/gerar-diagramas.mjs --check
node scripts/check-reference.mjs
node scripts/check-links.mjs
node plugins/aidlc-harness/tools/aidlc-identity    # no personal or infrastructure data
```

No `npm install` or `yarn install`: the kit has no runtime dependencies, on purpose.

## What CI checks

Identity (`aidlc-identity`), tests, syntax of every `.mjs`, manifests against the schema, plugin integrity, documentation consistency, an up-to-date `docs/PROMPTS.md` and DCO on the commits.

## Content rules

- **Nothing that identifies a person, company or infrastructure.** No names of clients, internal systems, IPs, hostnames, emails or home paths. `aidlc-identity` blocks the formats; the names are up to you. If your example needs a name, use an obviously fictional one (`app-exemplo`, `fulano`).
- **New text in Brazilian Portuguese**, direct, without decoration. Whoever changes a Portuguese document updates its pair under `docs/en/` in the same PR, then runs `node scripts/check-i18n.mjs --atualizar`; `check-i18n` fails the PR that leaves the English behind.
- **Do not claim what you did not verify.** If something was tested only on Linux, say so. The README's "Known limits" section exists for this, and contributions that shrink it with evidence (a test on macOS or Windows, for example) are among the most valuable.
- **Do not copy third-party text.** Quote and link. The AI-DLC description belongs to AWS; `docs/AIDLC.md` summarizes it and points to the source.

## DCO

This project uses the [Developer Certificate of Origin](https://developercertificate.org/). Each commit needs a `Signed-off-by` line with your name and email, stating that you have the right to contribute that code under the project's MIT license:

```bash
git commit -s -m "fix: message"
# forgot? redo the last commit:
git commit --amend -s --no-edit
```

CI fails the pull request if a commit is unsigned.

## Commit style

Short message in the imperative, with a prefix: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. The body explains why, not what.

## Reporting a security issue

**Do not open a public issue.** See [SECURITY.md](../../SECURITY.md).

## Conduct

This project follows the [Code of Conduct](../../CODE_OF_CONDUCT.md).

---

## Summary

Open an issue first for anything non-trivial. Every new check ships with a mutant (break the code on purpose and show the test fails). Run `node --test` and the `scripts/check-*.mjs` before opening a PR. No personal, company or infrastructure identifiers anywhere: `aidlc-identity` must pass. Sign off every commit (`git commit -s`, DCO). Security issues go through private reporting, see SECURITY.md. Docs are Brazilian Portuguese first, with an English pair under `docs/en/` that you update in the same PR (`node scripts/check-i18n.mjs`).
