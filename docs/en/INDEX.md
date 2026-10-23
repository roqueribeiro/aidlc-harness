# aidlc-harness documentation

*Translation of [../INDEX.md](../INDEX.md) (Brazilian Portuguese, the primary version). If they differ, the Portuguese one wins.*

Where to start depends on what you want.

| I want to... | Read |
| --- | --- |
| **Use the kit in a project, from scratch** | [GETTING-STARTED.md](GETTING-STARTED.md): the seven-step path |
| **Understand the method** | [AIDLC.md](AIDLC.md): AI-DLC and how the kit interprets it |
| **See how it is built inside** | [ARCHITECTURE.md](ARCHITECTURE.md): context, containers, hooks, manifests, security, decisions |
| **Look up a command, hook, field or variable** | [REFERENCE.md](REFERENCE.md) |
| **Connect a security platform** | [INTEGRATIONS.md](INTEGRATIONS.md) |
| **Use it with RoqueShield** | [ROQUESHIELD.md](ROQUESHIELD.md) |
| **Use it with Claude Code, Kiro or Copilot** | [ADAPTERS.md](ADAPTERS.md) |
| **Apply it in a regulated company** | [REGULATED.md](REGULATED.md) |
| **Add a technology, reviewer or rule** | [EXTENDING.md](EXTENDING.md) |
| **Understand a gate failure** | [WHEN-IT-BREAKS.md](WHEN-IT-BREAKS.md) |
| **Understand why the design is the way it is** | [STRATEGY.md](STRATEGY.md) |
| **Find a term or a quick answer** | [GLOSSARY.md](GLOSSARY.md) |
| **See the text of the `/inception`, `/construction`... commands** | [PROMPTS.md](../PROMPTS.md) (Portuguese, generated) |
| **Contribute** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Report a vulnerability** | [SECURITY.md](../../SECURITY.md) |

## The diagrams

All of them are generated from code (`node scripts/gerar-diagramas.mjs`), in light and dark themes, and checked in CI. The numbers in them come from the disk.

| Diagram | Where it is explained |
| --- | --- |
| [Context](../assets/diagramas/contexto.en.claro.svg) | [ARCHITECTURE, section 2](ARCHITECTURE.md#2-context-where-the-kit-fits-in) |
| [Containers](../assets/diagramas/containers.en.claro.svg) | [ARCHITECTURE, section 3](ARCHITECTURE.md#3-containers-what-is-inside-the-plugin) |
| [Manifest layers](../assets/diagramas/camadas.en.claro.svg) | [ARCHITECTURE, section 4](ARCHITECTURE.md#4-acceptance-criteria-as-data) |
| [Hooks](../assets/diagramas/hooks.en.claro.svg) | [ARCHITECTURE, section 5](ARCHITECTURE.md#5-the-path-of-an-edit-hooks-in-order) |
| [How Stop decides](../assets/diagramas/evidencia.en.claro.svg) | [ARCHITECTURE, section 6](ARCHITECTURE.md#6-stop-how-done-earns-evidence) |
| [Phases and human approval](../assets/diagramas/fases.en.claro.svg) | [ARCHITECTURE, section 7](ARCHITECTURE.md#7-phases-and-human-approval) |
| [One source, three tools](../assets/diagramas/multiferramenta.en.claro.svg) | [ARCHITECTURE, section 8](ARCHITECTURE.md#8-one-source-of-instructions-three-tools) |
| [Scan contract](../assets/diagramas/varredura.en.claro.svg) | [INTEGRATIONS](INTEGRATIONS.md) |
| [RoqueShield and the kit](../assets/diagramas/roqueshield.en.claro.svg) | [ROQUESHIELD](ROQUESHIELD.md) |
| [Installation](../assets/diagramas/instalacao.en.claro.svg) | [GETTING-STARTED](GETTING-STARTED.md) |

To use a diagram with an automatic theme in a document, use `<picture>` (example in [ARCHITECTURE, section 15](ARCHITECTURE.md#15-how-the-diagrams-are-made)).
