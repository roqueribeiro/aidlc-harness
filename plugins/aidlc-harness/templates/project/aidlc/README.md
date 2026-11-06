# aidlc/

Os artefatos do ciclo AI-DLC deste projeto, versionados junto com o código para o contexto sobreviver entre sessões e ferramentas.

| Pasta | Fase | Arquivos |
| --- | --- | --- |
| `inception/` | Inception | `requirements.md`, `user-stories.md`, `units-of-work.md` |
| `inception/insumos/` | Inception | o que a IA deve ler antes de perguntar: transcrição, briefing, print, planilha |
| `construction/` | Construction | `design.md`, `test-plan.md` |
| `audit/` | todas | uma linha por decisão do gate, escrita pelo hook de Stop |
| `decisions.md` | todas | o registro de decisões |

**Como uma fase termina:** todos os arquivos existem, não têm mais nenhum `PREENCHER`, e cada um traz `Aprovado por:` e `Data:` preenchidos. `node .aidlc/kit/tools/aidlc-phase check <fase>` confere isso e sai com erro se faltar algo. A aprovação é de uma pessoa: a IA não preenche a própria aprovação.

**Como começar:** ponha em `inception/insumos/` o que já existe sobre o pedido e rode o comando de Inception da sua ferramenta (`/inception` no Claude Code; os outros estão em `.aidlc/COMANDOS.md`). A IA escreve o rascunho completo com as recomendações dela, decide sozinha o que é reversível, e pergunta só o que a equipe precisa decidir: no máximo 5 perguntas, na janela de perguntas da ferramenta. Responder "aceito as recomendações" é uma resposta válida.
