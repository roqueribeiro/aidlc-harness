# AI-DLC e como o kit o interpreta

> **Este documento é uma interpretação.** O AI-DLC (AI-Driven Development Life Cycle) foi descrito pela AWS. Este kit não é documentação, produto nem endosso da AWS. O que está abaixo sobre o método vem do post de lançamento ([AI-Driven Development Life Cycle: Reimagining Software Engineering](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/), AWS DevOps & Developer Productivity Blog, 31/07/2025). Se a AWS publicar algo que contradiga o que está aqui, a AWS está certa e este arquivo está desatualizado.

## O método, em um parágrafo

Segundo o post, o AI-DLC organiza o trabalho em três fases. Na **Inception**, a IA transforma a intenção de negócio em requisitos, histórias e unidades de trabalho, e o time valida as perguntas e propostas dela (um ritual que o post chama de *Mob Elaboration*). Na **Construction**, a IA propõe arquitetura, modelo de domínio, código e testes a partir do contexto validado, e o time decide em conjunto as escolhas técnicas (*Mob Construction*). Na **Operations**, a IA aplica o contexto acumulado a infraestrutura como código e a deploys, sob supervisão. Os termos mudam: *bolts* (ciclos curtos, de horas ou dias) no lugar de sprints, *units of work* no lugar de épicos. Os artefatos ficam no repositório, o que preserva o contexto entre sessões. O padrão que se repete é planejar, esclarecer, implementar, e a IA "adia as decisões críticas aos humanos".

## O que o kit faz com cada parte

| No AI-DLC | No kit | Mecanismo |
| --- | --- | --- |
| Fase Inception | `aidlc/inception/`: requisitos, histórias, unidades de trabalho | `/inception` conduz; `aidlc-phase check inception` confere |
| Mob Elaboration | A IA pergunta em rodadas de no máximo cinco, com opções e recomendação; a equipe responde | instrução do comando; o kit **não** reúne pessoas, ele registra o que a equipe respondeu |
| Units of work | `aidlc/inception/units-of-work.md`, cada uma com a evidência que a dá por pronta | `aidlc-phase` exige o arquivo sem campo por preencher |
| Validação humana | `Aprovado por:` e `Data:` no fim de cada artefato, preenchidos por uma pessoa | `aidlc-phase` reprova em branco e nome de IA; não prova que o nome é de quem aprovou |
| Fase Construction | `aidlc/construction/`: desenho e plano de testes antes do código | `/construction` conduz; `aidlc-phase check construction` exige a Inception completa primeiro |
| Mob Construction | A IA propõe alternativas com custo e recomendação; a equipe escolhe; o descartado fica registrado | instrução do comando; o kit **não** orquestra uma sessão ao vivo |
| Bolts | A skill `bolts`: uma unidade por vez, com a sequência de fechamento (teste, gate, principal atualizada, limpeza) | `dod-check` cobra a limpeza; `aidlc-gate` cobra o critério de aceite |
| Artefatos no repositório | Pasta `aidlc/` e `aidlc/decisions.md`, versionados com o código | `aidlc-init` cria; o CI confere o estado das fases |
| Fase Operations | `aidlc/decisions.md`, `aidlc-cycle`, `aidlc-limpeza` | veja abaixo: é a parte mais fina do kit |

## O que o kit acrescenta ao método

O post descreve o *quê* do ciclo; o kit acrescenta controles que fazem o "pronto" ser conferível:

- **Critério de aceite como dado** (`quality/*.json`) e **evidência obrigatória**: a saída crua do gate no chat, cobrada por hook no Claude Code.
- **Teste de mutação** dos próprios checks: um check que nunca reprovou não prova nada.
- **Scanner de identidade**: nada que identifique pessoa ou infraestrutura vai para o repositório.
- **Cofre de segredos** que o agente usa sem ver.
- **Revisão de cadeia de suprimento** para dependência nova.
- **Instruções para três ferramentas** a partir de uma fonte, com conferência de divergência.

## Onde o kit se afasta do método, ou fica aquém

Dito para você decidir com os olhos abertos:

1. **Operations é a parte mais fina.** O kit registra decisões, mede o ciclo (`aidlc-cycle`) e limpa a bancada. Ele **não** gera infraestrutura como código, não faz deploy e não observa produção. A promessa do método de a IA aplicar o contexto acumulado a deploys e infraestrutura fica por conta do seu pipeline.
2. **Os rituais "mob" são práticas de equipe.** O kit dá a estrutura (perguntas em rodadas, aprovação no arquivo), mas não reúne ninguém. Uma Inception respondida por uma pessoa só, às pressas, passa no `aidlc-phase` do mesmo jeito que uma discutida por todo o time. A qualidade do ritual é da equipe.
3. **A validação é conferida na forma.** `aidlc-phase` garante que existe aprovação e que não é de uma IA. Quem exige que a aprovação seja de quem tem autoridade para dá-la é o processo da sua organização (por exemplo, revisão obrigatória do pull request que comita a assinatura).
4. **O vocabulário é adaptado.** "Bolt" no kit é a unidade de trabalho com a sequência de fechamento da skill `bolts`. Não é um ciclo medido em horas por definição do método; se a sua unidade levar uma semana, o kit não impede.
5. **As fases do kit são duas (Inception e Construction)** no `aidlc-phase`, porque Operations não tem artefato de aprovação próprio aqui.

## Leitura recomendada

- O post original (link acima), para o método.
- [ADAPTADORES.md](ADAPTADORES.md), para o que cada ferramenta de IA recebe.
- [REGULADO.md](REGULADO.md), para uma organização com requisitos de auditoria e conformidade.
