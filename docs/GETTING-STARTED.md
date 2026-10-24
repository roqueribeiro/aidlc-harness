# Getting started: the seven-step path

*Also available in [Brazilian Portuguese](pt-BR/COMECAR.md).*

From zero to a project with the AI-DLC cycle running. Each step says what to do, what you should see, and what to do if you do not see it. Estimated time from the first to the fifth step: half an hour, most of it in the requirements conversation.

The output excerpts below came from a real run of the kit (Linux, Node 22). On another system the shape is the same.

**A note on language:** the kit's executables (`aidlc-*`) print their messages in Portuguese, so the excerpts below are kept verbatim, exactly as the programs print them. Each time a Portuguese message appears, a short gloss follows in English. The words you will see most: `criado` = created, `PREENCHER` = fill in, `INCOMPLETA` = incomplete, `completa` = complete, `nada sobrando` = nothing left over.

## 1. Install the kit on your machine

Prerequisites: **Node 20.19 or newer** (`node --version`) and **git**.

```bash
git clone https://github.com/roqueribeiro/aidlc-harness.git
node aidlc-harness/scripts/setup.mjs
```

`setup` puts the `aidlc-*` executables in a directory on your PATH (`~/.local/bin` on macOS and Linux, `%USERPROFILE%\.aidlc\bin` on Windows). It never overwrites a file that is not its own.

**What you should see:** one line per executable and, at the end, `setup: 13 executáveis em <diretório>` (13 executables in <directory>). If the directory is not on your PATH, `setup` warns you: add it to your shell's PATH and open a new terminal.

**Check:** `aidlc-gate --list` lists the technologies the kit knows.

**Windows:** `setup` generates `.cmd` shortcuts. This has **not been tested** on a real Windows machine. If it fails, run the executables through `node <path>\plugins\aidlc-harness\tools\aidlc-gate` and open an issue with the output.

## 2. Connect the kit to your tool

**Claude Code** (where the hooks really block):

```bash
claude plugin marketplace add roqueribeiro/aidlc-harness
claude plugin install aidlc-harness@aidlc
```

Inside a session, `/reload-plugins` and then `/context` should show `aidlc-harness` with its agents and hooks. For a local copy of the repository, use the path instead of `roqueribeiro/aidlc-harness`.

**Kiro and GitHub Copilot** do not load Claude Code plugins. They receive the project instructions (step 3) and use the step 1 executables from the terminal. The difference in guarantee is in [ADAPTERS.md](ADAPTERS.md): there, what enforces "done" is the CI, not a hook.

## 3. Prepare the project

```bash
cd meu-projeto            # a git repository; new or existing
aidlc-init --name "Meu Projeto" --desc "Cadastro de clientes"
```

`aidlc-init` creates what is missing and **never overwrites**. To preview, use `--dry-run`. To generate instructions for only some tools, `--tools claude,copilot`.

**What you should see:**

```
aidlc-init  /caminho/meu-projeto
  criado       AGENTS.md
  criado       CLAUDE.md
  criado       .github/copilot-instructions.md
  criado       .kiro/steering/aidlc.md
  criado       context/product.md
  criado       context/kernel.md
  criado       .aidlc/config.json
  criado       .aidlc/identity.json
  criado       .github/workflows/aidlc-gate.yml
  criado       aidlc/README.md
  criado       aidlc/inception/requirements.md   (e user-stories.md, units-of-work.md)
  criado       aidlc/construction/design.md      (e test-plan.md)
  criado       aidlc/decisions.md
```

(`criado` = created; `e` = and.)

What each thing is:

| File | What it is for |
| --- | --- |
| `AGENTS.md` | **The single source** of the instructions. Edit only this one. |
| `CLAUDE.md`, `.github/copilot-instructions.md`, `.kiro/steering/aidlc.md` | Derived from `AGENTS.md`. `aidlc-init --check` fails if they diverge; `--sync` rewrites them. |
| `context/product.md` | What the product is, who it is for, what has already been decided, and the vocabulary. **Fill it in by hand**: the AI must not invent this. |
| `aidlc/` | The cycle's artifacts, versioned with the code. |
| `.aidlc/config.json` | The kit's configuration for this project (all keys are optional). |
| `.aidlc/identity.json` | Exceptions to the identity scanner, each with a reason. |
| `.github/workflows/aidlc-gate.yml` | The CI: identity, phase state and gate. |

Commit this in a single commit, before starting the work.

**Edit `context/product.md` now.** Two sentences are enough to start. Without it, the agent works without knowing what the product is, and in the first answers you will see the consequence.

## 4. Inception: requirements, stories, units

Here the AI leads and the team answers. In Claude Code:

```
/aidlc-harness:inception Quero um cadastro de clientes com busca e histórico de alterações
```

