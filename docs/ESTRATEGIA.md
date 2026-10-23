# A estratégia do kit

> Por que o `aidlc-harness` é desenhado do jeito que é, o que cada decisão custa e o que dá para levar para outro lugar. Para quem quer entender o desenho antes de adotar ou de contribuir.
>
> Os números deste documento foram medidos neste repositório (Linux, Node 22) e conferidos por `scripts/check-docs-consistency.mjs`. Onde algo é opinião ou lição de uso, o texto diz.

---

## O problema

Agentes de IA geram código barato. Conferir continua caro. Sem um critério escrito, "pronto" é o que o agente achar que é, e o mesmo tipo de problema volta na revisão pela quinta vez, porque cada sessão recomeça sem saber o que o time já aprendeu.

Três consequências práticas:

1. **A revisão vira o gargalo.** Gerar ficou barato; conferir, não.
2. **"Está pronto" não quer dizer nada** sem critério executável.
3. **O mesmo conserto é refeito em cada repositório**, porque a regra mora na cabeça de alguém ou numa conversa que ninguém relê.

O kit ataca isso no tooling, não no prompt.

---

## A tese

Quatro decisões carregam o resto.

**1. Critério de aceite é dado, não prosa.** "Rode os testes" é interpretável. Um JSON dizendo qual comando, com qual saída reprova, em qual plataforma, e se bloqueia ou não, é executável. Cada tecnologia tem um manifesto em `plugins/aidlc-harness/quality/`, validado por schema. Hoje são 4 manifestos com 19 gates e 6 evidências declarados, mais a camada da organização (`_org.json`), que acrescenta o gate `lockfile` e a evidência de limpeza.

**2. Determinismo vence modelo, sempre que a tarefa é mecânica.** Se uma checagem pode ser um script, é um script. O agente é caro e não reproduzível; um processo `node` de dezenas de milissegundos é barato e dá a mesma resposta toda vez.

**3. Evidência antes de "pronto".** O agente não declara conclusão: cola a saída do gate no chat, e o hook de `Stop` recusa o fim do turno se ela não estiver lá.

**4. Quem aprova é gente.** Nas fases do AI-DLC, a aprovação é uma assinatura (`Aprovado por:` e `Data:`) que uma pessoa escreve no próprio artefato, e `aidlc-phase check` reprova aprovação em branco ou com nome de ferramenta de IA. A IA propõe e implementa; as decisões de Inception e o fechamento de Construction são de pessoas. Ver [AIDLC.md](AIDLC.md).

---

## As peças

| Peça | Quantidade | O que faz |
| --- | --- | --- |
| Hooks | 8 | Cobram regra no tooling: gerenciador de pacote, vazamento de segredo, arquivo solto fora da pasta de rascunho, evidência ao encerrar, promessa de continuar, e entregam a regra certa quando o arquivo muda |
| Agentes | 3 | `scanner` (varredura mecânica, barato), `advisor` (julgamento raro, caro), `supply-chain-reviewer` (dependência nova) |
| Skills | 4 | `aidlc-context`, `bolts`, `blast`, `repo-standard` |
| Comandos | 4 | `/inception`, `/construction`, `/gate`, `/status` |
| Executáveis | 13 | `aidlc-gate`, `aidlc-init`, `aidlc-phase`, `aidlc-identity`, `aidlc-secrets`, `aidlc-doctor` e outros, todos sem custo de token |

**Medido em 2026-10-23 (Linux, Node 22):** cada hook responde em 31 a 67 ms. Hooks são processos externos, então não gastam contexto do modelo. O repositório tem 269 testes passando.

---

## Política de modelos: três papéis, três preços

O erro caro não é escolher o modelo errado num turno. É pagar contexto de sobra em todos.

| Papel | Quando | Como se invoca |
| --- | --- | --- |
| **Scanner** (barato) | Varredura mecânica sem julgamento: inventário, drift, diff, triagem de saída | Subagente com esforço baixo |
| **Executor** (intermediário) | O turno a turno: implementar, rodar gate, colar evidência, documentar | A sessão principal |
| **Advisor** (caro) | Julgamento raro: arquitetura, refutar um achado, gate que falhou duas vezes, ação irreversível | Subagente sob demanda |

Um subagente **não herda a conversa**. Então "o advisor revisa o contexto" não acontece de graça: entregue o diff, o caminho do transcript ou um briefing curto. Copiar a conversa inteira anula a economia.

---

## O critério de aceite, em dado

A forma importa mais que o conteúdo:

