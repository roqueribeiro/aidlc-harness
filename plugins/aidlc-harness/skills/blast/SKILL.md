---
name: blast
description: Descobre o raio de impacto entre repositórios antes de tocar em código. Use SEMPRE antes de editar um arquivo que possa ser contrato entre repos (schema de API, controller ou DTO, interface de uma biblioteca compartilhada, tokens de design espelhados, manifesto de qualidade). Também quando o usuário perguntar "o que mais muda se eu mexer aqui" ou "quem depende disso".
allowed-tools: Bash, Read, Grep, Glob
---

# /blast

A ordem de mudança entre repos costuma viver em prosa. Prosa funciona enquanto alguém lembra de ler, e falha em silêncio quando não lembra: o schema de uma API muda, o consumidor não acompanha, e o defeito aparece dias depois sem ninguém ligar as duas coisas. O grafo do projeto (`.aidlc/graph.json`) põe essa ordem num arquivo que uma ferramenta consulta.

```bash
aidlc-graph blast src/styles/tokens.scss      # por caminho de arquivo
aidlc-graph blast app-exemplo                # tudo que sai daquele repo
aidlc-graph blast --json                        # pra encadear com outra coisa
```

## Como ler a saída

**Onda** é o que sai junto. Tudo da onda 1 vai no mesmo ciclo; a onda 2 depende da 1 estar pronta. Ignorar isso é o que produz produção com as duas pontas em versões diferentes.

**Fonte** é quem muda primeiro, e depende da forma do contrato:

- **fan-out**, o caso comum: um repo *provê* e vários consomem. O serviço publica o schema, o cliente gera o tipo, a interface desenha. A mudança desce.
- **fan-in**: o consumidor *define* a interface porque é ele quem a usa, e vários repos *provêem* a implementação. A mudança sobe. Método novo declarado no consumidor sem as implementações do outro lado vira erro em runtime que só aparece em produção.

## Quando o blast volta vazio

É o caso comum e é uma resposta boa: significa que a mudança fica no repo. Não force impacto que não existe.

## Quando o blast diverge do README

Se o README do projeto descreve a mesma ordem em prosa e o grafo discorda, **um dos dois está errado e você precisa dizer qual**, em vez de escolher em silêncio.

## Depois de editar

Rode de novo no que você tocou de verdade:

```bash
git diff --name-only | xargs -I{} aidlc-graph blast {}
```

O que aparecer aí entra na entrega, não numa lista de "depois". Contrato quebrado pela metade é pior que contrato não mexido.

## Manter o grafo vivo

Contrato novo entre repos entra no grafo do projeto (`.aidlc/graph.json`; o formato está em `graph/ecosystem.example.json` do kit): um nó `kind: "contract"` com `owner`, `shape`, `files` e `why`, mais as arestas com `order` e `todo`. `aidlc-graph validate` recusa contrato sem `why` ou sem `todo`, de propósito: um raio de impacto que não diz o que fazer não serve para nada.
