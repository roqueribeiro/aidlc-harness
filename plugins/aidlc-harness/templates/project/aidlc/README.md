# aidlc/

Os artefatos do ciclo AI-DLC deste projeto, versionados junto com o código para o contexto sobreviver entre sessões e ferramentas.

| Pasta | Fase | Arquivos |
| --- | --- | --- |
| `inception/` | Inception | `requirements.md`, `user-stories.md`, `units-of-work.md` |
| `construction/` | Construction | `design.md`, `test-plan.md` |
| `audit/` | todas | uma linha por decisão do gate, escrita pelo hook de Stop |
| `decisions.md` | todas | o registro de decisões |

**Como uma fase termina:** todos os arquivos existem, não têm mais nenhum `PREENCHER`, e cada um traz `Aprovado por:` e `Data:` preenchidos. `aidlc-phase check <fase>` confere isso e sai com erro se faltar algo. A aprovação é de uma pessoa: a IA não preenche a própria aprovação.

**Como começar:** peça à IA para conduzir a Inception. Ela deve fazer as perguntas uma rodada de cada vez, registrar as respostas em `requirements.md` e só então propor as histórias.
