# Estender o kit

*Tradução de [EXTENDING.md](../EXTENDING.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

Como acrescentar coisa nova sem que ela nasça decorativa.

A regra que este documento existe para impor é uma só: **toda peça nova precisa de um check que a segure**. Uma norma sem hook, gate ou manifesto que a execute é decoração: parece cobertura e não cobra nada.

Antes de mexer em qualquer coisa, saiba quem manda no quê.

## Quem é fonte da verdade

À esquerda o que você quer saber, à direita o arquivo que decide. Prosa que discorde da fonte é a prosa que está errada.

| A pergunta | A fonte |
| --- | --- |
| Quais tecnologias existem e qual gate cada uma tem | `plugins/aidlc-harness/quality/*.json` |
| Qual gerenciador de pacote um repositório usa | o campo `pkgManager` do manifesto daquela tecnologia |
| Que evidência o `Stop` cobra | o bloco `evidence` do manifesto |
| Qual regra governa qual caminho, e qual revisor ele exige | o bloco `strategy` do manifesto |
| O que vale para toda stack | `quality/_org.json` |
| Quem depende de quem no seu projeto | `aidlc-graph list` e `aidlc-graph blast <alvo>` (grafo em `.aidlc/graph.json`) |
| Como o time trabalha: modelos, autonomia, segredos, evidência | [`OPERATING-MODEL.md`](OPERATING-MODEL.md) |
| O que este repositório carrega | [`AGENTS.md`](../../AGENTS.md) |

Os números do kit (quantos hooks, agentes, skills) **não se escrevem à mão em lugar nenhum sem gate**. `scripts/check-docs-consistency.mjs` conta do disco e avisa quando um documento diverge.

## Acrescentar uma tecnologia

Uma tecnologia é um manifesto. Sem ele, o repositório não tem gate, evidência nem estratégia, e o `aidlc-doctor` diz que a tecnologia não é reconhecida.

Para o **seu projeto**, crie `.aidlc/quality/<tech>.json`: ele vale só ali, e se o `tech` for igual ao de um manifesto do kit, o do projeto sobrescreve. Manifesto inválido é ignorado e reportado, nunca silencioso. Para o **kit**, o arquivo vai em `plugins/aidlc-harness/quality/`.

1. **Crie o arquivo.** O nome é o `tech`, em kebab-case, e os dois precisam bater. O contrato está em `quality/_schema.json`: leia-o antes deste documento.
2. **`detect`** é como reconhecer um diretório daquela stack. `allFiles` é E, `anyFiles` é OU, `packageDeps` é OU sobre `dependencies` mais `devDependencies`. A detecção olha o **conteúdo do diretório**, nunca o nome do repositório. Use `priority` quando mais de um manifesto puder casar.
3. **`pkgManager`** decide o guard de pacote. Chutar aqui faz o `pkg-manager.mjs` negar um comando que a documentação do próprio repositório manda rodar.
4. **`gates`** é o que roda. Todo gate tem exatamente um entre `cmd` e `agent`. Use `platform` quando o gate só roda em um sistema: nos outros ele sai **PULADO**, nunca verde.
5. **`evidence`** é o que precisa aparecer no chat antes de declarar pronto. `markers` são regexes, e qualquer um casando satisfaz. `whenTouches` torna a evidência condicional ao caminho tocado.
6. **`strategy`** é o que entrega a regra certa quando o arquivo muda. Veja a seção própria.
7. **Rode `node scripts/check-quality-manifests.mjs`.** Ele valida contra o schema e contra invariantes que o schema sozinho não expressa.
8. **Declare `autonomy`** (`observe`, `advise`, `approve`, `breaker`; `approve` é o padrão) e o bloco **`security`** com o id do gate que cumpre cada papel (`sca`, `sast`, `pinning`, `review`). Ausente significa que não há barreira, nunca barreira implícita. `aidlc-gate --list` mostra os dois.
9. **Não copie gate que a camada org já entrega.** `quality/_org.json` guarda o que vale para toda stack que casa o `when` (hoje o `lockfile`, para `pkgManager` yarn ou npm). O gate herdado vem marcado `inherited: "_org"`; um manifesto que declarar o mesmo id sobrescreve, e `inherits: false` recusa a herança inteira. O `check-quality-manifests` reprova a cópia literal, porque cópia diverge calada.

Uma tecnologia que saiu de circulação não se apaga: ganha `"status": "archived"`. Ela some do gate sem sumir do registro.

## Acrescentar um revisor de stack

Um revisor é um subagente que lê o diff contra as regras daquela stack. Ele custa caro se for mal escrito, de dois jeitos opostos: revisor que aprova tudo não vale nada, e revisor com instrução errada **reprova código correto**, que é pior que revisor nenhum.

1. **Escreva `plugins/aidlc-harness/agents/<nome>.md`.** O `name` da frontmatter tem de bater com o nome do arquivo. Use `model: haiku` e `effort: low` para revisão de padrão, que é varredura mecânica.
2. **A `description` é paga em toda sessão.** Deixe nela só o gatilho (qual stack, quando invocar). O inventário do que o revisor confere vai no **corpo**, que só é pago quando ele roda.
3. **Ancore nas regras, não na sua opinião.** Liste as fontes de verdade no topo do corpo e mande lê-las. Um revisor que discorda da regra da stack reprova o padrão canônico.
4. **Declare o gate no manifesto**, com `"agent": "<nome>"`, `"model": "haiku"` e `"blocking": true`.
5. **Declare a evidência que o cobra**, com `"id": "stack-review"`, `markers` casando o nome do agente, e `whenTouches` no escopo dele. Sem isso o `Stop` libera com a revisão nunca feita.
6. **Rode `node scripts/check-plugin.mjs`.** Ele reprova referência pendurada, revisor que o `strategy` pede e nenhum gate declara, gate bloqueante sem evidência que o cobre, e evidência cobrando gate que se declara opcional.

O `aidlc-gate` **não executa** gate do tipo agente: quem dispara o subagente é a sessão. Ele aparece como **PENDENTE** e vira `::warning::` no CI, porque runner não dispara subagente. Quem cobra de verdade é o `dod-check`, no `Stop`, lendo o transcript.

## Escrever um recorte de `strategy`

O bloco `strategy` é o que faz a regra certa chegar no instante em que o arquivo muda. Ele tem duas partes.

`always` são os ponteiros válidos para qualquer arquivo daquela tecnologia. Entram no mapa que o `strategy-map` injeta a cada prompt, então são caros: dois ou três, no máximo.

`paths` são os recortes por caminho. Cada um tem `when` (globs do caminho tocado), `read` (o que abrir antes de escrever), `why` (uma linha dizendo o que quebra se ignorar) e o `reviewer` opcional.

```json
{
  "when": ["src/**/*.controller.ts"],
  "read": ["@kit/rules/testing.md"],
  "why": "endpoint sem teste ao lado entra no CI sem prova de que responde",
  "reviewer": "supply-chain-reviewer"
}
```

Três regras que valem a pena decorar:

**O prefixo `@kit/` aponta para dentro do plugin.** Um caminho fixo para a pasta do kit acerta um layout e quebra o outro em silêncio. Quem resolve o token é o kit, que sabe onde ele próprio está instalado. Ponteiro sem `@kit/` é relativo à raiz do repositório e serve para as regras locais dele.

**O `why` não é decoração.** Ponteiro sem motivo não é lido. Escreva o que quebra, não o que a regra é.

**Cada ponteiro sai uma vez por sessão.** Repetir a mesma linha a cada save é o caminho mais curto para alguém desligar o hook, e hook desligado entrega zero.

O `check-quality-manifests` reprova ponteiro `@kit/` que aponta para o vazio e recorte sem `when`. Os ponteiros relativos ao repositório consumidor ele não consegue verificar daqui.

## Acrescentar uma regra

As regras do kit moram em `plugins/aidlc-harness/rules/` e **nunca se auto-carregam**: plugin não serve `.claude/rules/`. A forma de entregá-las é ligar a regra a um recorte de `strategy` (acima), que é o caminho que não depende de alguém lembrar de abrir um índice. Regra que nenhum recorte aponta é regra que ninguém lê.

## Acrescentar um hook

1. Escreva em `plugins/aidlc-harness/hooks/`.
2. **Registre em `hooks/hooks.json`.** Hook que existe no diretório e não está no JSON nunca roda, e o `check-plugin` reprova exatamente isso.
3. **Escreva o teste em `hooks/hooks.test.mjs`**, nos dois sentidos: bloqueia quando deve e libera quando deve. O teste mede a latência; o teto é 400 ms, porque o `Stop` dispara dezenas de vezes por sessão.
4. **Falhe para o lado de deixar trabalhar.** Sem tecnologia reconhecida, sem caminho, com stdin inválido: saia com 0 e calado.
5. **Dê um kill switch** e diga o nome dele na mensagem.

Duas armadilhas:

`process.stdout.write(x)` seguido de `process.exit(0)` **trunca em 64 KiB** quando o stdout é pipe, que é sempre o caso de hook. Use o `escreve()` de `lib/strategy.mjs`, que sai só depois do flush.

`require()` dentro de um `.mjs` lança `ReferenceError`, e um `catch` genérico o engole. A função some calada e devolve vazio. Teste o caminho feliz de verdade, não só a ausência de erro.

## Antes de fechar

```bash
node --test
node scripts/check-plugin.mjs
node scripts/check-quality-manifests.mjs
node scripts/check-docs-consistency.mjs
node plugins/aidlc-harness/tools/aidlc-identity
```

E a regra que vale para tudo acima: **teste de mutação**. Quebre de propósito a coisa que você acabou de proteger e confira que o check reprova. Um check que nunca foi visto reprovando é uma esperança, não uma garantia.
