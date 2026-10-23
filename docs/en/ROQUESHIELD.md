# RoqueShield and aidlc-harness

> RoqueShield is a continuous security testing platform, open source (Apache-2.0), that the kit knows how to read. This document says **what that relationship is, what it is not, and what state it is in**. In short: the kit **does not depend** on RoqueShield; RoqueShield is **one** of the platforms that enter through the same scan contract. Any other enters at the same place ([INTEGRATIONS.md](INTEGRATIONS.md)).

*Translation of [../ROQUESHIELD.md](../ROQUESHIELD.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/diagramas/roqueshield.en.escuro.svg">
  <img alt="The scan loop: RoqueShield finds, the kit enforces, the agent fixes" src="../assets/diagramas/roqueshield.en.claro.svg">
</picture>

## 1. Two pieces, one idea

RoqueShield ([repository](https://github.com/roqueribeiro/roqueos-shield), Apache-2.0, **alpha**) is a scan orchestrator: several scanners behind an adapter contract (SAST, secrets, dependency CVEs, IaC, DAST, network, OSINT), language-model triage over already sanitized evidence, an agent that tries to confirm findings inside a leashed Kali container, and an **AI Fix Bundle**: a versioned JSON that another agent consumes to propose the patch.

`aidlc-harness` is what enforces, in the development cycle, that the acceptance criteria have run.

The two projects were born separately and arrived at the same rule by different paths. RoqueShield's, in free translation from the English original of its README: *"zero findings here means clean, or means it did not run? If there is no way to tell, a signal is missing."* The kit's: **a scan that did not run is not a clean scan.** That is why the connection is natural: the `coverage_complete` and `scanners_skipped` of one are the raw material for the exit code 2 of the other.

| | RoqueShield | aidlc-harness |
| --- | --- | --- |
| What it is | Platform that **runs** scans | Kit that **enforces** that the acceptance criteria have run |
| Runs scanners? | Yes (15 adapters) | No (only the built-in Trivy, for dependency CVEs) |
| Talks to the target? | Yes: it is what it does | Never |
| Output that matters to the other | AI Fix Bundle (JSON, schema 1.0.0) | Exit code 0, 1 or 2 |
| License | Apache-2.0 | MIT |
| Depends on the other? | **No** | **No** |

## 2. The dependency, stated exactly

What the kit **needs** from RoqueShield: **a JSON file** in the AI Fix Bundle format. Nothing more. There is no API client, credential, library or RoqueShield service inside the kit.

What RoqueShield **needs** from the kit: nothing. It works alone, and the kit works without it (with another platform, with the built-in Trivy, or with no scan at all).

This is on purpose. A platform dependency inside a quality kit is a single point of failure with the name "quality". The contract is a **report reader**: if the platform changes or goes down, the report does not exist, and the output is **2 (did not run)**, never a green.

## 3. How to connect

The paths below come from the RoqueShield documentation (its `docs/integrations.md` and `docs/ai-fix-bundle-spec.md`). They **were not run against a real instance in this repository**: the kit's integration was validated against the bundle specification and against the examples in this folder, not against a running installation. Check the commands in the version you installed.

### 3.1 Through the CLI, in any pipeline with a shell

```bash
# RoqueShield scans and exports the bundle (commands from its documentation)
cai scan git@exemplo.com:org/app-exemplo.git --asset-type repo
cai bundle <scan_id> --out reports/seguranca.json

# the kit enforces
aidlc-scan reports/seguranca.json --format roqueshield --require-scanners semgrep,trivy
```

### 3.2 Through the REST API

The bundle is at `GET /reports/{scan_id}/ai-bundle`. Download it to `reports/seguranca.json` in the step before `aidlc-gate`; authentication belongs to your pipeline, and the kit never sees the credential.

### 3.3 As a manifest gate

```json
{ "id": "scan", "label": "Varredura de segurança (RoqueShield)", "blocking": true,
  "cmd": "aidlc-scan reports/seguranca.json --format roqueshield --fail-on high --require-scanners semgrep,trivy" }
```

If the step that generates `reports/seguranca.json` is removed, the gate gives **2** and fails. See the full CI recipe in [INTEGRATIONS.md](INTEGRATIONS.md#6-ci).

## 4. How the kit reads the bundle

`lib/scan.mjs` (`lerRoqueShield`) translates the bundle into the kit's single shape.

| RoqueShield bundle | In the kit |
| --- | --- |
| `vulnerabilities[]` (specification) **or** `findings[]` (integration guide) | findings |
| `deduped_key` (or `id`) | stable key of the finding (used by `--baseline`) |
| `severity` | severity. It is the **severity adjusted by triage**; the scanner's own stays in `severity_original` and the kit does not use it |
| `instances[0].location` | location of the finding |
| `scan.scanners_executed` (or `scanners_ran`) | scanners that ran |
| `coverage_complete`, when it exists; otherwise empty `scan.scanners_failed` **and** non-empty `scanners_executed` | complete coverage |
| none of the signals above | coverage **unknown**: exit 2 |

Three reading decisions worth knowing:

- **Unknown severity is an error**, not "medium". Guessing severity is the way to let a critical through.
- **A probable false positive still counts.** The bundle sends that finding to `patch_priority` 5 without removing it from the list, and RoqueShield itself treats it as a "discard candidate, not truth". The kit is conservative: the finding counts until someone decides, in the platform, that it goes away.
- **Empty list with complete coverage is clean; empty list without coverage is "did not run".** The examples [`roqueshield-bundle.json`](../exemplos/scan/roqueshield-bundle.json) (exit 1) and [`roqueshield-scanner-falhou.json`](../exemplos/scan/roqueshield-scanner-falhou.json) (exit 2, with `scanners_failed: ["trivy"]` and no findings) show the difference, and the repository's tests run them.

## 5. The loop: scan, fix, scan again

RoqueShield describes the loop in which an agent reads the bundle, fixes the code and **scans again**. The kit provides the stop condition that its documentation asks for, and which is not "the agent said it is finished":

1. The agent reads the bundle by `patch_priority` and fixes.
2. It runs a new scan of the same target and generates another report.
3. `aidlc-scan new.json --baseline old.json` compares by stable key: what disappeared was fixed, what remained goes back to step 1, and what is **new** is a regression the patch introduced.
4. The loop ends when the scan **comes back clean and coverage is still complete**. If a scanner stopped running between rounds, `--baseline` answers 2 instead of declaring victory over a broken tool.

That last point is the reason the contract exists: without checking coverage, "the agent fixed everything" and "the scanner stopped working" are indistinguishable.

## 6. Honest state

- **RoqueShield is alpha.** Its README says so and lists what is still a sketch (for example, the Kali agent container is a declared *stub*). The kit inherits that state: do not treat the connection as more mature than the platform.
- **Validated against the documentation, not against an instance.** The kit's tests use synthetic bundles written from the specification. The full loop has not been run against a real RoqueShield. It is a welcome contribution (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- **RoqueShield's documentation is inconsistent in three places**, and the kit's reader was written to tolerate them instead of depending on any one of them:
  1. The findings list is called `vulnerabilities` in the bundle specification and `findings` in the integration guide.
  2. Coverage is `scan.scanners_executed` and `scan.scanners_failed` in the specification, and `coverage_complete` and `scanners_ran` in the guide.
  3. The bundle's `generator` field appears as `cai-orchestrator` in the specification and as `cai` (version 0.3.0) in the guide, which acknowledges its own version divergence between the bundle, the application and the `pyproject`.

  If the real format is different, the kit answers **2**, not 0: a report it does not understand never turns green.
- **RoqueShield's MCP and GitHub Action are proposals** in its repository (the documentation says they are not implemented). The kit depends on neither; the CLI and the bundle are enough.

## 7. Authorization and scope

Scanning a target that is not yours carries legal weight. The kit **does not start scans and never talks to the target**: it reads the result of one that **you** decided on and authorized. The agent's leash, the lab mode and the audit log belong to RoqueShield, and reading its README before pointing it at anything real is its own recommendation, which is worth repeating here.

## 8. What if my platform is a different one?

It works the same way, and it is the common case:

| The platform exports | Do |
| --- | --- |
| SARIF 2.1.0 | `aidlc-scan report.sarif --format sarif` (or `auto`) |
| Its own JSON | convert to the neutral format (`jq` recipe in [INTEGRATIONS.md](INTEGRATIONS.md#5-recipes-by-platform)) |
| Nothing usable | treat as "did not run" until there is a report; never as clean |

The RoqueShield integration has no special handling in the gate: the only code specific to it is the format reader, and the rest (coverage, `--require-scanners`, `--baseline`, `--fail-on`, exit 2) is the same for everyone.
