# AI-DLC and how the kit interprets it

*Also available in [Brazilian Portuguese](pt-BR/AIDLC.md).*

> **This document is an interpretation.** AI-DLC (AI-Driven Development Life Cycle) was described by AWS. This kit is not AWS documentation, product or endorsement. What follows about the method comes from the launch post ([AI-Driven Development Life Cycle: Reimagining Software Engineering](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/), AWS DevOps & Developer Productivity Blog, 2025-07-31). If AWS publishes something that contradicts what is here, AWS is right and this file is out of date.

## The method, in one paragraph

According to the post, AI-DLC organizes the work into three phases. In **Inception**, the AI turns business intent into requirements, stories and units of work, and the team validates its questions and proposals (a ritual the post calls *Mob Elaboration*). In **Construction**, the AI proposes architecture, domain model, code and tests from the validated context, and the team jointly decides the technical choices (*Mob Construction*). In **Operations**, the AI applies the accumulated context to infrastructure as code and to deployments, under supervision. The terms change: *bolts* (short cycles, of hours or days) instead of sprints, *units of work* instead of epics. The artifacts stay in the repository, which preserves context between sessions. The recurring pattern is plan, clarify, implement, and the AI "defers critical decisions to humans".

## What the kit does with each part

| In AI-DLC | In the kit | Mechanism |
| --- | --- | --- |
| Inception phase | `aidlc/inception/`: requirements, stories, units of work | `/inception` drives it; `aidlc-phase check inception` checks it |
| Mob Elaboration | The AI asks in rounds of at most five, with options and a recommendation; the team answers | command instruction; the kit does **not** bring people together, it records what the team answered |
| Units of work | `aidlc/inception/units-of-work.md`, each with the evidence that makes it done | `aidlc-phase` requires the file without any unfilled field |
| Human validation | `Aprovado por:` and `Data:` at the end of each artifact, filled in by a person | `aidlc-phase` fails on blank and on an AI name; it does not prove the name belongs to whoever approved |
| Construction phase | `aidlc/construction/`: design and test plan before the code | `/construction` drives it; `aidlc-phase check construction` requires a complete Inception first |
| Mob Construction | The AI proposes alternatives with cost and a recommendation; the team chooses; what was discarded is recorded | command instruction; the kit does **not** orchestrate a live session |
| Bolts | The `bolts` skill: one unit at a time, with the closing sequence (test, gate, main branch updated, cleanup) | `dod-check` enforces the cleanup; `aidlc-gate` enforces the acceptance criteria |
| Artifacts in the repository | The `aidlc/` folder and `aidlc/decisions.md`, versioned with the code | `aidlc-init` creates it; CI checks the phase state |
| Operations phase | `aidlc/decisions.md`, `aidlc-cycle`, `aidlc-limpeza` | see below: it is the thinnest part of the kit |

## What the kit adds to the method

The post describes the *what* of the cycle; the kit adds controls that make "done" verifiable:

- **Acceptance criteria as data** (`quality/*.json`) and **mandatory evidence**: the raw gate output in the chat, enforced by a hook in Claude Code.
- **Mutation test** of the checks themselves: a check that never failed proves nothing.
- **Identity scanner**: nothing that identifies a person or infrastructure goes into the repository.
- **Secrets vault** that the agent uses without seeing.
- **Supply chain review** for a new dependency.
- **Instructions for three tools** from one source, with a drift check.

## Where the kit departs from the method, or falls short

Stated so you can decide with open eyes:

1. **Operations is the thinnest part.** The kit records decisions, measures the cycle (`aidlc-cycle`) and cleans the bench. It does **not** generate infrastructure as code, deploy or observe production. The method's promise that the AI applies the accumulated context to deployments and infrastructure is left to your pipeline.
2. **The "mob" rituals are team practices.** The kit provides the structure (questions in rounds, approval in the file), but does not bring anyone together. An Inception answered by one person, in a hurry, passes `aidlc-phase` the same way as one discussed by the whole team. The quality of the ritual is the team's.
3. **Validation is checked in form.** `aidlc-phase` guarantees that an approval exists and is not from an AI. What requires the approval to come from someone with the authority to give it is your organization's process (for example, mandatory review of the pull request that commits the signature).
4. **The vocabulary is adapted.** "Bolt" in the kit is the unit of work with the closing sequence of the `bolts` skill. It is not a cycle measured in hours by the method's definition; if your unit takes a week, the kit does not prevent it.
5. **The kit has two phases (Inception and Construction)** in `aidlc-phase`, because Operations has no approval artifact of its own here.

## Recommended reading

- The original post (link above), for the method.
- [ADAPTERS.md](ADAPTERS.md), for what each AI tool receives.
- [REGULATED.md](REGULATED.md), for an organization with audit and compliance requirements.