```json
{
  "tech": "node-yarn",
  "detect": { "...como reconhecer um repositório desta stack..." },
  "gates": [
    { "id": "test", "cmd": "yarn test", "blocking": true, "platform": "any" }
  ],
  "evidence": [
    { "id": "gate-output", "label": "Saída do gate colada no chat" }
  ]
}
```

Três detalhes que só aparecem no uso:

- **`platform`**: um gate que só roda em um sistema precisa sair como "pulado", nunca como verde. Fingir verde é pior que vermelho.
- **`whenTouches`**: torna a evidência condicional. Exigir prova de algo que a sessão não tocou treina a pessoa a ignorar o gate.
- **Validação por schema**: o `check-quality-manifests` reprova manifesto inválido antes de ele virar critério.

O manifesto do projeto (`.aidlc/quality/<tech>.json`) sobrescreve o do kit para o mesmo `tech`. Veja [ESTENDER.md](ESTENDER.md).

---

## O contrato de evidência

O hook de `Stop` recusa terminar sem a evidência que o manifesto pede. Isso é forte o bastante para virar estorvo, então quatro salvaguardas nasceram junto:

| Salvaguarda | Comportamento |
| --- | --- |
| Nunca prende | Depois de três recusas na mesma sessão, vira aviso e libera |
| Sempre reversível | `AIDLC_GATE=0` desliga |
| Só quando há entrega | Árvore de trabalho limpa significa que não há o que provar |
| Condicional | Evidência só é exigida quando a sessão tocou um arquivo que casa o glob |

**Um gate que prende é um gate que vai ser desligado na primeira semana.** Projete a saída junto com a trava.

---

## Segredo sem entregar a chave

O transcript de uma sessão pode ser armazenado e sincronizado. Um `echo $TOKEN` vira segredo persistido fora da máquina. Por isso nenhum comando do `aidlc-secrets` imprime valor: o consumo é por injeção no processo filho.

```bash
aidlc-secrets exec github -- gh api user
```

O valor sai do cofre do sistema, entra no ambiente do filho, e o processo termina. O `secret-guard` bloqueia o que contornaria isso (`echo` de variável secreta, `set -x`, base64 de credencial). Cada projeto pode declarar os próprios segredos em `.aidlc/secrets.json`.

---

## O que mantém a documentação honesta

`scripts/check-docs-consistency.mjs` conta do disco o que os documentos afirmam (quantos hooks, agentes, skills, executáveis) e avisa quando um número escrito diverge. `docs/PROMPTS.md` é gerado de `commands/` e o CI reprova se ficar defasado. O `aidlc-identity` impede que dado pessoal ou de infraestrutura entre no repositório.

Hash de fonte sozinho não basta: ele pega "a fonte mudou", não "o número está errado". Contar do disco pega o segundo.

---

## O que o kit não faz

Dito sem rodeio, porque documento que só conta acerto não ajuda:

- **Hooks bloqueantes só existem no Claude Code.** Em Kiro e Copilot o kit entrega as instruções (`aidlc-init`), mas quem cobra é o CI e as pessoas. Ver [ADAPTADORES.md](ADAPTADORES.md).
- **Operations é a parte mais fina.** O kit cobre bem Inception e Construction; para Operations há conteúdo mínimo.
- **Não foi testado em macOS, Windows, Kiro nem Copilot.** Testes automatizados rodam em Linux.
- **Não é documentação da AWS.** É uma interpretação do AI-DLC, com a fonte linkada em [AIDLC.md](AIDLC.md).

---

## Lições que se levam para outro lugar

1. **Escreva o critério de aceite como dado.** No momento em que ele é interpretável, ele é ignorável.
2. **Toda checagem mecânica quer ser um script.** Se um agente está fazendo aritmética de caminho de arquivo, alguém está pagando caro por uma calculadora.
3. **Um gate que prende vai ser desligado.** Dê a saída de emergência junto com a trava.
4. **Falha silenciosa custa mais que falha barulhenta.** Manifesto inválido que é ignorado sem aviso parece funcionar. Por isso o kit reporta o que ignorou.
5. **Documento sem gate apodrece.** Meça o que ele afirma.
6. **Regra sem mecanismo é decoração.** Antes de escrever uma norma, diga qual hook, gate ou manifesto vai executá-la.
7. **Check que nunca reprovou não é check.** Quebre de propósito (teste de mutação) antes de declarar pronto.
8. **Contexto sempre-on é pago em cada subagente.** Mantenha-o curto.
