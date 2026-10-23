# Profile for regulated organizations

*Translation of [../REGULADO.md](../REGULADO.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

For teams in banks, insurers, healthcare, government and other organizations with audit, segregation of duties and sensitive data. This document is generic on purpose: **nothing here is specific to a company**, and the kit carries no company's policy. Your organization's policy lives in an internal repository that extends this one (see the last section).

This document is not legal or compliance advice, and the kit certifies nothing. It says where the kit's controls help, where they do not, and what your organization needs to add.

## Controls: what the kit covers and what is missing

| Concern | What the kit offers | Gap, which is yours |
| --- | --- | --- |
| **Decision trail** | Versioned `aidlc/`: requirements, design and test plan with `Aprovado por:` and `Data:`; `aidlc/decisions.md` | The signature is a name in text. To count as evidence, commit through a pull request with mandatory review and use signed commits |
| **Segregation of duties** (who writes does not approve) | `aidlc-phase` fails an approval with an AI name | That the approver is a different person from the author: `CODEOWNERS` + branch protection requiring the owner's review. The kit does not verify this |
| **Gate log** | The Stop hook writes each decision to `.claude/audit/<day>.jsonl`; `aidlc-cycle` reads it | The log is local and editable. For audit, ship it to your logging system; retention and immutability are up to your infrastructure |
| **Sensitive data out of the repository** | `aidlc-identity` finds IPs, emails, home paths, hostnames, secrets and the **terms you list** | Data classification and what counts as sensitive are yours. The scanner finds format, not meaning |
| **Secrets** | `secret-guard` (Claude Code) blocks a command that displays a value; `aidlc-secrets exec` injects without printing | The kit's vault is the macOS keychain or local files. In a regulated organization, use the corporate vault and treat `aidlc-secrets` as an example |
| **Supply chain** | `aidlc-secscan`, `aidlc-lockcheck`, `supply-chain-reviewer`, `pkg-manager` | Mirrored internal registry, approved package list and SBOM do not come with the kit |
| **Data in the conversation with the AI** | The `AGENTS.md` rule: no personal or infrastructure data | It is an instruction, not a block. Which data may go to which model is a decision for your policy and your AI vendor's contract |
| **Change management** | The gate in CI and the phases provide test evidence | The link to your change process (ticket, window, risk approval) is yours |

## Suggested starting configuration

In `.aidlc/config.json`: `"dco": true` if the organization requires a certificate of origin for contributions. In the plugin, `gate_mode: block` (the default) instead of `warn`.

In CI, make the phase mandatory instead of informational. The generated workflow uses `aidlc-phase status` (informational) because a newly created project still has the Inception to fill in; when the project enters Construction, switch to:

```bash
aidlc-phase check inception
aidlc-phase check construction
```

Enable the denylist in CI (`AIDLC_IDENTITY_TERMS` pointing to a file kept outside the public repository, or inside a private internal repository) with the names of systems, customers, units and people that must not appear.

Declare `scratchDir` in `.aidlc/config.json` if you want `scratch-guard` to keep the agent from scattering files around the home directory.

## Approvals that deserve more than a name

`Aprovado por:` is a declaration. Three cheap reinforcements:

1. **Pull request with mandatory `CODEOWNERS` review** for any change in `aidlc/**`. The repository history then shows who approved and when, through a mechanism your platform already audits.
2. **Signed commits** on the approval files.
3. **Approver different from the author**, verified by branch protection, not by trust.

## What **not** to put in this public repository

If you use this kit as a base: names of internal systems, endpoints, policies, proprietary architecture standards, data classification, names of people and departments. All of that goes in the internal repository (next section). Run `aidlc-identity` with your term list before any contribution back to the kit.

## Extending the kit without forking

Recommended: **a private internal repository** that depends on the kit instead of copying it.

```
interno-aidlc/                      (private)
├── .aidlc/quality/*.json           the organization's technologies and gates (same `tech` overrides the kit's)
├── context/product.md              (per project)
├── rules/                          architecture, security and data standards
├── identity-terms.txt              forbidden terms (names of systems, departments, customers)
└── templates/                      the organization's AGENTS.md, with the internal rules
```

Manifests in the project's `.aidlc/quality/` are added to the kit's; one with the same `tech` overrides it, and an invalid one is ignored **and reported** (see [EXTENDING.md](EXTENDING.md)). That way the organization's policy evolves without touching this repository, and kit updates arrive through a version update, not through a merge.

Pin the version of the kit you adopted (a tag or a reviewed commit), in the plugin and in CI. Updating is a change like any other: reviewed, tested, recorded.

## Before adopting, ask

1. Has the security and technology risk area approved the use of the AI tool and the data flow to the vendor?
2. Is there a policy on AI-generated code (review, ownership, licensing)?
3. Did the kit's plugin and executables go through the review the organization requires for third-party software? The code is here, it is small and has tests, but the review is yours.
4. Who owns the internal repository that extends the kit, and how does it receive updates?
