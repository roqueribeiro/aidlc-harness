---
name: aidlc-context
description: 'O contexto de produto do PROJETO em que você está: o que ele é, para quem, o que já foi decidido e não se reabre, o vocabulário do time. Use quando a tarefa exigir julgamento de produto e não só padrão de código: nomear uma funcionalidade, escrever texto que o usuário lê, avaliar escopo, escrever documentação, ou entrar num repo sem saber onde ele se encaixa.'
allowed-tools: Bash, Read, Glob, Grep
---

# Contexto do projeto

O contexto do produto mora no próprio projeto, em `context/product.md` na raiz (ou em `.aidlc/context/product.md`). O kit não traz contexto de produto nenhum: ele traz o molde, em `templates/context/product.md`, e a obrigação de preenchê-lo.

## O que fazer ao ser chamado

1. Procure o arquivo: `context/product.md`, depois `.aidlc/context/product.md`.
2. Se existir, leia inteiro antes de decidir, não depois de entregar. O que está em "Decisões já tomadas" não se reabre: se discordar, diga em uma linha e siga o que está escrito.
3. Se não existir, diga isso na primeira resposta e proponha criar a partir do molde. Não invente decisão, convenção nem nome que não esteja registrado: faltou informação, pergunte antes de escrever.

## Quando isto importa de verdade

- Nome de funcionalidade, texto de interface, mensagem de erro, documentação para usuário.
- Escopo: algo pertence a este produto, a outro, ou a nenhum dos dois?
- Resposta a "o que é isto, para quem, por que existe".

## Mantendo vivo

Decisão nova que fechou no chat e não foi para o arquivo morreu. No fim da resposta, avise o que é decisão nova e proponha a edição do `context/product.md`. Quando o arquivo contradiz o código, o conflito é achado para reportar, não para resolver em silêncio.

Mecanismo: o hook `strategy-map` entrega o núcleo (`context/kernel.md` do projeto, poucas linhas) a cada sessão e depois de cada compactação; este skill abre o resto sob demanda. A checagem de que o arquivo não apodreceu é o gate de documentação do manifesto da tecnologia.
