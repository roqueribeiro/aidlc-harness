# Documentação do aidlc-harness

Por onde começar depende do que você quer.

| Eu quero... | Leia |
| --- | --- |
| **Usar o kit em um projeto, do zero** | [COMECAR.md](COMECAR.md): a trilha em sete passos |
| **Entender o método** | [AIDLC.md](AIDLC.md): o AI-DLC e como o kit o interpreta |
| **Ver como é feito por dentro** | [ARQUITETURA.md](ARQUITETURA.md): contexto, containers, hooks, manifestos, segurança, decisões |
| **Procurar um comando, hook, campo ou variável** | [REFERENCIA.md](REFERENCIA.md) |
| **Ligar uma plataforma de segurança** | [INTEGRACOES.md](INTEGRACOES.md) |
| **Usar com o RoqueShield** | [ROQUESHIELD.md](ROQUESHIELD.md) |
| **Usar com Claude Code, Kiro ou Copilot** | [ADAPTADORES.md](ADAPTADORES.md) |
| **Aplicar numa empresa regulada** | [REGULADO.md](REGULADO.md) |
| **Acrescentar uma tecnologia, revisor ou regra** | [ESTENDER.md](ESTENDER.md) |
| **Entender uma falha do gate** | [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md) |
| **Entender por que o desenho é assim** | [ESTRATEGIA.md](ESTRATEGIA.md) |
| **Achar um termo ou uma resposta rápida** | [GLOSSARIO.md](GLOSSARIO.md) |
| **Ver o texto dos comandos `/inception`, `/construction`...** | [PROMPTS.md](PROMPTS.md) (gerado) |
| **Contribuir** | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Relatar uma vulnerabilidade** | [SECURITY.md](../SECURITY.md) |

## Os diagramas

Todos são gerados do código (`node scripts/gerar-diagramas.mjs`), em tema claro e escuro, e conferidos no CI. Os números neles vêm do disco.

| Diagrama | Onde é explicado |
| --- | --- |
| [Contexto](assets/diagramas/contexto.claro.svg) | [ARQUITETURA, seção 2](ARQUITETURA.md#2-contexto-onde-o-kit-entra) |
| [Containers](assets/diagramas/containers.claro.svg) | [ARQUITETURA, seção 3](ARQUITETURA.md#3-containers-o-que-há-dentro-do-plugin) |
| [Camadas de manifesto](assets/diagramas/camadas.claro.svg) | [ARQUITETURA, seção 4](ARQUITETURA.md#4-o-critério-de-aceite-como-dado) |
| [Hooks](assets/diagramas/hooks.claro.svg) | [ARQUITETURA, seção 5](ARQUITETURA.md#5-o-caminho-de-uma-edição-hooks-em-ordem) |
| [Como o Stop decide](assets/diagramas/evidencia.claro.svg) | [ARQUITETURA, seção 6](ARQUITETURA.md#6-o-stop-como-pronto-ganha-evidência) |
| [Fases e aprovação humana](assets/diagramas/fases.claro.svg) | [ARQUITETURA, seção 7](ARQUITETURA.md#7-as-fases-e-a-aprovação-humana) |
| [Uma fonte, três ferramentas](assets/diagramas/multiferramenta.claro.svg) | [ARQUITETURA, seção 8](ARQUITETURA.md#8-uma-fonte-de-instruções-três-ferramentas) |
| [Contrato de varredura](assets/diagramas/varredura.claro.svg) | [INTEGRACOES](INTEGRACOES.md) |
| [RoqueShield e o kit](assets/diagramas/roqueshield.claro.svg) | [ROQUESHIELD](ROQUESHIELD.md) |
| [Instalação](assets/diagramas/instalacao.claro.svg) | [COMECAR](COMECAR.md) |

Para usar um diagrama com tema automático em um documento, use `<picture>` (exemplo em [ARQUITETURA, seção 15](ARQUITETURA.md#15-como-os-diagramas-são-feitos)).
