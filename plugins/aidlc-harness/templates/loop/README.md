# loop/

Rotinas de manutenção prontas, uma por tipo de projeto. `scripts/aplicar-repo-aberto.mjs --harness --loop <tipo>` copia a escolhida para `.claude/loop.md` do projeto, e `/loop` a executa.

| Tipo | Quando |
| --- | --- |
| `generico` | qualquer projeto |
| `api` | serviço com contratos consumidos por outros |
| `web` | aplicação com interface |

Para um tipo novo, crie `<tipo>.md` aqui. A regra de ouro da rotina: quando tudo está verde, ela diz isso em uma linha e para, em vez de inventar trabalho.
