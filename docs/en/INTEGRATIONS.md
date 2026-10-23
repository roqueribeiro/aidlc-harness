# Integrations

> How to connect the kit to a security platform, a CI pipeline and an AI tool. The central idea: the kit **does not embed a scanner and does not know your platform**. It reads the report your platform produces and enforces the result, under a rule that never changes: **a scan that did not run is not a clean scan**.

*Translation of [../INTEGRACOES.md](../INTEGRACOES.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

For the RoqueShield case in detail, see [ROQUESHIELD.md](ROQUESHIELD.md). For the design, see [ARCHITECTURE.md](ARCHITECTURE.md#9-security-the-scan-contract).

![Scan contract](../assets/diagramas/varredura.en.claro.svg)

## 1. The contract in three lines

1. The platform (any platform) runs and **exports a JSON report**.
2. `aidlc-scan <report.json>` normalizes it and answers with **0 clean**, **1 failed** or **2 did not run**.
3. In the manifest, this is an ordinary gate, and the `Stop` hook and CI treat it like any other.

```json
{ "id": "scan", "label": "Varredura de segurança", "blocking": true,
  "cmd": "aidlc-scan reports/seguranca.json --fail-on high --require-scanners semgrep,trivy" }
```

The full template is at `plugins/aidlc-harness/templates/security/node-yarn-com-scan.json`.

## 2. The formats

`aidlc-scan` detects the format from the content (`--format auto`, the default) or accepts `--format neutro|sarif|roqueshield`.

### Neutral (the kit's contract)

The simplest format; it is the target of any conversion.

```json
{
  "coverage_complete": true,
  "scanners_ran": ["semgrep", "trivy"],
  "findings": [
    { "key": "sqli-001", "severity": "high", "title": "Consulta SQL montada por concatenação", "location": "src/db/usuarios.js:41" }
  ]
}
```

| Field | Rule |
| --- | --- |
| `coverage_complete` | **Required boolean in practice.** Missing or non-boolean counts as "the report does not say" and gives exit 2 |
| `scanners_ran` | List of names. Needed for `--require-scanners` and for comparing with `--baseline` |
| `findings[]` | `severity` (required), `title`, `location`, and `key` (or `id`) |
| `key` | **Stable** key of the finding: what `--baseline` uses to say what changed. Without it, `title@location` is used, which breaks if the line changes |

Accepted severities: `info`, `low`, `medium`, `high`, `critical`, and common synonyms (`error`, `warning`, `note`, `moderate`, `important`...), normalized. In the neutral format and in the RoqueShield bundle, a severity the kit does not know is a report error (exit 2), not "medium": guessing severity is the way to let a critical through. In SARIF, a result with no score and no recognizable `level` falls to `medium`, because the format allows omitting severity; if your tool does this with a serious finding, adjust its configuration to emit `security-severity`.

### SARIF 2.1.0

The standard many tools export. The reader uses `runs[].tool.driver.name` as the scanner name, `results[]` as the findings, and the severity from `properties.security-severity` (a CVSS score, mapped: 9 or more critical, 7 or more high, 4 or more medium, above 0 low) or, when it is missing, from `level`.

Coverage comes from two rules, and it is worth knowing where it is weak:

- With no `run` at all, it is **did not run** (never clean).
- `invocations[].executionSuccessful: false` in any `run` is **did not run**.
- **Weakness:** a SARIF from a tool that crashed without recording the invocation reads as complete coverage. Compensate with `--require-scanners`, which requires the scanner name in the report.

### RoqueShield AI Fix Bundle

The reader accepts both forms that the RoqueShield documentation describes for the list (`vulnerabilities` or `findings`) and infers coverage from `coverage_complete`, when it exists, or from an empty `scan.scanners_failed` with a non-empty `scan.scanners_executed`. Details and limits in [ROQUESHIELD.md](ROQUESHIELD.md).

## 3. `aidlc-scan` options

| Option | Effect |
| --- | --- |
| `--fail-on <severity>` | Failure threshold (default `high`: `high` and `critical` fail) |
| `--require-scanners a,b` | Exit 2 if any name is not in the report (case-insensitive) |
| `--baseline <previous.json>` | Compares by `key`: shows resolved, remaining and new. The baseline must have complete coverage, and a scanner that ran in it and is now missing is "did not run" |
| `--format` | Forces the format when automatic detection does not fit |
| `--json` | Output for chaining |

With `--baseline`, blocking still applies to **every** finding at the threshold, new or old: the baseline reports what changed, it does not forgive what remained. To explicitly accept an old finding, use your platform's flow (suppression with a reason and an expiry date) and leave it out of the report.

## 4. Examples that CI runs

The reports in [`docs/exemplos/scan/`](../exemplos/scan/) are executed by the repository's tests, with the exit code checked. If one of them stops producing the result below, the documentation is lying and CI fails.

| File | Result |
| --- | --- |
| `neutro-limpo.json` | `0`: complete coverage, only a low finding |
| `neutro-reprovado.json` | `1`: one high finding |
| `neutro-nao-rodou.json` | `2`: `coverage_complete: false`, and the empty findings list does **not** count as clean |
| `sarif.json` | `1`: one high finding read from the SARIF |
| `roqueshield-bundle.json` | `1`: one high finding read from the bundle |
| `roqueshield-scanner-falhou.json` | `2`: `scanners_failed` with Trivy |

The messages printed by the `aidlc-*` executables are in Portuguese, and the examples below show them verbatim, as the program prints them.

```bash
aidlc-scan docs/exemplos/scan/neutro-nao-rodou.json; echo $?
# aidlc-scan  ...  (neutro; scanners: semgrep)
# NAO RODOU: cobertura incompleta: algum scanner nao rodou ou falhou
# 2
```

## 5. Recipes by platform

> **Honesty about verification.** The recipes below use the export format publicly documented by each tool and **were not run in this repository** (the kit's development environment does not have those tools installed). The SARIF and neutral-format reader is tested with the examples from the previous section; the invocation of each scanner is not. Check the flag in the version you use.

### Any tool that exports SARIF

```bash
# example with Semgrep: the SARIF flag is --sarif
semgrep scan --config auto --sarif --output reports/seguranca.json .
aidlc-scan reports/seguranca.json --require-scanners semgrep
```

The same applies to other tools that write SARIF (CodeQL, Trivy with `--format sarif`, among others): the only things that change are the command that generates the file and the scanner name in `--require-scanners`, which is the `tool.driver.name` it writes.

### A platform without SARIF: convert to neutral

Any JSON becomes the neutral format in a few lines. Example with `jq` (tested with a synthetic report):

```bash
jq '{coverage_complete: .ok, scanners_ran: .tools,
     findings: [.items[] | {key: .id, severity: .level, title: .msg, location: "\(.file):\(.line)"}]}' \
   saida-da-plataforma.json > reports/seguranca.json
aidlc-scan reports/seguranca.json
```

What **matters** in the conversion is `coverage_complete`: it must come from a real signal of the platform (the scan finished, no scanner failed), never from a hard-coded `true`. A hand-written `true` undoes the only guarantee of the contract.

### Built-in Trivy (`aidlc-secscan`)

For dependency CVEs, the kit ships `aidlc-secscan`, which runs Trivy and fails only on what is actionable (in a project manifest, with a published fix, outside the allowlist with an expiry date). Without `trivy` installed, the output is "did not run", never clean. It is a separate gate, and it can coexist with `aidlc-scan`.

## 6. CI

`aidlc-init` generates `.github/workflows/aidlc-gate.yml`, which runs `aidlc-init --check` and `aidlc-gate` on the pull request, **with no secret on fork PRs**, with the kit pinned at `AIDLC_REF`.

For the scan, add the report generation **before** `aidlc-gate`, so the `scan` gate has something to read:

```yaml
      - name: Scan (generates the report the gate reads)
        run: |
          mkdir -p reports
          semgrep scan --config auto --sarif --output reports/seguranca.json .
      - name: Acceptance criteria
        run: node "$RUNNER_TEMP/aidlc/plugins/aidlc-harness/tools/aidlc-gate"
```

The step that installs the kit (`git clone` and `checkout` of `AIDLC_REF`) is the one in the generated workflow. `aidlc-gate` puts the kit's executables folder at the front of the `PATH` of the gate commands, so a gate `aidlc-scan ...` or `aidlc-lockcheck` works on a clean runner with no separate installation.

Two important decisions, which the kit makes for you and which are worth knowing:

- **If the report does not exist, the gate gives 2** (did not run) and fails. A scan step that was accidentally removed from the pipeline does not turn green.
- **Pin `AIDLC_REF`** to a tag or commit you have reviewed. Pointing at `main` would accept, on every run, whatever was published.

## 7. AI tools

| | Instructions | Hooks that block | What enforces "done" |
| --- | --- | --- | --- |
| **Claude Code** | `CLAUDE.md` imports `AGENTS.md` | yes, via the plugin | `Stop` hook + CI |
| **Kiro** | `AGENTS.md`, `.kiro/steering/aidlc.md` | no | CI + human review |
| **GitHub Copilot** | `.github/copilot-instructions.md` | no | CI + human review |

Any other tool that reads `AGENTS.md` already receives the rules; what it lacks is the blocking. The contract is the same: the `aidlc-*` executables are command-line programs, so they work in any environment with Node and `git`. A new adapter (for example, for another tool with its own instruction format) is a copy derived from `AGENTS.md`; see [ADAPTERS.md](ADAPTERS.md) and [EXTENDING.md](EXTENDING.md).

## 8. What does not exist yet

Stated here so nobody finds out in production:

- **There is no platform API client.** The kit reads a file. Calling your platform's API, downloading the report and saving it in `reports/` is a step of your pipeline.
- **There is no MCP server and no kit GitHub Action.** The executables are the contract.
- **There is no format for "accepted finding with an expiry date" in `aidlc-scan`.** Today the expiry exists in `aidlc-secscan` (allowlist with `# expira:`); for `aidlc-scan`, suppression belongs to the platform.
- **Conversion to neutral is on you**, with the attention to coverage that section 5 asks for.