(The example prompt is in Portuguese; it means "I want a customer registry with search and change history". Write yours in your own language.)

In Kiro or Copilot, paste the text from [pt-BR/PROMPTS.md](pt-BR/PROMPTS.md#inception) (Portuguese) into the agent's chat.

The AI should:

1. read `AGENTS.md`, `context/product.md` and `aidlc/decisions.md`;
2. ask **in rounds of at most five questions**, with options and a recommendation, waiting for your answers;
3. record the answers, in your words, in `aidlc/inception/requirements.md`;
4. propose stories with verifiable acceptance criteria, and then the units of work.

**Your role:** answer, correct, cut scope. If the AI invents a requirement nobody stated, delete it. If a criterion comes with an adjective ("fast"), demand a number.

**Closing the phase:** when the three files are filled in, **a person** writes their name and the date in `Aprovado por:` and `Data:` in each file. (These two literals, "Approved by:" and "Date:", are what the check looks for, so keep them in Portuguese.) Then:

```bash
aidlc-phase check inception
```

While anything is pending, the output lists each item (real excerpt):

```
  aidlc/inception/requirements.md: 7 campo(s) por preencher (marcador PREENCHER)
  aidlc/inception/requirements.md: "Aprovado por:" em branco
aidlc-phase: inception INCOMPLETA
```

Gloss: "7 field(s) left to fill (marker PREENCHER)", "`Aprovado por:` is blank", "inception INCOMPLETE".

The command exits with code 1 while the phase is incomplete. If the AI writes its own name in the approval, it also fails:

```
  aidlc/inception/requirements.md: "Aprovado por: Claude" nao vale, a aprovacao e de uma pessoa
```

Gloss: "`Aprovado por: Claude` does not count, the approval is from a person".

When everything is right: `aidlc-phase: inception completa` (inception complete), and `aidlc-phase status` shows Construction unlocked.

**Honest limit:** the kit checks that the approval **exists and is not from an AI**. Whether the name written is that of the person who actually approved is the team's responsibility, for example by requiring review of the pull request that commits the signature.

## 5. Construction: design and test plan

```
/aidlc-harness:construction
```

(In Kiro or Copilot: [pt-BR/PROMPTS.md](pt-BR/PROMPTS.md#construction), in Portuguese.)

The AI starts by running `aidlc-phase check inception`. If Inception is not complete, it stops. Then it proposes the design with alternatives and their costs, asks what only the team knows (internal standards, approved platforms, sensitive data) and writes `aidlc/construction/design.md` and `test-plan.md`. The test plan ties **each acceptance criterion** to a test, and says what remains unverified.

Sign both files as in the previous step and run `aidlc-phase check construction`.

## 6. Code, one unit at a time

With both phases approved, the work follows the `bolts` skill (see [`skills/bolts/SKILL.md`](../plugins/aidlc-harness/skills/bolts/SKILL.md)):

1. a short branch per unit;
2. test and code in the same diff; a new check is born with a **mutant** (break the code on purpose and confirm the test fails);
3. `aidlc-gate` and **the raw output pasted in the chat**. In Claude Code, the Stop hook refuses to end a turn that says "done" without the evidence the technology's manifest declares;
4. a new dependency goes through the `supply-chain-reviewer`;
5. `aidlc-identity` clean before opening the pull request.

Install the pre-push hook so the gate runs before the push goes out:

```bash
node aidlc-harness/scripts/install-git-hooks.mjs
```

If your stack is not Node (yarn or npm) or Python (uv), `aidlc-gate` will not recognize it. Add a manifest at `.aidlc/quality/<tech>.json` ([EXTENDING.md](EXTENDING.md)).

## 7. Close and measure

When you finish a unit:

```bash
aidlc-limpeza --apagar     # leftover worktrees, branches and containers
aidlc-doctor               # the repository's score and what is missing
aidlc-cycle                # phase lead time, gate block rate
```

The line `aidlc-limpeza: nada sobrando` (nothing left over) is the evidence the Stop hook asks for when the message says a unit has closed. Decisions that still stand go into `aidlc/decisions.md`.

## When something does not work

- `aidlc-gate` says it does not recognize the technology: the project has no `package.json` + lockfile (or `pyproject.toml` + `uv.lock`). See [EXTENDING.md](EXTENDING.md).
- The gate "skipped" something: skipped is not green. [WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md) explains PASSOU (passed), FALHOU (failed), PULADO (skipped) and PENDENTE (pending).
- The plugin did not load in Claude Code: `claude plugin validate <plugin folder>` and `/reload-plugins`.
- `aidlc-identity` found something legitimate (a public contact email, for example): record it in `.aidlc/identity.json` with the reason. An entry without a reason is refused.
